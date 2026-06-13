# 🚀 Update v1.4.0 — "Stability & Zero-Click Automation"

Dieses Update konzentriert sich auf **Stabilität**, **vereinfachte Einrichtung** und eine komplett überarbeitete Benutzeroberfläche. Kein Feature-Overload — stattdessen funktioniert alles was versprochen wurde jetzt auch wirklich.

---

## 🐛 Kritische Bugfixes (Engine)

### Fix 1 — Miner ohne Schalter erschien immer als "An"
Ein Python-Bug (`all([]) == True`) sorgte dafür, dass ein Miner **ohne konfigurierten Schalter** vom Engine dauerhaft als eingeschaltet erkannt wurde. Alle Modi die auf dem Schaltzustand basieren (PV, SOC, Heizung) haben dadurch falsch reagiert.

### Fix 2 — Watchdog löste nie die konfigurierte Aktion aus
Der Standby-Watchdog hat immer nur `turn_off` auf `standby_switch` ausgeführt — unabhängig davon ob `reboot`, `restart_backend` oder `toggle` konfiguriert war. Da die meisten Nutzer keinen separaten `standby_switch` konfigurieren, hat der Watchdog **für fast alle Nutzer nie funktioniert**. Komplett neu implementiert mit:
- Korrekte Ausführung von `toggle`, `reboot` und `restart_backend`
- Fallback auf den Haupt-Miner-Schalter wenn kein separater Watchdog-Schalter gesetzt ist

---

## ⚡ PV-Modus: Leistungstracking ohne Konfigurationsaufwand

**Vorher**: PV-Modus schaltete den Miner nur ein/aus. Für echtes Leistungstracking (Watt folgt dem Überschuss) musste der Nutzer:
- `soft_continuous_scaling` in einem anderen Abschnitt aktivieren
- `scaling_mode` und `scaling_factor` in einem weiteren Abschnitt konfigurieren

**Jetzt**: Wenn ein **Power-Limit Sensor** gesetzt ist, trackt der PV-Modus den Überschuss **automatisch** — kein Opt-In nötig. Standard-Skalierung ist jetzt `proportional` (besser für Solar als `steps`).

Der Tracking-Status wird direkt im PV-Formular angezeigt:
- ✅ Grüner Block "⚡ Leistungs-Tracking aktiv" wenn Power-Sensor vorhanden
- ⚠️ Oranger Hinweis wenn noch kein Power-Sensor gesetzt

---

## 🎛️ UI-Verbesserungen

### Leistungs-Skalierung
- Sektion ist jetzt **versteckt wenn "Automatische Nachskalierung" aus** ist — kein Einstellungsblock mehr der ins Leere führt
- **⚡ Auto-Button** bei den Soft-Start/Stop-Abstufungen: berechnet 4 gleichmäßige Stufen zwischen Min. und Max. Leistung, befüllt Start- und Stopp-Abstufungen automatisch

### Duplikat-Leistungsfeld entfernt
`soft_target_power` aus dem Soft-Start-Bereich entfernt. Die Engine nutzt jetzt überall `max_power` als Zielleistung — ein Feld, eine Quelle.

### Live-Sensor-Werte im Formular
- **Heizmodus**: Temperatursensor zeigt sofort "📍 Aktuell: 19.5 °C"
- **AI-Modus**: Batteriesensor zeigt sofort "🔋 Aktuell: 78 %"

### AI-Modus
- `target_time` ist jetzt ein nativer **Zeit-Picker** statt Freitextfeld
- "Usable Capacity." → "Nutzbare Kapazität des Akkus"

### Batterie-Mindestwert
`battery_min_soc` Default von 100% auf **50%** geändert (in PV- und Heizmodus). 100% als Default bedeutete: Batterie-Unterstützung ist aktiviert aber praktisch nie aktiv.

### Soft-Start / Nachskalierung
`soft_continuous_scaling`-Checkbox ist im **PV-Modus ausgeblendet** (nicht mehr nötig). Im SOC/Heizmodus bleibt sie erhalten, wurde umbenannt zu "Automatische Nachskalierung (SOC/Heizung)".

---

## 📊 Neue HA-Sensoren (Session-Statistiken)

Pro Miner werden jetzt **5 HA-Sensor-Entitäten** automatisch erstellt:
| Sensor | Beschreibung |
|--------|-------------|
| `session_runtime_s` | Laufzeit der aktuellen Session (Sekunden) |
| `today_runtime_s` | Gesamtlaufzeit heute (Sekunden) |
| `session_energy_wh` | Verbrauchte Energie diese Session (Wh) |
| `today_energy_wh` | Verbrauchte Energie heute (Wh) |
| `total_starts` | Gesamte Einschalt-Zählungen |

---

## 🔧 Weitere Fixes
- `max_runtime` Einheit war fälschlicherweise als Minuten dokumentiert — es sind **Stunden**
- Leistungs-Slider-Maximum in der Miner-Karte nutzt jetzt korrekt `max_power`
- Watchdog `watchdog_type = "limit"` (Power-Entity statt Verbrauchssensor) wird jetzt korrekt ausgewertet

---

**Full Changelog**: v1.3.21 → v1.4.0 | Powered by OpenKairo ₿
