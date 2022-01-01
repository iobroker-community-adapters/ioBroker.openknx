"use strict";

const DPTLib = require(__dirname + "/knx/src/dptlib"); //todo copy for the moment
const select = require("xpath");
const util = require("util");
const dom = require("xmldom").DOMParser;
const tools = require("./tools.js");
const similarity = require("similarity");

module.exports = {
    // get xml Files from index.html via adapter.on 'message' and put it into file Obj
    parseInput: function (adapter, xml, callback) {
        const fileObjectList = {};

        if (xml) {
            fileObjectList["ga.xml"] = new dom().parseFromString(xml);
            adapter.log.debug("Parse xml succsessful");
        }

        this.generateIoBObjects(adapter, fileObjectList, (error, result) => {
            callback(error, result);
        });
    },

    // generate the Groupaddress structure
    generateIoBObjects: function (adapter, fileObjectList, callback) {
        const groupAddresses = {};
        const iobrokerObjects = [];

        function processFile(adapter, err, objectList) {
            //from xml export
            const doc = objectList["ga.xml"];
            if (doc)
                select.select("//*[local-name(.)='GroupAddress' and string(@Address)]", doc).forEach(ga => {
                    const address = ga.getAttribute("Address");
                    groupAddresses[address] = ga;
                });

            //format and put each found group address into the object tree
            Object.entries(groupAddresses).forEach(([key, groupAddress]) => {
                const gaName = groupAddress.getAttribute("Name");
                let autoread = true;
                let dptObj = {};
                let fullPath = tools.formatGaForIob(gaName);
                let range = [];
                let role = "state";
                let type;

                //add name of Mittelgruppe and Hauptgruppe to fullPath if exist
                if (groupAddress.parentNode.nodeName === "GroupRange") {
                    fullPath = tools.formatGaForIob(groupAddress.parentNode.getAttribute("Name")) + "." + fullPath;
                    if (groupAddress.parentNode.parentNode.nodeName === "GroupRange") {
                        fullPath = tools.formatGaForIob(groupAddress.parentNode.parentNode.getAttribute("Name")) + "." + fullPath;
                    }
                }

                const dpt = tools.formatDpt(groupAddress.getAttribute("DatapointType") || groupAddress.getAttribute("DPTs")); //DPT or DPTs
                if (dpt == "") {
                    const text = `Not adding ${fullPath} because no DPT is assigned to ${groupAddress.getAttribute("Address")}. The GA is not connected to a KO in ETS`;
                    adapter.log.warn(text);
                    if (!err) err = text;
                    else err += "<br/>\n" + text;
                    return;
                }
                if (dpt.indexOf(".") === -1) {
                    const text = `${fullPath} ${groupAddress.getAttribute("Address")} has only set a base DPT in ETS. No additional information (e.g. unit) for this GA available.`;
                    adapter.log.info(text);
                    if (!err) err = text;
                    else err += "<br/>\n" + text;
                }
                try {
                    dptObj = DPTLib.resolve(dpt);
                } catch (e) {
                    //allowed state, unresolveable dpt means raw interface
                }

                // is there a scalar range? eg. DPT5.003 angle degrees (0=0, ff=360)
                if (!!dptObj && dptObj.subtype && dptObj.subtype.scalar_range) {
                    range = dptObj.subtype.scalar_range;
                } else if (!!dptObj && dptObj.scalar_range) {
                    range = dptObj.scalar_range;
                } else if (!!dptObj && dptObj.subtype && dptObj.subtype.range) {
                    // just a plain numeric value, only check if within bounds
                    range = dptObj.subtype.range;
                } else if (!!dptObj && dptObj.basetype && dptObj.basetype.range) {
                    // just a plain numeric value, only check if within bounds
                    range = dptObj.basetype.range;
                } else if (!!dptObj && !tools.isEmptyObject(dptObj)) {
                    //extracted from basetype
                    range = [0, Math.pow(2, dptObj.basetype.bitlength) - 1];
                } else {
                    //unknown dpt, range unknown
                }

                //correct range, set type and role based on dpt
                if (tools.isDateDPT(dpt)) {
                    // we convert knx date types in javascript Date with different size
                    range[0] = undefined;
                    range[1] = undefined;
                    type = "number";
                    role = "date";
                } else if (!!dptObj && !tools.isEmptyObject(dptObj) && dptObj.basetype && dptObj.basetype.valuetype == "composite") {
                    range[0] = undefined;
                    range[1] = undefined;
                    type = "object";
                } else if (!!dptObj && !tools.isEmptyObject(dptObj) && dptObj.basetype && dptObj.basetype.bitlength == 1) {
                    type = "boolean";
                    role = "switch";
                    range[0] = undefined;
                    range[1] = undefined;
                } else if (tools.isStringDPT(dpt)) {
                    range[0] = undefined;
                    range[1] = undefined;
                    type = "string";
                    role = "text";
                } else if (tools.isFloatDPT(dpt)) {
                    range[0] = undefined;
                    range[1] = undefined;
                    type = "number";
                } else if (tools.isUnknownDPT(dpt)) {
                    //raw interface
                    range[0] = undefined;
                    range[1] = undefined;
                    type = "string";
                } else {
                    type = "number";
                }

                //if dpt is for sure not a status, remove from autoread
                if (tools.isTriggerDPT(dpt)) {
                    autoread = false;
                }

                //https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md#objects
                const iobrokerObject = {
                    _id: fullPath,
                    type: "state",
                    common: {
                        desc: "Basetype: " +
                            (!dptObj || tools.isEmptyObject(dptObj) ?
                                "raw value" :
                                dptObj.basetype.desc +
                                (Object.prototype.hasOwnProperty.call(dptObj, "subtype") && Object.prototype.hasOwnProperty.call(dptObj, "desc") ? ", Subtype: " + dptObj.subtype.desc : "")),
                        min: range[0],
                        max: range[1],
                        name: gaName,
                        read: true,
                        role: role, //description: https://github.com/ioBroker/ioBroker/blob/master/doc/STATE_ROLES.md#state-roles
                        type: type, //possible values: number, string, boolean, array, object, mixed, file. It is important to note that array, object, mixed and file must be serialized using JSON.stringify().
                        unit: !!dptObj && dptObj.subtype && dptObj.subtype.unit ? dptObj.subtype.unit : undefined,
                        write: true,
                        states: undefined, //todo can be extracted from some dpts
                    },
                    native: {
                        address: convertToGa(groupAddress.getAttribute("Address")),
                        answer_groupValueResponse: false, //overwrite manually
                        autoread: autoread,
                        bitlength: !dptObj || tools.isEmptyObject(dptObj) ? undefined : dptObj.basetype.bitlength, //informative
                        dpt: dpt,
                        encoding:
                            !!dptObj && Object.prototype.hasOwnProperty.call(dptObj, "subtype") ?
                                Object.prototype.hasOwnProperty.call(dptObj, "enc") ?
                                    dptObj.subtype.enc :
                                    dptObj.basetype.enc : undefined, //informative
                        force_encoding:
                            !!dptObj && Object.prototype.hasOwnProperty.call(dptObj, "subtype") && Object.prototype.hasOwnProperty.call(dptObj, "subtype") && dptObj.subtype ?
                                dptObj.subtype.force_encoding : undefined, //DPT16
                        signedness:
                            !!dptObj && !tools.isEmptyObject(dptObj) ?
                                Object.prototype.hasOwnProperty.call(dptObj, "signedness") && dptObj.basetype ?
                                    dptObj.basetype.signedness :
                                    undefined : undefined, //signed or unsigned or empty
                        valuetype: !dptObj || tools.isEmptyObject(dptObj) ? undefined : dptObj.basetype.valuetype, //informative: composite or basic
                    },
                };

                iobrokerObjects.push(iobrokerObject);
            });

            if (typeof callback === "function") {
                callback(err, iobrokerObjects);
            }
        }

        // check if fileObjectList is typeof Object
        if (!Object.prototype.hasOwnProperty.call(fileObjectList, "push")) {
            processFile(adapter, null, fileObjectList);
        }
    },

    //find statusGAs based on regexp
    findStatusGAs(adapter, gaList, callback) {
        let count = 0;
        const regex = RegExp(adapter.config.statusRegex, "gi");
        for (const statusElement of gaList) {
            if (regex.test(statusElement)) {
                //for all status gas
                const reducedStatusElement = statusElement.replace((regex), "");
                const nonStatusElement = Array.from(gaList).reduce((previousValue, currentValue) => {
                    //compare with all others
                    if (!previousValue) {
                        return currentValue;
                    }
                    if (currentValue === statusElement) {
                        //found itself, skip
                        return previousValue;
                    }
                    if (regex.test(currentValue)) {
                        //found another status, skip
                        return previousValue;
                    }
                    //reduce the list to the best match
                    if (similarity(unify(currentValue,adapter), unify(reducedStatusElement,adapter)) > similarity(unify(previousValue,adapter), unify(reducedStatusElement, adapter))) {
                        return currentValue;
                    } else {
                        return previousValue;
                    }
                });
                const a = unify(reducedStatusElement, adapter);
                const b = unify(nonStatusElement, adapter);
                if (similarity(a, b) > adapter.config.regexSimil) {
                    //found a match that is not and status and good enough, generate alias object
                    createAlias(adapter, nonStatusElement, statusElement);
                    count++;
                    adapter.log.info("create aliases: found match " + nonStatusElement + " and " + statusElement);
                }
            }
        }
        callback(count);
    }
};

/* make strings comparable*/
function unify(element, adapter) {
    element = element.toLowerCase().replace(/_/g,"");
    if (!(adapter.config.aliasRange)) {
        //exclude group names from search if user sets
        const n = element.lastIndexOf(".");
        element = element.substring(n + 1);
    }
    return element;
}


//possibly convert 2byte value into ././. form
function convertToGa(adr) {
    //check if already in good format
    if (adr.includes("/")) return adr;
    //Bereiche: Hauptgruppe = 0..31, Mittelgruppe = 0..7, Untergruppe = 0..255
    return util.format("%d/%d/%d", (adr >> 11) & 0x1f, (adr >> 8) & 0x7, adr & 0xff);
}

function createAlias(adapter, idDst, idSrc) {
    adapter.getObject(idDst, null, (err, obj) => {
        if (obj != null) {
            const dstObj = obj;
            adapter.getObject(idSrc, null, (err, srcObj) => {
                if (srcObj != null) {
                    const aliasId = adapter.config.aliasPath + dstObj._id.replace(adapter.namespace, "");
                    const aliasObject = {
                        "_id": aliasId,
                        "type": "state",
                        "common": {
                            "name": dstObj.common.name,
                            "desc": dstObj.common.desc,
                            "role": dstObj.common.role,
                            "type": dstObj.common.type,
                            "read": dstObj.common.read,
                            "write": dstObj.common.write,
                            "unit": dstObj.common.unit,
                            "min": dstObj.common.min,
                            "max": dstObj.common.max,
                            "def": "",
                            "alias": {
                                "id": {
                                    "read": srcObj._id,
                                    "write": dstObj._id
                                }
                            }
                        },
                    };

                    adapter.setForeignObject(aliasId, aliasObject, (err, obj) => {});
                } else {
                    adapter.log.debug("createAlias: source object not found: " + idSrc);
                }
            });
        } else {
            adapter.log.debug("createAlias: destination object not found: " + idDst);
        }
    });
}