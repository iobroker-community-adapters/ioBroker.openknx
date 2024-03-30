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
const knx = require(__dirname + "/lib/knx");
const loadMeasurement = require("./lib/loadMeasurement");
const projectImport = require("./lib/projectImport");
const tools = require("./lib/tools.js");
const DoubleKeyedMap = require("./lib/doubleKeyedMap.js");
const detect = require("./lib/openknx.js");
const os = require("os");
const exitHook = require("async-exit-hook");

class openknx extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
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
        this.on("unload", this.onUnload.bind(this));

        this.mynamespace = this.namespace;
        this.knxConnection;
        this.knx = knx;
        this.connected = false;

        this.timeout1;
        this.timeout2;
        this.interval1;

        // redirect log from knx.js that contain [..] to adapter log
        console.log = (args) => {
            if (args && typeof args === "string") {
                // handling special messages of the KNX lib
                if (args.indexOf("deferring outbound_TUNNELING_REQUEST") !== -1) {
                    return;
                } else if (args.indexOf("empty internal fsm queue due to inbound_DISCONNECT_REQUEST") !== -1) {
                    // this.log.warn("possible data loss due to gateway reset, consider increasing minimum send delay between two frames");
                }

                if (args.indexOf("[trace]") !== -1) this.log.silly(args);
                else if (args.indexOf("[debug]") !== -1) this.log.debug(args);
                else if (args.indexOf("[info]") !== -1) this.log.info(args);
                else if (args.indexOf("[warn]") !== -1) this.log.warn(args);
                else if (args.indexOf("[error]") !== -1) {
                    this.log.error(args);
                    if (args.indexOf("Conversion error DPT") == -1) {
                        // do not report errors from bad bus data
                        if (this.getSentry()) {
                            this.getSentry().withScope((scope) => {
                                scope.setLevel("error");
                                scope.setExtra("error message", args);
                                this.getSentry().captureMessage("knx library error event", "error");
                            });
                        }
                    }
                } else {
                    // dont forward all other internal console.logs
                    // this.log.info(args);
                }
            }
        };
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // adapter initialization

        this.getSentry()?.Sentry?.init({
            // "development" or "production"
            // environment: "production",
        });

        //after installation
        if (tools.isEmptyObject(this.config)) {
            this.log.warn("Adapter configuration missing, please do configuration first.");
            return;
        }

        // In order to get state updates, you need to subscribe to them.
        this.subscribeStates("*");
        this.setState("info.busload", 0, true);

        this.main(true);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            clearTimeout(this.timeout1);
            clearTimeout(this.timeout2);
            clearInterval(this.interval1);

            this.connected = false;
            if (this.knxConnection) {
                exitHook((cb) => {
                    this.knxConnection.Disconnect(() => {
                        callback();
                    });
                });
            } else callback();
        } catch (e) {
            callback();
        }
    }

    // New message arrived. obj is array with current messages
    // triggered from admin page read in knx project
    onMessage(obj) {
        if (typeof obj === "object") {
            switch (obj.command) {
                case "import":
                    this.log.info("ETS project import...");
                    projectImport.parseInput(this, obj.message.xml, (parseError, res) => {
                        this.updateObjects(res, 0, obj.message.onlyAddNewObjects, (updateError, length) => {
                            const msg = {
                                error:
                                    parseError && parseError.length == 0
                                        ? updateError
                                        : (parseError ? parseError : "") + "<br/>" + updateError,
                                count: length,
                            };

                            this.removeUnusedObjects(res, obj.message.removeUnusedObjects);

                            this.log.info("Project import finished with " + length + " GAs");
                            if (obj.callback) {
                                this.sendTo(obj.from, obj.command, msg, obj.callback);
                            }
                        });
                    });
                    break;
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
                    detect.detect(
                        obj.message.ip,
                        0,
                        null,
                        (err, isFound, addr, port, knxAdr, deviceName, devicesFound) => {
                            if (obj.callback) {
                                const res = {
                                    error: null,
                                    ip: addr,
                                    port: port,
                                    knxAdr: knxAdr,
                                    deviceName: deviceName,
                                    devicesFound: devicesFound,
                                };
                                this.sendTo(obj.from, obj.command, res, obj.callback);
                            }
                        },
                    );
                    break;
                case "restart":
                    this.log.info("Restarting...");
                    this.restart();
                    // @ts-ignore
                    break;
                default:
                    this.log.warn("Unknown command: " + obj.command);
                    break;
            }
        }
        return true;
    }

    /*
     * remove knx elements that are not found in the current import file
     */
    async removeUnusedObjects(importObjects, removeUnusedObjects) {
        const objects = await this.getAdapterObjectsAsync();

        Object.entries(objects).map((object) => {
            console.log(object);

            if (
                object[1].native &&
                Object.keys(object[1].native).length === 0 &&
                Object.getPrototypeOf(object[1].native) === Object.prototype
            ) {
                // object is no knx element, skip
            } else {
                const found = importObjects.find((element) => this.mynamespace + "." + element._id === object[0]);
                if (!found) {
                    // knx element in object tree not found in import file
                    this.log.info(
                        `${removeUnusedObjects ? "deleting" : ""} 
                         existing element in object tree not found in import file: ${object[0]}`,
                    );
                    if (removeUnusedObjects) {
                        this.delObject(object[0], (err) => {
                            if (err) {
                                this.log.warn("could not delete object " + object[0]);
                            }
                        });
                    }
                }
            }
        });
    }

    // write found communication objects to adapter object tree
    updateObjects(objects, i, onlyAddNewObjects, callback) {
        if (i >= objects.length) {
            // end of recursion reached
            let err = this.warnDuplicates(objects);

            this.getObjectList(
                {
                    startkey: this.namespace,
                    endkey: this.namespace + "\u9999",
                },
                (e, result) => {
                    const gas = [];
                    const duplicates = [];
                    if (result)
                        result.rows.forEach((element) => {
                            if (
                                Object.prototype.hasOwnProperty.call(element.value, "native") &&
                                Object.prototype.hasOwnProperty.call(element.value, "address")
                            )
                                gas.push(element.value.native.address + " " + element.value.common.name);
                        });
                    const tempArray = [...gas].sort();
                    for (let i = 0; i < tempArray.length; i++) {
                        if (tempArray[i + 1] === tempArray[i]) {
                            duplicates.push(tempArray[i]);
                        }
                    }
                    const message =
                        "Objects imported where objects exist that have same KNX group address: " + duplicates;
                    if (duplicates.length) {
                        this.log.warn(message);
                        err ? (err = err + "<br/>" + message) : (err = message);
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
            this.setObjectNotExists(this.mynamespace + "." + objects[i]._id, objects[i], (err) => {
                if (err) {
                    this.log.warn("error store Object " + objects[i]._id + " " + (err ? " " + err : ""));
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
            this.setObject(this.mynamespace + "." + objects[i]._id, objects[i], (err) => {
                if (err) {
                    this.log.warn("error store Object " + objects[i]._id + (err ? " " + err : ""));
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

        const message = "New object with an already existing Group Address name has not been created: " + duplicates;
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
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state) {
        let isRaw = false;

        if (!id || !state /*obj deleted*/ || typeof state !== "object") {
            return "invalid input";
        }
        if (
            !this.gaList.getDataById(id) ||
            !this.gaList.getDataById(id).native ||
            !this.gaList.getDataById(id).native.address
        ) {
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

        const dpt = this.gaList.getDataById(id).native.dpt;
        const ga = this.gaList.getDataById(id).native.address;
        let knxVal = state.val;
        let rawVal;

        // plausibilize against configured datatype
        if (this.gaList.getDataById(id).common && this.gaList.getDataById(id).common.type == "boolean") {
            knxVal = knxVal ? true : false;
        } else if (
            this.gaList?.getDataById(id)?.common?.type == "number" ||
            this.gaList?.getDataById(id)?.common?.type == "enum"
        ) {
            if (isNaN(Number(knxVal))) {
                this.log.warn("Value " + knxVal + " for " + id + " is not a number");
            }
            // else take plain value
        } else if (tools.isDateDPT(dpt)) {
            // before composite check, date is possibly composite
            knxVal = new Date(knxVal);
        } else if (this.gaList.getDataById(id).native.valuetype == "composite") {
            // input from IOB is either object or string in object notation, type of this conversion is object needed by the knx lib
            if (typeof knxVal != "object") {
                try {
                    knxVal = JSON.parse(knxVal);
                } catch (e) {
                    this.log.warn("stateChange: unsupported value format " + knxVal + " for " + ga);
                    return "unsupported value";
                }
            }
        } else if (tools.isStringDPT(dpt)) {
            // take plain value
        } else if (tools.isUnknownDPT(dpt)) {
            // write raw buffers for unknown dpts, iterface is a hex value
            // bitlength is the buffers bytelength * 8.
            if (typeof knxVal != "string") {
                this.log.warn("unsupported datatype for raw value");
                return "unsupported datatype";
            }
            rawVal = Buffer.from(knxVal, "hex");
            isRaw = true;
            this.log.info("Unhandeled DPT " + dpt + ", assuming raw value");
        } else {
            let error;
            if (!this.gaList.getDataById(id).common || !this.gaList.getDataById(id).common.type)
                // configuration that is checked before does not exist, unplausible
                error = "bad or missing configuration for object with id: " + id;
            else {
                error =
                    "cannot interprete data, please check your configuration. " +
                    dpt +
                    " unplausible type: " +
                    this.gaList?.getDataById(id)?.common?.type;
                if (this.getSentry()) this.getSentry().captureException(error);
            }
            console.warn(error);
            this.log.warn(error);
        }

        // @ts-ignore
        if (state.c == "GroupValue_Read" || state.q == 0x10) {
            // interface to trigger GrouValue_Read is this object comment or StateQuality 16
            this.log.debug("Outbound GroupValue_Read to GA " + ga);
            this.knxConnection.read(ga, () => {
                // ack is generated with GroupValue_Response
            });
            return "read";
        } else if (this.gaList.getDataById(id).common.write) {
            this.log.debug(
                `Outbound GroupValue_Write to " ${ga} value: ${isRaw ? rawVal : JSON.stringify(knxVal)} from ${id}`,
            );
            if (isRaw) {
                this.knxConnection.writeRaw(ga, rawVal, (grpaddr, confirmed, timeout) => {
                    // l_data.con confirmation set by any receiver connected to the ga
                    if (confirmed) {
                        //set iob ack when value was sent successful on the bus
                        this.log.debug(`Inbound GroupValue_Write confirmation true received for ${grpaddr} ${id}`);
                        this.setState(id, {
                            ack: true,
                        });
                    } else if (timeout) this.log.info(`GroupValue_Write timeout for ${grpaddr} ${id}`);
                    else this.log.info(`Inbound GroupValue_Write confirmation false received for ${grpaddr} ${id}`);
                });
                return "write raw";
            } else {
                this.knxConnection.write(ga, knxVal, dpt, (grpaddr, confirmed, timeout) => {
                    // l_data.con confirmation set by any receiver connected to the ga
                    if (confirmed) {
                        //set iob ack when value was sent successful on the bus
                        this.log.debug(`Inbound GroupValue_Write confirmation true received for ${grpaddr} ${id}`);
                        this.setState(id, {
                            ack: true,
                        });
                    } else if (timeout) this.log.info(`GroupValue_Write timeout for ${grpaddr} ${id}`);
                    else this.log.info(`Inbound GroupValue_Write confirmation false received for ${grpaddr} ${id}`);
                });
                return "write";
            }
        } else {
            this.log.warn("not configured write to ga: " + state.val);
            return "configuration error";
        }
    }

    startKnxStack() {
        this.knxConnection = this.knx.Connection({
            ipAddr: this.config.gwip,
            ipPort: this.config.gwipport,
            physAddr: "0.0.0",
            interface: this.translateInterface(this.config.localInterface),
            minimumDelay: this.config.minimumDelay,
            // https://github.com/Supergiovane/node-red-contrib-knx-ultimate/issues/78, some receivers cannot handle a ack request, spec makes no difference
            suppress_ack_ldatareq: true,
            // map set the log level for messsages printed on the console. This can be 'error', 'warn', 'info' (default), 'debug', or 'trace'.
            // log is written to console, not in IoB log
            loglevel: this.log.level == "silly" ? "trace" : this.log.level,
            handlers: {
                connected: () => {
                    this.log.info("Connected!");
                    this.setState("info.messagecount", 0, true);

                    // create new knx datapoint and bind to connection
                    // in order to have autoread work
                    let cnt_withDPT = 0;
                    if (!this.autoreaddone) {
                        // do autoread on start of adapter and not every connection
                        for (const key of this.gaList) {
                            try {
                                const datapoint = new this.knx.Datapoint(
                                    {
                                        ga: this.gaList.getDataById(key).native.address,
                                        dpt: this.gaList.getDataById(key).native.dpt,
                                        // issue a GroupValue_Read request to try to get the initial state from the bus (if any)
                                        autoread:
                                            this.gaList.getDataById(key).native.autoread && this.config.autoreadEnabled,
                                    },
                                    this.knxConnection,
                                );
                                datapoint.on("error", (ga, dptid) => {
                                    this.log.warn(
                                        "Received data length for GA " + ga + " does not match configured " + dptid,
                                    );
                                });
                                this.gaList.setDpById(key, datapoint);
                                cnt_withDPT++;
                                this.log.debug(
                                    `Datapoint ${
                                        this.gaList.getDataById(key).native.autoread
                                            ? "autoread created and GroupValueRead sent"
                                            : "created"
                                    } ${this.gaList.getDataById(key).native.address} ${key}`,
                                );
                            } catch (e) {
                                this.log.error("Could not create KNX Datapoint for " + key + " with error: " + e);
                            }
                        }
                        this.autoreaddone = true;
                        this.countObjectsNotification(cnt_withDPT);
                    }
                    this.connected = true;
                    this.setState("info.connection", this.connected, true);
                },

                disconnected: () => {
                    if (this.connected) this.log.error("Connection lost");
                    this.connected = false;
                    this.setState("info.connection", this.connected, true);
                    this.setState("info.busload", 0, true);
                },

                error: (connstatus) => {
                    this.log.warn(connstatus);
                },

                // l_data.con, confirmation set by a receiver which has the sending flag
                confirmed: (dest, confirmed) => {
                    for (const id of this.gaList.getIdsByGa(dest)) {
                        if (confirmed) {
                            this.log.debug(`A receiver confirmed reception of our message for ${dest} ${id}`);
                        } else {
                            // otherwise keep unset
                            this.log.info(
                                `Got confirmation flag false for ${dest} ${id}. Possibly no receiver available or missing ETS receiver configuration.`,
                            );
                        }
                    }
                },

                // KNX Bus event received
                // src: KnxDeviceAddress, dest: KnxGroupAddress,
                // val: raw value not used, using dp interface instead
                // @ts-ignore
                event: (
                    /** @type {string} */ evt,
                    /** @type {string} */ src,
                    /** @type {string} */ dest,
                    /** @type {string} val ,*/
                ) => {
                    let convertedVal = [];
                    let ret = "unknown";

                    if (!this.autoreaddone) {
                        this.log.info(`received data although connection process not completed - skiped`);
                        return "illegal state";
                    }

                    loadMeasurement.logBusEvent();

                    /* some checks */
                    if (dest == "0/0/0" || tools.isDeviceAddress(dest)) {
                        // seems that knx lib does not guarantee dest group adresses
                        return "bad address";
                    }
                    if (!this.config.noWarnUnknownGa && !this.gaList.getIdsByGa(dest).length) {
                        this.log.warn(`Ignoring ${evt} of unknown GA ${dest}`);
                        return "unknown GA";
                    }

                    for (const id of this.gaList.getIdsByGa(dest)) {
                        const data = this.gaList.getDataById(id);
                        const dp = this.gaList.getDpById(id);

                        if (id == undefined || data == undefined || dp == undefined) {
                            // debug trap, should not be reached
                            throw new Error(`Invalid data for GA ${dest} id ${id} data ${data} dp ${dp}`);
                        }

                        if (tools.isStringDPT(data.native.dpt)) {
                            convertedVal = dp.current_value;
                        } else {
                            convertedVal = this.convertType(dp.current_value);
                        }

                        switch (evt) {
                            case "GroupValue_Read":
                                // fetch val from addressed object and write on bus if configured to answer
                                this.getState(id, (err, state) => {
                                    let ret;
                                    if (state) {
                                        this.log.debug(`Inbound GroupValue_Read from ${src} GA ${dest} to ${id}`);
                                        ret = "GroupValue_Read";
                                        if (this.gaList.getDataById(id).native.answer_groupValueResponse) {
                                            let stateval = state.val;
                                            try {
                                                // @ts-ignore
                                                stateval = JSON.parse(state.val);
                                            } catch (e) {
                                                /* empty */
                                            }
                                            this.knxConnection.respond(
                                                dest,
                                                stateval,
                                                this.gaList.getDataById(id).native.dpt,
                                            );
                                            this.log.debug("responding with value " + state.val);
                                            ret = "GroupValue_Read Respond";
                                        }
                                        return ret;
                                    }
                                });
                                break;

                            case "GroupValue_Response":
                                this.setState(id, {
                                    val: convertedVal,
                                    ack: true,
                                });
                                this.log.debug(
                                    `Inbound GroupValue_Response from ${src} GA ${dest} to Object ${id} value: ${convertedVal} dpt: ${data.native.dpt}`,
                                );
                                ret = "GroupValue_Response";
                                break;

                            case "GroupValue_Write":
                                this.setState(id, {
                                    val: convertedVal,
                                    ack: true,
                                });
                                this.log.debug(
                                    `Inbound GroupValue_Write from ${src} GA ${dest} to Object ${id} value: ${convertedVal} dpt: ${data.native.dpt}`,
                                );
                                ret = "GroupValue_Write";
                                break;

                            default:
                                this.log.debug(`received unhandeled event " ${evt} ${src} ${dest} ${convertedVal}`);
                                ret = "unhandeled";
                        }
                    }
                    return ret; // last processed
                },
            },
        });
    }

    /* for testing, forward msg from one to another test address
        better approach: send all test values via ets, send received value back from iobroker, compare in ets
    */
    interfaceTest(id, state) {
        const inpath = this.mynamespace + ".test.testin";
        const outpath = this.mynamespace + ".test.testout";
        if (id.startsWith(inpath)) {
            const out = outpath + id.replace(inpath, "");
            this.setState(out, {
                val: state.val,
                ack: false,
            });
        }
    }

    // admin dialog uses different name than knx lib, translate ip to interface name
    translateInterface(interfaceIp) {
        const interfaces = os.networkInterfaces();

        for (const [iface, addrs] of Object.entries(interfaces)) {
            if (addrs)
                for (const addr of addrs) {
                    if (addr.address == interfaceIp) {
                        return iface;
                    }
                }
        }
        return interfaceIp;
    }

    countObjectsNotification(cnt_withDPT) {
        this.getObjectList(
            {
                startkey: this.namespace,
                endkey: this.namespace + "\u9999",
            },
            (e, result) => {
                if (result)
                    this.log.info(
                        "Found " +
                            cnt_withDPT +
                            " valid KNX objects of " +
                            result.rows.length +
                            " objects in this adapter.",
                    );
            },
        );
    }

    main(startKnxConnection) {
        if (!this.config.gwip) {
            this.log.warn("Gateway IP is missing please enter Gateway IP in the instance settings.");
            startKnxConnection = false;
        } else
            this.log.info(
                "Connecting to knx gateway: " +
                    this.config.gwip +
                    ":" +
                    this.config.gwipport +
                    " device name: " +
                    this.config.deviceName +
                    " with physical adr: " +
                    this.config.eibadr +
                    " minimum send delay: " +
                    this.config.minimumDelay +
                    " ms" +
                    " debug level: " +
                    this.log.level,
            );

        const self = this;
        this.connected = false;
        this.setState("info.connection", this.connected, true);
        this.interval1 = setInterval(function () {
            const busload = loadMeasurement.cyclic();
            self.setState("info.busload", busload, true);
            self.setState("info.messagecount", loadMeasurement.gettelegramCount(), true);
        }, loadMeasurement.intervalTime);

        // fill gaList from iobroker objects
        this.getObjectView(
            "system",
            "state",
            {
                startkey: this.mynamespace + ".",
                endkey: this.mynamespace + ".\u9999",
                include_docs: true,
            },
            (err, res) => {
                if (err) {
                    this.log.error("Cannot get objects: " + err);
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
                            // add only elements from tree that are knx objects, identified by a group adress
                            this.gaList.set(id, value.native.address, res.rows[i].value);
                            if (this.gaList.getIdsByGa(value.native.address).length > 1)
                                this.log.warn(
                                    id +
                                        " has assigned a non exclusive group address: " +
                                        value.native.address +
                                        ". Consider to delete duplicate entries.",
                                );
                        } else if (!id.startsWith(this.mynamespace + ".info."))
                            this.log.warn(`Incomplete configuration in iob object ${id}`);
                    }
                    if (startKnxConnection)
                        try {
                            this.startKnxStack();
                        } catch (e) {
                            if (e.toString().indexOf("not found or has no useful IPv4 address!") !== -1)
                                // ipaddr: the address has neither IPv6 nor IPv4 format ??
                                // only handle certain exceptions
                                this.log.error(`Cannot start KNX Stack ${e}`);
                            else throw e;
                        }
                }
            },
        );
    }

    getSentry() {
        if (this.supportsFeature && this.supportsFeature("PLUGINS")) {
            const sentryInstance = this.getPluginInstance("sentry");
            if (sentryInstance) {
                return sentryInstance.getSentryObject();
            }
        }
    }
}

if (require.main !== module) {
    // this module was run directly from the command line as in node xxx.js

    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new openknx(options);
    //module.exports = new openknx();
} else {
    // this module was not run directly from the command line and probably loaded by something else

    // otherwise start the instance directly
    new openknx();
}
