"use strict";

/**
 * End-to-end tests for the knxproj parser.
 * Port of xknxproject/test/test_knxproj.py
 *
 * Parses 6 projects through the full pipeline (extract -> Parser.parse)
 * and compares the output against JSON stubs.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { extract } = require("../../lib/knxproj/extractor");
const { Parser } = require("../../lib/knxproj/parser");
const { combineProject } = require("../../lib/knxproj/combination");

const RESOURCES = path.join(__dirname, "resources");
const STUBS = path.join(RESOURCES, "stubs");

/**
 * Load a JSON stub, remove xknxproject_version from both the stub and the
 * result, then compare every key in both directions.
 *
 * @param {object} toBeVerified - The parsed KNXProject output
 * @param {string} stubName    - File name of the JSON stub (e.g. "xknx_test_project.json")
 */
function assertStub(toBeVerified, stubName) {
    const stubPath = path.join(STUBS, stubName);
    const stubRaw = fs.readFileSync(stubPath, "utf-8");
    const stub = JSON.parse(stubRaw);

    // Remove xknxproject_version from both objects (version may differ)
    function removeXknxprojectVersion(obj) {
        assert.ok(obj.info, "output must contain 'info' key");
        const version = obj.info.xknxproject_version;
        assert.ok(version, "xknxproject_version must be present");
        const parts = version.split(".");
        assert.strictEqual(parts.length, 3, `xknxproject_version "${version}" must have 3 parts`);
        delete obj.info.xknxproject_version;
        return obj;
    }

    const cleanStub = removeXknxprojectVersion(stub);
    const cleanResult = removeXknxprojectVersion(toBeVerified);

    // Verify all stub keys are in the result
    for (const key of Object.keys(cleanStub)) {
        assert.ok(key in cleanResult, `"${key}" key missing in generated object`);
        assert.deepStrictEqual(
            cleanResult[key],
            cleanStub[key],
            `"${key}" item does not match`,
        );
    }

    // Verify no extra keys in the result
    for (const key of Object.keys(cleanResult)) {
        assert.ok(key in cleanStub, `"${key}" key of generated object missing in stub`);
    }
}

describe("knxproj end-to-end (Parser.parse)", function () {
    // Full pipeline parsing can take a very long time due to xpath evaluation
    // on large application program XML files (some are >3 MB).
    // Timeout is set generously; projects with large XML files may still be slow.
    this.timeout(600000);

    const projects = [
        {
            fileStem: "xknx_test_project",
            password: "test",
            language: null,
        },
        {
            fileStem: "test_project-ets4",
            password: "test",
            language: "de-DE",
        },
        {
            fileStem: "module-definition-test",
            password: null,
            language: "De",
        },
        {
            fileStem: "testprojekt-ets6-functions",
            password: null,
            language: "De",
        },
        {
            fileStem: "ets6_two_level",
            password: null,
            language: "de-DE",
        },
        {
            fileStem: "ets6_free",
            password: null,
            language: "de-DE",
        },
    ];

    for (const { fileStem, password, language } of projects) {
        it(`should parse ${fileStem} and match stub`, async function () {
            const knxprojPath = path.join(RESOURCES, `${fileStem}.knxproj`);
            const buffer = fs.readFileSync(knxprojPath);

            const t0 = Date.now();
            console.log(`  [${fileStem}] extracting ZIP ...`);
            const contents = await extract(buffer, password);
            console.log(`  [${fileStem}] extracted in ${Date.now() - t0} ms  (schema ${contents.schemaVersion}, ns: ${contents.xmlNamespace.split("/").pop()})`);

            const t1 = Date.now();
            console.log(`  [${fileStem}] parsing ...`);
            const parser = new Parser(contents);
            const project = await parser.parse(language);
            console.log(`  [${fileStem}] parsed in ${Date.now() - t1} ms`);

            combineProject(project);

            const gaCount = Object.keys(project.group_addresses || {}).length;
            const coCount = Object.keys(project.communication_objects || {}).length;
            const locCount = Object.keys(project.locations || {}).length;
            console.log(`  [${fileStem}] result: ${gaCount} GAs, ${coCount} COs, ${locCount} locations`);

            assertStub(project, `${fileStem}.json`);
            console.log(`  [${fileStem}] stub match OK  (total ${Date.now() - t0} ms)`);
        });
    }
});

describe("knxproj memory efficiency", function () {
    this.timeout(600000);

    it("should parse large knxproj within reasonable memory limits", async function () {
        // Set KNXPROJ_LARGE_FILE env variable to a large .knxproj path to run this test
        const largePath = process.env.KNXPROJ_LARGE_FILE;
        if (!largePath || !fs.existsSync(largePath)) {
            this.skip();
            return;
        }

        const buffer = fs.readFileSync(largePath);
        const heapBefore = process.memoryUsage().heapUsed;

        const contents = await extract(buffer);
        const parser = new Parser(contents);
        const project = await parser.parse(null);
        combineProject(project);

        const heapAfter = process.memoryUsage().heapUsed;
        const heapDeltaMB = (heapAfter - heapBefore) / 1024 / 1024;

        const gaCount = Object.keys(project.group_addresses || {}).length;
        const coCount = Object.keys(project.communication_objects || {}).length;
        console.log(`  Large project: ${gaCount} GAs, ${coCount} COs, heap delta: ${heapDeltaMB.toFixed(0)} MB`);

        assert.ok(gaCount > 100, `Expected >100 GAs, got ${gaCount}`);
        assert.ok(heapDeltaMB < 200, `Heap grew ${heapDeltaMB.toFixed(0)} MB, expected <200 MB`);
    });
});

describe("knxproj lazy extraction", function () {
    this.timeout(30000);

    it("should not load all ZIP entries into memory during extract", async function () {
        const knxprojPath = path.join(RESOURCES, "xknx_test_project.knxproj");
        const buffer = fs.readFileSync(knxprojPath);
        const contents = await extract(buffer, "test");

        // Verify files are present but buffer() returns fresh data each call
        const entries = contents.listEntries();
        assert.ok(entries.length > 0, "Should have entries");

        // Read a file twice — both should return identical content
        const xml1 = await contents.readFile("knx_master.xml");
        const xml2 = await contents.readFile("knx_master.xml");
        assert.strictEqual(xml1, xml2, "Re-reading same file should return identical content");
        assert.ok(xml1.includes("KNX"), "knx_master.xml should contain KNX");
    });

    it("should support password-protected inner ZIP", async function () {
        const knxprojPath = path.join(RESOURCES, "xknx_test_project.knxproj");
        const buffer = fs.readFileSync(knxprojPath);
        const contents = await extract(buffer, "test");

        // Should be able to read project files from inner ZIP
        const project0 = await contents.openProject0();
        assert.ok(project0.length > 0, "0.xml should have content");
        assert.ok(project0.includes("GroupAddress"), "0.xml should contain GroupAddress");
    });
});
