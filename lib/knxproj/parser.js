/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * Port of xknxproject/xml/parser.py
 * Orchestrates all loaders, resolves references, and transforms
 * internal models to the public KNXProject output format.
 */

"use strict";

const knxMasterLoader = require("./knxMasterLoader");
const projectLoader = require("./projectLoader");
const hardwareLoader = require("./hardwareLoader");
const applicationLoader = require("./applicationLoader");
const { MEDIUM_TYPES } = require("./models");
const { stripModuleInstance } = require("./util");

const XKNXPROJECT_VERSION = "3.8.2";

/**
 * Strip RTF wrapper if present, returning plain text.
 * A proper RTF-to-text conversion could be added later;
 * for now we do a best-effort extraction.
 *
 * @param {string} text
 * @returns {string}
 */
function stripRtf(text) {
    if (!text) {
        return "";
    }
    if (!text.startsWith("{\\rtf")) {
        return text;
    }
    // Remove RTF control words and groups, keep plain text
    let result = text
        .replace(/\{\\[^{}]*\}/g, "") // remove simple groups like {\fonttbl...}
        .replace(/\\[a-z]+\d*\s?/gi, "") // remove control words like \par \b0
        .replace(/[{}]/g, "") // remove remaining braces
        .replace(/\r?\n/g, "") // remove newlines
        .trim();
    return result;
}

/**
 * Unescape basic HTML entities.
 *
 * @param {string} text
 * @returns {string}
 */
function htmlUnescape(text) {
    if (!text) {
        return "";
    }
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
}

/**
 * Convert an XMLGroupAddressRef (function child) to the output GroupAddressRef format.
 *
 * @param {object} gaRef
 * @returns {object}
 */
function convertGroupAddressRef(gaRef) {
    return {
        address: gaRef.address,
        name: gaRef.name || "",
        project_uid: gaRef.projectUid != null ? gaRef.projectUid : null,
        role: gaRef.role || "",
    };
}

/**
 * Convert an XMLFunction to the output Function format.
 *
 * @param {object} func
 * @returns {object}
 */
function convertFunction(func) {
    const gaDict = {};
    for (const gaRef of func.groupAddresses) {
        if (gaRef.address) {
            gaDict[gaRef.address] = convertGroupAddressRef(gaRef);
        }
    }

    return {
        function_type: func.functionType || "",
        group_addresses: gaDict,
        identifier: func.identifier || "",
        name: func.name || "",
        project_uid: func.projectUid != null ? func.projectUid : null,
        space_id: func.spaceId || "",
        usage_text: func.usageText || "",
    };
}

/**
 * Recursively convert spaces to the output format.
 *
 * @param {object[]} spaces
 * @returns {object}
 */
function recursiveConvertSpaces(spaces) {
    const result = {};
    for (const space of spaces) {
        result[space.name] = {
            type: space.spaceType || "",
            identifier: space.identifier || "",
            name: space.name || "",
            usage_id: space.usageId != null ? space.usageId : null,
            usage_text: space.usageText || "",
            number: space.number || "",
            description: space.description || "",
            project_uid: space.projectUid != null ? space.projectUid : null,
            devices: space.devices || [],
            spaces: recursiveConvertSpaces(space.spaces || []),
            functions: space.functions || [],
        };
    }
    return result;
}

/**
 * Recursively convert group ranges to the output format.
 *
 * @param {object[]} groupRanges
 * @param {string} groupAddressStyle
 * @returns {object}
 */
function recursiveConvertGroupRanges(groupRanges, groupAddressStyle) {
    const result = {};
    for (const gr of groupRanges) {
        const strAddr = formatGroupRangeAddress(gr, groupAddressStyle);
        result[strAddr] = {
            name: gr.name || "",
            address_start: gr.rangeStart,
            address_end: gr.rangeEnd,
            comment: htmlUnescape(stripRtf(gr.comment || "")),
            group_addresses: (gr.groupAddresses || []).map(rawAddr =>
                projectLoader.formatGroupAddress(String(rawAddr), groupAddressStyle),
            ),
            group_ranges: recursiveConvertGroupRanges(gr.groupRanges || [], groupAddressStyle),
        };
    }
    return result;
}

/**
 * Compute the string address for a group range
 * (mirrors XMLGroupRange.strAddress from models.js).
 *
 * @param {object} gr
 * @param {string} style
 * @returns {string}
 */
function formatGroupRangeAddress(gr, style) {
    if (style === "Free") {
        return `${gr.rangeStart}...${gr.rangeEnd}`;
    }
    if (style === "TwoLevel") {
        return projectLoader.formatGroupAddress(String(gr.rangeStart), style).split("/")[0];
    }
    if (style === "ThreeLevel") {
        const parts = projectLoader.formatGroupAddress(String(gr.rangeStart), style).split("/");
        if (gr.rangeEnd - gr.rangeStart >= 2046) {
            return parts[0];
        }
        return parts.slice(0, 2).join("/");
    }
    throw new Error(`GroupAddressStyle '${style}' not supported`);
}

/**
 * Resolve the ComObjectRefId for a ComObjectInstanceRef.
 * Port of ComObjectInstanceRef.resolveComObjectRefId.
 *
 * @param {object} coRef - ComObjectInstanceRef plain object
 * @param {string} applicationProgramRef
 * @param {object} knxProjContents
 */
function resolveComObjectRefId(coRef, applicationProgramRef, knxProjContents) {
    if (knxProjContents.isEts4Project() && coRef.refId.startsWith(applicationProgramRef)) {
        coRef.comObjectRefId = coRef.refId;
        return;
    }
    const refId = stripModuleInstance(coRef.refId, "O");
    coRef.applicationProgramIdPrefix = `${applicationProgramRef}_`;
    coRef.comObjectRefId = `${applicationProgramRef}_${refId}`;
}

/**
 * Complete module instance argument ref IDs with the application program ref prefix.
 * Port of ModuleInstanceArgument.completeRefId from models.py.
 *
 * @param {object} moduleInstance
 * @param {string} applicationProgramRef
 */
function completeModuleArgumentsRefId(moduleInstance, applicationProgramRef) {
    const moduleDefId = moduleInstance.refId.split("_")[0]; // "MD-<int>"
    for (const arg of moduleInstance.arguments) {
        if (arg.refId.startsWith("SM-")) {
            arg.refId = `${applicationProgramRef}_${moduleDefId}_${arg.refId}`;
        } else {
            arg.refId = `${applicationProgramRef}_${arg.refId}`;
        }
    }
}

/**
 * Get the application program XML file path for a device.
 *
 * @param {object} device
 * @returns {string}
 */
function applicationProgramXml(device) {
    return `${device.manufacturer}/${device.applicationProgramRef}.xml`;
}

/**
 * Group devices by application program file so each is parsed only once.
 *
 * @param {object[]} devices
 * @returns {Map<string, object[]>}
 */
function getApplicationProgramFilesForDevices(devices) {
    const result = new Map();
    for (const device of devices) {
        if (device.applicationProgramRef) {
            const xmlFile = applicationProgramXml(device);
            if (!result.has(xmlFile)) {
                result.set(xmlFile, []);
            }
            result.get(xmlFile).push(device);
        }
    }
    return result;
}

/**
 * Collect all used ComObjectRefIds from a set of devices.
 *
 * @param {object[]} devices
 * @returns {Set<string>}
 */
function collectUsedComObjectRefIds(devices) {
    const ids = new Set();
    for (const device of devices) {
        for (const coRef of device.comObjectInstanceRefs) {
            if (coRef.comObjectRefId != null) {
                ids.add(coRef.comObjectRefId);
            }
        }
    }
    return ids;
}

/**
 * Merge application program info into a ComObjectInstanceRef.
 * Port of ComObjectInstanceRef.mergeApplicationProgramInfo + _mergeFromParentObject.
 *
 * @param {object} coInstance
 * @param {object} application - { comObjects, comObjectRefs, allocators, ... }
 * @param {object} parameterInstanceRefs
 */
function mergeComObjectInstanceRefInfo(coInstance, application, parameterInstanceRefs) {
    if (coInstance.comObjectRefId == null) {
        return;
    }

    const comObjectRef = application.comObjectRefs[coInstance.comObjectRefId];
    if (!comObjectRef) {
        return;
    }

    // Merge from ComObjectRef (isComObjectRef = true)
    if (coInstance.name == null) {
        coInstance.name = comObjectRef.name;
    }
    if (coInstance.text == null) {
        // Try text with parameter substitution
        let textWithParam = null;
        if (comObjectRef.text && comObjectRef.textParameterRefId) {
            const { textParameterInsertModuleInstance, textParameterTemplateReplace } = require("./util");
            const paramInstanceRef = textParameterInsertModuleInstance(
                coInstance.refId,
                "O",
                comObjectRef.textParameterRefId,
            );
            let parameter = null;
            try {
                parameter = parameterInstanceRefs[paramInstanceRef];
                if (parameter === undefined) {
                    parameter = null;
                }
            } catch {
                parameter = null;
            }
            textWithParam = textParameterTemplateReplace(comObjectRef.text || "", parameter);
        }
        coInstance.text = textWithParam || comObjectRef.text;
    }
    if (coInstance.functionText == null) {
        coInstance.functionText = comObjectRef.functionText;
    }
    if (coInstance.objectSize == null) {
        coInstance.objectSize = comObjectRef.objectSize;
    }
    if (coInstance.readFlag == null) {
        coInstance.readFlag = comObjectRef.readFlag;
    }
    if (coInstance.writeFlag == null) {
        coInstance.writeFlag = comObjectRef.writeFlag;
    }
    if (coInstance.communicationFlag == null) {
        coInstance.communicationFlag = comObjectRef.communicationFlag;
    }
    if (coInstance.transmitFlag == null) {
        coInstance.transmitFlag = comObjectRef.transmitFlag;
    }
    if (coInstance.updateFlag == null) {
        coInstance.updateFlag = comObjectRef.updateFlag;
    }
    if (coInstance.readOnInitFlag == null) {
        coInstance.readOnInitFlag = comObjectRef.readOnInitFlag;
    }
    if (!coInstance.datapointTypes || coInstance.datapointTypes.length === 0) {
        coInstance.datapointTypes = comObjectRef.datapointTypes;
    }

    // Merge from ComObject (isComObjectRef = false)
    const comObject = application.comObjects[comObjectRef.refId];
    if (!comObject) {
        return;
    }

    if (coInstance.name == null) {
        coInstance.name = comObject.name;
    }
    if (coInstance.text == null) {
        coInstance.text = comObject.text;
    }
    if (coInstance.functionText == null) {
        coInstance.functionText = comObject.functionText;
    }
    if (coInstance.objectSize == null) {
        coInstance.objectSize = comObject.objectSize;
    }
    if (coInstance.readFlag == null) {
        coInstance.readFlag = comObject.readFlag;
    }
    if (coInstance.writeFlag == null) {
        coInstance.writeFlag = comObject.writeFlag;
    }
    if (coInstance.communicationFlag == null) {
        coInstance.communicationFlag = comObject.communicationFlag;
    }
    if (coInstance.transmitFlag == null) {
        coInstance.transmitFlag = comObject.transmitFlag;
    }
    if (coInstance.updateFlag == null) {
        coInstance.updateFlag = comObject.updateFlag;
    }
    if (coInstance.readOnInitFlag == null) {
        coInstance.readOnInitFlag = comObject.readOnInitFlag;
    }
    if (!coInstance.datapointTypes || coInstance.datapointTypes.length === 0) {
        coInstance.datapointTypes = comObject.datapointTypes;
    }
    // ComObject-only fields
    coInstance.number = comObject.number;
    coInstance.baseNumberArgumentRef = comObject.baseNumberArgumentRef || null;
}

/**
 * Apply module base number argument.
 * Port of ComObjectInstanceRef.applyModuleBaseNumberArgument.
 *
 * @param {object} coInstance
 * @param {object[]} moduleInstances
 * @param {object} application
 */
function applyModuleBaseNumberArgument(coInstance, moduleInstances, application) {
    if (coInstance.baseNumberArgumentRef == null || !coInstance.refId.startsWith("MD-") || coInstance.number == null) {
        return;
    }

    /**
     * @param {object} mi
     * @param {string} bnArgRef
     * @returns {number}
     */
    function parseBaseNumberArgument(mi, bnArgRef) {
        let result = 0;
        const baseNumberArgument = mi.arguments.find(arg => arg.refId === bnArgRef);
        if (!baseNumberArgument) {
            console.warn(
                `Base number argument ${bnArgRef} not found for ComObjectInstanceRef refId=${coInstance.refId}`,
            );
            return 0;
        }

        const intValue = parseInt(baseNumberArgument.value, 10);
        if (!isNaN(intValue) && String(intValue) === baseNumberArgument.value) {
            return intValue;
        }

        // Allocator path
        const submoduleMatch = mi.identifier.match(/(_SM-[^_]+)/);
        const baseModuleId = submoduleMatch ? mi.identifier.split("_SM-")[0] : null;

        if (baseModuleId) {
            const numArg = application.numericArgs[baseNumberArgument.refId];
            if (numArg != null && numArg.baseValue != null) {
                const baseModule = moduleInstances.find(m => m.identifier === baseModuleId);
                if (baseModule) {
                    result += parseBaseNumberArgument(baseModule, numArg.baseValue);
                }
            }
        }
        return result + baseNumberFromAllocator(coInstance, baseNumberArgument, application.allocators);
    }

    const moduleInstance = moduleInstances.find(mi => coInstance.refId.startsWith(`${mi.identifier}_`));
    if (!moduleInstance) {
        console.warn(`ModuleInstance not found for ComObjectInstanceRef refId=${coInstance.refId}`);
        return;
    }

    const comObjectNumber = coInstance.number;
    coInstance.number += parseBaseNumberArgument(moduleInstance, coInstance.baseNumberArgumentRef);

    const moduleDefId = moduleInstance.refId.split("_")[0];
    const submoduleMatch = moduleInstance.identifier.match(/(_SM-[^_]+)/);
    const definitionId = submoduleMatch ? `${moduleDefId}${submoduleMatch[1]}` : moduleDefId;

    coInstance.module = {
        definition: definitionId,
        root_number: comObjectNumber,
    };
}

/**
 * Compute base number from allocator.
 *
 * @param {object} coInstance
 * @param {object} baseNumberArgument
 * @param {object} allocators
 * @returns {number}
 */
function baseNumberFromAllocator(coInstance, baseNumberArgument, allocators) {
    const prefix = coInstance.applicationProgramIdPrefix || "";
    let allocatorObjectBase = null;
    for (const allocator of Object.values(allocators)) {
        if (allocator.identifier === prefix + baseNumberArgument.value) {
            allocatorObjectBase = allocator;
            break;
        }
    }
    if (!allocatorObjectBase) {
        console.warn(
            `Allocator with identifier ${baseNumberArgument.value} not found for ComObjectInstanceRef refId=${coInstance.refId}`,
        );
        return 0;
    }
    const allocatorSize = baseNumberArgument.allocates;
    if (allocatorSize == null) {
        return 0;
    }
    const miPart = coInstance.refId.split("_MI-")[1];
    const moduleInstanceIndex = parseInt(miPart.split("_")[0], 10);
    return allocatorObjectBase.start + allocatorSize * (moduleInstanceIndex - 1);
}

/**
 * Resolve channel name from application program data.
 * Port of ChannelNode.resolveChannelName.
 *
 * @param {object} channel
 * @param {object} device
 * @param {object} application
 */
function resolveChannelName(channel, device, application) {
    if (channel.name) {
        return;
    }
    const applicationChannelId = stripModuleInstance(channel.refId, "CH");
    const appChannel = application.channels[`${device.applicationProgramRef}_${applicationChannelId}`];
    if (!appChannel) {
        return;
    }

    if (appChannel.text && appChannel.textParameterRefId) {
        const { textParameterInsertModuleInstance, textParameterTemplateReplace } = require("./util");
        const paramInstanceRef = textParameterInsertModuleInstance(channel.refId, "CH", appChannel.textParameterRefId);
        let parameter = null;
        try {
            parameter = device.parameterInstanceRefs[paramInstanceRef];
            if (parameter === undefined) {
                parameter = null;
            }
        } catch {
            parameter = null;
        }
        channel.name = textParameterTemplateReplace(appChannel.text, parameter) || appChannel.name;
    } else {
        channel.name = appChannel.text || appChannel.name;
    }
}

/**
 * Resolve channel module placeholders.
 * Port of ChannelNode.resolveChannelModulePlaceholders.
 *
 * @param {object} channel
 * @param {object} device
 */
function resolveChannelModulePlaceholders(channel, device) {
    if (!(channel.refId.startsWith("MD-") && channel.name && channel.name.includes("{{"))) {
        return;
    }
    const moduleInstanceRef = channel.refId.split("_CH")[0];
    const moduleInstance = device.moduleInstances.find(mi => mi.identifier === moduleInstanceRef);
    if (!moduleInstance) {
        return;
    }
    for (const argument of moduleInstance.arguments) {
        channel.name = channel.name.replace(`{{${argument.name}}}`, argument.value);
    }
}

/**
 * Merge application program info into a device.
 * Port of DeviceInstance.mergeApplicationProgramInfo.
 *
 * @param {object} device
 * @param {object} application
 */
function mergeDeviceApplicationProgramInfo(device, application) {
    // Fill module def argument info (name, allocates)
    for (const mi of device.moduleInstances) {
        for (const arg of mi.arguments) {
            const moduleDef = application.moduleDefArguments[arg.refId];
            if (moduleDef) {
                arg.name = moduleDef.name;
                arg.allocates = moduleDef.allocates;
            }
        }
    }

    // Merge ComObjectInstanceRefs
    for (const coInstance of device.comObjectInstanceRefs) {
        mergeComObjectInstanceRefInfo(coInstance, application, device.parameterInstanceRefs);
        applyModuleBaseNumberArgument(coInstance, device.moduleInstances, application);
    }

    // Resolve channel names
    for (const channel of device.channels) {
        resolveChannelName(channel, device, application);
        resolveChannelModulePlaceholders(channel, device);
    }
}

/**
 * Parser class - orchestrates loading and transforming of the KNX project.
 */
class Parser {
    /**
     * @param {import('./extractor').KNXProjContents} knxProjContents
     */
    constructor(knxProjContents) {
        this.knxProjContents = knxProjContents;
        this.spaces = [];
        this.groupAddresses = [];
        this.groupRanges = [];
        this.areas = [];
        this.devices = [];
        this.languageCode = null;
        this.projectInfo = null;
        this.functions = [];
    }

    /**
     * Parse the ETS project.
     *
     * @param {string|null} [language]
     * @returns {Promise<object>} KNXProject output
     */
    async parse(language) {
        await this._load(language || null);
        this._sort();
        return this._transform();
    }

    /**
     * Load all XML data from the archive.
     *
     * @param {string|null} language
     */
    async _load(language) {
        // 1. Load KNX master data
        const knxMasterXml = await this.knxProjContents.readFile("knx_master.xml");
        const { masterData, languageCode } = knxMasterLoader.load(
            knxMasterXml,
            this.knxProjContents.schemaVersion,
            language,
        );
        this.languageCode = languageCode;

        // Convert Maps to plain objects for downstream use
        const knxMasterData = {
            manufacturers: masterData.manufacturers, // Map
            spaceUsages: masterData.spaceUsages, // Map
            functionTypes: masterData.functionTypes, // Map
            translations: masterData.translations, // Map
        };

        // 2. Load project data (topology, GAs, spaces, functions, devices)
        const projectData = await projectLoader.load(this.knxProjContents, knxMasterData);
        this.groupAddresses = projectData.groupAddresses;
        this.groupRanges = projectData.groupRanges;
        this.areas = projectData.areas;
        this.devices = projectData.devices;
        this.spaces = projectData.spaces;
        this.projectInfo = projectData.projectInfo;
        this.functions = projectData.functions;

        // Build manufacturer names map (Id -> Name)
        const manufacturerNames = {};
        for (const [id, name] of masterData.manufacturers) {
            manufacturerNames[id] = name;
        }

        // 3. Load hardware data
        // Find all unique manufacturer IDs from devices
        const manufacturerIds = [...new Set(this.devices.map(d => d.manufacturer).filter(Boolean))];

        const { products, hardware2Programs } = await hardwareLoader.load(
            this.knxProjContents,
            manufacturerIds,
            this.languageCode,
        );

        // 4. Assign device info from hardware data
        for (const device of this.devices) {
            device.manufacturerName = manufacturerNames[device.manufacturer] || "";

            const product = products.get(device.productRef);
            if (!product) {
                continue;
            }
            device.productName = product.text;
            device.hardwareName = product.hardwareName;
            device.orderNumber = product.orderNumber;

            const applicationProgramRef = hardware2Programs.get(device.hardwareProgramRef);
            if (!applicationProgramRef) {
                continue;
            }
            device.applicationProgramRef = applicationProgramRef;

            // Resolve ComObjectInstanceRef IDs
            for (const coRef of device.comObjectInstanceRefs) {
                resolveComObjectRefId(coRef, applicationProgramRef, this.knxProjContents);
            }

            // Complete module instance argument ref IDs
            for (const mi of device.moduleInstances) {
                completeModuleArgumentsRefId(mi, applicationProgramRef);
            }
        }

        // 5. Group devices by application program, parse each once
        const applicationProgramFiles = getApplicationProgramFilesForDevices(this.devices);
        const applications = new Map();

        for (const [xmlFile, devicesForApp] of applicationProgramFiles) {
            const usedRefIds = collectUsedComObjectRefIds(devicesForApp);
            const appProgram = await applicationLoader.load(
                this.knxProjContents,
                usedRefIds,
                xmlFile,
                this.languageCode,
            );
            applications.set(xmlFile, appProgram);
        }

        // 6. Merge application program info into devices
        for (const device of this.devices) {
            if (!device.applicationProgramRef) {
                continue;
            }
            const xmlFile = applicationProgramXml(device);
            const application = applications.get(xmlFile);
            if (!application) {
                continue;
            }
            mergeDeviceApplicationProgramInfo(device, application);
        }
    }

    /**
     * Sort loaded structures. XML content is sorted by creation time,
     * not by address.
     */
    _sort() {
        // Sort spaces recursively
        function recursiveSortSpaces(spaces) {
            for (const space of spaces) {
                space.devices.sort((a, b) => {
                    const aParts = a.split(".").map(Number);
                    const bParts = b.split(".").map(Number);
                    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                        const diff = (aParts[i] || 0) - (bParts[i] || 0);
                        if (diff !== 0) {
                            return diff;
                        }
                    }
                    return 0;
                });
                recursiveSortSpaces(space.spaces || []);
            }
        }
        recursiveSortSpaces(this.spaces);

        // Sort group addresses by raw address
        this.groupAddresses.sort((a, b) => a.rawAddress - b.rawAddress);

        // Sort group ranges recursively
        function recursiveSortGroupRanges(groupRanges) {
            for (const gr of groupRanges) {
                recursiveSortGroupRanges(gr.groupRanges || []);
            }
            groupRanges.sort((a, b) => a.rangeStart - b.rangeStart);
        }
        recursiveSortGroupRanges(this.groupRanges);

        // Sort topology
        for (const area of this.areas) {
            for (const line of area.lines) {
                line.devices.sort((a, b) => a.address - b.address);
            }
            area.lines.sort((a, b) => a.address - b.address);
        }
        this.areas.sort((a, b) => a.address - b.address);

        // Sort devices
        this.devices.sort((a, b) => {
            if (a.areaAddress !== b.areaAddress) {
                return a.areaAddress - b.areaAddress;
            }
            if (a.lineAddress !== b.lineAddress) {
                return a.lineAddress - b.lineAddress;
            }
            return a.address - b.address;
        });
    }

    /**
     * Transform internal models to the KNXProject output format.
     *
     * @returns {object}
     */
    _transform() {
        // Build GA identifier -> address map
        const gaIdToAddress = {};
        for (const ga of this.groupAddresses) {
            gaIdToAddress[ga.identifier] = ga.address;
        }

        // Build communication objects and devices
        const communicationObjects = {};
        const devicesDict = {};

        for (const device of this.devices) {
            const deviceComObjects = [];

            for (const coInstance of device.comObjectInstanceRefs) {
                if (!coInstance.links || coInstance.links.length === 0) {
                    continue;
                }

                // Resolve links to GA addresses, filtering to existing GAs
                const groupAddressLinks = [];
                for (const link of coInstance.links) {
                    const addr = gaIdToAddress[link];
                    if (addr) {
                        groupAddressLinks.push(addr);
                    }
                }
                if (groupAddressLinks.length === 0) {
                    // Skip orphaned ComObjectInstanceRef pointing only to non-existent GAs
                    continue;
                }

                const comObjectKey = `${device.individualAddress}/${coInstance.refId}`;
                communicationObjects[comObjectKey] = {
                    name: coInstance.name || "",
                    number: coInstance.number != null ? coInstance.number : 0,
                    text: coInstance.text || "",
                    function_text: coInstance.functionText || "",
                    description: coInstance.description || "",
                    device_address: device.individualAddress,
                    device_application: device.applicationProgramRef || null,
                    module_def: coInstance.module || null,
                    channel: coInstance.channel || null,
                    dpts: coInstance.datapointTypes || [],
                    object_size: coInstance.objectSize || "",
                    group_address_links: groupAddressLinks,
                    flags: {
                        read: coInstance.readFlag === true,
                        write: coInstance.writeFlag === true,
                        communication: coInstance.communicationFlag === true,
                        transmit: coInstance.transmitFlag === true,
                        update: coInstance.updateFlag === true,
                        read_on_init: coInstance.readOnInitFlag === true,
                    },
                };
                deviceComObjects.push(comObjectKey);
            }

            // Build channels
            const channels = {};
            for (const channel of device.channels) {
                channels[channel.refId] = {
                    identifier: channel.refId,
                    name: channel.name || "",
                    communication_object_ids: (channel.groupObjectInstances || []).map(
                        goId => `${device.individualAddress}/${goId}`,
                    ),
                };
            }

            devicesDict[device.individualAddress] = {
                name: device.name || device.productName || "",
                hardware_name: device.productName || "",
                order_number: device.orderNumber || "",
                description: device.description || "",
                manufacturer_name: device.manufacturerName || "",
                individual_address: device.individualAddress,
                application: device.applicationProgramRef || null,
                project_uid: device.projectUid != null ? device.projectUid : null,
                communication_object_ids: deviceComObjects,
                channels: channels,
            };
        }

        // Build topology
        const topologyDict = {};
        for (const area of this.areas) {
            const linesDict = {};
            for (const line of area.lines) {
                const lineDevices = line.devices.map(d => d.individualAddress);
                linesDict[String(line.address)] = {
                    name: line.name || "",
                    medium_type: MEDIUM_TYPES[line.mediumType] || "Unknown",
                    description: line.description || null,
                    devices: lineDevices,
                };
            }
            topologyDict[String(area.address)] = {
                name: area.name || "",
                description: area.description || null,
                lines: linesDict,
            };
        }

        // Build group addresses with reverse-linked communication_object_ids
        const groupAddressDict = {};
        for (const ga of this.groupAddresses) {
            // Find all COs linked to this GA
            const coIds = [];
            for (const [coId, co] of Object.entries(communicationObjects)) {
                if (co.group_address_links.includes(ga.address)) {
                    coIds.push(coId);
                }
            }

            groupAddressDict[ga.address] = {
                name: ga.name || "",
                identifier: ga.identifier || "",
                raw_address: ga.rawAddress,
                address: ga.address,
                project_uid: ga.projectUid != null ? ga.projectUid : null,
                dpt: ga.dpt || null,
                data_secure: Boolean(ga.dataSecureKey),
                communication_object_ids: coIds,
                description: ga.description || "",
                comment: htmlUnescape(stripRtf(ga.comment || "")),
            };
        }

        // Build group ranges
        const groupRangeDict = recursiveConvertGroupRanges(this.groupRanges, this.projectInfo.groupAddressStyle);

        // Build locations (spaces)
        const spaceDict = recursiveConvertSpaces(this.spaces);

        // Build functions
        const functionsDict = {};
        for (const func of this.functions) {
            functionsDict[func.identifier] = convertFunction(func);
        }

        // Build info
        const info = {
            project_id: this.projectInfo.projectId || "",
            name: this.projectInfo.name || "",
            last_modified: this.projectInfo.lastModified || null,
            group_address_style: this.projectInfo.groupAddressStyle || "ThreeLevel",
            guid: this.projectInfo.guid || null,
            created_by: this.projectInfo.createdBy || "",
            schema_version: this.projectInfo.schemaVersion || "",
            tool_version: this.projectInfo.toolVersion || "",
            xknxproject_version: XKNXPROJECT_VERSION,
            language_code: this.languageCode || null,
        };

        return {
            info,
            communication_objects: communicationObjects,
            topology: topologyDict,
            devices: devicesDict,
            group_addresses: groupAddressDict,
            group_ranges: groupRangeDict,
            locations: spaceDict,
            functions: functionsDict,
        };
    }
}

module.exports = { Parser };
