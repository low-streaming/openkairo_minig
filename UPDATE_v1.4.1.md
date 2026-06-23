# 🔧 Update v1.4.1 — "Community Bugfix Release"

Dieses Update behebt ausschließlich gemeldete Bugs aus der Community. Kein neues Feature-Scope — nur Fixes für Probleme die echte Nutzer blockiert haben.

> Alle Fixes basieren auf GitHub Issues #2, #9, #10, #11, #13, #14.

---

## 🐛 Bugfixes (Engine)

### Fix — Soft-Start blieb dauerhaft in Stufe 1 stecken (`#13`)

**Gemeldet von:** tigger30926

**Problem:** Das mehrstufige Hochfahren funktionierte in v1.3 nicht mehr. Der Miner startete Stufe 1 und blieb dort — das Log zeigte aber manchmal fälschlicherweise "Soft-Start abgeschlossen".

**Ursache:** In `_handle_ramping` wurde geprüft: `if not is_on and ramping == "up"` — und der Ramp sofort gecancelt. `is_on` wird einmal pro Tick am Anfang erfasst (Miner ist OFF). In `_execute_conditions` wird dann `ramping = "up"` gesetzt und direkt danach `_handle_ramping` aufgerufen — mit dem alten `is_on = False`. Der Ramp wurde auf jedem Tick neu gestartet und sofort wieder gestoppt, bevor Stufe 0 ausgeführt werden konnte.

**Fix:** Prüfung auf `ramping_step > 0` erweitert. Nur wenn der Ramp bereits gestartet ist und der Miner dann ausgeht, wird abgebrochen. Bei `step == 0` (noch nicht gestartet) läuft der Ramp normal durch.

---

### Fix — BraiinsOS: `power_target out of range` Fehler (`#14`)

**Gemeldet von:** Duffy2222 (3x Antminer S9 mit BraiinsOS)

**Problem:** Nach dem Hochfahren zeigte BraiinsOS den Fehler `incorrect configuration body: Option power_target out of range, allowed: ...`. Der Miner hing mit Sanduhr-Symbol. Nur manuelles Ändern einer Einstellung in BraiinsOS hat geholfen.

**Ursache:** Die Engine hat Soft-Start Stufenwerte (z.B. 380W) direkt an BraiinsOS gesendet, ohne zu prüfen ob der Wert innerhalb des erlaubten Hardware-Bereichs liegt. BraiinsOS hat eine eigene Mindestleistung (für den S9 z.B. ~600W) die über der konfigurierten Stufe lag.

**Fix:** Neue Hilfsmethode `_clamp_to_entity_range()` liest die `min`/`max` Attribute direkt aus der HA `number` Entity (die BraiinsOS / pyasic bei der Integration befüllt) und klemmt den Wert automatisch. Zusätzlich `try-except` um alle `number.set_value` Service-Calls mit klarem Warning-Log wenn ein Wert abgelehnt wird.

---

## 🐛 Bugfixes (Panel / UI)

### Fix — Panel wird nach Tablet-Idle leer (`#2`)

**Gemeldet von:** tigger30926

**Problem:** Nach längerem Betrieb auf einem Tablet (Monitoring-Gerät) wurde die komplette Ansicht leer. Weg- und Zurücknavigieren half.

**Ursache:** `disconnectedCallback` löscht alle `setInterval` Timer. Wenn das Tablet aus dem Standby zurückkommt und HA das Panel neu verbindet, gab es kein `connectedCallback` das die Timer neu startet. Das Panel hatte keine laufenden Abfragen mehr und blieb leer.

**Fix:** `connectedCallback` im Haupt-Panel hinzugefügt. Intervalle und Datenabruf starten automatisch neu wenn das Panel nach einer Trennung wieder verbunden wird. Interval-Logik in `_startIntervals()` ausgelagert.

---

### Fix — iPad: Sensor-Picker Dropdown öffnet hinter anderem Element (`#10`)

**Gemeldet von:** tigger30926

**Problem:** Auf dem iPad öffnete sich das Sensor-Auswahl-Menü immer hinter einem anderen Formular-Element. Auf iPhone und PC funktionierte es korrekt.

**Ursache:** Das Dropdown war `position: absolute` innerhalb des Shadow DOM. Auf iPad Safari clippt `overflow: hidden` übergeordneter Elemente das absolut positionierte Dropdown, während Desktop-Browser das großzügiger behandeln. `z-index: 9999` im Shadow DOM hilft dabei nicht, da der Shadow Host selbst in der Light-DOM-Stacking-Context gefangen ist.

**Fix:** Dropdown auf `position: fixed` mit dynamisch berechneten Koordinaten umgestellt. `getBoundingClientRect()` berechnet beim Öffnen exakt wo das Dropdown erscheinen soll. Scroll- und Resize-Listener aktualisieren die Position automatisch.

---

### Fix — Solar-Vorhersage Anzeige fehlt bei älteren Miner-Configs (`#11`)

**Gemeldet von:** tigger30926

**Problem:** Die Vorhersage-Anzeige in der Miner-Karte (Prognose heute + OK/ZU NIEDRIG Badge) war in v1.3 verschwunden, obwohl sie in v1.2 funktioniert hat.

**Ursache:** In v1.3 wurde die Bedingung zu `miner.forecast_enabled && miner.forecast_sensor` geändert. Das Feld `forecast_enabled` existierte in v1.2 nicht — Miner die in v1.2 konfiguriert wurden haben `forecast_enabled = undefined`. `undefined` ist falsy → Block wurde nie gerendert.

**Fix:** Bedingung geändert auf `miner.forecast_sensor && miner.forecast_enabled !== false`. Wenn `forecast_enabled` nicht gesetzt ist (alte Configs), wird der Block trotzdem angezeigt. Nur wenn es explizit auf `false` gesetzt ist, wird er ausgeblendet.

---

## 🪵 Logging-Verbesserungen (`#9`)

**Gemeldet von:** mafe68

**Problem:** Es war nicht nachvollziehbar warum der Miner ein- oder ausgeschaltet wurde. Besonders bei Offgrid-Setups mit Victron fehlte eine Log-/Konsolen-Ansicht.

**Verbesserungen:**

- **Soft-Start/Soft-Stop** loggen jetzt den Grund: `🎢 Miner: Soft-Start gestartet. (SOC 78% >= 70%)` statt nur `🎢 Miner: Soft-Start gestartet.`
- **Miner-Karte** zeigt jetzt eine "Letzte Entscheidung" Zeile direkt unter den Status-Badges: `(PV 950W >= 800W)` / `(SOC 22% <= 30%)` etc.
- **API** gibt `log_reason_on` und `log_reason_off` jetzt explizit aus — vorher waren sie zwar im State, wurden aber nicht garantiert übertragen

> Der Logs-Tab im Dashboard war bereits vorhanden und hat alle Entscheidungen protokolliert. Die neue Zeile in der Miner-Karte macht den aktuellen Grund sofort sichtbar ohne in den Log-Tab wechseln zu müssen.

---

## 📋 Issue-Status

| Issue | Titel | Status |
|-------|-------|--------|
| #2 | Panel wird nach Idle leer | ✅ Behoben in v1.4.1 |
| #9 | Kein Logging warum Miner ein/ausschaltet | ✅ Verbessert in v1.4.1 |
| #10 | iPad: Menü öffnet hinter Box | ✅ Behoben in v1.4.1 |
| #11 | Vorhersage fehlt in v1.3 | ✅ Behoben in v1.4.1 |
| #12 | Miner schaltet ein ohne Voraussetzung | ✅ Bereits in v1.4.0 behoben |
| #13 | Soft-Start bleibt in Stufe 1 | ✅ Behoben in v1.4.1 |
| #14 | BraiinsOS power_target out of range | ✅ Behoben in v1.4.1 |
| #15 | Watchdog führt Aktion nie aus | ✅ Bereits in v1.4.0 behoben |

---

**Full Changelog**: v1.4.0 → v1.4.1 | Powered by OpenKairo ₿
