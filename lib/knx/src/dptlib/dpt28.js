const log = require('log-driver').logger;

//
// DPT28: unicode string (variable length) UTF-8
//

exports.formatAPDU = (value) => {
  if (typeof value !== 'string') 
    return log.warn('Conversion error DPT28: Must supply a string value');

    try {
        const buf = Buffer.alloc(14);
        buf.write(value, 'utf-8');
        return buf;
    } catch (error) {
        return log.warn('Conversion error DPT28: error.message');
    }
}

exports.fromBuffer = (buf) => {
    return buf.toString('utf-8');
}

// DPT28 basetype info
exports.basetype = {
    bitlength: 14 * 8,
    valuetype: 'basic',
    desc: '14-character string',
}

// DPT28 subtypes
exports.subtypes = {
    // 28.001 UTF-8 string
    '001': {
        use: 'G',
        name: 'Unicode UTF-8 string',
        force_encoding: 'UTF-8'
    }
}