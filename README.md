# OpenKairo Mining 🚀 — The Ultimate Mining Command Center

[![OpenKairo](https://img.shields.io/badge/Powered%20by-OpenKairo-0bc4e2.svg)](https://openkairo.de)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Integration-41bdf5.svg)](https://home-assistant.io)
[![Version](https://img.shields.io/badge/Version-1.3.5%20Command%20Center-magenta.svg)](#)

Transform your Home Assistant into a professional-grade Mining Control Center. **OpenKairo Mining** allows you to automate, monitor, and optimize your miners based on PV yield, battery state, and real-time Bitcoin network data.

---

## 🆕 Das "Command Center" Update (v1.3+)

Wir haben die Integration auf ein neues Level gehoben. Dieses Update vereint Design, Intelligenz und Hardware-Kontrolle in einer einzigen, performanten Oberfläche.

### 🎨 Ultra-Premium Design Engine
Wähle aus exklusiven Design-Presets, die dein Dashboard zum Leuchten bringen:
- **Midnight Glow & Atlantis:** Elegante Blau- und Violetttöne für den klassischen Tech-Look.
- **Matrix & Solar:** Hochkontrastreiche Themes für maximale Lesbarkeit.
- **Lava Field:** Dynamische Rottöne für echte Power-User.
- **Crystal Ice & Deep Abyss:** Unsere neuesten v1.3 Ergänzungen mit flüssigen Animationen.
- **☀️ Gladbeck Edition:** Spezial-Branding für Solarmodule Gladbeck ("Brand Overdrive").

### 📊 Bitcoin Network Intelligence (Mempool Integration)
Kein Raten mehr. Dein Dashboard zieht Live-Daten direkt von `mempool.space`:
- **Real-time BTC Price:** Hochpräziser Kurs in Euro.
- **Mining Fees:** Aktuelle Gebühren (Fast/Medium/Low) in sat/vB.
- **Network Status:** Aktuelle Blockhöhe und Difficulty-Adjustment Prognose.
- **Halving Countdown:** Behalte das wichtigste Event im Blick.

### 🛡️ Hardware Watchdog 2.0 (Dual-Socket Support)
Maximale Sicherheit für deine Hardware:
- **Frozen Detection:** Erkennt hängengeblieben Miner am verringerten Stromverbrauch.
- **Hard-Reset Cycle:** Schaltet die Steckdose (z.B. Shelly Plug) komplett ab und wieder an.
- **Dual-Socket Support:** Unterstützung für Miner mit zwei Netzkabeln. Beide Dosen werden synchron geschaltet.

---

## ⚙️ Kern-Features

- **Intelligente PV-Steuerung:** Automatisches Schalten basierend auf Solareinspeisung oder Überschuss.
- **Batterie SOC-Steuerung:** Steuere deine Miner basierend auf dem Hausakku (z.B. Start >90%, Stop <30%).
- **Soft Start / Soft Stop (Ramping):** Schonendes, mehrstufiges Hochfahren der Leistung zur Entlastung von Netzteil und Stromnetz.
- **Echtzeit-Profit-Rechner:** Automatische Berechnung von Umsatz und Kosten basierend auf Live-Netzwerkdaten und deinem Strompreis.
- **Native ASIC-Kontrolle:**
  - **Power Limit Slider:** Stufenlose Watt-Regulierung direkt im Dashboard.
  - **Modus-Switch:** Wechsel zwischen Low, Normal und High Power Modus.
  - **Reboot & Backend-Restart:** Behebe Probleme per Knopfdruck ohne die ASIC-Weboberfläche zu öffnen.
- **Activity Ticker:** Alle Systemereignisse im Blick – am Handy als flüssige Laufschrift optimiert.

---

## 🚀 Installation

### 1. Voraussetzungen (Wichtig!)
Diese Integration kommuniziert mit deinen Minern über die **Hass-Miner Integration** (basierend auf `pyasic`). Diese muss als benutzerdefiniertes Repository in HACS installiert sein:
- **URL:** `https://github.com/Schnitzel/hass-miner`
- **Kategorie:** Integration

### 2. OpenKairo Mining installieren
1. In Home Assistant: **HACS** > **Integrationen** > drei Punkte (oben rechts) > **Benutzerdefinierte Repositories**.
2. URL: `https://github.com/openkairo/openKairo_Mining` > Kategorie: **Integration** hinzufügen.
3. Integration "OpenKairo Mining" herunterladen und Home Assistant **neu starten**.
4. Unter **Geräte & Dienste** die Integration "OpenKairo Mining" hinzufügen.

---

## 🛠️ Fehlerbehebung (Pydantic Fix)

Falls die `Hass-Miner` Integration aufgrund neuerer Python-Versionen Fehler wirft (`Invalid handler specified`), hilft dieser manuelle Patch:
1. Öffne `/config/custom_components/miner/__init__.py` im Editor.
2. Füge ganz oben in Zeile 1 ein:
   ```python
   import pydantic
   pydantic.main.BaseModel.model_config = {"arbitrary_types_allowed": True}
   ```
3. Speichere und starte Home Assistant neu.

---

## 🎯 Roadmap
- [ ] **Dynamic Power-Scaling:** Vollautomatische Anpassung des Power-Limits an den PV-Überschuss.
- [ ] **Solcast Anbindung:** Ertrags-Vorschau zur proaktiven Planung der Mining-Zyklen.
- [ ] **Push-Benachrichtigungen:** Warnungen bei Hashrate-Einbrüchen direkt aufs Handy.

---

**Entwickelt für die Mining-Community.**
Besuche uns auf [openkairo.de](https://openkairo.de) für Support und weitere Innovationen.
