/**
* knx.js - a KNX protocol stack in pure Javascript
* (C) 2016-2018 Elias Karakoulakis
*/
const commontest = require('./commontest')

commontest.do('DPT237', [
  { apdu_data: [0x00, 0x00], jsval: {address: 0, addresstype: 0,
      readresponse: 0, lampfailure: 0, ballastfailure: 0, convertorerror: 0}},
  { apdu_data: [0x00, 0x21], jsval: {address: 1, addresstype: 1,
      readresponse: 0, lampfailure: 0, ballastfailure: 0, convertorerror: 0}},
  { apdu_data: [0x00, 0x63], jsval: {address: 3, addresstype: 1,
      readresponse: 1, lampfailure: 0, ballastfailure: 0, convertorerror: 0}},
  { apdu_data: [0x01, 0x05], jsval: {address: 5, addresstype: 0,
      readresponse: 0, lampfailure: 0, ballastfailure: 1, convertorerror: 0}},
  { apdu_data: [0x02, 0x08], jsval: {address: 8, addresstype: 0,
      readresponse: 0, lampfailure: 0, ballastfailure: 0, convertorerror: 1}}
]);

commontest.do('DPT237.600', [
  { apdu_data: [0x00, 0x01], jsval: {address: 1, addresstype: 0,
      readresponse: 0, lampfailure: 0, ballastfailure: 0, convertorerror: 0}},
  { apdu_data: [0x00, 0x05], jsval: {address: 5, addresstype: 0,
      readresponse: 0, lampfailure: 0, ballastfailure: 0, convertorerror: 0}},
  { apdu_data: [0x00, 0x06], jsval: {address: 6, addresstype: 0,
      readresponse: 0, lampfailure: 0, ballastfailure: 0, convertorerror: 0}},
  { apdu_data: [0x00, 0x08], jsval: {address: 8, addresstype: 0,
      readresponse: 0, lampfailure: 0, ballastfailure: 0, convertorerror: 0}}
]);
