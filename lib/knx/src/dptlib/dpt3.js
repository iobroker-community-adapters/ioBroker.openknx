/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

const log = require('log-driver').logger;

//
// DPT3.*: 4-bit dimming/blinds control
//
exports.formatAPDU = (value) => {
  if (value == null) return log.warn('DPT3: cannot write null value');

  if (
    typeof value == 'object' &&
    value.hasOwnProperty('decr_incr') &&
    value.hasOwnProperty('data')
  )
    return Buffer.from([(value.decr_incr << 3) + (value.data & 0b00000111)]);

  log.error('DPT3: Must supply a value object of {decr_incr, data}');
  // FIXME: should this return zero buffer when error? Or nothing?
  return Buffer.from([0]);
};

exports.fromBuffer = (buf) => {
  if (buf.length != 1) return log.error('DPT3: Buffer should be 1 byte long');
  
  return {
    decr_incr: (buf[0] & 0b00001000) >> 3,
    data: buf[0] & 0b00000111,
  };
};

exports.basetype = {
  bitlength: 4,
  valuetype: 'composite',
  desc: '4-bit relative dimming control',
};

exports.subtypes = {
  // 3.007 dimming control
  '007': {
    name: 'DPT_Control_Dimming',
    desc: 'dimming control',
  },

  // 3.008 blind control
  '008': {
    name: 'DPT_Control_Blinds',
    desc: 'blinds control',
  },
};
