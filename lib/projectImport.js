/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 */

"use strict";

const select = require("xpath");
const dom = require("@xmldom/xmldom").DOMParser;
const tools = require("./tools.js");
const similarity = require("./similarity.js");
module.exports = {
    // exposed so the KNX compatibility mode in main.js can reuse the exact same matching
    unify,
    affixSimilarity,
    // get xml Files from index.html via adapter.on 'message' and put it into file Obj
    parseInput: function (adapter, xml, callback) {
        const fileObjectList = {};

        if (xml) {
            // strip BOM if present - @xmldom/xmldom fails if BOM precedes <?xml declaration
            if (xml.charCodeAt(0) === 0xfeff) {
                xml = xml.slice(1);
            }
            fileObjectList["ga.xml"] = new dom().parseFromString(xml, "text/xml");
            adapter.log.debug("Parse xml succsessful");
        }

        this.generateIoBObjects(adapter, fileObjectList, (error, result) => {
            callback(error, result);
        });
    },

    // generate the Groupaddress structure
    generateIoBObjects: function (adapter, fileObjectList, callback) {
        const xmlGroupAddresses = {};
        const iobrokerObjects = [];

        function processFile(adapter, err, objectList) {
            //from xml export
            const doc = objectList["ga.xml"];
            if (doc) {
                select.select("//*[local-name(.)='GroupAddress' and string(@Address)]", doc).forEach(ga => {
                    const address = ga.getAttribute("Address");
                    if (xmlGroupAddresses[address] != null) {
                        const text = `Skipping Group Address that has the duplicate address ${address}. Please clean up the database.`;
                        adapter.log.warn(text);
                        if (!err) {
                            err = text;
                        } else {
                            err += `<br/>\n${text}`;
                        }
                        return;
                    }
                    xmlGroupAddresses[address] = ga;
                });
            }

            //format and put each found group address into the object tree
            Object.entries(xmlGroupAddresses).forEach(([, xmlGroupAddress]) => {
                const gaName = xmlGroupAddress.getAttribute("Name");
                const gaDescription = xmlGroupAddress.getAttribute("Description");
                let autoread = true;
                let dptObj = {};
                const fullPathName = expandPath(xmlGroupAddress, gaName);
                let range = [];
                let role = "state";
                let type = "";

                let dpt = tools.formatDpt(
                    xmlGroupAddress.getAttribute("DatapointType") || xmlGroupAddress.getAttribute("DPTs") || "",
                ); //DPT or DPTs
                if (dpt == "") {
                    const text = `Not adding ${fullPathName} because no DPT is assigned to GA ${xmlGroupAddress.getAttribute(
                        "Address",
                    )}. Assign a DPT to the GA in ETS (right-click GA → Properties → Datapoint Type).`;
                    adapter.log.warn(text);
                    if (!err) {
                        err = text;
                    } else {
                        err += `<br/>\n${text}`;
                    }
                    return;
                }
                if (dpt.indexOf(".") === -1) {
                    const text = `${fullPathName} has only set base DPT ${dpt} in ETS. No additional information (e.g. unit) available for this GA.`;
                    adapter.log.info(text);
                    if (!err) {
                        err = text;
                    } else {
                        err += `<br/>\n${text}`;
                    }
                }
                ({ dpt, dptObj } = tools.resolveDpt(dpt));

                ({ range, type, role } = identifyRangeRoleType(adapter, dptObj, range, dpt, type, role));

                // if dpt is for sure not a status, remove from autoread
                autoread = !tools.isTriggerDPT(dpt);

                // https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md#objects
                const iobrokerObject = {
                    _id: fullPathName,
                    type: "state",
                    common: {
                        desc: gaDescription,
                        name: gaName,
                        read: true,
                        role: role, //description: https://github.com/ioBroker/ioBroker/blob/master/doc/STATE_ROLES.md#state-roles
                        type: type, //possible values: number, string, boolean, array, object, mixed, file. It is important to note that array, object, mixed and file must be serialized using JSON.stringify().
                        unit: dptObj?.subtype?.unit || "",
                        write: true,
                        states: dptObj?.subtype?.enc,
                        ...(range[0] != null && typeof range[0] == "number" && type == "number" && { min: range[0] }),
                        ...(range[1] != null && typeof range[0] == "number" && type == "number" && { max: range[1] }),
                    },
                    native: {
                        address: tools.convertToGa(xmlGroupAddress.getAttribute("Address")),
                        answer_groupValueResponse: false, //overwrite manually
                        autoread: autoread,
                        bitlength: !dptObj || tools.isEmptyObject(dptObj) ? undefined : dptObj.basetype.bitlength, //informative
                        desc: `Basetype: ${
                            !dptObj || tools.isEmptyObject(dptObj)
                                ? "raw value"
                                : dptObj.basetype.desc +
                                  (dptObj.subtype?.desc ? `, Subtype: ${dptObj.subtype.desc}` : "")
                        }`,
                        ...(range[0] != null && typeof range[0] == "number" && type == "number" && { min: range[0] }),
                        ...(range[1] != null && typeof range[0] == "number" && type == "number" && { max: range[1] }),
                        dpt: dpt,
                        encoding: dptObj?.subtype?.enc ?? dptObj?.basetype?.enc,
                        force_encoding: dptObj?.subtype?.force_encoding,
                        signedness: dptObj?.basetype?.signedness,
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

        //add name of middle group and main group to fullPath for two level and three level style projects
        //iterative, to support free (unlimited) style
        function expandPath(groupAddress, gaName) {
            let parentNode = groupAddress.parentNode;
            let fullPath = "";
            while (parentNode.nodeName === "GroupRange") {
                fullPath = `${tools.formatGaNameForIob(parentNode.getAttribute("Name"))}.${fullPath}`;
                parentNode = parentNode.parentNode;
            }
            return fullPath + tools.formatGaNameForIob(gaName);
        }

        // identifyRangeRoleType is now a module-level function (shared with convertKnxProject)
    },

    /**
     * Convert parsed xknxproject output into the same ioBroker object array
     * format that generateIoBObjects produces from XML imports.
     *
     * @param {object} adapter - adapter instance
     * @param {object} knxProject - output from parseKnxproj()
     * @returns {{objects: Array, error: string | null, rooms: object}}
     */
    convertKnxProject: function (adapter, knxProject) {
        const iobrokerObjects = [];
        let err = null;

        const groupAddresses = knxProject.group_addresses;
        const commObjects = knxProject.communication_objects;
        const groupRanges = knxProject.group_ranges;
        const locations = knxProject.locations;

        // Build GA address -> path mapping from group_ranges hierarchy
        const gaPathMap = {};
        function buildPaths(ranges, parentPath) {
            for (const [, range] of Object.entries(ranges)) {
                const rangeName = tools.formatGaNameForIob(range.name);
                const currentPath = parentPath ? `${parentPath}.${rangeName}` : rangeName;
                // Leaf GAs within this range
                for (const gaAddr of range.group_addresses || []) {
                    gaPathMap[gaAddr] = currentPath;
                }
                // Recurse into sub-ranges
                if (range.group_ranges) {
                    buildPaths(range.group_ranges, currentPath);
                }
            }
        }
        buildPaths(groupRanges, "");

        // Build reverse index: GA address -> linked COs (for flag aggregation)
        const gaToCommObjects = {};
        for (const [, co] of Object.entries(commObjects)) {
            for (const gaAddr of co.group_address_links || []) {
                if (!gaToCommObjects[gaAddr]) {
                    gaToCommObjects[gaAddr] = [];
                }
                gaToCommObjects[gaAddr].push(co);
            }
        }

        // Build device address -> room paths mapping from locations
        const deviceToRooms = {};
        function collectDeviceRooms(spaces, parentPath) {
            for (const [spaceName, space] of Object.entries(spaces)) {
                const currentPath = parentPath ? `${parentPath}.${spaceName}` : spaceName;
                for (const deviceAddr of space.devices || []) {
                    if (!deviceToRooms[deviceAddr]) {
                        deviceToRooms[deviceAddr] = [];
                    }
                    deviceToRooms[deviceAddr].push({ path: currentPath, name: spaceName });
                }
                if (space.spaces) {
                    collectDeviceRooms(space.spaces, currentPath);
                }
            }
        }
        collectDeviceRooms(locations || {}, "");

        // Build GA address -> room paths via device -> CO -> GA chain
        const gaToRooms = {};
        for (const [, co] of Object.entries(commObjects)) {
            const deviceAddr = co.device_address;
            const rooms = deviceToRooms[deviceAddr];
            if (!rooms || rooms.length === 0) {
                continue;
            }
            for (const gaAddr of co.group_address_links || []) {
                if (!gaToRooms[gaAddr]) {
                    gaToRooms[gaAddr] = [];
                }
                for (const room of rooms) {
                    if (!gaToRooms[gaAddr].some(r => r.path === room.path)) {
                        gaToRooms[gaAddr].push(room);
                    }
                }
            }
        }

        // Collect unique rooms for enum creation
        const roomsMap = {};

        for (const [gaAddr, ga] of Object.entries(groupAddresses)) {
            const gaName = ga.name;

            // Convert DPT {main, sub} to "DPTmain.sub" string
            let dpt = "";
            if (ga.dpt) {
                dpt =
                    ga.dpt.sub != null
                        ? `DPT${ga.dpt.main}.${String(ga.dpt.sub).padStart(3, "0")}`
                        : `DPT${ga.dpt.main}`;
            }

            if (dpt === "") {
                const pathForLog = gaPathMap[gaAddr]
                    ? `${gaPathMap[gaAddr]}.${tools.formatGaNameForIob(gaName)}`
                    : gaName;
                const text = `Not adding ${pathForLog} because no DPT is assigned to GA ${gaAddr}. Assign a DPT to the GA in ETS (right-click GA → Properties → Datapoint Type).`;
                adapter.log.warn(text);
                if (!err) {
                    err = text;
                } else {
                    err += `<br/>\n${text}`;
                }
                continue;
            }

            if (dpt.indexOf(".") === -1) {
                const pathForLog = gaPathMap[gaAddr]
                    ? `${gaPathMap[gaAddr]}.${tools.formatGaNameForIob(gaName)}`
                    : gaName;
                const text = `${pathForLog} has only set base DPT ${dpt} in ETS. No additional information (e.g. unit) available for this GA.`;
                adapter.log.info(text);
                if (!err) {
                    err = text;
                } else {
                    err += `<br/>\n${text}`;
                }
            }

            let dptObj = {};
            ({ dpt, dptObj } = tools.resolveDpt(dpt));

            let range = [];
            let role = "state";
            let type = "";
            ({ range, type, role } = identifyRangeRoleType(adapter, dptObj, range, dpt, type, role));

            // Determine read/write/autoread from linked COs if available
            const linkedCOs = gaToCommObjects[gaAddr] || [];
            let commonRead = true;
            let commonWrite = true;
            let autoread = !tools.isTriggerDPT(dpt);

            let updateFlag = false;

            if (linkedCOs.length > 0) {
                // Use CO flags: any CO with read flag -> common.read; any CO with write flag -> common.write
                commonRead = linkedCOs.some(co => co.flags.read);
                commonWrite = linkedCOs.some(co => co.flags.write);
                updateFlag = linkedCOs.some(co => co.flags.update);
                // Use read_on_init from COs if available, fallback to DPT-based heuristic
                const hasReadOnInit = linkedCOs.some(co => co.flags.read_on_init);
                autoread = hasReadOnInit || (!tools.isTriggerDPT(dpt) && commonRead);
            }

            // Build path from group ranges hierarchy
            const parentPath = gaPathMap[gaAddr] || "";
            const formattedGaName = tools.formatGaNameForIob(gaName);
            const fullPathName = parentPath ? `${parentPath}.${formattedGaName}` : formattedGaName;

            // Collect room assignments for this GA
            const gaRooms = gaToRooms[gaAddr] || [];
            for (const room of gaRooms) {
                if (!roomsMap[room.path]) {
                    roomsMap[room.path] = { name: room.name, members: [] };
                }
                roomsMap[room.path].members.push(fullPathName);
            }

            const iobrokerObject = {
                _id: fullPathName,
                type: "state",
                common: {
                    desc: ga.description || "",
                    name: gaName,
                    read: commonRead,
                    role: role,
                    type: type,
                    unit: dptObj?.subtype?.unit || "",
                    write: commonWrite,
                    states: dptObj?.subtype?.enc,
                    ...(range[0] != null && typeof range[0] == "number" && type == "number" && { min: range[0] }),
                    ...(range[1] != null && typeof range[0] == "number" && type == "number" && { max: range[1] }),
                },
                native: {
                    address: gaAddr,
                    answer_groupValueResponse: false,
                    autoread: autoread,
                    bitlength: !dptObj || tools.isEmptyObject(dptObj) ? undefined : dptObj.basetype.bitlength,
                    desc: `Basetype: ${
                        !dptObj || tools.isEmptyObject(dptObj)
                            ? "raw value"
                            : dptObj.basetype.desc + (dptObj.subtype?.desc ? `, Subtype: ${dptObj.subtype.desc}` : "")
                    }`,
                    ...(range[0] != null && typeof range[0] == "number" && type == "number" && { min: range[0] }),
                    ...(range[1] != null && typeof range[0] == "number" && type == "number" && { max: range[1] }),
                    dpt: dpt,
                    encoding: dptObj?.subtype?.enc ?? dptObj?.basetype?.enc,
                    force_encoding: dptObj?.subtype?.force_encoding,
                    signedness: dptObj?.basetype?.signedness,
                    update: updateFlag,
                    valuetype: !dptObj || tools.isEmptyObject(dptObj) ? undefined : dptObj.basetype.valuetype,
                },
            };

            iobrokerObjects.push(iobrokerObject);
        }

        return { objects: iobrokerObjects, error: err, rooms: roomsMap };
    },

    //find statusGAs based on regexp
    async findStatusGAs(
        adapter,
        gaList,
        aliasRegexp,
        aliasSimilarity,
        aliasPath,
        aliasRange,
        aliasNoOverwrite,
        callback,
    ) {
        let count = 0;
        let err = "";
        // "g" flag is needed for replace() to strip the match; a separate non-global
        // regex is used for test() because test() on a global regex is stateful
        // (lastIndex carries over between calls) and corrupts detection inside the loop
        let regex;
        let testRegex;
        try {
            regex = RegExp(aliasRegexp, "gi");
            testRegex = RegExp(aliasRegexp, "i");
        } catch (e) {
            adapter.log.warn(`create aliases: invalid regex "${aliasRegexp}": ${e.message}`);
            callback(0, `invalid regex: ${e.message}`);
            return;
        }
        try {
            const allElements = Array.from(gaList);
            for (const statusElement of gaList) {
                if (!testRegex.test(statusElement)) {
                    continue;
                }
                //for all status gas
                const reducedStatusElement = statusElement.replace(regex, "");
                //candidates are all non-status GAs except the status GA itself; building the
                //list explicitly avoids reduce() seeding its accumulator with an unfiltered
                //first element (which could let a status GA match itself)
                const target = unify(reducedStatusElement, aliasRange);
                let nonStatusElement = null;
                let bestScore = -1;
                for (const candidate of allElements) {
                    if (candidate === statusElement || testRegex.test(candidate)) {
                        continue;
                    }
                    //compare only the parts that actually differ (shared context stripped)
                    const score = affixSimilarity(unify(candidate, aliasRange), target);
                    if (score > bestScore) {
                        bestScore = score;
                        nonStatusElement = candidate;
                    }
                }
                if (nonStatusElement !== null && bestScore > aliasSimilarity) {
                    //found a match that is not a status and good enough, generate alias object
                    adapter.log.info(`create aliases: found match ${nonStatusElement} and ${statusElement}`);
                    //await sequentially so count reflects actual writes and two matches
                    //targeting the same alias id cannot race
                    const written = await createAlias(
                        adapter,
                        nonStatusElement,
                        statusElement,
                        aliasPath,
                        aliasNoOverwrite,
                    );
                    if (written) {
                        count++;
                    }
                    const statusDpt = gaList.getDataById(statusElement).native.dpt;
                    const nonStatusDpt = gaList.getDataById(nonStatusElement).native.dpt;

                    if (
                        statusDpt != nonStatusDpt &&
                        (nonStatusDpt.split(".")[0] != "DPT1" || statusDpt.split(".")[0] != "DPT1")
                    ) {
                        //if both are dpt1 treat as equal
                        const text = `create aliases: ${gaList.getDataById(statusElement).native.dpt} does not match ${
                            gaList.getDataById(nonStatusElement).native.dpt
                        }, consider defining a conversion function in the alias object if needed`;
                        adapter.log.info(text);
                        err += `${text}<br/>`;
                    }
                }
            }
        } catch (e) {
            adapter.log.warn(`create aliases: failed: ${e.message}`);
            err += `create aliases failed: ${e.message}<br/>`;
        }
        callback(count, err);
    },
};

/**
 * Determine ioBroker range, type and role from a knxultimate DPT object.
 * Extracted as module-level function so both XML and knxproj import paths can use it.
 */
function identifyRangeRoleType(ad, dptObj, range, dpt, type, role) {
    // is there a scalar range? eg. DPT5.003 angle degrees (0=0, ff=360)
    if (dptObj?.subtype?.scalar_range) {
        range = dptObj.subtype.scalar_range;
    } else if (dptObj?.scalar_range) {
        range = dptObj.scalar_range;
    } else if (dptObj?.subtype?.range) {
        range = dptObj.subtype.range;
    } else if (dptObj?.basetype?.range) {
        range = dptObj.basetype.range;
    } else if (!!dptObj && !tools.isEmptyObject(dptObj)) {
        range = [0, Math.pow(2, dptObj.basetype.bitlength) - 1];
    } else {
        range = [];
    }

    if (dptObj?.subtype?.enc) {
        if (dptObj?.basetype?.bitlength == 1) {
            if (ad.config.useBoolean) {
                type = "boolean";
            } else {
                type = "mixed";
            }
        } else {
            type = "number";
        }
    }

    if (tools.isDateDPT(dpt)) {
        range[0] = undefined;
        range[1] = undefined;
        type = "number";
        role = "date";
    } else if (
        !!dptObj &&
        !tools.isEmptyObject(dptObj) &&
        dptObj.basetype &&
        dptObj.basetype.valuetype == "composite"
    ) {
        type = "object";
    } else if (!!dptObj && !tools.isEmptyObject(dptObj) && dptObj.basetype && dptObj.basetype.bitlength == 1) {
        if (type != "number") {
            type = "boolean";
        }
        role = "switch";
        range[0] = false;
        range[1] = true;
    } else if (tools.isObjectDPT(dpt)) {
        range[0] = undefined;
        range[1] = undefined;
        type = "object";
    } else if (tools.isStringDPT(dpt)) {
        range[0] = undefined;
        range[1] = undefined;
        type = "string";
        role = "text";
    } else if (tools.isFloatDPT(dpt)) {
        range[0] = undefined;
        range[1] = undefined;
        type = "number";
        role = "value";
    } else if (tools.isUnknownDPT(dpt)) {
        range[0] = undefined;
        range[1] = undefined;
        type = "string";
    } else {
        type = "number";
        role = dpt.includes(".") && dptObj?.subtype?.unit === "%" ? "level" : "value";
    }
    return { range, type, role };
}

/* make strings comparable*/
function unify(element, aliasRange) {
    //normalize umlauts so mixed spellings (e.g. "Tür" vs "Tuer") still compare equal
    element = element
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/_/g, "");
    if (!aliasRange) {
        //exclude group names from search if user sets
        const n = element.lastIndexOf(".");
        element = element.substring(n + 1);
    }
    //collapse whitespace and strip leftover separators: a status marker removed by the
    //regex can leave a trailing separator (e.g. "status$" -> "Alarm ", "-Status" ->
    //"Waschmaschine-"), which would otherwise be the only difference and wrongly drag
    //affixSimilarity down to 0. Only leading/trailing separators are trimmed, so
    //internal ones (e.g. "Open-Close", "WZ-J-1") are preserved
    element = element.replace(/\s+/g, " ").replace(/^[\s.\-|/:]+|[\s.\-|/:]+$/g, "");
    return element;
}

/*
 * Score how similar two GA names are, but only on the part that actually differs.
 * The shared leading and trailing characters (e.g. the common room/function prefix)
 * are stripped first, so a long common context cannot inflate the score. A status GA
 * that has no real command partner (e.g. "...Raumtemperatur - VALVE" with no "VALVE"
 * command) therefore scores low against every candidate and is left unmatched, while a
 * genuine pair that is identical except for the status marker scores 1.
 */
function affixSimilarity(a, b) {
    let start = 0;
    const minLen = Math.min(a.length, b.length);
    while (start < minLen && a[start] === b[start]) {
        start++;
    }
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
        endA--;
        endB--;
    }
    return similarity(a.slice(start, endA), b.slice(start, endB));
}

async function createAlias(adapter, idDst, idSrc, aliasPath, aliasNoOverwrite) {
    try {
        const dstObj = await adapter.getObjectAsync(idDst);
        if (dstObj == null) {
            adapter.log.debug(`createAlias: destination object not found: ${idDst}`);
            return false;
        }
        const srcObj = await adapter.getObjectAsync(idSrc);
        if (srcObj == null) {
            adapter.log.debug(`createAlias: source object not found: ${idSrc}`);
            return false;
        }
        const aliasId = aliasPath + dstObj._id.replace(adapter.namespace, "");
        if (aliasNoOverwrite) {
            //keep an already existing alias untouched, only fill gaps
            const existing = await adapter.getForeignObjectAsync(aliasId);
            if (existing) {
                adapter.log.info(`create aliases: keeping existing alias ${aliasId}`);
                return false;
            }
        }
        const aliasObject = {
            _id: aliasId,
            type: "state",
            native: {},
            common: {
                name: dstObj.common.name,
                desc: dstObj.common.desc,
                role: dstObj.common.role,
                type: dstObj.common.type,
                read: dstObj.common.read,
                write: dstObj.common.write,
                unit: dstObj.common.unit,
                min: dstObj.common.min,
                max: dstObj.common.max,
                def: dstObj.common.type == "number" ? 0 : dstObj.common.type == "boolean" ? false : "",
                alias: {
                    id: {
                        read: srcObj._id,
                        write: dstObj._id,
                    },
                },
            },
        };
        await adapter.setForeignObjectAsync(aliasId, aliasObject);
        return true;
    } catch (e) {
        //on lookup/write error do not touch an existing alias
        adapter.log.warn(`createAlias: failed for ${idSrc} -> ${idDst}: ${e.message}`);
        return false;
    }
}
