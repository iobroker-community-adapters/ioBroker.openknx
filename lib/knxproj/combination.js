/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * Port of xknxproject/combination/combination.py
 * Post-processing DPT inference from linked CommunicationObjects.
 */

"use strict";

/**
 * Infer a DPTType list from a CommunicationObject's object_size.
 *
 * @param {string} objectSize - e.g. "1 Bit", "2 Bit", "4 Bit"
 * @returns {Array<{main: number, sub: number|null}>}
 */
function getDptFromObjectSize(objectSize) {
    if (objectSize === "1 Bit") {
        return [{ main: 1, sub: null }];
    }
    if (objectSize === "2 Bit") {
        // ignoring DPT 23.x which also has 2 bits
        return [{ main: 2, sub: null }];
    }
    if (objectSize === "4 Bit") {
        return [{ main: 3, sub: null }];
    }
    return [];
}

/**
 * Infer a DPTType from a set of CommunicationObject DPTs.
 * If all COs agree on exactly one DPT (main+sub), use it.
 * If they share the same main type, use a generic DPT (main only).
 * Otherwise return null.
 *
 * @param {Array<object>} commObjects - communication object entries
 * @returns {{main: number, sub: number|null}|null}
 */
function getDptFromCommObjects(commObjects) {
    // Collect unique DPTs as "main:sub" strings for deduplication
    const seen = new Set();
    const dpts = [];
    for (const co of commObjects) {
        for (const dpt of co.dpts || []) {
            if (!dpt) {
                continue;
            }
            const key = `${dpt.main}:${dpt.sub}`;
            if (!seen.has(key)) {
                seen.add(key);
                dpts.push(dpt);
            }
        }
    }

    if (dpts.length === 0) {
        return null;
    }
    if (dpts.length === 1) {
        return { main: dpts[0].main, sub: dpts[0].sub };
    }

    // If all share the same main type, use a generic DPT
    const mains = new Set(dpts.map(d => d.main));
    if (mains.size === 1) {
        const main = mains.values().next().value;
        return { main, sub: null };
    }

    return null;
}

/**
 * Combine the parsed project data for more details inferred from linked objects.
 * Modifies the project in place and returns it.
 *
 * @param {object} project - KNXProject output from Parser._transform
 * @returns {object} the same project, mutated
 */
function combineProject(project) {
    // 1. For each CO without DPTs: infer from object_size
    for (const commObject of Object.values(project.communication_objects)) {
        if (!commObject.dpts || commObject.dpts.length === 0) {
            commObject.dpts = getDptFromObjectSize(commObject.object_size);
        }
    }

    // 2. For each GA without dpt: infer from linked COs
    for (const groupAddress of Object.values(project.group_addresses)) {
        if (!groupAddress.dpt) {
            const linkedCOs = (groupAddress.communication_object_ids || [])
                .map(coId => project.communication_objects[coId])
                .filter(Boolean);
            groupAddress.dpt = getDptFromCommObjects(linkedCOs);
        }
    }

    return project;
}

module.exports = {
    combineProject,
    getDptFromObjectSize,
    getDptFromCommObjects,
};
