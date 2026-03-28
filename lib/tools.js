const { dptlib: DPTLib } = require("knxultimate");
const util = require("node:util");
const FORBIDDEN_CHARS = /[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu;

/*
 * convert dpt into DPT1 or DPT1.001 notation when input is like DPT-1 or DPST-1-001
 */
function formatDpt(dpt) {
    if (dpt.indexOf("-") != -1) {
        const parts = dpt.split("-");
        if (parts.length == 3) {
            if (parts[2].length === 1) {
                parts[2] = `00${parts[2]}`;
            } else if (parts[2].length === 2) {
                parts[2] = `0${parts[2]}`;
            }
            dpt = `DPT${parts[1]}.${parts[2]}`.replace(/ /g, "");
        } else {
            dpt = `DPT${parts[1]}`.replace(/ /g, "");
        }
    }
    return dpt;
}

//possibly convert 2byte array into ././. form
function convertToGa(adr) {
    let formattedAdr = adr;
    const number = (adr.match(/\//g) || []).length;
    if (number == 2) {
        // 3 level
    } else if (number == 1) {
        //2 level
        const main = adr.substring(0, adr.indexOf("/") + 1);
        const sub = adr.substring(adr.indexOf("/") + 1, adr.length);
        formattedAdr = main + util.format("%d/%d", (sub >> 8) & 0x7, sub & 0xff);
    } else if (number == 0) {
        // free level with one number
        formattedAdr = util.format("%d/%d/%d", (adr >> 11) & 0x1f, (adr >> 8) & 0x7, adr & 0xff);
    } else {
        throw new Error(`unknown ga format ${adr}`);
    }
    return formattedAdr;
}

function isEmptyObject(obj) {
    return obj && Object.keys(obj).length === 0 && Object.getPrototypeOf(obj) === Object.prototype;
}

/*
 * iobroker does not support all characters, substitte by _
 */
function formatGaNameForIob(gaName) {
    //filter forbidden characters
    gaName = gaName.replace(FORBIDDEN_CHARS, "_");
    //format gaName
    return gaName.replace(/[.\s/]/g, "_");
}

function isStringDPT(dpt) {
    return (
        dpt == "DPT4" ||
        dpt.startsWith("DPT4.") ||
        dpt == "DPT16" ||
        dpt.startsWith("DPT16.") ||
        dpt == "DPT28" ||
        dpt.startsWith("DPT28.") ||
        //handle big number as string
        dpt == "DPT29" ||
        dpt.startsWith("DPT29.") ||
        //raw hex string
        dpt == "DPT999" ||
        dpt.startsWith("DPT999.")
    );
}

// DPTs that return objects (RGB, RGBW, etc.) - need common.type "object" in ioBroker
// Note: DPT2/DPT3/DPT18 also return objects but are handled separately (boolean/trigger/composite)
function isObjectDPT(dpt) {
    return /^DPT(21|22|213|222|232|235|237|242|249|251|275)($|\.)/.test(dpt);
}

function isDateDPT(dpt) {
    return (
        dpt == "DPT19" ||
        dpt.startsWith("DPT19.") ||
        dpt == "DPT10" ||
        dpt.startsWith("DPT10.") ||
        dpt == "DPT11" ||
        dpt.startsWith("DPT11.")
    );
}

function isBitDPT(dpt) {
    return dpt == "DPT1" || dpt.startsWith("DPT1.");
}

function isFloatDPT(dpt) {
    return dpt == "DPT9" || dpt.startsWith("DPT9.") || dpt == "DPT14" || dpt.startsWith("DPT14.");
}

function isTriggerDPT(dpt) {
    //used to exclude from autoread
    //scene is a trigger, do not request trigger on start, more to add
    return (
        dpt.startsWith("DPT1.001") || //DPT_Switch
        dpt.startsWith("DPT1.007") || //DPT_Step
        dpt.startsWith("DPT1.008") || //DPT_UpDown
        dpt.startsWith("DPT1.010") || //DPT_Start
        dpt.startsWith("DPT1.017") || //DPT_Trigger
        dpt.startsWith("DPT2.001") || //Switch_Control
        dpt == "DPT17" ||
        dpt.startsWith("DPT17.") ||
        dpt == "DPT18" ||
        dpt.startsWith("DPT18.") ||
        dpt == "DPT238.102" || //HVAC_Mode/Scene only
        dpt == "DPT3" || //dimming
        dpt.startsWith("DPT3.")
    );
}

function isUnknownDPT(dpt) {
    let dptObj = null;
    try {
        dptObj = DPTLib.resolve(dpt);
    } catch {
        return true;
    }
    return dptObj == null;
}

/* check if it is a Device Adress is in a.b.c format */
function isDeviceAddress(element) {
    const format = "\\d+\\.\\d+\\.\\d+";
    return element.match(format) != null;
}

/* check if it is a Group Address is in a/b/c format */
function isGroupAddress(element) {
    const format = "\\d+/\\d+/\\d+";
    return element.match(format) != null;
}

/*
 * Resolve a DPT string via knxultimate. ETS exports like DPST-5-0 become DPT5.000
 * after formatDpt(), but subtype 000 only exists for DPT15 and DPT16. For all other
 * DPTs this is just ETS saying "no specific subtype". In that case fall back to the
 * base DPT (e.g. DPT5) so knxultimate can encode/decode the value.
 */
function resolveDpt(dpt) {
    try {
        return { dpt, dptObj: DPTLib.resolve(dpt) };
    } catch {
        const base = dpt.split(".")[0];
        if (base !== dpt) {
            try {
                return { dpt: base, dptObj: DPTLib.resolve(base) };
            } catch { /* raw interface */ }
        }
        return { dpt, dptObj: {} };
    }
}

module.exports = {
    FORBIDDEN_CHARS,
    formatDpt,
    resolveDpt,
    formatGaNameForIob,
    isStringDPT,
    isObjectDPT,
    isDateDPT,
    isBitDPT,
    isUnknownDPT,
    isFloatDPT,
    isTriggerDPT,
    isEmptyObject,
    isGroupAddress,
    isDeviceAddress,
    convertToGa,
};
