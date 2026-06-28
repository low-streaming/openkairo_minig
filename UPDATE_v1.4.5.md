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

**Full Changelog**: v1.4.4 → v1.4.5 | Powered by OpenKairo ₿
