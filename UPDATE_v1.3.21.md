# 🚀 Update v1.3.21 - Die "Intelligence" Edition

Seit dem großen v1.3.5 Release hat sich OpenKairo Mining massiv weiterentwickelt. Dieses Update (v1.3.21) fasst die Meilensteine der letzten Wochen zusammen und bringt neue, intelligente Steuerungs-Features für dein Mining-Setup.

## 🏝️ Neu: 3-Punkt SOC-Kurve (Offgrid 2.0) [Beta]
Für Inselanlagen und Offgrid-Systeme haben wir die SOC-Kurve perfektioniert.
- **Drei statt zwei Punkte**: Definiere Start, Mitte und Ende der Kurve für eine nicht-lineare Leistungsanpassung.
- **Präzise Skalierung**: Der Miner passt seine Leistung nun noch feinfühliger an den Batteriefüllstand an.
- **Beta-Status**: Dieses Feature befindet sich aktuell in der Testphase für maximale Stabilität.

## 🤖 Neu: AI Akku-Optimierer (Predictive) [Beta]
Die künstliche Intelligenz berechnet nun noch smarter, wann dein Miner nachts laufen darf.
- **Percentile-Filter**: Kurze Lastspitzen im Haus (z.B. Wasserkocher) werden nun ignoriert, um den Miner nicht fälschlicherweise zu drosseln.
- **Wetter-Anbindung**: Die Solar-Prognose für den nächsten Tag wird in die Entladestrategie einbezogen.
- **Ziel-SOC Fokus**: Erreiche morgens punktgenau deinen gewünschten Rest-Akkustand.

## 🔥 Neu: Heater-Modus (Mining as a Heat Source)
Dein Miner ist jetzt deine Heizung.
- **Temperatur-Gating**: Schaltet basierend auf HA-Temperatursensoren.
- **SOC-Schutz**: Verhindert, dass der Heizbetrieb den Akku unter ein kritisches Limit zieht.
- **Hysterese**: Schont die Hardware durch intelligente Schaltschwellen.

## 📱 Mobile-First Dashboard & UI
- **Kompaktes Design**: Das Dashboard wurde für die Nutzung auf Smartphones und Tablets optimiert.
- **Live-Ticker**: BTC-Fees und Markt-News laufen nun flüssiger im Header.
- **Automatisches Runden**: Alle Werte werden für bessere Lesbarkeit auf eine Nachkommastelle gerundet.
- **Transparenz**: Neue "Beta"-Labels markieren experimentelle Funktionen.

## 🛠️ Unter der Haube
- **Pyasic Core Upgrade**: Verbesserte Erkennung von Bitaxe, NerdMiner und IceRiver PBfarmer.
- **Stabilitäts-Fixes**: Behebung von Browser-Caching Problemen, Watchdog-Fehlalarmen im manuellen Modus und fehlendem BTC-Portfolio Sensor Picker im Setup.
- **Solar-Vorhersage**: Die Wetterprognose kann nun in allen Modi aktiviert und angezeigt werden (globales Dashboard-Element).
- **Effizienz-Analyse**: Neue Berechnungslogik für sat/kWh im Dashboard.

---
**Viel Spaß mit der neuen Intelligenz in deinem Mining-Setup!** ₿🤖🏝️
