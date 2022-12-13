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
    enc: { 0: 'disabled (PSU/DPSU fixed off)', 1: 'enabled (PSU/DPSU fixed on)', 2: 'auto (PSU/DPSU automatic on/off)'}, //Encoding
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
    enc: { 0: 'no fault', 1: 'sensor fault', 2: 'process fault / controller fault', 3: 'actuator fault', 4: 'other fault'}, //Encoding
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
},

exports.subtypes = {
  '100': { //ID
    use: 'HWH', //Use
    name: 'DPT_FuelType',  //Name
    desc: 'FuelType', //Encoding field1
    range: [0, 3], //Range
    enc: { 0: 'auto', 1: 'oil', 2: 'gas', 3: 'solid state fuel'}, //Encoding
  }
},

exports.subtypes = {
  '101': { //ID
    use: 'HWH', //Use
    name: 'DPT_BurnerType',  //Name
    desc: 'BurnerType', //Encoding field1
    range: [0, 3], //Range
    enc: { 0: 'reserved', 1: '1 stage', 2: '2 stage', 3: 'modulating'}, //Encoding
  }
},

exports.subtypes = {
  '102': { //ID
    use: 'HVAC', //Use
    name: 'DPT_HVACMode',  //Name
    desc: 'HVACMode', //Encoding field1
    range: [0, 4], //Range
    enc: { 0: 'Auto', 1: 'Comfort', 2: 'Standby', 3: 'Economy', 4:'Building Protection'}, //Encoding
  }
},

exports.subtypes = {
  '103': { //ID
    use: 'HWH', //Use
    name: 'DPT_DHWMode',  //Name
    desc: 'DHWMode', //Encoding field1
    range: [0, 4], //Range
    enc: { 0: 'Auto', 1: 'LegioProtect', 2: 'Normal', 3: 'Reduced', 4: 'Off/FrostProtect'}, //Encoding
  }
},

exports.subtypes = {
  '104': { //ID
    use: 'HVAC', //Use
    name: 'DPT_LoadPriority',  //Name
    desc: 'LoadPriority', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'None', 1: 'Shift load priority', 2: 'Absolute load priority'}, //Encoding
  }
},

exports.subtypes = {
  '105': { //ID
    use: 'HVAC', //Use
    name: 'DPT_HVACContrMode',  //Name
    desc: 'HVACContrMode', //Encoding field1
    range: [0, 20], //Range
    enc: {
      0: 'Auto',
      1: 'Heat',
      2: 'Morning Warmup',
      3: 'Cool',
      4: 'Night Purge',
      5: 'Precool',
      6: 'Off',
      7: 'Test',
      8: 'Emergency Heat',
      9: 'Fan only',
      10: 'Free Cool',
      11: 'Ice',
      12: 'Maximum Heating Mode',
      13: 'Economic Heat/Cool Mode',
      14: 'Dehumidification',
      15: 'Calibration Mode',
      16: 'Emergency Cool Mode',
      17: 'Emergency Steam Mode',
      18: 'reserved',
      19: 'reserved',
      20: 'NoDem'
    }
      //Encoding
  }
},

exports.subtypes = {
  '106': { //ID
    use: 'HVAC', //Use
    name: 'DPT_HVACEmergMode',  //Name
    desc: 'HVACEmergMode', //Encoding field1
    range: [0, 5], //Range
    enc: { 0: 'Normal', 1: 'EmergPressure', 2: 'EmergDepressure', 3: 'EmergPurge', 4: 'EmergShutdown', 5:'EmergFire'}, //Encoding
  }
},

exports.subtypes = {
  '107': { //ID
    use: 'HVAC', //Use
    name: 'DPT_ChangeoverMode',  //Name
    desc: 'ChangeoverMode', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'Auto', 1: 'CoolingOnly', 2: 'HeatingOnly'}, //Encoding
  }
},

exports.subtypes = {
  '108': { //ID
    use: 'HVAC', //Use
    name: 'DPT_ValveMode',  //Name
    desc: 'ValveMode', //Encoding field1
    range: [1, 5], //Range
    enc: { 
      1: 'Heat stage A for normal heating',
      2: 'Heat stage B for heating with two stages (A + B)',
      3: 'Cool stage A for normal cooling',
      4: 'Cool stage B for cooling with two stages (A + B)',
      5: 'Heat/Cool for changeover applications',
    }, //Encoding
  }
},

exports.subtypes = {
  '109': { //ID
    use: 'HVAC', //Use
    name: 'DPT_DamperMode',  //Name
    desc: 'DamperMode', //Encoding field1
    range: [1, 4], //Range
    enc: { 1: 'Fresh air, e.g. for fancoils', 2: 'Supply Air. e.g. for VAV', 3: 'Discharge Air e.g. for VAV', 4: 'Extract Air e.g. for VAV'}, //Encoding
  }
},

exports.subtypes = {
  '110': { //ID
    use: 'HVAC', //Use
    name: 'DPT_HeaterMode',  //Name
    desc: 'HeaterMode', //Encoding field1
    range: [1, 3], //Range
    enc: { 1: 'Heat Stage A On/Off', 2: 'Heat Stage A Proportional', 3: 'Heat Stage B Proportional'}, //Encoding
  }
},

exports.subtypes = {
  '111': { //ID
    use: 'TU', //Use
    name: 'DPT_FanMode',  //Name
    desc: 'FanMode', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'not running', 1: 'permanently running', 2: 'running in intervals'}, //Encoding
  }
},

exports.subtypes = {
  '112': { //ID
    use: 'TU', //Use
    name: 'DPT_MasterSlaveMode',  //Name
    desc: 'MasterSlaveMode', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'autonomous', 1: 'master', 2: 'slave'}, //Encoding
  }
},

exports.subtypes = {
  '113': { //ID
    use: ['TU', 'DEH'], //Use
    name: 'DPT_StatusRoomSetp',  //Name
    desc: 'StatusRoomSetp', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'normal setpoint', 1: 'alternative setpoint', 2: 'building protection setpoint'}, //Encoding
  }
},

exports.subtypes = {
  '114': { //ID
    use: 'FB', //Use
    name: 'DPT_Metering_DeviceTyp',  //Name
    desc: 'Metering_DeviceTyp', //Encoding field1
    range: [0, 255], //Range
    enc: {
      0: 'Other device type',
      1: 'Oil meter',
      2: 'Electricity meter',
      3: 'Gas meter',
      4: 'Heat meter',
      5: 'Steam meter',
      6: 'Warm Water meter',
      7: 'Water meter',
      8: 'Heat cost allocator',
      9: 'reserved',
      10: 'Cooling Load meter (outlet)',
      11: 'Cooling Load meter (inlet)',
      12: 'Heat (inlet)',
      13: 'Heat and Cool',
      14: 'reserved',
      15: 'reserved',
      32: 'breaker (electricity)',
      33: 'valve (gas or water)',
      40: 'waste water meter',
      41: 'garbage',
      255: 'void device type'
    }, //Encoding
  }
},

exports.subtypes = {
  '115': { //ID
    use: 'HVAC', //Use
    name: 'DPT_HumDehumMode',  //Name
    desc: 'HumDehumMode', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'inactive', 1: 'humidification', 2: 'dehumidification'}, //Encoding
  }
},

exports.subtypes = {
  '120': { //ID
    use: 'HVAC', //Use
    name: 'DPT_ADAType',  //Name
    desc: 'ADAType', //Encoding field1
    range: [1, 2], //Range
    enc: { 1: 'Air Damper', 2: 'VAV'}, //Encoding
  }
},

exports.subtypes = {
  '121': { //ID
    use: 'HVAC', //Use
    name: 'DPT_BackupMode',  //Name
    desc: 'BackupMode', //Encoding field1
    range: [0, 1], //Range
    enc: { 0: 'Backup Value', 1: 'Keep Last State'}, //Encoding
  }
},

exports.subtypes = {
  '122': { //ID
    use: 'HVAC', //Use
    name: 'StartSynchronization',  //Name
    desc: 'AlarmClass_HVAC', //Encoding field1
    range: [0, 2], //Range
    enc: { 0: 'Position unchanged', 1: 'Single close', 2: 'Single open'}, //Encoding
  }
},

exports.subtypes = {
  '600': { //ID
    use: 'FB', //Use
    name: 'DPT_Behaviour_Lock_Unlock',  //Name
    desc: 'Behaviour_Lock_Unlock', //Encoding field1
    range: [0, 6], //Range
    enc: { 
      0 : 'off',
      1 : 'on',
      2 : 'no change',
      3 : 'value according to additional parameter',
      4 : 'memory function value',
      5 : 'updated value',
      6 : 'value before locking'
    }, //Encoding
  }
},

exports.subtypes = {
  '601': { //ID
    use: 'FB', //Use
    name: 'DPT_Behaviour_Bus_Power_Up_Down',  //Name
    desc: 'Behaviour_Bus_Power_Up_Down', //Encoding field1
    range: [0, 4], //Range
    enc: {
      0 : 'off',
      1 : 'on',
      2 : 'no change',
      3 : 'value according to additional parameter',
      4 : 'last (value before bus power down)'
    }, //Encoding
  }
},

exports.subtypes = {
  '602': { //ID
    use: 'FB', //Use
    name: 'DPT_DALI_Fade_Time',  //Name
    desc: 'FadeTime', //Encoding field1
    range: [0, 15], //Range
    enc: {
      0 : '0 s (no fade)',
      1 : '0,7 s',
      2 : '1,0 s',
      3 : '1,4 s',
      4 : '2,0 s',
      5 : '2,8 s',
      6 : '4,0 s',
      7 : '5,7 s',
      8 : '8,0 s',
      9 : '11,3 s',
      10 : '16,0 s',
      11 : '22,6 s',
      12 : '32,0 s',
      13 : '45,3 s',
      14 : '64,0 s',
      15 : '90,5 s'
    }, //Encoding
  }
},

exports.subtypes = {
  '603': { //ID
    use: 'FB', //Use
    name: 'DPT_BlinkingMode',  //Name
    desc: 'BlinkingMode', //Encoding field1
    range: [0, 2], //Range
    enc: {
      0 : 'BlinkingDisabled',
      1 : 'WithoutAcknowledge',
      2 : 'BlinkingWithAcknowledge'
    }, //Encoding
  }
},

exports.subtypes = {
  '604': { //ID
    use: 'Lighting', //Use
    name: 'DPT_LightControlMode',  //Name
    desc: 'LightControlMode', //Encoding field1
    range: [0, 1], //Range
    enc: { 
      0 : 'automatic light control',
      1 : 'manual light control'  
    }, //Encoding
  }
},

exports.subtypes = {
  '605': { //ID
    use: 'Lighting', //Use
    name: 'DPT_SwitchPBModel',  //Name
    desc: 'SwitchPBModel', //Encoding field1
    range: [1, 2], //Range
    enc: { 
      0 : 'reserved',
      1 : 'one PB/binary input mode',
      2 : 'two PBs/binary inputs mode'
    }, //Encoding
  }
},

exports.subtypes = {
  '606': { //ID
    use: 'Lighting', //Use
    name: 'DPT_PBAction',  //Name
    desc: 'SwitchPBAction', //Encoding field1
    range: [0, 3], //Range
    enc: { 
      0 : 'inactive (no message sent)',
      1 : 'SwitchOff message sent',
      2 : 'SwitchOn message sent',
      3 : 'inverse value of InfoOnOff is sent'
    }, //Encoding
  }
},

exports.subtypes = {
  '607': { //ID
    use: 'Lighting', //Use
    name: 'DPT_DimmPBModel',  //Name
    desc: 'LDSBMode', //Encoding field1
    range: [1, 4], //Range
    enc: { 
      0 : 'reserved',
      1 : 'one PB/binary input; SwitchOnOff inverts on each transmission',
      2 : 'one PB/binary input, On / DimUp message sent',
      3 : 'one PB/binary input, Off / DimDown message sent',
      4 : 'two PBs/binary inputs mode'
    }, //Encoding
  }
},

exports.subtypes = {
  '608': { //ID
    use: 'Lighting', //Use
    name: 'DPT_SwitchOnMode',  //Name
    desc: 'SwitchOnMode', //Encoding field1
    range: [0, 2], //Range
    enc: {
      0 : 'last actual value',
      1 : 'value according additional parameter',
      2 : 'last received absolute setvalue'
    }, //Encoding
  }
},

exports.subtypes = {
  '609': { //ID
    use: 'Lighting', //Use
    name: 'DPT_LoadTypeSet',  //Name
    desc: 'LoadTypeSet', //Encoding field1
    range: [0, 8], //Range
    enc: { 
      0 : 'automatic (resistive, capacitive or inductive)',
      1 : 'leading edge (inductive load)',
      2 : 'trailing edge (resistive – or capacitive load)',
      3 : 'switch mode only (nondimmable load)',
      4 : 'automatic once',
      5 : 'CFL, leading',
      6 : 'CFL, trailing',
      7 : 'LED, leading',
      8 : 'LED, trailing'
    }, //Encoding
  }
},

exports.subtypes = {
  '610': { //ID
    use: 'Lighting', //Use
    name: 'DPT_LoadTypeDetected',  //Name
    desc: 'LoadTypeDetected', //Encoding field1
    range: [0, 8], //Range
    enc: { 
      0 : 'undefined',
      1 : 'leading edge (inductive load)',
      2 : 'trailing edge (capacitive load)',
      3 : 'detection not possible or error',
      4 : 'calibration pending, waiting on trigger',
      5 : 'CFL, leading',
      6 : 'CFL, trailing',
      7 : 'LED, leading',
      8 : 'LED, trailing'
    }, //Encoding
  }
},

exports.subtypes = {
  '611': { //ID
    use: 'FB', //Use
    name: 'DPT_Converter_Test_-Control',  //Name
    desc: 'TestCtrl', //Encoding field1
    range: [0, 6], //Range
    enc: {
      0 : 'Reserved, no effect',
      1 : 'Start Function Test (FT) Acc. DALI Cmd. 227',
      2 : 'Start Duration Test (DT) Acc. DALI Cmd. 228',
      3 : 'Start Partial Duration Test (PDT)',
      4 : 'Stop Test Acc. DALI Cmd 229',
      5 : 'Reset Function Test Done Flag Acc. DALI Cmd. 230',
      6 : 'Reset Duration Test Done Acc. DALI Cmd. 231'
    }, //Encoding
  }
},

exports.subtypes = {
  '612': { //ID
    use: 'FB', //Use
    name: 'DPT_Converter_Control',  //Name
    desc: 'ConvCtrl', //Encoding field1
    range: [0, 4], //Range
    enc: { 
      0 : 'Restore Factory Default Settings Acc. DALI Cmd. 254',
      1 : 'Goto Rest Mode Acc. DALI Cmd. 224',
      2 : 'Goto Inhibit Mode Acc. DALI Cmd. 225',
      3 : 'Re-Light / Reset Inhibit Acc. DALI Cmd. 226',
      4 : 'Reset Lamp Time Resets the Lamp Emergency Time and the Lamp Total Operation Time. Acc. DALI Cmd. 232'
   }, //Encoding
  }
},

exports.subtypes = {
  '613': { //ID
    use: 'FB', //Use
    name: 'DPT_Converter_Data_Request',  //Name
    desc: 'Request', //Encoding field1
    range: [0, 8], //Range
    enc: {
      0 : 'Reserved, no effect',
      1 : 'Request Converter Status',
      2 : 'Request Converter Test Result',
      3 : 'Request Battery Info',
      4 : 'Request Converter FT Info',
      5 : 'Request Converter DT Info',
      6 : 'Request Converter PDT Info',
      7 : 'Request Converter Info',
      8 : 'Request Converter Info'
}, //Encoding
  }
},

exports.subtypes = {
  '801': { //ID
    use: 'Shutter & Blinds', //Use
    name: 'DPT_SABExceptBehaviour',  //Name
    desc: 'SABExceptBehaviour', //Encoding field1
    range: [0, 4], //Range
    enc: { 0: 'up', 1: 'down', 2: 'no change', 3:'value according to additional parameter', 4:'stop'}, //Encoding
  }
},

exports.subtypes = {
  '802': { //ID
    use: 'Shutter & Blinds', //Use
    name: 'DPT_SABBehaviour_Lock_Unlock',  //Name
    desc: 'SABBehaviour_Lock_Unlock', //Encoding field1
    range: [0, 6], //Range
    enc: { 
      0 : 'up',
      1 : 'down',
      2 : 'no change',
      3 : 'value according to additional parameter',
      4 : 'stop',
      5 : 'updated value',
      6 : 'value before locking'
    }, //Encoding
  }
},

exports.subtypes = {
  '803': { //ID
    use: 'Shutter & Blinds', //Use
    name: 'DPT_SSSBMode',  //Name
    desc: '', //Encoding field1
    range: [1, 4], //Range
    enc: {
      1 : 'one push button/binary input; MoveUpDown inverts on each transmission => poor usability, not recommended',
      2 : 'one push button/binary input, MoveUp / StepUp message sent',
      3 : 'one push button/binary input, MoveDown / StepDown message sent',
      4 : 'two push buttons/binary inputs mode'
    }, //Encoding
  }
},

exports.subtypes = {
  '804': { //ID
    use: 'Shutter & Blinds', //Use
    name: 'DPT_BlindsControlMode',  //Name
    desc: '', //Encoding field1
    range: [0, 1], //Range
    enc: { 0: 'Automatic Control', 1: 'Manual Control'}, //Encoding
  }
},

exports.subtypes = {
  '1000': { //ID
    use: 'System', //Use
    name: 'DPT_CommMode',  //Name
    desc: 'CommMode', //Encoding field1
    range: [0, 7], //Range
    enc: { 
      0: 'reserved',
      1: 'PL medium Domain Address',
      2: 'RF Control Octet and Serial Number or DoA',
      3: 'Busmonitor Error Flags',
      4: 'Relative timestamp',
      5: 'Time delay',
      6: 'Extended Relative Timestamp',
      7: 'BiBat information'
    }, //Encoding
  }
},

exports.subtypes = {
  '1002': { //ID
    use: 'System', //Use
    name: 'DPT_RF_ModeSelect',  //Name
    desc: 'RF_ModeSelect', //Encoding field1
    range: [0, 2], //Range
    enc: {
      0: 'asynchronous',
      1: 'asynchronous + BiBat Master',
      2: 'asynchronous + BiBat Slave'    
    }, //Encoding
  }
},

exports.subtypes = {
  '1003': { //ID
    use: 'System', //Use
    name: 'DPT_RF_FilterSelect',  //Name
    desc: 'RF_FilterSelect', //Encoding field1
    range: [0, 3], //Range
    enc: {
      0:  'no filtering, all supported received frames shall be passed to the cEMI client using L_Data.ind',
      1: 'filtering by Domain Address',
      2: 'filtering by KNX Serial Number table',
      3: 'filtering by Domain Address and by Serial number table'
    }, //Encoding
  }
},

exports.subtypes = {
  '1004': { //ID
    use: 'FB', //Use
    name: 'DPT_Medium',  //Name
    desc: 'KNX Medium', //Encoding field1
    range: [0, 5], //Range
    enc: {
      0 : 'KNX TP1',
      1 : 'KNX PL110',
      2 : 'KNX RF',
      3 : 'reserved. Shall not be used.',
      4 : 'reserved. Shall not be used.',
      5 : 'KNX IP'
    }, //Encoding
  }
},

exports.subtypes = {
  '1005': { //ID
    use: 'System', //Use
    name: 'DPT_PB_Function',  //Name
    desc: 'PB function', //Encoding field1
    range: [1, 55], //Range
    enc: { 
      1 : 'default function',
      2 : 'ON',
      3 : 'OFF',
      4 : 'Toggle',
      5 : 'Dimming Up Down',
      6 : 'Dimming Up',
      7 : 'Dimming Down',
      8 : 'On / Off',
      9 : 'Timed On Off',
      10 : 'Forced On',
      11 : 'Forced Off',
      12 : 'Shutter Up (for PB)',
      13 : 'Shutter Down (for (PB)',
      14 : 'Shutter Up Down (for PB)',
      15 : 'reserved',
      16 : 'Forced Up',
      17 : 'Forced Down',
      18 : 'Wind Alarm',
      19 : 'Rain Alarm',
      20 : 'HVAC Mode Comfort / Economy',
      21 : 'HVAC Mode Comfort / -',
      22 : 'HVAC Mode Economy / -',
      23 : 'HVAC Mode Building protection / HVAC mode auto',
      24 : 'Shutter Stop',
      25 : 'Timed Comfort Standby',
      26 : 'Forced Comfort',
      27 : 'Forced Building protection',
      28 : 'Scene 1',
      29 : 'Scene 2',
      30 : 'Scene 3',
      31 : 'Scene 4',
      32 : 'Scene 5',
      33 : 'Scene 6',
      34 : 'Scene 7',
      35 : 'Scene 8',
      36 : 'Absolute dimming 25 %',
      37 : 'Absolute dimming 50 %',
      38 : 'Absolute dimming 75 %',
      39 : 'Absolute dimming 100 %',
      40 : 'Shutter Up / - (for switch)',
      41 : 'Shutter Down / - (for switch)',
      42 : 'Shutter Up / Down (for switch)',
      43 : 'Shutter Down / Up (for switch)',
      44 : 'Light sensor',
      45 : 'System clock',
      46 : 'Battery status',
      47 : 'HVAC Mode Standby / -',
      48 : 'HVAC Mode Auto / -',
      49 : 'HVAC Mode Comfort /Standby',
      50 : 'HVAC Mode Building protection / -',
      51 : 'Timed toggle',
      52 : 'Dimming Absolute switch',
      53 : 'Scene switch',
      54 : 'Smoke alarm',
      55 : 'Sub detector'
    }, //Encoding
  }
},

exports.subtypes = {
  '1200': { //ID
    use: 'FB', //Use
    name: 'DPT_MBus_BreakerValve_State',  //Name
    desc: 'Breaker State', //Encoding field1
    range: [0, 255], //Range
    enc: {
      0: 'Breaker/Valve is closed',
      1: 'Breaker/Valve is open',
      2: 'Breaker/Valve is released',
      255: 'invalid'
    }, //Encoding
  }
},

exports.subtypes = {
  '1202': { //ID
    use: 'FB', //Use
    name: 'DPT_Gas_Measurement_Condition',  //Name
    desc: 'GasMeasurementCondition', //Encoding field1
    range: [0, 3], //Range
    enc: {
      0: 'unknown',
      1: 'temperature converted',
      2: 'at base condition',
      3: 'at measurement condition'
    }, //Encoding
  }
},

exports.subtypes = {
  '1203': { //ID
    use: 'Metering', //Use
    name: 'DPT_Breaker_Status',  //Name
    desc: 'BreakerStatus', //Encoding field1
    range: [0, 6], //Range
    enc: {
      0: 'closed',
      1: 'open on overload',
      2: 'open on overvoltage',
      3: 'open on load shedding',
      4: 'open on PLC or Euridis command',
      5: 'open on overheat with a current value over the maximum switching current value.',
      6: 'open on overheat with a current value under the maximum'
    }, //Encoding
  }
},

exports.subtypes = {
  '1204': { //ID
    use: 'Metering', //Use
    name: 'DPT_Euridis_Communication_Interface_Status',  //Name
    desc: 'EuridisCommunicationInterfaceStatus', //Encoding field1
    range: [0, 2], //Range
    enc: {
      0: 'deactivated',
      1: 'activated without security',
      2: 'activated with security'
    }, //Encoding
  }
},

exports.subtypes = {
  '1205': { //ID
    use: 'Metering', //Use
    name: 'DPT_PLC_Status',  //Name
    desc: 'PLCStatus', //Encoding field1
    range: [0, 2], //Range
    enc: {
      0: 'New / Unlock (S-SFK) – Not Associated (G3-PLC)',
      1: 'New / Lock (S-FSK) – Associated (G3-PLC)',
      2: 'Registered (S-FSK) – reserved (G3-PLC)'
    }, //Encoding
  }
},

exports.subtypes = {
  '1206': { //ID
    use: 'Metering', //Use
    name: 'DPT_Peak_Event_Notice',  //Name
    desc: 'PeakEventNotice', //Encoding field1
    range: [0, 3], //Range
    enc: {
      0: 'no notice in progress',
      1: 'notice PE1 in progress',
      2: 'notice PE2 in progress',
      3: 'notice PE3 in progress'
    }, //Encoding
  }
},

exports.subtypes = {
  '1207': { //ID
    use: 'Metering', //Use
    name: 'DPT_Peak_Event',  //Name
    desc: 'PeakEvent', //Encoding field1
    range: [0, 3], //Range
    enc: {
      0: 'no peak event',
      1: 'PE1 in progress',
      2: 'PE2 in progress',
      3: 'PE3 in progress'
    }, //Encoding
  }
},

exports.subtypes = {
  '1208': { //ID
    use: 'Metering', //Use
    name: 'DPT_TIC_Type',  //Name
    desc: 'TICType', //Encoding field1
    range: [0, 1], //Range
    enc: {
      0: 'Historical',
      1: 'Standard'      
    }, //Encoding
  }
},

exports.subtypes = {
  '1209': { //ID
    use: 'Metering', //Use
    name: 'DPT_Type_TIC_Channel',  //Name
    desc: 'TICChannelType', //Encoding field1
    range: [0, 4], //Range
    enc: {
      0: 'None',
      1: 'Historical single-phase',
      2: 'Historical three-phase',
      3: 'Standard single-phase',
      4: 'Standard three-phase'
    }, //Encoding
  }
}
