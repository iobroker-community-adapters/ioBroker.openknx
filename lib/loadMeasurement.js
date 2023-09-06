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

const intervalTime = 5000; // ms
const maxLoadCount = 50 * intervalTime / 1000; /* max assumed busload is 50 telegrams per second */

let telegramCount;

/**
 * log knx bus event
 */
function logBusEvent() {
    telegramCount++;
}

function cyclic() {
    Math.min(telegramCount, maxLoadCount * intervalTime);
    const rate = (telegramCount / maxLoadCount) * 100;
    telegramCount = 0;
    return Math.min(Math.round(rate), 100);
}

exports.logBusEvent = logBusEvent;
exports.cyclic = cyclic;
exports.intervalTime = intervalTime;
