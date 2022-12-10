const log = require('log-driver').logger;

exports.basetype = {
  bitlength: 8,
  range: [,],
  valuetype: 'basic',
  desc: '1-byte',
};
exports.subtypes = {
    '001': { //ID
      use: 'FB', //Use
      name: 'DPT_OnOffAction',  //Name
      desc: 'OnOffAction', //Encoding field1
      range: [0, 3], //Range
      enc: { 0: 'off', 1: 'on', 2: 'off/on', 3: 'on/off'}, //Encoding
    }
  },

  exports.subtypes = {
    '002': { //ID
      use: 'FB', //Use
      name: 'DPT_Alarm_Reaction',  //Name
      desc: 'Alarm_Reaction', //Encoding field1
      range: [0, 3], //Range
      enc: { 0: 'no alarm is used', 1: 'alarm position is UP', 2: 'alarm position is DOWN', 3: 'reserved; shall not be used'}, //Encoding
    }
  },

  exports.subtypes = {
    '003': { //ID
      use: 'FB', //Use
      name: 'DPT_UpDown_Action',  //Name
      desc: 'UpDown_Action', //Encoding field1
      range: [0, 3], //Range
      enc: { 0: 'Up', 1: 'Down', 2: 'UpDown', 3: 'DownUp'}, //Encoding
    }
  },

  exports.subtypes = {
    '102': { //ID
      use: 'FB', //Use
      name: 'DPT_HVAC_PB_Action',  //Name
      desc: 'HVAC_PB_Action', //Encoding field1
      range: [0, 3], //Range
      enc: { 0: 'Comfort/Economy', 1: 'Comfort/Nothing', 2: 'Economy/Nothing', 3: 'Building prot/Auto'}, //Encoding
    }
  }