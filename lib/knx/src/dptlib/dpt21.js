/**
* knx.js - a KNX protocol stack in pure Javascript
* (C) 2016-2018 Elias Karakoulakis
*/

const log = require('log-driver').logger;

//
// DPT21: 1-byte status
//
// 001
// - OutofService b0
// - Overridden b1
// - Inalarm b2
// - AlarmUnAck b3
// - reseverd b4-7

// FIXME: help needed
exports.formatAPDU = function(value) {
    if (!value) return log.error('DPT21: cannot write null value');
    log.debug('./knx/src/dpt21.js : input value = ' + value);

    //var apdu_data = new Buffer(1);
    //apdu_data[0] = value;
    if ( typeof value === 'object' ) 
        return Buffer.from([(value.outofservice) +
            (value.fault << 1) +
            (value.overridden << 2) +
            (value.inalarm << 3) +
            (value.alarmeunack << 4) ]);

    log.error('DPT21: Must supply a value which is an object');
    //return apdu_data;
    return Buffer.from([0]);
}

exports.fromBuffer = function(buf) {
    if (buf.length != 1) return log.error ("Buffer should be 1 bytes long");
    //if (buf.length != 1) throw "Buffer should be 1 bytes long";
    log.debug('               dpt21.js   fromBuffer : ' + buf);

    //var ret = buf.readUInt8(0);

    return {
        outofservice: (buf[0] & 0b00000001),
        fault: (buf[0] &        0b00000010) >> 1,
        overridden: (buf[0] &   0b00000100) >> 2,
        inalarm: (buf[0] &      0b00001000) >> 3,
        alarmunack: (buf[0] &   0b00010000) >> 4 };
    //return ret;
}


exports.basetype = {
    "bitlength" : 8,
    "range" : [ , ],
    "valuetype" : "composite",
    "desc" : "1-byte"
}

exports.subtypes = {
    // 21.001 status - 5 bits
    "001" : {
        "name" : "DPT_StatusGen",
	"desc" : "General Status",
        "unit" : "",
	"scalar_range" : [ , ],
        "range" : [ , ]
    },
    // 21.002 control - 3 bits
    "002" : {
        "name" : "DPT_Device_Control",
	"desc" : "Device Control",
        "unit" : "",
	"scalar_range" : [ , ],
        "range" : [ , ]
    }
}
