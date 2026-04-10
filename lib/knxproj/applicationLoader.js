/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * Port of xknxproject/loader/application_program_loader.py
 * Parses M-xxxx/<application_program>.xml files to extract ComObjects,
 * ComObjectRefs, Allocators, ModuleDef Arguments, Channels, and Translations.
 *
 * Uses SAX streaming parser instead of DOM to handle very large XMLs (100+ MB)
 * without excessive memory consumption.
 */

"use strict";

const sax = require("sax");
const { parseDptTypes, parseXmlFlag } = require("./util");

/**
 * Strip namespace prefix from a tag name: "knx:ComObject" -> "ComObject"
 */
function localName(name) {
    const i = name.indexOf(":");
    return i >= 0 ? name.substring(i + 1) : name;
}

/**
 * Apply translations to translatable objects (ComObjects, ComObjectRefs, Channels).
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
 * Load application program data from an XML file using SAX streaming.
 *
 * @param {import('./extractor').KNXProjContents} knxProjContents
 * @param {Set<string>} usedComObjectRefIds - Only load ComObjectRefs with these IDs
 * @param {string} applicationProgramXmlPath
 * @param {string} languageCode
 * @returns {Promise<object>} ApplicationProgram
 */
async function load(knxProjContents, usedComObjectRefIds, applicationProgramXmlPath, languageCode) {
    let xmlContent = await knxProjContents.readFile(applicationProgramXmlPath);

    // Strip BOM if present
    if (xmlContent.charCodeAt(0) === 0xfeff) {
        xmlContent = xmlContent.slice(1);
    }

    const comObjects = {};
    const comObjectRefs = {};
    const allocators = {};
    const moduleDefArguments = {};
    const numericArgs = {};
    const channels = {};

    // Translation state
    const usedTranslationIds = new Set();
    const translationMap = {};
    let inTargetLanguage = false;
    let currentTranslationRefId = null;

    // Track parent context for ModuleDef > Argument
    let inModuleDef = false;

    return new Promise((resolve, reject) => {
        const parser = sax.parser(true, { trim: false, xmlns: false });

        parser.onerror = (err) => {
            // sax recovers from most errors, just log
            parser.resume();
        };

        parser.onopentag = (node) => {
            const tag = localName(node.name);
            const a = node.attributes;

            switch (tag) {
                case "ComObject": {
                    const id = a.Id;
                    if (id) {
                        comObjects[id] = {
                            identifier: id,
                            name: a.Name || "",
                            text: a.Text || "",
                            number: parseInt(a.Number || "0", 10),
                            functionText: a.FunctionText || "",
                            objectSize: a.ObjectSize || "",
                            readFlag: parseXmlFlag(a.ReadFlag, false),
                            writeFlag: parseXmlFlag(a.WriteFlag, false),
                            communicationFlag: parseXmlFlag(a.CommunicationFlag, false),
                            transmitFlag: parseXmlFlag(a.TransmitFlag, false),
                            updateFlag: parseXmlFlag(a.UpdateFlag, false),
                            readOnInitFlag: parseXmlFlag(a.ReadOnInitFlag, false),
                            datapointTypes: parseDptTypes(a.DatapointType),
                            baseNumberArgumentRef: a.BaseNumber || null,
                        };
                    }
                    break;
                }
                case "ComObjectRef": {
                    const id = a.Id;
                    if (id && usedComObjectRefIds.has(id)) {
                        comObjectRefs[id] = {
                            identifier: id,
                            refId: a.RefId || "",
                            name: a.Name || null,
                            text: a.Text || null,
                            functionText: a.FunctionText || null,
                            objectSize: a.ObjectSize || null,
                            readFlag: parseXmlFlag(a.ReadFlag, null),
                            writeFlag: parseXmlFlag(a.WriteFlag, null),
                            communicationFlag: parseXmlFlag(a.CommunicationFlag, null),
                            transmitFlag: parseXmlFlag(a.TransmitFlag, null),
                            updateFlag: parseXmlFlag(a.UpdateFlag, null),
                            readOnInitFlag: parseXmlFlag(a.ReadOnInitFlag, null),
                            datapointTypes: parseDptTypes(a.DatapointType),
                            textParameterRefId: a.TextParameterRefId || null,
                        };
                    }
                    break;
                }
                case "Allocator": {
                    const id = a.Id;
                    if (id) {
                        allocators[id] = {
                            identifier: id,
                            name: a.Name || "",
                            start: parseInt(a.Start || "0", 10),
                            end: parseInt(a.maxInclusive || "0", 10),
                        };
                    }
                    break;
                }
                case "ModuleDef":
                    inModuleDef = true;
                    break;
                case "Argument": {
                    if (inModuleDef) {
                        const id = a.Id;
                        if (id) {
                            moduleDefArguments[id] = {
                                name: a.Name || "",
                                allocates: a.Allocates != null ? parseInt(a.Allocates, 10) : null,
                            };
                        }
                    }
                    break;
                }
                case "NumericArg": {
                    const refId = a.RefId;
                    if (refId) {
                        numericArgs[refId] = {
                            allocatorRefId: a.AllocatorRefId || null,
                            value: a.Value != null ? parseInt(a.Value, 10) : null,
                            baseValue: a.BaseValue || null,
                        };
                    }
                    break;
                }
                case "Channel": {
                    const id = a.Id;
                    if (id) {
                        channels[id] = {
                            identifier: id,
                            name: a.Name || "",
                            number: a.Number || "",
                            text: a.Text || null,
                            textParameterRefId: a.TextParameterRefId || null,
                        };
                    }
                    break;
                }
                // Translation handling
                case "Language":
                    if (languageCode && a.Identifier === languageCode) {
                        inTargetLanguage = true;
                    }
                    break;
                case "TranslationElement":
                    if (inTargetLanguage && a.RefId) {
                        currentTranslationRefId = a.RefId;
                    }
                    break;
                case "Translation":
                    if (currentTranslationRefId && a.AttributeName && a.Text) {
                        if (!translationMap[currentTranslationRefId]) {
                            translationMap[currentTranslationRefId] = {};
                        }
                        translationMap[currentTranslationRefId][a.AttributeName] = a.Text;
                    }
                    break;
            }
        };

        parser.onclosetag = (name) => {
            const tag = localName(name);
            if (tag === "ModuleDef") {
                inModuleDef = false;
            } else if (tag === "Language") {
                inTargetLanguage = false;
            } else if (tag === "TranslationElement") {
                currentTranslationRefId = null;
            }
        };

        parser.onend = () => {
            // Build translation IDs from parsed data and apply
            if (languageCode) {
                for (const ref of Object.values(comObjectRefs)) {
                    usedTranslationIds.add(ref.refId);
                }
                for (const id of usedComObjectRefIds) {
                    usedTranslationIds.add(id);
                }
                for (const id of Object.keys(channels)) {
                    usedTranslationIds.add(id);
                }
                applyTranslations(comObjectRefs, translationMap);
                applyTranslations(comObjects, translationMap);
                applyTranslations(channels, translationMap);
            }

            resolve({
                comObjects,
                comObjectRefs,
                allocators,
                moduleDefArguments,
                numericArgs,
                channels,
            });
        };

        parser.write(xmlContent).close();
    });
}

module.exports = {
    load,
};
