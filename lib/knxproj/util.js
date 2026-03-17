/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * Port of xknxproject/util.py
 */

"use strict";

/**
 * Parse DPT type from the XML representation to main and sub types.
 *
 * @param {string} dptString - e.g. "DPST-1-1" or "DPT-1"
 * @returns {{main: number, sub: number|null}|null}
 */
function getDptType(dptString) {
    const results = parseDptTypes(dptString);
    return results.length > 0 ? results[0] : null;
}

/**
 * Parse all DPTs from the XML representation to main and sub types.
 *
 * @param {string} dptString - space-separated DPT identifiers
 * @returns {Array<{main: number, sub: number|null}>}
 */
function parseDptTypes(dptString) {
    if (!dptString) {
        return [];
    }
    const supportedDpts = [];
    // Use a Set to deduplicate (equivalent to dict.fromkeys)
    const uniqueDpts = [...new Set(dptString.split(/\s+/))];
    for (const dpt of uniqueDpts) {
        const parts = dpt.split("-");
        try {
            if (parts[0] === "DPT") {
                supportedDpts.push({ main: parseInt(parts[1], 10), sub: null });
            } else if (parts[0] === "DPST") {
                supportedDpts.push({ main: parseInt(parts[1], 10), sub: parseInt(parts[2], 10) });
            }
        } catch {
            // skip malformed DPT entries
        }
    }
    return supportedDpts;
}

/**
 * Parse an XML flag attribute value.
 *
 * @param {string|null|undefined} flag
 * @param {*} [defaultValue] - defaults to null
 * @returns {boolean|*}
 */
function parseXmlFlag(flag, defaultValue = null) {
    if (flag == null) {
        return defaultValue;
    }
    return flag === "Enabled";
}

/**
 * Replace template placeholders like {{0}} or {{0:default}} with a parameter value.
 * If parameter value is falsy, the default from the placeholder is used.
 *
 * @param {string} text
 * @param {{value: string|null}|null} parameter
 * @returns {string}
 */
function textParameterTemplateReplace(text, parameter) {
    const parameterValue = parameter ? parameter.value : null;
    return text.replace(/\{\{0(?::?)(.*?)\}\}/g, (_match, defaultVal) => parameterValue || defaultVal);
}

/**
 * Remove module and module instance segments from text, keeping module definition and the rest.
 * "MD-1_M-1_MI-1_CH-4" with searchId="CH" -> "MD-1_CH-4"
 *
 * @param {string} text
 * @param {string} searchId
 * @returns {string}
 */
function stripModuleInstance(text, searchId) {
    const escapedSearchId = escapeRegExp(searchId);
    const regex = new RegExp(`(MD-\\w+_)?.*?(SM-\\w+_)?(${escapedSearchId}-.*)`, "");
    return text.replace(regex, (_match, md, sm, rest) => {
        return [md, sm, rest].filter(Boolean).join("");
    });
}

/**
 * Get module and module instance part from a reference string.
 *
 * @param {string} ref
 * @param {string} nextId - e.g. "CH"
 * @returns {string} the module part or empty string
 */
function getModuleInstancePart(ref, nextId) {
    const escapedNextId = escapeRegExp(nextId);
    const regex = new RegExp(`(MD-.*)_${escapedNextId}-`);
    const match = ref.match(regex);
    return match ? match[1] : "";
}

/**
 * Insert module and module instance from instanceRef into textParameterRefId.
 *
 * @param {string} instanceRef
 * @param {string} instanceNextId
 * @param {string} textParameterRefId
 * @returns {string}
 */
function textParameterInsertModuleInstance(instanceRef, instanceNextId, textParameterRefId) {
    if (textParameterRefId.includes("_MD-")) {
        const moduleRef = getModuleInstancePart(instanceRef, instanceNextId);
        if (moduleRef) {
            const applicationRef = textParameterRefId.split("_MD-")[0];
            // Match _P- or _UP- for Parameter or UnionParameter
            const paramMatch = textParameterRefId.match(/_(U?P-.*)/);
            if (!paramMatch) {
                throw new Error(`Could not find parameter reference in textParameterRefId: ${textParameterRefId}`);
            }
            return `${applicationRef}_${moduleRef}_${paramMatch[1]}`;
        }
    }
    return textParameterRefId;
}

/**
 * Escape special regex characters in a string.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
    getDptType,
    parseDptTypes,
    parseXmlFlag,
    textParameterTemplateReplace,
    stripModuleInstance,
    getModuleInstancePart,
    textParameterInsertModuleInstance,
};
