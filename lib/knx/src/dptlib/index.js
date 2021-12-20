/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

/*
Datatypes
=========
KNX/EIB Function                   Information length      EIS        DPT     Value
Switch                             1 Bit                   EIS 1      DPT 1	0,1
Dimming (Position, Control, Value) 1 Bit, 4 Bit, 8 Bit     EIS 2	    DPT 3	[0,0]...[1,7]
Time                               3 Byte                  EIS 3	    DPT 10
Date                               3 Byte                  EIS 4      DPT 11
Floating point                     2 Byte                  EIS 5	    DPT 9	-671088,64 - 670760,96
8-bit unsigned value               1 Byte                  EIS 6	    DPT 5	0...255
8-bit unsigned value               1 Byte                  DPT 5.001	DPT 5.001	0...100
Blinds / Roller shutter            1 Bit                   EIS 7	    DPT 1	0,1
Priority                           2 Bit                   EIS 8	    DPT 2	[0,0]...[1,1]
IEEE Floating point                4 Byte                  EIS 9	    DPT 14	4-Octet Float Value IEEE 754
16-bit unsigned value              2 Byte                  EIS 10	    DPT 7	0...65535
16-bit signed value                2 Byte                  DPT 8	    DPT 8	-32768...32767
32-bit unsigned value              4 Byte                  EIS 11	    DPT 12	0...4294967295
32-bit signed value                4 Byte                  DPT 13	    DPT 13	-2147483648...2147483647
Access control                     1 Byte                  EIS 12	    DPT 15
ASCII character                    1 Byte                  EIS 13	    DPT 4
8859_1 character                   1 Byte                  DPT 4.002	DPT 4.002
8-bit signed value                 1 Byte                  EIS 14	    DPT 6	-128...127
14 character ASCII                 14 Byte                 EIS 15	    DPT 16
14 character 8859_1                14 Byte                 DPT 16.001	DPT 16.001
Scene                              1 Byte                  DPT 17	    DPT 17	0...63
HVAC                               1 Byte                  DPT 20	    DPT 20	0..255
Unlimited string 8859_1            .                       DPT 24	    DPT 24
List 3-byte value                  3 Byte                  DPT 232	  DPT 232	RGB[0,0,0]...[255,255,255]
*/
const fs = require('fs');
const path = require('path');
const util = require('util');
const log = require('log-driver').logger;

const dpts = {};
for (const entry of fs.readdirSync(__dirname)) {
  const matches = entry.match(/(dpt.*)\.js/);
  if (!matches) continue;
  const dptid = matches[1].toUpperCase(); // DPT1..DPTxxx
  const mod = require(__dirname + path.sep + entry);
  if (
    !mod.hasOwnProperty('basetype') ||
    !mod.basetype.hasOwnProperty('bitlength')
  )
    throw 'incomplete ' + dptid + ', missing basetype and/or bitlength!';
  mod.id = dptid;
  dpts[dptid] = mod;
  //log.trace('DPT library: loaded %s (%s)', dptid, dpts[dptid].basetype.desc);
}

// a generic DPT resolution function
// DPTs might come in as 9/"9"/"9.001"/"DPT9.001"
dpts.resolve = (dptid) => {
  const m = dptid
    .toString()
    .toUpperCase()
    .match(/^(?:DPT)?(\d+)(\.(\d+))?$/);
  if (m === null)
    return null; //throw 'Invalid DPT format: ' + dptid; todo test

  const dpt = dpts[util.format('DPT%s', m[1])];
  if (!dpt) 
  return null;  //throw 'Unsupported DPT: ' + dptid; todo test

  const cloned_dpt = cloneDpt(dpt);
  if (m[3]) {
    cloned_dpt.subtypeid = m[3];
    cloned_dpt.subtype = cloned_dpt.subtypes[m[3]];
  }

  return cloned_dpt;
};

/* POPULATE an APDU object from a given Javascript value for the given DPT
 * - either by a custom DPT formatAPDU function
 * - or by this generic version, which:
 * --  1) checks if the value adheres to the range set from the DPT's bitlength
 *
 */
dpts.populateAPDU = (value, apdu, dptid) => {
  const dpt = dpts.resolve(dptid || 'DPT1');
  const nbytes = Math.ceil(dpt.basetype.bitlength / 8);
  apdu.data = Buffer.alloc(nbytes);
  apdu.bitlength = (dpt.basetype && dpt.basetype.bitlength) || 1;
  let tgtvalue = value;
  // get the raw APDU data for the given JS value
  if (typeof dpt.formatAPDU == 'function') {
    // nothing to do here, DPT-specific formatAPDU implementation will handle everything
    // log.trace('>>> custom formatAPDU(%s): %j', dptid, value);
    apdu.data = dpt.formatAPDU(value);
    // log.trace('<<< custom formatAPDU(%s): %j', dptid, apdu.data);
    return apdu;
  }

  if (!isFinite(value))
    throw util.format('Invalid value, expected a %s', dpt.desc);
  // check if value is in range, be it explicitly defined or implied from bitlength
  const [r_min, r_max] = dpt.basetype.hasOwnProperty('range') ?
    dpt.basetype.range :
    [0, Math.pow(2, dpt.basetype.bitlength) - 1]; // TODO: Maybe bitshift instead of pow?
  // is there a scalar range? eg. DPT5.003 angle degrees (0=0, ff=360)
  if (
    dpt.hasOwnProperty('subtype') &&
    dpt.subtype.hasOwnProperty('scalar_range')
  ) {
    const [s_min, s_max] = dpt.subtype.scalar_range;
    if (value < s_min || value > s_max) {
      log.trace(
        'Value %j(%s) out of scalar range(%j) for %s',
        value,
        typeof value,
        scalar,
        dpt.id
      );
    } else {
      // convert value from its scalar representation
      // e.g. in DPT5.001, 50(%) => 0x7F , 100(%) => 0xFF
      const a = (s_max - s_min) / (r_max - r_min);
      const b = s_min - r_min;
      tgtvalue = Math.round((value - b) / a);
    }
  }
  // just a plain numeric value, only check if within bounds
  else if (value < r_min || value > r_max) {
    log.trace(
      'Value %j(%s) out of bounds(%j) for %s.%s',
      value,
      typeof value,
      range,
      dpt.id,
      dpt.subtypeid
    );
  }

  // generic APDU is assumed to convey an unsigned integer of arbitrary bitlength
  if (
    dpt.basetype.hasOwnProperty('signedness') &&
    dpt.basetype.signedness == 'signed'
  ) {
    apdu.data.writeIntBE(tgtvalue, 0, nbytes);
  } else {
    apdu.data.writeUIntBE(tgtvalue, 0, nbytes);
  }

  // log.trace('generic populateAPDU tgtvalue=%j(%s) nbytes=%d => apdu=%j', tgtvalue, typeof tgtvalue, nbytes, apdu);
};

/* get the correct Javascript value from a APDU buffer for the given DPT
 * - either by a custom DPT formatAPDU function
 * - or by this generic version, which:
 * --  1) checks if the value adheres to the range set from the DPT's bitlength
 */
dpts.fromBuffer = (buf, dpt) => {
  // sanity check
  if (!dpt) 
  //todothrow util.format('DPT %s not found', dpt);
  return buf;
  
  
  // get the raw APDU data for the given JS value
  if (typeof dpt.fromBuffer == 'function') {
    // nothing to do here, DPT-specific fromBuffer implementation will handle everything
    return dpt.fromBuffer(buf);
  }
  // log.trace('%s buflength == %d => %j', typeof buf, buf.length, JSON.stringify(buf) );
  if (buf.length > 6) {
    throw 'cannot handle unsigned integers more then 6 bytes in length';
  }
  let value = 0;
  if (
    dpt.basetype.hasOwnProperty('signedness') &&
    dpt.basetype.signedness == 'signed'
  )
    value = buf.readIntBE(0, buf.length);
  else value = buf.readUIntBE(0, buf.length);

  // log.trace(' ../knx/src/index.js : DPT : ' + JSON.stringify(dpt));   // for exploring dpt and implementing description
  if (
    dpt.hasOwnProperty('subtype') &&
    dpt.subtype.hasOwnProperty('scalar_range')
  ) {
    const [r_min, r_max] = dpt.basetype.hasOwnProperty('range') ?
      dpt.basetype.range :
      [0, Math.pow(2, dpt.basetype.bitlength) - 1];
    const [s_min, s_max] = dpt.subtype.scalar_range;
    // convert value from its scalar representation
    // e.g. in DPT5.001, 50(%) => 0x7F , 100(%) => 0xFF
    const a = (s_max - s_min) / (r_max - r_min);
    const b = s_min - r_min;
    value = Math.round(a * value + b);
    //log.trace('fromBuffer scalar a=%j b=%j %j', a,b, value);
  }

  //  log.trace('generic fromBuffer buf=%j, value=%j', buf, value);
  return value;
};

const cloneDpt = (d) => {
  const {
    fromBuffer,
    formatAPDU
  } = d;
  return {
    ...JSON.parse(JSON.stringify(d)),
    fromBuffer,
    formatAPDU
  };
};

module.exports = dpts;