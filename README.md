# OpenKairo Mining ⚡

Ein Custom Component (Integration) für Home Assistant, um Krypto-Miner intelligent nach PV-Überschuss zu steuern. *Powered by OpenKairo*

## Voraussetzungen
> **⚠️ Wichtig:** Um die Miner in Home Assistant steuern und überwachen zu können (z.B. Hashrate, Temperatur, Power Limit, Restart), wird zusätzlich die **Hass-Miner Integration** benötigt. Diese stellt die eigentlichen Entitäten der Miner bereit, welche dann im OpenKairo Mining Panel verknüpft und gesteuert werden.

## Features
- **Designstarkes Dashboard:** Eine moderne Weboberfläche zur zentralen Steuerung und Überwachung aller Miner.
- **Intelligente PV-Steuerung:** Automatisches Schalten basierend auf Solareinspeisung. Inklusive Priorisierung mehrerer Miner und optionalem Batterie-Backup (SOC).
- **Hysteresen-Schutz:** Einstellbare Ein- und Ausschaltverzögerungen, um die Hardware bei wechselhafter Bewölkung zu schonen.
- **Tiefe Hass-Miner Integration:**
  - Live-Monitoring von Hashrate und Temperaturen.
  - **Power Limit Slider:** Reguliere den Stromverbrauch kompatibler Miner stufenlos direkt im Dashboard.
  - **ASIC-Kontrolle:** Sende Befehle wie Neustart, Reboot oder Modus-Wechsel (Low/Normal/High Power) per Knopfdruck.
- **Personalisierung:** Hinterlege eigene Bilder für jeden Miner für eine individuelle Optik.

## Installation via HACS (Custom Repository)
1. Gehe in Home Assistant zu **HACS** > **Integrationen**.
2. Klicke oben rechts auf die drei Punkte und wähle **Benutzerdefinierte Repositories**.
3. URL einfügen: `https://github.com/low-streaming/openkairo_minig`
4. Kategorie: **Integration**
5. Auf **Hinzufügen** klicken und "OpenKairo Mining" herunterladen.
6. Home Assistant **neu starten!**

## Konfiguration & Nutzung
1. Gehe in Home Assistant auf **Geräte & Dienste** -> **Integration hinzufügen**.
2. Suche nach "OpenKairo Mining" und füge es hinzu.
3. Aktualisiere dein Browser-Fenster (F5). Du siehst nun ein "OpenKairo Mining" Panel in der Seitenleiste.
4. Öffne das Panel und konfiguriere deine Miner im Tab **Einstellungen**.

## Roadmap 🚀
Wir entwickeln OpenKairo Mining ständig weiter. Hier ist ein Ausblick auf geplante Funktionen:

- [ ] **Dynamisches Power-Scaling:** Automatische Anpassung des Power-Limits passend zum aktuellen PV-Überschuss (statt nur An/Aus).
- [ ] **Hashrate-Watchdog:** Automatische Benachrichtigung oder Neustart, falls ein Miner unter eine bestimmte Hashrate fällt.
- [x] **Energy-Stats:** Detaillierte Auswertung der durch PV-Steuerung eingesparten Stromkosten.
- [ ] **Multi-Pool Support:** Schneller Wechsel zwischen verschiedenen Mining-Pools direkt über das Dashboard.
- [x] **Mobile App Optimization:** Perfektes, responsives Layout für die Home Assistant Mobile App.
- [ ] **Auto-Update:** Anzeige von Firmware-Updates für unterstützte Miner.
- [x] **Statistiken & Graphen:** Integrierte zeitliche Verläufe für Stromverbrauch und Leistung.

---
**Powered by OpenKairo** | [openkairo.de](https://openkairo.de)
