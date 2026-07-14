# 🐛 Update v1.4.9 — Hotfix: Watchdog kämpfte gegen Engine-Bedingungen

---

## 🐛 Kritischer Bugfix — Watchdog Toggle überschrieb Engine-Abschaltung

**Betroffen:** Alle Miner mit aktiviertem Standby-Watchdog und Aktion `toggle`, `reboot` oder `restart_backend` — im automatischen Modus (SOC, PV, Offgrid, etc.)

**Problem:** Pro Engine-Tick wird zunächst `_execute_conditions` ausgeführt (wertet SOC, PV usw. aus), danach der Watchdog. Das `is_on`-Flag das der Watchdog prüft stammte jedoch vom **Tick-Anfang** — also bevor `_execute_conditions` möglicherweise den Miner ausgeschaltet hatte.

**Ablauf des Bugs:**

```
Tick:
  1. is_on = True  (Miner ist an, aber SOC gerade unter Schwelle gefallen)
  2. _execute_conditions: SOC zu niedrig → switch.turn_off → Miner geht in Standby ✅
  3. Watchdog prüft: is_on == True (alter Wert!) UND Power < Schwelle UND Delay abgelaufen
  4. action=toggle → switch.turn_off (redundant) → 5s Pause → switch.turn_on ← ❌ BUG!
  5. Miner läuft wieder — obwohl SOC-Bedingung Abschalten verlangte

Nächster Tick:
  6. _execute_conditions: SOC immer noch zu niedrig → turn_off
  7. Watchdog: Cooldown aktiv → kein Feuern
→ Miner geht wieder aus

Nach Cooldown-Ablauf: Schleife wiederholt sich → Miner "aus und an"
```

**Fix** (`engine.py`):

`_execute_conditions` gibt jetzt `True` zurück wenn eine Abschaltung ausgeführt wurde. In `_process_miner` wird der Watchdog in diesem Tick übersprungen:

```python
# Vorher:
await self._execute_conditions(...)
if miner.get("standby_watchdog_enabled") and is_on:
    await self._process_watchdog(...)  # ← lief auch nach Engine-turn_off!

# Nachher:
just_turned_off = await self._execute_conditions(...) or False
if miner.get("standby_watchdog_enabled") and is_on and not just_turned_off:
    await self._process_watchdog(...)  # ← übersprungen wenn Engine gerade abgeschaltet hat
```

**Ergebnis:**
- Watchdog feuert korrekt bei eingefrorenen Minern (Miner an, Power niedrig)
- Watchdog feuert **nicht** wenn die Engine denselben Tick den Miner abschaltet
- Gilt für alle Aktionen: `off`, `toggle`, `reboot`, `restart_backend`

---

**Full Changelog**: v1.4.8 → v1.4.9 | Powered by OpenKairo ₿
