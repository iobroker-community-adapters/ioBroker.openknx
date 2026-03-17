"use strict";

/**
 * Data models for the knxproj parser library.
 * Port of xknxproject/models/static.py + models.py + knxproject.py
 */

const util = require("./util");

// ---------------------------------------------------------------------------
// Enums (from static.py)
// ---------------------------------------------------------------------------

/** Supported GroupAddress style identifiers. */
const GroupAddressStyle = Object.freeze({
    TWOLEVEL: "TwoLevel",
    THREELEVEL: "ThreeLevel",
    FREE: "Free",
});

/** Supported space types according to Specs from XSD. */
const SpaceType = Object.freeze({
    BUILDING: "Building",
    BUILDING_PART: "BuildingPart",
    FLOOR: "Floor",
    ROOM: "Room",
    DISTRIBUTION_BOARD: "DistributionBoard",
    STAIRWAY: "Stairway",
    CORRIDOR: "Corridor",
    AREA: "Area",
    GROUND: "Ground",
    SEGMENT: "Segment",
});

/** KNX medium type mapping. */
const MEDIUM_TYPES = Object.freeze({
    "MT-0": "Twisted Pair (TP)",
    "MT-1": "Powerline (PL)",
    "MT-2": "KNX RF (RF)",
    "MT-5": "KNXnet/IP (IP)",
});

// ---------------------------------------------------------------------------
// DPTType (from knxproject.py) -- plain object shape: { main: number, sub: number|null }
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ModuleInstanceInfos (from knxproject.py) -- plain object shape:
//   { definition: string, rootNumber: number }
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Custom error for unexpected data
// ---------------------------------------------------------------------------

class UnexpectedDataError extends Error {
    constructor(message) {
        super(message);
        this.name = "UnexpectedDataError";
    }
}

// ---------------------------------------------------------------------------
// XMLGroupAddress (from models.py)
// ---------------------------------------------------------------------------

class XMLGroupAddress {
    /**
     * @param {object} opts
     * @param {string} opts.name
     * @param {string} opts.identifier
     * @param {string} opts.address - raw address as string (will be parsed to int)
     * @param {number|null} opts.projectUid
     * @param {string} opts.description
     * @param {{main: number, sub: number|null}|null} opts.dpt
     * @param {string|null} opts.dataSecureKey
     * @param {string} opts.comment
     * @param {string} opts.style - one of GroupAddressStyle values
     */
    constructor({ name, identifier, address, projectUid, description, dpt, dataSecureKey, comment, style }) {
        this.name = name;
        this.identifier = identifier.split("_").slice(1).join("_");
        this.rawAddress = parseInt(address, 10);
        this.projectUid = projectUid;
        this.description = description;
        this.dpt = dpt;
        this.dataSecureKey = dataSecureKey; // Key as base64 encoded string or null
        this.comment = comment;
        this.style = style;
        this.address = XMLGroupAddress.strAddress(this.rawAddress, this.style);
    }

    /**
     * Parse a given raw 16-bit address and return a string representation.
     *
     * @param {number} rawAddress
     * @param {string} groupAddressStyle - one of GroupAddressStyle values
     * @returns {string}
     */
    static strAddress(rawAddress, groupAddressStyle) {
        if (groupAddressStyle === GroupAddressStyle.FREE) {
            return String(rawAddress);
        }
        const main = (rawAddress & 0b1111100000000000) >> 11;
        if (groupAddressStyle === GroupAddressStyle.THREELEVEL) {
            const middle = (rawAddress & 0b11100000000) >> 8;
            const sub = rawAddress & 0b11111111;
            return `${main}/${middle}/${sub}`;
        }
        if (groupAddressStyle === GroupAddressStyle.TWOLEVEL) {
            const sub = rawAddress & 0b11111111111;
            return `${main}/${sub}`;
        }
        throw new Error(`GroupAddressStyle '${groupAddressStyle}' not supported!`);
    }

    toString() {
        return `${this.address} (${this.name}) - [DPT: ${JSON.stringify(this.dpt)}, ID: ${this.identifier}]`;
    }
}

// ---------------------------------------------------------------------------
// XMLGroupRange (from models.py)
// ---------------------------------------------------------------------------

class XMLGroupRange {
    /**
     * @param {object} opts
     * @param {string} opts.name
     * @param {number} opts.rangeStart
     * @param {number} opts.rangeEnd
     * @param {number[]} opts.groupAddresses - array of raw address ints
     * @param {XMLGroupRange[]} opts.groupRanges
     * @param {string} opts.comment
     * @param {string} opts.style - one of GroupAddressStyle values
     */
    constructor({ name, rangeStart, rangeEnd, groupAddresses, groupRanges, comment, style }) {
        this.name = name;
        this.rangeStart = rangeStart;
        this.rangeEnd = rangeEnd;
        this.groupAddresses = groupAddresses || [];
        this.groupRanges = groupRanges || [];
        this.comment = comment;
        this.style = style;
    }

    /**
     * Generate a string representation for the range.
     *
     * @returns {string}
     */
    strAddress() {
        if (this.style === GroupAddressStyle.FREE) {
            return `${this.rangeStart}...${this.rangeEnd}`;
        }
        if (this.style === GroupAddressStyle.TWOLEVEL) {
            return XMLGroupAddress.strAddress(this.rangeStart, this.style).split("/")[0];
        }
        if (this.style === GroupAddressStyle.THREELEVEL) {
            const startAddressToken = XMLGroupAddress.strAddress(this.rangeStart, this.style).split("/");
            if (this.rangeEnd - this.rangeStart >= 2046) {
                return startAddressToken[0];
            }
            return startAddressToken.slice(0, 2).join("/");
        }
        throw new Error(`GroupAddressStyle '${this.style}' not supported!`);
    }
}

// ---------------------------------------------------------------------------
// XMLArea (from models.py)
// ---------------------------------------------------------------------------

class XMLArea {
    /**
     * @param {object} opts
     * @param {number} opts.address
     * @param {string} opts.name
     * @param {string|null} opts.description
     * @param {XMLLine[]} opts.lines
     */
    constructor({ address, name, description, lines }) {
        this.address = address;
        this.name = name;
        this.description = description != null ? description : null;
        this.lines = lines || [];
    }
}

// ---------------------------------------------------------------------------
// XMLLine (from models.py)
// ---------------------------------------------------------------------------

class XMLLine {
    /**
     * @param {object} opts
     * @param {number} opts.address
     * @param {string|null} opts.description
     * @param {string} opts.name
     * @param {string} opts.mediumType
     * @param {DeviceInstance[]} opts.devices
     * @param {XMLArea} opts.area
     */
    constructor({ address, description, name, mediumType, devices, area }) {
        this.address = address;
        this.description = description != null ? description : null;
        this.name = name;
        this.mediumType = mediumType;
        this.devices = devices || [];
        this.area = area;
    }
}

// ---------------------------------------------------------------------------
// ParameterInstanceRef (from models.py) -- simple data holder
// ---------------------------------------------------------------------------

class ParameterInstanceRef {
    /**
     * @param {object} opts
     * @param {string} opts.refId
     * @param {string|null} opts.value
     */
    constructor({ refId, value }) {
        this.refId = refId;
        this.value = value != null ? value : null;
    }
}

// ---------------------------------------------------------------------------
// ModuleInstanceArgument (from models.py)
// ---------------------------------------------------------------------------

class ModuleInstanceArgument {
    /**
     * @param {object} opts
     * @param {string} opts.refId
     * @param {string} opts.value
     * @param {string} [opts.name]
     * @param {number|null} [opts.allocates]
     */
    constructor({ refId, value, name, allocates }) {
        this.refId = refId;
        this.value = value;
        this.name = name || "";
        this.allocates = allocates != null ? allocates : null;
    }

    /**
     * Prepend the refId with the application program ref.
     *
     * @param {string} applicationProgramRef
     * @param {string} moduleDefId
     */
    completeRefId(applicationProgramRef, moduleDefId) {
        if (this.refId.startsWith("SM-")) {
            // SubModule
            this.refId = `${applicationProgramRef}_${moduleDefId}_${this.refId}`;
        } else {
            this.refId = `${applicationProgramRef}_${this.refId}`;
        }
    }
}

// ---------------------------------------------------------------------------
// ModuleInstance (from models.py)
// ---------------------------------------------------------------------------

class ModuleInstance {
    /**
     * @param {object} opts
     * @param {string} opts.identifier - e.g. "MD-4_M-15_MI-2" or "MD-4_M-15_MI-2_SM-1_M-1_MI-2-1-2"
     * @param {string} opts.refId - e.g. "MD-<int>_M-<int>"
     * @param {ModuleInstanceArgument[]} opts.arguments
     */
    constructor({ identifier, refId, arguments: args }) {
        this.identifier = identifier;
        this.refId = refId;
        this.arguments = args || [];

        // __post_init__ equivalent
        this.moduleDefId = this.refId.split("_")[0]; // "MD-<int>"
        const submoduleMatch = this.identifier.match(/(_SM-[^_]+)/);
        if (submoduleMatch) {
            this.baseModule = this.identifier.split("_SM-")[0];
            this.definitionId = `${this.moduleDefId}${submoduleMatch[1]}`;
        } else {
            this.baseModule = null;
            this.definitionId = this.moduleDefId;
        }
    }

    /**
     * Prepend argument ref_ids with the application program ref.
     *
     * @param {string} applicationProgramRef
     */
    completeArgumentsRefId(applicationProgramRef) {
        for (const arg of this.arguments) {
            arg.completeRefId(applicationProgramRef, this.moduleDefId);
        }
    }
}

// ---------------------------------------------------------------------------
// ChannelNode (from models.py)
// ---------------------------------------------------------------------------

class ChannelNode {
    /**
     * @param {object} opts
     * @param {string} opts.refId
     * @param {string} opts.name
     * @param {string[]} opts.groupObjectInstances
     */
    constructor({ refId, name, groupObjectInstances }) {
        this.refId = refId;
        this.name = name || "";
        this.groupObjectInstances = groupObjectInstances || [];
    }

    /**
     * Resolve the channel name from device instance infos.
     * Replace TextParameter values in channel names with the actual values.
     *
     * @param {DeviceInstance} deviceInstance
     * @param {ApplicationProgram} application
     */
    resolveChannelName(deviceInstance, application) {
        if (!this.name) {
            const applicationChannelId = util.stripModuleInstance(this.refId, "CH");
            const applicationChannel =
                application.channels[`${deviceInstance.applicationProgramRef}_${applicationChannelId}`];
            if (applicationChannel.text && applicationChannel.textParameterRefId) {
                const parameterInstanceRef = util.textParameterInsertModuleInstance(
                    this.refId,
                    "CH",
                    applicationChannel.textParameterRefId,
                );
                let parameter = null;
                try {
                    parameter = deviceInstance.parameterInstanceRefs[parameterInstanceRef];
                    if (parameter === undefined) {
                        throw new Error("not found");
                    }
                } catch {
                    console.warn(
                        `ParameterInstanceRef ${parameterInstanceRef} not found for Channel ${this.refId} of ${deviceInstance}`,
                    );
                    parameter = null;
                }

                this.name =
                    util.textParameterTemplateReplace(applicationChannel.text, parameter) || applicationChannel.name;
            } else {
                this.name = applicationChannel.text || applicationChannel.name;
            }
        }
    }

    /**
     * Replace module placeholders in channel names with module instance argument values.
     *
     * @param {DeviceInstance} deviceInstance
     */
    resolveChannelModulePlaceholders(deviceInstance) {
        if (
            !(
                this.refId.startsWith("MD-") && // only applicable if modules used
                this.name.includes("{{") // placeholders are denoted "{{name}}"
            )
        ) {
            return;
        }

        const moduleInstanceRef = this.refId.split("_CH")[0];
        const moduleInstance = deviceInstance.moduleInstances.find(mi => mi.identifier === moduleInstanceRef);
        if (!moduleInstance) {
            throw new UnexpectedDataError(
                `ModuleInstance '${moduleInstanceRef}' not found for ChannelNode '${this.refId}' ${this.name} of ${deviceInstance}`,
            );
        }
        for (const argument of moduleInstance.arguments) {
            this.name = this.name.replace(`{{${argument.name}}}`, argument.value);
        }
    }
}

// ---------------------------------------------------------------------------
// ComObject (from models.py)
// ---------------------------------------------------------------------------

class ComObject {
    /**
     * @param {object} opts
     * @param {string} opts.identifier
     * @param {string} opts.name
     * @param {string} opts.text
     * @param {number} opts.number
     * @param {string} opts.functionText
     * @param {string} opts.objectSize
     * @param {boolean} opts.readFlag
     * @param {boolean} opts.writeFlag
     * @param {boolean} opts.communicationFlag
     * @param {boolean} opts.transmitFlag
     * @param {boolean} opts.updateFlag
     * @param {boolean} opts.readOnInitFlag
     * @param {Array<{main: number, sub: number|null}>} opts.datapointTypes
     * @param {string|null} opts.baseNumberArgumentRef
     */
    constructor({
        identifier,
        name,
        text,
        number,
        functionText,
        objectSize,
        readFlag,
        writeFlag,
        communicationFlag,
        transmitFlag,
        updateFlag,
        readOnInitFlag,
        datapointTypes,
        baseNumberArgumentRef,
    }) {
        this.identifier = identifier;
        this.name = name;
        this.text = text;
        this.number = number;
        this.functionText = functionText;
        this.objectSize = objectSize;
        this.readFlag = readFlag;
        this.writeFlag = writeFlag;
        this.communicationFlag = communicationFlag;
        this.transmitFlag = transmitFlag;
        this.updateFlag = updateFlag;
        this.readOnInitFlag = readOnInitFlag;
        this.datapointTypes = datapointTypes || [];
        this.baseNumberArgumentRef = baseNumberArgumentRef != null ? baseNumberArgumentRef : null;
    }
}

// ---------------------------------------------------------------------------
// ComObjectRef (from models.py)
// ---------------------------------------------------------------------------

class ComObjectRef {
    /**
     * @param {object} opts
     * @param {string} opts.identifier
     * @param {string} opts.refId - points to a ComObject Id
     * @param {string|null} opts.name
     * @param {string|null} opts.text
     * @param {string|null} opts.functionText
     * @param {string|null} opts.objectSize
     * @param {boolean|null} opts.readFlag
     * @param {boolean|null} opts.writeFlag
     * @param {boolean|null} opts.communicationFlag
     * @param {boolean|null} opts.transmitFlag
     * @param {boolean|null} opts.updateFlag
     * @param {boolean|null} opts.readOnInitFlag
     * @param {Array<{main: number, sub: number|null}>} opts.datapointTypes
     * @param {string|null} opts.textParameterRefId
     */
    constructor({
        identifier,
        refId,
        name,
        text,
        functionText,
        objectSize,
        readFlag,
        writeFlag,
        communicationFlag,
        transmitFlag,
        updateFlag,
        readOnInitFlag,
        datapointTypes,
        textParameterRefId,
    }) {
        this.identifier = identifier;
        this.refId = refId;
        this.name = name != null ? name : null;
        this.text = text != null ? text : null;
        this.functionText = functionText != null ? functionText : null;
        this.objectSize = objectSize != null ? objectSize : null;
        this.readFlag = readFlag != null ? readFlag : null;
        this.writeFlag = writeFlag != null ? writeFlag : null;
        this.communicationFlag = communicationFlag != null ? communicationFlag : null;
        this.transmitFlag = transmitFlag != null ? transmitFlag : null;
        this.updateFlag = updateFlag != null ? updateFlag : null;
        this.readOnInitFlag = readOnInitFlag != null ? readOnInitFlag : null;
        this.datapointTypes = datapointTypes || [];
        this.textParameterRefId = textParameterRefId != null ? textParameterRefId : null;
    }

    /**
     * Return the text with parameter if available.
     *
     * @param {string} comObjectInstanceRefId
     * @param {{[key: string]: ParameterInstanceRef}} instanceParameters
     * @returns {string|null}
     */
    comObjectRefTextWithParameter(comObjectInstanceRefId, instanceParameters) {
        if (this.text && this.textParameterRefId) {
            const parameterInstanceRef = util.textParameterInsertModuleInstance(
                comObjectInstanceRefId,
                "O",
                this.textParameterRefId,
            );
            let parameter = null;
            try {
                parameter = instanceParameters[parameterInstanceRef];
                if (parameter === undefined) {
                    throw new Error("not found");
                }
            } catch {
                console.warn(
                    `ParameterInstanceRef ${parameterInstanceRef} for ComObjectRef ${this.identifier} not found.`,
                );
                parameter = null;
            }
            return util.textParameterTemplateReplace(this.text || "", parameter);
        }
        return null;
    }
}

// ---------------------------------------------------------------------------
// ComObjectInstanceRef (from models.py) -- the most complex class
// ---------------------------------------------------------------------------

class ComObjectInstanceRef {
    /**
     * @param {object} opts
     * @param {string|null} opts.identifier
     * @param {string} opts.refId
     * @param {string|null} opts.text
     * @param {string|null} opts.functionText
     * @param {boolean|null} opts.readFlag
     * @param {boolean|null} opts.writeFlag
     * @param {boolean|null} opts.communicationFlag
     * @param {boolean|null} opts.transmitFlag
     * @param {boolean|null} opts.updateFlag
     * @param {boolean|null} opts.readOnInitFlag
     * @param {Array<{main: number, sub: number|null}>} opts.datapointTypes
     * @param {string|null} opts.description
     * @param {string|null} opts.channel
     * @param {string[]|null} opts.links
     */
    constructor({
        identifier,
        refId,
        text,
        functionText,
        readFlag,
        writeFlag,
        communicationFlag,
        transmitFlag,
        updateFlag,
        readOnInitFlag,
        datapointTypes,
        description,
        channel,
        links,
    }) {
        this.identifier = identifier != null ? identifier : null;
        this.refId = refId;
        this.text = text != null ? text : null;
        this.functionText = functionText != null ? functionText : null;
        this.readFlag = readFlag != null ? readFlag : null;
        this.writeFlag = writeFlag != null ? writeFlag : null;
        this.communicationFlag = communicationFlag != null ? communicationFlag : null;
        this.transmitFlag = transmitFlag != null ? transmitFlag : null;
        this.updateFlag = updateFlag != null ? updateFlag : null;
        this.readOnInitFlag = readOnInitFlag != null ? readOnInitFlag : null;
        this.datapointTypes = datapointTypes || [];
        this.description = description != null ? description : null;
        this.channel = channel != null ? channel : null;
        this.links = links != null ? links : null;

        // resolved via Hardware.xml from the containing DeviceInstance
        this.applicationProgramIdPrefix = ""; // empty string for ETS 4
        this.comObjectRefId = null;

        // only available from ComObject and ComObjectRef
        this.name = null;
        this.objectSize = null;
        // only available from ComObject
        this.baseNumberArgumentRef = null;
        this.number = null;
        // assigned when module arguments are applied
        this.module = null; // ModuleInstanceInfos: { definition, rootNumber }
    }

    /**
     * Prepend the refId with the application program ref.
     *
     * @param {string} applicationProgramRef
     * @param {object} knxProjContents - object with isEts4Project() method
     */
    resolveComObjectRefId(applicationProgramRef, knxProjContents) {
        if (knxProjContents.isEts4Project() && this.refId.startsWith(applicationProgramRef)) {
            // ETS4 doesn't use shortened ref_id and doesn't support modules
            this.comObjectRefId = this.refId;
            return;
        }

        const refId = util.stripModuleInstance(this.refId, "O");
        this.applicationProgramIdPrefix = `${applicationProgramRef}_`;
        this.comObjectRefId = `${applicationProgramRef}_${refId}`;
    }

    /**
     * Fill missing information with information parsed from the application program.
     *
     * @param {ApplicationProgram} application
     * @param {{[key: string]: ParameterInstanceRef}} parameters
     */
    mergeApplicationProgramInfo(application, parameters) {
        if (this.comObjectRefId == null) {
            console.warn(`ComObjectInstanceRef ${this.identifier} has no ComObjectRefId`);
            return;
        }
        const comObjectRef = application.comObjectRefs[this.comObjectRefId];
        this._mergeFromParentObject(comObjectRef, parameters, true);

        const comObject = application.comObjects[comObjectRef.refId];
        this._mergeFromParentObject(comObject, parameters, false);
    }

    /**
     * Fill missing information from a ComObject or ComObjectRef.
     *
     * @param {ComObject|ComObjectRef} comObject
     * @param {{[key: string]: ParameterInstanceRef}} parameters
     * @param {boolean} isComObjectRef - true if comObject is a ComObjectRef instance
     */
    _mergeFromParentObject(comObject, parameters, isComObjectRef) {
        if (this.name == null) {
            this.name = comObject.name;
        }
        if (this.text == null) {
            if (isComObjectRef) {
                this.text = comObject.comObjectRefTextWithParameter(this.refId, parameters) || comObject.text;
            } else {
                this.text = comObject.text;
            }
        }
        if (this.functionText == null) {
            this.functionText = comObject.functionText;
        }
        if (this.objectSize == null) {
            this.objectSize = comObject.objectSize;
        }
        if (this.readFlag == null) {
            this.readFlag = comObject.readFlag;
        }
        if (this.writeFlag == null) {
            this.writeFlag = comObject.writeFlag;
        }
        if (this.communicationFlag == null) {
            this.communicationFlag = comObject.communicationFlag;
        }
        if (this.transmitFlag == null) {
            this.transmitFlag = comObject.transmitFlag;
        }
        if (this.updateFlag == null) {
            this.updateFlag = comObject.updateFlag;
        }
        if (this.readOnInitFlag == null) {
            this.readOnInitFlag = comObject.readOnInitFlag;
        }
        if (!this.datapointTypes || this.datapointTypes.length === 0) {
            this.datapointTypes = comObject.datapointTypes;
        }
        if (!isComObjectRef) {
            // ComObject-only fields
            this.number = comObject.number;
            this.baseNumberArgumentRef = comObject.baseNumberArgumentRef;
        }
    }

    /**
     * Apply module argument of base number.
     *
     * @param {ModuleInstance[]} moduleInstances
     * @param {ApplicationProgram} application
     */
    applyModuleBaseNumberArgument(moduleInstances, application) {
        if (
            this.baseNumberArgumentRef == null ||
            !this.refId.startsWith("MD-") ||
            this.number == null // only for type safety
        ) {
            return;
        }

        /**
         * Parse the argument value.
         *
         * @param {ModuleInstance} mi
         * @param {string} bnArgRef
         * @returns {number}
         */
        const _parseBaseNumberArgument = (mi, bnArgRef) => {
            // Two paths to get the base number:
            // 1. from the module instance arguments value "ObjNumberBase" directly
            // 2. from the module defs allocator
            let result = 0;
            const baseNumberArgument = mi.arguments.find(arg => arg.refId === bnArgRef);
            if (!baseNumberArgument) {
                throw new UnexpectedDataError(
                    `Base number argument ${bnArgRef} not found for ` +
                        `ComObjectInstanceRef refId=${this.refId} text=${this.text} ` +
                        `of application ${this.applicationProgramIdPrefix}`,
                );
            }

            // Path (1): if value is a number, we are done
            const intValue = parseInt(baseNumberArgument.value, 10);
            if (!isNaN(intValue) && String(intValue) === baseNumberArgument.value) {
                // base module value should already be included
                return intValue;
            }

            // Path (2): value is a reference to an Allocator
            if (mi.baseModule) {
                // recurse to get the base number from the base module (for SubModule value)
                const numArg = application.numericArgs[baseNumberArgument.refId];
                if (numArg != null && numArg.baseValue != null) {
                    const baseModule = moduleInstances.find(m => m.identifier === mi.baseModule);
                    if (!baseModule) {
                        throw new UnexpectedDataError(
                            `Base ModuleInstance ${mi.baseModule} not found for ` +
                                `ComObjectInstanceRef refId=${this.refId} text=${this.text} ` +
                                `of application ${this.applicationProgramIdPrefix}`,
                        );
                    }
                    result += _parseBaseNumberArgument(baseModule, numArg.baseValue);
                }
            }
            return result + this._baseNumberFromAllocator(baseNumberArgument, application.allocators);
        };

        // Find the ModuleInstance that matches this ref_id
        const _moduleInstance = moduleInstances.find(mi => this.refId.startsWith(`${mi.identifier}_`));
        if (!_moduleInstance) {
            throw new UnexpectedDataError(
                `ModuleInstance not found for ComObjectInstanceRef refId=${this.refId} text=${this.text} ` +
                    `of application ${this.applicationProgramIdPrefix}`,
            );
        }

        const comObjectNumber = this.number;
        this.number += _parseBaseNumberArgument(_moduleInstance, this.baseNumberArgumentRef);
        this.module = {
            definition: _moduleInstance.definitionId,
            rootNumber: comObjectNumber,
        };
    }

    /**
     * Apply base number from allocator.
     *
     * @param {ModuleInstanceArgument} baseNumberArgument
     * @param {{[key: string]: Allocator}} applicationAllocators
     * @returns {number}
     */
    _baseNumberFromAllocator(baseNumberArgument, applicationAllocators) {
        let allocatorObjectBase = null;
        for (const allocator of Object.values(applicationAllocators)) {
            if (allocator.identifier === this.applicationProgramIdPrefix + baseNumberArgument.value) {
                allocatorObjectBase = allocator;
                break;
            }
        }
        if (!allocatorObjectBase) {
            throw new UnexpectedDataError(
                `Allocator with identifier ${baseNumberArgument.value} not found for ` +
                    `ComObjectInstanceRef refId=${this.refId} text=${this.text} ` +
                    `of application ${this.applicationProgramIdPrefix}`,
            );
        }
        const allocatorSize = baseNumberArgument.allocates;
        if (allocatorSize == null) {
            console.warn(
                `Base number allocator size not found for ${this.identifier}. Base number argument: ${JSON.stringify(baseNumberArgument)}`,
            );
            return 0;
        }
        // Extract MI-<index> from refId: "..._MI-<index>_..."
        const miPart = this.refId.split("_MI-")[1];
        const moduleInstanceIndex = parseInt(miPart.split("_")[0], 10);
        return allocatorObjectBase.start + allocatorSize * (moduleInstanceIndex - 1);
    }
}

// ---------------------------------------------------------------------------
// DeviceInstance (from models.py)
// ---------------------------------------------------------------------------

class DeviceInstance {
    /**
     * @param {object} opts
     * @param {string} opts.identifier
     * @param {number} opts.address
     * @param {number|null} opts.projectUid
     * @param {string} opts.name
     * @param {string} opts.description
     * @param {string} opts.lastModified
     * @param {string} opts.productRef
     * @param {string} opts.hardwareProgramRef
     * @param {XMLLine} opts.line
     * @param {string} opts.manufacturer
     * @param {string[]} opts.additionalAddresses
     * @param {ChannelNode[]} opts.channels
     * @param {ComObjectInstanceRef[]} opts.comObjectInstanceRefs
     * @param {ModuleInstance[]} opts.moduleInstances
     * @param {{[key: string]: ParameterInstanceRef}} opts.parameterInstanceRefs
     * @param {ComObject[]} [opts.comObjects]
     */
    constructor({
        identifier,
        address,
        projectUid,
        name,
        description,
        lastModified,
        productRef,
        hardwareProgramRef,
        line,
        manufacturer,
        additionalAddresses,
        channels,
        comObjectInstanceRefs,
        moduleInstances,
        parameterInstanceRefs,
        comObjects,
    }) {
        this.identifier = identifier;
        this.address = address;
        this.name = name; // empty string if not customized in project
        this.description = description;
        this.projectUid = projectUid != null ? projectUid : null;
        this.lastModified = lastModified;
        this.productRef = productRef;
        this.hardwareProgramRef = hardwareProgramRef;
        this.line = line;
        this.areaAddress = line.area.address; // used for sorting
        this.lineAddress = line.address; // used for sorting
        this.manufacturer = manufacturer;
        this.additionalAddresses = additionalAddresses || [];
        this.channels = channels || [];
        this.comObjectInstanceRefs = comObjectInstanceRefs || [];
        this.moduleInstances = moduleInstances || [];
        this.comObjects = comObjects || [];
        this.parameterInstanceRefs = parameterInstanceRefs || {};
        this.applicationProgramRef = null;

        this.individualAddress = `${this.areaAddress}.${this.lineAddress}.${this.address}`;
        this.productName = ""; // translatable name for specific product
        this.hardwareName = ""; // untranslatable name from hardware.xml
        this.orderNumber = "";
        this.manufacturerName = "";
    }

    /**
     * Add an additional individual address.
     *
     * @param {string} address
     */
    addAdditionalAddress(address) {
        this.additionalAddresses.push(`${this.line.area.address}/${this.line.address}/${address}`);
    }

    /**
     * Obtain the file name to the application program XML.
     *
     * @returns {string}
     */
    applicationProgramXml() {
        return `${this.manufacturer}/${this.applicationProgramRef}.xml`;
    }

    /**
     * Iterate ModuleInstance arguments (generator replacement: returns flat array).
     *
     * @returns {ModuleInstanceArgument[]}
     */
    moduleInstanceArguments() {
        const result = [];
        for (const moduleInstance of this.moduleInstances) {
            result.push(...moduleInstance.arguments);
        }
        return result;
    }

    /**
     * Merge items with their parent objects from the application program.
     *
     * @param {ApplicationProgram} application
     */
    mergeApplicationProgramInfo(application) {
        for (const argument of this.moduleInstanceArguments()) {
            const moduleDef = application.moduleDefArguments[argument.refId];
            if (moduleDef) {
                argument.name = moduleDef.name;
                argument.allocates = moduleDef.allocates;
            }
        }

        for (const comInstance of this.comObjectInstanceRefs) {
            comInstance.mergeApplicationProgramInfo(application, this.parameterInstanceRefs);
            comInstance.applyModuleBaseNumberArgument(this.moduleInstances, application);
        }

        for (const channel of this.channels) {
            channel.resolveChannelName(this, application);
            channel.resolveChannelModulePlaceholders(this);
        }
    }

    toString() {
        return (
            `DeviceInstance("${this.individualAddress} ${this.manufacturerName} - ${this.productName}" ` +
            `Id="${this.identifier}" Puid="${this.projectUid}" ` +
            `ApplicationProgram="${this.applicationProgramRef}")`
        );
    }
}

// ---------------------------------------------------------------------------
// ApplicationProgram (from models.py)
// ---------------------------------------------------------------------------

class ApplicationProgram {
    /**
     * @param {object} opts
     * @param {{[key: string]: ComObject}} opts.comObjects
     * @param {{[key: string]: ComObjectRef}} opts.comObjectRefs
     * @param {{[key: string]: Allocator}} opts.allocators
     * @param {{[key: string]: ModuleDefinitionArgumentInfo}} opts.moduleDefArguments
     * @param {{[key: string]: ModuleDefinitionNumericArg}} opts.numericArgs
     * @param {{[key: string]: ApplicationProgramChannel}} opts.channels
     */
    constructor({ comObjects, comObjectRefs, allocators, moduleDefArguments, numericArgs, channels }) {
        this.comObjects = comObjects || {};
        this.comObjectRefs = comObjectRefs || {};
        this.allocators = allocators || {};
        this.moduleDefArguments = moduleDefArguments || {};
        this.numericArgs = numericArgs || {};
        this.channels = channels || {};
    }
}

// ---------------------------------------------------------------------------
// Allocator (from models.py)
// ---------------------------------------------------------------------------

class Allocator {
    /**
     * @param {object} opts
     * @param {string} opts.identifier
     * @param {string} opts.name
     * @param {number} opts.start
     * @param {number} opts.end
     */
    constructor({ identifier, name, start, end }) {
        this.identifier = identifier;
        this.name = name;
        this.start = start;
        this.end = end;
    }
}

// ---------------------------------------------------------------------------
// ModuleDefinitionArgumentInfo (from models.py)
// ---------------------------------------------------------------------------

class ModuleDefinitionArgumentInfo {
    /**
     * @param {object} [opts]
     * @param {string} [opts.name]
     * @param {number|null} [opts.allocates]
     */
    constructor({ name, allocates } = {}) {
        this.name = name || "";
        this.allocates = allocates != null ? allocates : null;
    }
}

// ---------------------------------------------------------------------------
// ModuleDefinitionNumericArg (from models.py)
// ---------------------------------------------------------------------------

class ModuleDefinitionNumericArg {
    /**
     * @param {object} opts
     * @param {string|null} opts.allocatorRefId
     * @param {number|null} opts.value
     * @param {string|null} opts.baseValue
     */
    constructor({ allocatorRefId, value, baseValue }) {
        this.allocatorRefId = allocatorRefId != null ? allocatorRefId : null;
        this.value = value != null ? value : null;
        this.baseValue = baseValue != null ? baseValue : null;
    }
}

// ---------------------------------------------------------------------------
// ApplicationProgramChannel (from models.py)
// ---------------------------------------------------------------------------

class ApplicationProgramChannel {
    /**
     * @param {object} opts
     * @param {string} opts.identifier
     * @param {string|null} opts.text
     * @param {string|null} opts.textParameterRefId
     * @param {string} opts.name
     * @param {string} opts.number
     */
    constructor({ identifier, text, textParameterRefId, name, number }) {
        this.identifier = identifier;
        this.text = text != null ? text : null;
        this.textParameterRefId = textParameterRefId != null ? textParameterRefId : null;
        this.name = name;
        this.number = number;
    }
}

// ---------------------------------------------------------------------------
// KNXMasterData (from models.py)
// ---------------------------------------------------------------------------

class KNXMasterData {
    /**
     * @param {object} opts
     * @param {{[key: string]: string}} opts.functionTypeNames
     * @param {{[key: string]: string}} opts.manufacturerNames
     * @param {{[key: string]: string}} opts.spaceUsageMapping
     * @param {{[key: string]: {[key: string]: string}}} opts.translations
     */
    constructor({ functionTypeNames, manufacturerNames, spaceUsageMapping, translations }) {
        this.functionTypeNames = functionTypeNames || {};
        this.manufacturerNames = manufacturerNames || {};
        this.spaceUsageMapping = spaceUsageMapping || {};
        this.translations = translations || {};
    }

    /**
     * Get translation item from the translations dict.
     *
     * @param {string} refId
     * @param {string} [attributeName]
     * @returns {string|null}
     */
    getTranslationItem(refId, attributeName = "Text") {
        if (this.translations) {
            try {
                const entry = this.translations[refId];
                if (entry && entry[attributeName] !== undefined) {
                    return entry[attributeName];
                }
            } catch {
                // fall through
            }
        }
        return null;
    }

    /**
     * Get function type name from function type id.
     *
     * @param {string} functionTypeId
     * @returns {string}
     */
    getFunctionTypeName(functionTypeId) {
        const translated = this.getTranslationItem(functionTypeId);
        if (translated) {
            return translated;
        }
        return this.functionTypeNames[functionTypeId] || "";
    }

    /**
     * Get space usage name from space usage id.
     *
     * @param {string} spaceUsageId
     * @returns {string}
     */
    getSpaceUsageName(spaceUsageId) {
        const translated = this.getTranslationItem(spaceUsageId);
        if (translated) {
            return translated;
        }
        return this.spaceUsageMapping[spaceUsageId] || "";
    }
}

// ---------------------------------------------------------------------------
// XMLSpace (from models.py)
// ---------------------------------------------------------------------------

class XMLSpace {
    /**
     * @param {object} opts
     * @param {string} opts.identifier
     * @param {string} opts.name
     * @param {string} opts.spaceType - one of SpaceType values
     * @param {string|null} opts.usageId
     * @param {string} opts.usageText
     * @param {string} opts.number
     * @param {string} opts.description
     * @param {number|null} opts.projectUid
     * @param {XMLSpace[]} opts.spaces
     * @param {string[]} opts.devices - [DeviceInstance.individualAddress]
     * @param {string[]} opts.functions
     */
    constructor({
        identifier,
        name,
        spaceType,
        usageId,
        usageText,
        number,
        description,
        projectUid,
        spaces,
        devices,
        functions,
    }) {
        this.identifier = identifier;
        this.name = name;
        this.spaceType = spaceType;
        this.usageId = usageId != null ? usageId : null;
        this.usageText = usageText || "";
        this.number = number || "";
        this.description = description || "";
        this.projectUid = projectUid != null ? projectUid : null;
        this.spaces = spaces || [];
        this.devices = devices || [];
        this.functions = functions || [];
    }
}

// ---------------------------------------------------------------------------
// XMLFunction (from models.py)
// ---------------------------------------------------------------------------

class XMLFunction {
    /**
     * @param {object} opts
     * @param {string} opts.functionType
     * @param {XMLGroupAddressRef[]} opts.groupAddresses
     * @param {string} opts.identifier
     * @param {string} opts.name
     * @param {number|null} opts.projectUid
     * @param {string} opts.spaceId
     * @param {string} opts.usageText
     */
    constructor({ functionType, groupAddresses, identifier, name, projectUid, spaceId, usageText }) {
        this.functionType = functionType;
        this.groupAddresses = groupAddresses || [];
        this.identifier = identifier;
        this.name = name;
        this.projectUid = projectUid != null ? projectUid : null;
        this.spaceId = spaceId;
        this.usageText = usageText || "";
    }
}

// ---------------------------------------------------------------------------
// XMLGroupAddressRef (from models.py)
// ---------------------------------------------------------------------------

class XMLGroupAddressRef {
    /**
     * @param {object} opts
     * @param {string} opts.address
     * @param {string} opts.identifier
     * @param {string} opts.name
     * @param {number|null} opts.projectUid
     * @param {string} opts.refId
     * @param {string} opts.role
     */
    constructor({ address, identifier, name, projectUid, refId, role }) {
        this.address = address;
        this.identifier = identifier;
        this.name = name;
        this.projectUid = projectUid != null ? projectUid : null;
        this.refId = refId;
        this.role = role;
    }
}

// ---------------------------------------------------------------------------
// Product (from models.py)
// ---------------------------------------------------------------------------

class Product {
    /**
     * @param {object} opts
     * @param {string} opts.identifier
     * @param {string} opts.text
     * @param {string} opts.orderNumber
     * @param {string} [opts.hardwareName]
     */
    constructor({ identifier, text, orderNumber, hardwareName }) {
        this.identifier = identifier;
        this.text = text;
        this.orderNumber = orderNumber;
        this.hardwareName = hardwareName || "";
    }
}

// ---------------------------------------------------------------------------
// XMLProjectInformation (from models.py)
// ---------------------------------------------------------------------------

class XMLProjectInformation {
    /**
     * @param {object} [opts]
     * @param {string} [opts.projectId]
     * @param {string} [opts.name]
     * @param {string|null} [opts.lastModified]
     * @param {string} [opts.groupAddressStyle]
     * @param {string} [opts.guid]
     * @param {string} [opts.createdBy]
     * @param {string} [opts.schemaVersion]
     * @param {string} [opts.toolVersion]
     */
    constructor({
        projectId,
        name,
        lastModified,
        groupAddressStyle,
        guid,
        createdBy,
        schemaVersion,
        toolVersion,
    } = {}) {
        this.projectId = projectId || "";
        this.name = name || "";
        this.lastModified = lastModified != null ? lastModified : null;
        this.groupAddressStyle = groupAddressStyle || GroupAddressStyle.THREELEVEL;
        this.guid = guid || "";
        this.createdBy = createdBy || "";
        this.schemaVersion = schemaVersion || "";
        this.toolVersion = toolVersion || "";
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    // Enums / constants
    GroupAddressStyle,
    SpaceType,
    MEDIUM_TYPES,

    // Error
    UnexpectedDataError,

    // XML model classes
    XMLGroupAddress,
    XMLGroupRange,
    XMLArea,
    XMLLine,
    DeviceInstance,
    ChannelNode,
    ModuleInstance,
    ModuleInstanceArgument,
    ComObjectInstanceRef,
    ParameterInstanceRef,
    ApplicationProgram,
    Allocator,
    ModuleDefinitionArgumentInfo,
    ModuleDefinitionNumericArg,
    ApplicationProgramChannel,
    ComObject,
    ComObjectRef,
    KNXMasterData,
    XMLSpace,
    XMLFunction,
    XMLGroupAddressRef,
    Product,
    XMLProjectInformation,
};
