// Don't silently swallow unhandled rejections
process.on("unhandledRejection", (e) => {
    throw e;
});

// enable the should interface with chai
const { should } = require("chai");
should();