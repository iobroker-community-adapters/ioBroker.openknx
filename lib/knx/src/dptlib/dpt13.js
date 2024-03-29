/**
* knx.js - a KNX protocol stack in pure Javascript
* (C) 2016-2018 Elias Karakoulakis
*/

//
// DPT13: 4-byte signed value
//

// DPT13 base type info
exports.basetype = {
    "bitlength" : 32,
    "signedness": "signed",
    "valuetype" : "basic",
    "desc" : "4-byte signed value",
    "range" : [-Math.pow(2, 31), Math.pow(2, 31)-1]
}

// DPT13 subtypes
exports.subtypes = {
  // 13.001 counter pulses (signed)
  "001" : {
    "use" : "G",
    "name" : "DPT_Value_4_Count",
    "desc" : "counter pulses (signed)",
    "unit" : "pulses"
  },

  "002" : {
    "use" : "G",  
    "name" : "DPT_FlowRate_m3/h",
    "desc" : "Flow Rate in m3/h with high resolution" ,
    "unit" : "m3/h"
  },

  // 13.010 active energy (Wh)
  "010" : {
    "use" : "G",
    "name" : "DPT_ActiveEnergy",
    "desc" : "active energy (Wh)",
    "unit" : "Wh"
  },

  // 13.011 apparent energy (VAh)
  "011" : {
    "use" : "G",  
    "name" : "DPT_ApparantEnergy",
    "desc" : "apparent energy (VAh)",
    "unit" : "VAh"
  },

  // 13.012 reactive energy (VARh)
  "012" : {
    "use" : "G",
    "name" : "DPT_ReactiveEnergy",
    "desc" : "reactive energy (VARh)",
    "unit" : "VARh"
  },

  // 13.013 active energy (KWh)
  "013" : {
    "use" : "G",  
    "name" : "DPT_ActiveEnergy_kWh",
    "desc" : "active energy (kWh)",
    "unit" : "kWh"
  },

  // 13.014 apparent energy (kVAh)
  "014" : {
    "use" : "G",  
    "name" : "DPT_ApparantEnergy_kVAh",
    "desc" : "apparent energy (kVAh)",
    "unit" : "VAh"
  },

  // 13.015 reactive energy (kVARh)
  "015" : {
    "use" : "G",  
    "name" : "DPT_ReactiveEnergy_kVARh",
    "desc" : "reactive energy (kVARh)",
    "unit" : "kVARh"
  },

  // 13.100 time lag(s)
  "100" : {
    "use" : "G",  
    "name" : "DPT_LongDeltaTimeSec",
    "desc" : "time lag(s)",
    "unit" : "s"
  },
}
