# OpenKairo Mining ⚡

Ein Custom Component (Integration) für Home Assistant, um Krypto-Miner intelligent nach PV-Überschuss zu steuern. *Powered by OpenKairo*

## Voraussetzungen
> **⚠️ Wichtig:** Um die Miner in Home Assistant steuern und überwachen zu können (z.B. Hashrate, Temperatur, Power Limit, Restart), wird die **Hass-Miner Integration** benötigt.
> 
> Diese muss ebenfalls als **Benutzerdefiniertes Repository** in HACS hinzugefügt werden:
> 1. URL: `https://github.com/Schnitzel/hass-miner`
> 2. Kategorie: **Integration**
>
> Erst danach stehen die Entitäten bereit, die im OpenKairo Mining Panel verknüpft werden.

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
Wir haben noch viel vor, um OpenKairo zur ultimativen Schaltzentrale für Miner zu machen. Hier sind unsere nächsten Ziele:

- [ ] **Dynamisches Power-Scaling:** Automatische, stufenlose Anpassung des Power-Limits passend zum exakten PV-Überschuss (statt nur hartes An/Aus).
- [ ] **Hashrate-Watchdog:** Intelligente Überwachung mit Push-Benachrichtigungen (via Mobile App), falls ein Miner offline geht oder die Leistung einbricht.
- [ ] **Solar-Vorhersage (Solcast-Anbindung):** Berücksichtigung von Wetterprognosen, um Mining-Zyklen vorausschauend und akkuschonend zu planen.
- [ ] **Intelligente Akku-Pufferung:** Erweiterte Entladestrategien, um den Hausakku optimal für Mining-Spitzen zu nutzen, ohne die Grundversorgung zu gefährden.
- [ ] **Hardware-Health Monitoring:** Detaillierte Darstellung von Lüfterdrehzahlen und Chip-Temperaturen sowie Warnungen bei Abweichungen.
- [ ] **Pool-Management:** Schneller Wechsel zwischen verschiedenen Mining-Pools oder Worker-Konfigurationen direkt über das UI.
- [ ] **Support für weitere Systeme:** Native Einbindung von HiveOS-Statistiken und ASIC-Hub Funktionalitäten.

---
**Powered by OpenKairo** | [openkairo.de](https://openkairo.de)
