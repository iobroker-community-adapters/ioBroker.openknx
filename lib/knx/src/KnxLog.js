/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */
const util = require('util');
let logger;

const create = (options) => {
  const level =
    (options && (options.debug ? 'debug' : options.loglevel)) || 'info';
  //console.trace('new logger, level='+lvl);
  return require('log-driver')({
    level,
    format(lvl, msg /*string*/, ...a) {
      // lvl is the log level ie 'debug'
      const ts = new Date().toISOString().replace(/T/, ' ').replace(/Z$/, '');
      return a.length
        ? // if more than one item to log, assume msg is a fmt string
          util.format('[%s] %s ' + msg, lvl, ts, ...a)
        : // otherwise, msg is a plain string
          util.format('[%s] %s %s', lvl, ts, msg);
    },
  });
};

module.exports = {
  get: (options) => logger || (logger = create(options)),
};
