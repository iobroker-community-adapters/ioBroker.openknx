/**
* knx.js - a KNX protocol stack in pure Javascript
* (C) 2016-2018 Elias Karakoulakis
*/

// Bitstruct to parse a DPT6 frame (8-bit signed integer)
// Always 8-bit aligned.

// DPT Basetype info
exports.basetype = {
    "bitlength" : 8,
    "signedness": "signed",
    "valuetype" : "basic",
    "desc" : "8-bit signed value",
    "range" : [-128, 127]
}

// DPT subtypes info
exports.subtypes = {
    // 6.001 percentage (-128%..127%)
    "001" : {
        "use"  : "G",
        "name" : "DPT_Percent_V8",
        "desc" : "percent",
        "unit" : "%",
    },

    // 6.002 counter pulses (-128..127)
    "010" : {
        "use"  : "G",
        "name" : "DPT_Value_1_Count",
        "desc" : "counter pulses",
        "unit" : "pulses"
    },

    // A,B,C,D,E:
    // 0 = set
    // 1 = clear
    // FFF
    // 001b = mode 0 is active
    // 010b = mode 1 is active
    // 100b = mode 2 is active
    "020" : {
        "use"  : "FB",
        "name" : "DPT_Status_Mode3",
        "desc" : "Status with Mode",
        "unit" : ""
    },
}
