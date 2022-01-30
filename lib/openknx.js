/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * discover knx gateways
 * able to detect multiple devices
 * give all devices 500ms time to reply
 * invoked by openknx or discovery
 */

"use strict";

let tools;
try {
    // @ts-ignore
    tools = require("../tools.js"); //for adapter discovery
// eslint-disable-next-line no-empty
} catch (ex) {}
const udp = require("dgram");
const os = require("os");
const {
    Buffer
} = require("buffer");
const ipaddr = require("ipaddr.js");
const util = require("util");

const adapterName = "openknx";
const openknxTimeout = 500;
let gatewayIp;
let gatewayPort;
let knxAdr;
let deviceName;

function convertToKnxAddr(adr) {
    //area, line, device address
    return util.format("%d.%d.%d", (adr >> 12), (adr >> 8) & 0x0f, adr & 0x00ff);
}

//returns true if instance created
function addDevice(localIp, ip, port, knxAdr, deviceName, options) {
    if (options) {
        const instance = tools.findInstance(options, adapterName, obj => obj.native.gwip === ip);

        if (instance) {
            options.log.info(adapterName + ` adapter already present for IP ${ip}`);
        } else {
            options.newInstances.push({
                _id: tools.getNextInstanceID(adapterName, options),
                common: {
                    name: adapterName,
                    title: "KNX IP Gateway (" + ip + " - " + deviceName + ")"
                },
                native: {
                    gwip: ip,
                    gwipport: port,
                    eibadr: knxAdr,
                    localInterface: localIp
                },
                comment: {
                    add: "KNX IP Gateway (" + ip + " - " + deviceName + ")",
                    showConfig: true
                }
            });
            return true;
        }
    }
    return false;
}

function detect(ip, device, options, callback) {
    //ip is ping found for type ip or 255.255.255.255 for type udp

    // options.newInstances
    // options.existingInstances
    // device - additional info about device
    // options.log - logger
    // options.language - system language

    const mcast = "224.0.23.12";
    const mport = 3671;
    let devicesFound = 0;
    let interfaceProcessed = 0;
    let addedInstances = 0;

    let addresses = [ip];
    if (ip == "255.255.255.255") {
        addresses = getOwnAddresses();
    }

    addresses.forEach(ip => {
        udpScan(mcast, mport, ip, undefined, openknxTimeout, false, (err, msg, remote) => {
            if (!msg) {
                //regular timeout without err or abort with err
                interfaceProcessed++;
                if (callback && (interfaceProcessed == addresses.length)) {
                    //one joint callback when all done, last found devices data
                    callback(err, addedInstances > 0, gatewayIp, gatewayPort, knxAdr, deviceName, devicesFound);
                    callback = null;
                }
            } else {
                if (msg.length < 6) {
                    //Unknown KNX header format
                    return;
                }

                const header_length = msg[0];
                const protocol_version = msg[1];
                const service_identifier_1 = msg[2];
                const service_identifier_2 = msg[3];

                if (header_length != 0x6 || protocol_version != 0x10 || service_identifier_1 != 0x2 || service_identifier_2 != 0x2) {
                    //Unknown KNX header format
                    return;
                }

                const hpai_structure_length = msg[6];
                if (hpai_structure_length != 0x8) {
                    //Unknown KNX header format
                    return;
                }

                //hpai_protocol_code 1b
                const hpai_ip_address_1 = msg[8];
                const hpai_ip_address_2 = msg[9];
                const hpai_ip_address_3 = msg[10];
                const hpai_ip_address_4 = msg[11];
                const hpai_port_1 = msg[12];
                const hpai_port_2 = msg[13];

                const dib_structure_length = msg[14];
                if (dib_structure_length != 0x36) {
                    //Unknown KNX header format
                    return;
                }

                //dib_description_type 1b
                //dib_knx_medium 1b
                //dib_device_status 1b
                const dib_knx_address_1 = msg[18];
                const dib_knx_address_2 = msg[19];
                //dib_project_install_ident 2b
                //dib_dev_serial 6b
                //dib_dev_multicast_addr 4b
                //dib_dev_mac 6b
                const dib_dev_friendly_name = msg.slice(38, 38 + 30);

                gatewayIp = hpai_ip_address_1 + "." + hpai_ip_address_2 + "." + hpai_ip_address_3 + "." + hpai_ip_address_4;
                gatewayPort = (hpai_port_1 << 8) + hpai_port_2;
                knxAdr = convertToKnxAddr((dib_knx_address_1 << 8) + dib_knx_address_2);
                deviceName = String.fromCharCode.apply(null, dib_dev_friendly_name);

                if (addDevice(ip, gatewayIp, gatewayPort, knxAdr, deviceName, options))
                    addedInstances++;
                devicesFound++;
            }
        });
    });

}

//takeover from discovery.tools, diff: data is not known at beginning
//handles fully upd connection + timeout
function udpScan(probeAddress, probePort, listenAddress, listenPort, timeout, onlyOneResult, callback) {
    if (typeof onlyOneResult !== 'boolean') {
        callback = onlyOneResult;
        onlyOneResult = true;
    }

    const udpSocket = udp.createSocket({
        type: 'udp4',
        reuseAddr: true
    });

    const probeTimeout = setTimeout(() => {
        udpSocket.close();
        callback && callback(null, null);
        callback = null;
    }, timeout);

    udpSocket.on('error', err => {
        clearTimeout(probeTimeout);
        try {
            udpSocket.close();
        } catch (e) {}
        console.log('ERROR udpSocket: ' + err);
        if (callback) callback(err, null);
        callback = null;
    });

    udpSocket.bind(listenPort, listenAddress, () => {
        try {
            udpSocket.addMembership('224.0.0.1');
            udpSocket.setBroadcast(true);
        } catch (e) {
            udpSocket.emit('error', e);
        }
    });

    udpSocket.on('message', (message, remote) => {
        console.log('UDP Discovery response:' + remote.address + ':' + remote.port + ' - ' + message);
        if (onlyOneResult) {
            clearTimeout(probeTimeout);
            try {
                udpSocket.close();
            } catch (e) {}
        }
        callback && callback(null, message, remote);
        if (onlyOneResult) {
            callback = null;
        }
    });

    udpSocket.on('listening', () => {
        const address = udpSocket.address();
        const bytes = [
            0x06, //Header length
            0x10, //Protocol version 1.0
            0x02, 0x01, //Service Identifier: KNX Search Request
            0x00, 0x0e, //Total length
            0x08, //Structure length
            0x01, //Host protocol UDP
            ipaddr.parse(listenAddress).toByteArray()[0], //local ip
            ipaddr.parse(listenAddress).toByteArray()[1],
            ipaddr.parse(listenAddress).toByteArray()[2],
            ipaddr.parse(listenAddress).toByteArray()[3],
            (address.port & 0xff00) >> 8, //local port
            address.port & 0xff
        ];
        const data = Buffer.from(bytes);
        try {
            udpSocket.send(data, 0, data.length, probePort, probeAddress);
        } catch (e) {}
    });
}

/**
 * Find own IP address to communicate with other device
 *
 * The server/host can have several IP addresses and to choose a valid one (e.g. to use in settings)
 * we must check all owr IP addresses.
 *
 * @alias getOwnAddress
 * @return {string[]} own ip address of the interface which we can use to communicate with desired device
 */
function getOwnAddresses() {
    let addresses = [];
    let interfaces = os.networkInterfaces();

    for (const k in interfaces) {

        if (!interfaces.hasOwnProperty(k)) continue;

        for (const k2 in interfaces[k]) {
            if (!interfaces[k].hasOwnProperty(k2)) continue;
            const address = interfaces[k][k2];

            if (address.family === 'IPv4') {
                addresses.push(address.address);
            }
        }
    }
    return addresses;
}

exports.detect = detect;
exports.type = ["udp"];
exports.timeout = openknxTimeout;
