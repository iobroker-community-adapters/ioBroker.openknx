/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

const log = require('log-driver').logger;

//
// DPT10.*: time (3 bytes)
//
const util = require('util');
const timeRegexp = /(\d{1,2}):(\d{1,2}):(\d{1,2})/;

// DPTFrame to parse a DPT10 frame.
// Always 8-bit aligned.

exports.formatAPDU = (value) => {
  let dow, hour, minute, second;
  // day of week. NOTE: JS Sunday = 0
  switch (typeof value) {
    case 'string':
      // try to parse
      match = timeRegexp.exec(value);
      if (match) {
        dow = ((new Date().getDay() - 7) % 7) + 7;
        hour = parseInt(match[1]);
        minute = parseInt(match[2]);
        second = parseInt(match[3]);
      } else {
        log.warn('DPT10: invalid time format (%s)', value);
      }
      break;
    case 'object':
      if (value.constructor.name != 'Date') {
        log.warn('Must supply a Date or String for DPT10 time');
        break;
      }
    case 'number':
      value = new Date(value);
    default:
      dow = ((value.getDay() - 7) % 7) + 7;
      hour = value.getHours();
      minute = value.getMinutes();
      second = value.getSeconds();
  }

  return Buffer.from([(dow << 5) + hour, minute, second]);
};

// return a JS Date from a DPT10 payload, with DOW/hour/month/seconds set to the buffer values.
// The week/month/year are inherited from the current timestamp.
exports.fromBuffer = (buf) => {
  if (buf.length != 3) return log.warn('DPT10: Buffer should be 3 bytes long');
  const [dnh, minutes, seconds] = buf;
  const dow = (dnh & 0b11100000) >> 5;
  const hours = dnh & 0b00011111;
  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  )
    return log.warn(
      'DPT10: buffer %j (decoded as %d:%d:%d) is not a valid time',
      buf,
      hours,
      minutes,
      seconds
    );

  const d = new Date();
  if (d.getDay() !== dow)
    // adjust day of month to get the day of week right
    d.setDate(d.getDate() + dow - d.getDay());
  // TODO: Shouldn't this be UTCHours?
  d.setHours(hours, minutes, seconds);
  return d;
};

// DPT10 base type info
exports.basetype = {
  bitlength: 24,
  valuetype: 'basic', //changed, misleading, unsing Date object as (receive) interface
  desc: 'day of week + time of day',
};

// DPT10 subtypes info
exports.subtypes = {
  // 10.001 time of day
  '001': {
    name: 'DPT_TimeOfDay',
    desc: 'time of day',
  },
};
