# ✨ Update v1.4.8 — Konfigurierbarer Avalon Startmodus

---

## ✨ Feature — Avalon Startmodus wählbar (Eco / Standard / Super)

**Betroffen:** Avalon Q Home und alle Miner die per API gesteuert werden (kein physischer Smart-Plug als Switch)

**Problem:** Beim Einschalten eines Avalon-Miners über die Engine oder den Dashboard-Button wurde immer der Modus `normal` (Standard) gesetzt — unabhängig davon ob der Benutzer Eco-Betrieb oder High-Performance-Modus bevorzugt.

**Fix:** Neues optionales Konfigurationsfeld `avalon_work_mode` pro Miner. Wird beim Einschalten (`set_work_mode`) statt dem fest kodierten `"normal"` verwendet.

### Mögliche Werte

| Wert      | Avalon Modus          | API-Befehl                        |
|-----------|-----------------------|-----------------------------------|
| `low`     | Eco (Niedrigleistung) | `ascset 0,workmode,set,0`         |
| `normal`  | Standard *(Default)*  | `ascset 0,workmode,set,1`         |
| `high`    | Super (Vollleistung)  | `ascset 0,workmode,set,2`         |

> **Hinweis:** Der Modus betrifft nur die API-gesteuerte Einschalt-Sequenz. Der manuelle Modus-Wechsel per LOW/NORM/HIGH-Button im Dashboard funktioniert weiterhin unabhängig davon.

### Änderungen

**`switch.py`** — Neue Methode `_avalon_work_mode()`:
```python
def _avalon_work_mode(self) -> str:
    config = self.hass.data.get(DOMAIN, {}).get("config", {})
    for m in config.get("miners", []):
        if m.get("miner_ip") == self.coordinator.miner_ip:
            return m.get("avalon_work_mode", "normal")
    return "normal"
```

`async_turn_on()` übergibt jetzt `self._avalon_work_mode()` statt `"normal"` an `set_work_mode`.

**`openkairo-mining-panel.js`** — Dropdown im Miner-Formular unter "Native Hardware Integration":
- Optionen: Standard (Normal) / Eco (Low Power) / Super (High Performance)
- Default: Standard — rückwärtskompatibel, bestehende Konfigurationen nicht betroffen

---

**Full Changelog**: v1.4.7 → v1.4.8 | Powered by OpenKairo ₿
