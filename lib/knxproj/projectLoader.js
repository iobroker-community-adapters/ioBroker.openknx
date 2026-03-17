/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * JavaScript port of xknxproject/loader/project_loader.py
 * Parses project.xml and 0.xml from the .knxproj archive.
 */

"use strict";

const { DOMParser } = require("@xmldom/xmldom");
const { getDptType, parseDptTypes, parseXmlFlag } = require("./util");

/** Schema version threshold: ETS 5.7+ / ETS6 use Links attribute instead of Connectors children. */
const ETS_5_7_SCHEMA_VERSION = 20;

// ---------------------------------------------------------------------------
// DOM helpers (replace xpath for performance)
// ---------------------------------------------------------------------------

/**
 * Get all descendant elements with a given local name (namespace-agnostic).
 *
 * @param {Node} node
 * @param {string} localName
 * @returns {Element[]}
 */
function byTagNS(node, localName) {
    return Array.from(node.getElementsByTagNameNS("*", localName));
}

/**
 * Get direct child elements with a given local name.
 *
 * @param {Node} node
 * @param {string} localName
 * @returns {Element[]}
 */
function childrenByTag(node, localName) {
    const result = [];
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === 1) {
            const ln = child.localName || child.nodeName.replace(/^.*:/, "");
            if (ln === localName) {
                result.push(child);
            }
        }
    }
    return result;
}

/**
 * Get the first direct child element with a given local name, or null.
 *
 * @param {Node} node
 * @param {string} localName
 * @returns {Element|null}
 */
function firstChildByTag(node, localName) {
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === 1) {
            const ln = child.localName || child.nodeName.replace(/^.*:/, "");
            if (ln === localName) {
                return child;
            }
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Helper: get attribute value from a DOM element, with optional default
// ---------------------------------------------------------------------------
function attr(element, name, defaultValue) {
    const val = element.getAttribute(name);
    if (val == null || val === "") {
        return defaultValue !== undefined ? defaultValue : null;
    }
    return val;
}

// ---------------------------------------------------------------------------
// XMLGroupAddress
// ---------------------------------------------------------------------------
/**
 * @param {string} rawAddress  - integer string e.g. "2048"
 * @param {string} style       - "ThreeLevel" | "TwoLevel" | "Free"
 * @returns {string}
 */
function formatGroupAddress(rawAddress, style) {
    const raw = parseInt(rawAddress, 10);
    if (style === "Free") {
        return String(raw);
    }
    const main = (raw & 0b1111100000000000) >> 11;
    if (style === "ThreeLevel") {
        const middle = (raw & 0b11100000000) >> 8;
        const sub = raw & 0b11111111;
        return `${main}/${middle}/${sub}`;
    }
    if (style === "TwoLevel") {
        const sub = raw & 0b11111111111;
        return `${main}/${sub}`;
    }
    throw new Error(`GroupAddressStyle '${style}' not supported`);
}

// ---------------------------------------------------------------------------
// GroupAddress loader
// ---------------------------------------------------------------------------
function loadGroupAddress(gaElement, groupAddressStyle) {
    const puid = attr(gaElement, "Puid");
    const rawAddress = attr(gaElement, "Address", "");
    const identifier = (attr(gaElement, "Id", "") || "").split("_", 2);
    return {
        name: attr(gaElement, "Name", ""),
        identifier: identifier.length > 1 ? identifier[1] : identifier[0],
        rawAddress: rawAddress !== "" ? parseInt(rawAddress, 10) : 0,
        address: rawAddress !== "" ? formatGroupAddress(rawAddress, groupAddressStyle) : "",
        projectUid: puid ? parseInt(puid, 10) : null,
        description: attr(gaElement, "Description", ""),
        dpt: getDptType(attr(gaElement, "DatapointType")),
        dataSecureKey: attr(gaElement, "Key"),
        comment: attr(gaElement, "Comment", ""),
        style: groupAddressStyle,
    };
}

// ---------------------------------------------------------------------------
// GroupRange loader (recursive)
// ---------------------------------------------------------------------------
function loadGroupRange(rangeElement, groupAddressStyle) {
    // child GroupRange elements
    const childRangeNodes = childrenByTag(rangeElement, "GroupRange");
    const childRanges = childRangeNodes.map(child => loadGroupRange(child, groupAddressStyle));

    // child GroupAddress elements (just the raw integer addresses)
    const gaNodes = childrenByTag(rangeElement, "GroupAddress");
    const gaAddresses = gaNodes.map(ga => parseInt(ga.getAttribute("Address"), 10));

    return {
        name: attr(rangeElement, "Name", ""),
        rangeStart: parseInt(attr(rangeElement, "RangeStart"), 10),
        rangeEnd: parseInt(attr(rangeElement, "RangeEnd"), 10),
        groupAddresses: gaAddresses,
        groupRanges: childRanges,
        comment: attr(rangeElement, "Comment", ""),
        style: groupAddressStyle,
    };
}

// ---------------------------------------------------------------------------
// Topology loader
// ---------------------------------------------------------------------------

/**
 * Get GA links from Connectors/Send and Connectors/Receive children (schema < 20).
 *
 * @param {Element} comObject
 * @returns {string[]}
 */
function getLinksFromSchema1x(comObject) {
    const connector = firstChildByTag(comObject, "Connectors");
    if (!connector) {
        return [];
    }
    const sendNodes = childrenByTag(connector, "Send");
    const receiveNodes = childrenByTag(connector, "Receive");
    const gaNodes = sendNodes.concat(receiveNodes);

    return gaNodes.map(ga => {
        const refId = ga.getAttribute("GroupAddressRefId") || "";
        // Remove the project ID prefix
        const parts = refId.split("_", 2);
        return parts.length > 1 ? parts[1] : parts[0];
    });
}

/**
 * Get GA links from the "Links" attribute (schema >= 20, ETS 5.7+/ETS6).
 *
 * @param {Element} comObject
 * @returns {string[]}
 */
function getLinksFromSchema2x(comObject) {
    const links = comObject.getAttribute("Links");
    if (!links) {
        return [];
    }
    return links.split(/\s+/).filter(Boolean);
}

/**
 * Create a ComObjectInstanceRef from a DOM element.
 *
 * @param {Element} comObject
 * @param {number} schemaVersion
 * @returns {object|null}
 */
function createComObjectInstance(comObject, schemaVersion) {
    const links =
        schemaVersion < ETS_5_7_SCHEMA_VERSION ? getLinksFromSchema1x(comObject) : getLinksFromSchema2x(comObject);

    if (links.length === 0) {
        return null;
    }

    return {
        identifier: attr(comObject, "Id"),
        refId: attr(comObject, "RefId", ""),
        text: attr(comObject, "Text"),
        functionText: attr(comObject, "FunctionText"),
        readFlag: parseXmlFlag(attr(comObject, "ReadFlag")),
        writeFlag: parseXmlFlag(attr(comObject, "WriteFlag")),
        communicationFlag: parseXmlFlag(attr(comObject, "CommunicationFlag")),
        transmitFlag: parseXmlFlag(attr(comObject, "TransmitFlag")),
        updateFlag: parseXmlFlag(attr(comObject, "UpdateFlag")),
        readOnInitFlag: parseXmlFlag(attr(comObject, "ReadOnInitFlag")),
        datapointTypes: parseDptTypes(attr(comObject, "DatapointType")),
        description: attr(comObject, "Description"),
        channel: attr(comObject, "ChannelId"),
        links: links,
        // filled later during application program merge
        applicationProgramIdPrefix: "",
        comObjectRefId: null,
        name: null,
        objectSize: null,
        baseNumberArgumentRef: null,
        number: null,
        module: null,
    };
}

/**
 * Create a ModuleInstance from a DOM element.
 *
 * @param {Element} miElement
 * @returns {object}
 */
function createModuleInstance(miElement) {
    const argsContainer = firstChildByTag(miElement, "Arguments");
    const argNodes = argsContainer ? childrenByTag(argsContainer, "Argument") : [];
    const args = argNodes.map(argEl => ({
        refId: attr(argEl, "RefId", ""),
        value: attr(argEl, "Value", ""),
        name: "",
        allocates: null,
    }));

    return {
        identifier: attr(miElement, "Id", ""),
        refId: attr(miElement, "RefId", ""),
        arguments: args,
    };
}

/**
 * Create a DeviceInstance from a DOM element.
 *
 * @param {Element} deviceElement
 * @param {object} line - XMLLine parent
 * @param {number} schemaVersion
 * @returns {object|null}
 */
function createDevice(deviceElement, line, schemaVersion) {
    const address = attr(deviceElement, "Address");
    // Devices like power supplies usually do not have an individual address
    if (address == null) {
        return null;
    }

    const puid = attr(deviceElement, "Puid");
    const productRef = attr(deviceElement, "ProductRefId", "");
    const addressInt = parseInt(address, 10);

    // Additional addresses
    const additionalAddressContainer = firstChildByTag(deviceElement, "AdditionalAddresses");
    const additionalAddressNodes = additionalAddressContainer
        ? childrenByTag(additionalAddressContainer, "Address")
        : [];
    const additionalAddresses = [];
    for (const addrElem of additionalAddressNodes) {
        const addAddr = attr(addrElem, "Address");
        if (addAddr != null) {
            additionalAddresses.push(addAddr);
        }
    }

    // ComObjectInstanceRefs
    const comObjContainer = firstChildByTag(deviceElement, "ComObjectInstanceRefs");
    const comObjNodes = comObjContainer ? childrenByTag(comObjContainer, "ComObjectInstanceRef") : [];
    const comObjectInstanceRefs = [];
    for (const elem of comObjNodes) {
        const ref = createComObjectInstance(elem, schemaVersion);
        if (ref) {
            comObjectInstanceRefs.push(ref);
        }
    }

    // ModuleInstances
    const miContainer = firstChildByTag(deviceElement, "ModuleInstances");
    const miNodes = miContainer ? childrenByTag(miContainer, "ModuleInstance") : [];
    const moduleInstances = [];
    for (const miElem of miNodes) {
        const mi = createModuleInstance(miElem);
        if (mi) {
            moduleInstances.push(mi);
        }
    }

    // Channels from GroupObjectTree
    const channels = [];
    const goTree = byTagNS(deviceElement, "GroupObjectTree");
    if (goTree.length > 0) {
        const nodeElems = byTagNS(goTree[0], "Node");
        for (const chNode of nodeElems) {
            if (chNode.getAttribute("Type") !== "Channel") {
                continue;
            }
            const gos = attr(chNode, "GroupObjectInstances");
            if (!gos) {
                continue;
            }
            channels.push({
                refId: attr(chNode, "RefId", ""),
                name: attr(chNode, "Text", ""),
                groupObjectInstances: gos.split(/\s+/).filter(Boolean),
            });
        }
    }

    // ParameterInstanceRefs
    const paramContainer = firstChildByTag(deviceElement, "ParameterInstanceRefs");
    const paramNodes = paramContainer ? childrenByTag(paramContainer, "ParameterInstanceRef") : [];
    const parameterInstanceRefs = {};
    for (const pNode of paramNodes) {
        const prRefId = attr(pNode, "RefId", "");
        parameterInstanceRefs[prRefId] = {
            refId: prRefId,
            value: attr(pNode, "Value"),
        };
    }

    const individualAddress = `${line.area.address}.${line.address}.${addressInt}`;

    return {
        identifier: attr(deviceElement, "Id", ""),
        address: addressInt,
        projectUid: puid ? parseInt(puid, 10) : null,
        name: attr(deviceElement, "Name", ""),
        description: attr(deviceElement, "Description", ""),
        lastModified: attr(deviceElement, "LastModified", ""),
        productRef: productRef,
        hardwareProgramRef: attr(deviceElement, "Hardware2ProgramRefId", ""),
        line: line,
        areaAddress: line.area.address,
        lineAddress: line.address,
        manufacturer: productRef ? productRef.split("_", 2)[0] : "",
        individualAddress: individualAddress,
        additionalAddresses: additionalAddresses,
        channels: channels,
        comObjectInstanceRefs: comObjectInstanceRefs,
        moduleInstances: moduleInstances,
        parameterInstanceRefs: parameterInstanceRefs,
        // filled later
        applicationProgramRef: null,
        productName: "",
        hardwareName: "",
        orderNumber: "",
        manufacturerName: "",
        comObjects: [],
    };
}

/**
 * Create an XMLLine from a DOM element.
 *
 * @param {Element} lineElement
 * @param {object} area - XMLArea parent
 * @param {number} schemaVersion
 * @returns {object}
 */
function createLine(lineElement, area, schemaVersion) {
    const address = parseInt(attr(lineElement, "Address", "0"), 10);
    const name = attr(lineElement, "Name", "");
    const description = attr(lineElement, "Description");

    // ETS6 (schema 21+) adds "Segment" tags between "Line" and "DeviceInstance"
    const segments = childrenByTag(lineElement, "Segment");
    let mediumType;
    if (segments.length > 0) {
        mediumType = attr(segments[0], "MediumTypeRefId", "");
    } else {
        mediumType = attr(lineElement, "MediumTypeRefId", "");
    }

    const line = {
        address: address,
        description: description,
        name: name,
        mediumType: mediumType,
        devices: [],
        area: area,
    };

    // Find all DeviceInstance elements (also under Segment)
    const deviceNodes = byTagNS(lineElement, "DeviceInstance");
    for (const devElem of deviceNodes) {
        const device = createDevice(devElem, line, schemaVersion);
        if (device) {
            line.devices.push(device);
        }
    }

    return line;
}

/**
 * Create an XMLArea from a DOM element.
 *
 * @param {Element} areaElement
 * @param {number} schemaVersion
 * @returns {object}
 */
function createArea(areaElement, schemaVersion) {
    const address = parseInt(attr(areaElement, "Address", "0"), 10);
    const name = attr(areaElement, "Name", "");
    const description = attr(areaElement, "Description");

    const area = {
        address: address,
        name: name,
        description: description,
        lines: [],
    };

    // All direct child elements are Line elements
    const lineNodes = childrenByTag(areaElement, "Line");
    for (const lineEl of lineNodes) {
        area.lines.push(createLine(lineEl, area, schemaVersion));
    }

    return area;
}

/**
 * Load topology from a Topology XML element.
 *
 * @param {Element} topologyElement
 * @param {number} schemaVersion
 * @returns {object[]} array of XMLArea
 */
function loadTopology(topologyElement, schemaVersion) {
    const areaNodes = childrenByTag(topologyElement, "Area");
    return areaNodes.map(areaEl => createArea(areaEl, schemaVersion));
}

// ---------------------------------------------------------------------------
// Location / Building loader
// ---------------------------------------------------------------------------

/**
 * Parse a Space/BuildingPart element recursively.
 *
 * @param {Element} node
 * @param {string} elementName - "Space" (ETS5/6) or "BuildingPart" (ETS4)
 * @param {Map<string,string>} deviceIdMap - maps device identifier to individual address
 * @param {object} knxMasterData
 * @param {object[]} functionsList - mutable list; functions are appended here
 * @returns {object}
 */
function parseSpace(node, elementName, deviceIdMap, knxMasterData, functionsList) {
    const usageId = attr(node, "Usage");
    let usageText = "";
    if (usageId && knxMasterData) {
        // Try translations first, then fall back to spaceUsages map
        if (knxMasterData.translations && knxMasterData.translations.has(usageId)) {
            const transMap = knxMasterData.translations.get(usageId);
            usageText = (transMap && transMap.get("Text")) || "";
        }
        if (!usageText && knxMasterData.spaceUsages) {
            usageText = knxMasterData.spaceUsages.get(usageId) || "";
        }
    }

    const puid = attr(node, "Puid");
    const identifier = attr(node, "Id", "");
    const space = {
        identifier: identifier,
        name: attr(node, "Name", ""),
        spaceType: attr(node, "Type", ""),
        usageId: usageId,
        usageText: usageText,
        number: attr(node, "Number", ""),
        description: attr(node, "Description", ""),
        projectUid: puid ? parseInt(puid, 10) : null,
        spaces: [],
        devices: [],
        functions: [],
    };

    // Iterate child elements
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType !== 1) {
            continue; // skip non-element nodes
        }
        const localName = child.localName || child.nodeName.replace(/^.*:/, "");

        if (localName === elementName) {
            // Recursive sub-space
            space.spaces.push(parseSpace(child, elementName, deviceIdMap, knxMasterData, functionsList));
        } else if (localName === "DeviceInstanceRef") {
            const refId = attr(child, "RefId", "");
            const individualAddress = deviceIdMap.get(refId);
            if (individualAddress) {
                space.devices.push(individualAddress);
            }
        } else if (localName === "Function") {
            const func = parseFunction(child, knxMasterData);
            func.spaceId = space.identifier;
            functionsList.push(func);
            space.functions.push(func.identifier);
        }
    }

    return space;
}

/**
 * Parse a Function element.
 *
 * @param {Element} node
 * @param {object} knxMasterData
 * @returns {object}
 */
function parseFunction(node, knxMasterData) {
    const fullId = attr(node, "Id", "");
    const parts = fullId.split("_", 2);
    const identifier = parts.length > 1 ? parts[1] : parts[0];
    const puid = attr(node, "Puid");
    const functionType = attr(node, "Type", "");

    const func = {
        identifier: identifier,
        name: attr(node, "Name", ""),
        functionType: functionType,
        projectUid: puid ? parseInt(puid, 10) : null,
        groupAddresses: [],
        usageText: "",
        spaceId: "",
    };

    // Resolve usage text from knxMasterData
    if (functionType && knxMasterData) {
        if (knxMasterData.translations && knxMasterData.translations.has(functionType)) {
            const transMap = knxMasterData.translations.get(functionType);
            func.usageText = (transMap && transMap.get("Text")) || "";
        }
        if (!func.usageText && knxMasterData.functionTypes) {
            func.usageText = knxMasterData.functionTypes.get(functionType) || "";
        }
    }

    // Parse child GroupAddressRef elements
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType !== 1) {
            continue;
        }
        const localName = child.localName || child.nodeName.replace(/^.*:/, "");
        if (localName === "GroupAddressRef") {
            const gaRefPuid = attr(child, "Puid");
            const gaRefFullId = attr(child, "RefId", "");
            const gaRefParts = gaRefFullId.split("_", 2);
            const gaRefId = gaRefParts.length > 1 ? gaRefParts[1] : gaRefParts[0];

            func.groupAddresses.push({
                refId: gaRefId,
                identifier: attr(child, "Id", ""),
                name: attr(child, "Name", ""),
                role: attr(child, "Role", ""),
                projectUid: gaRefPuid ? parseInt(gaRefPuid, 10) : null,
                address: "", // resolved later
            });
        }
    }

    return func;
}

// ---------------------------------------------------------------------------
// Project info loader (from project.xml)
// ---------------------------------------------------------------------------

/**
 * Parse project information from project.xml content.
 *
 * @param {string} xmlString - raw XML of project.xml
 * @returns {object}
 */
function loadProjectInfo(xmlString) {
    // Strip BOM if present
    if (xmlString.charCodeAt(0) === 0xfeff) {
        xmlString = xmlString.slice(1);
    }

    const doc = new DOMParser().parseFromString(xmlString, "text/xml");
    const root = doc.documentElement;

    // Extract schema version from namespace: xmlns="http://knx.org/xml/project/20"
    let schemaVersion = "";
    if (root && root.tagName) {
        const nsMatch = (root.getAttribute("xmlns") || "").match(/\/project\/(.+)$/);
        if (nsMatch) {
            schemaVersion = nsMatch[1];
        }
    }
    const createdBy = (root && root.getAttribute("CreatedBy")) || "";
    const toolVersion = (root && root.getAttribute("ToolVersion")) || "";

    // Find Project element
    const projectNodes = byTagNS(doc, "Project");
    if (projectNodes.length === 0) {
        return {
            projectId: "",
            name: "",
            lastModified: null,
            groupAddressStyle: "ThreeLevel",
            guid: "",
            createdBy: createdBy,
            schemaVersion: schemaVersion,
            toolVersion: toolVersion,
        };
    }
    const projectNode = projectNodes[0];
    const projectId = attr(projectNode, "Id", "");

    const infoNodes = childrenByTag(projectNode, "ProjectInformation");
    if (infoNodes.length === 0) {
        return {
            projectId: projectId,
            name: "",
            lastModified: null,
            groupAddressStyle: "ThreeLevel",
            guid: "",
            createdBy: createdBy,
            schemaVersion: schemaVersion,
            toolVersion: toolVersion,
        };
    }
    const infoNode = infoNodes[0];

    return {
        projectId: projectId,
        name: attr(infoNode, "Name", ""),
        lastModified: attr(infoNode, "LastModified"),
        groupAddressStyle: attr(infoNode, "GroupAddressStyle", "ThreeLevel"),
        guid: attr(infoNode, "Guid") || null,
        createdBy: createdBy,
        schemaVersion: schemaVersion,
        toolVersion: toolVersion,
    };
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

/**
 * Load all project data from a KNXProjContents instance.
 *
 * @param {object} knxProjContents - KNXProjContents instance from extractor
 * @param {object} knxMasterData - parsed master data (from knxMasterLoader)
 *   with { manufacturers, spaceUsages, functionTypes, translations } Maps
 * @returns {Promise<{groupAddresses: object[], groupRanges: object[], areas: object[], devices: object[], spaces: object[], projectInfo: object, functions: object[]}>}
 */
async function load(knxProjContents, knxMasterData) {
    const areas = [];
    const devices = [];
    const groupAddresses = [];
    const groupRanges = [];
    const spaces = [];
    const functions = [];

    // --- Parse project.xml for ProjectInformation ---
    const projectMetaXml = await knxProjContents.openProjectMeta();
    const projectInfo = loadProjectInfo(projectMetaXml);
    const groupAddressStyle = projectInfo.groupAddressStyle;

    // --- Parse 0.xml ---
    let project0Xml = await knxProjContents.openProject0();
    // Strip BOM if present
    if (project0Xml.charCodeAt(0) === 0xfeff) {
        project0Xml = project0Xml.slice(1);
    }
    const doc = new DOMParser().parseFromString(project0Xml, "text/xml");

    // --- Navigate to Installation element ---
    // Path: Project > Installations > Installation
    const projectNodes = byTagNS(doc, "Project");
    if (projectNodes.length === 0) {
        return { groupAddresses, groupRanges, areas, devices, spaces, projectInfo, functions };
    }
    const installationsNode = firstChildByTag(projectNodes[0], "Installations");
    if (!installationsNode) {
        return { groupAddresses, groupRanges, areas, devices, spaces, projectInfo, functions };
    }
    const installationNodes = childrenByTag(installationsNode, "Installation");

    for (const installation of installationNodes) {
        // --- GroupAddresses ---
        const gaContainer = firstChildByTag(installation, "GroupAddresses");
        if (gaContainer) {
            // All GroupAddress descendants (under any GroupRange nesting)
            const gaNodes = byTagNS(gaContainer, "GroupAddress");
            for (const gaEl of gaNodes) {
                groupAddresses.push(loadGroupAddress(gaEl, groupAddressStyle));
            }

            // Top-level GroupRanges only (recursive internally)
            const grContainer = firstChildByTag(gaContainer, "GroupRanges");
            if (grContainer) {
                const grNodes = childrenByTag(grContainer, "GroupRange");
                for (const grEl of grNodes) {
                    groupRanges.push(loadGroupRange(grEl, groupAddressStyle));
                }
            }
        }

        // --- Topology ---
        const topoNode = firstChildByTag(installation, "Topology");
        if (topoNode) {
            const loadedAreas = loadTopology(topoNode, knxProjContents.schemaVersion);
            areas.push(...loadedAreas);
        }

        // Collect all devices from areas -> lines -> devices
        for (const area of areas) {
            for (const line of area.lines) {
                devices.push(...line.devices);
            }
        }

        // --- Locations / Buildings ---
        const isEts4 = knxProjContents.isEts4Project();
        const containerTag = isEts4 ? "Buildings" : "Locations";
        const elementName = isEts4 ? "BuildingPart" : "Space";

        // Build device identifier -> individual address map
        const deviceIdMap = new Map();
        for (const device of devices) {
            deviceIdMap.set(device.identifier, device.individualAddress);
        }

        const locContainer = firstChildByTag(installation, containerTag);
        if (locContainer) {
            const childSpaceNodes = childrenByTag(locContainer, elementName);
            for (const spaceEl of childSpaceNodes) {
                spaces.push(parseSpace(spaceEl, elementName, deviceIdMap, knxMasterData, functions));
            }
        }
    }

    // --- Resolve function group address references ---
    for (const func of functions) {
        for (const gaRef of func.groupAddresses) {
            const matchingGa = groupAddresses.find(ga => ga.identifier === gaRef.refId);
            if (matchingGa) {
                gaRef.address = matchingGa.address;
            }
            // If not found, leave address as "" (non-fatal; the Python version throws)
        }
    }

    return {
        groupAddresses,
        groupRanges,
        areas,
        devices,
        spaces,
        projectInfo,
        functions,
    };
}

module.exports = {
    load,
    loadProjectInfo,
    formatGroupAddress,
    ETS_5_7_SCHEMA_VERSION,
};
