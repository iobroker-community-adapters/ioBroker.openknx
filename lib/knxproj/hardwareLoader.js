/* SPDX-License-Identifier: GPL-3.0-only */
/*
 * Copyright Contributors to the ioBroker.openknx project
 *
 * Port of xknxproject/loader/hardware_loader.py
 * Parses M-xxxx/Hardware.xml files from a .knxproj archive.
 */

"use strict";

const { DOMParser } = require("@xmldom/xmldom");

/**
 * Get all descendant elements with a given local name (namespace-agnostic).
 *
 * @param {Node} node
 * @param {string} localName
 * @returns {Element[]}
 */
function byTagNS(node, localName) {
    return Array.from(node.getElementsByTagNameNS("*", localName));
}

/**
 * Get direct child elements with a given local name.
 *
 * @param {Node} node
 * @param {string} localName
 * @returns {Element[]}
 */
function childrenByTag(node, localName) {
    const result = [];
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === 1) {
            const ln = child.localName || child.nodeName.replace(/^.*:/, "");
            if (ln === localName) {
                result.push(child);
            }
        }
    }
    return result;
}

/**
 * Get the first direct child element with a given local name, or null.
 *
 * @param {Node} node
 * @param {string} localName
 * @returns {Element|null}
 */
function firstChildByTag(node, localName) {
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === 1) {
            const ln = child.localName || child.nodeName.replace(/^.*:/, "");
            if (ln === localName) {
                return child;
            }
        }
    }
    return null;
}

/**
 * Parse a single Hardware element (the inner <Hardware> node with a Name attribute).
 * Extracts products and hardware-to-application-program mappings.
 *
 * @param {Element} hardwareNode - The <Hardware> element (child of the outer Hardware container)
 * @returns {{ products: Map<string, object>, hardware2Programs: Map<string, string> }}
 */
function parseHardwareElement(hardwareNode) {
    const products = new Map();
    const hardware2Programs = new Map();

    const hardwareName = hardwareNode.getAttribute("Name") || "";

    // Products/Product nodes within this Hardware element
    const productsContainer = firstChildByTag(hardwareNode, "Products");
    const productNodes = productsContainer ? childrenByTag(productsContainer, "Product") : [];
    for (const productNode of productNodes) {
        const product = {
            identifier: productNode.getAttribute("Id") || "",
            text: productNode.getAttribute("Text") || "",
            orderNumber: productNode.getAttribute("OrderNumber") || "",
            hardwareName: hardwareName,
        };
        products.set(product.identifier, product);
    }

    // Hardware2Programs/Hardware2Program[@Id] that contain an ApplicationProgramRef[@RefId]
    const h2pContainer = firstChildByTag(hardwareNode, "Hardware2Programs");
    const h2pNodes = h2pContainer ? childrenByTag(h2pContainer, "Hardware2Program") : [];
    for (const h2pNode of h2pNodes) {
        const id = h2pNode.getAttribute("Id");
        if (!id) {
            continue;
        }
        const appRefNode = firstChildByTag(h2pNode, "ApplicationProgramRef");
        if (!appRefNode) {
            continue;
        }
        const applicationRef = appRefNode.getAttribute("RefId") || "";
        if (applicationRef) {
            hardware2Programs.set(id, applicationRef);
        }
    }

    return { products, hardware2Programs };
}

/**
 * Apply a translation to an existing product, updating its text field.
 *
 * @param {object} product - Product object with a mutable `text` property
 * @param {Element} translationElementNode - A <TranslationElement> node
 */
function applyProductTranslation(product, translationElementNode) {
    const translationNodes = childrenByTag(translationElementNode, "Translation");
    for (const tNode of translationNodes) {
        if (tNode.getAttribute("AttributeName") === "Text") {
            product.text = tNode.getAttribute("Text") || "";
            return;
        }
    }
}

/**
 * Parse a single Hardware.xml file and return products and hardware2Program mappings.
 *
 * @param {string} xmlString - The raw XML content of Hardware.xml
 * @param {string|null} languageCode - The resolved language code for translations (e.g. "de-DE")
 * @returns {{ products: Map<string, object>, hardware2Programs: Map<string, string> }}
 */
function parseHardwareXml(xmlString, languageCode) {
    // Strip BOM if present - @xmldom/xmldom fails if BOM precedes <?xml declaration
    if (xmlString.charCodeAt(0) === 0xfeff) {
        xmlString = xmlString.slice(1);
    }
    const doc = new DOMParser().parseFromString(xmlString, "text/xml");

    const products = new Map();
    const hardware2Programs = new Map();

    // Navigate: Manufacturer > Hardware (outer) > Hardware (inner, with Name)
    const manufacturerNodes = byTagNS(doc, "Manufacturer");
    for (const mfr of manufacturerNodes) {
        // Outer Hardware containers
        const outerHardwareNodes = childrenByTag(mfr, "Hardware");
        for (const outerHw of outerHardwareNodes) {
            // Inner Hardware elements (with Name attribute)
            const innerHardwareNodes = childrenByTag(outerHw, "Hardware");
            for (const hardwareNode of innerHardwareNodes) {
                const result = parseHardwareElement(hardwareNode);
                for (const [k, v] of result.products) {
                    products.set(k, v);
                }
                for (const [k, v] of result.hardware2Programs) {
                    hardware2Programs.set(k, v);
                }
            }
        }
    }

    // Apply translations if a language code is set
    if (languageCode) {
        for (const mfr of manufacturerNodes) {
            const languagesContainer = firstChildByTag(mfr, "Languages");
            if (!languagesContainer) {
                continue;
            }
            const languageNodes = childrenByTag(languagesContainer, "Language");
            for (const langNode of languageNodes) {
                if (langNode.getAttribute("Identifier") !== languageCode) {
                    continue;
                }
                const translationElements = byTagNS(langNode, "TranslationElement");
                for (const translationElement of translationElements) {
                    const refId = translationElement.getAttribute("RefId");
                    if (!refId || !products.has(refId)) {
                        continue;
                    }
                    applyProductTranslation(products.get(refId), translationElement);
                }
            }
        }
    }

    return { products, hardware2Programs };
}

module.exports = {
    /**
     * Load hardware data from manufacturer XML files.
     *
     * @param {object} knxProjContents
     * @param {string[]} manufacturerIds - Array of manufacturer directory names like ["M-0001", "M-0083"]
     * @param {string} languageCode - The resolved language code
     * @returns {Promise<{ products: Map<string, object>, hardware2Programs: Map<string, string> }>}
     */
    load: async function (knxProjContents, manufacturerIds, languageCode) {
        const products = new Map();
        const hardware2Programs = new Map();

        for (const manufacturerId of manufacturerIds) {
            const filePath = `${manufacturerId}/Hardware.xml`;

            // Check if the file exists in the archive before trying to read it
            const entries = knxProjContents.rootDir.files;
            const exists = entries.some(f => f.path === filePath || f.path.toLowerCase() === filePath.toLowerCase());
            if (!exists) {
                continue;
            }

            const xmlString = await knxProjContents.readFile(filePath);
            const result = parseHardwareXml(xmlString, languageCode);

            for (const [k, v] of result.products) {
                products.set(k, v);
            }
            for (const [k, v] of result.hardware2Programs) {
                hardware2Programs.set(k, v);
            }
        }

        return { products, hardware2Programs };
    },
};
