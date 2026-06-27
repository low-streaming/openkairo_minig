# 🔧 Update v1.4.2 — Watchdog Cooldown Fix

Hotfix für Issue #17.

---

## 🐛 Bugfix — Watchdog triggert dauerhaft in kurzen Abständen (`#17`)

**Gemeldet von:** bolek1

**Problem:** Der Watchdog löste die konfigurierte Aktion (Toggle / Reboot / Neustart) wiederholt in kurzen Abständen aus statt einmalig nach dem Countdown.

**Ursache:** Nach dem Ausführen der Watchdog-Aktion wurde `standby_since = None` gesetzt — aber kein Cooldown. Wenn der Miner nach dem Neustart noch 0W zeigte (Boot-Phase dauert bei Antminern 1–3 Minuten), startete der Countdown **sofort wieder von vorne**. Bei kurzem `standby_delay` feuerte der Watchdog erneut bevor der Miner überhaupt fertig gestartet war. Dieser Zyklus wiederholte sich bis der Miner wieder auf Betriebsleistung kam.

**Fix:** Neues `watchdog_last_action` Timestamp-Feld im Miner-State. Nach einer Watchdog-Aktion wird der Countdown erst wieder gestartet wenn mindestens `standby_delay` Minuten (Minimum: 5 Minuten) vergangen sind. Das gibt dem Miner Zeit vollständig zu starten ohne sofort erneut als hängend erkannt zu werden.

```
Vorher:
  t=0:   Watchdog feuert → Toggle
  t=15s: Miner bootet, 0W → Countdown startet neu
  t=75s: Watchdog feuert ERNEUT → Toggle
  t=90s: Miner bootet wieder, 0W → Countdown startet neu
  ...

Nachher:
  t=0:    Watchdog feuert → Toggle → Cooldown gesetzt
  t=15s:  Cooldown aktiv → kein neuer Countdown
  t=5min: Cooldown abgelaufen → Miner läuft normal → kein neuer Countdown
```

---

**Full Changelog**: v1.4.1 → v1.4.2 | Powered by OpenKairo ₿
