"use strict";

/**
 * Tests for lib/knxproj/projectLoader.js (the XML parser layer).
 * Port of xknxproject/test/xml/test_parser.py
 *
 * The Python XMLParser corresponds to projectLoader.load() in the JS port.
 * It parses group addresses, topology, and locations from the 0.xml / project.xml
 * without resolving hardware or application program data.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { extract } = require("../../lib/knxproj/extractor");
const projectLoader = require("../../lib/knxproj/projectLoader");

const RESOURCES = path.join(__dirname, "resources");

describe("knxproj/parser (projectLoader)", function () {
    // Parsing can take a while for large archives
    this.timeout(60000);

    // -----------------------------------------------------------------
    // ETS6 project: 3 GAs, 2 areas, devices with ComObjects
    // NOTE: testprojekt-ets6.knxproj is AES-encrypted; skipped until AES ZIP support is added.
    // -----------------------------------------------------------------
    describe("parse ETS6 project", function () {
        it("should parse group addresses, areas, and devices from ETS6 archive", async function () {
            const buffer = fs.readFileSync(path.join(RESOURCES, "testprojekt-ets6.knxproj"));
            const contents = await extract(buffer, "test");
            const result = await projectLoader.load(contents, null);

            // 3 group addresses
            assert.strictEqual(result.groupAddresses.length, 3);
            assert.strictEqual(result.groupAddresses[0].address, "0/1/0");
            assert.strictEqual(result.groupAddresses[1].address, "0/1/1");
            assert.strictEqual(result.groupAddresses[2].address, "0/1/2");

            // 2 areas
            assert.strictEqual(result.areas.length, 2);
            assert.strictEqual(result.areas[1].lines.length, 2);
            assert.strictEqual(result.areas[1].lines[1].devices.length, 3);
            assert.strictEqual(result.areas[1].lines[1].devices[0].additionalAddresses.length, 4);
            assert.strictEqual(result.areas[1].lines[1].devices[1].comObjectInstanceRefs.length, 2);
        });
    });

    // -----------------------------------------------------------------
    // ETS5 project: 19 GAs, correct set of addresses, 4 devices
    // -----------------------------------------------------------------
    describe("parse ETS5 project", function () {
        it("should parse 19 group addresses and 4 devices from ETS5 archive", async function () {
            const buffer = fs.readFileSync(path.join(RESOURCES, "xknx_test_project.knxproj"));
            const contents = await extract(buffer, "test");
            const result = await projectLoader.load(contents, null);

            // 19 group addresses
            assert.strictEqual(result.groupAddresses.length, 19);

            const parsedGas = new Set(result.groupAddresses.map(ga => ga.address));
            assert.strictEqual(parsedGas.size, result.groupAddresses.length);

            const expectedGas = new Set([
                "1/0/0", "1/0/1", "1/0/2", "1/0/3", "1/0/4", "1/0/5",
                "2/0/0", "2/0/1", "2/0/6",
                "2/1/1", "2/1/2", "2/1/10", "2/1/21", "2/1/22", "2/1/23",
                "7/0/0", "7/1/0", "7/1/1", "7/1/2",
            ]);
            assert.deepStrictEqual(parsedGas, expectedGas);

            // Topology
            assert.strictEqual(result.areas.length, 2);
            assert.strictEqual(result.areas[1].lines.length, 2);
            assert.strictEqual(result.areas[1].lines[1].devices.length, 4);
            assert.strictEqual(result.areas[1].lines[1].devices[0].additionalAddresses.length, 4);
            assert.strictEqual(result.areas[1].lines[1].devices[1].comObjectInstanceRefs.length, 7);
        });
    });

    // -----------------------------------------------------------------
    // ETS4 project: 3 GAs (parametrized with/without password)
    // -----------------------------------------------------------------
    describe("parse ETS4 project", function () {
        const ets4Cases = [
            { file: "test_project-ets4-no_password.knxproj", password: null, desc: "no password" },
            { file: "test_project-ets4.knxproj", password: "test", desc: "password protected" },
        ];

        for (const { file, password, desc } of ets4Cases) {
            it(`should parse 3 GAs and 2 devices from ETS4 archive (${desc})`, async function () {
                const buffer = fs.readFileSync(path.join(RESOURCES, file));
                const contents = await extract(buffer, password);
                const result = await projectLoader.load(contents, null);

                // 3 group addresses
                assert.strictEqual(result.groupAddresses.length, 3);
                const parsedGas = new Set(result.groupAddresses.map(ga => ga.address));
                assert.strictEqual(parsedGas.size, result.groupAddresses.length);
                assert.deepStrictEqual(parsedGas, new Set(["0/0/1", "0/0/2", "0/0/3"]));

                // Topology
                assert.strictEqual(result.areas.length, 1);
                assert.strictEqual(result.areas[0].lines.length, 1);
                assert.strictEqual(result.areas[0].lines[0].devices.length, 2);

                // Devices
                assert.strictEqual(result.devices.length, 2);
                assert.strictEqual(result.devices[0].individualAddress, "0.0.1");
                assert.strictEqual(result.devices[1].individualAddress, "0.0.2");
            });
        }
    });

    // -----------------------------------------------------------------
    // Module definitions: 25 GAs, 4 devices
    // -----------------------------------------------------------------
    describe("parse project with module definitions", function () {
        it("should parse 25 GAs and 4 devices from module-definition-test", async function () {
            const buffer = fs.readFileSync(path.join(RESOURCES, "module-definition-test.knxproj"));
            const contents = await extract(buffer);
            const result = await projectLoader.load(contents, null);

            // 25 group addresses
            assert.strictEqual(result.groupAddresses.length, 25);
            assert.strictEqual(result.groupAddresses[0].address, "0/0/1");
            assert.strictEqual(result.groupAddresses[1].address, "0/0/2");
            assert.strictEqual(result.groupAddresses[2].address, "0/0/3");

            // Topology
            assert.strictEqual(result.areas.length, 2);
            assert.strictEqual(result.areas[1].lines.length, 2);
            assert.strictEqual(result.areas[1].lines[1].devices.length, 4);

            // Devices
            assert.strictEqual(result.devices.length, 4);
        });
    });
});
