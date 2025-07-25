![Logo](../../admin/openknx.png)

# ioBroker.openknx

## Installation

The adapter can be searched in the adapter list under "openknx" and installed by clicking the + Symbol.

## Adapter configuration

![settings](img/setting.png)

Press "save & close" or "save" to restart the adapter and take over the changes.
When starting, the adapter tries to read all GroupAdresses with have the autoread flag (default setting).
This could take a while and can produce a higher load on your KNX-bus. This ensures that the adapter operates with up-to-date values from the start.
Autoread is done on the first connection with the knx bus after an adapter start or restart, not on every knx reconnection.  
After adapter installation, open the adapter configuration. Fill in:

### KNX Gateway IP

IP of your KNX IP gateway.

### Port

this is normally port 3671 of the KNX IP gateway.

### Local IPv4 network interface

The interface that is connected to the KNX IP gateway.

### Detect

Searches via a standardized protocol all available KNX IP Gateways on the given network interface.

### Minimum send delay between two frames [ms]

This settings protects the KNX bus from data flooding by limiting data frames to a certain rate.
Not sent frames are delay until the delay time since last send on bus is elapsed. If more send requests are waiting, send order is random.
If you experience disconnects from your KNX IP Gateway in the log then increase this number.

### use common.type boolean for 1 bit enum instead of number

Use in IOB Object common.type boolean for 1 bit enum instead of number.

### readout KNX values on startup of iob objects that are configured for autoread

All IOB objects that are configured with the autoread flag are requested on the bus to be synchronized with IOB.

### do not warn on unknown KNX group adresses

Do not create a warn log entry in the protocol on receiving an unknown ga.

### do not overwrite existing IOB objects

If checked, the import will skip overwriting existing communication objects.

### remove existing IOB objects thtat are not in ETS import file

To clean up object tree

### import ETS xml and save

![ETS export](img/exportGA.png)

1. In ETS go to Group Addresses, select export group address and select XML export in latest format version.
   ETS4 Format is not supported, it does not contain DPT information.
2. upload your ETS Export XML in the adapter via the GA XML-Import dialog
3. Import will immediatelly start after file selection and give a status report after completion.  
   After the successful import a message shows how much objects have been recognized.
   An error dialog will shop problems during import and gives hints how to clean up the ets database.
   Additional information could be found in the log.
   Data will be stored and the adapter is reset.

Hint on ETS configuration:  
If you have different DPT Subtypes for the GA and in the communication objets that use this GA, then the ETS seems to use the DPT Type with the lowest number.
In this case manually ensure that all elements are using the same desired datatype.  
A GA without DPT basetype cannot be imported with this adapter. ETS4 projects must be converted into ETS5 or later and the DPT must be set to the GA.

### Group Address Style

The style only defines the appearance of the Group Address in the ETS user interface. The following styles are available:

|     | Presentation Style | Name                 | Example |
| --- | ------------------ | -------------------- | ------- |
| 1   | 3-Level            | Main/Middle/Subgroup | 1/3/5   |
| 2   | 2-Level            | Main Group/Subgroup  | 1/25    |
| 3   | Free-Level         | Subgroup             | 300     |

The adapter supports all 3 style configurations in the project import xml file. For storing in the IOB object, the format is always converted into the 3-level form.
Please note that the combined ga and group name must be unique for the IOB object tree. Having for example an ETS configuration with two middle groups of the same name will result in a joint hierarchy element and having two identically named gas in there will result into an error.

### Alias

KNX devices can have ga's for state feedback that belong to a commanding ga. Some applications like certain VIS widgets expect a combined status and actuation object. You can combine these seperate objects into one so called alias. The menu helps to create matching pairs according to the naming convention with the given filtering rule.
Find more information here https://www.iobroker.net/#en/documentation/dev/aliases.md

### Regex

Filtering rule for the status object. Used to find matching write and read ga pairs.

### Minimum similarity

Defines how strict the matching algorithm filters out similar entries.

### Alias path

The object folder where the aliases get generated.

### inculde group range in search

The whole name including path is used to check for similarity.

## Adapter migration hints

### migrate Node Red

-   in right side menu, select Export
-   select All Flows, Download
-   in text editor replace knx.0. with openknx.0.
-   right side menu, select import
-   select changed file
-   in the dialog select Flows (Subflows, Configuration-Nodes only if they are affected) -> new tabs get added
-   delete old flows manually

### migrate VIS

-   Open Vis Editor
-   Setup -> Projekt-Export/import -> Exportieren normal
-   Open Zip File and vis-views.json in an editor
-   Search Replace knx.0. with openknx.0.
-   Compress vis-views.json and vis-user.css in a zip file
-   Setup -> Projekt-Export/import -> Import
-   Move zip file in Drop Area
-   Projektname = main
-   Import project

### migrate Scripts

-   Open Scripts
-   3 dots -> Export all scripts
-   Open Zip File and open the folder in a editor
-   Search Replace knx.0 with openknx.0
-   compress all changed files in a zip file
-   3 dots ->Import scripts
-   Move zip file in Drop Area

### migrate Grafana

-   go through all dashboards and select share - export - save to file
-   in text editor replace knx.0. with openknx.0.
-   To import a dashboard click the + icon in the side menu, and then click Import.
-   From here you can upload a dashboard JSON file
-   select Import (Overwrite)

### migrate Influx

-   login via SSH to your IOBroker and run command influx
-   use iobroker (or your specific database listed via command show databases)
-   list entries with: show measurements
-   copy tables with command: select \* into "entry_new" from "entry_old";
    where entry_new points to the old adapter object path and entry_new the openknx adapter instance
-   set influx enabled for new object entry_new

## howto use the adapter & basic concepts

### ACK flags with tunneling connections

Applications shall not set the ack flag, application is notified from this adapter by the ack flag if data is updated.
OpenKNX sets the ack flag of the corresponding IoBroker object on receiption of a group address if another knx host writes to the bus.

| GA is                               | connected to device with an R flag | connected to devices with no R flag | unconnected              |
| ----------------------------------- | ---------------------------------- | ----------------------------------- | ------------------------ |
| Application issues GroupValue_Write | OpenKNX generates ack              | OpenKNX generates ack               | OpenKNX generates no ack |
| Application issues GroupValue_Read  | OpenKNX generates ack              | OpenKNX generates no ack            | OpenKNX generates no ack |

### Node Red complex datatype example

Create a function node that connects to a ioBroker out node that connects with a KNX object of DPT-2.
msg.payload = {"priority":1 ,"data":0};
return msg;

## log level

Enable expert mode to enable switching between different log levels. Default loglevel is info.  
![loglevel](img/loglevel.png)

## IOBroker Communication Object description

IoBroker defines Objects to hold communication interfaces settings.  
GA import generates a communication object folder structure following the ga main-group/middle-group scheme. Each groupaddress is an oject with following automatically generated data.

IoBroker state roles (https://github.com/ioBroker/ioBroker/blob/master/doc/STATE_ROLES.md) have value 'state' by default. Some more granular values are derieved from the DPT, for example Date or Switch.

Autoread is set to false where it is clear from the DPT that this is a trigger signal. This applies to scene numbers.

```json
{
    "_id": "path.and.name.to.object", // derieved from the KNX structure
    "type": "state",
    "common": {
        // values here can be interpreted by iobroker
        "desc": "Basetype: 1-bit value, Subtype: switch", // informative, from DPT
        "name": "Aussen Melder Licht schalten", // informative description from ets export
        "read": true, // default set, if false incoming bus values are not updating the object
        "role": "state", // default state, derieved from DPT
        "type": "boolean", // boolean, number, string, object, derieved from DPT
        "unit": "", // derived from DPT
        "write": true // default true, if set change on object is triggering knx write, succ. write sets then ack flag to true
    },
    "native": {
        // values here can be interpreted by openknx adapter
        "address": "0/1/2", // knx group address
        "answer_groupValueResponse": false, // default false, if set to true adapter responds with value on GroupValue_Read
        "autoread": true, // default true for non trigger signals , adapter sends a GroupValue_read on start to sync its states
        "bitlength": 1, // size ob knx data, derived from DPT
        "dpt": "DPT1.001", // DPT
        "encoding": {
            // values of the interface if it is an enum DPT type
            "0": "Off",
            "1": "On"
        },
        "force_encoding": "", // informative
        "signedness": "", // informative
        "valuetype": "basic" // composite means set via a specific javascript object
    },
    "from": "system.adapter.openknx.0",
    "user": "system.user.admin",
    "ts": 1638913951639
}
```

## Adapter communication Interface Description

Handeled DPTs are: 1-21,232,237,238  
Unhandeled DPTs are written as raw buffers, the interface is a sequencial string of hexadecimal numbers. For example write '0102feff' to send values 0x01 0x02 0xfe 0xff on the bus.
Where number datatype is used please note that interface values can be scaled.

### API call

IoBroker defines States as communication interface.

```javascript
setState(
    '',                                             // @param {string}                                id of the object with path
    {                                               // @param {object|string|number|boolean}          state simple value or object with attribues.
	val:    value,
	ack:    true|false,                         // optional, should be false by convention
	ts:     timestampMS,                        // optional, default - now
	q:      qualityAsNumber,                    // optional, set it to value 0x10 to trigger a bus group value read to this object, given StateValue is ignored
	from:   origin,                             // optional, default - this adapter
	c:      comment,                            // optional, set it to value GroupValue_Read to trigger a bus group value read to this object, given StateValue is ignored
	expire: expireInSeconds                     // optional, default - 0
	lc:     timestampMS                         // optional, default - calculated value
    },
    false,                                          // @param {boolean} [ack]                         optional, should be false by convention
    {},                                             // @param {object} [options]                      optional, user context
    (err, id) => {}                                 // @param {ioBroker.SetStateCallback} [callback]  optional, return error and id
);
```

example to trigger a GroupValue_Read:

```javascript
setState(myState, { val: false, ack: false, c: "GroupValue_Read" });
setState(myState, { val: false, ack: false, q: 0x10 });
```

GroupValue_Read comment does not work for javascript adapter. Use qualityAsNumber value 0x10 instead.

### Description of all DPTs

| KNX DPT   | javascript datatype    | special values                                                                                       | value range                               | remark                                                |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| DPT-1     | number enum            |                                                                                                      | 1 bit false, true                         |                                                       |
| DPT-2     | object                 | {"priority":1 bit,"data":1 bit}                                                                      | -                                         |                                                       |
| DPT-3     | object                 | {"decr_incr":1 bit,"data":2 bit}                                                                     | -                                         |                                                       |
| DPT-18    | object                 | {"save_recall":0,"scenenumber":0}                                                                    | -                                         | datapoint Type DPT_SceneControl removed from autoread |
|           |                        |                                                                                                      |                                           | save_recall: 0 = recall scene, 1 = save scene         |
| DPT-21    | object                 | {"outofservice":0,"fault":0,"overridden":0,"inalarm":0,"alarmunack":0}                               | -                                         |                                                       |
| DPT-232   | object                 | {red:0..255, green:0.255, blue:0.255}                                                                | -                                         |                                                       |
| DPT-237   | object                 | {"address":0,"addresstype":0,"readresponse":0,"lampfailure":0,"ballastfailure":0,"convertorerror":0} | -                                         |                                                       |
| DPT-4     | string                 |                                                                                                      | one character sent as 8-bit character     |                                                       |
| DPT-16    | string                 |                                                                                                      | one character sent as 16 character string |                                                       |
| DPT-5     | number                 |                                                                                                      | 8-bit unsigned value                      |                                                       |
| DPT-5.001 | number                 |                                                                                                      | 0..100 [%] scaled to 1-byte               |                                                       |
| DPT-5.003 | number                 |                                                                                                      | 0..360 [°] scaled to 1-byte               |                                                       |
| DPT-6     | number                 |                                                                                                      | 8-bit signed -128..127                    |                                                       |
| DPT-7     | number                 |                                                                                                      | 16-bit unsigned value                     |                                                       |
| DPT-8     | number                 |                                                                                                      | 2-byte signed value -32768..32767         |                                                       |
| DPT-9     | number                 |                                                                                                      | 2-byte floating point value               |                                                       |
| DPT-14    | number                 |                                                                                                      | 4-byte floating point value               |                                                       |
| DPT-12    | number                 |                                                                                                      | 4-byte unsigned value                     |                                                       |
| DPT-13    | number                 |                                                                                                      | 4-byte signed value                       |                                                       |
| DPT-15    | number                 |                                                                                                      | 4-byte                                    |                                                       |
| DPT-17    | number                 |                                                                                                      | 1-byte                                    | DPT_SceneNumber is not read by autoread               |
| DPT-20    | number                 |                                                                                                      | 1-byte                                    |                                                       |
| DPT-238   | number                 |                                                                                                      | 1-byte                                    |                                                       |
| DPT-10    | number for Date Object |                                                                                                      | -                                         |                                                       |
| DPT-11    | number for Date Object |                                                                                                      | -                                         |                                                       |
| DPT-19    | number for Date Object |                                                                                                      | -                                         |                                                       |
| DPT-26    | string                 | e.g. 00010203..                                                                                      | -                                         | Datapoint Type DPT_SceneInfo is not read by autread   |
| DPT-28    | string                 |                                                                                                      | variable                                  | Unicode UTF-8 encoded string                          |
| DPT-29    | string                 | e.g. "123456789000"                                                                                  | 8-byte signed value                       | the datatype in IOB of this numeric value is string   |
| DPT-238   | string                 | e.g. 00010203..                                                                                      | -                                         | DPT_SceneConfig is not read by autread                |
| rest      | string                 | e.g. 00010203..                                                                                      | -                                         |                                                       |

Only time and date information is exchanged with KNX time based datatypes, e.g. DPT-19 has unsupported fields for signal quality.

Object send and receive values are of type boolean DPT-1), number (scaled, or unscaled), string.  
DPT-2 'expects a object {"priority":0,"data":1}' receive provides a strinified object of same type.  
Other joint DPTs have similar object notation.  
DPT-19 expects a Number from a Date Object, Iobroker can not handle objects, fields of KNX ko that cannot be derived from timestamp are not implemented eg. quality flags.

Date and time DPTs (DPT10, DPT11)  
Please have in mind that Javascript and KNX have very different base type for time and date.
DPT10 is time (hh:mm:ss) plus "day of week". This concept is unavailable in JS, so you'll be getting/setting a regular Date Js object, but please remember you'll need to ignore the date, month and year. The exact same datagram that converts to "Mon, Jul 1st 12:34:56", will evaluate to a wildly different JS Date of "Mon, Jul 8th 12:34:56" one week later. Be warned!
DPT11 is date (dd/mm/yyyy): the same applies for DPT-11, you'll need to ignore the time part.

(KNX specification of DPTs https://www.knx.org/wAssets/docs/downloads/Certification/Interworking-Datapoint-types/03_07_02-Datapoint-Types-v02.02.01-AS.pdf)

### group value write

Sending group value write message is triggered by writing a communication object.
Communication object is triggered when a write frame is received on the bus.

### group value read

Sending a group value read can be triggered by writing a communicaton object with comment. Please see API call section for details.
Receiving, if configured, will trigger a group value response (limitation: group value write at the moment) of the actual communication object value, see below.

### group value response

If answer_groupValueResponse is set to true, then the adapter will reply with a GroupValue_Response to a previously received GroupValue_Read request.
This is the KNX Read flag. Only one communication object on the bus or the IOBroker object should have this flag set, ideally the one that knows the state best.

### mapping to KNX Flags

The KNX object flags define the bus behavior of the object they represent.
6 different object flags are defined.

| Flag                       | Flag de                  | Adapter usage                           |                                                |
| -------------------------- | ------------------------ | --------------------------------------- | ---------------------------------------------- |
| C: the Communication flag  | K: Kommunikations-Flag   | always set                              |                                                |
| R: the Read flag           | L: Lese-Flag             | object native.answer_groupValueResponse |                                                |
| T: the Transmit flag       | Ü: Übertragen-Flag       | object common.write                     |                                                |
| W: the Write flag          | S: Schreiben-Flag        | object common.read                      | bus can modify the object                      |
| U: the Update flag         | A: Aktualisieren-Flag    | object common.read                      | update object on incoming GroupValue_Responses |
| I: the Initialization flag | I: Initialisierungs-Flag | object native.autoread                  |                                                |

## Monitoring and Error Tracking

Openknx uses sentry.io for application monitoring and error tracking.
It aids developers to better hunt bugs and gain field usage data. The identification of an user is tracked in a pseudonymised way.
Data is sent to Iobroker Sentry server hosted in Germany. If you have allowed iobroker GmbH to collect diagnostic data then also your anonymous installation ID is included. This allows Sentry to group errors and show how many unique users are affected by such an error.

Openknx estimates the current bus load of the KNX line it is connected to in object `info.busload`.

## Features

- compatible with ETS 5 and ETS 6
- stable and reliable knx stack
- automatic encoding/deconding of KNX datagrams for most importants DPTs, raw read and write for other DPTs
- support of KNX group value read and group value write and group value response
- free open source
- no dependencies to cloud services, runs offline without internet access
- autoread on start
- fast import of group addresses in XML format
- create joint alias objects that react on status inputs
- supports project of all possible group address styles

## Limitations

- ETS 4 export file format is not supported
- KNX secure is not supported
- only IPv4 supported

## FAQ

**Autoread trigger actors on the bus to react**

Check in ETS if group objects of certain devices that are connected to the suspicious GA have the R/L flag configured. This should not be the case if te device is a consumer of the signal. If the signal has an event character, a groupValueRead would trigger that event. Change configuration in ETS or disable autoread for this object.

**DISCONNECT_REQUEST on startup**

Increase setting for Minimum send delay between two frames to avoid flooding the interface

**Is secure tunneling supported?**

No. Disable secure tunneling in your IP interface.
