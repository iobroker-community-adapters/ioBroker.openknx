"use strict";

/**
 * Constants for the knxproj parser library.
 * Port of xknxproject/const.py
 */

// Schema version constants
const ETS_6_SCHEMA_VERSION = 21;
const ETS_5_7_SCHEMA_VERSION = 20;
const ETS_5_6_SCHEMA_VERSION = 14;
const ETS_4_2_SCHEMA_VERSION = 11; // same for ETS 4.1

// DPT prefix constants
const MAIN_DPT = "DPT";
const MAIN_AND_SUB_DPT = "DPST";

// ETS4 product languages (used as fallback when knx_master.xml doesn't include ProductLanguages)
const ETS4_PRODUCT_LANGUAGES = [
    "cs-CZ",
    "da-DK",
    "de-DE",
    "el-GR",
    "en-US",
    "es-ES",
    "fi-FI",
    "fr-FR",
    "hu-HU",
    "is-IS",
    "it-IT",
    "ja-JP",
    "nb-NO",
    "nl-NL",
    "pl-PL",
    "pt-PT",
    "ro-RO",
    "ru-RU",
    "sk-SK",
    "sl-SI",
    "sv-SE",
    "tr-TR",
    "uk-UA",
    "zh-CN",
];

module.exports = {
    ETS_6_SCHEMA_VERSION,
    ETS_5_7_SCHEMA_VERSION,
    ETS_5_6_SCHEMA_VERSION,
    ETS_4_2_SCHEMA_VERSION,
    MAIN_DPT,
    MAIN_AND_SUB_DPT,
    ETS4_PRODUCT_LANGUAGES,
};
