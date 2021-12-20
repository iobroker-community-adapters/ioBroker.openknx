/**
 * knx.js - a pure Javascript library for KNX
 * (C) 2016 Elias Karakoulakis
 */

const Datapoint = require('../Datapoint');
const Log = require('../KnxLog');

class BinarySwitch {
  constructor(options, conn) {
    if (!options || !options.ga) throw 'must supply at least { ga }!';

    this.control_ga = options.ga;
    this.status_ga = options.status_ga;
    if (conn) this.bind(conn);
    this.log = Log.get();
  }
  bind(conn) {
    if (!conn) this.log.warn('must supply a valid KNX connection to bind to');
    this.conn = conn;
    this.control = new Datapoint({ ga: this.control_ga }, conn);
    if (this.status_ga)
      this.status = new Datapoint({ ga: this.status_ga }, conn);
  }
  // EventEmitter proxy for status ga (if its set), otherwise proxy control ga
  on(...args) {
    const tgt = this.status_ga ? this.status : this.control;
    try {
      tgt.on(...args);
    } catch (err) {
      this.log.error(err);
    }
  }
  switchOn() {
    if (!this.conn)
      this.log.warn('must supply a valid KNX connection to bind to');
    this.control.write(1);
  }
  switchOff() {
    if (!this.conn)
      this.log.warn('must supply a valid KNX connection to bind to');
    this.control.write(0);
  }
  write(v) {
    if (!this.conn)
      this.log.warn('must supply a valid KNX connection to bind to');
    this.control.write(v);
  }
}

module.exports = BinarySwitch;
