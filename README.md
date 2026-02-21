# OpenKairo Mining

Ein Custom Component (Integration) für Home Assistant, um Krypto-Miner intelligent nach PV-Überschuss oder dynamischen Strompreisen zu steuern. ⚡ *Powered by OpenKairo*

## Features
- **Eigenes Dashboard-Panel** in der Seitenleiste zur einfachen Konfiguration.
- **PV-Überschuss-Steuerung:** Miner automatisch bei genügend Netzeinspeisung einschalten.
- **Strompreis-Steuerung:** Miner automatisch bei günstigen Strompreisen (z.B. Tibber, aWATTar) einschalten.
- **Manuelle Steuerung:** Einfache Überwachung.

## Installation via HACS (Custom Repository)
1. Gehe in Home Assistant zu **HACS** > **Integrationen**.
2. Klicke oben rechts auf die drei Punkte und wähle **Benutzerdefinierte Repositories**.
3. URL einfügen: `https://github.com/low-streaming/openkairo_minig`
4. Kategorie: **Integration**
5. Auf **Hinzufügen** klicken und "OpenKairo Mining" installieren.
6. Home Assistant neu starten!

## Manuelle Installation
1. Lade dir die Dateien aus diesem Repo herunter.
2. Kopiere den Ordner `custom_components/openkairo_mining` in den Ordner `custom_components` in deiner Home Assistant Instanz.
3. Starte Home Assistant neu.

## Konfiguration
1. Gehe in Home Assistant auf **Einstellungen** -> **Geräte & Dienste** -> **Integration hinzufügen**.
2. Suche nach "OpenKairo Mining".
3. *(Alternative: Wenn in der manifest.json config_flow auf false steht, füge `openkairo_mining:` zu deiner `configuration.yaml` hinzu).*
4. Aktualisiere dein Browser-Fenster, du solltest nun ein "OpenKairo Mining" Panel links in der Seitenleiste sehen.
5. Öffne das Panel und wähle im Tab "Einstellungen" deine Sensoren und Schwellenwerte aus.

---
**Powered by OpenKairo**
