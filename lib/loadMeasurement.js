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
const maxLoadCount = (50 * intervalTime) / 1000; /* max assumed busload is 50 telegrams per second */

let telegramCount = 0;
let telegramCountPeriod = 0;

function cyclic() {
    const rate = (telegramCountPeriod / maxLoadCount) * 100;
    telegramCountPeriod = 0;
    return Math.min(Math.round(rate), 100);
}

function gettelegramCount() {
    return telegramCount;
}

/**
 * log knx bus event
 */
function logBusEvent() {
    telegramCount++;
    telegramCountPeriod++;
}

exports.intervalTime = intervalTime;
exports.cyclic = cyclic;
exports.gettelegramCount = gettelegramCount;
exports.logBusEvent = logBusEvent;
