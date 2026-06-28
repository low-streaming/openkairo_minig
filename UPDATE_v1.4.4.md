# 🔧 Update v1.4.4 — Watchdog Default Fix

---

## 🔄 Änderung — `"off"` als Standard-Watchdog-Aktion

**Hintergrund:** In v1.4.3 wurde die `"off"` Aktion neu eingeführt und der Selector im Formular ergänzt. Der Default im Formular und die Engine-Fallback-Aktion zeigten jedoch noch auf `"toggle"`. Das bedeutete:

- **Neue Miner:** Selector stand korrekt auf `"off"` — aber erst nach v1.4.3-Update, wenn manuell gespeichert
- **Ältere Miner** (ohne `watchdog_action` im gespeicherten Config): Engine-Fallback griff auf `"toggle"` zurück statt auf `"off"`

**Fix:**

| Stelle | Vorher | Nachher |
|--------|--------|---------|
| `openkairo-mining-panel.js` — `startAddMiner` | `watchdog_action: 'toggle'` | `watchdog_action: 'off'` |
| `engine.py` — `_execute_watchdog_action()` | `miner.get("watchdog_action", "toggle")` | `miner.get("watchdog_action", "off")` |
| Selector-Reihenfolge im Formular | `toggle` oben mit "(Standard)" | `off` oben mit "(Standard)" |

---

**Full Changelog**: v1.4.3 → v1.4.4 | Powered by OpenKairo ₿
