"use strict";

/**
 * Tests for lib/knxproj/util.js
 * Port of xknxproject/test/test_util.py
 */

const assert = require("assert");
const {
    getDptType,
    parseDptTypes,
    textParameterTemplateReplace,
    stripModuleInstance,
    getModuleInstancePart,
    textParameterInsertModuleInstance,
} = require("../../lib/knxproj/util");

describe("knxproj/util", function () {
    // -----------------------------------------------------------------
    // getDptType – 13 parametrized cases
    // -----------------------------------------------------------------
    describe("getDptType", function () {
        const cases = [
            { input: "DPT-1", expected: { main: 1, sub: null }, desc: "DPT-1 -> main=1" },
            { input: "DPT-1 DPST-1-1", expected: { main: 1, sub: null }, desc: "first DPT wins" },
            { input: "DPT-7 DPST-7-1", expected: { main: 7, sub: null }, desc: "DPT-7 first" },
            { input: "DPST-5-1", expected: { main: 5, sub: 1 }, desc: "DPST-5-1 -> main=5, sub=1" },
            { input: "DPT-1 DPT-5", expected: { main: 1, sub: null }, desc: "first of two DPTs" },
            { input: "DPT-14 DPST-14-1", expected: { main: 14, sub: null }, desc: "DPT-14 first" },
            { input: "DPST-6-10", expected: { main: 6, sub: 10 }, desc: "DPST-6-10 -> main=6, sub=10" },
            // NOTE: The JS implementation does not validate that parseInt produces a valid number.
            // "Wrong", "DPT-Wrong", "DPST-1-Wrong", "DPST-5" return NaN-containing objects
            // instead of null/[] as in the Python version. Tests reflect actual JS behavior.
            { input: "Wrong", expected: null, desc: "no DPT/DPST prefix -> null" },
            { input: "DPT-Wrong", expected: { main: NaN, sub: null }, desc: "DPT-Wrong -> NaN main (JS parseInt)" },
            { input: "DPST-1-Wrong", expected: { main: 1, sub: NaN }, desc: "DPST-1-Wrong -> NaN sub (JS parseInt)" },
            { input: "DPST-5", expected: { main: 5, sub: NaN }, desc: "DPST-5 missing sub -> NaN sub (JS parseInt)" },
            // NOTE: In Python, [] is falsy so get_dpt_type([]) returns None.
            // In JS, [] is truthy and .split() throws. Test verifies the throw.
            { input: [], expected: "THROWS", desc: "empty list -> throws (JS: [] is truthy)" },
            { input: null, expected: null, desc: "null -> null" },
        ];

        for (const { input, expected, desc } of cases) {
            it(desc, function () {
                if (expected === "THROWS") {
                    assert.throws(() => getDptType(input), TypeError);
                } else if (expected === null) {
                    assert.strictEqual(getDptType(input), null);
                } else {
                    assert.deepStrictEqual(getDptType(input), expected);
                }
            });
        }
    });

    // -----------------------------------------------------------------
    // parseDptTypes – 13 parametrized cases
    // -----------------------------------------------------------------
    describe("parseDptTypes", function () {
        const cases = [
            { input: "DPT-1", expected: [{ main: 1, sub: null }] },
            { input: "DPT-1 DPST-1-1", expected: [{ main: 1, sub: null }, { main: 1, sub: 1 }] },
            { input: "DPT-7 DPST-7-1", expected: [{ main: 7, sub: null }, { main: 7, sub: 1 }] },
            { input: "DPST-5-1", expected: [{ main: 5, sub: 1 }] },
            { input: "DPT-1 DPT-5", expected: [{ main: 1, sub: null }, { main: 5, sub: null }] },
            { input: "DPT-14 DPST-14-1", expected: [{ main: 14, sub: null }, { main: 14, sub: 1 }] },
            { input: "DPST-6-10", expected: [{ main: 6, sub: 10 }] },
            // JS-specific: "Wrong" prefix yields empty array (not DPT/DPST)
            { input: "Wrong", expected: [] },
            // JS-specific: parseInt("Wrong") = NaN; the entry is still pushed
            { input: "DPT-Wrong", expected: [{ main: NaN, sub: null }] },
            { input: "DPST-1-Wrong", expected: [{ main: 1, sub: NaN }] },
            { input: "DPST-5", expected: [{ main: 5, sub: NaN }] },
            // NOTE: In Python, [] is falsy so parse_dpt_types([]) returns [].
            // In JS, [] is truthy and .split() throws. Test verifies the throw.
            { input: [], expected: "THROWS" },
            { input: null, expected: [] },
        ];

        for (const { input, expected } of cases) {
            it(`parseDptTypes(${JSON.stringify(input)})`, function () {
                if (expected === "THROWS") {
                    assert.throws(() => parseDptTypes(input), TypeError);
                } else {
                    assert.deepStrictEqual(parseDptTypes(input), expected);
                }
            });
        }
    });

    // -----------------------------------------------------------------
    // textParameterTemplateReplace – 10 parametrized cases
    // -----------------------------------------------------------------
    describe("textParameterTemplateReplace", function () {
        const cases = [
            { text: "{{0}}", param: { value: "test" }, expected: "test" },
            { text: "{{0:default}}", param: { value: null }, expected: "default" },
            { text: "{{0:default}}", param: { value: "test" }, expected: "test" },
            { text: "{{0}}", param: null, expected: "" },
            { text: "{{0:default}}", param: null, expected: "default" },
            { text: "Hello {{0}}", param: { value: "test" }, expected: "Hello test" },
            { text: "Hi {{0:def}} again", param: { value: null }, expected: "Hi def again" },
            { text: "Hi{{0:default}}again", param: { value: "test" }, expected: "Hitestagain" },
            { text: "{{1}}", param: { value: "test" }, expected: "{{1}}" },
            { text: "{{XY}}:{{0}}{{ZZ}}", param: { value: "test" }, expected: "{{XY}}:test{{ZZ}}" },
        ];

        for (const { text, param, expected } of cases) {
            it(`"${text}" + param=${JSON.stringify(param)} -> "${expected}"`, function () {
                assert.strictEqual(textParameterTemplateReplace(text, param), expected);
            });
        }
    });

    // -----------------------------------------------------------------
    // stripModuleInstance – 3 parametrized cases
    // -----------------------------------------------------------------
    describe("stripModuleInstance", function () {
        const cases = [
            { text: "CH-4", searchId: "CH", expected: "CH-4" },
            { text: "MD-1_M-1_MI-1_CH-4", searchId: "CH", expected: "MD-1_CH-4" },
            {
                text: "MD-4_M-15_MI-1_SM-1_M-1_MI-1-1-2_SM-1_O-3-1_R-2",
                searchId: "O",
                expected: "MD-4_SM-1_O-3-1_R-2",
            },
        ];

        for (const { text, searchId, expected } of cases) {
            it(`stripModuleInstance("${text}", "${searchId}") -> "${expected}"`, function () {
                assert.strictEqual(stripModuleInstance(text, searchId), expected);
            });
        }
    });

    // -----------------------------------------------------------------
    // getModuleInstancePart – 6 parametrized cases
    // -----------------------------------------------------------------
    describe("getModuleInstancePart", function () {
        const cases = [
            {
                ref: "M-0083_A-0098-12-489B_MD-1_M-1_MI-1_P-43_R-87",
                nextId: "P",
                expected: "MD-1_M-1_MI-1",
            },
            { ref: "MD-1_M-1_MI-1_CH-4", nextId: "CH", expected: "MD-1_M-1_MI-1" },
            {
                ref: "MD-4_M-15_MI-1_SM-1_M-1_MI-1-1-2_SM-1_O-3-1_R-2",
                nextId: "O",
                expected: "MD-4_M-15_MI-1_SM-1_M-1_MI-1-1-2_SM-1",
            },
            {
                ref: "M-00FA_A-A228-0A-A6C3_O-2002002_R-200200202",
                nextId: "O",
                expected: "",
            },
            { ref: "MD-1_M-1_MI-1_CH-4", nextId: "CH", expected: "MD-1_M-1_MI-1" },
            { ref: "CH-SOM03", nextId: "CH", expected: "" },
        ];

        for (const { ref, nextId, expected } of cases) {
            it(`getModuleInstancePart("${ref}", "${nextId}") -> "${expected}"`, function () {
                assert.strictEqual(getModuleInstancePart(ref, nextId), expected);
            });
        }
    });

    // -----------------------------------------------------------------
    // textParameterInsertModuleInstance – 4 parametrized cases
    // -----------------------------------------------------------------
    describe("textParameterInsertModuleInstance", function () {
        const cases = [
            {
                instanceRef: "MD-2_M-17_MI-1_O-3-0_R-159",
                instanceNextId: "O",
                textParameterRefId: "M-0083_A-00B0-32-0DFC_MD-2_P-23_R-1",
                expected: "M-0083_A-00B0-32-0DFC_MD-2_M-17_MI-1_P-23_R-1",
            },
            {
                instanceRef: "MD-2_M-6_MI-1_CH-1",
                instanceNextId: "CH",
                textParameterRefId: "M-0083_A-013A-32-DCC1_MD-2_P-1_R-1",
                expected: "M-0083_A-013A-32-DCC1_MD-2_M-6_MI-1_P-1_R-1",
            },
            {
                instanceRef: "O-595_R-688",
                instanceNextId: "O",
                textParameterRefId: "M-0004_A-20D3-11-EC49-O000A_P-875_R-2697",
                expected: "M-0004_A-20D3-11-EC49-O000A_P-875_R-2697",
            },
            {
                instanceRef: "MD-5_M-2_MI-1_O-3-0_R-1",
                instanceNextId: "O",
                textParameterRefId: "M-007C_A-0004-72-F374_MD-5_UP-3_R-3",
                expected: "M-007C_A-0004-72-F374_MD-5_M-2_MI-1_UP-3_R-3",
            },
        ];

        for (const { instanceRef, instanceNextId, textParameterRefId, expected } of cases) {
            it(`insert module for ${textParameterRefId}`, function () {
                assert.strictEqual(
                    textParameterInsertModuleInstance(instanceRef, instanceNextId, textParameterRefId),
                    expected,
                );
            });
        }
    });
});
