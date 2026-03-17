/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * Port of xknxproject/zip/extractor.py
 * Extracts .knxproj ZIP archives (ETS4/5/6).
 */

"use strict";

const crypto = require("crypto");
const unzipper = require("unzipper");

/** Thrown when the provided project password is incorrect. */
class InvalidPasswordException extends Error {
    constructor(message) {
        super(message || "Invalid project password");
        this.name = "InvalidPasswordException";
    }
}

/**
 * Extract a .knxproj file and return a KNXProjContents object.
 *
 * @param {Buffer} buffer - The .knxproj file contents
 * @param {string} [password] - Optional password for protected projects
 * @returns {Promise<KNXProjContents>}
 */
async function extract(buffer, password) {
    const rootDir = await unzipper.Open.buffer(buffer);

    // Find the project ID by looking for a P-xxxx.signature entry
    const projectId = findProjectId(rootDir);
    if (!projectId) {
        throw new Error("No project ID found in .knxproj archive (no P-xxxx.signature entry)");
    }

    // Read knx_master.xml to determine namespace and schema version
    const { xmlNamespace, schemaVersion } = await readMasterNamespace(rootDir);

    // Determine archive access (root or inner password-protected ZIP)
    let projectDir;
    let projectPassword = null;

    if (!password) {
        // No password - use root archive directly
        projectDir = rootDir;
    } else if (schemaVersion >= 21) {
        // ETS6: AES-encrypted inner ZIP with PBKDF2-derived password
        projectPassword = generateEts6ZipPassword(password);
        projectDir = await openInnerZip(rootDir, projectId, projectPassword);
    } else {
        // ETS4/5: standard ZIP encryption with UTF-8 password
        projectPassword = password;
        projectDir = await openInnerZip(rootDir, projectId, projectPassword);
    }

    return new KNXProjContents(rootDir, projectDir, projectId, xmlNamespace, schemaVersion, projectPassword);
}

/**
 * Scan entries for a P-xxxx.signature file and return the project ID (e.g. "P-01D2").
 *
 * @param {object} directory - unzipper directory object
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
 * @param {object} directory - unzipper directory object
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
    // Only look at the first ~2000 chars (covers the first two lines)
    const header = text.substring(0, 2000);

    // Extract xmlns from something like xmlns="http://knx.org/xml/project/20"
    const nsMatch = header.match(/xmlns="([^"]+)"/);
    if (!nsMatch) {
        throw new Error("Could not find xmlns namespace in knx_master.xml");
    }
    const xmlNamespace = nsMatch[1];

    // Derive schema version from last path segment of the namespace URL
    const segments = xmlNamespace.replace(/\/+$/, "").split("/");
    const versionStr = segments[segments.length - 1];
    const schemaVersion = parseInt(versionStr, 10);
    if (isNaN(schemaVersion)) {
        throw new Error(`Could not parse schema version from namespace: ${xmlNamespace}`);
    }

    return { xmlNamespace, schemaVersion };
}

/**
 * Open a password-protected inner ZIP ({projectId}/{projectId}.zip) from the root archive.
 *
 * @param {object} rootDir - unzipper directory of root archive
 * @param {string} projectId
 * @param {string} zipPassword
 * @returns {Promise<object>} unzipper directory of inner archive
 */
async function openInnerZip(rootDir, projectId, zipPassword) {
    // Try both {projectId}/{projectId}.zip (ETS convention) and {projectId}.zip (root-level)
    const innerPaths = [`${projectId}/${projectId}.zip`, `${projectId}.zip`];
    let innerEntry;
    for (const innerPath of innerPaths) {
        innerEntry = rootDir.files.find(f => f.path === innerPath || f.path.toLowerCase() === innerPath.toLowerCase());
        if (innerEntry) {
            break;
        }
    }
    if (!innerEntry) {
        throw new Error(
            `Inner project ZIP not found at ${innerPaths.join(" or ")} - archive may not be password-protected`,
        );
    }

    // The inner ZIP entry itself may or may not be encrypted.
    // Try reading without password first, then with password.
    let innerBuffer;
    try {
        innerBuffer = await innerEntry.buffer();
    } catch {
        try {
            innerBuffer = await innerEntry.buffer(zipPassword);
        } catch {
            throw new InvalidPasswordException("Failed to decrypt inner project ZIP - wrong password?");
        }
    }

    try {
        return await unzipper.Open.buffer(innerBuffer);
    } catch {
        throw new InvalidPasswordException("Failed to open decrypted inner project ZIP - wrong password?");
    }
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
    /**
     * @param {object} rootDir - unzipper directory of root archive
     * @param {object} projectDir - unzipper directory for project files (root or inner)
     * @param {string} projectId
     * @param {string} xmlNamespace
     * @param {number} schemaVersion
     * @param {string|null} password - ZIP password for encrypted entries
     */
    constructor(rootDir, projectDir, projectId, xmlNamespace, schemaVersion, password) {
        this.rootDir = rootDir;
        this.projectDir = projectDir;
        this.projectId = projectId;
        this.xmlNamespace = xmlNamespace;
        this.schemaVersion = schemaVersion;
        this._password = password;
    }

    /**
     * Returns true if the project uses ETS4 schema (version <= 11).
     *
     * @returns {boolean}
     */
    isEts4Project() {
        return this.schemaVersion <= 11;
    }

    /**
     * Read the project's 0.xml file.
     *
     * @returns {Promise<string>} UTF-8 content of 0.xml
     */
    async openProject0() {
        const path0 = `${this.projectId}/0.xml`;
        let entry = this._findProjectEntry(path0);
        // Inner ZIP may have 0.xml at root level (without project ID prefix)
        if (!entry) {
            entry = this._findProjectEntry("0.xml");
        }
        if (!entry) {
            throw new Error(`Project file 0.xml not found at ${path0}`);
        }
        return await this._readEntry(entry);
    }

    /**
     * Read the project meta XML (project.xml or Project.xml for ETS4).
     *
     * @returns {Promise<string>} UTF-8 content
     */
    async openProjectMeta() {
        const fileName = this.isEts4Project() ? "Project.xml" : "project.xml";
        const metaPath = `${this.projectId}/${fileName}`;
        let entry = this._findProjectEntry(metaPath);
        // Fallback: try both casings
        if (!entry) {
            const altName = this.isEts4Project() ? "project.xml" : "Project.xml";
            const altPath = `${this.projectId}/${altName}`;
            entry = this._findProjectEntry(altPath);
        }
        // Inner ZIP may have files at root level (without project ID prefix)
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

    /**
     * Read any file from the archive by path.
     * Searches both the project directory and the root directory.
     *
     * @param {string} filePath
     * @returns {Promise<string>} UTF-8 content
     */
    async readFile(filePath) {
        let entry = this._findProjectEntry(filePath);
        if (!entry) {
            // Also try in root archive
            entry = this.rootDir.files.find(
                f => f.path === filePath || f.path.toLowerCase() === filePath.toLowerCase(),
            );
        }
        if (!entry) {
            throw new Error(`File not found in archive: ${filePath}`);
        }
        return await this._readEntry(entry);
    }

    /**
     * List all entry paths from both root and project directories.
     *
     * @returns {string[]}
     */
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

    /**
     * Find an entry in the project directory by path (case-insensitive fallback).
     *
     * @param {string} filePath
     * @returns {object|undefined}
     */
    _findProjectEntry(filePath) {
        return this.projectDir.files.find(f => f.path === filePath || f.path.toLowerCase() === filePath.toLowerCase());
    }

    /**
     * Read an entry and return its UTF-8 string content.
     *
     * @param {object} entry
     * @returns {Promise<string>}
     */
    async _readEntry(entry) {
        try {
            const buf = this._password ? await entry.buffer(this._password) : await entry.buffer();
            return buf.toString("utf-8");
        } catch (err) {
            if (err.message === "BAD_PASSWORD" || err.message === "MISSING_PASSWORD") {
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
