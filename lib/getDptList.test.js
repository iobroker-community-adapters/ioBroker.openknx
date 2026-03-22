"use strict";

const { expect } = require("chai");
const { dptlib } = require("knxultimate");

/**
 * Standalone version of openknx.getDptList() for testing without js-controller.
 * Must be kept in sync with main.js getDptList().
 */
function getDptList() {
    const list = [];
    for (const dptKey of Object.keys(dptlib.dpts).sort((a, b) => {
        const na = parseInt(a.replace("DPT", ""));
        const nb = parseInt(b.replace("DPT", ""));
        return na - nb;
    })) {
        const dptObj = dptlib.dpts[dptKey];
        const baseNum = dptKey.replace("DPT", "");
        list.push({ value: dptKey, label: `${baseNum} - ${dptObj.basetype?.desc || dptKey}` });
        if (dptObj.subtypes) {
            for (const sub of Object.keys(dptObj.subtypes).sort()) {
                const st = dptObj.subtypes[sub];
                list.push({ value: `${dptKey}.${sub}`, label: `${baseNum}.${sub} - ${st.name || st.desc || ""}` });
            }
        }
    }
    return list;
}

describe("getDptList", () => {
    it("returns a non-empty array", () => {
        const list = getDptList();
        expect(list).to.be.an("array");
        expect(list.length).to.be.greaterThan(0);
    });

    it("each entry has value and label strings", () => {
        const list = getDptList();
        for (const entry of list) {
            expect(entry).to.have.property("value").that.is.a("string");
            expect(entry).to.have.property("label").that.is.a("string");
        }
    });

    it("contains base DPTs like DPT1, DPT9", () => {
        const list = getDptList();
        const values = list.map(e => e.value);
        expect(values).to.include("DPT1");
        expect(values).to.include("DPT9");
    });

    it("contains subtypes like DPT1.001, DPT9.001", () => {
        const list = getDptList();
        const values = list.map(e => e.value);
        expect(values).to.include("DPT1.001");
        expect(values).to.include("DPT9.001");
    });

    it("is sorted numerically by base DPT number", () => {
        const list = getDptList();
        const baseEntries = list.filter(e => !e.value.includes("."));
        for (let i = 1; i < baseEntries.length; i++) {
            const prev = parseInt(baseEntries[i - 1].value.replace("DPT", ""));
            const curr = parseInt(baseEntries[i].value.replace("DPT", ""));
            expect(curr).to.be.greaterThan(prev);
        }
    });

    it("subtypes follow their base DPT", () => {
        const list = getDptList();
        const baseDpt1Idx = list.findIndex(e => e.value === "DPT1");
        const subDpt1Idx = list.findIndex(e => e.value === "DPT1.001");
        expect(baseDpt1Idx).to.be.lessThan(subDpt1Idx);
        const baseDpt2Idx = list.findIndex(e => e.value === "DPT2");
        expect(subDpt1Idx).to.be.lessThan(baseDpt2Idx);
    });

    it("labels contain human-readable descriptions", () => {
        const list = getDptList();
        const dpt1_001 = list.find(e => e.value === "DPT1.001");
        expect(dpt1_001).to.exist;
        expect(dpt1_001.label).to.include("1.001");
        expect(dpt1_001.label).to.include("Switch");
    });

    it("no entry has empty value", () => {
        const list = getDptList();
        for (const entry of list) {
            expect(entry.value).to.not.be.empty;
        }
    });

    it("no duplicate values", () => {
        const list = getDptList();
        const values = list.map(e => e.value);
        const unique = new Set(values);
        expect(unique.size).to.equal(values.length);
    });
});
