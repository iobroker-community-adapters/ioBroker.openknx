/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * JavaScript port of xknxproject/loader/knx_master_loader.py
 * Parses the knx_master.xml file from a .knxproj archive.
 */

"use strict";

const { DOMParser } = require("@xmldom/xmldom");

/**
 * Hardcoded product languages for ETS4 projects (schema version <= 11).
 * ETS4 does not include ProductLanguages in knx_master.xml.
 */
const ETS4_PRODUCT_LANGUAGES = [
    "cs-CZ",
    "da-DK",
    "de-DE",
    "el-GR",
    "en-US",
    "es-ES",
    "fi-FI",
    "fr-FR",
    "hu-HU",
    "is-IS",
    "it-IT",
    "ja-JP",
    "nb-NO",
    "nl-NL",
    "pl-PL",
    "pt-PT",
    "ro-RO",
    "ru-RU",
    "sk-SK",
    "sl-SI",
    "sv-SE",
    "tr-TR",
    "uk-UA",
    "zh-CN",
];

const ETS_4_2_SCHEMA_VERSION = 11;

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
 * Infer the full language code (e.g. "de-DE") from a partial language string
 * (e.g. "De", "de", "de-DE") and the list of available product languages.
 *
 * @param {string} language - The language hint (partial or full).
 * @param {string[]} productLanguages - Available product language codes (e.g. ["en-US", "de-DE"]).
 * @returns {string|null} The matched language code or null.
 */
function getLanguageCode(language, productLanguages) {
    // Exact match first
    if (productLanguages.includes(language)) {
        return language;
    }

    // Partial match: compare first two characters (case-insensitive) with the
    // language part before the dash.
    const langPrefix = language.slice(0, 2).toLowerCase();
    for (const pl of productLanguages) {
        const parts = pl.split("-", 2);
        if (parts.length === 2 && langPrefix === parts[0].toLowerCase()) {
            return pl;
        }
    }

    return null;
}

/**
 * Load and parse KNX master data from an XML string.
 *
 * @param {string} xmlString - The raw XML content of knx_master.xml.
 * @param {number} schemaVersion - The ETS schema version of the project.
 * @param {string|null} language - Desired language (partial match supported, e.g. "de").
 * @returns {{ masterData: { manufacturers: Map<string,string>, spaceUsages: Map<string,string>, functionTypes: Map<string,string>, translations: Map<string, Map<string,string>> }, languageCode: string|null }}
 */
function load(xmlString, schemaVersion, language) {
    const manufacturers = new Map();
    const spaceUsages = new Map();
    const functionTypes = new Map();
    let productLanguages = [];
    let languageCode = null;
    const translations = new Map();

    // Strip BOM if present - @xmldom/xmldom fails if BOM precedes <?xml declaration
    if (xmlString.charCodeAt(0) === 0xfeff) {
        xmlString = xmlString.slice(1);
    }

    const doc = new DOMParser().parseFromString(xmlString, "text/xml");

    // --- Manufacturers ---
    // Find Manufacturer elements that are direct children of Manufacturers
    const manufacturersContainers = byTagNS(doc, "Manufacturers");
    for (const container of manufacturersContainers) {
        const manufacturerNodes = childrenByTag(container, "Manufacturer");
        for (const node of manufacturerNodes) {
            const id = node.getAttribute("Id") || "";
            manufacturers.set(id, node.getAttribute("Name") || "");
        }
    }

    const isEts4 = schemaVersion <= ETS_4_2_SCHEMA_VERSION;

    if (isEts4) {
        // ETS4 has no SpaceUsage or ProductLanguages in the XML.
        // Use the hardcoded list of common product languages.
        productLanguages = ETS4_PRODUCT_LANGUAGES;
    } else {
        // --- SpaceUsages ---
        const spaceUsageContainers = byTagNS(doc, "SpaceUsages");
        for (const container of spaceUsageContainers) {
            const spaceUsageNodes = childrenByTag(container, "SpaceUsage");
            for (const node of spaceUsageNodes) {
                const id = node.getAttribute("Id") || "";
                spaceUsages.set(id, node.getAttribute("Text") || "");
            }
        }

        // --- ProductLanguages ---
        const productLanguageContainers = byTagNS(doc, "ProductLanguages");
        for (const container of productLanguageContainers) {
            const languageNodes = childrenByTag(container, "Language");
            for (const node of languageNodes) {
                const identifier = node.getAttribute("Identifier") || "";
                if (identifier) {
                    productLanguages.push(identifier);
                }
            }
        }

        // --- FunctionTypes ---
        const functionTypeContainers = byTagNS(doc, "FunctionTypes");
        for (const container of functionTypeContainers) {
            const functionTypeNodes = childrenByTag(container, "FunctionType");
            for (const node of functionTypeNodes) {
                const id = node.getAttribute("Id") || "";
                functionTypes.set(id, node.getAttribute("Text") || "");
            }
        }
    }

    // --- Resolve language code ---
    if (language != null) {
        languageCode = getLanguageCode(language, productLanguages);
    }

    // --- Translations ---
    if (languageCode) {
        // Find Language elements with matching Identifier, then get TranslationElement descendants
        const allLanguageNodes = byTagNS(doc, "Language");
        for (const langNode of allLanguageNodes) {
            if (langNode.getAttribute("Identifier") !== languageCode) {
                continue;
            }
            const translationElementNodes = byTagNS(langNode, "TranslationElement");
            for (const element of translationElementNodes) {
                const refId = element.getAttribute("RefId") || "";
                const attrMap = new Map();

                // Each TranslationElement contains Translation children
                const translationNodes = childrenByTag(element, "Translation");
                for (const item of translationNodes) {
                    const attributeName = item.getAttribute("AttributeName");
                    const text = item.getAttribute("Text");
                    if (attributeName != null && text != null) {
                        attrMap.set(attributeName, text);
                    }
                }

                if (attrMap.size > 0) {
                    translations.set(refId, attrMap);
                }
            }
        }
    }

    return {
        masterData: {
            manufacturers,
            spaceUsages,
            functionTypes,
            translations,
        },
        languageCode,
    };
}

module.exports = {
    load,
    getLanguageCode,
    ETS4_PRODUCT_LANGUAGES,
    ETS_4_2_SCHEMA_VERSION,
};
