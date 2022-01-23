"use strict";

/**
 * This is a TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.js-files
 * https://github.com/ioBroker/testing
 */

// tslint:disable:no-unused-expression

//unit under test:

const {
    expect
} = require("chai");
const {
    tests,
    utils
} = require("@iobroker/testing");
const { adapter, database } = utils.unit.createMocks();

// xx const main = require(__dirname + "/main");

// import { functionToTest } from "./moduleToTest";

describe("module to test: main  => function to test: warnDuplicates", () => {
    // initializing logic
    const expected = "New object with an already existing Group Address name has not been created: aaa";

    it(`should return ${expected}`, () => {

        let objects = [{
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

// xx         const result = main().warnDuplicates(objects);
// xx         expect(result).to.equal(expected);
        // or using the should() syntax
        //result.should.equal(expected);
    });

});


describe("module to test: main  => function to test: onStateChange", () => {
    // initializing logic
    const expected = "not a KNX object";

    it("compare onStateChange output to expected value", async () => {

        // Create an object in the fake db we will use in this test
        const theObject = {
            _id: "aaa",
            type: "state",
            common: {
                role: "whatever",
            },
        };
        database.publishObject(theObject);

// xx         main().gaList = {};
        //todo: add values to gaList
        //todo: test different types, date ...

        const id = "aaa";
        const state = {
            val: true,
            ack: false
        };
 // xx        const result = await main().onStateChange(id, state);

 // xx        expect(result).to.equal(expected);

    });

    // ... more tests => it
});

// ... more test suites => describe