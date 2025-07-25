"use strict";
//id,data  -- ga
module.exports = class DoubleKeyedMap {
    constructor() {
        //ga, id 1:n
        this.ga = new Map();
        //id, iobroker object 1:1
        this.data = new Map();
        //id, knx dp 1:1
        this.dp = new Map();
    }

    //update or add
    set(id, ga, data) {
        this.data.set(id, data);
        this.ga.set(ga, this.ga.has(ga) ? this.ga.get(ga).concat(id) : [id]);
    }

    //only dp returns transformed value, hold a reference to it
    setDpById(id, dp) {
        this.dp.set(id, dp);
    }

    getDataById(id) {
        return this.data.get(id);
    }

    getIdsByGa(ga) {
        const ret = [];
        if (this.ga.size != 0 && this.ga.get(ga)) {
            let ids = this.ga.get(ga);
            //arrify string
            if (!Array.isArray(ids)) {
                ids = [ids];
            }
            for (const id of ids) {
                ret.push(id);
            }
        }
        return ret;
    }

    //depends on knx startup setDpById
    getDpById(id) {
        return this.dp.get(id);
    }

    //depends on knx startup setDpById
    getDpsByGa(ga) {
        const ret = [];
        if (this.ga.size != 0 && this.getIdsByGa(ga)) {
            for (const id of this.getIdsByGa(ga)) {
                ret.push(this.getDpById(id));
            }
        }
        return ret;
    }

    getDataByGa(ga) {
        const ret = [];
        if (this.ga.size != 0 && this.getIdsByGa(ga)) {
            for (const id of this.getIdsByGa(ga)) {
                ret.push(this.getDataById(id));
            }
        }
        return ret;
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
                }
                return {
                    done: true,
                };
            },
        };
    }
};
