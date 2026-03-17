/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * Port of xknxproject/xknxproj.py
 * Public API for parsing .knxproj archives.
 */

"use strict";

const { extract } = require("./extractor");
const { Parser } = require("./parser");
const { combineProject } = require("./combination");

/**
 * Parse a .knxproj file buffer and return a KNXProject object.
 *
 * @param {Buffer} buffer   - The raw .knxproj file contents
 * @param {string} [password] - Optional password for protected projects
 * @param {string} [language] - Optional language code (e.g. "de", "en-US")
 * @returns {Promise<object>} KNXProject output
 */
async function parseKnxproj(buffer, password, language) {
    const contents = await extract(buffer, password);
    const parser = new Parser(contents);
    const project = await parser.parse(language || null);
    combineProject(project);
    return project;
}

module.exports = { parseKnxproj };
