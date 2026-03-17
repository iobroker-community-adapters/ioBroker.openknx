/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * Port of xknxproject/loader/application_program_loader.py
 * Parses M-xxxx/<application_program>.xml files to extract ComObjects,
 * ComObjectRefs, Allocators, ModuleDef Arguments, Channels, and Translations.
 */

"use strict";

const { DOMParser } = require("@xmldom/xmldom");
const { parseDptTypes, parseXmlFlag } = require("./util");

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
 * Parse a ComObject element.
 *
 * @param {Element} elem
 * @returns {object} ComObject
 */
function parseComObject(elem) {
    const identifier = elem.getAttribute("Id");
    return {
        identifier,
        name: elem.getAttribute("Name") || "",
        text: elem.getAttribute("Text") || "",
        number: parseInt(elem.getAttribute("Number") || "0", 10),
        functionText: elem.getAttribute("FunctionText") || "",
        objectSize: elem.getAttribute("ObjectSize") || "",
        readFlag: parseXmlFlag(elem.getAttribute("ReadFlag"), false),
        writeFlag: parseXmlFlag(elem.getAttribute("WriteFlag"), false),
        communicationFlag: parseXmlFlag(elem.getAttribute("CommunicationFlag"), false),
        transmitFlag: parseXmlFlag(elem.getAttribute("TransmitFlag"), false),
        updateFlag: parseXmlFlag(elem.getAttribute("UpdateFlag"), false),
        readOnInitFlag: parseXmlFlag(elem.getAttribute("ReadOnInitFlag"), false),
        datapointTypes: parseDptTypes(elem.getAttribute("DatapointType")),
        baseNumberArgumentRef: elem.getAttribute("BaseNumber") || null,
    };
}

/**
 * Parse a ComObjectRef element.
 *
 * @param {Element} elem
 * @returns {object} ComObjectRef
 */
function parseComObjectRef(elem) {
    const identifier = elem.getAttribute("Id");
    return {
        identifier,
        refId: elem.getAttribute("RefId") || "",
        name: elem.getAttribute("Name") || null,
        text: elem.getAttribute("Text") || null,
        functionText: elem.getAttribute("FunctionText") || null,
        objectSize: elem.getAttribute("ObjectSize") || null,
        readFlag: parseXmlFlag(elem.getAttribute("ReadFlag"), null),
        writeFlag: parseXmlFlag(elem.getAttribute("WriteFlag"), null),
        communicationFlag: parseXmlFlag(elem.getAttribute("CommunicationFlag"), null),
        transmitFlag: parseXmlFlag(elem.getAttribute("TransmitFlag"), null),
        updateFlag: parseXmlFlag(elem.getAttribute("UpdateFlag"), null),
        readOnInitFlag: parseXmlFlag(elem.getAttribute("ReadOnInitFlag"), null),
        datapointTypes: parseDptTypes(elem.getAttribute("DatapointType")),
        textParameterRefId: elem.getAttribute("TextParameterRefId") || null,
    };
}

/**
 * Apply translations to translatable objects (ComObjects, ComObjectRefs, Channels).
 * Modifies objects in place.
 *
 * @param {object} objectMap - { [id]: object }
 * @param {object} translationMap - { [refId]: { [attributeName]: text } }
 */
function applyTranslations(objectMap, translationMap) {
    for (const identifier of Object.keys(objectMap)) {
        const translation = translationMap[identifier];
        if (!translation) {
            continue;
        }
        const obj = objectMap[identifier];
        if (translation.Text) {
            obj.text = translation.Text;
        }
        if (obj.functionText !== undefined && translation.FunctionText) {
            obj.functionText = translation.FunctionText;
        }
    }
}

/**
 * Parse translations from the Languages section of the XML document.
 *
 * @param {Document} doc - Parsed XML document
 * @param {object} comObjects
 * @param {object} comObjectRefs
 * @param {Set<string>} usedComObjectRefIds
 * @param {object} channels
 * @param {string} languageCode
 */
function parseTranslations(doc, comObjects, comObjectRefs, usedComObjectRefIds, channels, languageCode) {
    // Build set of IDs we need translations for
    const usedComObjectIds = new Set();
    for (const ref of Object.values(comObjectRefs)) {
        usedComObjectIds.add(ref.refId);
    }
    const usedTranslationIds = new Set([...usedComObjectIds, ...usedComObjectRefIds, ...Object.keys(channels)]);

    // translationMap: { refId: { attributeName: text } }
    const translationMap = {};

    // Find the Language element matching our languageCode
    const languageNodes = byTagNS(doc, "Language");
    let targetLanguageNode = null;
    for (const langNode of languageNodes) {
        if (langNode.getAttribute && langNode.getAttribute("Identifier") === languageCode) {
            targetLanguageNode = langNode;
            break;
        }
    }

    if (!targetLanguageNode) {
        return;
    }

    // Find TranslationElement descendants within this Language node
    const translationElements = byTagNS(targetLanguageNode, "TranslationElement");

    for (const transElem of translationElements) {
        const refId = transElem.getAttribute("RefId");
        if (!refId || !usedTranslationIds.has(refId)) {
            continue;
        }

        // Find Translation direct children
        const translations = childrenByTag(transElem, "Translation");

        for (const trans of translations) {
            const attributeName = trans.getAttribute("AttributeName");
            const text = trans.getAttribute("Text");
            if (attributeName && text) {
                if (!translationMap[refId]) {
                    translationMap[refId] = {};
                }
                translationMap[refId][attributeName] = text;
            }
        }
    }

    applyTranslations(comObjectRefs, translationMap);
    applyTranslations(comObjects, translationMap);
    applyTranslations(channels, translationMap);
}

/**
 * Load application program data from an XML file inside the KNX project archive.
 *
 * @param {import('./extractor').KNXProjContents} knxProjContents
 * @param {Set<string>} usedComObjectRefIds - Only load ComObjectRefs with these IDs
 * @param {string} applicationProgramXmlPath - Path like "M-0083/M-0083_A-00B0-32-0DFC.xml"
 * @param {string} languageCode
 * @returns {Promise<object>} ApplicationProgram
 */
async function load(knxProjContents, usedComObjectRefIds, applicationProgramXmlPath, languageCode) {
    let xmlContent = await knxProjContents.readFile(applicationProgramXmlPath);

    const comObjects = {}; // { Id: ComObject }
    const comObjectRefs = {}; // { Id: ComObjectRef }
    const allocators = {}; // { Id: Allocator }
    const moduleDefArguments = {}; // { Id: { name, allocates } }
    const numericArgs = {}; // { RefId: { allocatorRefId, value, baseValue } }
    const channels = {}; // { Id: ApplicationProgramChannel }

    // Strip BOM if present - @xmldom/xmldom fails if BOM precedes <?xml declaration
    if (xmlContent.charCodeAt(0) === 0xfeff) {
        xmlContent = xmlContent.slice(1);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, "text/xml");

    // --- ComObject elements ---
    const comObjectNodes = byTagNS(doc, "ComObject");
    for (const elem of comObjectNodes) {
        const co = parseComObject(elem);
        comObjects[co.identifier] = co;
    }

    // --- ComObjectRef elements (filtered to usedComObjectRefIds) ---
    const comObjectRefNodes = byTagNS(doc, "ComObjectRef");
    for (const elem of comObjectRefNodes) {
        const id = elem.getAttribute("Id");
        if (usedComObjectRefIds.has(id)) {
            const cor = parseComObjectRef(elem);
            comObjectRefs[id] = cor;
        }
    }

    // --- Allocator elements ---
    const allocatorNodes = byTagNS(doc, "Allocator");
    for (const elem of allocatorNodes) {
        const id = elem.getAttribute("Id");
        allocators[id] = {
            identifier: id,
            name: elem.getAttribute("Name") || "",
            start: parseInt(elem.getAttribute("Start") || "0", 10),
            end: parseInt(elem.getAttribute("maxInclusive") || "0", 10),
        };
    }

    // --- ModuleDef Arguments ---
    // Find all Argument elements that are descendants of ModuleDef elements
    const moduleDefNodes = byTagNS(doc, "ModuleDef");
    for (const modDef of moduleDefNodes) {
        const argumentNodes = byTagNS(modDef, "Argument");
        for (const elem of argumentNodes) {
            const id = elem.getAttribute("Id");
            const allocatesAttr = elem.getAttribute("Allocates");
            moduleDefArguments[id] = {
                name: elem.getAttribute("Name") || "",
                allocates: allocatesAttr != null ? parseInt(allocatesAttr, 10) : null,
            };
        }
    }

    // --- NumericArg elements (from ModuleDef choose/dynamic blocks) ---
    const numericArgNodes = byTagNS(doc, "NumericArg");
    for (const elem of numericArgNodes) {
        const refId = elem.getAttribute("RefId");
        if (refId) {
            const valueAttr = elem.getAttribute("Value");
            numericArgs[refId] = {
                allocatorRefId: elem.getAttribute("AllocatorRefId") || null,
                value: valueAttr != null ? parseInt(valueAttr, 10) : null,
                baseValue: elem.getAttribute("BaseValue") || null,
            };
        }
    }

    // --- Channel elements ---
    const channelNodes = byTagNS(doc, "Channel");
    for (const elem of channelNodes) {
        const id = elem.getAttribute("Id");
        if (id) {
            channels[id] = {
                identifier: id,
                name: elem.getAttribute("Name") || "",
                number: elem.getAttribute("Number") || "",
                text: elem.getAttribute("Text") || null,
                textParameterRefId: elem.getAttribute("TextParameterRefId") || null,
            };
        }
    }

    // --- Translations ---
    if (languageCode) {
        parseTranslations(doc, comObjects, comObjectRefs, usedComObjectRefIds, channels, languageCode);
    }

    return {
        comObjects,
        comObjectRefs,
        allocators,
        moduleDefArguments,
        numericArgs,
        channels,
    };
}

module.exports = {
    load,
};
