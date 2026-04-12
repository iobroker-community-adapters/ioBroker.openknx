#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { extract } = require("../../lib/knxproj/extractor");
const { Parser } = require("../../lib/knxproj/parser");
const { combineProject } = require("../../lib/knxproj/combination");

const file = process.argv[2] || path.join(__dirname, "../../Downloads/Home_20260407.knxproj");

function memMB() {
    if (global.gc) global.gc();
    const m = process.memoryUsage();
    return `RSS=${(m.rss / 1024 / 1024).toFixed(0)} Heap=${(m.heapUsed / 1024 / 1024).toFixed(0)}/${(m.heapTotal / 1024 / 1024).toFixed(0)}`;
}

(async () => {
    console.log(`File: ${file} (${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB)`);
    const buf = fs.readFileSync(file);
    console.log(`[read]     ${memMB()}`);

    // Step 1: Extract ZIP
    const t0 = Date.now();
    const contents = await extract(buf);
    console.log(`[extract]  ${memMB()}  (${Date.now() - t0} ms)`);

    // List what's in the archive
    const entries = contents.listEntries();
    console.log(`  ${entries.length} entries in ZIP`);
    const byExt = {};
    for (const e of entries) {
        const ext = path.extname(e).toLowerCase() || "(none)";
        byExt[ext] = (byExt[ext] || 0) + 1;
    }
    console.log(`  Types: ${JSON.stringify(byExt)}`);

    // List large entries by uncompressed size
    const rootFiles = contents.rootDir.files.sort((a, b) => b.uncompressedSize - a.uncompressedSize);
    console.log(`\n  Top 10 largest entries:`);
    for (let i = 0; i < Math.min(10, rootFiles.length); i++) {
        const f = rootFiles[i];
        console.log(`    ${(f.uncompressedSize / 1024 / 1024).toFixed(1)} MB  ${f.path}`);
    }

    // Step 2: Parse
    const t1 = Date.now();
    const parser = new Parser(contents);
    const project = await parser.parse(null);
    console.log(`\n[parse]    ${memMB()}  (${Date.now() - t1} ms)`);

    // Step 3: Combine
    const t2 = Date.now();
    combineProject(project);
    console.log(`[combine]  ${memMB()}  (${Date.now() - t2} ms)`);

    const gaCount = project.group_addresses ? Object.keys(project.group_addresses).length : 0;
    const coCount = project.communication_objects ? Object.keys(project.communication_objects).length : 0;
    const devCount = project.devices ? Object.keys(project.devices).length : 0;
    console.log(`\nResult: ${gaCount} GAs, ${coCount} COs, ${devCount} Devices`);
    console.log(`Total: ${Date.now() - t0} ms`);
    console.log(`Final:     ${memMB()}`);
})().catch(e => {
    console.error("FAILED:", e.message);
    console.error(e.stack);
    process.exit(1);
});
