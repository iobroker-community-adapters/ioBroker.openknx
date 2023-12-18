//
// DPT29: 8-byte signed value
//

exports.formatAPDU = function (value) {
  value = BigInt(value);
  const apdu_data = Buffer.allocUnsafe(8);
  apdu_data.writeBigInt64BE(value, 0);
  return apdu_data;
}

exports.fromBuffer = function (buf) {
  //convert, bigint not supported in JSON
  return buf.readBigInt64BE(0).toString();
}

exports.basetype = {
  bitlength: 64,
  signedness: 'signed',
  valuetype: 'basic',
  desc: '8-byte V64 signed value',                       
  range: [-9223372036854775808, 9223372036854775807],
}

// DPT29 subtypes
exports.subtypes = {
  '010': {
    use: 'G',
    desc: 'DPT_ActiveEnergy_V64',
    name: 'Active energy V64 (Wh)',
    unit: 'Wh'
  },

  '011': {
    use: 'G',
    desc: 'DPT_ApparantEnergy_V64',
    name: 'Apparant energy V64 (VAh)',
    unit: 'VAh'
  },

  '012': {
    use: 'G',
    desc: 'DPT_ReactiveEnergy_V64',
    name: 'Reactive energy V64 (VARh)',
    unit: 'VARh'
  }
}
