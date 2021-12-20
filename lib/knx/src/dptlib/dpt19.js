/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

const log = require('log-driver').logger;

// TODO: implement fromBuffer, formatAPDU

//
// DPT19: 8-byte Date and Time
//

exports.formatAPDU = (value) => {
  if (!(value instanceof Date))
    return log.error('DPT19: Must supply a Date object');

  // Sunday is 0 in Javascript, but 7 in KNX.
  const day = value.getDay() === 0 ? 7 : value.getDay();
  return Buffer.from([
    value.getFullYear() - 1900,
    value.getMonth() + 1,
    value.getDate(),
    (day << 5) + value.getHours(),
    value.getMinutes(),
    value.getSeconds(),
    0,
    0,
  ]);
};

exports.fromBuffer = (buf) => {
  if (buf.length !== 8) return log.warn('DPT19: Buffer should be 8 bytes long');
  return new Date(
    buf[0] + 1900,
    buf[1] - 1,
    buf[2],
    buf[3] & 0b00011111,
    buf[4],
    buf[5]
  );
};

exports.basetype = {
  bitlength: 64,
  valuetype: 'composite',
  desc: '8-byte Date+Time',
};

exports.subtypes = {
  // 19.001
  '001': {
    name: 'DPT_DateTime',
    desc: 'datetime',
  },
};
