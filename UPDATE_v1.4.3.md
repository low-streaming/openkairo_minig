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
  - 🔄 **Neustart** (`toggle`) — Steckdose kurz aus/an (Standard)
  - 🛑 **Nur ausschalten** (`off`) — bleibt aus bis Modus-Regel greift
  - ⚡ **Hardware-Reboot** (`reboot`) — API-Befehl direkt an Miner
  - 🔧 **Backend-Neustart** (`restart_backend`) — nur Mining-Software
- Dynamischer Hilfstext wechselt je nach gewählter Aktion
- `watchdog_action: 'toggle'` als Default in neuen Miner-Configs

---

## Zusammenhang mit Issue #17

Issue #17 (Watchdog triggert alle paar Sekunden) und Issue #16 (Watchdog schaltet nicht ab) haben dieselbe Wurzel: fehlender Cooldown nach einer Aktion. Beide sind in v1.4.2 + v1.4.3 vollständig behoben.

| Issue | Problem | Fix |
|-------|---------|-----|
| #17 | Watchdog feuert dauerhaft alle paar Sekunden | Cooldown in v1.4.2 |
| #16 | Watchdog schaltet nicht dauerhaft aus (kein `"off"`) | Neue Aktion + Selector in v1.4.3 |

---

**Full Changelog**: v1.4.2 → v1.4.3 | Powered by OpenKairo ₿
