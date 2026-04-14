# OpenKairo Mining 🚀 — Das Ultimative "Command Center" v1.3.5

[![OpenKairo](https://img.shields.io/badge/Powered%20by-OpenKairo-0bc4e2.svg?style=for-the-badge)](https://openkairo.de)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Integration-41bdf5.svg?style=for-the-badge)](https://home-assistant.io)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://hacs.xyz)

Verwandle deinen Home Assistant in eine professionelle **Mining-Schaltzentrale**. Mit **OpenKairo Mining** steuerst du deine ASICs intelligent basierend auf PV-Überschuss, Batteriestatus und Bitcoin-Netzwerkdaten.

---

## 💎 Highlights der v1.3.5

Das neueste Update bringt volle Kompatibilität mit den neuesten Home Assistant Core-Versionen und führt ein völlig neues Event-Protokoll ein.

> [!TIP]
> **Neues "Logs" Tab**: Alle automatisierten Schaltvorgänge (Ramping, PV-Überschuss, Ausschalten, Watchdog-Fehler) werden nun in einem zentralen "Logs"-Tab im Dashboard inklusive Farbcodes übersichtlich chronologisch dokumentiert. Die Historie fasst nun die letzten 100 Aktionen umfänglich im RAM.

### 🎨 Ultra-Premium Design Engine
Wähle aus exklusiven Design-Presets direkt im Dashboard:
| Theme | Stil | Besonderheit |
| :--- | :--- | :--- |
| **Midnight & Atlantis** | Deep Blue | Klassischer High-Tech Look |
| **Matrix & Solar** | Cyberpunk | Maximaler Kontrast & Retro-Vibe |
| **Lava Field** | Dynamic Red | Energie pur 🔥 |
| **Gladbeck Edition** | Brand Overdrive | Spezial-Design für **Solarmodule Gladbeck** ☀️ |

### ⚡ Native Hardware-Anbindung
Vergiss komplizierte Setups. OpenKairo Mining arbeitet jetzt vollständig **nativ via pyasic**.
- **Direkt-Anbindung**: Miner einfach per IP-Adresse hinzufügen.
- **Volle Kontrolle**: Power-Limits, Reboots und Modus-Wechsel direkt aus HA.
- **Kompatibilität**: Unterstützt Antminer (S9, S19, S21), Whatsminer, Avalon, Bitaxe und viele mehr.

### 🛡️ Hardware-Wächter 2.0 (Dual-Socket) & Ramping
Maximale Sicherheit für deine Hardware:
- **Sanfter Anlauf (Ramping)**: Dein Miner fährt stufenweise hoch (z.B. 100W -> 500W -> 1000W), anstatt sofort die volle Last zu ziehen und dein Netzteil zu belasten.
- **Frozen Detection**: Erkennt aufgehängte Miner am verringerten Stromverbrauch.
- **Dual-Power Support**: Unterstützung für Miner mit **zwei Netzkabeln**. Beide Steckdosen werden synchron geschaltet.

---

## 🛠️ Installation & Einrichtung

### 1. Installation via HACS
1. In Home Assistant: **HACS** > **Integrationen** > drei Punkte > **Benutzerdefinierte Repositories**.
2. URL: `https://github.com/low-streaming/openkairo_minig` (bzw. das korrekte Repo) > Kategorie: **Integration** hinzufügen.
3. Herunterladen und Home Assistant **neu starten**.

### 2. Dashboard & Miner einrichten
1. Gehe zu **Geräte & Dienste** -> **Integration hinzufügen** -> "OpenKairo Mining".
2. Erstelle zuerst das **Dashboard (Zentrale)**.
3. **Miner hinzufügen**: Wähle erneut "Integration hinzufügen" -> "OpenKairo Mining" und gib die **IP-Adresse** deines Miners ein.

---

## 🚨 Troubleshooting & HA Core >= 2024.10 Kompatibilität

> [!IMPORTANT]
> **Update v1.3.5:** Dieses Release beinhaltet weitreichende Patches für neuere Home Assistant-Editionen.
> - **500 Config Flow Error Fixed**: Problem mit fehlendem `FlowResult` in Home Assistant > 2024.8 beseitigt (`ConfigFlowResult` wird nun dynamisch verwendet).
> - **Pyasic Installation Fixed**: Mit der Einführung des `uv` Paketmanagers in HA wurden Pre-Release Abhängigkeiten geblockt. Das `betterproto==2.0.0b7` Problem wurde behoben und `pyasic` lädt nun wieder sauber.

---

## ☕ Projekt unterstützen
OpenKairo ist ein leidenschaftliches Community-Projekt. Wenn dir das Dashboard gefällt, freuen wir uns über deine Unterstützung!

- **PayPal**: [info@openkairo.de](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=info@openkairo.de&currency_code=EUR&source=url)
- **Bitcoin**: `37KAus3ABc6krJ5T4jZyLKVB3uzbfQZGWD`

---
**Powered by OpenKairo** | [openkairo.de](https://openkairo.de)
