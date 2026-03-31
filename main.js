/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 */

"use strict";

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const { KNXClient, KNXClientEvents, dptlib, logStream } = require("knxultimate");
const loadMeasurement = require("./lib/loadMeasurement");
const projectImport = require("./lib/projectImport");
const tools = require("./lib/tools.js");
const DoubleKeyedMap = require("./lib/doubleKeyedMap.js");
const similarity = require("./lib/similarity.js");
const { parseKnxproj } = require("./lib/knxproj/index.js");

class openknx extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options]
     */
    constructor(options) {
        super({
            ...options,
            name: "openknx",
        });
        this.gaList = new DoubleKeyedMap();
        this.autoreaddone = false;
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("objectChange", this.onObjectChange.bind(this));
        this.on("unload", this.onUnload.bind(this));

        this.mynamespace = this.namespace;
        this.isForeign = false;
        this.knxConnection = undefined;
        this.connected = false;

        this.timeout1 = undefined;
        this.timeout2 = undefined;
        this.interval1 = undefined;
        this.reconnectCount = 0;
        this.reconnectTimer = undefined;
        this.stopping = false;
        this.linkedStateMap = {}; // foreignStateId → knxObjectId (reverse lookup for Direct Link)

        // redirect log from KNXUltimate (winston-based logStream) to adapter log
        // Collapse multiline messages (stack traces) into a single line
        this.logHandler = entry => {
            const level = entry.level?.toLowerCase();
            const msg = (entry.message || String(entry)).replace(/\n/g, " | ");
            if (level === "error") {
                if (this.stopping) {
                    return;
                }
                this.log.warn(`KNXENGINE: ${msg}`);
            } else if (level === "warn") {
                this.log.warn(msg);
            } else if (level === "info") {
                this.log.info(msg);
            } else if (level === "debug") {
                this.log.debug(msg);
            } else {
                this.log.silly(msg);
            }
        };
        logStream.on("data", this.logHandler);
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // adapter initialization

        //after installation
        if (tools.isEmptyObject(this.config)) {
            this.log.warn("Adapter configuration missing, please do configuration first.");
            return;
        }

        if (this.config.targetNamespace && this.config.targetNamespace !== this.namespace) {
            this.mynamespace = this.config.targetNamespace;
            this.isForeign = true;
            this.log.info(`Using namespace ${this.mynamespace}`);
            await this.subscribeForeignStatesAsync(`${this.mynamespace}.*`);
            await this.subscribeForeignObjectsAsync(`${this.mynamespace}.*`);
        } else {
            this.subscribeStates("*");
            await this.subscribeObjectsAsync("*");
        }
        // Ensure info objects exist (may be missing after clean re-import)
        await this.setObjectNotExistsAsync("info", { type: "channel", common: { name: "Information" }, native: {} });
        await this.setObjectNotExistsAsync("info.connection", { type: "state", common: { role: "indicator.connected", name: "KNX Gateway connected", type: "boolean", read: true, write: false, def: false }, native: {} });
        await this.setObjectNotExistsAsync("info.busload", { type: "state", common: { role: "info", name: "Busload", type: "number", read: true, write: false, def: 0, unit: "%" }, native: {} });
        await this.setObjectNotExistsAsync("info.messagecount", { type: "state", common: { role: "info", name: "Message count", type: "number", read: true, write: false, def: 0 }, native: {} });
        this.setState("info.busload", 0, true);

        this.main(true);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            clearTimeout(this.timeout1);
            clearTimeout(this.timeout2);
            clearInterval(this.interval1);
            clearInterval(this.autoreadTimer);
            clearTimeout(this.reconnectTimer);
            this.stopping = true;
            this.connected = false;

            const cleanupLogHandler = () => {
                // Remove logStream listener to prevent memory leak
                // MUST be done after Disconnect, otherwise Disconnect-Logs are lost
                if (this.logHandler) {
                    logStream.removeListener("data", this.logHandler);
                }
            };

            if (this.knxConnection) {
                // Prevent processing of late events during shutdown
                this.knxConnection.removeAllListeners();

                // Disconnect with timeout fallback
                const disconnectTimeout = setTimeout(() => {
                    cleanupLogHandler();
                    callback();
                }, 2000);

                this.knxConnection
                    .Disconnect()
                    .then(() => {
                        clearTimeout(disconnectTimeout);
                        cleanupLogHandler();
                        callback();
                    })
                    .catch(err => {
                        this.log.warn(`Error during KNX disconnect: ${err}`);
                        clearTimeout(disconnectTimeout);
                        cleanupLogHandler();
                        callback();
                    });
            } else {
                cleanupLogHandler();
                callback();
            }
        } catch (e) {
            this.log.error(`Error in onUnload: ${e}`);
            // In case of error we should still try to clean up and call the callback
            if (this.logHandler) {
                logStream.removeListener("data", this.logHandler);
            }
            callback();
        }
    }

    // New message arrived. obj is array with current messages
    // triggered from admin page read in knx project
    getDptList() {
        const list = [];
        for (const dptKey of Object.keys(dptlib.dpts).sort((a, b) => {
            const na = parseInt(a.replace("DPT", ""));
            const nb = parseInt(b.replace("DPT", ""));
            return na - nb;
        })) {
            const dptObj = dptlib.dpts[dptKey];
            const baseNum = dptKey.replace("DPT", "");
            list.push({ value: dptKey, label: `${baseNum} - ${dptObj.basetype?.desc || dptKey}` });
            if (dptObj.subtypes) {
                for (const sub of Object.keys(dptObj.subtypes).sort()) {
                    const st = dptObj.subtypes[sub];
                    list.push({ value: `${dptKey}.${sub}`, label: `${baseNum}.${sub} - ${st.name || st.desc || ""}` });
                }
            }
        }
        return list;
    }

    onMessage(obj) {
        if (typeof obj === "object") {
            switch (obj.command) {
                case "import": {
                    this.log.info("ETS XML import...");
                    const doXmlImport = () => {
                        projectImport.parseInput(this, obj.message.xml, (parseError, res) => {
                            this._finishImport(res, parseError, obj);
                        });
                    };
                    if (obj.message.cleanImport) {
                        this.log.info("Clean import: deleting all existing KNX objects before import...");
                        this.cleanImport().then(doXmlImport);
                    } else {
                        doXmlImport();
                    }
                    break;
                }
                case "importKnxproj": {
                    this.log.info("ETS .knxproj import...");
                    const doKnxprojImport = async () => {
                        try {
                            const buffer = Buffer.from(obj.message.knxprojBase64, "base64");
                            const password = obj.message.password || undefined;
                            const language = obj.message.language || undefined;
                            const knxProject = await parseKnxproj(buffer, password, language);
                            const res = projectImport.convertKnxProject(this, knxProject);
                            await this._createRoomEnums(res.rooms);
                            this._finishImport(res.objects, res.error, obj);
                        } catch (e) {
                            this.log.error(`knxproj import failed: ${e.message}`);
                            if (obj.callback) {
                                this.sendTo(
                                    obj.from,
                                    obj.command,
                                    {
                                        error: e.message,
                                        count: 0,
                                        needsPassword: e.name === "InvalidPasswordException",
                                    },
                                    obj.callback,
                                );
                            }
                        }
                    };
                    if (obj.message.cleanImport) {
                        this.log.info("Clean import: deleting all existing KNX objects before import...");
                        this.cleanImport().then(doKnxprojImport);
                    } else {
                        doKnxprojImport();
                    }
                    break;
                }
                case "createAlias":
                    this.log.info("Create aliases...");
                    projectImport.findStatusGAs(
                        this,
                        this.gaList,
                        obj.message.aliasRegexp,
                        obj.message.aliasSimilarity,
                        obj.message.aliasPath,
                        obj.message.aliasRange,
                        (count, err) => {
                            if (obj.callback) {
                                const res = {
                                    error: err,
                                    count: count,
                                };
                                this.sendTo(obj.from, obj.command, res, obj.callback);
                            }
                        },
                    );
                    break;
                case "detectInterface":
                    this.log.info("Detect Interface...");
                    KNXClient.discoverInterfaces()
                        .then(interfaces => {
                            this.log.info(`Discovery found ${interfaces.length} interface(s)`);
                            if (obj.callback) {
                                if (interfaces.length === 0) {
                                    this.sendTo(
                                        obj.from,
                                        obj.command,
                                        { error: "No KNX interfaces found", devicesFound: 0 },
                                        obj.callback,
                                    );
                                    return;
                                }
                                const all = interfaces.map(i => ({
                                    ip: i.ip,
                                    port: i.port,
                                    knxAdr: i.ia,
                                    deviceName: i.name,
                                    services: i.services,
                                    type: i.type,
                                    transport: i.transport,
                                }));
                                const res = {
                                    error: null,
                                    ip: all[0].ip,
                                    port: all[0].port,
                                    knxAdr: all[0].knxAdr,
                                    deviceName: all[0].deviceName,
                                    devicesFound: all.length,
                                    interfaces: all,
                                };
                                this.sendTo(obj.from, obj.command, res, obj.callback);
                            }
                        })
                        .catch(err => {
                            this.log.warn(`Discovery failed: ${err.message}`);
                            if (obj.callback) {
                                this.sendTo(
                                    obj.from,
                                    obj.command,
                                    { error: err.message, devicesFound: 0 },
                                    obj.callback,
                                );
                            }
                        });
                    break;
                case "getDptList": {
                    const list = this.getDptList();
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, list, obj.callback);
                    }
                    break;
                }
                case "restart":
                    this.log.info("Restarting...");
                    this.restart();
                    break;
                default:
                    this.log.warn(`Unknown command: ${obj.command}`);
                    break;
            }
        }
        return true;
    }

    /**
     * Create enum.rooms.* objects from the rooms map produced by convertKnxProject.
     *
     * @param {{[key: string]: {name: string, members: string[]}}} rooms
     */
    async _createRoomEnums(rooms) {
        if (!rooms || Object.keys(rooms).length === 0) {
            return;
        }
        for (const [roomPath, roomInfo] of Object.entries(rooms)) {
            const enumId = `enum.rooms.${roomPath}`;
            const members = roomInfo.members.map(m => `${this.namespace}.${m}`);
            try {
                const existing = await this.getForeignObjectAsync(enumId);
                if (existing) {
                    // Merge members into existing enum
                    const existingMembers = existing.common.members || [];
                    const merged = [...new Set([...existingMembers, ...members])];
                    existing.common.members = merged;
                    await this.setForeignObjectAsync(enumId, existing);
                } else {
                    await this.setForeignObjectAsync(enumId, {
                        _id: enumId,
                        type: "enum",
                        common: {
                            name: roomInfo.name,
                            members: members,
                        },
                        native: {},
                    });
                }
                this.log.debug(`Created/updated room enum ${enumId} with ${members.length} members`);
            } catch (e) {
                this.log.warn(`Could not create room enum ${enumId}: ${e.message}`);
            }
        }
        this.log.info(`Created ${Object.keys(rooms).length} room enums from ETS project locations`);
    }

    /**
     * Common import finish logic shared between XML and knxproj import.
     */
    _finishImport(res, parseError, obj) {
        this.updateObjects(res, 0, obj.message.onlyAddNewObjects, (updateError, length) => {
            const msg = {
                error:
                    parseError && parseError.length == 0
                        ? updateError
                        : `${parseError ? parseError : ""}<br/>${updateError}`,
                count: length,
            };

            this.removeUnusedObjects(res, obj.message.removeUnusedObjects);

            this.log.info(`Project import finished with ${length} GAs`);
            if (obj.callback) {
                this.sendTo(obj.from, obj.command, msg, obj.callback);
            }
        });
    }

    /*
     * remove knx elements that are not found in the current import file
     */
    async removeUnusedObjects(importObjects, removeUnusedObjects) {
        const objects = await this.getAdapterObjectsAsync();

        Object.entries(objects).forEach(object => {
            if (
                object[1].native &&
                Object.keys(object[1].native).length === 0 &&
                Object.getPrototypeOf(object[1].native) === Object.prototype
            ) {
                // object is no knx element, skip
            } else {
                const found = importObjects.find(element => `${this.mynamespace}.${element._id}` === object[0]);
                if (!found) {
                    // knx element in object tree not found in import file
                    this.log.info(
                        `${removeUnusedObjects ? "deleting" : ""} 
                         existing element in object tree not found in import file: ${object[0]}`,
                    );
                    if (removeUnusedObjects) {
                        this.delObject(object[0], err => {
                            if (err) {
                                this.log.warn(`could not delete object ${object[0]}`);
                            }
                        });
                    }
                }
            }
        });
    }

    /*
     * delete all existing KNX objects before a clean re-import
     */
    async cleanImport() {
        await this.delObjectAsync("", { recursive: true });
        this.log.info("cleanImport: deleted all existing KNX objects");
    }

    // write found communication objects to adapter object tree
    updateObjects(objects, i, onlyAddNewObjects, callback) {
        if (i >= objects.length) {
            // end of recursion reached
            let err = this.warnDuplicates(objects);

            this.getObjectList(
                {
                    startkey: this.namespace,
                    endkey: `${this.namespace}\u9999`,
                },
                (e, result) => {
                    const gas = [];
                    const duplicates = [];
                    if (result) {
                        result.rows.forEach(element => {
                            if (element.value?.native?.address) {
                                gas.push(`${element.value.native.address} ${element.value.common.name}`);
                            }
                        });
                    }
                    const tempArray = [...gas].sort();
                    for (let i = 0; i < tempArray.length; i++) {
                        if (tempArray[i + 1] === tempArray[i]) {
                            duplicates.push(tempArray[i]);
                        }
                    }
                    const message = `Objects imported where objects exist that have same KNX group address: ${duplicates}`;
                    if (duplicates.length) {
                        this.log.warn(message);
                        err ? (err = `${err}<br/>${message}`) : (err = message);
                    }

                    if (typeof callback === "function") {
                        callback(err, objects.length);
                    }
                },
            );
            return;
        }
        if (onlyAddNewObjects) {
            // if user setting Add only new Objects write only new objects
            // extend object would overwrite user made element changes if known in the import, not intended
            this.setObjectNotExists(`${this.mynamespace}.${objects[i]._id}`, objects[i], err => {
                if (err) {
                    this.log.warn(`error store Object ${objects[i]._id} ${err ? ` ${err}` : ""}`);
                }
                this.timeout1 = setTimeout(
                    this.updateObjects.bind(this),
                    0,
                    objects,
                    i + 1,
                    onlyAddNewObjects,
                    callback,
                );
            });
        } else {
            // setObjet to overwrite all existing settings, default
            this.setObject(`${this.mynamespace}.${objects[i]._id}`, objects[i], err => {
                if (err) {
                    this.log.warn(`error store Object ${objects[i]._id}${err ? ` ${err}` : ""}`);
                }
                this.timeout2 = setTimeout(
                    this.updateObjects.bind(this),
                    0,
                    objects,
                    i + 1,
                    onlyAddNewObjects,
                    callback,
                );
            });
        }
    }

    /*
     * IOBroker Object tree cannot store 2 objects of same name, warn
     * In ETS it is possible as long as GA is different
     */
    warnDuplicates(objects) {
        const arr = [];
        const duplicates = [];

        for (const object of objects) {
            arr.push(object._id);
        }
        const tempArray = [...arr].sort();
        for (let i = 0; i < tempArray.length; i++) {
            if (tempArray[i + 1] === tempArray[i]) {
                duplicates.push(tempArray[i]);
            }
        }

        const message = `New object with an already existing Group Address name has not been created: ${duplicates}`;
        if (duplicates.length && this.log) {
            this.log.warn(message);
        }
        return duplicates.length ? message : "";
    }

    // obj to string and date to number for iobroker from knx stack
    convertType(val) {
        let ret;
        // convert, state value for iobroker to set has to be one of type "string", "number", "boolean" and additionally type "object"
        if (val instanceof Date) {
            // convert Date to number
            ret = Number(new Date(val));
        } else if (typeof val === "bigint") {
            // DPT29 returns BigInt which ioBroker cannot store
            ret = val.toString();
        } else if (Buffer.isBuffer(val)) {
            // before object check
            ret = val.toString("hex");
        } else if (typeof val === "object") {
            // https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md#states
            ret = JSON.stringify(val);
        } else {
            // keep string, boolean and number
            ret = val;
        }

        return ret;
    }

    /**
     * Is called if a subscribed state changes
     * state.ack is received with value false if set by user (nodered, script...), here we set it.
     * https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md
     *
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state) {
        let isRaw = false;

        if (!id || !state /*obj deleted*/ || typeof state !== "object") {
            return "invalid input";
        }

        // Direct Link: Check if this is a linked foreign state
        const linkedKnxId = this.linkedStateMap[id];
        if (linkedKnxId) {
            // Skip changes from our own adapter (avoid loops)
            if (state.from && state.from.startsWith(`system.adapter.${this.namespace}`)) {
                return "own change";
            }
            // Only react when the value actually changed (ts === lc)
            if (state.ts !== state.lc) {
                return "value unchanged";
            }
            if (!this.connected || !this.knxConnection) {
                return "not connected";
            }
            const gaData = this.gaList.getDataById(linkedKnxId);
            if (gaData?.native?.address && gaData?.native?.dpt) {
                const mode = gaData.native.linkedStateMode || "direct";
                let writeVal = state.val;

                // Threshold filter: skip if value change is below threshold
                const threshold = gaData.native.linkedStateThreshold;
                if (threshold > 0 && typeof state.val === "number") {
                    const curState = this.isForeign
                        ? await this.getForeignStateAsync(linkedKnxId)
                        : await this.getStateAsync(linkedKnxId);
                    if (curState?.val != null && typeof curState.val === "number") {
                        if (Math.abs(state.val - curState.val) < threshold) {
                            return "below threshold";
                        }
                    }
                }

                if (mode === "trigger" || mode === "toggle") {
                    // trigger/toggle: only react on EIN, ignore AUS (release events)
                    if (!state.val) {
                        return "trigger skip";
                    }
                }

                if (mode === "toggle") {
                    // read current KNX state and invert
                    const curState = this.isForeign
                        ? await this.getForeignStateAsync(linkedKnxId)
                        : await this.getStateAsync(linkedKnxId);
                    writeVal = !curState?.val;
                }

                // Apply user-defined conversion expression (e.g. "!!value", "value*100")
                if (gaData.native.linkedStateConvert) {
                    try {
                        writeVal = new Function("value", `return ${gaData.native.linkedStateConvert}`)(writeVal);
                    } catch (e) {
                        this.log.warn(`Direct Link convert error for ${gaData.native.address}: ${e.message}`);
                    }
                }

                this.log.debug(
                    `Direct Link [${mode}]: ${id} changed to ${JSON.stringify(state.val)}, writing ${JSON.stringify(writeVal)} to GA ${gaData.native.address}`,
                );
                try {
                    this.knxConnection.write(gaData.native.address, writeVal, gaData.native.dpt);
                } catch (e) {
                    this.log.warn(`Direct Link write failed for ${gaData.native.address}: ${e.message}`);
                }
                // Update KNX object state
                if (this.isForeign) {
                    this.setForeignState(linkedKnxId, { val: writeVal, ack: true });
                } else {
                    this.setState(linkedKnxId, { val: writeVal, ack: true });
                }
            }
            return "linkedState";
        }

        const gaData = this.gaList.getDataById(id);
        if (!gaData?.native?.address) {
            return "not a KNX object";
        }
        if (this.knxConnection == undefined) {
            return "KNX not started";
        }

        if (state.ack) {
            // only continue when application triggered a change without ack flag, filter out reception state changes

            // enable this for system testing:
            // this.interfaceTest(id, state);
            return "ack is set";
        }
        if (!this.connected) {
            this.log.warn("onStateChange: not connected to KNX bus");
            return "not connected to KNX bus";
        }

        const dpt = gaData.native.dpt;
        const ga = gaData.native.address;
        let knxVal = state.val;
        let rawVal;

        this.log.debug(`onStateChange ${id}: val=${JSON.stringify(state.val)} type=${typeof state.val} dpt=${dpt}`);

        // plausibilize against configured datatype
        if (knxVal == null) {
            this.log.warn(`Ignoring null/undefined value for ${id}`);
            return "null value";
        }
        // date DPTs must be checked before "number" because common.type is "number" for dates
        if (tools.isDateDPT(dpt)) {
            // only transform values that knxultimate cannot parse itself
            if (typeof knxVal === "string" && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(knxVal)) {
                // DD.MM.YYYY → Date
                const [d, m, y] = knxVal.split(".");
                knxVal = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            } else if (typeof knxVal === "string" && /^\d+$/.test(knxVal)) {
                // numeric string timestamp → number so knxultimate can use it
                knxVal = Number(knxVal);
            }
            // all other formats (Date objects, ISO strings, time strings like "Sat, 10:27:00")
            // are passed through to knxultimate — the populateAPDU null check catches failures
        } else if (gaData.common?.type == "boolean") {
            knxVal = !!knxVal;
        } else if (gaData.common?.type == "number" || gaData.common?.type == "enum") {
            if (isNaN(Number(knxVal))) {
                this.log.warn(
                    `Value "${knxVal}" (${typeof knxVal}) for ${id} is not a number, DPT ${dpt} expects numeric input`,
                );
            }
            // else take plain value
        } else if (gaData.native.valuetype == "composite" || /^DPT([23]|18)\b/.test(dpt)) {
            // composite DPTs: knxultimate expects objects, but accept numeric values too for broad compatibility
            if (typeof knxVal === "number") {
                if (/^DPT2\b/.test(dpt)) {
                    // @ts-expect-error knxVal becomes object for knxultimate
                    knxVal = { priority: !!(knxVal & 2), data: !!(knxVal & 1) };
                } else if (/^DPT3\b/.test(dpt)) {
                    // @ts-expect-error knxVal becomes object for knxultimate
                    knxVal = { decr_incr: (knxVal >> 3) & 1, data: knxVal & 7 };
                } else if (/^DPT18\b/.test(dpt)) {
                    // @ts-expect-error knxVal becomes object for knxultimate
                    knxVal = { save_recall: (knxVal >> 7) & 1, scenenumber: (knxVal & 0x3f) + 1 };
                }
            } else if (typeof knxVal !== "object") {
                try {
                    // @ts-expect-error knxVal is a string
                    knxVal = JSON.parse(knxVal);
                } catch {
                    this.log.warn(`Cannot parse composite value "${knxVal}" as JSON for GA ${ga} (DPT ${dpt})`);
                    return "unsupported value";
                }
            }
        } else if (tools.isStringDPT(dpt)) {
            // take plain value
        } else if (tools.isUnknownDPT(dpt)) {
            // write raw buffers for unknown dpts, iterface is a hex value
            // bitlength is the buffers bytelength * 8.
            if (typeof knxVal != "string") {
                this.log.warn(`Expected hex string for unknown DPT ${dpt} on GA ${ga}, got ${typeof knxVal}`);
                return "unsupported datatype";
            }
            rawVal = Buffer.from(knxVal, "hex");
            isRaw = true;
            this.log.info(`Unhandled DPT ${dpt}, assuming raw value`);
        } else {
            // unhandled common.type (e.g. "mixed", "object") — pass through to knxultimate
            this.log.debug(
                `${id}: common.type "${gaData.common?.type}" not explicitly handled for DPT ${dpt}, passing value through`,
            );
        }

        if (state.c == "GroupValue_Read" || state.q == 0x10) {
            // interface to trigger GrouValue_Read is this object comment or StateQuality 16
            this.log.debug(`Outbound GroupValue_Read to GA ${ga}`);
            try {
                this.knxConnection.read(ga);
            } catch (e) {
                this.log.warn(`GroupValue_Read failed for ${ga}: ${e.message}`);
            }
            // ack is generated with GroupValue_Response via indication event
            return "read";
        } else if (gaData.common.write) {
            this.log.debug(
                `Outbound GroupValue_Write to " ${ga} value: ${isRaw ? rawVal : JSON.stringify(knxVal)} from ${id}`,
            );
            try {
                if (isRaw) {
                    // KNXUltimate requires bitlength as 3rd parameter
                    const bitlength = rawVal.byteLength * 8;
                    this.knxConnection.writeRaw(ga, rawVal, bitlength);
                    return "write raw";
                }
                // check if knxultimate can encode the value before sending
                const apdu = {};
                // @ts-expect-error populateAPDU fills the empty object
                dptlib.populateAPDU(knxVal, apdu, dpt);
                if (!apdu.data) {
                    this.log.warn(`Value ${JSON.stringify(knxVal)} could not be encoded for DPT ${dpt} on ${ga}`);
                }
                this.knxConnection.write(ga, knxVal, dpt);

                // KNX Compat Mode: After write, sync value from linked status GA
                if (this.config.knxCompatMode) {
                    if (gaData.native?.statusGA) {
                        const statusState = this.isForeign
                            ? await this.getForeignStateAsync(gaData.native.statusGA)
                            : await this.getStateAsync(gaData.native.statusGA);
                        if (statusState) {
                            if (this.isForeign) {
                                await this.setForeignStateAsync(id, statusState.val, true);
                            } else {
                                await this.setStateAsync(id, statusState.val, true);
                            }
                        }
                    }
                }

                return "write";
            } catch (e) {
                this.log.error(`Failed to write to ${ga}: ${e.message}`);
                return "write error";
            }
        }
        this.log.warn(`GA ${ga} (${id}) is not writable. Set common.write=true or reimport ETS project.`);
        return "configuration error";
    }

    /**
     * Direct Link: Handle object changes for dynamic linkedState subscription management.
     * Called when GA objects are modified (e.g., linkedState added/removed via admin UI).
     *
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    async onObjectChange(id, obj) {
        this.log.debug(`onObjectChange: ${id}`);
        const oldData = this.gaList.getDataById(id);
        if (!oldData) {
            this.log.debug(`onObjectChange: ${id} not in gaList, ignoring`);
            return; // not a known GA object
        }

        const oldLinked = oldData.native?.linkedState;
        const newLinked = obj?.native?.linkedState;

        if (oldLinked === newLinked) {
            return;
        }

        // Remove old subscription
        if (oldLinked) {
            await this.unsubscribeForeignStatesAsync(oldLinked);
            delete this.linkedStateMap[oldLinked];
            this.log.info(`Direct Link removed: ${id} ↔ ${oldLinked}`);
        }

        // Add new subscription
        if (newLinked) {
            await this.subscribeForeignStatesAsync(newLinked);
            this.linkedStateMap[newLinked] = id;
            this.log.info(`Direct Link added: ${id} ↔ ${newLinked}`);
        }

        // Update gaList with new object data
        if (obj) {
            this.gaList.set(id, obj.native.address, obj);
        }
    }

    /**
     * Direct Link: Sync linked foreign state values to KNX bus after connection established.
     */
    async syncLinkedStates() {
        if (!this.knxConnection) {
            return;
        }
        for (const [foreignId, knxId] of Object.entries(this.linkedStateMap)) {
            try {
                const foreignState = await this.getForeignStateAsync(foreignId);
                if (foreignState?.val != null) {
                    const gaData = this.gaList.getDataById(knxId);
                    if (gaData?.native?.address && gaData?.native?.dpt) {
                        this.knxConnection.write(gaData.native.address, foreignState.val, gaData.native.dpt);
                        this.log.debug(`Direct Link sync: ${foreignId}=${foreignState.val} → ${gaData.native.address}`);
                    }
                }
            } catch (e) {
                this.log.warn(`Direct Link sync failed for ${foreignId}: ${e.message}`);
            }
        }
    }

    startKnxStack() {
        // Clean up previous connection (reconnect case)
        if (this.knxConnection) {
            this.knxConnection.removeAllListeners();
            this.knxConnection.Disconnect().catch(() => {
                // ignore - old connection may already be in broken state
            });
            this.knxConnection = undefined;
        }

        // Determine protocol - KNX Secure requires TunnelTCP or Multicast
        let hostProtocol = this.config.hostProtocol || "TunnelUDP";
        if (this.config.isSecureKNXEnabled && hostProtocol === "TunnelUDP") {
            this.log.warn("KNX Secure requires TunnelTCP or Multicast. Switching from TunnelUDP to TunnelTCP.");
            hostProtocol = "TunnelTCP";
        }

        // Multicast requires specific IP address and physAddr
        let ipAddr = this.config.gwip;
        if (hostProtocol === "Multicast") {
            ipAddr = "224.0.23.12"; // KNX multicast address
            if (!this.config.eibadr || this.config.eibadr === "0.0.0") {
                this.log.warn(
                    "Multicast mode requires a valid physical KNX address (physAddr). Please configure eibadr.",
                );
            }
        }

        // Build KNXUltimate client options
        const knxOptions = {
            hostProtocol,
            ipAddr,
            ipPort: this.config.gwipport,
            physAddr: this.config.eibadr || "0.0.0",
            localIPAddress: this.config.localInterface,
            KNXQueueSendIntervalMilliseconds: this.config.minimumDelay || 25,
            // https://github.com/Supergiovane/node-red-contrib-knx-ultimate/issues/78
            suppress_ack_ldatareq: true,
            // Disable KNXUltimate internal logging - we use logStream handler instead
            // This prevents EPIPE errors during shutdown
            loglevel: this.log.level === "silly" ? "trace" : "info",
        };

        // KNX Secure options
        if (this.config.isSecureKNXEnabled) {
            knxOptions.isSecureKNXEnabled = true;

            // Build secureTunnelConfig
            const secureTunnelConfig = {};

            // Keyring-based authentication
            if (this.config.knxKeysContent) {
                secureTunnelConfig.knxkeys_buffer = Buffer.from(this.config.knxKeysContent, "utf8");
            }
            if (this.config.knxKeysPassword) {
                secureTunnelConfig.knxkeys_password = this.config.knxKeysPassword;
            }

            // Optional tunnel interface address (auto-select if empty)
            if (this.config.tunnelInterfaceAddress) {
                secureTunnelConfig.tunnelInterfaceIndividualAddress = this.config.tunnelInterfaceAddress;
            }

            // Alternative: manual tunnel password (without keyring)
            if (this.config.tunnelUserPassword) {
                secureTunnelConfig.tunnelUserPassword = this.config.tunnelUserPassword;
            }
            if (this.config.tunnelUserId) {
                secureTunnelConfig.tunnelUserId = parseInt(this.config.tunnelUserId, 10) || 2;
            }

            if (Object.keys(secureTunnelConfig).length > 0) {
                knxOptions.secureTunnelConfig = secureTunnelConfig;
            }

            this.log.info("KNX Secure enabled");
        }

        // Create KNXUltimate client
        this.knxConnection = new KNXClient(knxOptions);

        // Event: connected
        this.knxConnection.on(KNXClientEvents.connected, () => {
            const chId = this.knxConnection?.channelID;
            const pa = this.knxConnection?.physAddr ? this.knxConnection.physAddr.toString() : "";
            this.log.info(`Connected! channelID=${chId} physAddr=${pa}`);
            this.setState("info.messagecount", 0, true);

            // Phase 1: resolve DPT configs (synchronous, immediate)
            let cnt_withDPT = 0;
            const autoreadGAs = [];
            if (!this.autoreaddone) {
                this.log.info("Resolving DPT configs...");
                for (const key of this.gaList) {
                    try {
                        const data = this.gaList.getDataById(key);
                        let dptConfig = null;
                        try {
                            dptConfig = dptlib.resolve(data.native.dpt);
                        } catch {
                            // Unknown DPT - will use raw mode
                        }
                        this.gaList.setDpById(key, dptConfig);

                        if (data.native.autoread && this.config.autoreadEnabled) {
                            autoreadGAs.push(data.native.address);
                        }
                        cnt_withDPT++;
                    } catch (e) {
                        this.log.error(`Could not create DPT config for ${key}: ${e}`);
                    }
                }
                this.autoreaddone = true;
                this.countObjectsNotification(cnt_withDPT);

                // Phase 2: send autoread requests (asynchronous, non-blocking)
                if (autoreadGAs.length > 0) {
                    // use realistic per-telegram time so queue stays empty between reads
                    const autoreadInterval = Math.max(this.config.minimumDelay || 25, 200);
                    const estimatedSec = Math.ceil((autoreadGAs.length * autoreadInterval) / 1000);
                    const estimatedTime =
                        estimatedSec >= 60
                            ? `${Math.floor(estimatedSec / 60)}m${estimatedSec % 60 ? ` ${estimatedSec % 60}s` : ""}`
                            : `${estimatedSec}s`;
                    this.log.info(
                        `Autoread on startup: ${autoreadGAs.length} read requests, ${cnt_withDPT} DPT configs resolved, estimated ~${estimatedTime} (${autoreadInterval}ms interval). Write commands may be delayed during this period.`,
                    );
                    let i = 0;
                    this.autoreadTimer = setInterval(() => {
                        if (i >= autoreadGAs.length || !this.knxConnection) {
                            clearInterval(this.autoreadTimer);
                            this.autoreadTimer = null;
                            this.log.info(`Autoread on startup finished: ${i} of ${autoreadGAs.length} requests sent`);
                            return;
                        }
                        try {
                            this.knxConnection.read(autoreadGAs[i]);
                            this.log.debug(`Autoread GroupValueRead sent ${autoreadGAs[i]}`);
                        } catch (e) {
                            this.log.warn(`Autoread failed for ${autoreadGAs[i]}: ${e.message}`);
                        }
                        i++;
                    }, autoreadInterval);
                } else {
                    this.log.info(`DPT configs resolved: ${cnt_withDPT}, autoread disabled or no GAs marked`);
                }
            }
            this.connected = true;
            this.reconnectCount = 0;
            this.setState("info.connection", this.connected, true);

            // Direct Link: Sync linked foreign state values to KNX bus
            this.syncLinkedStates();
        });

        // Event: disconnected
        // Reconnect delays in seconds: 10, 30, 60, 120, 120, 120, 120
        const reconnectDelays = [10, 30, 60, 120, 120, 120, 120];
        this.knxConnection.on(KNXClientEvents.disconnected, reason => {
            if (this.connected) {
                this.log.error(`Connection lost: ${reason}`);
            }
            this.connected = false;
            this.setState("info.connection", this.connected, true);
            this.setState("info.busload", 0, true);

            if (!this.stopping && this.reconnectCount < reconnectDelays.length) {
                const delay = reconnectDelays[this.reconnectCount];
                this.reconnectCount++;
                this.log.info(`Reconnect attempt ${this.reconnectCount}/${reconnectDelays.length} in ${delay}s...`);
                this.reconnectTimer = setTimeout(() => {
                    try {
                        this.startKnxStack();
                    } catch (e) {
                        this.log.error(`Reconnect failed: ${e.message || e}`);
                    }
                }, delay * 1000);
            } else if (this.reconnectCount >= reconnectDelays.length) {
                this.log.error(`Giving up after ${reconnectDelays.length} reconnect attempts`);
            }
        });

        // Event: error
        this.knxConnection.on(KNXClientEvents.error, err => {
            this.log.warn(err.message || String(err));
        });

        // Event: ackReceived - only useful for ack:false (timeout), since ack:true packet has no GA info
        this.knxConnection.on(KNXClientEvents.ackReceived, (packet, ack) => {
            if (ack) {
                return; // Success case handled via echoed indication
            }
            const dest = packet.cEMIMessage?.dstAddress?.toString();
            if (!dest) {
                return;
            }
            for (const id of this.gaList.getIdsByGa(dest)) {
                this.log.info(`No ACK received for ${dest} ${id}. Possibly no receiver or missing ETS configuration.`);
            }
        });

        // Event: indication (replaces 'event' handler)
        this.knxConnection.on(KNXClientEvents.indication, (packet, echoed) => {
            if (!this.autoreaddone && !echoed) {
                this.log.info(`received data although connection process not completed - skipped`);
                return;
            }

            loadMeasurement.logBusEvent();

            const cemi = packet.cEMIMessage;
            const src = cemi.srcAddress.toString();
            const dest = cemi.dstAddress.toString();
            const npdu = cemi.npdu;
            const rawData = npdu.dataValue;

            // Determine event type
            let evt;
            if (npdu.isGroupWrite) {
                evt = "GroupValue_Write";
            } else if (npdu.isGroupResponse) {
                evt = "GroupValue_Response";
            } else if (npdu.isGroupRead) {
                evt = "GroupValue_Read";
            } else {
                return;
            }

            // Some checks
            if (dest === "0/0/0" || tools.isDeviceAddress(dest)) {
                return;
            }
            if (!this.config.noWarnUnknownGa && !this.gaList.getIdsByGa(dest).length) {
                const hex = rawData ? Buffer.from(rawData).toString("hex") : "";
                this.log.warn(
                    `Ignoring ${evt} from ${src} for GA ${dest} (not in ETS project). data=[${hex}]. Reimport ETS project to add this GA, or enable 'suppress unknown GA warnings'.`,
                );
                return;
            }

            for (const id of this.gaList.getIdsByGa(dest)) {
                const data = this.gaList.getDataById(id);
                const dptConfig = this.gaList.getDpById(id);

                if (id === undefined || data === undefined) {
                    this.log.error(`Invalid data for GA ${dest} id ${id} data ${data}`);
                    continue;
                }

                // Decode value manually (no Datapoint class)
                // We do this for both incoming telegrams AND our own echoed messages.
                let convertedVal;
                if (rawData && dptConfig && (evt === "GroupValue_Write" || evt === "GroupValue_Response")) {
                    try {
                        const jsValue = dptlib.fromBuffer(rawData, dptConfig);
                        if (jsValue == null) {
                            this.log.warn(
                                `Could not decode GA ${dest} (${data.native.dpt}), raw=[${rawData.toString("hex")}]. Check DPT configuration in ETS (buffer length mismatch?).`,
                            );
                            convertedVal = rawData.toString("hex");
                        } else if (typeof jsValue === "bigint") {
                            convertedVal = jsValue.toString();
                        } else if (tools.isStringDPT(data.native.dpt)) {
                            convertedVal = jsValue;
                        } else {
                            convertedVal = this.convertType(jsValue);
                        }
                    } catch (e) {
                        this.log.warn(`Decode error for GA ${dest} (${data.native.dpt}): ${e.message}`);
                        convertedVal = rawData.toString("hex");
                    }
                }

                switch (evt) {
                    case "GroupValue_Read": {
                        // If we echoed a GroupValue_Read to the bus, we do not want to respond to ourselves.
                        if (echoed) {
                            break;
                        }

                        // Direct Link: Respond with linked foreign state value
                        if (data.native.linkedState) {
                            this.getForeignState(data.native.linkedState, (fErr, fState) => {
                                if (!fErr && fState && fState.val != null) {
                                    try {
                                        this.knxConnection.respond(dest, fState.val, data.native.dpt);
                                        this.log.debug(`Direct Link: Read ${dest} → ${fState.val}`);
                                    } catch (e) {
                                        this.log.error(`Direct Link: respond ${dest}: ${e.message || e}`);
                                    }
                                }
                            });
                            break;
                        }

                        const readCb = (err, state) => {
                            if (state) {
                                this.log.debug(`Inbound GroupValue_Read from ${src} GA ${dest} to ${id}`);
                                if (this.gaList.getDataById(id).native.answer_groupValueResponse) {
                                    let stateval = state.val;
                                    try {
                                        stateval = JSON.parse(state.val);
                                    } catch {
                                        /* empty */
                                    }
                                    try {
                                        this.knxConnection.respond(
                                            dest,
                                            stateval,
                                            this.gaList.getDataById(id).native.dpt,
                                        );
                                        this.log.debug(`responding with value ${state.val}`);
                                    } catch (e) {
                                        this.log.error(`Failed to respond to ${dest}: ${e.message || e}`);
                                    }
                                }
                            }
                        };
                        if (this.isForeign) {
                            this.getForeignState(id, readCb);
                        } else {
                            this.getState(id, readCb);
                        }
                        break;
                    }

                    case "GroupValue_Response":
                    case "GroupValue_Write":
                        // Why we handle echoed = true here:
                        // When a user writes via ioBroker, we send the value to KNX. If successful, we receive it right
                        // back as an echoed indication. We use this echo to immediately set the ioBroker state to ack: true.
                        // We do this synchronously without calling getState() to save immense load on the database,
                        // as ioBroker internally optimizes redundant updates automatically.
                        if (this.isForeign) {
                            this.setForeignState(id, { val: convertedVal, ack: true });
                        } else {
                            this.setState(id, { val: convertedVal, ack: true });
                        }

                        // Direct Link: Forward KNX value to linked foreign state
                        if (!echoed && data.native.linkedState) {
                            this.setForeignState(data.native.linkedState, {
                                val: convertedVal,
                                ack: true,
                            });
                            this.log.debug(`Direct Link: ${dest} → ${data.native.linkedState}=${convertedVal}`);
                        }

                        // KNX Compat Mode: Also update linked act-GA when status-GA changes
                        if (this.config.knxCompatMode && data.native?.actGA) {
                            if (this.isForeign) {
                                this.setForeignState(data.native.actGA, { val: convertedVal, ack: true });
                            } else {
                                this.setState(data.native.actGA, { val: convertedVal, ack: true });
                            }
                        }

                        if (echoed) {
                            this.log.debug(
                                `Acknowledged own message for GA ${dest} to Object ${id} value: ${convertedVal} dpt: ${data.native.dpt}`,
                            );
                        } else {
                            this.log.debug(
                                `Inbound ${evt} from ${src} GA ${dest} to Object ${id} value: ${convertedVal} dpt: ${data.native.dpt}`,
                            );
                        }
                        break;

                    default:
                        this.log.debug(`received unhandled event ${evt} ${src} ${dest} ${convertedVal}`);
                }
            }
        });

        // Start connection
        try {
            this.knxConnection.Connect();
        } catch (e) {
            this.log.error(`Connect failed: ${e.message}`);
        }
    }

    countObjectsNotification(cnt_withDPT) {
        this.getObjectList(
            {
                startkey: this.mynamespace,
                endkey: `${this.mynamespace}\u9999`,
            },
            (e, result) => {
                if (result) {
                    this.log.info(
                        `Found ${cnt_withDPT} valid KNX objects of ${result.rows.length} objects in this adapter.`,
                    );
                }
            },
        );
    }

    /**
     * KNX Compat Mode: Create status links between act and status GAs
     * Uses the same regex/similarity settings as alias creation
     */
    async createStatusLinks() {
        this.log.info("KNX Compatibility Mode: Creating status links...");
        const regexPattern = this.config.aliasRegexp || "status|state";
        const minSimilarity = this.config.aliasSimilarity || 0.9;
        let count = 0;

        // Get all state IDs from gaList
        const allIds = [];
        for (const id of this.gaList) {
            allIds.push(id);
        }

        for (const statusId of allIds) {
            // Check if this is a status GA
            const statusRegex = new RegExp(regexPattern, "gi");
            if (!statusRegex.test(statusId)) {
                continue;
            } // Only process status GAs

            // Find best matching act-GA
            const statusBaseName = statusId.replace(new RegExp(regexPattern, "gi"), "");
            let bestMatch = null;
            let bestSimilarity = 0;

            for (const candidateId of allIds) {
                if (candidateId === statusId) {
                    continue;
                }
                // Skip if candidate is also a status GA
                const candidateRegex = new RegExp(regexPattern, "gi");
                if (candidateRegex.test(candidateId)) {
                    continue;
                }

                // Compare similarity
                const candidateBase = candidateId.toLowerCase().replace(/_/g, "");
                const statusBase = statusBaseName.toLowerCase().replace(/_/g, "");
                const sim = similarity(candidateBase, statusBase);

                if (sim > bestSimilarity && sim >= minSimilarity) {
                    bestSimilarity = sim;
                    bestMatch = candidateId;
                }
            }

            if (bestMatch) {
                // Store link in native of both objects
                const statusObj = this.gaList.getDataById(statusId);
                const actObj = this.gaList.getDataById(bestMatch);

                if (statusObj && actObj) {
                    // Update status object: read-only, receives values from bus
                    statusObj.native.actGA = bestMatch;
                    statusObj.common.read = true;
                    statusObj.common.write = false;
                    if (this.isForeign) {
                        await this.extendForeignObjectAsync(statusId, {
                            native: { actGA: bestMatch },
                            common: { read: true, write: false },
                        });
                    } else {
                        await this.extendObjectAsync(statusId, {
                            native: { actGA: bestMatch },
                            common: { read: true, write: false },
                        });
                    }

                    // Update act object: write-only, reads come from status GA
                    actObj.native.statusGA = statusId;
                    actObj.common.read = false;
                    actObj.common.write = true;
                    if (this.isForeign) {
                        await this.extendForeignObjectAsync(bestMatch, {
                            native: { statusGA: statusId },
                            common: { read: false, write: true },
                        });
                    } else {
                        await this.extendObjectAsync(bestMatch, {
                            native: { statusGA: statusId },
                            common: { read: false, write: true },
                        });
                    }

                    count++;
                    this.log.debug(`KNX Compat: Linked ${bestMatch} <-> ${statusId}`);
                }
            }
        }
        this.log.info(`KNX Compatibility Mode: Created ${count} status links`);
    }

    main(startKnxConnection) {
        if (!this.config.gwip) {
            this.log.warn("Gateway IP is missing please enter Gateway IP in the instance settings.");
            startKnxConnection = false;
        } else {
            this.log.info(
                `Connecting to knx gateway: ${this.config.gwip}:${this.config.gwipport} device name: ${
                    this.config.deviceName
                } with physical adr: ${this.config.eibadr} minimum send delay: ${this.config.minimumDelay} ms` +
                    ` debug level: ${this.log.level}`,
            );
        }

        this.connected = false;
        this.setState("info.connection", this.connected, true);
        this.interval1 = setInterval(() => {
            const busload = loadMeasurement.cyclic();
            this.setState("info.busload", busload, true);
            this.setState("info.messagecount", loadMeasurement.gettelegramCount(), true);
        }, loadMeasurement.intervalTime);

        // fill gaList from iobroker objects
        this.getObjectView(
            "system",
            "state",
            {
                startkey: `${this.mynamespace}.`,
                endkey: `${this.mynamespace}.\u9999`,
                include_docs: true,
            },
            async (err, res) => {
                if (err) {
                    this.log.error(`Cannot get objects: ${err}`);
                } else if (res) {
                    for (let i = res.rows.length - 1; i >= 0; i--) {
                        const id = res.rows[i].id;
                        const value = res.rows[i].value;
                        if (
                            value &&
                            value.native &&
                            value.native.address != undefined &&
                            value.native.address.match(/\d*\/\d*\/\d*/) &&
                            value.native.dpt
                        ) {
                            // fix unresolvable subtypes from older imports (e.g. DPT5.000)
                            value.native.dpt = tools.resolveDpt(value.native.dpt).dpt;
                            // add only elements from tree that are knx objects, identified by a group adress
                            this.gaList.set(id, value.native.address, res.rows[i].value);
                            if (this.gaList.getIdsByGa(value.native.address).length > 1) {
                                const ids = this.gaList.getIdsByGa(value.native.address);
                                this.log.warn(
                                    `GA ${value.native.address} is used by multiple objects: ${ids.join(", ")}. Delete duplicates to avoid conflicts.`,
                                );
                            }
                        } else if (!id.startsWith(`${this.mynamespace}.info.`)) {
                            const missing = [];
                            if (!value?.native?.address) {
                                missing.push("native.address");
                            }
                            if (!value?.native?.dpt) {
                                missing.push("native.dpt");
                            }
                            this.log.warn(
                                `Skipping ${id}: missing ${missing.join(" and ") || "valid GA format"}. Delete or reconfigure this object.`,
                            );
                        }
                    }

                    // KNX Compat Mode: Create status links if enabled
                    if (this.config.knxCompatMode) {
                        this.createStatusLinks().catch(e => {
                            this.log.error(`Error creating status links: ${e}`);
                        });
                    }

                    // Direct Link: Subscribe to linked foreign states
                    for (const key of this.gaList) {
                        const data = this.gaList.getDataById(key);
                        if (data.native.linkedState) {
                            try {
                                await this.subscribeForeignStatesAsync(data.native.linkedState);
                                this.linkedStateMap[data.native.linkedState] = key;
                            } catch {
                                this.log.warn(`Direct Link: ${data.native.linkedState} does not exist`);
                            }
                        }
                    }
                    if (Object.keys(this.linkedStateMap).length) {
                        this.log.info(
                            `Direct Link: ${Object.keys(this.linkedStateMap).length} linked states subscribed`,
                        );
                    }

                    if (startKnxConnection) {
                        try {
                            this.startKnxStack();
                        } catch (e) {
                            if (e.toString().indexOf("not found or has no useful IPv4 address!") !== -1) {
                                // ipaddr: the address has neither IPv6 nor IPv4 format ??
                                // only handle certain exceptions
                                this.log.error(`Cannot start KNX Stack ${e}`);
                            } else {
                                throw e;
                            }
                        }
                    }
                }
            },
        );
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode (loaded as module by ioBroker)
    /**
     * @param {Partial<utils.AdapterOptions>} [options]
     */
    module.exports = options => new openknx(options);
} else {
    // Started directly from command line
    new openknx();
}
