# 🛡️ Update v1.4.18 — Watchdog Rework: Vereinfacht, zuverlässig, Stock-Miner-tauglich

> Dieses Update fasst alle Watchdog-Verbesserungen von v1.4.11 bis v1.4.18 zusammen.

---

## ✨ Was ist neu

### Sekundengenauer Countdown (v1.4.11)

Der Watchdog-Countdown zählt jetzt sekündlich herunter — direkt im Browser, ohne auf den nächsten Engine-Tick (15s) zu warten.

```
Vorher:  ⏳ Abschaltung in 1 Min.   (statisch, aktualisiert nur alle 15s)
Nachher: ⏳ Abschaltung in 1:46 Min. (live, jede Sekunde)
```

Außerdem wird Cooldown-Zeit jetzt sichtbar angezeigt:

```
⏸️ Cooldown: 4:32 Min.   ← Watchdog hat gefeuert, wartet auf Neustart
⏳ Abschaltung in 1:46 Min.  ← Countdown läuft
```

---

### Watchdog vereinfacht — kein Action-Selector mehr (v1.4.15)

Die Auswahl `off / toggle / reboot / restart_backend` ist entfallen. Der Watchdog macht jetzt immer dasselbe:

**Watchdog feuert → Miner wird ausgeschaltet → Engine schaltet ihn wieder ein wenn SOC/PV-Bedingung stimmt.**

Das entspricht dem was die meisten Nutzer wollten — und war auch das Verhalten in frühen Versionen.

---

### Physische Steckdose als Watchdog-Ziel (v1.4.16)

Für Setups mit physischem Smart-Plug (Shelly, Zigbee-Dose etc.) kann jetzt eine **Watchdog Steckdose** konfiguriert werden.

```
Schalter 1 (mining_aktiv) → steuert Mining-Software (SOC/PV-Logik)
Watchdog Steckdose         → trennt physische Stromzufuhr (Watchdog-Logik)
```

**Ablauf bei konfigurierter Steckdose:**
1. Watchdog feuert → Steckdose aus (Strom weg, Miner bootet beim Wiedereinschalten frisch)
2. Engine erkennt Steckdose = aus → `is_on = False`
3. SOC/PV-Bedingung erfüllt → Engine schaltet **Steckdose zuerst ein** (3s warten), dann `mining_aktiv`
4. Miner startet neu mit voller Leistung → Watchdog-Schwelle überschritten → kein neuer Countdown

**Manueller PLUG-Button** (v1.4.18): Wenn eine Watchdog-Steckdose konfiguriert ist, erscheint in der Miner-Karte ein 🔌 PLUG-Button zum manuellen Ein-/Ausschalten der Steckdose.

---

### Watchdog funktioniert jetzt auch für Stock-Miner (v1.4.14 + v1.4.17)

Bisher hat der Watchdog für viele Stock-Miner (z.B. Avalon Q Home, NerdAxe ohne API) nicht gezählt oder nicht gefeuert — aus zwei Gründen:

**Problem 1 (v1.4.14):** Kein Sensor konfiguriert → `watched_val = None` → Watchdog kehrt still zurück  
**Fix:** Coordinator-Power (`stateObj.power`) als letzter Fallback — kein Sensor nötig

**Problem 2 (v1.4.17):** SOC-Bedingung schaltet `mining_aktiv` aus → Engine: `is_on = False` → Watchdog nicht aufgerufen. Stock-Miner läuft aber physisch weiter (ignoriert Software-Befehle).  
**Fix:** Engine prüft zusätzlich `power_consumption_sensor` HA-Entity. Wenn dort > 5W → Watchdog läuft auch bei `is_on = False`

**Fix im JS:** Countdown wird auch angezeigt wenn `mining_aktiv = off` aber physischer Verbrauch > 5W.

---

## 📋 Geänderte Dateien

| Datei | Änderung |
|---|---|
| `engine.py` | Watchdog-Trigger: physischer Verbrauch via Sensor-Entity als Fallback; `standby_switch` als Plug-Target; Engine turn_on schaltet Plug zuerst |
| `switch.py` | Avalon `work_mode` konfigurierbar (eco/normal/high) |
| `openkairo-mining-panel.js` | Sekundengenauer Countdown; Cooldown-Anzeige; PLUG-Button; vereinfachtes Watchdog-Formular |
| `manifest.json` | Version: `1.4.18` |
| `__init__.py` | JS Cache-Buster: `?v=1.4.18` |

---

## ⚙️ Konfiguration Watchdog (neu)

Das Watchdog-Formular hat jetzt nur noch das Wesentliche:

```
✅ Watchdog aktivieren

Watchdog Steckdose 1: [Entity-Picker]   ← optional: physischer Plug
Watchdog Steckdose 2: [Entity-Picker]   ← optional

Off wenn < [100] W  für >= [2] Min.

Info: Steckdose wird getrennt und bleibt aus.
      PV/SOC-Regel schaltet sie wieder ein wenn die Bedingungen stimmen.
```

Kein Action-Selector, kein watchdog_type — nur Schwellwert und Verzögerung.

---

## 🔄 Migration von älteren Versionen

Bestehende Configs mit `watchdog_action`, `watchdog_type`, `standby_switch` bleiben erhalten — die Engine ignoriert `watchdog_action` und `watchdog_type` ab jetzt stillschweigend. `standby_switch` wird weiterhin für den PLUG-Button in der Karte und als Watchdog-Ziel verwendet.

---

**Full Changelog**: v1.4.10 → v1.4.18 | Powered by OpenKairo ₿
