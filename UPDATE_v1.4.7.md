# 🐛 Update v1.4.7 — Hotfix: STOPP-Button + Watchdog

---

## 🐛 Kritischer Bugfix — STOPP-Button und Engine-Abschaltung wirkten nicht für API-gesteuerte Miner

**Betroffen:** Avalon Q Home, S21+ (VNish) und alle Miner **ohne physischen Smart-Plug** als Switch

**Problem:** In v1.4.6 wurde `MinerMiningSwitch.async_turn_off()` vereinfacht um Hashboard-Reconnects beim NerdAxe zu beheben. Die Vereinfachung entfernte jedoch auch den API-Call für Miner die ausschließlich über ihre Firmware-API gesteuert werden (Avalon `softoff`, VNish `stop_mining`).

Resultat: 
- STOPP-Button im Dashboard → Miner läuft weiter
- Engine-SOC/PV-Abschaltlogik greift → Miner läuft weiter  
- Nur das Override-Flag in HA wurde gesetzt, kein Befehl an den Miner

```text
Vorher (v1.4.6):
  Engine: switch.turn_off → async_turn_off() → _override=False → nichts passiert ❌
  Avalon läuft weiter mit 1704W / 94.8 TH/s

Nachher (v1.4.7):
  Engine: switch.turn_off → async_turn_off() → _override=False + set_work_mode(standby) ✅
  Avalon geht in Standby (Avalon-native softoff, kein Reconnect)
```

**Fix** (`switch.py`): Neue Methode `_is_api_controlled()` erkennt ob dieser Switch-Entity der primäre Steuer-Mechanismus ist:

```python
def _is_api_controlled(self) -> bool:
    config = self.hass.data.get(DOMAIN, {}).get("config", {})
    for m in config.get("miners", []):
        if m.get("miner_ip") == self.coordinator.miner_ip:
            sw = m.get("switch", "")
            return not sw or "mining_aktiv" in sw
    return True
```

- `switch`-Feld leer **oder** zeigt auf die OpenKairo `mining_aktiv`-Entity → API-gesteuert → `set_work_mode` wird aufgerufen
- `switch`-Feld zeigt auf externe Entity (z.B. `switch.nerdaxe`, `switch.shellyplugsg3_...`) → physisch gesteuert → kein API-Call (NerdAxe-Reconnect-Bug bleibt behoben)

---

## 🐛 Kritischer Bugfix — Watchdog wurde nie ausgeführt

**Problem:** Der Standby-Watchdog war im Dashboard konfigurierbar und die API berechnete korrekt `watchdog_remaining` für die Anzeige — aber die eigentliche Watchdog-Aktion (Abschalten, Toggle, Reboot) wurde **nie** in der Engine ausgeführt. Der Code fehlte vollständig in `engine.py`.

**Fix** (`engine.py`): Neue Methode `_process_watchdog` wird nach jedem Engine-Tick für aktivierte Miner aufgerufen:

- Liest den überwachten Wert (Verbrauch-Sensor oder Power-Limit-Entity, je nach `watchdog_type`)
- Startet `standby_since`-Timer wenn Wert unter Schwelle fällt
- Feuert die konfigurierte Aktion wenn die Wartezeit (`standby_delay`) abgelaufen ist:
  - `off` → Switch ausschalten (Miner bleibt aus bis Modus-Regel greift)
  - `toggle` → Switch aus → 5s warten → Switch an (Neustart der Steckdose)
  - `reboot` → Hardware-Reboot via Miner-API
  - `restart_backend` → nur Mining-Software neu starten
- Cooldown: nach einer Aktion wartet die Engine mindestens `max(delay, 5min)` bevor sie erneut prüft
- `watchdog_last_action` wird in `.storage/openkairo_mining_state.json` persistiert → Cooldown überlebt HA-Neustart

---

**Full Changelog**: v1.4.6 → v1.4.7 | Powered by OpenKairo ₿
