/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

//
// DPT12.*:  4-byte unsigned value
//


// DPT12 base type info
exports.basetype = {
  bitlength: 32,
  signedness: "unsigned",
  valuetype: "basic",
  desc: "4-byte unsigned value",
  "range" : [0, Math.pow(2, 32)-1]
}

// DPT12 subtype info
exports.subtypes = {
  // 12.001 counter pulses
  "001": {
    "name": "DPT_Value_4_Ucount",
    "desc": "Counter pulses",
  },
  "100": {
    "name": "DPT_LongTimePeriod_Sec",
    "desc": "Counter timesec (s)",
    "unit" : "s"
  },
  "101": {
    "name": "DPT_LongTimePeriod_Min",
    "desc": "Counter timemin (min)",
    "unit" : "min"
  },
  "102": {
    "name": "DPT_LongTimePeriod_Hrs",
    "desc": "Counter timehrs (h)",
    "unit" : "h"
  },
  "1200": {
    "name": "DPT_VolumeLiquid_Litre",
    "desc": "Volume liquid (l)",
    "unit" : "l"
  },
  "1201": {
    "name": "DPT_Volume_m3",
    "desc": "Volume m3",
    "unit" : "m3"
  }
}