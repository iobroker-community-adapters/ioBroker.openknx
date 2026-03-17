![Logo](../../admin/openknx.png)

# ioBroker.openknx

## Features

- Nativer .knxproj-Import (ETS4, ETS5, ETS6) mit Passwortunterstützung
- Read/Write/Transmit/Update Flags aus ETS-ComObjects
- DPT-Ableitung aus ComObjects, wenn GA-Level-DPT fehlt
- Raumzuordnung (enum.rooms) aus ETS-Gebäudestruktur
- XML-Gruppenadress-Import als Fallback
- KNX IP Secure Tunneling via .knxkeys-Keyfile oder Passwort
- Stabiler und zuverlässiger KNX-Stack powered by KNXUltimate
- Automatische Kodierung/Dekodierung von KNX-Datagrammen für die meisten DPTs, Raw-Zugriff für andere
- GroupValue Read, Write und Response Unterstützung
- Alias-Generierung zum Zusammenführen von Aktor- und Status-GAs
- Direct Link: beliebige ioBroker-States mit KNX-Gruppenadressen verbinden
- Unterstützt alle Gruppenadress-Stile (3-Ebenen, 2-Ebenen, frei)
- Freie Open Source, keine Cloud-Abhängigkeiten, läuft offline

## Installation

In der Adapterliste nach "openknx" suchen und über das + Symbol installieren.

## Adapterkonfiguration

![Einstellungen](img/setting.png)

Mit "Speichern & Schließen" oder "Speichern" wird der Adapter neu gestartet und die Änderungen übernommen.

### ETS-Projekt importieren (.knxproj oder .xml)

Der Importdialog akzeptiert sowohl **.knxproj** (empfohlen) als auch **.xml** Dateien.

#### .knxproj-Import (empfohlen)

Das ETS-Projekt direkt importieren. Dies liefert die vollständigsten Daten:

1. In ETS das Projekt speichern (Datei > Speichern). Die .knxproj-Datei befindet sich im ETS-Projektverzeichnis.
2. Die .knxproj-Datei im Adapter über den Importdialog hochladen.
3. Bei passwortgeschützten Projekten wird zur Eingabe des Passworts aufgefordert.
4. Der Import startet sofort und zeigt eine Zeitschätzung basierend auf der Dateigröße.

Vorteile gegenüber XML-Import:

- **Read/Write/Transmit/Update Flags** aus ComObjects (statt Standardwerte read=true, write=true)
- **DPT-Ableitung** aus ComObjects, wenn der GA kein DPT zugewiesen ist
- **Raumzuordnung** aus ETS-Gebäude-/Standortstruktur (erstellt enum.rooms automatisch)
- **Autoread-Flag** aus dem ComObject ReadOnInit-Flag abgeleitet
- Unterstützt ETS4-, ETS5- und ETS6-Projekte (auch passwortgeschützte)
- Zukünftige ETS-Versionen funktionieren automatisch -- kein Adapter-Update bei neuen ETS-Patches nötig

Nach einem erfolgreichen .knxproj-Import die Funktion "Aliase erstellen" verwenden, um Status-GAs mit den zugehörigen Aktor-GAs zu verknüpfen.

#### XML-Import (Fallback)

Falls .knxproj nicht verwendet werden kann, können Gruppenadressen aus ETS als XML exportiert werden:

![Gruppenadressen als XML in ETS exportieren](img/exportGA.png)

1. In ETS zu Gruppenadressen navigieren, Gruppenadress-Export wählen und XML-Export im neuesten Format auswählen.
   ETS4-Format wird nicht unterstützt, da es keine DPT-Informationen enthält.
2. Die ETS-Export-XML im Adapter über den Importdialog hochladen.
3. Der Import startet sofort und gibt nach Abschluss einen Statusbericht.

Hinweis: Bei unterschiedlichen DPT-Subtypen für eine GA und deren Kommunikationsobjekte verwendet ETS den niedrigsten DPT. Sicherstellen, dass alle Elemente den gewünschten Datentyp verwenden. Eine GA ohne DPT-Basistyp kann nicht importiert werden. ETS4-Projekte müssen in ETS5 oder höher konvertiert und der DPT an der GA gesetzt werden.

#### Import-Optionen

- **Vorhandene IOB-Objekte nicht überschreiben** -- bestehende Kommunikationsobjekte beim Import nicht überschreiben, nur neue hinzufügen.
- **Vorhandene IOB-Objekte entfernen, die nicht in der ETS-Importdatei enthalten sind** -- Objekte aus dem ioBroker-Baum löschen, die im ETS-Projekt nicht mehr existieren. Nützlich nach dem Entfernen von GAs in ETS.
- **Alle vorhandenen KNX-Objekte vor dem Import löschen (sauberer Neuimport)** -- alle KNX-Objekte zuerst löschen, dann frisch importieren. Verwenden bei Umstrukturierung des ETS-Projekts.

### KNX Secure

Der Adapter unterstützt KNX IP Secure Tunneling. Konfiguration im Tab "KNX Secure":

1. **KNX Secure aktivieren** -- Checkbox aktivieren.
2. **Keyfile (.knxkeys)** -- Den Inhalt der .knxkeys-Datei in das Textfeld einfügen. Die Datei wird in ETS unter Extras > KNX-Keyring exportieren erzeugt.
3. **Keyfile-Passwort** -- Das Passwort, das beim Export des Keyrings in ETS vergeben wurde.
4. **Alternativ: Tunnel-Benutzer-Passwort** -- Statt Keyfile kann auch direkt das Tunnel-Passwort eingegeben werden (aus der ETS-Projektkonfiguration des IP-Interfaces).
5. **Tunnel Interface IA** -- Optional die individuelle Adresse des Tunnel-Interfaces angeben (z.B. 1.1.254).
6. **Tunnel User ID** -- Standard ist 2. Nur ändern wenn mehrere Tunneling-Verbindungen am selben Interface konfiguriert sind.

### GA-Aliase und Migration

KNX-Geräte verwenden typischerweise separate GAs zum Steuern (Aktor) und für die Rückmeldung (Status). Anwendungen wie VIS-Widgets erwarten oft ein einzelnes Objekt für beides. Der Adapter kann diese automatisch zu ioBroker-Aliasen zusammenführen.

Das Regex-Muster für das Alias-Matching wird auch im **knx-Kompatibilitätsmodus** verwendet (Status-GAs intern verknüpfen statt Aliase zu erstellen).

- **Regex zum Erkennen von Status-GAs** -- Regulärer Ausdruck zur Identifikation der Status-GA anhand des Namens (z.B. Endungen wie "status", "rm", "Rückmeldung"). Derselbe Regex wird sowohl für die Alias-Generierung als auch für den knx-Kompatibilitätsmodus verwendet.
- **Minimale Ähnlichkeit** -- Wie streng der Matching-Algorithmus ähnliche Einträge filtert (0 = locker, 1 = exakt).
- **Alias-Pfad** -- Der Objektordner, in dem Aliase generiert werden (z.B. `alias.0.KNX`).
- **Gruppenbereich in Suche einbeziehen** -- Den vollen Pfad inkl. Gruppennamen zum Matching verwenden, nicht nur den GA-Namen.
- **Ziel-Namespace** -- Auf `knx.0` setzen, um die alten knx-Adapter-Objektpfade weiterzuverwenden. So funktionieren bestehende Skripte, VIS-Projekte und Dashboards ohne Änderungen weiter.

Weitere Informationen zu Aliasen: [ioBroker Alias-Dokumentation](https://www.iobroker.net/#de/documentation/dev/aliases.md)

### Verbindungseinstellungen

- **KNX Gateway IP** -- IP-Adresse des KNX IP Gateways.
- **Port** -- Normalerweise 3671.
- **Lokale IPv4-Netzwerkschnittstelle** -- Die Schnittstelle, die mit dem KNX IP Gateway verbunden ist.
- **Erkennen** -- Sucht alle verfügbaren KNX IP Gateways auf der gewählten Netzwerkschnittstelle.
- **Protokoll** -- UDP-Tunneling, TCP-Tunneling oder Multicast-Routing.
- **Physikalische KNX-Adresse** -- Die individuelle Adresse des Adapters auf dem KNX-Bus.

### Erweiterte Einstellungen

- **Minimale Sendeverzögerung zwischen zwei Frames [ms]** -- Schützt den KNX-Bus vor Überflutung. Wert erhöhen bei DISCONNECT_REQUEST-Fehlern im Log.
- **common.type boolean für 1-Bit-Enum statt number** -- Boolean-Typ in ioBroker-Objekten für DPT-1 statt number verwenden.
- **KNX-Werte beim Start auslesen** -- Alle Objekte mit Autoread-Flag werden bei der ersten Verbindung nach Adapter-Start vom Bus gelesen.
- **Keine Warnung bei unbekannten KNX-Gruppenadressen** -- Warnmeldungen im Log unterdrücken bei Telegrammen für unbekannte GAs.

### Gruppenadress-Stil

Definiert die GA-Darstellung in ETS. Alle 3 Stile werden unterstützt und für die Speicherung ins 3-Ebenen-Format konvertiert:

| Stil | Name | Beispiel |
| --- | --- | --- |
| 3-Ebenen | Haupt-/Mittel-/Untergruppe | 1/3/5 |
| 2-Ebenen | Hauptgruppe/Untergruppe | 1/25 |
| Frei | Untergruppe | 300 |

Die kombinierte GA und Gruppenname muss im ioBroker-Objektbaum eindeutig sein.

## Migration vom knx-Adapter

Der einfachste Weg: In den Alias-Einstellungen den **Ziel-Namespace** auf `knx.0` setzen. Alle bestehenden Skripte, VIS-Projekte und Dashboards verwenden dann automatisch die openknx-Objekte -- ohne manuelles Suchen/Ersetzen.

Falls das nicht möglich ist, müssen Referenzen auf `knx.0.` in den jeweiligen Tools manuell durch `openknx.0.` ersetzt werden (Node Red Flows, VIS-Projekte, Skripte, Grafana-Dashboards jeweils exportieren/importieren).

## KNX-Bus-Konzepte

### ACK-Flags bei Tunneling-Verbindungen

Anwendungen sollen das ACK-Flag nicht setzen. Der Adapter setzt ACK wenn Daten bestätigt werden:

| GA ist | Gerät mit R-Flag | Gerät ohne R-Flag | nicht verbunden |
| --- | --- | --- | --- |
| Anwendung sendet GroupValue_Write | ACK | ACK | kein ACK |
| Anwendung sendet GroupValue_Read | ACK | kein ACK | kein ACK |

### GroupValue Write

Wird durch Schreiben eines Kommunikationsobjekts in ioBroker ausgelöst. Auch ausgelöst wenn ein Write-Frame auf dem Bus empfangen wird.

### GroupValue Read

Kann durch Schreiben mit speziellem Kommentar oder Quality-Flag ausgelöst werden:

```javascript
setState(myState, { val: false, ack: false, c: "GroupValue_Read" });
setState(myState, { val: false, ack: false, q: 0x10 });
```

Hinweis: Die Kommentar-Methode funktioniert nicht mit dem JavaScript-Adapter. Stattdessen `q: 0x10` verwenden.

### GroupValue Response

Wenn `native.answer_groupValueResponse` auf true gesetzt ist, antwortet der Adapter mit einer GroupValue_Response auf einen empfangenen GroupValue_Read. Nur ein Objekt auf dem Bus sollte dieses Flag gesetzt haben.

### Zuordnung zu KNX-Flags

Beim .knxproj-Import werden die Flags direkt aus den ETS-ComObjects gelesen. Beim XML-Import werden sinnvolle Standardwerte gesetzt.

| Flag | Adapter-Verwendung (.knxproj) | Adapter-Verwendung (XML-Import) |
| --- | --- | --- |
| C: Kommunikation | immer gesetzt | immer gesetzt |
| R: Lesen | object common.read | Standard true |
| T: Übertragen | object common.update | Standard false |
| S: Schreiben | object common.write | Standard true |
| A: Aktualisieren | object native.update | Standard false |
| I: Initialisierung | object native.autoread | vom DPT abgeleitet |

`native.answer_groupValueResponse` muss bei Bedarf manuell gesetzt werden.

## ioBroker-Objektbeschreibung

Der GA-Import erzeugt eine Ordnerstruktur nach Schema Hauptgruppe/Mittelgruppe. Jede Gruppenadresse wird ein Objekt:

```json
{
    "_id": "pfad.und.name.zum.objekt",
    "type": "state",
    "common": {
        "desc": "Basetype: 1-bit value, Subtype: switch",
        "name": "Aussen Melder Licht schalten",
        "read": true,
        "role": "state",
        "type": "boolean",
        "unit": "",
        "write": true
    },
    "native": {
        "address": "0/1/2",
        "answer_groupValueResponse": false,
        "autoread": true,
        "bitlength": 1,
        "dpt": "DPT1.001",
        "encoding": { "0": "Off", "1": "On" },
        "force_encoding": "",
        "signedness": "",
        "valuetype": "basic"
    }
}
```

Rollen werden vom DPT abgeleitet (z.B. switch, level, date). Autoread wird für Trigger-DPTs wie Szenennummern auf false gesetzt.

## DPT-Referenz

Unterstützte DPTs: 1-22, 26, 28, 29, 213, 222, 232, 235, 237, 238, 242, 249, 251, 275.
Nicht unterstützte DPTs werden als Hex-Strings (Rohdaten) geschrieben.

| KNX DPT | Datentyp | Bemerkung |
| --- | --- | --- |
| DPT-1 | boolean | 1 Bit, false/true |
| DPT-2 | object | {"priority":0/1, "data":0/1} |
| DPT-3 | object | {"decr_incr":0/1, "data":0..7} |
| DPT-4 | string | Ein 8-Bit-Zeichen |
| DPT-5 | number | 8-Bit unsigned (0..255); DPT-5.001: 0..100%, DPT-5.003: 0..360° |
| DPT-6 | number | 8-Bit signed (-128..127) |
| DPT-7 | number | 16-Bit unsigned |
| DPT-8 | number | 2-Byte signed (-32768..32767) |
| DPT-9 | number | 2-Byte Gleitkomma |
| DPT-10 | Date | Zeit (hh:mm:ss + Wochentag), Datumsteil ignorieren |
| DPT-11 | Date | Datum (dd/mm/yyyy), Zeitteil ignorieren |
| DPT-12 | number | 4-Byte unsigned |
| DPT-13 | number | 4-Byte signed |
| DPT-14 | number | 4-Byte Gleitkomma |
| DPT-15 | number | 4 Byte (Zugangsdaten) |
| DPT-16 | string | 14-Zeichen ASCII/ISO-8859-1 String |
| DPT-17 | number | Szenennummer, nicht per Autoread gelesen |
| DPT-18 | object | {"save_recall":0/1, "scenenumber":0..63}, nicht per Autoread |
| DPT-19 | Date | Datum + Zeit, Qualitäts-Flags nicht unterstützt |
| DPT-20 | number | 1-Byte Enum |
| DPT-21 | object | {"outOfService":bool, "fault":bool, "overridden":bool, ...} |
| DPT-22 | object | RHCC Status |
| DPT-26 | string | Hex, DPT_SceneInfo, nicht per Autoread gelesen |
| DPT-28 | string | Unicode UTF-8 String, variable Länge |
| DPT-29 | string | 8-Byte signed (als String wegen JS-Zahlengrenzen) |
| DPT-213 | object | 4-Byte Zeitraum (Stunden, Minuten, Sekunden) |
| DPT-222 | object | 3x 2-Byte Gleitkomma |
| DPT-232 | object | {red:0..255, green:0..255, blue:0..255} |
| DPT-235 | object | Tarif-Wirkenergiezähler |
| DPT-237 | object | DALI-Diagnose |
| DPT-238 | object | Szene-Konfiguration, nicht per Autoread gelesen |
| DPT-242 | object | xy-Farbe (CIE 1931) |
| DPT-249 | object | Farbtemperatur-Übergang |
| DPT-251 | object | RGBW-Farbe |
| DPT-275 | object | Temperatur-Sollwertverschiebung |
| andere | string | Hex-String (Rohdaten), z.B. "0102feff" |

Hinweis zu Datum/Zeit-DPTs: JavaScript und KNX haben unterschiedliche Basistypen. DPT-10 liefert ein JS-Date-Objekt, bei dem der Datumsteil ignoriert werden muss. DPT-11 liefert ein JS-Date, bei dem der Zeitteil zu ignorieren ist.

## Node Red Beispiel

Komplexer Datentyp DPT-2 über Function-Node verbunden mit einem ioBroker-Out-Node:

```javascript
msg.payload = { priority: 1, data: 0 };
return msg;
```

## Log-Level

Expertenmodus aktivieren, um zwischen Log-Leveln wechseln zu können. Standard ist info.
![Loglevel](img/loglevel.png)

## Monitoring

OpenKNX verwendet sentry.io zur Fehlerverfolgung (Daten an ioBroker-Sentry-Server in Deutschland, pseudonymisiert).
Buslast wird im Objekt `info.busload` geschätzt.

## Einschränkungen

- Nur IPv4 wird unterstützt

## FAQ

**Autoread löst Aktoren auf dem Bus aus**
In ETS prüfen, ob Gruppenobjekte an der betreffenden GA das R/L-Flag gesetzt haben. Konsumenten eines Signals sollten dieses Flag nicht haben. Autoread für das betroffene Objekt deaktivieren.

**DISCONNECT_REQUEST beim Start**
Minimale Sendeverzögerung zwischen zwei Frames erhöhen.

**Wird Secure Tunneling unterstützt?**
Ja. KNX IP Secure Tunneling wird über .knxkeys-Keyfile oder Passwort unterstützt.
