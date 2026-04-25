# OpenKairo Mining 🚀 — Das Ultimative "Command Center" v1.3.20

[![OpenKairo](https://img.shields.io/badge/Powered%20by-OpenKairo-0bc4e2.svg?style=for-the-badge)](https://openkairo.de)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Integration-41bdf5.svg?style=for-the-badge)](https://home-assistant.io)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://hacs.xyz)

Verwandle deinen Home Assistant in eine professionelle **Mining-Schaltzentrale**. Mit **OpenKairo Mining** steuerst du deine ASICs intelligent basierend auf PV-Überschuss, Raumtemperatur, Batteriestatus und Bitcoin-Netzwerkdaten.

---

## 💎 Highlights der v1.3.20 - "The Intelligence Update"

Dieses Update bringt smarte Logik und maximale Kontrolle in dein Setup.

### 🤖 AI Akku-Optimierer & SOC-Intelligenz
Nutze künstliche Intelligenz, um dein Mining nachts perfekt auf deinen Hausverbrauch und die Solar-Prognose abzustimmen. Mit der neuen **3-Punkt SOC-Kurve** hast du volle Kontrolle über das Leistungs-Skalierung deiner Hardware in Offgrid-Systemen.

### 🔥 Heiz-Modus (Mining as a Heater)
Nutze deinen Miner als intelligente Heizung. Schalte deine Hardware basierend auf der Raumtemperatur und schone gleichzeitig deine Batterie durch den optionalen **SOC-Wächter**. Miner schalten nur dann für Wärme ein, wenn auch genug Strom im Akku vorhanden ist.

### 📱 Optimiert für die Hosentasche
Das gesamte Dashboard wurde für die mobile Nutzung überarbeitet. 
- **Flüssiger Ticker**: Bitcoin-Fees und Markt-Daten immer im Blick.
- **Kompakte Karten**: Alle wichtigen Stats auf einem Screen.
- **Beta-Labels**: Volle Transparenz über den Status neuer Features.

### ⚡ Native Hardware-Anbindung (pyasic)
- **Plug & Play**: Miner per IP hinzufügen – fertig.
- **Echtzeit-Steuerung**: Power-Limits (Watt), Reboots und Modus-Wechsel direkt aus dem Interface.
- **Breiter Support**: Antminer (S9, S19, S21), Whatsminer, Avalon, Bitaxe, IceRiver und NerdMiner.

---

## 🗺️ Roadmap (Was als nächstes kommt)

Wir entwickeln OpenKairo ständig weiter. Hier ist ein Ausblick auf die kommenden Features:

- [ ] **Miner-Gruppen**: Steuerung mehrerer Miner als logische Einheit (z.B. "Ganze Etage einschalten").
- [ ] **Advanced MQTT Bridge**: Erweiterte Datenpunkte für externe Automatisierungen und Dashboards.
- [ ] **History & Analytics**: Langzeit-Aufzeichnung der Mining-Erträge und Stromeffizienz direkt in der Integration.
- [ ] **ESP32 Wallpanel v2**: Volle Unterstützung für die neue PlatformIO-Firmware für Wand-Displays.
- [ ] **Auto-Tuning Finder**: Unterstützung für Firmware-spezifische Profile zur Effizienz-Maximierung.

---

## 🛠️ Installation & Einrichtung

### 1. Installation via HACS
1. In Home Assistant: **HACS** > **Integrationen** > drei Punkte > **Benutzerdefinierte Repositories**.
2. URL: `https://github.com/openkairo/openKairo_Mining` > Kategorie: **Integration** hinzufügen.
3. Herunterladen und Home Assistant **neu starten**.

### 2. Dashboard & Miner einrichten
1. Gehe zu **Geräte & Dienste** -> **Integration hinzufügen** -> "OpenKairo Mining".
2. Erstelle zuerst das **Dashboard (Zentrale)**.
3. **Miner hinzufügen**: Wähle erneut "Integration hinzufügen" -> "OpenKairo Mining" und gib die **IP-Adresse** deines Miners ein.

---

## 🚨 Sicherheitshinweis
> [!WARNING]
> Der Betrieb von ASIC-Minern als Heizung erfordert eine stabile thermische Umgebung. Stelle sicher, dass die Abwärme sicher abgeführt wird und die Brandmeldung in den betroffenen Räumen aktiv ist.

---

## ☕ Projekt unterstützen
OpenKairo ist ein leidenschaftliches Community-Projekt. Wenn dir das Dashboard gefällt, freuen wir uns über deine Unterstützung!

- **PayPal**: [info@low-streaming.de](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=info@low-streaming.de&currency_code=EUR&source=url)
- **Bitcoin**: `37KAus3ABc6krJ5T4jZyLKVB3uzbfQZGWD`

---
**Powered by OpenKairo** | [openkairo.de](https://openkairo.de)
