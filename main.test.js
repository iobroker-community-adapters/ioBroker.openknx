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

class mockDatapoint {
    constructor(options, conn) {}
    on() {}
}

class mockKnx {
    constructor() {}

    Connection(options) {
        this.connected = options.handlers.connected;
        this.disconnected = options.handlers.disconnected;
        this.event = options.handlers.event;
    }
    // event(/** @type {string} */ evt, /** @type {string} */ src, /** @type {string} */ dest, /** @type {string} */ val){}
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
const EventEmitter = require("events");
const {
    exit
} = require("process");
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
            "dpt": "DPT3",
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

    // ... more tests => it
});


describe("module to test: main  => function to test: event", () => {
    // initializing logic

    it("check event GroupValue_Read GroupValue_Write GroupValue_Response", async () => {

        m.setState = setState;
        m.getStateAsync = dummy;
        m.getState = getState;
        m.log = new log();
        m.knxConnection = new mockKnxConnection();
        m.config = {
            gwip: "1.1.1.1",
            gwipport: "1234"
        };

        const expected = "GroupValue_Read";
        const expected2 = "GroupValue_Write";
        const expected3 = "GroupValue_Response";
        const expected4 = "GroupValue_Read Respond";

        m.knx = new mockKnx();
        m.knx.Datapoint = mockDatapoint;
        m.knxConnection = new mockKnxConnection();
        m.startKnxStack();
        m.knx.connected();

        setStateAck = "";
        result = m.knx.event("GroupValue_Read", "src", "0/0/1", "");
        expect(callbackRes).to.equal(expected);
        expect(setStateAck).to.equal("");

        setStateAck = "";
        result = m.knx.event("GroupValue_Write", "src", "0/0/1", "");
        expect(result).to.equal(expected2);
        expect(setStateAck).to.equal(true);

        setStateAck = "";
        result = m.knx.event("GroupValue_Response", "src", "0/0/1", "");
        expect(result).to.equal(expected3);
        expect(setStateAck).to.equal(true);

        setStateAck = "";
        m.knxConnection = new mockKnxConnection(); //set again here it is overwritten, unlcear why needed
        result = m.knx.event("GroupValue_Read", "src", "0/0/2", "");
        expect(callbackRes).to.equal(expected4);
        expect(setStateAck).to.equal("");

    });


    // ... more tests => it

});

// ... more test suites => describe