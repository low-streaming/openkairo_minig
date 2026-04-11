# OpenKairo Mining 🚀 — Das Ultimative Mining Command Center

[![OpenKairo](https://img.shields.io/badge/Powered%20by-OpenKairo-0bc4e2.svg)](https://openkairo.de)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Integration-41bdf5.svg)](https://home-assistant.io)
[![Version](https://img.shields.io/badge/Version-1.3.5%20Command%20Center-magenta.svg)](#)

Verwandle dein Home Assistant in eine professionelle Mining-Schaltzentrale. Mit **OpenKairo Mining** kannst du deine Miner intelligent automatisieren, überwachen und basierend auf PV-Ertrag, Batteriestatus und Echtzeit-Bitcoin-Netzwerkdaten optimieren.

---

## 🆕 Das "Command Center" Update (v1.3+)

Wir haben die Integration auf ein neues Level gehoben. Das System arbeitet nun **nativ** und benötigt keine externen Schnittstellen mehr, um direkt mit deinen ASICs zu kommunizieren.

### 🎨 Ultra-Premium Design Engine
Wähle aus exklusiven Design-Presets, die dein Dashboard zum Leuchten bringen (Midnight Glow, Atlantis, Matrix, Solar, Lava, Crystal Ice & Deep Abyss). Inklusive der **☀️ Gladbeck Edition** für Solarmodule Gladbeck.

### ⚡ Native Hardware-Anbindung
OpenKairo Mining bringt eine eigene, tiefe Integration für ASIC-Miner mit. Du kannst deine Miner nun direkt als Home Assistant Geräte hinzufügen.
- **Nativ via pyasic:** Direkte Abfrage von Hashrate, Temperatur und Lüftern ohne Umwege.
- **Volle Kontrolle:** Power-Limits setzen, Reboots durchführen und Modi wechseln.

### 🛡️ Hardware-Wächter 2.0 (Duale Steckdosen)
Maximale Sicherheit durch automatische Erkennung eingefrorener Miner am verringerten Stromverbrauch. Inklusive Unterstützung für Miner mit **zwei Netzkabeln** sowohl für die Steuerung als auch für den Watchdog-Reset.

---

## 🚀 Installation & Einrichtung

### 1. OpenKairo Mining installieren
1. In Home Assistant: **HACS** > **Integrationen** > drei Punkte > **Benutzerdefinierte Repositories**.
2. URL: `https://github.com/openkairo/openKairo_Mining` > Kategorie: **Integration** hinzufügen.
3. Herunterladen und Home Assistant **neu starten**.
4. Unter **Geräte & Dienste** -> **Integration hinzufügen** nach "OpenKairo Mining" suchen und das **Dashboard (Zentrale)** hinzufügen.

### 2. Miner hinzufügen (Native Methode - Empfohlen)
Um die Hardware-Daten und Steuerung zu nutzen, füge deine Miner nun direkt hinzu:
1. Gehe zu **Geräte & Dienste** -> **Integration hinzufügen**.
2. Suche erneut nach "OpenKairo Mining".
3. Gib die **IP-Adresse**, Benutzername und Passwort deines Miners ein.
4. Es werden automatisch alle Sensoren (Hashrate, Temp, Power) sowie Schalter und Nummern für die Steuerung angelegt.

### 3. Optionale Anbindung: Hass-Miner
Falls du bereits die `hass-miner` Integration nutzt, kannst du diese Entitäten weiterhin im Dashboard verknüpfen. Dies ist jedoch **optional**. Die native Anbindung von OpenKairo Mining bietet eine stabilere und tiefere Integration.

---

## ⚙️ Kern-Funktionen
- **PV- & SOC-Steuerung:** Automatisches Schalten basierend auf Solareinspeisung oder Hausakku.
- **Sanfter Anlauf (Soft-Start / Soft-Stop):** Mehrstufiges Hochfahren zur Netzentlastung.
- **Mempool Integration:** Live-Daten zum BTC-Preis, Gebühren und Halving-Countdown.
- **Aktivitäts-Ticker:** Alle Ereignisse als Laufschrift für PC und Smartphone.

---

## 🛠️ Fehlerbehebung (Pydantic Fix)

Aufgrund neuerer Home Assistant / Python-Versionen kann es bei der Kommunikation mit ASICs zu Fehlern kommen (`Invalid handler specified`). OpenKairo Mining enthält bereits einen automatischen Fix. Sollten dennoch Probleme beim Laden von Hardware-Entitäten auftreten, hilft dieser Patch:

1. Öffne `/config/custom_components/openkairo_mining/__init__.py` im Editor.
2. Prüfe, ob die ersten Zeilen so aussehen:
   ```python
   import pydantic
   pydantic.BaseModel.model_config = {"arbitrary_types_allowed": True}
   ```
3. Alternativ wende den Fix auf die Datei `/config/custom_components/miner/__init__.py` an, falls du die `hass-miner` Integration optional nutzt.

---

**Entwickelt für die Mining-Community.**
Besuche uns auf [openkairo.de](https://openkairo.de) für Support und weitere Innovationen.
