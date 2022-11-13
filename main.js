/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 */

"use strict";

/*
 * Created with @iobroker/create-adapter v2.0.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const projectImport = require(__dirname + "/lib/projectImport");
const knx = require(__dirname + "/lib/knx");
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
        this.sentryInstance = null;
        this.Sentry = null;
        this.knxConnection;
        this.knx = knx;

        //redirect log from knx.js to adapter log
        console.log = (args) => {
            if (args && typeof args === "string") {
                //handling special messages of the KNX lib
                if (args.indexOf("deferring outbound_TUNNELING_REQUEST") !== -1) {
                    return;
                } else if (args.indexOf("empty internal fsm queue due to inbound_DISCONNECT_REQUEST") !== -1) {
                    //this.log.warn("possible data loss due to gateway reset, consider increasing frame delay");
                }

                if (args.indexOf("[debug]") !== -1) {
                    this.log.silly(args);
                } else if (args.indexOf("[info]") !== -1) {
                    this.log.info(args);
                } else if (args.indexOf("[warn]") !== -1) {
                    this.log.warn(args);
                } else if (args.indexOf("[error]") !== -1) {
                    this.log.error(args);
                    if (this.sentryInstance) {
                        this.Sentry && this.Sentry.withScope(scope => {
                            scope.setLevel("error");
                            scope.setExtra("error message", args);
                            this.Sentry.captureMessage("knx library error event", "error");
                        });
                    }
                } else if (args.indexOf("[trace]") !== -1) {
                    this.log.silly(args);
                } else {
                    //dont forward all other internal console.logs
                    //this.log.info(args);
                }
            }
        };
    }

    /**
     * Is called when databasesf are connected and adapter received configuration.
     */
    async onReady() {
        // adapter initialization
        if (this.supportsFeature && this.supportsFeature("PLUGINS")) {
            const sentryInstance = this.getPluginInstance("sentry");
            if (sentryInstance) {
                const Sentry = sentryInstance.getSentryObject();
                if (Sentry) {
                    Sentry.init({
                        //environment: "development", //"production"
                        environment: "production"
                    });
                }
            }
        }

        //after installation
        if (tools.isEmptyObject(this.config)) {
            this.log.warn("Adapter configuration missing, please do configuration first.");
            return;
        }

        if (!this.config.gwip) {
            this.log.warn("Gateway IP is missing please enter Gateway IP in the instance settings.");
            return;
        }
        // In order to get state updates, you need to subscribe to them.
        this.subscribeStates("*");

        this.main(true);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
            this.startup = true;
            if (this.knxConnection) {
                exitHook(cb => {
                    this.knxConnection.Disconnect(() => {
                        cb();
                    });
                });

            }

            callback();
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
                    this.log.info("Project import...");
                    projectImport.parseInput(this, obj.message.xml, (parseError, res) => {
                        this.updateObjects(res, 0, obj.message.onlyAddNewObjects, (updateError, length) => {
                            let msg = {
                                error: (parseError && parseError.length == 0) ? updateError : (parseError ? parseError : "") + "<br/>" + updateError,
                                count: length,
                            };

                            if (obj.message.removeUnusedObjects)
                                this.removeUnusedObjects(res);

                            this.log.info("Project import finished of " + length + " GAs");
                            if (obj.callback) {
                                this.sendTo(obj.from, obj.command, msg, obj.callback);
                            }
                        });
                    });
                    break;
                case "createAlias":
                    this.log.info("Create aliases...");
                    projectImport.findStatusGAs(this, this.gaList, obj.message.aliassRegexp, obj.message.aliasSimilarity, obj.message.aliasPath, obj.message.aliasRange, (count, err) => {
                        if (obj.callback) {
                            const res = {
                                error: err,
                                count: count,
                            };
                            this.sendTo(obj.from, obj.command, res, obj.callback);
                        }
                    });
                    break;
                case "detectInterface":
                    this.log.info("Detect Interface...");
                    detect.detect(obj.message.ip, 0, null, (err, isFound, addr, port, knxAdr, deviceName, devicesFound) => {
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
                    });
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
    async removeUnusedObjects(importObjects) {
        let objects = await this.getAdapterObjectsAsync();

        Object.entries(objects).map(object => {
            console.log(object)

            if (object[1].native && Object.keys(object[1].native).length === 0 && Object.getPrototypeOf(object[1].native) === Object.prototype) {
                //object is no knx element, skip
            }
            else {
                let found = importObjects.find(element => this.mynamespace + '.' + element._id === object[0]);
                if (!found) {
                    //knx element in object tree not found in importer file
                    this.delObject(object[0], (err) => {
                        //this.log.info("delete object from tree not found in import " + object[0]);
                        if (err) {
                            this.log.warn("could not delete object " + object[0]);
                        }
                    });
                }
            }
        })
    }

    //write found communication objects to adapter object tree
    updateObjects(objects, i, onlyAddNewObjects, callback) {
        if (i >= objects.length) {
            //end of recursion reached
            let err = this.warnDuplicates(objects);

            this.getObjectList({
                startkey: this.namespace,
                endkey: this.namespace + "\u9999"
            }, (e, result) => {
                const gas = [];
                const duplicates = [];
                if (result)
                    result.rows.forEach(element => {
                        if (element.value.hasOwnProperty("native") && element.value.native.hasOwnProperty("address"))
                            gas.push(element.value.native.address + " " + element.value.common.name); //todo test
                    });
                const tempArray = [...gas].sort();
                for (let i = 0; i < tempArray.length; i++) {
                    if (tempArray[i + 1] === tempArray[i]) {
                        duplicates.push(tempArray[i]);
                    }
                }
                const message = "Objects imported where objects exist that have same KNX group address: " + duplicates;
                if (duplicates.length) {
                    this.log.warn(message);
                    err ? err = err + "<br/>" + message : err = message;
                }

                if (typeof callback === "function") {
                    callback(err, objects.length);
                }
            });
            return;
        }
        if (onlyAddNewObjects) {
            //if user setting Add only new Objects write only new objects
            //extend object would overwrite user made element changes if known in the import, not intended
            this.setObjectNotExists(this.mynamespace + "." + objects[i]._id, objects[i], (err, obj) => {
                if (err) {
                    this.log.warn("error store Object " + objects[i]._id + " " + (err ? " " + err : ""));
                }
                setTimeout(this.updateObjects.bind(this), 0, objects, i + 1, onlyAddNewObjects, callback);
            });
        } else {
            //setObjet to overwrite all existing settings, default
            this.setObject(this.mynamespace + "." + objects[i]._id, objects[i], (err, obj) => {
                if (err) {
                    this.log.warn("error store Object " + objects[i]._id + (err ? " " + err : ""));
                }
                setTimeout(this.updateObjects.bind(this), 0, objects, i + 1, onlyAddNewObjects, callback);
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

    //obj to string and date to number for iobroker from knx stack
    convertType(val) {
        let ret;
        //convert, state value for iobroker to set has to be one of type "string", "number", "boolean" and additionally type "object"
        if (val instanceof Date) {
            //convert Date to number
            ret = Number(new Date(val));
        } else if (Buffer.isBuffer(val)) {
            //before object check
            ret = val.toString("hex");
        } else if (typeof val === "object") {
            //https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md#states
            ret = JSON.stringify(val);
        } else {
            //keep string, boolean and number
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
        if (!this.gaList.getDataById(id) || !this.gaList.getDataById(id).native || !this.gaList.getDataById(id).native.address) {
            return "not a KNX object";
        }
        if (this.knxConnection == undefined) {
            return "KNX not started";
        }

        if (state.ack) {
            //only continue when application triggered a change without ack flag, filter out reception state changes

            //enable this for system testing
            //this.interfaceTest(id, state);
            return "ack is set";
        }
        if (!(await this.getStateAsync("info.connection"))) {
            this.log.warn("onStateChange: not connected to KNX bus");
            return "not connected to KNX bus";
        }

        const dpt = this.gaList.getDataById(id).native.dpt;
        const ga = this.gaList.getDataById(id).native.address;
        let knxVal = state.val;
        let rawVal;

        //plausibilize against configured datatype
        if (this.gaList.getDataById(id).common && this.gaList.getDataById(id).common.type == "boolean") {
            knxVal = knxVal ? true : false;
        } else if (this.gaList.getDataById(id).common && this.gaList.getDataById(id).common.type == "number") {
            if (isNaN(Number(knxVal))) {
                this.log.warn("Value " + knxVal + " for " + id + " is not a number");
            }
            // else take plain value
        }
        //convert val into object for certain dpts
        else if (tools.isDateDPT(dpt)) {
            //before composite check, date is possibly composite
            knxVal = new Date(knxVal);
        } else if (this.gaList.getDataById(id).native.valuetype == "composite") {
            //input from IOB is either object or string in object notation, type of this conversion is object needed by the knx lib
            if (typeof knxVal != "object") {
                try {
                    knxVal = JSON.parse(knxVal);
                } catch (e) {
                    this.log.warn("stateChange: unsupported value format " + knxVal + " for " + ga);
                    return "unsupported value";
                }
            }
        } else if (tools.isStringDPT(dpt)) {
            //take plain value
        } else if (tools.isUnknownDPT(dpt)) {
            //write raw buffers for unknown dpts, iterface is a hex value
            //bitlength is the buffers bytelength * 8.
            if (typeof (knxVal) != "string") {
                this.log.warn("unsupported datatype for raw value");
                return "unsupported datatype";
            }
            rawVal = Buffer.from(knxVal, "hex");
            isRaw = true;
            this.log.info("Unhandeled DPT " + dpt + ", assuming raw value");
        } else {
            const error = "trap - missing logic for undhandeled dpt: " + dpt;
            console.warn(error);
            if (this.sentryInstance) {
                this.sentryInstance.getSentryObject().captureException(error);
            }
        }

        // @ts-ignore
        if (state.c == "GroupValue_Read" || state.q == 0x10) {
            //interface to trigger GrouValue_Read is this comment or null
            this.log.debug("Outbound GroupValue_Read to " + ga);
            this.knxConnection.read(ga);
            if (this.sentryInstance) {
                this.Sentry && this.Sentry.withScope(scope => {
                    scope.setLevel("info");
                    scope.setExtra("GroupValue_Read", state.c + " " + state.q);
                    this.Sentry.captureMessage("GroupValue_Read", "info");
                });
            }
            return "read";
        } else if (this.gaList.getDataById(id).common.write) {
            this.log.debug("Outbound GroupValue_Write to " + ga + " val: " + (isRaw ? rawVal : JSON.stringify(knxVal)) + " from " + id);
            if (isRaw) {
                this.knxConnection.writeRaw(ga, rawVal, () => { });
                return "write raw";
            } else {
                this.knxConnection.write(ga, knxVal, dpt, () => { });
                return "write";
            }
        } else {
            this.log.warn("not configured write to ga: " + state.val);
            return "configuration error";
        }
    }

    startKnxStack() {
        this.startup = true;
        this.knxConnection = this.knx.Connection({
            ipAddr: this.config.gwip,
            ipPort: this.config.gwipport,
            physAddr: "0.0.0",
            interface: this.translateInterface(this.config.localInterface),
            minimumDelay: this.config.minimumDelay,
            //https://github.com/Supergiovane/node-red-contrib-knx-ultimate/issues/78, some receivers cannot handle a ack request, spec makes no difference
            suppress_ack_ldatareq: true,
            //map set the log level for messsages printed on the console. This can be 'error', 'warn', 'info' (default), 'debug', or 'trace'.
            //log is written to console, not in IoB log
            loglevel: this.log.level == "silly" ? "trace" : this.log.level,
            //debug:
            handlers: {
                connected: () => {
                    //create new knx datapoint and bind to connection
                    //in order to have autoread work
                    let cnt_withDPT = 0;
                    if (!this.autoreaddone) {
                        //do autoread on start of adapter and not every connection
                        for (const key of this.gaList) {
                            try {
                                const datapoint = new this.knx.Datapoint({
                                    ga: this.gaList.getDataById(key).native.address,
                                    dpt: this.gaList.getDataById(key).native.dpt,
                                    // issue a GroupValue_Read request to try to get the initial state from the bus (if any)
                                    autoread: this.gaList.getDataById(key).native.autoread && this.config.autoreadEnabled
                                },
                                    this.knxConnection
                                );
                                datapoint.on("error", (ga, dptid) => {
                                    this.log.warn("Received data length for GA " + ga + " does not match configured " + dptid);
                                });
                                this.gaList.setDpById(key, datapoint);
                                cnt_withDPT++;
                                this.log.debug(
                                    `Datapoint ${this.gaList.getDataById(key).native.autoread ? "autoread " : ""}created and GroupValueWrite sent: ${this.gaList.getDataById(key).native.address
                                    } ${key}`
                                );
                            } catch (e) {
                                this.log.error("could not create KNX Datapoint for " + key + " with error: " + e);
                            }
                        }
                        this.autoreaddone = true;
                        this.countObjectsNotification(cnt_withDPT);
                    }
                    this.setState("info.connection", true, true);
                    this.log.info("Connected!");
                },

                disconnected: () => {
                    this.setState("info.connection", false, true);
                    if (this.startup != true) {
                        //do not warn on initial startup or shutdown
                        this.log.warn("Connection lost");
                    }
                    this.startup = false;
                },
                error: (connstatus) => {
                    this.log.warn(connstatus);
                },

                //l_data.con, confirmation set bei receiver with set ga s flag
                confirmed: (dest, confirmed) => {
                    for (const id of this.gaList.getIdsByGa(dest)) {
                        if (confirmed) //if unconfirmed keep ack at false
                            this.setState(id, {
                                ack: true,
                            });
                        if (confirmed)
                            this.log.debug(`confirmation true received for ${dest}`);
                        else
                            this.log.info(`confirmation false received for ${dest} ${id}`);
                    }
                },

                //KNX Bus event received
                //src: KnxDeviceAddress, dest: KnxGroupAddress, val: raw value not used, using dp interface instead
                // @ts-ignore
                event: ( /** @type {string} */ evt, /** @type {string} */ src, /** @type {string} */ dest, /** @type {string} */ val) => {
                    let convertedVal = [];
                    let ret = "unknown";

                    /* some checks */
                    if (dest == "0/0/0" || tools.isDeviceAddress(dest)) {
                        //seems that knx lib does not guarantee dest group adresses
                        return "bad address";
                    }
                    if (!this.gaList.getIdsByGa(dest)) {
                        this.log.warn(`Ignoring ${evt} received unknown GA: ${dest}`);
                        return "unknown GA";
                    }

                    for (const id of this.gaList.getIdsByGa(dest)) {
                        const data = this.gaList.getDataById(id);
                        const dp = this.gaList.getDpById(id);

                        if (tools.isStringDPT(data.native.dpt)) {
                            convertedVal = dp.current_value;
                        } else {
                            convertedVal = this.convertType(dp.current_value);
                        }

                        switch (evt) {
                            case "GroupValue_Read":
                                //fetch val from addressed object and write on bus if configured to answer
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
                                            } catch (e) { }
                                            this.knxConnection.respond(dest, stateval, this.gaList.getDataById(id).native.dpt);
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
                                this.log.debug(`Inbound GroupValue_Response from ${src} GA ${dest} to Object: ${id} val: ${convertedVal} dpt: ${data.native.dpt}`);
                                ret = "GroupValue_Response";
                                break;

                            case "GroupValue_Write":
                                this.setState(id, {
                                    val: convertedVal,
                                    ack: true,
                                });
                                this.log.debug(
                                    `Inbound GroupValue_Write from ${src} GA ${dest} to Object: ${id} val: ${convertedVal} dpt: ${data.native.dpt}`
                                );
                                ret = "GroupValue_Write";
                                break;

                            default:
                                this.log.debug("received unhandeled event " + " " + evt + " " + src + " " + dest + " " + convertedVal);
                                ret = "unhandeled";
                        }
                    }
                    return ret; //last processed
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

    //admin dialog uses different name than knx lib, translate ip to interface name
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
        this.getObjectList({
            startkey: this.namespace,
            endkey: this.namespace + "\u9999"
        }, (e, result) => {
            if (result)
                this.log.info("Found " + cnt_withDPT + " valid KNX objects of " + result.rows.length + " objects in adapter.");
        });
    }

    main(startKnxConnection) {
        this.log.info("Connecting to knx gateway:  " + this.config.gwip + ":" + this.config.gwipport + " minimum send delay: " + this.config.minimumDelay + "ms debug level: " + this.log.level);
        this.log.info(utils.controllerDir);
        this.setState("info.connection", false, true);

        //fill gaList from iobroker objects
        this.getObjectView(
            "system",
            "state", {
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
                        if (value && value.native && value.native.address != undefined && value.native.address.match(/\d*\/\d*\/\d*/) && value.native.dpt) {
                            //add only elements from tree that are knx objects, identified by a group adress
                            this.gaList.set(id, value.native.address, res.rows[i].value);
                            if (this.gaList.getIdsByGa(value.native.address).length > 1)
                                this.log.info(id + " has assigned a non exclusive group address: " + value.native.address);
                        }
                    }
                    if (startKnxConnection)
                        try {
                            this.startKnxStack();
                        } catch (e) {
                            if (e.toString().indexOf("not found or has no useful IPv4 address!") !== -1)
                                //ipaddr: the address has neither IPv6 nor IPv4 format ??
                                //only handle certain exceptions
                                this.log.error(`Cannot start KNX Stack ${e}`);
                            else
                                throw e;
                        }
                }
            }
        );
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