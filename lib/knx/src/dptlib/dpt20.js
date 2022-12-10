/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

const log = require('log-driver').logger;

//
// DPT20: 1-byte HVAC
//
// FIXME: help needed
exports.formatAPDU = (value) => {
  log.debug('./knx/src/dpt20.js : input value = ' + value);
  return Buffer.from([value]);
};

exports.fromBuffer = (buf) => {
  if (buf.length !== 1) throw 'Buffer should be 1 bytes long';
  const ret = buf.readUInt8(0);
  log.debug('               dpt20.js   fromBuffer : ' + ret);
  return ret;
};

exports.basetype = {
  bitlength: 8,
  range: [,],
  valuetype: 'basic',
  desc: '1-byte',
};

exports.subtypes = {
  '001': { //ID
    use: 'FB', //Use
    name: 'DPT_SCLOMode',  //Name
    desc: 'SCLOMode', //Encoding field1
    range: [0, 3], //Range
    enc: { 0: 'autonomous', 1: 'slave', 2: 'master', 3: 'not used'}, //Encoding
  }
},

exports.subtypes = {
    '002': { //ID
      use: 'G', //Use
      name: 'DPT_BuildingMode',  //Name
      desc: 'DBuildingMode', //Encoding field1
      range: [0, 3], //Range
      enc: { 0: 'Building in use', 1: 'Building not used', 2: 'Building protection'}, //Encoding
    }
},

exports.subtypes = {
  '003': { //ID
    use: 'G', //Use
    name: 'DPT_OccMode',  //Name
    desc: 'OccMode', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'occupied', 1: 'standby', 2: 'not occupied'}, //Encoding
  }
},

exports.subtypes = {
  '004': { //ID
    use: 'FB', //Use
    name: 'DPT_Priority',  //Name
    desc: 'Priority', //Encoding field1
    range: [0, 3], //Range
    enc: { 0: 'High', 1: 'Medium', 2: 'Low', 3: 'void'}, //Encoding
  }
},

exports.subtypes = {
  '005': { //ID
    use: 'FB', //Use
    name: 'DPT_LightApplicationMode',  //Name
    desc: 'Application Mode', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'normal', 1: 'presence simulation', 2: 'night round'}, //Encoding
  }
},

exports.subtypes = {
  '006': { //ID
    use: 'FB', //Use
    name: 'DPT_ApplicationArea',  //Name
    desc: 'ApplicationArea', //Encoding field1
    range: [0, 50], //Range
    enc: { 
      0: 'no fault', 
      1: 'system and functions of common interest', 
      10: 'system and functions of common interest',
      11 : 'HVAC Hot Water Heating',
      12 : 'HVAC Direct Electrical Heating',
      13 : 'HVAC Terminal Units',
      14 : 'HVAC VAC',
      20 : 'Lighting',
      30 : 'Security',
      40 : 'Load Management',
      50 : 'Shutters and blinds'
    }, //Encoding
  }
},

exports.subtypes = {
  '007': { //ID
    use: 'FB', //Use
    name: 'AlarmClassType',  //Name
    desc: 'DPT_AlarmClassType', //Encoding field1
    range: [0, 3], //Range
    enc: { 0: 'reserved (not used)', 1: 'simple alarm', 2: 'basic alarm', 3: 'extended alarm'}, //Encoding
  }
},

exports.subtypes = {
  '008': { //ID
    use: 'System', //Use
    name: 'DPT_PSUMode',  //Name
    desc: 'PSUMode', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'disabled (PSU/DPSU fixed off)', 1: ': enabled (PSU/DPSU fixed on)', 2: 'auto (PSU/DPSU automatic on/off)'}, //Encoding
  }
},

exports.subtypes = {
  '011': { //ID
    use: 'FB', //Use
    name: 'DPT_ErrorClass_System',  //Name
    desc: 'ErrorClass_System', //Encoding field1
    range: [0, 18], //Range
    enc: {
      0 : 'no fault',
      1 : 'general device fault (e.g. RAM, EEPROM, UI, watchdog, …)',
      2 : 'communication fault',
      3 : 'configuration fault',
      4 : 'hardware fault',
      5 : 'software fault',
      6 : 'insufficient non volatile memory',
      7 : 'insufficient volatile memory',
      8 : 'memory allocation command with size 0 received',
      9 : 'CRC-error',
      10 : 'watchdog reset detected',
      11 : 'invalid opcode detected',
      12 : 'general protection fault',
      13 : 'maximal table length exceeded',
      14 : 'undefined load command received',
      15 : 'Group Address Table is not sorted',
      16 : 'invalid connection number (TSAP)',
      17 : 'invalid Group Object number (ASAP)',
      18 : 'Group Object Type exceeds (PID_MAX_APDU_LENGT H – 2)',
     }, //Encoding
  }
},

exports.subtypes = {
  '012': { //ID
    use: 'FB', //Use
    name: 'DPT_ErrorClass_HVAC',  //Name
    desc: 'AlarmClass_HVAC', //Encoding field1
    range: [0, 4], //Range
    enc: { 0: 'no fault', 1: 'sensor fault', 2: ': process fault / controller fault', 3: 'actuator fault', 4: 'other fault'}, //Encoding
  }
},

exports.subtypes = {
  '013': { //ID
    use: 'FB', //Use
    name: 'DPT_Time_Delay',  //Name
    desc: 'Time_Delay', //Encoding field1
    range: [0, 25], //Range
    enc: { 
      0 : 'not active',
      1 : '1 s',
      2 : '2 s',
      3 : '3 s',
      4 : '5 s',
      5 : '10 s',
      6 : '15 s',
      7 : '20 s',
      8 : '30 s',
      9 : '45 s',
      10 : '1 min',
      11 : '1,25 min',
      12 : '1,5 min',
      13 : '2 min',
      14 : '2,5 min',
      15 : '3 min',
      16 : '5 min',
      17 : '15 min',
      18 : '20 min',
      19 : '30 min',
      20 : '1 h',
      21 : '2 h',
      22 : '3 h',
      23 : '5 h',
      24 : '12 h',
      25 : '24 h'
     }, //Encoding
  }
},

exports.subtypes = {
  '014': { //ID
    use: 'G', //Use
    name: 'DPT_Beaufort_Wind_Force',  //Name
    desc: 'Wind Force Scale', //Encoding field1
    range: [0, 12], //Range
    enc: { 
      0 : 'calm (no wind)',
      1 : 'light air',
      2 : 'light breeze',
      3 : 'gentle breeze',
      4 : 'moderate breeze',
      5 : 'fresh breeze',
      6 : 'strong breeze',
      7 : 'near gale / moderate gale',
      8 : 'fresh gale',
      9 : 'strong gale',
      10 : 'whole gale / storm',
      11 : 'violent storm',
      12 : 'hurricane'
     }, //Encoding
  }
},

exports.subtypes = {
  '017': { //ID
    use: 'G', //Use
    name: 'DPT_SensorSelect',  //Name
    desc: 'SensorSelect', //Encoding field1
    range: [0, 4], //Range
    enc: { 
      0: 'inactive',
      1: 'digital input not inverted',
      2: 'digital input inverted', 
      3: 'analog input -> 0 % to 100%',
      4: 'temperature sensor input'
    }, //Encoding
  }
},

exports.subtypes = {
  '020': { //ID
    use: 'G', //Use
    name: 'DPT_ActuatorConnectType',  //Name
    desc: 'ActuatorConnectType', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'reserved', 1: 'SensorConnection', 2: 'SensorConnection'}, //Encoding
  }
},

exports.subtypes = {
  '021': { //ID
    use: 'G', //Use
    name: 'DPT_Cloud_Cover',  //Name
    desc: 'CloudCover', //Encoding field1
    range: [0, 9], //Range
    enc: {
      0: 'Cloudless',
      1: 'Sunny',
      2: 'Sunshiny',
      3: 'Lightly cloudy',
      4: 'Scattered clouds',
      5: 'Cloudy',
      6: '',
      7: '',
      8: 'Overcast',
      9: 'Sky obstructed from view'
    }, //Encoding
  }
},

exports.subtypes = {
  '022': { //ID
    use: 'FB', //Use
    name: 'DPT_PowerReturnMode',  //Name
    desc: 'power return mode', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'do not send', 1: 'send always', 2: 'send if value changed during powerdown'}, //Encoding
  }
}