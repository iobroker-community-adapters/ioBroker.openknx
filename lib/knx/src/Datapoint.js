/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

const util = require('util');
const DPTLib = require('./dptlib');
const KnxLog = require('./KnxLog');
const {
  EventEmitter
} = require('events');

/*
 * A Datapoint is always bound to:
 * - a group address (eg. '1/2/3')
 * - (optionally) a datapoint type (defaults to DPT1.001)
 * You can also supply a valid connection to skip calling bind()
 */
class Datapoint extends EventEmitter {
  constructor(options, conn) {
    if (options == null || options.ga == null)
      throw 'must supply at least { ga, dpt }!';
    super();

    this.options = options;
    this.dptid = options.dpt || 'DPT1.001';
    this.dpt = DPTLib.resolve(this.dptid);
    KnxLog.get().trace('resolved %s to %j', this.dptid, this.dpt);
    this.current_value = null;
    if (conn) this.bind(conn);
  }

  /*
   * Bind the datapoint to a bus connection
   */
  bind(conn) {
    if (!conn) throw 'must supply a valid KNX connection to bind to';
    this.conn = conn;
    // bind generic event handler for our group address
    const gaevent = util.format('event_%s', this.options.ga);
    conn.on(gaevent, (evt, src, buf) => {
      // get the Javascript value from the raw buffer, if the DPT defines fromBuffer()
      switch (evt) {
        case 'GroupValue_Write':
        case 'GroupValue_Response':
          if (buf) {
            const jsvalue = DPTLib.fromBuffer(buf, this.dpt);
            this.emit('event', evt, jsvalue);
            this.update(jsvalue); // update internal state
          }
          break;
        default:
          this.emit('event', evt);
          // TODO: add default handler; maybe emit warning?
      }
    });
    // issue a GroupValue_Read request to try to get the initial state from the bus (if any)
    if (this.options.autoread)
      if (conn.conntime) {
        // immediately or...
        this.read();
      } else {
        // ... when the connection is established
        conn.on('connected', () => {
          this.read();
        });
      }
  }

  update(jsvalue) {
    const old_value = this.current_value;
    if (old_value === jsvalue) return;

    this.emit('change', this.current_value, jsvalue, this.options.ga);
    this.current_value = jsvalue; // TODO: This should probably change before the event is emitted
    const ts = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''); // TODO: Why are we timestamping, the logger formatter already timestamps.
    KnxLog.get().trace(
      '%s **** %s DATAPOINT CHANGE (was: %j)',
      ts,
      this.toString(),
      old_value
    );
  }

  /* format a Javascript value into the APDU format dictated by the DPT
   and submit a GroupValue_Write to the connection */
  write(value) {
    if (!this.conn) throw 'must supply a valid KNX connection to bind to';
    if (this.dpt.hasOwnProperty('range')) {
      // check if value is in range
      const {
        range
      } = this.dpt.basetype;
      const [min, max] = range;
      if (value < min || value > max) {
        throw util.format(
          'Value %j(%s) out of bounds(%j) for %s',
          value,
          typeof value,
          range,
          this.dptid
        );
      }
    }
    this.conn.write(
      this.options.ga,
      value,
      this.dptid,
      // once we've written to the bus, update internal state
      () => this.update(value)
    );
  }

  /*
   * Issue a GroupValue_Read request to the bus for this datapoint
   * use the optional callback() to get notified upon response
   */
  read(callback) {
    if (!this.conn) throw 'must supply a valid KNX connection to bind to';
    this.conn.read(this.options.ga, (src, buf) => {
      const jsvalue = DPTLib.fromBuffer(buf, this.dpt);
      if (typeof callback == 'function') callback(src, jsvalue);
    });
  }

  toString() {
    return util.format(
      '(%s) %s %s',
      this.options.ga,
      this.current_value,
      (this.dpt) ? ((this.dpt.subtype && this.dpt.subtype.unit) || '') : ''
    );
  }
}

module.exports = Datapoint;