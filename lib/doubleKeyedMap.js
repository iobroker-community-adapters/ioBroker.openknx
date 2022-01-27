"use strict";

module.exports = class DoubleKeyedMap {
    constructor() {
        //id, ga
        this.keymap = new Map();
        //id, iobroker object
        this.data = new Map();
        //id, knx dp
        this.dp = new Map();
    }
    //update or add
    set(id, address, data) {
        this.keymap.set(address, id);
        this.data.set(id, data);
    }
    //only dp returns transformed value, hold a reference to it
    setDpById(id, dp) {
        this.dp.set(id, dp);
    }
    //depends on knx startup
    getDpById(id) {
        return this.dp.get(id);
    }
    //depends on knx startup
    getDpByAddress(address) {
        return this.dp.get(this.keymap.get(address));
    }
    getDataById(id) {
        return this.data.get(id);
    }
    getDataByAddress(address) {
        return this.data.get(this.keymap.get(address));
    }
    getIdByAddress(address) {
        return this.keymap.get(address);
    }

    //key value is id
    [Symbol.iterator]() {
        return {
            index: -1,
            data: this.data,
            next() {
                if (++this.index < this.data.size) {
                    return {
                        done: false,
                        value: Array.from(this.data.keys())[this.index],
                    };
                } else {
                    return {
                        done: true,
                    };
                }
            },
        };
    }
};
