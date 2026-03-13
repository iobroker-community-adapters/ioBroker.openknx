/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * discover knx gateways using knxultimate
 * invoked by openknx or ioBroker discovery adapter
 */

"use strict";

let tools;
try {
    // @ts-expect-error Not found
    tools = require("../tools.js"); //for adapter discovery
    // eslint-disable-next-line no-empty
} catch {}

const { KNXClient } = require("knxultimate");

const adapterName = "openknx";

function addDevice(localIp, ip, port, knxAdr, deviceName, options) {
    if (options) {
        const instance = tools.findInstance(options, adapterName, obj => obj.native.gwip === ip);

        if (instance) {
            options.log.info(`${adapterName} adapter already present for IP ${ip}`);
        } else {
            options.newInstances.push({
                _id: tools.getNextInstanceID(adapterName, options),
                common: {
                    name: adapterName,
                    title: `KNX IP Gateway (${ip} - ${deviceName})`,
                },
                native: {
                    deviceName: deviceName,
                    gwip: ip,
                    gwipport: port,
                    eibadr: knxAdr,
                    localInterface: localIp,
                },
                comment: {
                    add: `KNX IP Gateway (${ip} - ${deviceName})`,
                    showConfig: true,
                },
            });
            return true;
        }
    }
    return false;
}

function detect(ip, device, options, callback) {
    let addedInstances = 0;
    let gatewayIp;
    let gatewayPort;
    let knxAdr;
    let deviceName;

    KNXClient.discoverInterfaces()
        .then(interfaces => {
            for (const iface of interfaces) {
                gatewayIp = iface.ip;
                gatewayPort = iface.port;
                knxAdr = iface.ia;
                deviceName = iface.name;

                if (addDevice(ip, gatewayIp, gatewayPort, knxAdr, deviceName, options)) {
                    addedInstances++;
                }
            }
            if (callback) {
                callback(null, addedInstances > 0, gatewayIp, gatewayPort, knxAdr, deviceName, interfaces.length);
            }
        })
        .catch(err => {
            if (callback) {
                callback(err, false, undefined, undefined, undefined, undefined, 0);
            }
        });
}

exports.detect = detect;
exports.type = ["udp"];
exports.timeout = 500;
