"use strict";

/**
 * Tests for lib/knxproj/extractor.js
 * Port of xknxproject/test/zip/test_extractor.py
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { extract, generateEts6ZipPassword, InvalidPasswordException } = require("../../lib/knxproj/extractor");

const RESOURCES = path.join(__dirname, "resources");

describe("knxproj/extractor", function () {
    // Extraction can be slow for large archives
    this.timeout(30000);

    // -----------------------------------------------------------------
    // Extract ETS5 project (no password)
    // -----------------------------------------------------------------
    describe("extract ETS5 project (no password)", function () {
        it("should read project.xml from unprotected ETS5 archive", async function () {
            const buffer = fs.readFileSync(path.join(RESOURCES, "xknx_test_project_no_password.knxproj"));
            const contents = await extract(buffer);
            const projectXml = await contents.readFile(`${contents.projectId}/project.xml`);
            assert.ok(projectXml, "project.xml should be readable");
            assert.ok(projectXml.length > 0, "project.xml should not be empty");
        });
    });

    // -----------------------------------------------------------------
    // Extract protected ETS5 project (password "test")
    // -----------------------------------------------------------------
    describe("extract protected ETS5 project", function () {
        it("should read signature and 0.xml header with correct password", async function () {
            const buffer = fs.readFileSync(path.join(RESOURCES, "xknx_test_project.knxproj"));
            const contents = await extract(buffer, "test");

            // Verify signature file is accessible
            const signature = await contents.readFile(`${contents.projectId}.signature`);
            assert.ok(signature, "signature file should be readable");

            // Verify 0.xml starts with XML declaration
            const project0 = await contents.openProject0();
            assert.ok(
                project0.includes('<?xml version="1.0" encoding="utf-8"?>'),
                "0.xml should start with XML declaration",
            );
        });
    });

    // -----------------------------------------------------------------
    // ETS6 password generation: 3 known test vectors
    // -----------------------------------------------------------------
    describe("generateEts6ZipPassword", function () {
        const vectors = [
            { password: "a", expected: "+FAwP4iI7/Pu4WB3HdIHbbFmteLahPAVkjJShKeozAA=" },
            { password: "test", expected: "2+IIP7ErCPPKxFjJXc59GFx2+w/1VTLHjJ2duc04CYQ=" },
            { password: "Penn\u00A5w1se \uD83E\uDD21", expected: "ZjlYlh+eTtoHvFadU7+EKvF4jOdEm7WkP49uanOMMk0=" },
        ];

        for (const { password, expected } of vectors) {
            it(`password "${password}" -> "${expected}"`, function () {
                const result = generateEts6ZipPassword(password);
                assert.strictEqual(result, expected);
            });
        }
    });

    // -----------------------------------------------------------------
    // Extract protected ETS6 project (password "test")
    // NOTE: ETS6 uses AES-256 ZIP encryption (pyzipper in Python).
    // The 'unzipper' npm package does not support AES-encrypted entries.
    // This test is skipped until AES ZIP support is added.
    // -----------------------------------------------------------------
    describe("extract protected ETS6 project", function () {
        it("should read signature and 0.xml header with correct password", async function () {
            const buffer = fs.readFileSync(path.join(RESOURCES, "testprojekt-ets6.knxproj"));
            const contents = await extract(buffer, "test");

            // Verify signature file is accessible
            const signature = await contents.readFile(`${contents.projectId}.signature`);
            assert.ok(signature, "signature file should be readable");

            // Verify 0.xml starts with XML declaration
            const project0 = await contents.openProject0();
            assert.ok(
                project0.includes('<?xml version="1.0" encoding="utf-8"?>'),
                "0.xml should start with XML declaration",
            );
        });
    });

    // -----------------------------------------------------------------
    // Wrong password ETS5 -> error
    // -----------------------------------------------------------------
    describe("wrong password ETS5", function () {
        it("should throw InvalidPasswordException for wrong password", async function () {
            const buffer = fs.readFileSync(path.join(RESOURCES, "xknx_test_project.knxproj"));
            await assert.rejects(
                async () => {
                    const contents = await extract(buffer, "wrong");
                    await contents.openProject0();
                },
                (err) => {
                    assert.ok(
                        err instanceof InvalidPasswordException || err.name === "InvalidPasswordException",
                        `Expected InvalidPasswordException, got ${err.name}: ${err.message}`,
                    );
                    return true;
                },
            );
        });
    });

    // -----------------------------------------------------------------
    // Wrong password ETS6 -> error
    // -----------------------------------------------------------------
    describe("wrong password ETS6", function () {
        it("should throw InvalidPasswordException for wrong password", async function () {
            const buffer = fs.readFileSync(path.join(RESOURCES, "testprojekt-ets6.knxproj"));
            await assert.rejects(
                async () => {
                    const contents = await extract(buffer, "wrong");
                    await contents.openProject0();
                },
                (err) => {
                    assert.ok(
                        err instanceof InvalidPasswordException || err.name === "InvalidPasswordException",
                        `Expected InvalidPasswordException, got ${err.name}: ${err.message}`,
                    );
                    return true;
                },
            );
        });
    });

    // -----------------------------------------------------------------
    // Empty password for protected project -> error
    // -----------------------------------------------------------------
    describe("empty password for protected ETS6 project", function () {
        it("should throw InvalidPasswordException for empty password", async function () {
            const buffer = fs.readFileSync(path.join(RESOURCES, "testprojekt-ets6.knxproj"));
            await assert.rejects(
                async () => {
                    const contents = await extract(buffer, "");
                    await contents.openProject0();
                },
                (err) => {
                    assert.ok(
                        err instanceof InvalidPasswordException ||
                            err instanceof Error,
                        `Expected error, got ${err.name}: ${err.message}`,
                    );
                    return true;
                },
            );
        });
    });
});
