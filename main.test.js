"use strict";

/**
 * This is a TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.js-files
 * https://github.com/ioBroker/testing
 */

// tslint:disable:no-unused-expression

const main = require("./main.js");
const options = {
    name: "iobroker",
    dirname: "./",
};
const m = main(options);

function dummy() {
    return true;
}

let setStateAck;
function setState(id, state) {

    if (state) {
        setStateAck = state.ack;
        //console.dir("setState state ack: " + JSON.stringify(state.ack ));
    }
    return true;
}

let callbackRes = "";

function getState(id, options, callback) {
    const err = undefined;
    const state = {
        val: 0
    };

    if (typeof options == "function") {
        callbackRes = options(err, state);
    }

    if (typeof callback == "function") {
        callbackRes = callback(err, state);
    }
}

class log {
    constructor() {}
    info(msg) {
        console.dir(msg);
    }
    warn(msg) {
        console.dir(msg);
    }
    error(msg) {
        console.dir(msg);
    }
    silly() {}
    debug() {}
}

class mockKnxConnection {
    constructor(conf) {}
    Disconnect() {
        console.dir("disconnect");
    }
    read() {
        console.dir("read");
    }
    write() {
        console.dir("write");
    }
    writeRaw() {
        console.dir("writeRaw");
    }
    respond(grpaddr, value, dptid) {
        console.dir("respond");
    }
}

const {
    expect
} = require("chai");
const {
    tests,
    utils,
    MockDatabase
} = require("@iobroker/testing");
const EventEmitter = require("node:events");
const {
    exit
} = require("node:process");
const {
    adapter,
    database
} = utils.unit.createMocks();

let result;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

describe("module to test: main  => function to test: warnDuplicates", () => {
    // initializing logic
    const expected = "New object with an already existing Group Address name has not been created: aaa";

    it(`should return ${expected}`, () => {

        const objects = [{
            _id: 'aaa',
            type: 'state',
            from: 'system.adapter.openknx.0'
        },
        {
            _id: 'aaa',
            type: 'state',
            from: 'system.adapter.openknx.0'
        },
        ];

        const result = m.warnDuplicates(objects);
        expect(result).to.equal(expected);
        // or using the should() syntax
        //result.should.equal(expected);
    });

});


describe("module to test: main  => function to test: onStateChange", () => {
    // initializing logic

    m.setState = setState;
    m.getStateAsync = dummy;
    m.getState = getState;
    m.log = new log();
    m.knxConnection = new mockKnxConnection();
    m.connected = true;
    m.config = {
        gwip: "1.1.1.1",
        gwipport: "1234"
    };

    //Create an object in the fake db we will use in this test
    const namespace = m.namespace;
    const myid1 = namespace + "." + "test1";
    const myid2 = namespace + "." + "test2";
    const myid3 = namespace + "." + "test3";
    const myid4 = namespace + "." + "test4";
    const myid5 = namespace + "." + "test5";
    const address1 = "0/0/1";
    const address2 = "0/0/2";
    const address3 = "0/0/3";
    const address4 = "0/0/4";
    const address5 = "0/0/5";

    const theObject1 = {
        _id: myid1,
        type: "state",
        common: {
            role: "whatever",
            write: true,
            type: "boolean",
        },
        native: {
            address: address1,
            "dpt": "DPT1",
        }
    };
    const theObject2 = {
        _id: myid2,
        type: "state",
        common: {
            role: "whatever",
            write: true,
            type: "number",
        },
        native: {
            address: address2,
            "dpt": "DPT4",
            "answer_groupValueResponse": true,
        }
    };
    const theObject3 = { //raw
        _id: myid3,
        type: "state",
        common: {
            role: "whatever",
            write: true,
            type: "",
        },
        native: {
            address: address3,
            "dpt": "DPT100", //raw
        }
    };
    const theObject4 = { //dpt3
        _id: myid4,
        type: "state",
        common: {
            role: "whatever",
            write: true,
            type: "",
        },
        native: {
            address: address3,
            "dpt": "DPT3.007",
            valuetype: "composite",
        }
    };

    const theObject5 = {
        _id: myid5,
        type: "number",
        common: {
            role: "whatever",
            write: true,
            type: "",
        },
        native: {
            address: address3,
            dpt: "DPT11",
            valuetype: "basic" //10 basic 11+19 composite
        }
    };

    m.gaList.set(myid1, address1, theObject1);
    m.gaList.set(myid2, address2, theObject2);
    m.gaList.set(myid3, address3, theObject3);
    m.gaList.set(myid4, address4, theObject4);
    m.gaList.set(myid5, address5, theObject5);

    it("check onStateChange triggers write", async () => {

        const expected1 = "write";
        const expected2 = "read";
        const expected3 = "write raw";
        const expected4 = "write";
        const expected5 = "read";

        const state1 = {
            val: "a",
            ack: false,
            ts: 0,
            lc: 0
        };
        const state2 = {
            val: 123,
            ack: false,
            ts: 0,
            lc: 0,
            c: "GroupValue_Read",
        };
        const state3 = {
            val: '{"decr_incr":1, "data":1}',
            ack: false,
            ts: 0,
            lc: 0
        };
        const state4 = {
            val: 123,
            ack: false,
            ts: 0,
            lc: 0,
            q: 0x10,
        };

        m.getStateAsync = dummy; //again
        result = await m.onStateChange(myid1, state1);
        expect(result).to.equal(expected1);

        result = await m.onStateChange(myid2, state2);
        expect(result).to.equal(expected2);

        result = await m.onStateChange(myid2, state4);
        expect(result).to.equal(expected2);

        result = await m.onStateChange(myid3, state1);
        expect(result).to.equal(expected3);

        result = await m.onStateChange(myid4, state3);
        expect(result).to.equal(expected4);

        result = await m.onStateChange(myid5, state2);
        console.dir("res:"+ result);
        expect(result).to.equal(expected5);
    });

    it("returns 'invalid input' for null/undefined/missing args", async () => {
        expect(await m.onStateChange(null, { val: 1 })).to.equal("invalid input");
        expect(await m.onStateChange(myid1, null)).to.equal("invalid input");
        expect(await m.onStateChange(myid1, "not an object")).to.equal("invalid input");
        expect(await m.onStateChange("", { val: 1 })).to.equal("invalid input");
    });

    it("returns 'ack is set' when state.ack is true", async () => {
        const state = { val: true, ack: true, ts: 0, lc: 0 };
        expect(await m.onStateChange(myid1, state)).to.equal("ack is set");
    });

    it("returns 'null value' when state.val is null", async () => {
        const state = { val: null, ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(myid1, state)).to.equal("null value");
    });

    it("returns 'null value' when state.val is undefined", async () => {
        const state = { val: undefined, ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(myid1, state)).to.equal("null value");
    });

    it("returns 'not a KNX object' for unknown id", async () => {
        const state = { val: 1, ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange("nonexistent.id", state)).to.equal("not a KNX object");
    });

    it("returns 'not connected to KNX bus' when disconnected", async () => {
        m.connected = false;
        const state = { val: true, ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(myid1, state)).to.equal("not connected to KNX bus");
        m.connected = true; // restore
    });

    it("returns 'KNX not started' when knxConnection is undefined", async () => {
        const saved = m.knxConnection;
        m.knxConnection = undefined;
        const state = { val: true, ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(myid1, state)).to.equal("KNX not started");
        m.knxConnection = saved; // restore
    });

    it("returns 'configuration error' for non-writable GA", async () => {
        const readOnlyId = namespace + ".readonly1";
        const readOnlyObj = {
            _id: readOnlyId,
            type: "state",
            common: { role: "value", write: false, type: "number" },
            native: { address: "0/0/99", dpt: "DPT9.001" },
        };
        m.gaList.set(readOnlyId, "0/0/99", readOnlyObj);
        const state = { val: 22.5, ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(readOnlyId, state)).to.equal("configuration error");
    });

    it("returns 'unsupported value' for invalid composite JSON", async () => {
        const state = { val: "not-json", ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(myid4, state)).to.equal("unsupported value");
    });

    it("returns 'unsupported datatype' for non-string value on unknown DPT", async () => {
        // myid3 has DPT100 (unknown), expects hex string
        const state = { val: 12345, ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(myid3, state)).to.equal("unsupported datatype");
    });

    it("handles date DPT with DD.MM.YYYY string format", async () => {
        const dateId = namespace + ".date1";
        const dateObj = {
            _id: dateId,
            type: "state",
            common: { role: "date", write: true, type: "number" },
            native: { address: "0/0/50", dpt: "DPT11.001" },
        };
        m.gaList.set(dateId, "0/0/50", dateObj);
        const state = { val: "15.03.2026", ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(dateId, state)).to.equal("write");
    });

    it("handles date DPT with numeric string timestamp", async () => {
        const dateId = namespace + ".date1";
        // dateId already registered from previous test
        const state = { val: "1742025600", ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(dateId, state)).to.equal("write");
    });

    it("handles date DPT with numeric value (epoch)", async () => {
        const dateId = namespace + ".date1";
        const state = { val: 1742025600000, ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(dateId, state)).to.equal("write");
    });

    it("handles date DPT with ISO string passthrough", async () => {
        const dateId = namespace + ".date1";
        const state = { val: "2026-03-15T12:00:00Z", ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(dateId, state)).to.equal("write");
    });

    it("handles boolean coercion for DPT1", async () => {
        // myid1 is DPT1 with common.type=boolean, val=0 should coerce to false and write
        const state = { val: 0, ack: false, ts: 0, lc: 0 };
        expect(await m.onStateChange(myid1, state)).to.equal("write");
    });
});


describe("module to test: main => function to test: convertType", () => {
    it("converts Date to epoch number", () => {
        const d = new Date("2026-03-15T12:00:00Z");
        const result = m.convertType(d);
        expect(result).to.be.a("number");
        expect(result).to.equal(Number(d));
    });

    it("converts BigInt to string", () => {
        const result = m.convertType(BigInt(123456789));
        expect(result).to.equal("123456789");
    });

    it("converts Buffer to hex string", () => {
        const buf = Buffer.from([0xab, 0xcd, 0xef]);
        expect(m.convertType(buf)).to.equal("abcdef");
    });

    it("converts empty Buffer to empty string", () => {
        expect(m.convertType(Buffer.alloc(0))).to.equal("");
    });

    it("converts object to JSON string", () => {
        const obj = { decr_incr: 1, data: 3 };
        expect(m.convertType(obj)).to.equal('{"decr_incr":1,"data":3}');
    });

    it("passes through string unchanged", () => {
        expect(m.convertType("hello")).to.equal("hello");
    });

    it("passes through number unchanged", () => {
        expect(m.convertType(42)).to.equal(42);
        expect(m.convertType(0)).to.equal(0);
        expect(m.convertType(-1.5)).to.equal(-1.5);
    });

    it("passes through boolean unchanged", () => {
        expect(m.convertType(true)).to.equal(true);
        expect(m.convertType(false)).to.equal(false);
    });
});


describe("module to test: main => function to test: warnDuplicates (edge cases)", () => {
    it("returns empty string for empty array", () => {
        expect(m.warnDuplicates([])).to.equal("");
    });

    it("returns empty string when no duplicates", () => {
        const objects = [
            { _id: "a", type: "state" },
            { _id: "b", type: "state" },
            { _id: "c", type: "state" },
        ];
        expect(m.warnDuplicates(objects)).to.equal("");
    });

    it("returns empty string for single element", () => {
        expect(m.warnDuplicates([{ _id: "x" }])).to.equal("");
    });

    it("detects multiple different duplicates", () => {
        const objects = [
            { _id: "a" }, { _id: "a" },
            { _id: "b" }, { _id: "b" },
        ];
        const result = m.warnDuplicates(objects);
        expect(result).to.contain("a");
        expect(result).to.contain("b");
    });
});