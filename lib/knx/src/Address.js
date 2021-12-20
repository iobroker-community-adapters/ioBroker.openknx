/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */
const KnxLog = require('./KnxLog');
const Parser = require('binary-parser').Parser;

//           +-----------------------------------------------+
// 16 bits   |              INDIVIDUAL ADDRESS               |
//           +-----------------------+-----------------------+
//           | OCTET 0 (high byte)   |  OCTET 1 (low byte)   |
//           +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//    bits   | 7| 6| 5| 4| 3| 2| 1| 0| 7| 6| 5| 4| 3| 2| 1| 0|
//           +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//           |  Subnetwork Address   |                       |
//           +-----------+-----------+     Device Address    |
//           |(Area Adrs)|(Line Adrs)|                       |
//           +-----------------------+-----------------------+

//           +-----------------------------------------------+
// 16 bits   |             GROUP ADDRESS (3 level)           |
//           +-----------------------+-----------------------+
//           | OCTET 0 (high byte)   |  OCTET 1 (low byte)   |
//           +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//    bits   | 7| 6| 5| 4| 3| 2| 1| 0| 7| 6| 5| 4| 3| 2| 1| 0|
//           +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//           |  | Main Grp  | Midd G |       Sub Group       |
//           +--+--------------------+-----------------------+
//           +-----------------------------------------------+
// 16 bits   |             GROUP ADDRESS (2 level)           |
//           +-----------------------+-----------------------+
//           | OCTET 0 (high byte)   |  OCTET 1 (low byte)   |
//           +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//    bits   | 7| 6| 5| 4| 3| 2| 1| 0| 7| 6| 5| 4| 3| 2| 1| 0|
//           +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//           |  | Main Grp  |            Sub Group           |
//           +--+--------------------+-----------------------+
// NOTE: ets4 can utilise all 5 bits for the main group (0..31)

const TYPE = {
  PHYSICAL: 0x00,
  GROUP: 0x01,
};

const threeLevelPhysical = new Parser().bit4('l1').bit4('l2').uint8('l3');
const threeLevelGroup = new Parser().bit5('l1').bit3('l2').uint8('l3');
const twoLevel = new Parser().bit5('l1').bit11('l2');

// convert address stored in two-byte buffer to string
const toString = function (
  buf /*buffer*/,
  addrtype /*ADDRESS_TYPE*/,
  twoLevelAddressing /*boolean*/
) {
  const group = addrtype == TYPE.GROUP;
  //KnxLog.get().trace('%j, type: %d, %j', buf, addrtype, knxnetprotocol.twoLevelAddressing);
  if (!Buffer.isBuffer(buf) || buf.length !== 2)
    throw 'not a buffer, or not a 2-byte address buffer';
  if (group && twoLevelAddressing) {
    // 2 level group
    const { l1, l2 } = twoLevel.parse(buf);
    return [l1, l2].join('/');
  }
  // 3 level physical or group address
  const sep = group ? '/' : '.';
  const parser = group ? threeLevelGroup : threeLevelPhysical;
  const { l1, l2, l3 } = parser.parse(buf);
  return [l1, l2, l3].join(sep);
};

// check for out of range integer
const r = (x, max) => x < 0 || x > max;
// parse address string to 2-byte Buffer
const parse = function (
  addr /*string*/,
  addrtype /*TYPE*/,
  twoLevelAddressing
) {
  if (!addr) {
    KnxLog.get().warn('Fix your code - no address given to Address.parse');
  }
  const group = addrtype === TYPE.GROUP;
  const address = Buffer.allocUnsafe(2);
  const tokens = addr
    .split(group ? '/' : '.')
    .filter((w) => w.length > 0)
    .map((w) => parseInt(w));
  if (tokens.length < 2) throw 'Invalid address (less than 2 tokens)';
  const [hinibble, midnibble, lonibble] = tokens;
  if (group && twoLevelAddressing) {
    // 2 level group address
    if (r(hinibble, 31)) throw 'Invalid KNX 2-level main group: ' + addr;
    if (r(midnibble, 2047)) throw 'Invalid KNX 2-level sub group: ' + addr;
    address.writeUInt16BE((hinibble << 11) + midnibble, 0);
    return address;
  }
  if (tokens.length < 3) throw 'Invalid address - missing 3rd token';
  if (group) {
    // 3 level group address
    if (r(hinibble, 31)) throw 'Invalid KNX 3-level main group: ' + addr;
    if (r(midnibble, 7)) throw 'Invalid KNX 3-level mid group: ' + addr;
    if (r(lonibble, 255)) throw 'Invalid KNX 3-level sub group: ' + addr;
    address.writeUInt8((hinibble << 3) + midnibble, 0);
    address.writeUInt8(lonibble, 1);
    return address;
  }
  // 3 level physical address
  if (r(hinibble, 15)) throw 'Invalid KNX area address: ' + addr;
  if (r(midnibble, 15)) throw 'Invalid KNX line address: ' + addr;
  if (r(lonibble, 255)) throw 'Invalid KNX device address: ' + addr;
  address.writeUInt8((hinibble << 4) + midnibble, 0);
  address.writeUInt8(lonibble, 1);
  return address;
};

module.exports = { TYPE, toString, parse };
