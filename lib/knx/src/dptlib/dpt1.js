/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

const log = require('log-driver').logger;

const custom_truthiness = (value) => {
  const f = parseFloat(value);
  return !isNaN(f) && isFinite(f) ? 
    f == 1.0 :                        // numeric values (in native and string form) are truthy if NOT zero 
    value === true || value === 'true';// non-numeric value truthiness is Boolean true or the string 'true'.
};

exports.formatAPDU = (value) => Buffer.from([custom_truthiness(value)]);

exports.fromBuffer = (buf) => {
  if (buf.length !== 1)
    return log.warn(
      'DPT1.fromBuffer: buf should be 1 byte (got ' + buf.length + ' bytes)',
      buf.length
    );
  return buf[0] !== 0;
};

// DPT basetype info hash
exports.basetype = {
  bitlength: 1,
  valuetype: 'basic',
  desc: '1-bit value',
};

//  DPT subtypes info hash
exports.subtypes = {
  '001': {
    use: 'G',
    name: 'DPT_Switch',
    desc: 'switch',
    enc: { 0: 'Off', 1: 'On' },
  },

  '002': {
    use: 'G',
    name: 'DPT_Bool',
    desc: 'bool',
    enc: { 0: 'False', 1: 'True' },
  },

  '003': {
    use: 'G',
    name: 'DPT_Enable',
    desc: 'enable',
    enc: { 0: 'Disable', 1: 'Enable' },
  },

  '004': {
    use: 'FB',
    name: 'DPT_Ramp',
    desc: 'ramp',
    enc: { 0: 'No ramp', 1: 'Ramp' },
  },

  '005': {
    use: 'FB',
    name: 'DPT_Alarm',
    desc: 'alarm',
    enc: { 0: 'No alarm', 1: 'Alarm' },
  },

  '006': {
    use: 'FB',
    name: 'DPT_BinaryValue',
    desc: 'binary value',
    enc: { 0: 'Low', 1: 'High' },
  },

  '007': {
    use: 'FB',
    name: 'DPT_Step',
    desc: 'step',
    enc: { 0: 'Decrease', 1: 'Increase' },
  },

  '008': {
    use: 'G',
    name: 'DPT_UpDown',
    desc: 'up/down',
    enc: { 0: 'Up', 1: 'Down' },
  },

  '009': {
    use: 'G',
    name: 'DPT_OpenClose',
    desc: 'open/close',
    enc: { 0: 'Open', 1: 'Close' },
  },

  '010': {
    use: 'G',
    name: 'DPT_Start',
    desc: 'start/stop',
    enc: { 0: 'Stop', 1: 'Start' },
  },

  '011': {
    use: 'FB',
    name: 'DPT_State',
    desc: 'state',
    enc: { 0: 'Inactive', 1: 'Active' },
  },

  '012': {
    use: 'FB',
    name: 'DPT_Invert',
    desc: 'invert',
    enc: { 0: 'Not inverted', 1: 'Inverted' },
  },

  '013': {
    use: 'FB',
    name: 'DPT_DimSendStyle',
    desc: 'dim send style',
    enc: { 0: 'Start/stop', 1: 'Cyclically' },
  },

  '014': {
    use: 'FB',
    name: 'DPT_InputSource',
    desc: 'input source',
    enc: { 0: 'Fixed', 1: 'Calculated' },
  },

  '015': {
    use: 'G',
    name: 'DPT_Reset',
    desc: 'reset',
    enc: { 0: 'no action(dummy)', 1: 'reset command(trigger)' },
  },

  '016': {
    use: 'G',
    name: 'DPT_Ack',
    desc: 'ack',
    enc: { 0: 'no action(dummy)', 1: 'acknowledge command(trigger)' },
  },

  '017': {
    use: 'G',
    name: 'DPT_Trigger',
    desc: 'trigger',
    enc: { 0: 'trigger', 1: 'trigger' },
  },

  '018': {
    use: 'G',
    name: 'DPT_Occupancy',
    desc: 'occupancy',
    enc: { 0: 'not occupied', 1: 'occupied' },
  },

  '019': {
    use: 'G',
    name: 'DPT_WindowDoor',
    desc: 'open window/door',
    enc: { 0: 'closed', 1: 'open' },
  },

  '021': {
    use: 'FB',
    name: 'DPT_LogicalFunction',
    desc: 'and/or',
    enc: { 0: 'logical function OR', 1: 'logical function AND' },
  },

  '022': {
    use: 'FB',
    name: 'DPT_Scene_AB',
    desc: 'scene A/B',
    enc: { 0: 'scene A', 1: 'scene B' },
  },

  '023': {
    use: 'FB',
    name: 'DPT_ShutterBlinds_Mode',
    desc: 'shutter/blinds mode',
    enc: {
      0: 'only move Up/Down mode (shutter)',
      1: 'move Up/Down + StepStop mode (blind)',
    },
  },

  '024': {
    use: 'G',
    name: 'DPT_DayNight',
    desc: 'Day Night',
    enc: {
      0: 'Day',
      1: 'Night',
    },
  },
};
