# OpenKairo Mining ⛏️ — Home Assistant Integration

[![Version](https://img.shields.io/badge/Version-1.4.6-0bc4e2.svg?style=for-the-badge)](https://github.com/openkairo/openKairo_Mining)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Integration-41bdf5.svg?style=for-the-badge)](https://home-assistant.io)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://hacs.xyz)
[![Powered by OpenKairo](https://img.shields.io/badge/Powered%20by-OpenKairo-0bc4e2.svg?style=for-the-badge)](https://openkairo.de)

Verwandle deinen Home Assistant in eine professionelle **Mining-Schaltzentrale**. OpenKairo Mining steuert deine ASICs vollautomatisch — basierend auf PV-Überschuss, Raumtemperatur, Batteriestatus und Bitcoin-Netzwerkdaten.

---

## 🧭 Welchen Modus brauche ich?

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    OpenKairo Mining — Modi                          │
├──────────────────┬──────────────────────────────────────────────────┤
│  ☀️  PV-Überschuss │ Miner läuft wenn genug Solar-Überschuss da ist. │
│                  │ Leistung folgt automatisch dem Ertrag (Live-     │
│                  │ Tracking). Ideal für Balkonkraftwerk & Dach-PV.  │
├──────────────────┼──────────────────────────────────────────────────┤
│  🔋  SOC          │ Miner läuft wenn Hausakku genug geladen ist.     │
│                  │ Entlädt den Akku kontrolliert auf Zielwert.      │
├──────────────────┼──────────────────────────────────────────────────┤
│  🔥  Heizung      │ Miner als Raumheizung. Schaltet bei Kälte ein,  │
│                  │ bei Wunschtemperatur wieder aus.                  │
├──────────────────┼──────────────────────────────────────────────────┤
│  🏝️  Offgrid      │ Dreistufige SOC-Kurve für Inselanlagen.          │
│                  │ Volle Kontrolle über Lade- und Entladeschwellen. │
├──────────────────┼──────────────────────────────────────────────────┤
│  🤖  AI Entladen  │ KI berechnet wann der Miner nachts starten muss, │
│                  │ damit der Akku morgens den Ziel-SOC erreicht.    │
├──────────────────┼──────────────────────────────────────────────────┤
│  🖐️  Manuell      │ Ein/Aus per Hand oder HA-Automatisierung.        │
└──────────────────┴──────────────────────────────────────────────────┘
```

---

## 🚀 Schnellstart

### 1. Installation via HACS

1. **HACS** → **Integrationen** → drei Punkte → **Benutzerdefinierte Repositories**
2. URL: `https://github.com/openkairo/openKairo_Mining` | Kategorie: **Integration**
3. Herunterladen → Home Assistant **neu starten**

### 2. Zentrale einrichten

1. **Einstellungen** → **Geräte & Dienste** → **Integration hinzufügen** → *OpenKairo Mining*
2. Wähle **"Dashboard (Zentrale) einrichten"**

### 3. Miner hinzufügen

1. Erneut **Integration hinzufügen** → *OpenKairo Mining*
2. IP-Adresse des Miners eingeben
3. Miner erscheint automatisch im Dashboard

---

## 📖 Modus-Anleitungen

### ☀️ PV-Überschuss (wenige Klicks)

Der einfachste Weg Solar-Überschuss zu nutzen.

**Minimale Einrichtung:**

1. Miner bearbeiten → Modus: **PV-Überschuss**
2. **PV-Sensor** wählen (z.B. `sensor.pv_erzeugung_watt`)
3. **Einschalten ab** und **Ausschalten unter** Watt setzen (z.B. 800W / 400W)
4. Speichern — fertig

**Für Leistungs-Tracking** (Miner Watt folgt dem Überschuss):

- Zusätzlich **Power-Limit Sensor** unter *Sensoren & Steuerung* setzen
- → Grüner Block "⚡ Leistungs-Tracking aktiv" erscheint im Formular
- Kein weiteres Einrichten nötig — der Miner skaliert automatisch

**Optionen:**

- 🔋 **Batterie-Unterstützung**: Miner läuft auch bei Wolken weiter, solange Akku ≥ Min-SOC
- 🏷️ **Günstiger Netzpreis** (Tibber/Awattar): Mining erlauben wenn Strom günstig ist

---

### 🔋 SOC-Modus

Miner läuft wenn die Hausbatterie ausreichend geladen ist.

**Einrichtung:**

1. Modus: **Batterie SOC**
2. **Batterie-Sensor** wählen (z.B. `sensor.zendure_soc`)
3. **Einschalten ab** (z.B. 80%) und **Ausschalten unter** (z.B. 30%) setzen

**Optionale Leistungsskalierung:**

- *Automatische Nachskalierung (SOC/Heizung)* aktivieren
- Leistung skaliert dann proportional zum SOC

---

### 🔥 Heizmodus

Den Miner als Raumheizung betreiben.

**Einrichtung:**

1. Modus: **Heiz-Modus**
2. **Raumtemperatur-Sensor** wählen → aktueller Wert wird sofort angezeigt
3. **Einschalten unterhalb** (z.B. 20°C) und **Ausschalten oberhalb** (z.B. 22°C) setzen

**Empfehlung Hysterese:** Mindestens 1–2°C zwischen Ein- und Ausschaltschwelle um häufiges Schalten zu vermeiden.

**Mit Batterie-Schutz:**

- 🔋 *Batterie-Unterstützung erlauben* aktivieren
- Batterie-Sensor wählen + Mindest-SOC setzen (Standard: 50%)
- → Miner heizt nur wenn Akku noch ausreichend geladen ist

---

### 🤖 AI Akku-Optimierer

Die KI berechnet wie lange der Miner nachts laufen kann, damit der Akku morgens früh genau den Zielwert erreicht.

**Einrichtung:**

1. Modus: **AI Akku-Optimierer**
2. **Hausakku SOC-Sensor** wählen → aktueller SOC wird sofort angezeigt
3. **Akku-Kapazität** in kWh eintragen (z.B. 10)
4. **Hausverbrauch-Sensor** wählen (der Sensor der den Nachtverbrauch des Hauses zeigt)
5. **Ziel-Uhrzeit** setzen (z.B. 07:00) — bis wann soll der Akku den Zielwert erreicht haben?
6. **Ziel-SOC** setzen (z.B. 10%) — wie viel soll morgens früh noch im Akku sein?

**Optionale Wetter-Optimierung:**

- Bei vorhergesagter Sonne: Akku darf tiefer entladen werden
- PV-Anlagengröße (kWp) eintragen
- Standort wird automatisch aus HA übernommen (oder manuell Lat/Lon eingeben)

---

### 🚀 Soft-Start / Soft-Stop

Schont Netzteile durch mehrstufiges Hoch- und Runterfahren.

**Einrichtung:**

1. *Soft-Start aktivieren* und/oder *Soft-Stop aktivieren*
2. **⚡ Auto** drücken → Start- und Stopp-Abstufungen werden automatisch aus Min./Max. Leistung berechnet
3. **Intervall** setzen (z.B. 60 Sekunden pro Stufe)

> **Hinweis für BraiinsOS-Nutzer:** Stufenwerte werden automatisch an den erlaubten Hardware-Bereich der Firmware angepasst. Liegt eine Stufe unterhalb des BraiinsOS-Minimums, wird sie auf das Minimum angehoben und im HA-Log gewarnt.

---

### 🛡️ Standby-Watchdog

Erkennt wenn ein Miner eingefroren ist (z.B. Hashrate = 0 aber Stromverbrauch > 0) und greift automatisch ein.

**Einrichtung:**

1. *Watchdog aktivieren*
2. **Überwachter Sensor** wählen:
   - *Verbrauch* → überwacht den Stromverbrauch-Sensor
   - *Power-Limit* → überwacht den Power-Limit Sensor
3. **Standby-Grenzwert** setzen (z.B. 100W — darunter gilt Miner als hängend)
4. **Wartezeit** setzen (z.B. 10 Minuten — erst dann wird die Aktion ausgelöst)
5. **Aktion** wählen:
   - `off` — Miner bleibt aus bis PV/SOC-Regel greift (Standard)
   - `toggle` — Steckdose kurz aus/an
   - `reboot` — Hardware-Reboot per API
   - `restart_backend` — Nur Mining-Software neu starten

**Status-Anzeige in der Miner-Karte:**

- 🟡 **Watchdog Countdown: noch X min** — Miner läuft, aber Leistung ist zu niedrig. Watchdog feuert wenn Zeit abläuft.
- ⬜ **Watchdog Cooldown: noch X min** — Aktion wurde bereits ausgelöst. Neuer Countdown startet erst nach Cooldown.

---

## 📊 HA-Sensoren

Pro Miner werden automatisch **5 Sensor-Entitäten** in Home Assistant angelegt:

| Entität | Beschreibung |
| --- | --- |
| `sensor.*_session_runtime` | Laufzeit der aktuellen Session |
| `sensor.*_today_runtime` | Gesamtlaufzeit heute |
| `sensor.*_session_energy` | Energieverbrauch diese Session (Wh) |
| `sensor.*_today_energy` | Energieverbrauch heute (Wh) |
| `sensor.*_total_starts` | Gesamte Einschaltvorgänge |

Diese Sensoren können in HA-Dashboards, Automationen und Energie-Tracking genutzt werden.

---

## 🪵 Logs & Debugging

Jede Engine-Entscheidung wird protokolliert und ist im **Logs-Tab** des Dashboards sichtbar.

Log-Einträge enthalten immer den Grund:

```text
[14:22:01] ⚡ Antminer S19: Soft-Start gestartet. (SOC 78% >= 70%)
[14:28:44] 🎢 Antminer S19: Soft-Start abgeschlossen.
[18:05:11] 💤 Antminer S19 wird ausgeschaltet. (SOC 29% <= 30%)
[18:05:12] 🎢 Antminer S19: Soft-Stop gestartet. (SOC 29% <= 30%)
```

Die Miner-Karte zeigt zusätzlich eine **"Letzte Entscheidung"** Zeile direkt unter den Status-Badges — z.B. `(PV 950W >= 800W)` — ohne dass man in den Log-Tab wechseln muss.

---

## 🌐 Fleet-Management (Mehrere Miner)

Bei mehreren Minern kann ein **globales Power-Budget** gesetzt werden:

1. **Einstellungen** im Dashboard → `Fleet Max Power (W)` setzen
2. Jeden Miner mit einer **Priorität** versehen (1 = höchste Priorität)
3. → Der Engine verteilt die Leistung automatisch. Miner mit niedriger Priorität werden zuerst gedrosselt wenn das Budget überschritten wird.

---

## 📡 MQTT (Optional)

Status-Daten an einen MQTT-Broker senden:

1. **Einstellungen** → `MQTT Prefix` setzen (z.B. `openkairo/mining`)
2. Daten werden automatisch unter `{prefix}/{miner_name}/...` veröffentlicht

---

## 🔧 Unterstützte Hardware

| Hersteller | Modelle |
| --- | --- |
| **Bitmain Antminer** | S9, S19, S19j Pro, S21, S21 Pro |
| **Bitmain Whatsminer** | M30S, M50, M60 |
| **Canaan Avalon** | A1246, A1366 |
| **Bitaxe** | Ultra, Gamma, Supra (alle ESP32-basierten) |
| **FutureBit** | Apollo BTC |
| **IceRiver** | KS0, KS1, KS3 |
| **NerdMiner** | v1, v2 |

---

## 📋 Changelog

### v1.4.6 — Stabilitäts-Update: Engine-Schutz, Config-Lock, Switch-Rework

- **Unavailable-Switch-Guard** — Engine schickt keine turn_on-Befehle mehr an unavailable Entities (Zigbee-Dropout etc.) — verhindert Log-Spam und falsches total_starts-Hochzählen
- **Config-Lock** — asyncio.Lock serialisiert sync_with_config-Läufe bei Mehrminer-Setup — kein Miner geht mehr beim gleichzeitigen HA-Start verloren
- **Fehlerbehandlung sync_with_config** — Exceptions werden jetzt geloggt statt als unhandled Task zu verschwinden
- **Switch ohne API-Calls** — `async_turn_on/off` führen keine Miner-API-Calls mehr durch — kein Hashboard-Reset durch den Engine-Loop
- **Switch always available** — Switch-Entity ist immer verfügbar, damit Engine-Befehle nie von HA gefiltert werden
- **battery_hysteresis entfernt** — SOC-Schwellenwert wird direkt verwendet, kein versteckter Puffer mehr
- **UI** — „Sicherheit & Grenzen"-Panel entfernt (max_temp, max_runtime, min_off_time)

### v1.4.5 — Config Backup + Miner-Vorlagen + Watchdog Badge + State-Persistenz

- **Config Backup** — vollständiges Export/Import der Konfiguration (Einstellungen-Tab)
- **Miner-Vorlagen** — Regel-Einstellungen als JSON exportieren (📋 pro Miner), in andere Miner importieren (📂 Vorlage laden) oder direkt übernehmen (Dropdown "Einstellungen übernehmen von"); ideal für Community-Sharing
- **Watchdog Status-Badge** — Miner-Karte zeigt Countdown 🟡 und Cooldown ⬜ direkt an (`watchdog_remaining` / `watchdog_cooldown_remaining`)
- **Bugfix** — `"wird ausgeschaltet"` wurde jeden Tick geloggt obwohl Miner schon aus war — Power-Sensor-Fallback überschrieb Switch-Off-Zustand
- **State-Persistenz** — Tagesstatistiken, Watchdog-Cooldown und Laufzeit-Timestamps überleben einen HA-Neustart

### v1.4.4 — Watchdog Default Fix

- `"off"` als Standard-Watchdog-Aktion — gilt für neue Miner und als Engine-Fallback für ältere Configs

### v1.4.3 — Watchdog Action Fix

- Watchdog-Aktion war nicht konfigurierbar — Selector im Formular fehlte komplett (`#16`)
- Neue `"off"` Aktion — Miner bleibt aus bis PV/SOC-Regel greift (`#16`)

### v1.4.2 — Watchdog Hotfix

- Watchdog feuerte dauerhaft in kurzen Abständen statt einmalig — Cooldown nach Aktion eingebaut (`#17`)

### v1.4.1 — Community Bugfix Release

- Soft-Start blieb dauerhaft in Stufe 1 stecken — behoben (`#13`)
- BraiinsOS: `power_target out of range` Fehler — Hardware-Min/Max wird jetzt automatisch aus HA Entity gelesen (`#14`)
- iPad: Sensor-Picker Dropdown öffnete hinter anderen Elementen — behoben (`#10`)
- Panel wurde nach Tablet-Idle leer — `connectedCallback` behebt das (`#2`)
- Solar-Vorhersage Anzeige fehlte bei älteren Miner-Configs — behoben (`#11`)
- Logging: Soft-Start/Stop zeigt jetzt den Entscheidungsgrund. Miner-Karte zeigt "Letzte Entscheidung" direkt (`#9`)

### v1.4.0 — Stability & Zero-Click Automation

- Kritische Engine-Bugfixes (Empty-Switch Bug, Watchdog-Aktion nie ausgeführt)
- PV Live-Tracking ohne Opt-In
- Soft-Start Auto-Button, Live-Sensor-Werte im Formular
- 5 neue HA-Sensoren pro Miner

### v1.3.21 — The Intelligence Update

- AI Akku-Optimierer, Heizmodus, Mobile Dashboard, Wetter-Integration

---

## 🚨 Sicherheitshinweis

> [!WARNING]
> Der Betrieb von ASIC-Minern als Heizung erfordert eine stabile thermische Umgebung. Stelle sicher, dass die Abwärme sicher abgeführt wird und Brandmelder in den betroffenen Räumen aktiv und gewartet sind.

---

## ☕ Projekt unterstützen

OpenKairo ist ein Community-Projekt. Wenn dir die Integration hilft, freuen wir uns über deine Unterstützung:

- **PayPal**: [info@low-streaming.de](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=info@low-streaming.de&currency_code=EUR&source=url)
- **Bitcoin**: `37KAus3ABc6krJ5T4jZyLKVB3uzbfQZGWD`

---

## 🗺️ Roadmap

- [ ] **Miner-Gruppen** — Mehrere Miner als logische Einheit steuern
- [ ] **Advanced MQTT Bridge** — Erweiterte Datenpunkte für externe Dashboards
- [ ] **History & Analytics** — Langzeit-Aufzeichnung der Mining-Erträge
- [ ] **ESP32 Wallpanel v2** — Neue PlatformIO-Firmware für Wand-Displays
- [ ] **Auto-Tuning Finder** — Firmware-spezifische Effizienz-Profile

---

**Powered by OpenKairo** | [openkairo.de](https://openkairo.de) | v1.4.6
