/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

const log = require('log-driver').logger;
const util = require('util');
//
// DPT11.*: date
//
exports.formatAPDU = (value) => {
  if (!value) return log.error('cannot write null value for DPT11');
  switch (typeof value) {
    case 'string':
    case 'number':
      value = new Date(value);
      break;
    case 'object':
      // this expects the month property to be zero-based (January = 0, etc.)
      if (value instanceof Date) break;
      const { year, month, day } = value;
      value = new Date(parseInt(year), parseInt(month), parseInt(day));
  }
  if (isNaN(value.getDate()))
    return log.error(
      'Must supply a numeric timestamp, Date or String object for DPT11 Date'
    );

  const year = value.getFullYear();
  return Buffer.from([
    value.getDate(),
    value.getMonth() + 1,
    year - (year >= 2000 ? 2000 : 1900),
  ]);
};

exports.fromBuffer = (buf) => {
  if (buf.length != 3) return log.error('Buffer should be 3 bytes long');
  const day = buf[0] & 31; //0b00011111);
  const month = buf[1] & 15; //0b00001111);
  let year = buf[2] & 127; //0b01111111);
  year = year + (year > 89 ? 1900 : 2000);
  if (
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 1990 ||
    year > 2089
  ) {
    log.error(
      '%j => %d/%d/%d is not valid date according to DPT11, setting to 1990/01/01',
      buf,
      day,
      month,
      year
    );
    //return new Date(1990, 01, 01);
    throw new Error('Error converting date buffer to Date object.');
  }
  return new Date(year, month - 1, day);
};

// DPT11 base type info
exports.basetype = {
  bitlength: 24,
  valuetype: 'composite',
  desc: '3-byte date value',
};

// DPT11 subtypes info
exports.subtypes = {
  // 11.001 date
  '001': {
    name: 'DPT_Date',
    desc: 'Date',
  },
};
