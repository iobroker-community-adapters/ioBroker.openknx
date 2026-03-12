# Older changes
## 0.7.2 (2024-01-09)

-   feature: handle network connection instability issues
-   feature: generate more log messages
-   bugfix: telegram count

## 0.7.1 (2024-01-07)

-   feature: when requesting fast message sendout create iob acks per bus message status, situation before: it triggered all acks on first message send confirmance
-   feature: when requesting fast message sendout create iob acks per bus message status, situation before: it triggered all acks on first message send confirmance
-   feature: add message count object
-   feature: use common.desc from ets xml Description field and move datatype info to native
-   cleanup: stop timers on shutdown
-   bugfix: create a log entry on reception of unknown ga
-   bugfix: do not count send as duplicate trigger in load measurement
-   increase default minimum send delay to 80ms

## 0.7.0 (2023-12-18)

-   feature: adding support for DPT-28 and DPT-29
-   severity lifted to warning for gas appearing in multiple objects
-   feature: some more verbose failure outputs
-   feature: always warn if knx element in object tree not found in import file
-   bugfix: do not report errors resulting from bad bus data to sentry #433
-   bugfix: do not forward invalid bus data to iob object tree
-   cleanup: DTP library

## 0.6.3 (2023-12-10)

-   stable release of version 0.6.1

## 0.6.1 (2023-12-02)

-   feature: add KNX bus load measurement
-   feature: remove standard autoread enable for some DPT-1 datatypes which are triggers
-   bugfix: in error logging

## 0.5.3 (2023-03-17)

-   savek-cc bugfix: Fix handling of addinfo_length - used to crash if addinfo was actually supplied #338
-   bugfix: admin menu scroll small screen #339
-   feature: add DTP-9.009

## 0.5.2 (2023-01-02)

-   bugfix: correct falsly generated "confirmation false received" notifications on high sending load

## 0.5.0 (2022-12-30)

-   feature: use common.type boolean for 1 bit enum instead of number
    import enum with one bit as common.type mixed and not strict as number
-   handling of iob ack improved for tunneling connections, see description

## 0.4.5 (2022-12-19)

-   bugfix in knx lib: make DPT-2 not an enum datatype

## 0.4.2 (2022-12-18)

-   bugfix: swap value for DPT-1 for enums

## 0.4.1 (2022-12-17)

-   bugfix: fix statup issue
-   feature: add support for more datatypes

## 0.4.0 (2022-12-15)

-   feature: support for Free and Two Level Group Address Style in addition to the existing Three Level support #320
-   feature: map knx datapoint type enconding to object common.states #313
-   debug message for send queue size

## 0.3.2 (2022-11-20)

-   feature: sync knx library
-   feature: sync with create adapter 0.2.3
-   feature: update to newer versions of dependant packages
-   feature: setting autoreadEnabled autoread
-   bugfix: allow alias generation with missing gateway configuration
-   bugfix in knx lib: keep correct order of send datagrams in case of burst write

## 0.2.7 (2022-08-26)

-   bugfix: fix issue with writing to DPT-19 object

## 0.2.6 (2022-07-09)

-   bugfix: fix filtering of addresses 1.1.1

## 0.2.5 (2022-06-22)

-   feature: option remove existing KNX objects that are not in import file

## 0.2.4 (2022-05-27)

-   feature: cleanly disconnect on shutdown, upgrade to knx lib 2.5.2

## 0.2.2 (2022-05-26)

-   feature: writing to bus l_data.con creates a ack on the iobroker object if successful (the knx conf flag unset) #133
-   bugfix: remove manual Physical KNX address dialog, use 0.0.0 instead
-   bugfix: remove error log when answering to GroupValueRead: #183
-   bugfix: improve warning logs on intended and unintended disconnects

## 0.1.25 (2022-04-18)

-   feature: datatype check for raw value
-   feature: check if knx is connected before usage
-   bugfix: if update ack after write, use correct timestamp and set adapter as user
-   bugfix: remove enless loop if event received before initialisation

## 0.1.24 (2022-03-31)

-   feature: support for latin1 charset in dpt16

## 0.1.23 (2022-03-19)

-   feature: change default regexp for alias
-   feature: new option to set ack flag when application writes to object
-   feature: supportes knx device scan in iobroker.discovery 2.8.0
-   bugfix: min max common object values only for number

## 0.1.22 (2022-02-26)

-   bufix: repair reception error

## 0.1.21 (2022-02-25)

-   feature: dont sent ack request in ldata.ind, this is disturbing clients if not filtered out by gateway
-   bugfix: reinit if event received before connection established to avoid deadlock
-   dependency:adapter core must be 2.6.0 or higher

## 0.1.20 (2022-02-19)

-   feature: add more dpts
-   bugfix: corrected some min max values
-   bugfix: some unhandeled dpts could not be received
-   bugfix: fix import
-   bugfix: min max values

## 0.1.19 (2022-02-11)

-   feature: allow usage of same KNX GAs in multiple objects
-   bugfix: less warnings in alias generation
-   bugfix: adapter reset after project import

## 0.1.18 (2022-01-30)

-   bugfix: issue #61 Alias dialog not working 1st time

## 0.1.17 (2022-01-29)

-   feature: more information in alias import dialog
-   feature: warning on startup if ga are inconsistent
-   fix: corrected object count statistics on startup

## 0.1.16 (2022-01-27)

-   feature: add back sentry
-   fix: stability alias generation
-   fix: better input settings plausibilization in admin
-   fix: reset after settings change was broken, dont reset for alias change

## 0.1.15 (2022-01-23)

-   feature: more sanity checks for gui
-   feature: issue #84, add openknx to discovery adapter
-   feature: issue #82, warnings on import of duplicate ga addresses, also check iob object for duplicates
-   fix: issue #87, added q interface to trigger GroupValue_Read, comments are overwritten in javascript adapter
-   fix: remove currently unused reference to sentry

## 0.1.14 (2022-01-08)

-   feature: autodetect the KNX IP interface parameters
-   feature: create warning if DPT of alias pair does not match
-   feature: create warning in log in case of possible data loss if gateway disconnects
-   feature: better gui for import status, newline per warning, count number of succeeding ga's
-   fix: local ip interface in admin was not taken
-   fix: default regexp for status ga's corrected to match common nomenclature

## 0.1.13 (2021-12-30)

-   bugfix: state.value of type object must be serialized
-   bugfix: alias algorithm error handling, takover more info to alias

## 0.1.12 (2021-12-30)

-   feature: improve alias status search algorithm, add units
-   feature: notify user after import if no DPT subtype is set
-   fix: library did not allow to write possible 0 values to certain dpts
-   fix: admin dialog ui fixes, better presentation of some warnings

## 0.1.11 (2021-12-28)

-   feature: remove more scene DPTs from default autoread
-   feature: sends GroupValue_Response on GroupValue_Read if configured
-   feature: admin dialog with option to generate aliases (beta)
-   feature: admin dialog reactivates after adapter reset
-   feature: add support for DPT-7.600
-   feature: show logs of knx library
-   fix: filter out logs with device address bus interactions
-   fix: filter ga names that are forbidden in IOB
-   fix: reply with GroupValue_Response on request, not with GroupValue_Write
-   fix: remove more scene DPTs from autoread

## 0.1.10 (2021-12-24)

-   fix: interface to write objects corrected

## 0.1.9 (2021-12-22)

-   fix: algorith to generate the iob objects improved
-   fix: min max removed for boolean
-   fix: ackqnowledgement handling
-   removed feature: override path of knx objects
-   feature: new logo

## 0.1.8

-   (tombox) feature: changed ui and many fixes
-   (boellner) feature: skip wrong initial disconnect warning
-   (boellner) feature: add translation
-   (boellner) doc: github ci pipleline, testing

## 0.1.6

-   (boellner) fix: missing dependencies

## 0.1.5

-   (boellner) feature: corrected adapter status info.connection (green, yellow, red indicator)
-   (boellner) fix: remove default fallback ip settings from stack to get error message on missing configuration
-   (boellner) fix: autoread
-   (boellner) fix: finding non knx objects int tree leading to problems on startup

## 0.1.3

-   (boellner) feature: state roles now set to best match for some elements, default is state
-   (boellner) feature: exclude scene dtc (trigger) from autoread
-   (boellner) doc: corrected warwings reported by https://adapter-check.iobroker.in/
-   (boellner) fix: improve ui of admin dialog
-   (boellner) fix: project import, now continue to write iob objects in case of incorrect input file

## 0.1.2

-   (boellner) doc: initial test release

## 0.0.19

-   (boellner) feature: display warning on ga import file errors

## 0.0.17

-   (boellner) feature: raw value handling, can now write and receive ga of unsupported DPT
-   (boellner) bugfix: setting onlyAddNewObjects fixed
-   (boellner) feature: adapter restart after import

## 0.0.14

-   (boellner) feature: import ga xml