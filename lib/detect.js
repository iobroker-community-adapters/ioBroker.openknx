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

const tools = require("./tools.js");
const dgram = require("dgram");
const {
    Buffer
} = require("buffer");
const ipaddr = require("ipaddr.js");

let devicesFound = 0;
let ip;
let port;
let knxAdr;
let deviceName;

function negativeCallback(server, callback) {
    if (server)
        server.close(() => {
            if (callback) {
                callback(null, false, ip);
                callback = null;
            }
        });
}

//returns true if instance creaeted
function addDevice(ip, port, knxAdr, deviceName, options) {
    if (options) {
        const instance = tools.findInstance(options, "openknx", obj =>
            obj.native.gwip === ip && obj.native.gwipport === 3671);
        if (!instance) {
            options.newInstances.push({
                _id: tools.getNextInstanceID("openknx", options), //??
                common: {
                    name: "openknx",
                    title: obj => obj.common.title, //todo
                },
                native: {
                    gwip: ip,
                    gwipport: 3671,
                    eibadr: "1.1.1"
                },
                comment: {
                    add: [""], //todo
                    showConfig: true
                }
            });
            return true;
        }
    }
    return false;
}

function detect(ip, device, options, callback) {

    //options.newInstances
    //options.existingInstances
    //options.log
    // device - additional info about device
    // options.log - logger
    // options.language - system language

    const mcast = "224.0.23.12";
    const mport = 3671;
    const server = dgram.createSocket("udp4");
    devicesFound = 0;

    let timeout = setTimeout(() => {
        timeout = null;
        if (devicesFound > 0 && server) {
            server.close(() => {
                const foundInstance = addDevice(ip, port, knxAdr, deviceName, options);
                if (callback) {
                    callback(null, foundInstance, ip, port, knxAdr, deviceName, devicesFound);
                    callback = null;
                }
            });
        } else {
            negativeCallback(server, callback);
        }
    }, 500);

    server.on("error", (err) => {
        console.log(`server error:\n${err.stack}`);
        server.close();
        //negativeCallback(server, callback);
    });

    server.on("message", (msg, rinfo) => {
        console.log(rinfo.address + ":" + rinfo.port + " - " + msg);

        if (msg.length < 6) {
            //Unknown KNX header format
            //negativeCallback(server, callback);
            return;
        }

        const header_length = msg[0];
        const protocol_version = msg[1];
        const service_identifier_1 = msg[2];
        const service_identifier_2 = msg[3];

        if (header_length != 0x6 || protocol_version != 0x10 || service_identifier_1 != 0x2 || service_identifier_2 != 0x2) {
            //Unknown KNX header format
            //negativeCallback(server, callback);
            return;
        }

        const hpai_structure_length = msg[6];
        if (hpai_structure_length != 0x8) {
            //Unknown KNX header format
            //negativeCallback(server, callback);
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
            //negativeCallback(server, callback);
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

        devicesFound += 1;
        //take values from first found device
        if (devicesFound == 1) {
            ip = hpai_ip_address_1 + "." + hpai_ip_address_2 + "." + hpai_ip_address_3 + "." + hpai_ip_address_4;
            port = (hpai_port_1 << 8) + hpai_port_2;
            knxAdr = tools.convertToKnxAddr((dib_knx_address_1 << 8) + dib_knx_address_2);
            deviceName = String.fromCharCode.apply(null, dib_dev_friendly_name);
        }
    });

    server.on("listening", () => {
        //The 'listening' event is emitted once the dgram.Socket is addressable. This happens either explicitly with socket.bind()
        const address = server.address();
        console.log(`server listening ${address.address}:${address.port}`);

        const bytes = [
            0x06, //Header length
            0x10, //Protocol version 1.0
            0x02, 0x01, //Service Identifier: KNX Search Request
            0x00, 0x0e, //Total length
            0x08, //Structure length
            0x01, //Host protocol UDP
            ipaddr.parse(ip).toByteArray()[0], //local ip
            ipaddr.parse(ip).toByteArray()[1],
            ipaddr.parse(ip).toByteArray()[2],
            ipaddr.parse(ip).toByteArray()[3],
            (address.port & 0xff00) >> 8, //local port
            address.port & 0xff
        ];
        const message = Buffer.from(bytes);
        server.send(message, mport, mcast, err => {
            if (err) {
                console.log("Error discovery: " + err);
            }
        });
    });

    server.bind(65123, ip);
}

exports.detect = detect;
exports.type = ["udp"];
exports.timeout = 500;