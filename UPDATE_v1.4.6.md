# 🔧 Update v1.4.6 — Stabilitäts-Update: Engine-Schutz, Config-Lock, Switch-Rework

---

## 🐛 Bugfix — Engine schickte turn_on an unavailable Switches (Zigbee/Z2M-Dropout)

**Problem:** Wenn ein Schalter-Entity (z.B. `switch.nerdaxe` über Zigbee2MQTT) kurz auf `"unavailable"` ging — z.B. durch einen Zigbee-Dropout oder Z2M-Neustart — lieferte `_detect_miner_state()` `is_on = False` zurück (weil `"unavailable" != "on"`). War gleichzeitig eine Einschaltbedingung aktiv (PV-Überschuss, SOC hoch), feuerte `_execute_conditions()` alle 90 Sekunden `switch.turn_on` gegen das nicht-erreichbare Entity.

**Symptome:**
- Log: wiederholte `"⚡ [Miner] wird eingeschaltet"` Einträge im 90-Sekunden-Takt
- `total_starts` wurde fälschlicherweise hochgezählt
- HA verwarf den Befehl lautlos (unavailable Entity ignoriert Commands)

```text
Vorher:
  switch.nerdaxe = unavailable
  is_on = False
  turn_on_condition = True
  → turn_on() alle 90s ❌ (total_starts +1 pro Zyklus)

Nachher:
  switch.nerdaxe = unavailable
  switches_all_unavailable = True
  → turn_on übersprungen, Timer nicht zurückgesetzt ✅
  → sobald Switch wieder "on"/"off", greift der normale 90s-Cooldown
```

**Fix** (`engine.py`, `_execute_conditions`): Vor dem turn_on-Aufruf wird geprüft ob alle konfigurierten Switches `"unavailable"` melden. Wenn ja, wird der Schaltbefehl übersprungen — ohne den `_last_turn_on_ts`-Timer zurückzusetzen. Sobald der Switch wieder erreichbar ist, greift der normale 90-Sekunden-Cooldown.

```python
switches_all_unavailable = bool(switches) and all(
    self.hass.states.get(s) is not None and self.hass.states.get(s).state == "unavailable"
    for s in switches
)
if switches_all_unavailable:
    return
```

Der Power-Sensor-Fallback (`is_on = True` wenn Verbrauch > Schwellenwert) bleibt weiterhin aktiv — Miner ohne konfigurierten Switch oder mit laufendem Verbrauch sind davon nicht betroffen.

---

## 🐛 Bugfix — Race Condition beim Schreiben der Config bei Mehrminer-Setup

**Problem:** Bei mehreren konfigurierten Minern wurden beim HA-Start mehrere `sync_with_config`-Tasks gleichzeitig gestartet — einer pro Config-Entry. Alle schlafen 5 Sekunden, lesen dann gleichzeitig die Config-Datei (noch leer / nur ältere Einträge), erstellen je ihren eigenen Miner-Eintrag und schreiben zurück. Der letzte Write-Vorgang gewinnt — alle anderen Miner-Einträge gehen verloren.

```text
Vorher:
  t=0s  Task A gestartet, Task B gestartet
  t=5s  Task A liest config.json → { miners: [] }
  t=5s  Task B liest config.json → { miners: [] }
  t=5s  Task A schreibt → { miners: [MinerA] }
  t=5s  Task B schreibt → { miners: [MinerB] }  ← MinerA verloren ❌

Nachher:
  t=5s  Task A holt Lock, liest, schreibt → { miners: [MinerA] }, gibt Lock frei
  t=5s  Task B holt Lock, liest → { miners: [MinerA] }, schreibt → { miners: [MinerA, MinerB] } ✅
```

**Fix** (`__init__.py`): Ein `asyncio.Lock` wird domain-weit in `hass.data[DOMAIN]["_config_lock"]` gespeichert. Alle `sync_with_config`-Läufe serialisieren sich über diesen Lock — der zweite Task liest die Config erst wenn der erste fertig geschrieben hat.

---

## 🐛 Bugfix — Fehler in sync_with_config wurden lautlos verschluckt

**Problem:** `sync_with_config` hatte kein `try/except`. Jede unerwartete Exception (z.B. Entity-Registry-Fehler, Schreibfehler auf der Config-Datei, temporäre HA-Interna nicht verfügbar) propagierte als `Unhandled exception in task` in das HA-Log — der Task wurde verworfen, der Miner nie in `config.json` eingetragen und die Engine lief ohne Automatisierungs-Konfiguration.

**Fix** (`__init__.py`): Der gesamte Body von `sync_with_config` ist jetzt in `try/except Exception` gewrappt. Fehler werden mit `_LOGGER.error(...)` inkl. IP-Adresse geloggt statt als nicht-behandelte Ausnahme zu verschwinden.

---

## 🔧 Rework — Switch-Entity ohne Miner-API-Calls

**Problem (vorige Version):** `MinerMiningSwitch.async_turn_on()` rief intern `set_work_mode(normal)` → `resume_mining()` über pyasic auf. Da die Engine diesen Switch alle 15 Sekunden als Einschalt-Mechanismus nutzte, verursachte jeder Engine-Tick einen API-Call gegen den Miner — was bei NerdAxe und vergleichbaren Geräten zu Hashboard-Reconnects (Mining-Unterbrechungen) alle 15 Sekunden führte.

**Fix** (`switch.py`): `async_turn_on()` und `async_turn_off()` setzen nur noch den internen Override-Wert in `hass.data` und schreiben den HA-State — kein Miner-API-Call, kein pyasic-Aufruf.

```python
# Vorher:
async def async_turn_on(self, **kwargs):
    await self.hass.services.async_call(DOMAIN, "set_work_mode", {"mode": "normal", ...})

# Nachher:
async def async_turn_on(self, **kwargs):
    self._set_override(True)
    self.async_write_ha_state()
```

Die eigentliche Schaltlogik (turn_on/turn_off des physischen Steckdosen-Schalters) liegt weiterhin komplett in der Engine.

---

## 🔧 Fix — Switch-Entity `available` immer True

**Problem:** `MinerMiningSwitch.available` gab `self.coordinator.available` zurück wenn kein Override gesetzt war. Wenn der Koordinator den Miner-API nicht erreichen konnte (z.B. während des Starts, wenn der Miner gerade hochfährt), war der Switch als `unavailable` markiert — HA filterte Service-Calls für unavailable Entities still heraus. Engine-Befehle wurden verworfen.

**Fix** (`switch.py`): `available` gibt immer `True` zurück. Der OpenKairo-Switch ist ein Steuer-Entity, kein Sensor — Service-Calls müssen immer ankommen.

---

## 🔧 Fix — Switch is_on liest Engine-State als Fallback

**Problem:** Wenn der physische Schalter (`switch.nerdaxe`) den Strom kontrolliert und der Miner gerade hochfährt, kann der Koordinator die Miner-API noch nicht erreichen (`is_mining = False`). Der OpenKairo-Switch zeigte dann `off` — obwohl der Miner tatsächlich läuft.

**Fix** (`switch.py`): `is_on` prüft jetzt zuerst den Override, dann `engine.miner_states[miner_id]["is_on"]` (den detektierten Zustand des physischen Schalters aus dem Engine-Tick), und erst als letzten Fallback `coordinator.data.get("is_mining")`.

```python
@property
def is_on(self):
    override = self._get_override()
    if override is not None:
        return override
    engine = self.hass.data.get(DOMAIN, {}).get("engine")
    if engine and engine.miner_states:
        # ... engine state lookup by miner_ip
    return self.coordinator.data.get("is_mining", False)
```

---

## 🔧 Fix — battery_hysteresis entfernt

**Problem:** Der versteckte `battery_hysteresis`-Puffer (Standard: 2%) inflationierte den SOC-Einschaltschwellenwert still. Bei `soc_on = 18%` und `battery_hysteresis = 2%` benötigte die Engine tatsächlich 20% SOC zum Einschalten — ohne dass das im UI sichtbar war.

**Fix** (`engine.py`): `battery_hysteresis` komplett entfernt. Der konfigurierte `soc_on`-Wert wird direkt verwendet.

```python
# Vorher:
turn_on = battery_soc >= soc_on + battery_hysteresis

# Nachher:
turn_on = battery_soc >= soc_on
```

---

## 🎨 UI — „Sicherheit & Grenzen"-Panel entfernt

Die Felder `max_temp`, `max_runtime` und `min_off_time` sind aus dem Miner-Formular entfernt. Die Oberfläche ist damit schlanker und klarer — Felder die selten genutzt wurden und bei falscher Konfiguration zu unerwartetem Verhalten führten.

---

**Full Changelog**: v1.4.5 → v1.4.6 | Powered by OpenKairo ₿
