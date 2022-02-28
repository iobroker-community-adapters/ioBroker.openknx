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

function dummy() {
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
        //console.dir(msg);
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

class Datapoint {
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
}


const {
    expect
} = require("chai");
const {
    tests,
    utils,
    MockDatabase
} = require("@iobroker/testing");
const {
    adapter,
    database
} = utils.unit.createMocks();

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let result;

describe("module to test: main  => function to test: warnDuplicates", () => {
    // initializing logic
    const expected = "New object with an already existing Group Address name has not been used: aaa";

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

        const result = main().warnDuplicates(objects);
        expect(result).to.equal(expected);
        // or using the should() syntax
        //result.should.equal(expected);
    });

});


describe("module to test: main  => function to test: onStateChange", () => {
    // initializing logic

    main().setState = dummy;
    main().getStateAsync = dummy;
    main().getState = getState;
    main().knxConnection = new mockKnxConnection();
    main().log = new log();
    main().config = {
        gwip: "1.1.1.1",
        gwipport: "1234"
    };

    // Create an object in the fake db we will use in this test
    //const myid = "openknx.0.id1";
    const namespace = main().namespace;
    const myid = namespace + "." + "test2";

    const theObject = {
        _id: myid,
        type: "state",
        common: {
            role: "whatever",
            write: true,
            type: "boolean",
        },
        native: {
            address: "99/0/0",
            "dpt": "DPT1",
        }
    };

    main().setObjectAsync(myid, theObject, () => {});

    it("check onStateChange triggers write", async () => {

        const expected = "write";

        main().setState = dummy; //set again here it is overwritten, unlcear why
        main().log  = new log();
        main().main(false);
        await wait(50);

        const state = {
            val: "a",
            ack: false,
            ts: 0,
            lc: 0
        };

        main().getStateAsync = dummy; //set again here it is overwritten, unlcear why
        result = await main().onStateChange(myid, state);
        expect(result).to.equal(expected);
    });

    // ... more tests => it
});


describe("module to test: main  => function to test: event", () => {
    // initializing logic

    it("check event GroupValue_Read GroupValue_Write GroupValue_Response", async () => {
        const expected = "GroupValue_Read";
        const expected2 = "GroupValue_Write";
        const expected3 = "GroupValue_Response";

        const knx = new mockKnx();
        main().knx = knx;
        main().knx.Datapoint = Datapoint;
        main().setState = dummy; //set again here it is overwritten, unlcear why needed
        main().main(true);
        await wait(50);
        knx.connected();
        await wait(50);
        main().connected = true;
        main().getState = getState; //set again here it is overwritten, unlcear why needed
        result = knx.event("GroupValue_Read", "src", "99/0/0", "");
        await wait(50);

        expect(callbackRes).to.equal(expected);

        result = knx.event("GroupValue_Write", "src", "99/0/0", "");
        await wait(50);

        expect(result).to.equal(expected2);

        main().connected = true;
        result = knx.event("GroupValue_Response", "src", "99/0/0", "");
        await wait(50);

        expect(result).to.equal(expected3);
    });


    // ... more tests => it
});
// ... more test suites => describe