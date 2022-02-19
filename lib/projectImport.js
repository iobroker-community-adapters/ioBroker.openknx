/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 */

"use strict";

const DPTLib = require(__dirname + "/knx/src/dptlib"); //todo copy for the moment
const select = require("xpath");
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
                    if (groupAddresses[address] != null) {
                        const text = `Skipping a Group Address with has the duplicate address ${address}. Please clean up the database.`;
                        adapter.log.warn(text);
                        if (!err) err = text;
                        else err += "<br/>\n" + text;
                        return;
                    } else {
                        groupAddresses[address] = ga;
                    }
                });

            //format and put each found group address into the object tree
            Object.entries(groupAddresses).forEach(([key, groupAddress]) => {
                const gaName = groupAddress.getAttribute("Name");
                let autoread = true;
                let dptObj = {};
                const fullPath = expandPath(groupAddress, tools.formatGaForIob(gaName));;
                let range = [];
                let role = "state";
                let type;

                const dpt = tools.formatDpt(groupAddress.getAttribute("DatapointType") || groupAddress.getAttribute("DPTs")); //DPT or DPTs
                if (dpt == "") {
                    const text = `Not adding ${fullPath} because no DPT is assigned to ${groupAddress.getAttribute("Address")}. The GA is not connected to a KO in ETS`;
                    adapter.log.warn(text);
                    if (!err) err = text;
                    else err += "<br/>\n" + text;
                    return;
                }
                if (dpt.indexOf(".") === -1) {
                    const text = `${fullPath} has only set base DPT ${dpt} in ETS. No additional information (e.g. unit) for this GA available.`;
                    adapter.log.info(text);
                    if (!err) err = text;
                    else err += "<br/>\n" + text;
                }
                try {
                    dptObj = DPTLib.resolve(dpt);
                } catch (e) {
                    //allowed state, unresolveable dpt means raw interface
                }

                ({
                    range,
                    type,
                    role
                } = identifyRangeRoleType(dptObj, range, dpt, type, role));

                //if dpt is for sure not a status, remove from autoread
                autoread = !tools.isTriggerDPT(dpt);

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
                        ...(range[0] != null && { min: range[0] }),
                        ...(range[1] != null && { max: range[1] }),
                        name: gaName,
                        read: true,
                        role: role, //description: https://github.com/ioBroker/ioBroker/blob/master/doc/STATE_ROLES.md#state-roles
                        type: type, //possible values: number, string, boolean, array, object, mixed, file. It is important to note that array, object, mixed and file must be serialized using JSON.stringify().
                        unit: !!dptObj && dptObj.subtype && dptObj.subtype.unit ? dptObj.subtype.unit : undefined,
                        write: true,
                        states: undefined, //todo can be extracted from some dpts
                    },
                    native: {
                        address: tools.convertToGa(groupAddress.getAttribute("Address")),
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

        //add name of Mittelgruppe and Hauptgruppe to fullPath if exist
        function expandPath(groupAddress, fullPath) {
            if (groupAddress.parentNode.nodeName === "GroupRange") {
                fullPath = tools.formatGaForIob(groupAddress.parentNode.getAttribute("Name")) + "." + fullPath;
                if (groupAddress.parentNode.parentNode.nodeName === "GroupRange") {
                    fullPath = tools.formatGaForIob(groupAddress.parentNode.parentNode.getAttribute("Name")) + "." + fullPath;
                }
            }
            return fullPath;
        }

        function identifyRangeRoleType(dptObj, range, dpt, type, role) {
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
                range = [];
            }

            //correct range, set type and role based on dpt
            //obj.common.min is only allowed on obj.common.type "number" or "mixed"
            if (tools.isDateDPT(dpt)) {
                // we convert knx date types in javascript Date with different size
                range[0] = undefined;
                range[1] = undefined;
                type = "number";
                role = "date";
            } else if (!!dptObj && !tools.isEmptyObject(dptObj) && dptObj.basetype && dptObj.basetype.valuetype == "composite") {
                type = "object";
            } else if (!!dptObj && !tools.isEmptyObject(dptObj) && dptObj.basetype && dptObj.basetype.bitlength == 1) {
                type = "boolean";
                role = "switch";
                range[0] = false;
                range[1] = true;
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
            return {
                range,
                type,
                role
            };
        }
    },

    //find statusGAs based on regexp
    findStatusGAs(adapter, gaList, aliassRegexp, aliasSimilarity, aliasPath, aliasRange, callback) {
        let count = 0;
        let err = "";
        const regex = RegExp(aliassRegexp, "gi");
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
                    if (similarity(unify(currentValue, adapter), unify(reducedStatusElement, adapter)) > similarity(unify(previousValue, adapter), unify(reducedStatusElement, adapter))) {
                        return currentValue;
                    } else {
                        return previousValue;
                    }
                });
                const a = unify(reducedStatusElement, aliasRange);
                const b = unify(nonStatusElement, aliasRange);
                if (similarity(a, b) > aliasSimilarity) {
                    //found a match that is not and status and good enough, generate alias object
                    createAlias(adapter, nonStatusElement, statusElement, aliasPath);
                    count++;
                    adapter.log.info("create aliases: found match " + nonStatusElement + " and " + statusElement);
                    const statusDpt = gaList.getDataById(statusElement).native.dpt;
                    const nonStatusDpt = gaList.getDataById(nonStatusElement).native.dpt;

                    if ((statusDpt != nonStatusDpt) && (nonStatusDpt.split(".")[0] != "DPT1" || statusDpt.split(".")[0] != "DPT1")) {
                        //if both are dpt1 treat as equal
                        const text = "create aliases: " + gaList.getDataById(statusElement).native.dpt + " does not match " + gaList.getDataById(nonStatusElement).native.dpt + ", consider defining a conversion function in the alias object if needed";
                        adapter.log.info(text);
                        err += text + "<br/>";
                    }
                }
            }
        }
        callback(count, err);
    }
};

/* make strings comparable*/
function unify(element, aliasRange) {
    element = element.toLowerCase().replace(/_/g, "");
    if (!(aliasRange)) {
        //exclude group names from search if user sets
        const n = element.lastIndexOf(".");
        element = element.substring(n + 1);
    }
    return element;
}

function createAlias(adapter, idDst, idSrc, aliasPath) {
    adapter.getObject(idDst, null, (err, obj) => {
        if (obj != null) {
            const dstObj = obj;
            adapter.getObject(idSrc, null, (err, srcObj) => {
                if (srcObj != null) {
                    const aliasId = aliasPath + dstObj._id.replace(adapter.namespace, "");
                    const aliasObject = {
                        "_id": aliasId,
                        "type": "state",
                        "native": {},
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