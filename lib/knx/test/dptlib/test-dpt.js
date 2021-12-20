/**
* knx.js - a KNX protocol stack in pure Javascript
* (C) 2016-2018 Elias Karakoulakis
*/

const test = require('tape');
const DPTLib = require('../../src/dptlib');
const assert = require('assert');

test('resolve', function(t) {
 

  var d0 = DPTLib.resolve(1)
  t.equal(d0.id, 'DPT1')
  t.equal(d0.subtypeid, undefined)

  var d1 = DPTLib.resolve('DPT9')
  t.equal(d1.id, 'DPT9')
  t.equal(d1.subtypeid, undefined)

  var d2 = DPTLib.resolve('DPT1.002')
  t.equal(d2.id, 'DPT1')
  t.equal(d2.subtypeid, '002')

  var d3 = DPTLib.resolve('DPT1.001')
  t.equal(d3.id, 'DPT1')
  t.equal(d3.subtypeid, '001')

  // Check that dpts are not destroyed by subsequent calls to resolve
  t.equal(d2.id, 'DPT1')
  t.equal(d2.subtypeid, '002')

  var d4 = DPTLib.resolve('1.002')
  t.equal(d4.id, 'DPT1')
  t.equal(d4.subtypeid, '002')

  t.end()
})
