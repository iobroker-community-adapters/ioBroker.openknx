
const path = require("path");
const {
    tests,
    utils
} = require("@iobroker/testing");

const xml = "'\"<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\"?>\r\n<GroupAddress-Export xmlns=\"http://knx.org/xml/ga-export/01\">\r\n<GroupAddress Name=\"dpt 222\" Address=\"31/0/37\" Description=\"dpt 222\" DPTs=\"DPT-222\" />\r\n</GroupAddress-Export>\"\'";
const adaptername = "openknx.0";
const objectid = adaptername + ".dpt_222'";

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
// Run tests
// Run tests
tests.integration(path.join(__dirname, ".."), {
    //            ~~~~~~~~~~~~~~~~~~~~~~~~~
    // This should be the adapter's root directory

    // If the adapter may call process.exit during startup, define here which exit codes are allowed.
    // By default, termination during startup is not allowed.
    allowedExitCodes: [11],

    // Define your own tests inside defineAdditionalTests
    // Since the tests are heavily instrumented, you need to create and use a so called "harness" to control the tests.
    defineAdditionalTests(getHarness) {
        // Create mocks and asserts
        const {
            adapter,
            database
        } = utils.unit.createMocks();
        const {
            assertObjectExists
        } = utils.unit.createAsserts(
            database,
            adapter,
        );

        describe("Test sendTo()", () => {

            it("works", () => {
                // Create an object in the fake db we will use in this test
                const theObject = {
                    _id: "whatever",
                    type: "state",
                    common: {
                        role: "whatever",
                    },
                };

                console.dir("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1111");
                database.publishObject(theObject);
                console.dir(database.states);
                // Do something that should be tested
                console.dir("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx44444");
                // Assert that the object still exists
                assertObjectExists(theObject._id);
            });



            it("first import, expect tree struct 1", () => {
                return new Promise(async (resolve) => {
                    // Create a fresh harness instance each test!
                    const harness = getHarness();
                    // Start the adapter and wait until it has started
                    await harness.startAdapterAndWait();
                    // Perform the actual test:
                    harness.sendTo(adaptername, "import", {
                        xml: xml,
                        onlyAddNewObjects: true
                    }, function (result) {
                        console.dir("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx4");
                        console.dir(result);

                        console.dir("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxassert");

                        database.getObject(objectid);

                        assertObjectExists(objectid);

                        resolve();



                    });
                });
            });

            /*
            it("modify local tree, only add new objects, expect tree struct 2 as is", () => {
                //prep:
                const object = {
                    _id: 'test.testin.dpt1_024',
                    type: 'overwritten'
                };

                this.setForeignObject(this.mynamespace + "." + object, (err, obj) => {});

                return new Promise(async (resolve) => {
                    // Create a fresh harness instance each test!
                    const harness = getHarness();
                    // Start the adapter and wait until it has started
                    await harness.startAdapterAndWait();

                    // Perform the actual test:
                    harness.sendTo(null, "import", {
                        xml: xml,
                        onlyAddNewObjects: false
                    }, function (result) {


                        console.dir(result);
                        resolve();
                    });
                });
            });


            it("import again, only add new objects false, expect tree struct 1", () => {
                return new Promise(async (resolve) => {
                    // Create a fresh harness instance each test!
                    const harness = getHarness();
                    // Start the adapter and wait until it has started
                    await harness.startAdapterAndWait();

                    // Perform the actual test:
                    harness.sendTo(null, "import", {
                        xml: xml,
                        onlyAddNewObjects: false
                    }, function (result) {


                        console.dir(result);
                        resolve();
                    });
                });
            });
*/
        });
    }

});