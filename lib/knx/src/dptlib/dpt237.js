/**
* knx.js - a KNX protocol stack in pure Javascript
* (C) 2016-2018 Elias Karakoulakis
*/

const log = require('log-driver').logger;

//
// DPT237: 2-byte unsigned value
//
exports.formatAPDU = function(value) {
    if (!value) return log.error('DPT237: cannot write null value');

    log.trace('dpt278.js : input value = ' + value);

    var apdu_data = new Buffer(2);

    //console.log("Buffer lenght: ", apdu_data.length);
    if ( typeof value === 'object' &&
        value.hasOwnProperty('addresstype') &&
        value.hasOwnProperty('address') &&
        value.hasOwnProperty('readresponse') &&
        value.hasOwnProperty('lampfailure') &&
        value.hasOwnProperty('ballastfailure') &&
        value.hasOwnProperty('convertorerror')
     ) {
        // these are reversed as [0] is high and [1] low
        apdu_data[1] = [(value.address & 0b00011111) +
            (value.addresstype << 5) +
            (value.readresponse << 6) +
            (value.lampfailure << 7)];
        apdu_data[0] = [(value.ballastfailure & 0b00000001) +
            (value.convertorerror << 1) ];

        return apdu_data;
    }

    log.error('DPT237: Must supply an value {address:[0,63] or [0,15], address type:{0,1}, ...}');

    return apdu_data;
}

exports.fromBuffer = function(buf) {
    if (buf.length !== 2) return log.error('Buffer should be 2 byte long');

    return { address: (buf[1] &  0b00011111),
        addresstype: (buf[1] &   0b00100000) >> 5,
        readresponse: (buf[1] &  0b01000000) >> 6,
        lampfailure: (buf[1] &   0b10000000) >> 7,
        ballastfailure: (buf[0] & 0b00000001),
        convertorerror: (buf[0] & 0b00000010) >> 1 };
}


exports.basetype = {
    "bitlength" : 16,
    "range" : [ , ],
    "valuetype" : "composite",
    "desc" : "2-byte"
}

exports.subtypes = {
    // 237.600 HVAC mode
    "600" : {
        "name" : "HVAC_Mode",
        "desc" : "",
        "unit" : "",
        "scalar_range" : [ , ],
        "range" : [ , ]
    },

}
