# OpenKairo Mining 🚀 — Das Ultimative "Command Center" v1.3.5

[![OpenKairo](https://img.shields.io/badge/Powered%20by-OpenKairo-0bc4e2.svg?style=for-the-badge)](https://openkairo.de)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Integration-41bdf5.svg?style=for-the-badge)](https://home-assistant.io)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://hacs.xyz)

Verwandle deinen Home Assistant in eine professionelle **Mining-Schaltzentrale**. Mit **OpenKairo Mining** steuerst du deine ASICs intelligent basierend auf PV-Überschuss, Batteriestatus und Bitcoin-Netzwerkdaten.

---

## 💎 Highlights der v1.3.5

Das **"Command Center Update"** macht dein Dashboard so lebendig und sicher wie nie zuvor.

> [!TIP]
> **Echtzeit-Dashboard**: Alle Miner-Zustände (Status, Ramping-Fortschritt, Power) aktualisieren sich nun alle 30 Sekunden im Hintergrund. Kein manueller Refresh mehr nötig!

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

### 🛡️ Hardware-Wächter 2.0 (Dual-Socket)
Maximale Sicherheit für deine Hardware:
- **Frozen Detection**: Erkennt aufgehängte Miner am verringerten Stromverbrauch.
- **Dual-Power Support**: Unterstützung für Miner mit **zwei Netzkabeln**. Beide Steckdosen werden synchron geschaltet – sowohl beim Ramping als auch beim Watchdog-Reset.

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

## ⚙️ Kern-Funktionen

> [!IMPORTANT]
> **Sanfter Anlauf (Ramping)**: Schone dein Stromnetz und dein Netzteil. Dein Miner fährt stufenweise hoch (z.B. 100W -> 500W -> 1000W), anstatt sofort die volle Last zu ziehen.

- **PV- & SOC-Automatik**: Schalte Miner basierend auf Solareinspeisung oder Hausakku.
- **Profit-Rechner**: Live-Gewinnberechnung basierend auf Kurs und Netzwerk-Difficulty.
- **Mempool Live-Ticker**: Bitcoin-Preis, Gebühren und Halving-Countdown direkt im Header.

---

## ☕ Projekt unterstützen
OpenKairo ist ein leidenschaftliches Community-Projekt. Wenn dir das Dashboard gefällt, freuen wir uns über deine Unterstützung!

- **PayPal**: [info@low-streaming.de](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=info@low-streaming.de&currency_code=EUR&source=url)
- **Bitcoin**: `37KAus3ABc6krJ5T4jZyLKVB3uzbfQZGWD`

---

## 💡 Fehlerbehebung (Pydantic Fix)

Sollte es bei neueren Python-Versionen zu Startproblemen kommen (`Invalid handler specified`), enthält OpenKairo Mining bereits einen automatischen Fix. Falls dennoch Hardware-Daten fehlen, prüfe bitte folgendes:

> [!NOTE]
> Der Fix ist in der `__init__.py` bereits vorgemerkt:
> ```python
> import pydantic
> pydantic.BaseModel.model_config = {"arbitrary_types_allowed": True}
> ```

---
**Powered by OpenKairo** | [openkairo.de](https://openkairo.de)
