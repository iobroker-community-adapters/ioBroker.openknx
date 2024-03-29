## Datapoint Types

|DPT   	  | Description       | Value type  	| Example  	| Notes |
|---	    |---	                  |---	|---	|---	|
|DPT1   	| 1-bit control  	      | Boolean/Numeric	|  true/"true"/1 false/"false"/0 | |
|DPT2   	| 1-bit control w/prio  | Object | {priority: 0, data: 1}  	|   |
|DPT3   	| 4-bit dimming/blinds  | Object | {decr_incr: 1, data: 0}  	|   data: 3-bit (0..7)|
|DPT4   	| 8-bit character  	|   String	| "a"  |   1st char must be ASCII	|
|DPT5   	| 8-bit unsigned int  | Numeric | 127  |  0..255 	|
|DPT6   	| 8-bit signed int  	| Numeric | -12  |  -128..127 	|
|DPT7   	| 16-bit unsigned int  | Numeric  |  |  0..65535 	|
|DPT8   	| 16-bit signed integer | Numeric |  |  -32768..32767 |
|DPT9   	| 16-bit floating point | Numeric |  |  |
|DPT10   	| 24-bit time + day of week	| Date | new Date() | only the time part is used, see note |
|DPT11   	| 24-bit date 	| Date| new Date() |   only the date part is used, see note |
|DPT12   	| 32-bit unsigned int | Numeric |   	|  |
|DPT13   	| 32-bit signed int   | Numeric |   	|  |
|DPT14   	| 32-bit floating point | Numeric |   	|  |
|DPT15   	| 32-bit access control |  |  |  |
|DPT16   	| ASCII string 	|  String |  |  |
|DPT17   	| Scene number 	|  |  |  |
|DPT18   	| Scene control |  |  |  |
|DPT19   	| 8-byte Date and Time |  Date | new Date() |  |
|DPT20    | 1-byte HVAC	|  |  |  |
|DPT21    | 1-byte status	|  |  |  |
|DPT23    | 1-byte |  |  |  |
|DPT237   | 2-byte unsigned value	|  |  |  |
|DPT238   | 1-byte unsigned value	|  |  |  |

When you add new DPT's, please ensure that you add the corresponding unit test
under the `test/dptlib` subdirectory. The unit tests come with a small helper
library that provides the boilerplate code to marshal and unlarshal your test cases.

Take for example the unit test for DPT5, which carries a single-byte payload.
Some of its subtypes (eg. 5.001 for percentages and 5.003 for angle degrees)
need to be scaled up or down, whereas other subtypes *must not* be scaled at all:

```js
// DPT5 without subtype: no scaling
commontest.do('DPT5', [
  { apdu_data: [0x00], jsval: 0},
  { apdu_data: [0x40], jsval: 64},
  { apdu_data: [0x41], jsval: 65},
  { apdu_data: [0x80], jsval: 128},
  { apdu_data: [0xff], jsval: 255}
]);
// 5.001 percentage (0=0..ff=100%)
commontest.do('DPT5.001', [
  { apdu_data: [0x00], jsval: 0 },
  { apdu_data: [0x80], jsval: 50},
  { apdu_data: [0xff], jsval: 100}
]);
// 5.003 angle (degrees 0=0, ff=360)
commontest.do('DPT5.003', [
  { apdu_data:  [0x00], jsval: 0 },
  { apdu_data:  [0x80], jsval: 181 },
  { apdu_data:  [0xff], jsval: 360 }
]);
```

## Date and time DPTs (DPT10, DPT11)
Please have in mind that Javascript and KNX have very different base type for time and date.

- DPT10 is time (hh:mm:ss) plus "day of week". This concept is unavailable in JS, so you'll be getting/setting a regular *Date* Js object, but  *please remember* you'll need to _ignore_ the date, month and year. The *exact same datagram* that converts to "Mon, Jul 1st 12:34:56", will evaluate to a wildly different JS Date of "Mon, Jul 8th 12:34:56" one week later. Be warned!
- DPT11 is date (dd/mm/yyyy): the same applies for DPT11, you'll need to *ignore the time part*.