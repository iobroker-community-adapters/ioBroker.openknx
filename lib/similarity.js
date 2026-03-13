/* SPDX-License-Identifier: MIT */
/* Based on similarity (https://github.com/words/similarity) and levenshtein-edit-distance */

"use strict";

const cache = [];
const codes = [];

function levenshtein(value, other, insensitive) {
    if (value === other) {
        return 0;
    }

    if (value.length === 0) {
        return other.length;
    }

    if (other.length === 0) {
        return value.length;
    }

    if (insensitive) {
        value = value.toLowerCase();
        other = other.toLowerCase();
    }

    let index = 0;

    while (index < value.length) {
        codes[index] = value.charCodeAt(index);
        cache[index] = ++index;
    }

    let indexOther = 0;
    let result;

    while (indexOther < other.length) {
        const code = other.charCodeAt(indexOther);
        let distance = indexOther++;
        result = distance;
        index = -1;

        while (++index < value.length) {
            const distanceOther = code === codes[index] ? distance : distance + 1;
            distance = cache[index];
            cache[index] = result =
                distance > result
                    ? distanceOther > result
                        ? result + 1
                        : distanceOther
                    : distanceOther > distance
                        ? distance + 1
                        : distanceOther;
        }
    }

    return result;
}

module.exports = function similarity(a, b, options) {
    const left = a || "";
    const right = b || "";
    const insensitive = !(options || {}).sensitive;
    const longest = Math.max(left.length, right.length);

    return longest === 0 ? 1 : (longest - levenshtein(left, right, insensitive)) / longest;
};
