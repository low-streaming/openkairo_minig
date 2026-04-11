# OpenKairo Mining 🚀 — Das Ultimative Mining Command Center

[![OpenKairo](https://img.shields.io/badge/Powered%20by-OpenKairo-0bc4e2.svg)](https://openkairo.de)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Integration-41bdf5.svg)](https://home-assistant.io)
[![Version](https://img.shields.io/badge/Version-1.3.5%20Command%20Center-magenta.svg)](#)

Verwandle dein Home Assistant in eine professionelle Mining-Schaltzentrale. Mit **OpenKairo Mining** kannst du deine Miner intelligent automatisieren, überwachen und basierend auf PV-Ertrag, Batteriestatus und Echtzeit-Bitcoin-Netzwerkdaten optimieren.

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

### 📊 Bitcoin Netzwerk-Intelligenz (Mempool Integration)
Kein Raten mehr. Dein Dashboard zieht Live-Daten direkt von `mempool.space`:
- **Echtzeit-BTC-Preis:** Hochpräziser Kurs in Euro.
- **Mining-Gebühren:** Aktuelle Gebühren (Schnell/Mittel/Niedrig) in sat/vB.
- **Netzwerk-Status:** Aktuelle Blockhöhe und Difficulty-Adjustment Prognose.
- **Halving-Countdown:** Behalte das wichtigste Event im Blick.

### 🛡️ Hardware-Wächter 2.0 (Duale Steckdosen-Unterstützung)
Maximale Sicherheit für deine Hardware:
- **Eingefrorene Miner erkennen:** Erkennt hängengebliebene Miner am verringerten Stromverbrauch.
- **Hard-Reset-Zyklus:** Schaltet die Steckdose (z.B. Shelly Plug) komplett ab und wieder an.
- **Duale Steckdosen:** Unterstützung für Miner mit zwei Netzkabeln. Beide Dosen werden synchron geschaltet.

---

## ⚙️ Kern-Funktionen

- **Intelligente PV-Steuerung:** Automatisches Schalten basierend auf Solareinspeisung oder Überschuss.
- **Batterie SOC-Steuerung:** Steuere deine Miner basierend auf dem Hausakku (z.B. Start >90%, Stop <30%).
- **Sanfter Anlauf (Soft-Start / Soft-Stop):** Schonendes, mehrstufiges Hochfahren der Leistung zur Entlastung von Netzteil und Stromnetz.
- **Echtzeit-Gewinnrechner:** Automatische Berechnung von Umsatz und Kosten basierend auf Live-Netzwerkdaten und deinem Strompreis.
- **Native ASIC-Kontrolle:**
  - **Leistungslimit-Schieberegler:** Stufenlose Watt-Regulierung direkt im Dashboard.
  - **Betriebsmodus-Wechsel:** Wechsel zwischen Spar- (Low), Normal- und Hochleistungs-Modus.
  - **Neustart & Backend-Reset:** Behebe Probleme per Knopfdruck, ohne die ASIC-Weboberfläche zu öffnen.
- **Aktivitäts-Ticker:** Alle Systemereignisse im Blick – am Smartphone als flüssige Laufschrift optimiert.

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

Falls die `Hass-Miner` Integration aufgrund neuerer Home Assistant / Python-Versionen Fehler wirft (`Invalid handler specified`), hilft dieser manuelle Patch:
1. Öffne `/config/custom_components/miner/__init__.py` im Editor.
2. Füge ganz oben in Zeile 1 ein:
   ```python
   import pydantic
   pydantic.main.BaseModel.model_config = {"arbitrary_types_allowed": True}
   ```
3. Speichere und starte Home Assistant neu.

---

## 🎯 Ausblick (Roadmap)
- [ ] **Dynamische Leistungsskalierung:** Vollautomatische Anpassung des Power-Limits an den exakten PV-Überschuss.
- [ ] **Solcast Anbindung:** Ertrags-Vorschau zur proaktiven Planung der Mining-Zyklen.
- [ ] **Push-Benachrichtigungen:** Warnungen bei Hashrate-Einbrüchen direkt aufs Handy.

---

**Entwickelt für die Mining-Community.**
Besuche uns auf [openkairo.de](https://openkairo.de) für Support und weitere Innovationen.
