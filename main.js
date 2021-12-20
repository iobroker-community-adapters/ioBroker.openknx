"use strict";

/*
 * Created with @iobroker/create-adapter v2.0.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

const projectImport = require(__dirname + "/lib/projectImport");

const knx = require(__dirname + "/lib/knx"); //todo copy for the moment
const _ = require("underscore");
const tools = require("./lib/tools.js");

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
        this.disconnectConfirmed = false;
        /* knx stack starts connection process with disconnect msg*/
        this.disconnectConfirmed = false;
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));

        this.mynamespace = this.namespace;
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

        //todo nach neuinstallation checken, ga import muss sofort gehen xxx
        if (this.config.adapterpathEnabled && this.config.adapterpath !== "") {
            this.log.info("Adapter path: " + this.config.adapterpath);
            this.mynamespace = this.config.adapterpath;
        }

        // In order to get state updates, you need to subscribe to them.
        this.subscribeForeignStates(this.mynamespace + ".*");

        this.main();
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

            this.disconnectConfirmed = false;
            if (this.knxConnection) {
                this.knxConnection.Disconnect();
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
                        if (parseError) {
                            this.log.info("Project import error " + parseError);
                        }
                        this.updateObjects(res, 0, obj.message.onlyAddNewObjects, (updateError, length) => {
                            res = {
                                error: parseError || updateError,
                                count: length,
                            };
                            if (updateError) {
                                this.log.info("Project import error " + updateError);
                            }
                            this.log.info("Project import finished of " + length + " GAs");
                            if (obj.callback) {
                                this.sendTo(obj.from, obj.command, res, obj.callback);
                            }
                        });
                    });
                    break;
                case "reset":
                    this.log.info("Restarting...");
                    this.restart();
                default:
                    this.log.warn("Unknown command: " + obj.command);
                    break;
            }
        }
        return true;
    }

    //write found communication objects to adapter object tree
    updateObjects(objects, index, onlyAddNewObjects, callback) {
        if (index >= objects.length) {
            //end of recursion reached
            const err = this.warnDuplicates(objects);
            if (typeof callback === "function") {
                callback(err, objects.length);
            }
            return;
        }
        if (onlyAddNewObjects) {
            //if user setting Add only new Objects write only new objects
            //https://www.iobroker.net/docu/index-81.htm?page_id=5809&lang=en#extendObject
            this.extendForeignObject(this.mynamespace + "." + objects[index]._id, objects[index], (err, obj) => {
                //this.setForeignObjectNotExists(this.mynamespace + '.' + objects[index]._id, objects[index], (err, obj) => {
                if (err) {
                    this.log.warn("error store Object " + objects[index]._id + " " + (err ? " " + err : ""));
                }
                setTimeout(this.updateObjects.bind(this), 0, objects, index + 1, onlyAddNewObjects, callback);
            });
        } else {
            //setObjet to overwrite all existing settings, default
            this.setForeignObject(this.mynamespace + "." + objects[index]._id, objects[index], (err, obj) => {
                if (err) {
                    this.log.warn("error store Object " + objects[index]._id + (err ? " " + err : ""));
                }
                setTimeout(this.updateObjects.bind(this), 0, objects, index + 1, onlyAddNewObjects, callback);
            });
        }
    }

    /*
     * IOBroker Object tree cannot store 2 objects of same name, warn
     */
    warnDuplicates(objects) {
        let arr = [];
        let duplicates = [];
        let message;

        for (const object of objects) {
            arr.push(object._id);
        }
        const tempArray = [...arr].sort();
        for (let i = 0; i < tempArray.length; i++) {
            if (tempArray[i + 1] === tempArray[i]) {
                duplicates.push(tempArray[i]);
            }
        }

        message = "Object with identical Group Address name not created: " + duplicates;
        if (duplicates.length) {
            this.log.warn(message);
        }
        return duplicates.length ? message : null;
    }

    //obj to string and date to number for iobroker, convert to object for knx
    convertType(val) {
        let ret;
        //convert, state value for iobroker to set has to be one of type "string", "number", "boolean" and not type "object"
        if (val instanceof Date) {
            //convert Date to number
            ret = Number(new Date(val));
        } else if (Buffer.isBuffer(val)) {
            //before object check
            ret = val.toString("hex");
        } else if (typeof val === "object") {
            ret = JSON.stringify(val);
        } else if (typeof val === "string") {
            //use as is
        } else {
            //both can handle number and boolean
            ret = val;
        }
        return ret;
    }

    /**
     * Is called if a subscribed state changes
     * state.ack is coming in false if set by user (nodered, script...), here we set it.
     * https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state) {
        let isRaw = false;

        if (!id) {
            return;
        }
        if (!state /*obj deleted*/ || typeof state !== "object") {
            return;
        }
        //not a KNX object
        if (!this.gaList.getDataById(id) || !this.gaList.getDataById(id).native || !this.gaList.getDataById(id).native.address) {
            return;
        }
        if (!(await this.getStateAsync("info.connection"))) {
            this.log.warn("onStateChange: not connected to KNX bus");
            return;
        }

        if (state.c == "self") {
            //called by self, avoid loop
            //console.log('state change self id: ' + id);
            //enable this for system testing
            //this.interfaceTest(id, state);
            return;
        }

        const dpt = this.gaList.getDataById(id).native.dpt;
        const ga = this.gaList.getDataById(id).native.address;
        let knxVal;
        let rawVal;

        //convert val into object for certain dpts
        if (tools.isDateDPT(dpt)) {
            //before composite check, date is also composite
            knxVal = new Date(state.val);
        } else if (this.gaList.getDataById(id).native.valuetype == "composite") {
            try {
                knxVal = JSON.parse(state.val);
            } catch (e) {
                this.log.warn("stateChange: unsupported value format " + state.val + " for " + ga);
                return;
            }
        } else if (tools.isStringDPT(dpt)) {
            knxVal = state.val;
        } else if (tools.isUnknownDPT(dpt)) {
            //write raw buffers for unknown dpts, iterface is a hex value
            //bitlength is the buffers bytelength * 8.
            rawVal = Buffer.from(state.val, "hex");
            isRaw = true;
            this.log.warn("Missing implementation for unhandeled DPT " + dpt + ", assuming raw values");
        } else {
            knxVal = state.val;
        }

        if (state.c == "GroupValue_Read") {
            //interface to trigger GrouValue_Read is this comment
            this.log.debug("Outgoing GroupValue_Read to " + ga + " value " + knxVal);
            this.knxConnection.read(ga);
            if (!state.ack) {
                this.setForeignState(id, {
                    ack: true,
                    c: "self",
                });
            }
        } else if (this.gaList.getDataById(id).common.write) {
            this.log.debug("Outgoing GroupValue_Write to " + ga + " value " + (isRaw ? rawVal : knxVal) + " from " + id);
            if (isRaw) {
                this.knxConnection.writeRaw(ga, rawVal);
            } else {
                this.knxConnection.write(ga, knxVal, dpt);
            }
            if (!state.ack) {
                this.setForeignState(id, {
                    ack: true,
                    c: "self",
                });
            }
        } else {
            this.log.warn("not configured write to ga: " + state.val);
        }
    }

    startKnxStack() {
        this.knxConnection = knx.Connection({
            ipAddr: this.config.gwip,
            ipPort: this.config.gwipport,
            physAddr: this.config.eibadr,
            minimumDelay: this.config.frameInterval,
            //map set the log level for messsages printed on the console. This can be 'error', 'warn', 'info' (default), 'debug', or 'trace'.
            //log is written to console, not in IoB log
            loglevel: this.log.level == "silly" ? "trace" : this.log.level,
            //debug:
            handlers: {
                connected: () => {
                    this.disconnectConfirmed = false;
                    //create new knx datapoint and bind to connection
                    //in connected in order to have autoread work
                    let cnt_complete = 0;
                    let cnt_withDPT = 0;
                    if (!this.autoreaddone) {
                        //do autoread on start of adapter and not every connection
                        for (const key of this.gaList) {
                            if (this.gaList.getDataById(key).native.address.match(/\d*\/\d*\/\d*/) && this.gaList.getDataById(key).native.dpt) {
                                try {
                                    const dp = new knx.Datapoint(
                                        {
                                            ga: this.gaList.getDataById(key).native.address,
                                            dpt: this.gaList.getDataById(key).native.dpt,
                                            autoread: this.gaList.getDataById(key).native.autoread, // issue a GroupValue_Read request to try to get the initial state from the bus (if any)
                                        },
                                        this.knxConnection
                                    );
                                    this.gaList.setDpById(key, dp);
                                    cnt_withDPT++;
                                    this.log.debug(
                                        "Datapoint " +
                                            (this.gaList.getDataById(key).native.autoread ? "autoread " : "") +
                                            "created and GroupValueWrite sent: " +
                                            this.gaList.getDataById(key).native.address +
                                            " " +
                                            key
                                    );
                                } catch (e) {
                                    this.log.warn("could not create KNX Datapoint for " + key + " with error: " + e);
                                }
                            } else {
                                this.log.warn("no match for " + key);
                            }
                            cnt_complete++;
                        }
                        this.autoreaddone = true;
                        this.log.info("Found " + cnt_withDPT + " valid KNX datapoints of " + cnt_complete + " datapoints in adapter.");
                    }
                    this.setState("info.connection", true, true);
                    this.log.info("Connected!");
                },

                disconnected: () => {
                    this.setState("info.connection", false, true);
                    if (this.disconnectConfirmed) {
                        this.log.warn("Connection lost");
                    }
                    this.disconnectConfirmed = true;
                },

                //KNX Bus event received
                event: (/** @type {string} */ evt, /** @type {string} */ src, /** @type {string} */ dest, /** @type {string} */ val) => {
                    if (src == this.config.eibadr) {
                        //called by self, avoid loop
                        //console.log('receive self ga: ', dest);
                        return;
                    }

                    /* some checks */
                    if (!this.gaList.getDpByAddress(dest)) {
                        this.log.warn("Ignoring " + evt + " received on unknown GA: " + dest);
                        return;
                    }

                    const convertedVal = tools.isStringDPT(this.gaList.getDataByAddress(dest).native.dpt)
                        ? this.gaList.getDpByAddress(dest).current_value
                        : this.convertType(this.gaList.getDpByAddress(dest).current_value);

                    switch (evt) {
                        case "GroupValue_Read":
                            //fetch val from addressed object and write on bus if configured to answer
                            this.getForeignState(this.gaList.getIdByAddress(dest), (err, state) => {
                                if (state) {
                                    this.log.debug("Incoming GroupValue_Read from " + src + " to " + "(" + dest + ") " + this.gaList.getDataByAddress(dest).common.name);
                                    if (this.gaList.getDataByAddress(dest).native.answer_groupValueResponse) {
                                        //https://bitbucket.org/ekarak/knx.js/issues/83/send-groupvalue_response
                                        //workaround, send out a write instead response
                                        this.knxConnection.write(dest, state.val, this.gaList.getDataByAddress(dest).native.dpt);
                                        this.log.debug("responding with value " + state.val);
                                    }
                                }
                            });
                            break;

                        case "GroupValue_Response":
                            this.setForeignState(this.gaList.getIdByAddress(dest), {
                                val: convertedVal,
                                ack: true,
                                c: "self",
                            });
                            this.log.debug("Incoming GroupValue_Response from " + src + " to " + "(" + dest + ") " + this.gaList.getDataByAddress(dest).common.name + ": " + convertedVal);
                            break;

                        case "GroupValue_Write":
                            this.setForeignState(this.gaList.getIdByAddress(dest), {
                                val: convertedVal,
                                ack: true,
                                c: "self",
                            });
                            this.log.debug(
                                "Incoming GroupValue_Write ga: " +
                                    dest +
                                    "  val: " +
                                    convertedVal +
                                    " dpt: " +
                                    this.gaList.getDataByAddress(dest).native.dpt +
                                    " to Object: " +
                                    this.gaList.getIdByAddress(dest)
                            );
                            break;

                        default:
                            this.log.debug("received unhandeled event " + " " + evt + " " + src + " " + dest + " " + convertedVal);
                    }
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
            var out = outpath + id.replace(inpath, "");
            this.setForeignState(out, {
                val: state.val,
                ack: true,
            });
        }
    }

    main() {
        this.log.info("Connecting to knx gateway:  " + this.config.gwip + ":" + this.config.gwipport + "   with phy. Adr: " + this.config.eibadr + " minimum send delay: " + this.config.frameInterval);
        this.log.info(utils.controllerDir);
        this.setState("info.connection", false, true);

        //fill gaList object from iobroker objects
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
                        if (value && value.native.address != undefined) {
                            //add only elements from tree that are knx objects, identified by a group adress
                            this.gaList.set(id, value.native.address, res.rows[i].value);
                        }
                    }
                    this.startKnxStack();
                }
            }
        );
    }
}

class DoubleKeyedMap {
    constructor() {
        //id, ga
        this.keymap = new Map();
        //id,  iobroker object
        this.data = new Map();
        //id, knx dp
        this.dp = new Map();
    }
    //update or add
    set(id, address, data) {
        this.keymap.set(address, id);
        this.data.set(id, data);
    }
    //only dp returns transformed value, hold a reference to it
    setDpById(id, dp) {
        this.dp.set(id, dp);
    }
    getDpById(id) {
        return this.dp.get(id);
    }
    getDpByAddress(address) {
        return this.dp.get(this.keymap.get(address));
    }
    getDataById(id) {
        return this.data.get(id);
    }
    getDataByAddress(address) {
        return this.data.get(this.keymap.get(address));
    }
    getIdByAddress(address) {
        return this.keymap.get(address);
    }

    //key value is id
    [Symbol.iterator] = () => {
        return {
            index: -1,
            data: this.data,
            next() {
                return ++this.index < this.data.size
                    ? {
                          done: false,
                          value: Array.from(this.data.keys())[this.index],
                      }
                    : {
                          done: true,
                      };
            },
        };
    };
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new openknx(options);
} else {
    // otherwise start the instance directly
    new openknx();
}
