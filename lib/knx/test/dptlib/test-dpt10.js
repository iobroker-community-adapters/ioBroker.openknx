/**
* knx.js - a KNX protocol stack in pure Javascript
* (C) 2016-2018 Elias Karakoulakis
*/

const test = require('tape');
const DPTLib = require('../../src/dptlib');
const assert = require('assert');

function timecompare(date1, sign, date2) {
  var dow1 = date1.getDay();
  var hour1 = date1.getHours();
  var min1 = date1.getMinutes();
  var sec1 = date1.getSeconds();
  var dow2 = date2.getDay();
  var hour2 = date2.getHours();
  var min2 = date2.getMinutes();
  var sec2 = date2.getSeconds();
  if (sign === '===') {
    if (dow1 == dow2 && hour1 === hour2 && min1 === min2 && sec1 === sec2) return true;
    else return false;
  } else if (sign === '>') {
    if (dow1 > dow2) return true;
    else if (dow1 == dow2 && hour1 > hour2) return true;
    else if (dow1 == dow2 && hour1 === hour2 && min1 > min2) return true;
    else if (dow1 == dow2 && hour1 === hour2 && min1 === min2 && sec1 > sec2) return true;
    else return false;
  }
}

test('DPT10 time conversion', function(t) {

  var tests = [
    ['DPT10', [(1<<5)+23, 15, 30], new Date('July 1, 2019 23:15:30')], // Monday
    ['DPT10', [(3<<5)+14, 55, 11], new Date('July 10, 2019 14:55:11')],// Wednesday
    ['DPT10', [(7<<5)+23, 15, 30], new Date('July 7, 2019 23:15:30')]  // Sunday
  ];
  for (var i = 0; i < tests.length; i++) {
    var dpt = DPTLib.resolve(tests[i][0]);
    var buf = new Buffer(tests[i][1]);
    var val = tests[i][2];

    // unmarshalling test (raw data to value)
    var converted = DPTLib.fromBuffer(buf, dpt);
    t.ok(timecompare(converted, '===', val) ,
      `${tests[i][0]} fromBuffer value ${buf.toString('hex')} => expected ${val}, got ${converted}`);

    // marshalling test (value to raw data)
    var apdu = {};
    DPTLib.populateAPDU(val, apdu, 'dpt10');
    t.ok(Buffer.compare(buf, apdu.data) == 0,
      `${tests[i][0]} formatAPDU value ${val} => expected ${buf.toString('hex')}, got ${apdu.data.toString('hex')}`);
  }
  t.end()
})
