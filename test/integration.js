"use strict";

const path = require("path");
const { tests, utils } = require("@iobroker/testing");
const { doesNotMatch } = require("assert");

const xml =
    '\'"<?xml version="1.0" encoding="utf-8" standalone="yes"?>\r\n<GroupAddress-Export xmlns="http://knx.org/xml/ga-export/01">\r\n<GroupAddress Name="dpt 222" Address="0/0/0" Description="dpt 222" DPTs="DPT-222" />\r\n</GroupAddress-Export>"\'';
const xml2 =
    '\'"<?xml version="1.0" encoding="utf-8" standalone="yes"?>\r\n<GroupAddress-Export xmlns="http://knx.org/xml/ga-export/01">\r\n<GroupAddress Name="dpt 222" Address="1/1/1" Description="dpt 222" DPTs="DPT-222" />\r\n</GroupAddress-Export>"\'';
const adaptername = "openknx.0";
const objectid = adaptername + ".dpt_222";
const settings = {
    native: {
        gwip: "127.0.0.1",
        gwipport: 3671,
        minimumDelay: 40,
        bind: "127.0.0.1",
        eibadr: "1.1.1",
        onlyAddNewObjects: true,
        removeUnusedObjects: false,
    },
};

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
// Run tests
// Run tests
//      harness.states.setState(objectid, "1", (err, state) => {
//      harness.objects.getObject(objectid, async (err, obj) => {
//

tests.integration(path.join(__dirname, ".."), {
    //            ~~~~~~~~~~~~~~~~~~~~~~~~~
    // This should be the adapter's root directory

    // If the adapter may call process.exit during startup, define here which exit codes are allowed.
    // By default, termination during startup is not allowed.
    allowedExitCodes: [11],

    // To test against a different version of JS-Controller, you can change the version or dist-tag here.
    // Make sure to remove this setting when you're done testing.
    controllerVersion: "latest", // or a specific version like "4.0.1"

    // Define your own tests inside defineAdditionalTests
    defineAdditionalTests({ suite }) {
        // All tests (it, describe) must be grouped in one or more suites. Each suite sets up a fresh environment for the adapter tests.
        // At the beginning of each suite, the databases will be reset and the adapter will be started.
        // The adapter will run until the end of each suite.

        // Since the tests are heavily instrumented, each suite gives access to a so called "harness" to control the tests.
        suite("Test sendTo()", (getHarness) => {
            // For convenience, get the current suite's harness before all tests
            let harness;
            before(() => {
                // Create a fresh harness instance each test!
                harness = getHarness();
                harness.objects.extendObject("system.adapter." + adaptername, settings);
            });

            it("Should give back a successful response; should not overwrite object value; should overwrite object value", () => {
                return new Promise(async (resolve, reject) => {
                    // Start the adapter and wait until it has started
                    await harness.startAdapterAndWait();

                    // Perform the actual test:
                    testStep1(harness, reject, resolve);

                    //harness.sendTo("adapter.0", "test", "message", (resp) => {
                    //  console.dir(resp);
                    //  resolve();
                    //});
                });
            });

            function testStep1(harness, reject, resolve) {
                harness.sendTo(
                    adaptername,
                    "import",
                    {
                        xml: xml,
                        onlyAddNewObjects: false,
                    },
                    (resp) => {
                        if (resp.err == null && resp.count == 1) {
                            console.dir("****************** resolve1");
                            //do import
                            testStep2(harness, reject, resolve);
                        } else {
                            reject(new Error(`Expected import count 1 with no error"`));
                        }
                    },
                );
            }

            function testStep2(harness, reject, resolve) {
                harness.sendTo(
                    adaptername,
                    "import",
                    {
                        xml: xml2,
                        onlyAddNewObjects: true,
                    },
                    (resp) => {
                        if (resp.err == null && resp.count == 1) {
                            console.dir("****************** resolve2");
                            testStep3(harness, reject, resolve);
                        } else {
                            reject(new Error(`Expected import count 1 with no error"`));
                        }
                    },
                );
            }

            function testStep3(harness, reject, resolve) {
                //check if dpt_222 was generated
                harness.objects.getObject(objectid, async (err, obj) => {
                    //check if the value is same
                    console.dir("object changed to " + obj.native.address);
                    if (obj.native.address == "0/0/0") {
                        console.dir("****************** resolve3");
                        testStep4(harness, reject, resolve);
                    } else {
                        console.dir("****************** 3 unresolve");
                    }
                });
            }

            function testStep4(harness, reject, resolve) {
                harness.sendTo(
                    adaptername,
                    "import",
                    {
                        xml: xml2,
                        onlyAddNewObjects: false,
                    },
                    (resp) => {
                        if (resp.err == null && resp.count == 1) {
                            console.dir("****************** resolve4");
                            //do import
                            testStep5(harness, reject, resolve);
                        } else {
                            reject(new Error(`Expected import count 1 with no error"`));
                        }
                    },
                );
            }

            function testStep5(harness, reject, resolve) {
                //check if dpt_222 was generated
                harness.objects.getObject(objectid, async (err, obj) => {
                    //check if the value is same
                    console.dir("object changed to " + obj.native.address);
                    if (obj.native.address != "0/0/0") {
                        resolve();
                        console.dir("****************** resolve5");
                    } else {
                        console.dir("****************** 5 unresolve");
                        reject();
                    }
                });
            }
        });

        // While developing the tests, you can run only a single suite using `suite.only`...
        suite.only("Only this will run", (getHarness) => {
            // ...
        });
        // ...or prevent a suite from running using `suite.skip`:
        suite.skip("This will never run", (getHarness) => {
            // ...
        });
    },
});
