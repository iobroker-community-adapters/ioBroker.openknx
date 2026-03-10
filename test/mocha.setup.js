// Don't silently swallow unhandled rejections
process.on("unhandledRejection", (e) => {
    throw e;
});

// Note: chai setup is handled by @iobroker/testing which brings its own chai@4
// The project's chai@6 is incompatible with the old plugin API
