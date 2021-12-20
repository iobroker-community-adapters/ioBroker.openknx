/* eslint-disable quotes */
const axios = require("axios").default;
const DPTLib = require(__dirname + '/knx/src/dptlib'); //todo for the moment

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
 * convert dpt into 1/1/1 format
 */
function convertDPTtype(dpt) {
    if (dpt.indexOf('-') != -1) {
        const parts = dpt.split('-');
        if (parts.length == 3) {
            if (parts[2].length === 1) {
                parts[2] = '00' + parts[2]
            } else if (parts[2].length === 2) {
                parts[2] = '0' + parts[2]
            }
            dpt = ('DPT' + parts[1] + '.' + parts[2]).replace(/' ', ''/);
        } else {
            dpt = ('DPT' + parts[1]).replace(/' ', ''/);
        }
    }
    return dpt;
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
function formatGa(gaName) {
    return gaName.replace(/[\.\s\/]/g, '_');
}

function isStringDPT(dpt) {
    return (dpt == 'DPT4' || dpt == 'DPT16' || dpt.startsWith('DPT4.') || dpt.startsWith('DPT16.'));
}

function isDateDPT(dpt) {
    return (dpt == 'DPT19' || dpt.startsWith('DPT19.') ||
        dpt == 'DPT10' || dpt.startsWith('DPT10.') ||
        dpt == 'DPT11' || dpt.startsWith('DPT11.')
    );
}

function isFloatDPT(dpt) {
    return (dpt == 'DPT9' || dpt.startsWith('DPT9.') ||
        dpt == 'DPT14' || dpt.startsWith('DPT14.')
    );
}

function isStriggerDPT(dpt) {
    //used to exclude from autoread
    //scene is a trigger, do not request trigger on start, more to add
    return (dpt == 'DPT17' || dpt.startsWith('DPT17.'));
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

module.exports = {
    isArray,
    isObject,
    translateText,
    convertDPTtype,
    formatGa,
    isStringDPT,
    isDateDPT,
    isUnknownDPT,
    isFloatDPT,
    isStriggerDPT,
    isEmptyObject
};