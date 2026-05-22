#!/usr/bin/env node
/**
 * Postinstall: applies knxultimate diagnostic patches in pure JS so it works
 * regardless of where npm hoists node_modules (ioBroker, monorepos, etc.).
 *
 * The patches add ERROR-level logging for two silent-failure modes:
 *   1. TUNNELING_ACK with mismatched channelID (gateway lost tunnel state)
 *   2. L_DATA_CON with C-flag error bit set (bus delivery FAILED)
 *
 * Idempotent (marker check) and non-fatal (the adapter still runs without the
 * patches; main.js verifies on startup whether they were applied).
 */

const fs = require("fs");
const path = require("path");

const log = msg => console.log(`[apply-patches] ${msg}`);
const ADAPTER_ROOT = path.resolve(__dirname, "..");

function resolvePackageDir(pkgName) {
    try {
        const pkgJson = require.resolve(`${pkgName}/package.json`, { paths: [ADAPTER_ROOT] });
        return path.dirname(pkgJson);
    } catch {
        return null;
    }
}

function patchKnxultimate() {
    const pkgDir = resolvePackageDir("knxultimate");
    if (!pkgDir) {
        log("knxultimate not installed, skipping.");
        return;
    }
    const target = path.join(pkgDir, "build", "KNXClient.js");
    if (!fs.existsSync(target)) {
        log(`knxultimate found at ${pkgDir} but build/KNXClient.js is missing.`);
        return;
    }

    let src = fs.readFileSync(target, "utf8");
    if (src.includes("NEGATIVE confirmation (C-flag error bit set)")) {
        log("knxultimate already patched, nothing to do.");
        return;
    }

    // Patch 1: TUNNELING_ACK channelID mismatch — silent return becomes ERROR log.
    const ackOld =
        "if (knxTunnelingAck.channelID !== this._channelID) {\n" +
        "                    return;\n" +
        "                }";
    const ackNew =
        "if (knxTunnelingAck.channelID !== this._channelID) {\n" +
        "                    this.sysLogger.error(`Received KNX packet: TUNNELING_ACK with mismatched channelID: received=${knxTunnelingAck.channelID} expected=${this._channelID} seqCounter=${knxTunnelingAck.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}. This may indicate the gateway lost tunnel state — outbound writes will stall until reconnect.`);\n" +
        "                    return;\n" +
        "                }";

    // Patch 2: L_DATA_CON debug log becomes conditional — ERROR if C-flag error bit set.
    const conOld =
        "else if (knxTunnelingRequest.cEMIMessage.msgCode ===\n" +
        "                    CEMIConstants_1.default.L_DATA_CON) {\n" +
        "                    this.sysLogger.debug(`[${(0, utils_1.getTimestamp)()}] ` +\n" +
        "                        `Received KNX packet: TUNNELING: L_DATA_CON, dont' care.`);\n" +
        "                }";
    const conNew =
        "else if (knxTunnelingRequest.cEMIMessage.msgCode ===\n" +
        "                    CEMIConstants_1.default.L_DATA_CON) {\n" +
        "                    const cemi = knxTunnelingRequest.cEMIMessage;\n" +
        "                    const hasError = cemi.control && (cemi.control.control1 & 0x01) === 1;\n" +
        "                    if (hasError) {\n" +
        "                        this.sysLogger.error(`[${(0, utils_1.getTimestamp)()}] ` +\n" +
        "                            `Received KNX packet: TUNNELING: L_DATA_CON with NEGATIVE confirmation (C-flag error bit set). Bus delivery FAILED for src=${cemi.srcAddress?.toString?.() ?? '?'} dst=${cemi.dstAddress?.toString?.() ?? '?'} seqCounter=${knxTunnelingRequest.seqCounter}. The frame was sent by the gateway but the destination did not acknowledge.`);\n" +
        "                    }\n" +
        "                    else {\n" +
        "                        this.sysLogger.debug(`[${(0, utils_1.getTimestamp)()}] ` +\n" +
        "                            `Received KNX packet: TUNNELING: L_DATA_CON, dont' care.`);\n" +
        "                    }\n" +
        "                }";

    if (!src.includes(ackOld)) {
        log("Patch 1 (TUNNELING_ACK) source pattern not found — upstream knxultimate may have changed. Skipping.");
        return;
    }
    if (!src.includes(conOld)) {
        log("Patch 2 (L_DATA_CON) source pattern not found — upstream knxultimate may have changed. Skipping.");
        return;
    }

    const patched = src.replace(ackOld, ackNew).replace(conOld, conNew);
    fs.writeFileSync(target, patched);
    log(`knxultimate KNXClient.js patched (stuck-write diagnostics active) at ${target}`);
}

try {
    patchKnxultimate();
} catch (e) {
    log(`Failed: ${e.message}. Adapter will still run, but stuck-write diagnostics will not be active.`);
}
process.exit(0);
