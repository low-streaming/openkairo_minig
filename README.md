# OpenKairo Mining ⚡

Ein Custom Component (Integration) für Home Assistant, um Krypto-Miner intelligent nach PV-Überschuss oder dynamischen Strompreisen zu steuern. *Powered by OpenKairo*

## Features
- **Eigenes Dashboard-Panel** in der Seitenleiste zur einfachen Konfiguration und Überwachung.
- **PV-Überschuss-Steuerung:** Miner (bzw. deren smarte Steckdose) automatisch bei genügend Netzeinspeisung einschalten.
- **Strompreis-Steuerung:** Miner automatisch bei günstigen Strompreisen (z.B. Tibber, aWATTar) einschalten.
- **Erweiterte Hass-Miner Integration:** 
  - Verknüpfe Sensoren (Hashrate, Temperatur), die direkt und optisch ansprechend auf der Dashboard-Karte deines Miners angezeigt werden.
  - **Neu: Power Limit Modus!** Steuere das Strom-Limit von ASIC Minern (wie z.B. dem Antminer S9 mit Braiins OS+) **live über einen Slider auf dem Dashboard**.
  - Sende Knopfdruck-Befehle (Restart, Reboot, Low/Normal/High Power Mode) direkt über die Dashboard-Karte an deine Miner.
- **Miner Bilder:** Lade Fotos deiner eigenen Hardware auf das Dashboard hoch, um sie noch schicker zu präsentieren!

## Installation via HACS (Custom Repository)
1. Gehe in Home Assistant zu **HACS** > **Integrationen**.
2. Klicke oben rechts auf die drei Punkte und wähle **Benutzerdefinierte Repositories**.
3. URL einfügen: `https://github.com/low-streaming/openkairo_minig`
4. Kategorie: **Integration**
5. Auf **Hinzufügen** klicken und "OpenKairo Mining" herunterladen.
6. Home Assistant **neu starten!**

## Manuelle Installation
1. Lade dir die Dateien aus diesem Repository herunter.
2. Kopiere den Ordner `custom_components/openkairo_mining` in den Ordner `custom_components` in deiner Home Assistant Instanz.
3. Starte Home Assistant **neu**.

## Konfiguration & Nutzung
1. Gehe in Home Assistant auf **Einstellungen** -> **Geräte & Dienste** -> **Integration hinzufügen**.
2. Suche nach "OpenKairo Mining" und füge es hinzu. *(Alternative: Wenn in der manifest.json config_flow auf false steht, füge einfach `openkairo_mining:` zu deiner `configuration.yaml` hinzu).*
3. Aktualisiere dein Browser-Fenster (F5). Du siehst nun ein "OpenKairo Mining" Panel links in deiner Seitenleiste.
4. Öffne das Panel und wähle im Tab **"Einstellungen & Miner verwalten"** alle Sensoren (PV, Preis, Hashrate, Temperatur, Power Limit) und Schwellenwerte aus.

---
**Powered by OpenKairo** | [openkairo.de](https://openkairo.de)
