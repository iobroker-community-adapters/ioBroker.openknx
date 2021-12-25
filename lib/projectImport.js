"use strict";

const DPTLib = require(__dirname + "/knx/src/dptlib"); //todo copy for the moment
const select = require("xpath");
const _ = require("underscore");
const util = require("util");
const dom = require("xmldom").DOMParser;
const tools = require("./tools.js");
const similarity = require("similarity");

let groupAddresses = {};

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
        groupAddresses = {};
        const iobrokerObjects = [];

        function processFile(adapter, err, objectList) {
            //from xml export
            const doc = objectList["ga.xml"];
            if (doc)
                _.each(select.select("//*[local-name(.)='GroupAddress' and string(@Address)]", doc), function (ga) {
                    const address = ga.getAttribute("Address");
                    groupAddresses[address] = ga;
                });

            //format and put each found group address into the object tree
            _.each(groupAddresses, function (groupAddress) {
                const gaName = groupAddress.getAttribute("Name");
                let autoread = true;
                const dpt = tools.convertDPTtype(groupAddress.getAttribute("DatapointType") || groupAddress.getAttribute("DPTs")); //DPT or DPTs
                let dptObj = {};
                let fullPath = tools.formatGa(gaName);
                let range = [, ];
                let role = "state";
                let type;

                //add name of Mittelgruppe and Hauptgruppe to fullPath if exist
                if (groupAddress.parentNode.nodeName === "GroupRange") {
                    fullPath = tools.formatGa(groupAddress.parentNode.getAttribute("Name")) + "." + fullPath;
                    if (groupAddress.parentNode.parentNode.nodeName === "GroupRange") {
                        fullPath = tools.formatGa(groupAddress.parentNode.parentNode.getAttribute("Name")) + "." + fullPath;
                    }
                }

                if (dpt == "") {
                    const text = `${fullPath} ${groupAddress.getAttribute("Address")} ignored because no DPT set, because unused in ETS. Ignoriert weil kein DPT gesetzt, weil ungenutzt in der ETS.`;
                    adapter.log.warn(text);
                    if (!err) err = text;
                    else err += " \n" + text;
                    return;
                }

                try {
                    dptObj = DPTLib.resolve(dpt);
                } catch (e) {
                    //allowed state, unresolveable dpt means raw interface
                }

                // is there a scalar range? eg. DPT5.003 angle degrees (0=0, ff=360)
                if (!!dptObj && dptObj.subtype && dptObj.subtype.hasOwnProperty("scalar_range")) {
                    range = dptObj.subtype.scalar_range;
                } else if (!!dptObj && dptObj.hasOwnProperty("scalar_range")) {
                    range = dptObj.scalar_range;
                } else if (!!dptObj && dptObj.subtype && dptObj.subtype.hasOwnProperty("range")) {
                    // just a plain numeric value, only check if within bounds
                    range = dptObj.subtype.range;
                } else if (!!dptObj && dptObj.basetype && dptObj.basetype.hasOwnProperty("range")) {
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
                    range[0] = undefined;
                    range[1] = undefined;
                    type = "string"; //raw
                } else {
                    type = "number";
                }

                //if dpt is for sure not a status, remove from autoread
                if (tools.isTriggerDPT(dpt)) {
                    autoread = false;
                }

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
                        type: type, //default is mixed==any type) (possible values: number, string, boolean, array, object, mixed, file). As exception the objects with type meta could have common.type=meta.user or meta.folder. It is important to note that array, object, mixed and file must be serialized using JSON.stringify().
                        unit: !!dptObj && dptObj.subtype && dptObj.subtype.unit ? dptObj.subtype.unit : undefined,
                        write: true,
                    },
                    native: {
                        address: adr2ga(groupAddress.getAttribute("Address")),
                        answer_groupValueResponse: false, //overwrite manually
                        autoread: autoread,
                        bitlength: !dptObj || tools.isEmptyObject(dptObj) ? undefined : dptObj.basetype.bitlength, //informative
                        dpt: dpt,
                        encoding:
                            !!dptObj && Object.prototype.hasOwnProperty.call(dptObj, "subtype") ?
                            Object.prototype.hasOwnProperty.call(dptObj, "enc") ?
                            dptObj.subtype.enc :
                            dptObj.basetype.enc : undefined, //informative ,todo matcht zu common.states`? hat basetype enc?
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
        if (!fileObjectList.hasOwnProperty("push")) {
            processFile(adapter, null, fileObjectList);
        }
    },

    //find statusGAs
    //todo: rename to generateAliases
    findStatusGAs(adapter, gaList, callback) {
        //1st write the structure of aliases where regexp finds a match
        //outbound knx
        //inbound regexp found status

        const regex = RegExp(adapter.config.statusRegex);
        for (const element of gaList) {

            //iobrokerObjects.forEach((iobrokerObject) => {

            //find best match, todo: maybe remove path?
            if (regex.test(element.toLowerCase())) {
                const expression = element.toLowerCase().replace(regex, "");
                const maxElement = Array.from(gaList).reduce((previousValue, currentValue) => {
                    if (!previousValue) {
                        return currentValue;
                    }
                    //if (currentValue === iobrokerObject) {
                    //    return previousValue;
                    //}
                    if (similarity(currentValue.toLowerCase(), expression) > similarity(previousValue.toLowerCase(), expression)) {
                        return currentValue;
                    } else {
                        return previousValue;
                    }
                });

                if (similarity(expression.replace(" ", ""), maxElement.toLowerCase().replace(" ", "")) > 0.9) {
                    //found a pair, generate alias
                    //alias write to = element;
                    //alais incoming = maxElement;
                    createAlias(adapter, 'alias.0.' + element, element, maxElement);
                }
            }


        }
    }
};

//possibly convert 2byte value into ././. form
function adr2ga(adr) {
    //check if already in good format
    if (adr.includes("/")) return adr;
    //Bereiche: Hauptgruppe = 0..31, Mittelgruppe = 0..7, Untergruppe = 0..255
    return util.format("%d/%d/%d", (adr >> 11) & 0x1f, (adr >> 8) & 0x7, adr & 0xff);
}

function createAlias(adapter, idRd, idDst, idSrc) {
    let dstObj;
    let srcObj;

    adapter.getObject(idDst, null, (err, obj) => {
        if (obj != null) {
            dstObj = obj;
            adapter.getObject(idSrc, null, (err, obj) => {
                if (obj != null) {
                    srcObj = obj;

                    var obj = {};

                    obj.type = 'state';

                    obj.common = adapter.getObject(idSrc).common;

                    obj.common.alias = {};

                    if (idRd) {

                        obj.common.alias.id = {};

                        obj.common.alias.id.read = idRd;

                        obj.common.alias.id.write = idSrc;

                        obj.common.read = true;

                    } else obj.common.alias.id = idSrc;


                } else {
                    //error
                }
            });



        } else {
            //error
        }
    });
}



