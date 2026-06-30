# ✨ Update v1.4.5 — Config Backup + Miner-Vorlagen + Watchdog Badge + State-Persistenz + 20 Bugfixes

---

## ✨ Neu — Config Backup & Wiederherstellung

Vollständige Sicherung und Wiederherstellung der OpenKairo-Konfiguration mit einem Klick.

**⬇️ Export** — lädt `openkairo_config_YYYY-MM-DD.json` mit allen Minern und Einstellungen herunter.

**⬆️ Import** — lädt eine Backup-Datei, prüft die Struktur, fragt zur Bestätigung und ersetzt die gesamte Konfiguration. Alle Miner-Karten aktualisieren sich sofort.

Zu finden unter: **Einstellungen → 🗂 Config Backup**

---

## ✨ Neu — Miner-Vorlagen (Community-Sharing)

Regel-Einstellungen eines Miners exportieren, in andere Miner importieren oder mit der Community teilen — ohne gerätespezifische Daten (Name, IP, Switch, Sensoren).

**📋 Vorlage exportieren** — Klick auf das `📋` Symbol neben einem Miner in der Dashboard-Liste. Lädt `openkairo_template_Name.json`.

**📂 Vorlage laden** — Im Miner bearbeiten-Dialog: Datei wählen, Regel-Felder werden übernommen, Gerät bleibt unberührt.

**🔄 Einstellungen übernehmen von** — Dropdown im Edit-Dialog, kopiert Einstellungen direkt von einem anderen Miner der selben Installation.

Vorlagen enthalten `_type: "openkairo_miner_template"` und `_miner_model` als Marker — ideal zum Teilen auf GitHub oder Discord.

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

## 🔧 Fix — State-Persistenz nach HA-Neustart

**Problem:** Der Engine-State lag komplett im RAM. Nach jedem HA-Neustart gingen verloren:

- `today_runtime_s` / `today_energy_wh` → Tagesstatistiken weg
- `watchdog_last_action` → Cooldown-Schutz weg, Watchdog konnte sofort wieder feuern
- `off_since_actual` / `on_since_actual` → Min-Pause und Max-Laufzeit-Tracking weg

**Fix:** Relevante State-Felder werden alle ~5 Minuten und beim sauberen HA-Shutdown in `.storage/openkairo_mining_state.json` geschrieben und beim Engine-Start wiederhergestellt.

**Gespeicherte Felder:**

| Feld | Warum |
| ---- | ----- |
| `today_runtime_s` / `today_energy_wh` | Tagesstatistiken bleiben nach Neustart korrekt |
| `total_starts` | Gesamtzähler geht nicht verloren |
| `watchdog_last_action` | Cooldown-Schutz bleibt aktiv |
| `off_since_actual` / `on_since_actual` | Min-Pause und Max-Laufzeit korrekt |
| `stats_day` | Tag-Rollover erkennt ob Tagesreset schon passiert ist |

Session-Werte (`session_runtime_s`, `session_energy_wh`) und Ramping-State setzen bei Neustart bewusst zurück.

---

---

## 🐛 Bugfix — Überschussmodus (PV-Modus) funktionierte nicht zuverlässig

**Gemeldet von:** mehreren Nutzern (Discord / GitHub Issues)

**Problem:** Der PV-Überschussmodus schaltete Miner nicht oder zum falschen Zeitpunkt aus, und die automatische Leistungsanpassung berücksichtigte den echten Überschuss nicht.

---

### Bug 1 — Abschaltschwelle prüfte rohe PV statt echten Überschuss

**Ursache:** Das Einschalten basierte korrekt auf dem *echten Überschuss* (`PV - Hausverbrauch`), aber das Ausschalten prüfte immer die *rohe PV-Produktion* — unabhängig davon wie viel das Haus davon verbraucht.

```text
Beispiel:
  Hausstromsensor: 1200 W Verbrauch
  PV-Produktion:    800 W
  Echter Überschuss: −400 W (Miner sollte AUS sein)

  Abschaltschwelle: 500 W

  Vorher: 800 W (roh) > 500 W → Miner bleibt AN  ❌
  Nachher: −400 W (Überschuss) < 500 W → Miner schaltet AUS  ✅
```

**Fix:** `turn_off` prüft jetzt `effective_pv` (Überschuss) statt `pv_value` (roh), identisch zur Einschaltlogik.

---

### Bug 2 — Leistungsskalierung ignorierte Hausstromsensor

**Ursache:** Die automatische Leistungsanpassung (`soft_continuous_scaling` / proportional) skalierte immer auf die Roh-PV-Produktion. War ein `house_power_sensor` konfiguriert, bekam der Miner zu viel Leistung zugewiesen — er hätte den Überschuss berücksichtigen sollen.

```text
Beispiel:
  PV-Produktion: 1500 W, Hausverbrauch: 600 W
  Echter Überschuss: 900 W

  Vorher: Zielleistung = 1500 W × 0.95 = 1425 W  ❌ (zieht 525 W aus dem Netz)
  Nachher: Zielleistung = 900 W × 0.95 = 855 W  ✅
```

**Fix:** `_handle_continuous_scaling` bekommt `global_pv_surplus` übergeben und nutzt diesen Wert wenn vorhanden.

---

### Bug 3 — Surplus-Weitergabe bei Multi-Miner ignorierte gerade eingeschaltete Miner

**Ursache:** Bei mehreren Minern im PV-Modus wird der Überschuss nach jedem Miner für den nächsten reduziert. Die Reduktion prüfte aber nur ob der Miner *vor dem Tick* bereits an war — nicht ob er *in diesem Tick* eingeschaltet wurde. Ergebnis: Miner A und Miner B konnten beide den vollen Überschuss sehen und beide einschalten, obwohl nur einer gepasst hätte.

**Fix:** Surplus wird jetzt auch abgezogen wenn `turn_on_condition` für diesen Tick `True` ist (und nicht gleichzeitig `turn_off_condition`).

---

### Einrichtung — So konfigurierst du den Überschussmodus richtig

**Minimalkonfiguration (nur PV-Sensor):**

| Feld              | Wert                             | Beschreibung                   |
| ----------------- | -------------------------------- | ------------------------------ |
| Modus             | `PV-Überschuss`                  | PV-Modus aktivieren            |
| PV-Sensor         | z.B. `sensor.solaredge_ac_power` | Aktuelle PV-Produktion in Watt |
| Einschalten ab    | z.B. `800` W                     | Miner startet wenn PV ≥ 800 W  |
| Ausschalten unter | z.B. `400` W                     | Miner stoppt wenn PV < 400 W   |

> Der Abstand zwischen Ein- und Ausschaltschwelle verhindert ständiges Schalten bei wechselnder Bewölkung. Empfehlung: mindestens 200–300 W Abstand.

---

**Mit Hausstromsensor (empfohlen — echter Überschuss):**

Zusätzlich in den **globalen Einstellungen** (`Einstellungen → ⚙️ Allgemein`):

| Feld             | Wert                          | Beschreibung                         |
| ---------------- | ----------------------------- | ------------------------------------ |
| Haus-Stromsensor | z.B. `sensor.shelly_em_power` | Netto-Netzeinspeisung/-bezug in Watt |

> **Wichtig:** Der Sensor muss **negative Werte** liefern wenn Strom *bezogen* wird (typisch für Shelly EM, Tibber Pulse, etc. im "Einspeisung positiv"-Modus). Liefert dein Sensor positive Werte beim Bezug, funktioniert die Überschuss-Berechnung umgekehrt.

Mit diesem Sensor berechnet die Engine den echten Überschuss: `Überschuss = −Sensorwert`. Ein- und Abschaltschwellen beziehen sich dann auf diesen bereinigten Wert.

---

**Mit automatischer Leistungsanpassung:**

Unter `Leistungs-Skalierung` im Miner-Formular:

| Feld               | Wert                 | Beschreibung                               |
| ------------------ | -------------------- | ------------------------------------------ |
| Continuous Scaling | `An`                 | Automatische Leistungsanpassung aktivieren |
| Skalierungsmodus   | `Proportional`       | Folgt dem Überschuss gleitend (empfohlen)  |
| Skalierungsfaktor  | `0.95`               | Nutzt 95% des Überschusses (5% Puffer)     |
| Intervall          | `60` s               | Wie oft die Leistung angepasst wird        |
| Leistungs-Entity   | Miner Power-Sensor   | Wird vom Skalierungsalgorithmus gelesen    |

---

---

## 🔴 Kritischer Bugfix — Globale Einstellungen wurden nie angewendet

**Betroffen:** `house_power_sensor`, `fleet_max_power`, `pv_sensor` und alle anderen Felder aus dem „Allgemein"-Dialog.

**Problem:** Globale Einstellungen hatten nach dem Speichern scheinbar keine Wirkung. Die Engine las sie aus dem Root-Objekt der Konfiguration — der API-Handler schrieb sie aber in jeden einzelnen Miner. Da die Engine nie in den Miner-Einträgen nachschaute, waren alle globalen Einstellungen dauerhaft wirkungslos.

```text
Vorher:
  Konfiguration in DB: { miners: [{ house_power_sensor: "sensor.shelly" }] }  ← falsch
  Engine liest: config.get("house_power_sensor")  → None  ❌

Nachher:
  Konfiguration in DB: { house_power_sensor: "sensor.shelly", miners: [...] }  ← korrekt
  Engine liest: config.get("house_power_sensor")  → "sensor.shelly"  ✅
```

**Fix** (`__init__.py`): `update_global_config` schreibt jetzt direkt ins Root-Objekt der Konfiguration statt in jeden Miner.

---

## 🐛 Bugfix — Engine-Tick crashte bei leerem Prioritätswert

**Problem:** Wenn ein Miner keinen oder einen nicht-numerischen Prioritätswert hatte (z.B. Leerstring), crashte `int(priority)` mit einem `ValueError` — der gesamte Engine-Tick schlug fehl und kein Miner wurde für 15 Sekunden verarbeitet.

**Fix** (`engine.py`): Robuste Prioritätssortierung mit `isdigit()`-Guard und Fallback auf 99:

```python
sorted_miners = sorted(
    miners,
    key=lambda x: int(x.get("priority") or 99)
        if str(x.get("priority", "99")).strip().isdigit()
        else 99
)
```

---

## 🐛 Bugfix — Engine-Tick crashte bei Switch-Only-Minern (kein Miner-IP)

**Problem:** Miner ohne `miner_ip` (reine Schaltersteurung) hatten keinen `hashrate`-Eintrag im State-Dict. Der Engine-Code griff direkt mit `state["hashrate"]` darauf zu → `KeyError` → Engine-Tick-Abbruch für alle nachfolgenden Miner in der Runde.

**Fix** (`engine.py`): Sicherer Zugriff mit `.get()` und Fallback auf 0:

```python
# Vorher:
if state["hashrate"] > 0: ...

# Nachher:
if state.get("hashrate", 0) > 0: ...
```

---

## 🐛 Bugfix — max_runtime-Schutz feuerte nie bei Switch-Only-Minern

**Problem:** Das Feld `on_since_actual` (Startzeitpunkt für die Laufzeitmessung) wurde nur gesetzt wenn ein pyasic-Koordinator vorhanden war. Switch-Only-Miner haben keinen Koordinator → `on_since_actual` blieb `None` → die `max_runtime`-Prüfung erkannte nie eine Überschreitung → Miner konnte endlos laufen.

**Fix** (`engine.py`): `on_since_actual` wird jetzt außerhalb des Koordinator-Blocks gesetzt, sobald der Miner als eingeschaltet erkannt wird:

```python
# Wird jetzt für ALLE Miner gesetzt, auch ohne Koordinator:
if is_on and not state.get("on_since_actual"):
    state["on_since_actual"] = current_time
```

---

## 🐛 Bugfix — Division durch Null im KI-Modus bei fehlender Leistungskonfiguration

**Problem:** Im KI-Modus berechnete die Engine geschätzte Laufzeiten basierend auf der Miner-Leistung. War weder `soft_target_power` noch `max_power` gesetzt (z.B. neuer Miner ohne vollständige Konfiguration), war der Divisor 0 → `ZeroDivisionError`.

**Fix** (`engine.py`): Mindestleistung von 100 W als Untergrenze, und wenn der Miner läuft wird die echte Ist-Leistung aus dem State genutzt:

```python
miner_power = max(100.0, float(miner.get("soft_target_power") or miner.get("max_power") or 1200))
if is_on and state.get("power", 0) > 100:
    miner_power = state["power"]
```

---

## 🐛 Bugfix — Datei-Handle-Leaks (3 Stellen)

**Problem:** `open()` ohne `with`-Statement in `engine.py` (State laden/speichern) und `__init__.py` (Frontend-JS ausliefern). Exceptions nach dem `open()`-Aufruf konnten den Handle offen lassen → Datei blieb gesperrt → nächster Schreibversuch schlug fehl oder blockierte.

**Fix**: Alle Datei-Operationen in benannte Hilfsfunktionen mit `with`-Block verschoben:

```python
# Vorher (engine.py):
f = open(state_path, "r")
data = json.load(f)

# Nachher:
def _read_state():
    with open(state_path, "r", encoding="utf-8") as f:
        return json.load(f)
data = await hass.async_add_executor_job(_read_state)
```

Gleiches Muster für Schreiben (`_write_state`) und das Frontend-JS (`_read_js` in `__init__.py`).

---

## 🐛 Bugfix — Sensor-Entities dauerhaft als „nicht verfügbar" beim HA-Start

**Problem:** Wenn der Koordinator beim ersten Poll noch keine Daten hatte (`coordinator.data` war `None`), schlug `"raw_data" in None` mit einem `TypeError` fehl → alle Sensor-Entities meldeten sich als nicht verfügbar, auch nach erfolgreichem Poll.

**Fix** (`sensor.py`): `available`-Property prüft jetzt erst ob Daten vorhanden sind, bevor sie auf Keys zugreift:

```python
# Vorher:
return self.coordinator.available and "raw_data" in self.coordinator.data

# Nachher:
return (
    self.coordinator.available
    and bool(self.coordinator.data)
    and "raw_data" in self.coordinator.data
)
```

---

## 🐛 Bugfix — asyncio Task-Leaks bei Miner-Discovery

**Problem:** Bei der parallelen Miner-Erkennung (`coordinator.py`, `config_flow.py`) wurden laufende Tasks nach `asyncio.wait()` zwar abgebrochen (`t.cancel()`), aber nie awaited. Das asyncio-Event-Loop loggte `Task was destroyed but it is pending!`-Warnungen und Ressourcen blieben bis zum GC gebunden.

**Fix** (beide Dateien): Nach dem Cancel wird `asyncio.gather(*pending, return_exceptions=True)` awaited:

```python
for t in pending:
    t.cancel()
if pending:
    await asyncio.gather(*pending, return_exceptions=True)
```

---

---

## 🐛 Frontend-Bugfix — Klick auf Export / Import / Miner-hinzufügen crashte

**Problem:** Drei Buttons nutzten `@click="${this.exportConfig}"` (Methoden-Referenz ohne Bindung). In Lit-Komponenten verliert `this` in solchen Callbacks seinen Kontext → `TypeError: Cannot read properties of undefined` bei jedem Klick. Export, Import und „Miner hinzufügen" waren damit komplett defekt.

**Fix** (`openkairo-mining-panel.js`): Arrow-Function-Syntax stellt den richtigen Kontext sicher:

```js
// Vorher:
@click="${this.exportConfig}"
@change="${this.importConfig}"
@click="${this.startAddMiner}"

// Nachher:
@click="${() => this.exportConfig()}"
@change="${(e) => this.importConfig(e)}"
@click="${() => this.startAddMiner()}"
```

---

## 🐛 Frontend-Bugfix — Miner-Befehle wurden an veraltete Domain gesendet

**Problem:** `callMinerService` war zweifach definiert. Die zweite Definition überschrieb die erste (JavaScript). Die zweite Version sendete Befehle an die Domain `"miner"` statt `"openkairo_mining"` — alle Steuerungsbefehle (Ein/Aus, Power-Limit setzen etc.) schlugen damit lautlos fehl.

**Fix**: Zweite Definition als Dead Code vollständig entfernt. Nur die korrekte Implementierung mit `"openkairo_mining"` bleibt.

---

## 🐛 Frontend-Bugfix — Zahlen wurden als Strings in der Konfiguration gespeichert

**Problem:** `handleFormInput` las alle Formularwerte mit `event.target.value` aus — auch für `<input type="number">` und `<input type="range">`. `value` ist in JavaScript immer ein String. Damit wurden Felder wie `min_power`, `max_power`, `on_threshold` als `"800"` statt `800` gespeichert. Zahlenvergleiche in der Engine verhielten sich unerwartet.

**Fix**: Typkonvertierung basierend auf dem Input-Typ:

```js
const { type, value, checked } = event.target;
let finalValue;
if (type === 'checkbox') {
    finalValue = checked;
} else if (type === 'number' || type === 'range') {
    finalValue = value === '' ? '' : parseFloat(value);
} else {
    finalValue = value;
}
```

---

## 🐛 Frontend-Bugfix — Gesamt-Hashrate wurde doppelt gezählt

**Problem:** `btc_auto`-Miner wurden zur `totalHashrateTH`-Berechnung zweifach addiert — einmal im normalen Schleifendurchlauf und einmal in einem nachgelagerten Block. Das Dashboard zeigte damit die doppelte Hashrate an.

**Fix**: Doppelten Additionsblock entfernt. `totalHashrateTH` zählt jeden Miner jetzt genau einmal.

---

## 🐛 Frontend-Bugfix — „Mehr Info"-Dialog öffnete sich nicht

**Problem:** `showMoreInfo` nutzte `new Event('hass-more-info', ...)` statt `CustomEvent`. HA-Lovelace empfängt dieses Event nur wenn ein `detail`-Objekt mit `entityId` mitgegeben wird — `Event` unterstützt kein `detail`. Klick auf eine Entity in der Miner-Karte war damit wirkungslos.

**Fix**:

```js
// Vorher:
new Event('hass-more-info', { bubbles: true, composed: true })

// Nachher:
new CustomEvent('hass-more-info', {
    detail: { entityId },
    bubbles: true,
    composed: true
})
```

---

## 🐛 Frontend-Bugfix — Watchdog Countdown-Badge war dauerhaft unsichtbar

**Problem:** Die Anzeigebedingung für den Watchdog-Countdown-Badge prüfte `stState === 'on'` statt `switchState === 'on'`. `stState` ist der State des optionalen `standby_switch_2` — der ist bei den meisten Minern nicht konfiguriert und meldet `'Unbekannt'`. Damit blieb der Badge immer unsichtbar, selbst wenn der Watchdog aktiv zählte.

**Fix**:

```js
// Vorher:
if (hasWatchData && stState === 'on' && watchObj)

// Nachher:
if (hasWatchData && switchState === 'on' && watchObj)
```

---

## 🐛 Frontend-Bugfix — „Miner hinzufügen" erzeugte unvollständige Konfigurationen

**Problem:** `startAddMiner()` initialisierte das neue Miner-Objekt nur mit ~10 Grundfeldern. Öffnete man Formular-Tabs für Temperatur, Offgrid, PV oder Wetter, fehlten alle zugehörigen Felder. Der erste Speichern-Klick schrieb `undefined` in die Konfiguration → Engine-Fehler oder stille Fehlfunktionen bei neuangelegten Minern.

**Fix**: 17 fehlende Felder mit sinnvollen Standardwerten ergänzt:

```js
// Neu in startAddMiner():
miner_ip: '',
is_solo: false,
standby_switch_2: '',
target_temp_sensor: '',
target_temp_on: 21.0,
target_temp_off: 22.0,
offgrid_soc_mid: 94,
offgrid_mid_power: 800,
soft_target_power: null,
target_soc: 10,
target_time: '07:00',
battery_capacity: 10,
battery_power_sensor: '',
weather_optimization_enabled: false,
pv_peak_power: 10,
weather_lat: '',
weather_lon: '',
```

---

**Full Changelog**: v1.4.4 → v1.4.5 | Powered by OpenKairo ₿
