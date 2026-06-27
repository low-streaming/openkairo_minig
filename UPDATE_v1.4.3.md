# 🔧 Update v1.4.3 — Watchdog Action Fix

Hotfix für Issues #16 und #17.

---

## 🐛 Bugfix — Watchdog-Aktion war nicht konfigurierbar (`#16`)

**Gemeldet von:** Michel83

**Problem:** Auch nach dem Update auf v1.4.0 funktionierte das "Abschalten des Aktors" nicht wie erwartet. Der Miner wurde kurz ausgeschaltet und sofort wieder eingeschaltet statt dauerhaft auszubleiben.

**Ursache 1 — Kein Selector im Formular:**
Die Engine kennt seit v1.4.0 vier Watchdog-Aktionen (`toggle`, `off`, `reboot`, `restart_backend`). Im Bearbeitungs-Formular fehlte jedoch der zugehörige Selector vollständig. Nutzer konnten die Aktion nie ändern — der Default `toggle` (aus/an) wurde immer verwendet, unabhängig davon was gewünscht war.

**Ursache 2 — Fehlende `"off"` Aktion in der Engine:**
Es gab keine reine "nur ausschalten"-Option. `toggle` schaltet immer aus **und** sofort wieder ein. Wer wollte dass der Miner einfach aus bleibt (und erst wieder startet wenn die PV/SOC-Regel greift), hatte keine Möglichkeit das einzustellen.

**Fix:**
- Neuer `watchdog_action` Selector im Watchdog-Formular:
  - 🛑 **Nur ausschalten** (`off`) — bleibt aus bis Modus-Regel greift **(Standard)**
  - 🔄 **Neustart** (`toggle`) — Steckdose kurz aus/an
  - ⚡ **Hardware-Reboot** (`reboot`) — API-Befehl direkt an Miner
  - 🔧 **Backend-Neustart** (`restart_backend`) — nur Mining-Software
- Dynamischer Hilfstext wechselt je nach gewählter Aktion
- `watchdog_action: 'off'` ist jetzt der Default — für neue Miner und als Engine-Fallback für ältere Configs ohne gespeichertes Feld

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

**Full Changelog**: v1.4.2 → v1.4.3 | Powered by OpenKairo ₿
