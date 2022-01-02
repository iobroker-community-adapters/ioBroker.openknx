/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

const os = require('os');
const util = require('util');
const ipaddr = require('ipaddr.js');
const machina = require('machina');
const KnxConstants = require('./KnxConstants.js');
const IpRoutingConnection = require('./IpRoutingConnection.js');
const IpTunnelingConnection = require('./IpTunnelingConnection.js');
const KnxLog = require('./KnxLog.js');

module.exports = machina.Fsm.extend({
  initialize(options) {
    this.options = options || {};
    // initialise the log driver - to set the loglevel
    this.log = KnxLog.get(options);
    // set the local IP endpoint
    this.localAddress = null;
    this.ThreeLevelGroupAddressing = true;
    // reconnection cycle counter
    this.reconnection_cycles = 0;
    // a cache of recently sent requests
    this.sentTunnRequests = {};
    this.useTunneling = options.forceTunneling || false;
    this.remoteEndpoint = {
      addrstring: options.ipAddr,
      addr: ipaddr.parse(options.ipAddr),
      port: options.ipPort || 3671,
    };
    const range = this.remoteEndpoint.addr.range();
    this.localEchoInTunneling =
      typeof options.localEchoInTunneling !== 'undefined'
        ? options.localEchoInTunneling
        : false; // 14=73/2020 Supergiovane (local echo of emitEvent if in tunneling mode)
    this.log.debug(
      'initializing %s connection to %s',
      range,
      this.remoteEndpoint.addrstring
    );
    switch (range) {
      case 'multicast':
        if (this.localEchoInTunneling) {
          this.localEchoInTunneling = false;
          this.log.debug(
            'localEchoInTunneling: true but DISABLED because i am on multicast'
          );
        } // 14/03/2020 Supergiovane: if multicast, disable the localEchoInTunneling, because there is already an echo
        IpRoutingConnection(this);
        break;
      case 'unicast':
      case 'private':
      case 'loopback':
        this.useTunneling = true;
        IpTunnelingConnection(this);
        break;
      default:
        throw util.format(
          'IP address % (%s) cannot be used for KNX',
          options.ipAddr,
          range
        );
    }
  },

  namespace: 'knxnet',

  initialState: 'uninitialized',

  states: {
    uninitialized: {
      ['*']() {
        this.transition('connecting');
      },
    },

    jumptoconnecting: {
      _onEnter() {
        this.transition('connecting');
      },
    },

    connecting: {
      _onEnter() {
        // tell listeners that we disconnected
        // putting this here will result in a correct state for our listeners
        this.emit('disconnected');
        this.log.debug(util.format('useTunneling=%j', this.useTunneling));
        if (this.useTunneling) {
          let connection_attempts = 0;
          if (!this.localAddress)
            throw 'Not bound to an IPv4 non-loopback interface';
          this.log.debug(
            util.format('Connecting via %s...', this.localAddress)
          );
          // we retry 3 times, then restart the whole cycle using a slower and slower rate (max delay is 5 minutes)
          this.connecttimer = setInterval(() => {
            connection_attempts += 1;
            if (connection_attempts >= 3) {
              clearInterval(this.connecttimer);
              // quite a few KNXnet/IP devices drop any tunneling packets received via multicast
              if (this.remoteEndpoint.addr.range() == 'multicast') {
                this.log.warn(
                  'connection timed out, falling back to pure routing mode...'
                );
                this.usingMulticastTunneling = true;
                this.transition('connected');
              } else {
                // we restart the connection cycle with a growing delay (max 5 minutes)
                this.reconnection_cycles += 1;
                const delay = Math.min(this.reconnection_cycles * 3, 300);
                this.log.debug(
                  'reattempting connection in ' + delay + ' seconds'
                );
                setTimeout(
                  // restart connecting cycle (cannot jump straight to 'connecting' so we use an intermediate state)
                  () => this.transition('jumptoconnecting'),
                  delay * 1000
                );
              }
            } else {
              this.log.warn('connection timed out, retrying...');
              this.send(
                this.prepareDatagram(KnxConstants.SERVICE_TYPE.CONNECT_REQUEST)
              );
            }
          }, 3000);
          delete this.channel_id;
          delete this.conntime;
          delete this.lastSentTime;
          // send connect request directly
          this.send(
            this.prepareDatagram(KnxConstants.SERVICE_TYPE.CONNECT_REQUEST)
          );
        } else {
          // no connection sequence needed in pure multicast routing
          this.transition('connected');
        }
      },
      _onExit() {
        clearInterval(this.connecttimer);
      },
      inbound_CONNECT_RESPONSE(datagram) {
        this.log.debug(util.format('got connect response'));
        if (
          datagram.hasOwnProperty('connstate') &&
          datagram.connstate.status ===
            KnxConstants.RESPONSECODE.E_NO_MORE_CONNECTIONS
        ) {
          try {
            this.socket.close();
          } catch (error) {}
          this.transition('uninitialized');
          this.emit('disconnected');
          this.log.debug(
            'The KNXnet/IP server rejected the data connection (Maximum connections reached). Waiting 1 minute before retrying...'
          );
          setTimeout(() => {
            this.Connect();
          }, 60000);
        } else {
          // store channel ID into the Connection object
          this.channel_id = datagram.connstate.channel_id;
          // send connectionstate request directly
          this.send(
            this.prepareDatagram(
              KnxConstants.SERVICE_TYPE.CONNECTIONSTATE_REQUEST
            )
          );
          // TODO: handle send err
        }
      },
      inbound_CONNECTIONSTATE_RESPONSE(datagram) {
        if (this.useTunneling) {
          const str = KnxConstants.keyText(
            'RESPONSECODE',
            datagram.connstate.status
          );
          this.log.debug(
            util.format(
              'Got connection state response, connstate: %s, channel ID: %d',
              str,
              datagram.connstate.channel_id
            )
          );
          this.transition('connected');
        }
      },
      ['*'](data) {
        this.log.debug(util.format('*** deferring Until Transition %j', data));
        this.deferUntilTransition('idle');
      },
    },

    connected: {
      _onEnter() {
        // Reset connection reattempts cycle counter for next disconnect
        this.reconnection_cycles = 0;
        // Reset outgoing sequence counter..
        this.seqnum = -1;
        /* important note: the sequence counter is SEPARATE for incoming and
          outgoing datagrams. We only keep track of the OUTGOING L_Data.req
          and we simply acknowledge the incoming datagrams with their own seqnum */
        this.lastSentTime = this.conntime = Date.now();
        this.log.debug(
          util.format(
            '--- Connected in %s mode ---',
            this.useTunneling ? 'TUNNELING' : 'ROUTING'
          )
        );
        this.transition('idle');
        this.emit('connected');
      },
    },

    disconnecting: {
      // TODO: skip on pure routing
      _onEnter() {
        if (this.useTunneling) {
          const aliveFor = this.conntime ? Date.now() - this.conntime : 0;
          KnxLog.get().debug(
            '(%s):\tconnection alive for %d seconds',
            this.compositeState(),
            aliveFor / 1000
          );
          this.disconnecttimer = setTimeout(() => {
            KnxLog.get().debug(
              '(%s):\tconnection timed out',
              this.compositeState()
            );
            try {
              this.socket.close();
            } catch (error) {}
            this.transition('uninitialized');
            this.emit('disconnected');
          }, 3000);
          //
          this.send(
            this.prepareDatagram(KnxConstants.SERVICE_TYPE.DISCONNECT_REQUEST),
            (err) => {
              // TODO: handle send err
              KnxLog.get().debug(
                '(%s):\tsent DISCONNECT_REQUEST',
                this.compositeState()
              );
            }
          );
        }
      },
      _onExit() {
        clearTimeout(this.disconnecttimer);
      },
      inbound_DISCONNECT_RESPONSE(datagram) {
        if (this.useTunneling) {
          KnxLog.get().debug(
            '(%s):\tgot disconnect response',
            this.compositeState()
          );
          try {
            this.socket.close();
          } catch (error) {}
          this.transition('uninitialized');
          this.emit('disconnected');
        }
      },
    },

    idle: {
      _onEnter() {
        if (this.useTunneling) {
            if (this.idletimer == null) { // set one
                // time out on inactivity...
                this.idletimer = setTimeout( () => {
                    this.transition('requestingConnState');
                    clearTimeout(this.idletimer);
                    this.idletimer = null;
                }, 60000);
            }
        }
        // debuglog the current FSM state plus a custom message
        KnxLog.get().debug('(%s):\t%s', this.compositeState(), ' zzzz...');
        // process any deferred items from the FSM internal queue
        this.processQueue();
      },
      _onExit() {
        //clearTimeout(this.idletimer);
      },
      // while idle we can either...

      // 1) queue an OUTGOING routing indication...
      outbound_ROUTING_INDICATION(datagram) {
        const elapsed = Date.now() - this.lastSentTime;
        // if no miminum delay set OR the last sent datagram was long ago...
        if (
          !this.options.minimumDelay ||
          elapsed >= this.options.minimumDelay
        ) {
          // ... send now
          this.transition('sendDatagram', datagram);
        } else {
          // .. or else, let the FSM handle it later
          setTimeout(
            () => this.handle('outbound_ROUTING_INDICATION', datagram),
            this.minimumDelay - elapsed
          );
        }
      },

      // 2) queue an OUTGOING tunelling request...
      outbound_TUNNELING_REQUEST(datagram) {
        if (this.useTunneling) {
          const elapsed = Date.now() - this.lastSentTime;
          // if no miminum delay set OR the last sent datagram was long ago...
          if (
            !this.options.minimumDelay ||
            elapsed >= this.options.minimumDelay
          ) {
            // ... send now
            this.transition('sendDatagram', datagram);
          } else {
            // .. or else, let the FSM handle it later
            setTimeout(
              () => this.handle('outbound_TUNNELING_REQUEST', datagram),
              this.minimumDelay - elapsed
            );
          }
        } else {
          KnxLog.get().debug(
            "(%s):\tdropping outbound TUNNELING_REQUEST, we're in routing mode",
            this.compositeState()
          );
        }
      },

      // 3) receive an INBOUND tunneling request INDICATION (L_Data.ind)
      ['inbound_TUNNELING_REQUEST_L_Data.ind'](datagram) {
        if (this.useTunneling) {
          this.transition('recvTunnReqIndication', datagram);
        }
      },

      /* 4) receive an INBOUND tunneling request CONFIRMATION (L_Data.con) to one of our sent tunnreq's
       * We don't need to explicitly wait for a L_Data.con confirmation that the datagram has in fact
       *  reached its intended destination. This usually requires setting the 'Sending' flag
       *  in ETS, usually on the 'primary' device that contains the actuator endpoint
       */
      ['inbound_TUNNELING_REQUEST_L_Data.con'](datagram) {
        if (this.useTunneling) {
          const confirmed = this.sentTunnRequests[datagram.cemi.dest_addr];
          if (confirmed) {
            delete this.sentTunnRequests[datagram.cemi.dest_addr];
            this.emit('confirmed', confirmed);
          }
          KnxLog.get().trace(
            '(%s): %s %s',
            this.compositeState(),
            datagram.cemi.dest_addr,
            confirmed
              ? 'delivery confirmation (L_Data.con) received'
              : 'unknown dest addr'
          );
          this.acknowledge(datagram);
        }
      },

      // 5) receive an INBOUND ROUTING_INDICATION (L_Data.ind)
      ['inbound_ROUTING_INDICATION_L_Data.ind'](datagram) {
        this.emitEvent(datagram);
      },

      inbound_DISCONNECT_REQUEST(datagram) {
        if (this.useTunneling) {
          this.transition('connecting');
        }
      },
    },

    // if idle for too long, request connection state from the KNX IP router
    requestingConnState: {
      _onEnter() {
        // added to note sending connectionstate_request
        KnxLog.get().debug( 'Requesting Connection State');
        KnxLog.get().trace(
          '(%s): Requesting Connection State',
          this.compositeState()
        );
        this.send(
          this.prepareDatagram(
            KnxConstants.SERVICE_TYPE.CONNECTIONSTATE_REQUEST
          )
        );
        // TODO: handle send err
        //
        this.connstatetimer = setTimeout(() => {
          const msg = 'timed out waiting for CONNECTIONSTATE_RESPONSE';
          KnxLog.get().trace('(%s): %s', this.compositeState(), msg);
          this.transition('connecting');
          this.emit('error', msg);
        }, 1000);
      },
      _onExit() {
        clearTimeout(this.connstatetimer);
      },
      inbound_CONNECTIONSTATE_RESPONSE(datagram) {
        const state = KnxConstants.keyText(
          'RESPONSECODE',
          datagram.connstate.status
        );
        switch (datagram.connstate.status) {
          case 0:
            this.transition('idle');
            break;
          default:
            this.log.debug(
              util.format(
                '*** error: %s *** (connstate.code: %d)',
                state,
                datagram.connstate.status
              )
            );
            this.transition('connecting');
            this.emit('error', state);
        }
      },
      ['*'](data) {
        this.log.debug(
          util.format(
            '*** deferring %s until transition from requestingConnState => idle',
            data.inputType
          )
        );
        this.deferUntilTransition('idle');
      },
    },

    /*
     * 1) OUTBOUND DATAGRAM (ROUTING_INDICATION or TUNNELING_REQUEST)
     */
    sendDatagram: {
      _onEnter(datagram) {
        // send the telegram on the wire
        this.seqnum += 1;
        if (this.useTunneling) datagram.tunnstate.seqnum = this.seqnum & 0xff;
        this.send(datagram, (err) => {
          if (err) {
            //console.trace('error sending datagram, going idle');
            this.seqnum -= 1;
            this.transition('idle');
          } else {
            // successfully sent the datagram
            if (this.useTunneling)
              this.sentTunnRequests[datagram.cemi.dest_addr] = datagram;
            this.lastSentTime = Date.now();
            this.log.debug(
              '(%s):\t>>>>>>> successfully sent seqnum: %d',
              this.compositeState(),
              this.seqnum
            );
            if (this.useTunneling) {
              // and then wait for the acknowledgement
              this.transition('sendTunnReq_waitACK', datagram);
            } else {
              this.transition('idle');
            }
          }
          // 14/03/2020 Supergiovane: In multicast mode, other node-red nodes receives the echo of the telegram sent (the groupaddress_write event). If in tunneling, force the emit of the echo datagram (so other node-red nodes can receive the echo), because in tunneling, there is no echo.
          // ########################
          //if (this.useTunneling) this.sentTunnRequests[datagram.cemi.dest_addr] = datagram;
          if (this.useTunneling) {
            this.sentTunnRequests[datagram.cemi.dest_addr] = datagram;
            if (
              typeof this.localEchoInTunneling !== 'undefined' &&
              this.localEchoInTunneling
            ) {
              try {
                this.emitEvent(datagram);
                this.log.debug(
                  '(%s):\t>>>>>>> localEchoInTunneling: echoing by emitting %d',
                  this.compositeState(),
                  this.seqnum
                );
              } catch (error) {
                this.log.debug(
                  '(%s):\t>>>>>>> localEchoInTunneling: error echoing by emitting %d ' +
                    error,
                  this.compositeState(),
                  this.seqnum
                );
              }
            }
          }
          // ########################
        });
      },
      ['*'](data) {
        this.log.debug(
          util.format(
            '*** deferring %s until transition sendDatagram => idle',
            data.inputType
          )
        );
        this.deferUntilTransition('idle');
      },
    },
    /*
     * Wait for tunneling acknowledgement by the IP router; this means the sent UDP packet
     * reached the IP router and NOT that the datagram reached its final destination
     */
    sendTunnReq_waitACK: {
      _onEnter(datagram) {
        //this.log.debug('setting up tunnreq timeout for %j', datagram);
        this.tunnelingAckTimer = setTimeout(() => {
          this.log.debug('timed out waiting for TUNNELING_ACK');
          // TODO: resend datagram, up to 3 times
          this.transition('idle');
          this.emit('tunnelreqfailed', datagram);
        }, 2000);
      },
      _onExit() {
        clearTimeout(this.tunnelingAckTimer);
      },
      inbound_TUNNELING_ACK(datagram) {
        this.log.debug(
          util.format(
            '===== datagram %d acknowledged by IP router',
            datagram.tunnstate.seqnum
          )
        );
        this.transition('idle');
      },
      ['*'](data) {
        this.log.debug(
          util.format(
            '*** deferring %s until transition sendTunnReq_waitACK => idle',
            data.inputType
          )
        );
        this.deferUntilTransition('idle');
      },
    },

    /*
     * 2) INBOUND tunneling request (L_Data.ind) - only in tunnelling mode
     */
    recvTunnReqIndication: {
      _onEnter(datagram) {
        this.seqnumRecv = datagram.tunnstate.seqnum;
        this.acknowledge(datagram);
        this.transition('idle');
        this.emitEvent(datagram);
      },
      ['*'](data) {
        this.log.debug(util.format('*** deferring Until Transition %j', data));
        this.deferUntilTransition('idle');
      },
    },
  },

  acknowledge(datagram) {
    const ack = this.prepareDatagram(
      KnxConstants.SERVICE_TYPE.TUNNELING_ACK,
      datagram
    );
    /* acknowledge by copying the inbound datagram's sequence counter */
    ack.tunnstate.seqnum = datagram.tunnstate.seqnum;
    this.send(ack, (err) => {
      // TODO: handle send err
    });
  },

  emitEvent(datagram) {
    // emit events to our beloved subscribers in a multitude of targets
    // ORDER IS IMPORTANT!
    const evtName = datagram.cemi.apdu.apci;
    // 1.
    // 'event_<dest_addr>', ''GroupValue_Write', src, data
    this.emit(
      util.format('event_%s', datagram.cemi.dest_addr),
      evtName,
      datagram.cemi.src_addr,
      datagram.cemi.apdu.data
    );
    // 2.
    // 'GroupValue_Write_1/2/3', src, data
    this.emit(
      util.format('%s_%s', evtName, datagram.cemi.dest_addr),
      datagram.cemi.src_addr,
      datagram.cemi.apdu.data
    );
    // 3.
    // 'GroupValue_Write', src, dest, data
    this.emit(
      evtName,
      datagram.cemi.src_addr,
      datagram.cemi.dest_addr,
      datagram.cemi.apdu.data
    );
    // 4.
    // 'event', 'GroupValue_Write', src, dest, data
    this.emit(
      'event',
      evtName,
      datagram.cemi.src_addr,
      datagram.cemi.dest_addr,
      datagram.cemi.apdu.data
    );
  },

  getLocalAddress() {
    const candidateInterfaces = this.getIPv4Interfaces();
    // if user has declared a desired interface then use it
    if (this.options && this.options.interface) {
      const iface = candidateInterfaces[this.options.interface];
      if (!iface)
        throw new Error(
          'Interface ' +
            this.options.interface +
            ' not found or has no useful IPv4 address!'
        );

      return candidateInterfaces[this.options.interface].address;
    }
    // just return the first available IPv4 non-loopback interface
    const first = Object.values(candidateInterfaces)[0];
    if (first) return first.address;

    // no local IpV4 interfaces?
    throw 'No valid IPv4 interfaces detected';
  },

  // get the local address of the IPv4 interface we're going to use
  getIPv4Interfaces() {
    const candidateInterfaces = {};
    const interfaces = os.networkInterfaces();
    for (const [iface, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs) {
        if (addr.family == 'IPv4' && !addr.internal) {
          this.log.trace(
            util.format('candidate interface: %s (%j)', iface, addr)
          );
          candidateInterfaces[iface] = addr;
        }
      }
    }
    return candidateInterfaces;
  },
});
