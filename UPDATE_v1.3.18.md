# 🚀 Update v1.3.18 - The "Heater" Edition

Dieses Update verwandelt deinen ASIC-Miner in eine intelligente Heizung für dein Zuhause. Wir haben den Fokus auf die effiziente Nutzung vorhandener Wärmeenergie gelegt, kombiniert mit smarter Batterie-Logik.

## 🔥 Neu: Heiz-Modus (Mining as a Heater)
Nutze die Abwärme deines Miners proaktiv. 
- **Temperatur-Gating**: Schalte Miner basierend auf Home Assistant Temperatursensoren.
- **Hysterese-Steuerung**: Verhindert nervöses Flattern durch einstellbare Ein-/Ausschalt-Schwellen.
- **Automatischer Stopp**: Sicherheit geht vor – bei Erreichen der Zieltemperatur schaltet der Miner verzögerungsfrei ab.

## 🔋 Neu: Optionale SOC-Sperre für Heizer
Heizen verbraucht viel Energie. Damit dein Haus-Akku nicht leergesaugt wird:
- **SOC-Abhängigkeit**: Aktiviere die Batterie-Prüfung im Heizmodus.
- **Gating**: Geheizt wird nur, wenn der Raum kalt ist **UND** der Akku über X% liegt.
- **Smart Shutdown**: Fällt der Akku unter das Limit, stoppt der Heizbetrieb sofort.

## 📱 Mobile & UI Optimierungen
- **Compact Dashboard**: Die Karten-Layouts wurden für Smartphones optimiert.
- **Ticker-Upgrade**: Der News-Ticker im Header läuft nun flüssiger und überlappt nicht mehr mit dem Inhalt.
- **Zahlen-Formatierung**: Alle Sensorwerte (Temperatur, Watt, etc.) werden nun sauber auf eine Nachkommastelle gerundet.
- **Content-Spacing**: Mehr Platz für die Miner-Inhalte auf Desktop-Monitoren.

## 🛠️ Verbesserungen unter der Haube
- **Watchdog-Erweiterung**: Der Sicherheits-Wächter überwacht nun auch die Raumtemperatur-Sensoren.
- **Status-Reporting**: Präzisere Log-Einträge bei automatischen Schaltvorgängen.
- **Stability Fixes**: Behebung von Overflow-Fehlern in der JS-Anzeige bei extrem langen Sensorwerten.

---
**Viel Spaß beim smarten Heizen!** ₿🔥
