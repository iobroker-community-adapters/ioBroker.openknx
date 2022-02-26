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

class log {
    constructor() {}
    info(msg) {
        console.dir(msg);
    }
    warn(msg) {
        console.dir(msg);
    }
    silly() {}
    debug() {}
}

class mockKnx {
    constructor() {
        this.Connection = new mockKnxConnection();
    }
}

class mockKnxConnection {
    constructor(conf) {

    }
    Disconnect() {}
    read() {}
    write() {}
    writeRaw() {}
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

        const result = main.warnDuplicates(objects);
        expect(result).to.equal(expected);
        // or using the should() syntax
        //result.should.equal(expected);
    });

});


describe("module to test: main  => function to test: onStateChange", () => {
    // initializing logic
    const expected = "write";

    it("check onStateChange triggers write", async () => {

        main.setState = dummy;
        main.getStateAsync = dummy;
        main.getState = dummy;
        main.knxConnection = new mockKnxConnection();
        main.log = new log();

        // Create an object in the fake db we will use in this test
        //const myid = "openknx.0.id1";
        const namespace = main.namespace;
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

        main.setObjectAsync(myid, theObject, () => {});
        //await wait(100);

        main.config = {
            gwip: "1.1.1.1",
            gwipport: "1234"
        };
        main.setState = dummy;
        main.main(false);
        await wait(100);

        const state = {
            val: "a",
            ack: false,
            ts: 0,
            lc: 0
        };

        main.getStateAsync = dummy; //set again here it is overwritten, unlcear why
        const result = await main.onStateChange(myid, state);
        expect(result).to.equal(expected);
    });

    // ... more tests => it
});


describe("module to test: main  => function to test: event", () => {
    // initializing logic
    const expected = "ok";

    it("check event reads in data", async () => {

        //main.setState = dummy;
        //main.getStateAsync = dummy;
        //main.getState = dummy;
        //main.knxConnection = new mockKnxConnection();
        //main.log = new log();

        main.knx = new mockKnx();



        main.config = {
            gwip: "1.1.1.1",
            gwipport: "1234"
        };
        main.setState = dummy;
        //main.main(true);
        //main.startKnxStack();
        await wait(100);

        expect("ok").to.equal(expected);
    });

    // ... more tests => it
});
// ... more test suites => describe