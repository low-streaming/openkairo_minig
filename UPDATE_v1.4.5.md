# ✨ Update v1.4.5 — Watchdog Status-Badge

---

## ✨ Neu — Watchdog Status direkt in der Miner-Karte

Bisher war nicht erkennbar ob der Watchdog gerade aktiv zählt oder nach einer Aktion im Cooldown ist. Man musste in den Log-Tab wechseln um das zu sehen.

Die Miner-Karte zeigt jetzt zwei neue Status-Badges direkt unterhalb der "Letzte Entscheidung" Zeile:

**🟡 Watchdog Countdown: noch X min**
Der Miner läuft, aber die überwachte Größe (Verbrauch oder Power-Limit) liegt unter dem Schwellenwert. Wenn der Countdown abläuft, feuert der Watchdog die konfigurierte Aktion.

**⬜ Watchdog Cooldown: noch X min**
Eine Watchdog-Aktion wurde bereits ausgelöst. Der neue Countdown startet erst wenn der Cooldown vorbei ist — damit der Miner Zeit hat vollständig zu starten.

Der Badge erscheint nur wenn der Watchdog für den Miner aktiviert ist. Ist alles normal, ist nichts zu sehen.

### API

Neues Feld `watchdog_cooldown_remaining` im State-Endpoint — serverseitig berechnet aus `watchdog_last_action` + `standby_delay`:

```python
wd_last = s.get("watchdog_last_action", 0)
if wd_last:
    cooldown = max(delay, 300)
    clean_s["watchdog_cooldown_remaining"] = int(max(0, cooldown - (time.time() - wd_last)))
```

---

## 🐛 Bugfix — `"wird ausgeschaltet"` Spam im Log

**Gemeldet durch:** System Logs Screenshot — Avalon Q Home (Stock)

**Problem:** Wenn ein Miner bereits ausgeschaltet ist, aber der `power_consumption_sensor` noch Standby-Leistung meldet (z.B. 10W bei einem Avalon im Standby), schrieb die Engine jeden Tick (alle 15s) einen `"wird ausgeschaltet"`-Eintrag in den Log.

**Ursache:** Die `_detect_miner_state()` Methode hat nach dem Switch-Check einen Power-Sensor-Fallback ausgeführt. Zeigte der Sensor > `STANDBY_POWER_THRESHOLD` (Standard: 5W), wurde `is_on = True` gesetzt — auch wenn der Switch klar `"off"` meldete. Resultat: Engine dachte der Miner sei an, triggerte Ausschalt-Logik und Log-Eintrag jeden Tick.

```text
Vorher:
  Schalter: off | Sensor: 10W → is_on = True  (Fallback überschreibt Switch)
  → Engine: "wird ausgeschaltet" (obwohl schon aus)
  → 15s später: wieder "wird ausgeschaltet" ...

Nachher:
  Schalter: off | Sensor: 10W → is_on = False  (Schalter hat Vorrang)
  → Kein Log-Eintrag, keine weiteren Schaltbefehle
```

**Fix:** Fallback greift nur noch wenn kein Switch explizit `"off"` meldet.

```python
switch_explicitly_off = bool(switches) and all(
    self.hass.states.get(s) is not None and self.hass.states.get(s).state == "off"
    for s in switches
)
if not is_on and p_sensor and not switch_explicitly_off and plug_on:
    # ... Power-Fallback
```

Der Fallback bleibt aktiv für Miner ohne konfigurierten Switch und wenn Switches `"unavailable"` melden.

---

**Full Changelog**: v1.4.4 → v1.4.5 | Powered by OpenKairo ₿
