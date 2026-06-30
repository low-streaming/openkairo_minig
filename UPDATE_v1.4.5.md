# ✨ Update v1.4.5 — Config Backup + Miner-Vorlagen + Watchdog Badge + State-Persistenz

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

**Full Changelog**: v1.4.4 → v1.4.5 | Powered by OpenKairo ₿
