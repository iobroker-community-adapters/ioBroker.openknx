/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * Port of xknxproject/zip/extractor.py
 * Extracts .knxproj ZIP archives (ETS4/5/6).
 *
 * Uses @zip.js/zip.js for all ZIP operations (ZipCrypto + AES-256).
 */

"use strict";

const crypto = require("crypto");
const { BlobReader, ZipReader, Uint8ArrayWriter, configure } = require("@zip.js/zip.js");

// Disable web workers — we run in Node.js
configure({ useWebWorkers: false });

/** Thrown when the provided project password is incorrect. */
class InvalidPasswordException extends Error {
    constructor(message) {
        super(message || "Invalid project password");
        this.name = "InvalidPasswordException";
    }
}

/**
 * Open a ZIP from a Buffer and return a directory-like object with .files array.
 * Each file has { path, buffer() } compatible with KNXProjContents.
 *
 * @param {Buffer} buffer - ZIP file contents
 * @param {string} [password] - Optional password for encrypted entries
 * @returns {Promise<object>} directory-like object with .files array
 */
async function openZipBuffer(buffer, password) {
    const blob = new Blob([buffer]);
    const options = password ? { password } : {};
    const reader = new ZipReader(new BlobReader(blob), options);
    let entries;
    try {
        entries = await reader.getEntries();
    } catch (err) {
        await reader.close().catch(() => {});
        if (err.message && (err.message.includes("password") || err.message.includes("Password"))) {
            throw new InvalidPasswordException(`Failed to open ZIP - wrong password? (${err.message})`);
        }
        throw err;
    }

    // Pre-read all entries into memory
    const files = [];
    for (const entry of entries) {
        if (entry.directory) {
            continue;
        }
        const filename = entry.filename;
        let buf;
        try {
            const data = await entry.getData(new Uint8ArrayWriter());
            buf = Buffer.from(data);
        } catch (err) {
            if (err.message && (err.message.includes("password") || err.message.includes("Password"))) {
                await reader.close().catch(() => {});
                throw new InvalidPasswordException(`Failed to decrypt entry "${filename}" - wrong password? (${err.message})`);
            }
            await reader.close().catch(() => {});
            throw err;
        }
        files.push({
            path: filename,
            type: "File",
            uncompressedSize: buf.length,
            buffer: async () => buf,
        });
    }
    await reader.close();

    return { files };
}

/**
 * Extract a .knxproj file and return a KNXProjContents object.
 *
 * @param {Buffer} buffer - The .knxproj file contents
 * @param {string} [password] - Optional password for protected projects
 * @returns {Promise<KNXProjContents>}
 */
async function extract(buffer, password) {
    const rootDir = await openZipBuffer(buffer);

    // Find the project ID by looking for a P-xxxx.signature entry
    const projectId = findProjectId(rootDir);
    if (!projectId) {
        throw new Error("No project ID found in .knxproj archive (no P-xxxx.signature entry)");
    }

    // Read knx_master.xml to determine namespace and schema version
    const { xmlNamespace, schemaVersion } = await readMasterNamespace(rootDir);

    // Determine archive access (root or inner password-protected ZIP)
    let projectDir;

    // Check if an inner ZIP exists (= project is password-protected)
    const hasInnerZip = rootDir.files.some(f => {
        const lower = f.path.toLowerCase();
        return lower === `${projectId.toLowerCase()}/${projectId.toLowerCase()}.zip` || lower === `${projectId.toLowerCase()}.zip`;
    });

    if (!password && hasInnerZip) {
        throw new InvalidPasswordException("This project is password-protected. Please provide a password.");
    }

    if (!password) {
        // No password and no inner ZIP - use root archive directly
        projectDir = rootDir;
    } else if (schemaVersion >= 21) {
        // ETS6: AES-256 encrypted inner ZIP with PBKDF2-derived password
        const ets6Password = generateEts6ZipPassword(password);
        projectDir = await openInnerZip(rootDir, projectId, ets6Password);
    } else {
        // ETS4/5: ZipCrypto encrypted inner ZIP with plain password
        projectDir = await openInnerZip(rootDir, projectId, password);
    }

    return new KNXProjContents(rootDir, projectDir, projectId, xmlNamespace, schemaVersion);
}

/**
 * Scan entries for a P-xxxx.signature file and return the project ID (e.g. "P-01D2").
 *
 * @param {object} directory - directory-like object
 * @returns {string|null}
 */
function findProjectId(directory) {
    for (const entry of directory.files) {
        const match = entry.path.match(/^(P-[0-9A-Fa-f]+)[/\\].*\.signature$/i);
        if (match) {
            return match[1];
        }
        // Also match root-level signature file
        const rootMatch = entry.path.match(/^(P-[0-9A-Fa-f]+)\.signature$/i);
        if (rootMatch) {
            return rootMatch[1];
        }
    }
    return null;
}

/**
 * Read the first two lines of knx_master.xml to extract the xmlns namespace.
 *
 * @param {object} directory - directory-like object
 * @returns {Promise<{xmlNamespace: string, schemaVersion: number}>}
 */
async function readMasterNamespace(directory) {
    const masterEntry = directory.files.find(
        f => f.path.toLowerCase() === "knx_master.xml" || f.path.toLowerCase().endsWith("/knx_master.xml"),
    );
    if (!masterEntry) {
        throw new Error("knx_master.xml not found in .knxproj archive");
    }

    const buf = await masterEntry.buffer();
    const text = buf.toString("utf-8");
    const header = text.substring(0, 2000);

    const nsMatch = header.match(/xmlns="([^"]+)"/);
    if (!nsMatch) {
        throw new Error("Could not find xmlns namespace in knx_master.xml");
    }
    const xmlNamespace = nsMatch[1];

    const segments = xmlNamespace.replace(/\/+$/, "").split("/");
    const versionStr = segments[segments.length - 1];
    const schemaVersion = parseInt(versionStr, 10);
    if (isNaN(schemaVersion)) {
        throw new Error(`Could not parse schema version from namespace: ${xmlNamespace}`);
    }

    return { xmlNamespace, schemaVersion };
}

/**
 * Open a password-protected inner ZIP from the root archive.
 * Works for both ZipCrypto (ETS4/5) and AES-256 (ETS6).
 *
 * @param {object} rootDir - directory-like object of root archive
 * @param {string} projectId
 * @param {string} zipPassword - plain text or PBKDF2-derived password
 * @returns {Promise<object>} directory-like object with .files array
 */
async function openInnerZip(rootDir, projectId, zipPassword) {
    const innerEntry = findInnerZipEntry(rootDir, projectId);

    let innerBuffer;
    try {
        innerBuffer = await innerEntry.buffer();
    } catch {
        throw new InvalidPasswordException("Failed to read inner project ZIP entry");
    }

    try {
        return await openZipBuffer(innerBuffer, zipPassword);
    } catch (err) {
        if (err instanceof InvalidPasswordException) {
            throw err;
        }
        throw new InvalidPasswordException(`Failed to open inner project ZIP - wrong password? (${err.message})`);
    }
}

/**
 * Find the inner ZIP entry in the root archive.
 *
 * @param {object} rootDir - directory-like object
 * @param {string} projectId
 * @returns {object} file entry
 */
function findInnerZipEntry(rootDir, projectId) {
    const innerPaths = [`${projectId}/${projectId}.zip`, `${projectId}.zip`];
    for (const innerPath of innerPaths) {
        const entry = rootDir.files.find(f => f.path === innerPath || f.path.toLowerCase() === innerPath.toLowerCase());
        if (entry) {
            return entry;
        }
    }
    throw new Error(
        `Inner project ZIP not found at ${innerPaths.join(" or ")} - archive may not be password-protected`,
    );
}

/**
 * Generate the ETS6 ZIP password from a user password.
 * Uses PBKDF2-HMAC-SHA256 with salt "21.project.ets.knx.org", 65536 iterations, 32 byte key length.
 * Password is encoded as UTF-16-LE before hashing.
 *
 * @param {string} password
 * @returns {string} base64-encoded derived key
 */
function generateEts6ZipPassword(password) {
    const passwordBuffer = Buffer.from(password, "utf16le");
    const salt = "21.project.ets.knx.org";
    const key = crypto.pbkdf2Sync(passwordBuffer, salt, 65536, 32, "sha256");
    return key.toString("base64");
}

/**
 * Represents extracted .knxproj contents with lazy file access.
 */
class KNXProjContents {
    constructor(rootDir, projectDir, projectId, xmlNamespace, schemaVersion) {
        this.rootDir = rootDir;
        this.projectDir = projectDir;
        this.projectId = projectId;
        this.xmlNamespace = xmlNamespace;
        this.schemaVersion = schemaVersion;
    }

    isEts4Project() {
        return this.schemaVersion <= 11;
    }

    async openProject0() {
        const path0 = `${this.projectId}/0.xml`;
        let entry = this._findProjectEntry(path0);
        if (!entry) {
            entry = this._findProjectEntry("0.xml");
        }
        if (!entry) {
            throw new Error(`Project file 0.xml not found at ${path0}`);
        }
        return await this._readEntry(entry);
    }

    async openProjectMeta() {
        const fileName = this.isEts4Project() ? "Project.xml" : "project.xml";
        const metaPath = `${this.projectId}/${fileName}`;
        let entry = this._findProjectEntry(metaPath);
        if (!entry) {
            const altName = this.isEts4Project() ? "project.xml" : "Project.xml";
            entry = this._findProjectEntry(`${this.projectId}/${altName}`);
        }
        if (!entry) {
            entry = this._findProjectEntry(fileName);
        }
        if (!entry) {
            const altName = this.isEts4Project() ? "project.xml" : "Project.xml";
            entry = this._findProjectEntry(altName);
        }
        if (!entry) {
            throw new Error(`Project meta file not found for ${this.projectId}`);
        }
        return await this._readEntry(entry);
    }

    async readFile(filePath) {
        let entry = this._findProjectEntry(filePath);
        if (!entry) {
            entry = this.rootDir.files.find(
                f => f.path === filePath || f.path.toLowerCase() === filePath.toLowerCase(),
            );
        }
        if (!entry) {
            throw new Error(`File not found in archive: ${filePath}`);
        }
        return await this._readEntry(entry);
    }

    listEntries() {
        const paths = new Set();
        for (const f of this.rootDir.files) {
            paths.add(f.path);
        }
        if (this.projectDir !== this.rootDir) {
            for (const f of this.projectDir.files) {
                paths.add(f.path);
            }
        }
        return [...paths];
    }

    _findProjectEntry(filePath) {
        return this.projectDir.files.find(f => f.path === filePath || f.path.toLowerCase() === filePath.toLowerCase());
    }

    async _readEntry(entry) {
        try {
            const buf = await entry.buffer();
            return buf.toString("utf-8");
        } catch (err) {
            if (err.message && (err.message.includes("password") || err.message.includes("Password"))) {
                throw new InvalidPasswordException(`Failed to read entry - ${err.message}`);
            }
            throw err;
        }
    }
}

module.exports = {
    extract,
    generateEts6ZipPassword,
    InvalidPasswordException,
    KNXProjContents,
};
