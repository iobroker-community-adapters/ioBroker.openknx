const axios = require("axios").default;
const DPTLib = require(__dirname + "/knx/src/dptlib"); //todo for the moment
const os = require("os");
const util = require("util");
const Netmask = require("netmask").Netmask;
const FORBIDDEN_CHARS = /[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu;
/**
 * Tests whether the given variable is a real object and not an Array
 * @param {any} it The variable to test
 * @returns {it is Record<string, any>}
 */
function isObject(it) {
    // This is necessary because:
    // typeof null === 'object'
    // typeof [] === 'object'
    // [] instanceof Object === true
    return Object.prototype.toString.call(it) === "[object Object]";
}

/**
 * Tests whether the given variable is really an Array
 * @param {any} it The variable to test
 * @returns {it is any[]}
 */
function isArray(it) {
    if (typeof Array.isArray === "function") return Array.isArray(it);
    return Object.prototype.toString.call(it) === "[object Array]";
}

/**
 * Translates text to the target language. Automatically chooses the right translation API.
 * @param {string} text The text to translate
 * @param {string} targetLang The target languate
 * @param {string} [yandexApiKey] The yandex API key. You can create one for free at https://translate.yandex.com/developers
 * @returns {Promise<string>}
 */
async function translateText(text, targetLang, yandexApiKey) {
    if (targetLang === "en") {
        return text;
    } else if (!text) {
        return "";
    }
    if (yandexApiKey) {
        return translateYandex(text, targetLang, yandexApiKey);
    } else {
        return translateGoogle(text, targetLang);
    }
}

/**
 * Translates text with Yandex API
 * @param {string} text The text to translate
 * @param {string} targetLang The target languate
 * @param {string} apiKey The yandex API key. You can create one for free at https://translate.yandex.com/developers
 * @returns {Promise<string>}
 */
async function translateYandex(text, targetLang, apiKey) {
    if (targetLang === "zh-cn") {
        targetLang = "zh";
    }
    try {
        const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${apiKey}&text=${encodeURIComponent(text)}&lang=en-${targetLang}`;
        const response = await axios({
            url,
            timeout: 15000
        });
        if (response.data && response.data.text && isArray(response.data.text)) {
            return response.data.text[0];
        }
        throw new Error("Invalid response for translate request");
    } catch (e) {
        throw new Error(`Could not translate to "${targetLang}": ${e}`);
    }
}

/**
 * Translates text with Google API
 * @param {string} text The text to translate
 * @param {string} targetLang The target languate
 * @returns {Promise<string>}
 */
async function translateGoogle(text, targetLang) {
    try {
        const url = `http://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}&ie=UTF-8&oe=UTF-8`;
        const response = await axios({
            url,
            timeout: 15000
        });
        if (isArray(response.data)) {
            // we got a valid response
            return response.data[0][0][0];
        }
        throw new Error("Invalid response for translate request");
    } catch (e) {
        if (e.response && e.response.status === 429) {
            throw new Error(
                `Could not translate to "${targetLang}": Rate-limited by Google Translate`
            );
        } else {
            throw new Error(`Could not translate to "${targetLang}": ${e}`);
        }
    }
}

/*
 * convert dpt into DPT1 or DPT1.001 format, input format is like DPT-275 or DPST-275-100
 */
function formatDpt(dpt) {
    if (dpt.indexOf("-") != -1) {
        const parts = dpt.split("-");
        if (parts.length == 3) {
            if (parts[2].length === 1) {
                parts[2] = "00" + parts[2];
            } else if (parts[2].length === 2) {
                parts[2] = "0" + parts[2];
            }
            dpt = ("DPT" + parts[1] + "." + parts[2]).replace(/' ', ''/);
        } else {
            dpt = ("DPT" + parts[1]).replace(/' ', ''/);
        }
    }
    return dpt;
}

//possibly convert 2byte array into ././. form
function convertToGa(adr) {
    //check if already in good format
    if (adr.includes("/")) return adr;
    //Bereiche: Hauptgruppe = 0..31, Mittelgruppe = 0..7, Untergruppe = 0..255
    return util.format("%d/%d/%d", (adr >> 11) & 0x1f, (adr >> 8) & 0x7, adr & 0xff);
}

//16 bit number
function convertToKnxAddr(adr) {
    //area, line, device address
    return util.format("%d.%d.%d", (adr >> 12) , (adr >> 8) & 0x0f, adr & 0x00ff);
}

function isEmptyObject(obj) {
    return (obj &&
        Object.keys(obj).length === 0 &&
        Object.getPrototypeOf(obj) === Object.prototype
    );
}

/*
 * iobroker does not support all characters, substitte by _
 */
function formatGaForIob(gaName) {
    //filter forbidden characters
    gaName = gaName.replace(FORBIDDEN_CHARS, "_");
    //format gaName
    return gaName.replace(/[\.\s\/]/g, "_");
}

function isStringDPT(dpt) {
    return (dpt == "DPT4" || dpt == "DPT16" || dpt.startsWith("DPT4.") || dpt.startsWith("DPT16."));
}

function isDateDPT(dpt) {
    return (dpt == "DPT19" || dpt.startsWith("DPT19.") ||
        dpt == "DPT10" || dpt.startsWith("DPT10.") ||
        dpt == "DPT11" || dpt.startsWith("DPT11.")
    );
}

function isFloatDPT(dpt) {
    return (dpt == "DPT9" || dpt.startsWith("DPT9.") ||
        dpt == "DPT14" || dpt.startsWith("DPT14.")
    );
}

function isTriggerDPT(dpt) {
    //used to exclude from autoread
    //scene is a trigger, do not request trigger on start, more to add
    return (dpt == "DPT17" || dpt.startsWith("DPT17.") ||
        dpt == "DPT18" || dpt.startsWith("DPT18.") ||
        dpt == "DPT26" || dpt.startsWith("DPT26.") ||
        dpt == "DPT238" || dpt.startsWith("DPT238.")
    );
}

function isUnknownDPT(dpt) {
    let dptObj = null;
    try {
        dptObj = DPTLib.resolve(dpt);
    } catch (e) {
        return true;
    }
    return dptObj == null;
}

/* check if it is a Device Adress is in a.b.c format */
function isDeviceAddress(element) {
    const format = "\\d+\\.\\d+\\.\\d+";
    return (element.match(format) != null);
}

/* check if it is a Group Address is in a/b/c format */
function isGroupAddress(element) {
    const format = "\\d+/\\d+/\\d+";
    return (element.match(format) != null);
}

module.exports = {
    FORBIDDEN_CHARS,
    getOwnAddress,
    isArray,
    isObject,
    translateText,
    formatDpt,
    formatGaForIob,
    isStringDPT,
    isDateDPT,
    isUnknownDPT,
    isFloatDPT,
    isTriggerDPT,
    isEmptyObject,
    isGroupAddress,
    isDeviceAddress,
    convertToGa,
    convertToKnxAddr
};