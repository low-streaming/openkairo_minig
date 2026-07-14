# 🐛 Update v1.4.10 — Hotfix: S21+/VNish startet nach Standby nicht wieder

---

## 🐛 Kritischer Bugfix — `resume_mining()` wurde bei VNish übersprungen

**Betroffen:** Alle nicht-Avalon Miner (S21+ VNish, BOS+ etc.) die API-gesteuert sind

**Problem:** In `services.py` wurde beim Einschalten eines VNish-Miners geprüft ob er bereits mieft:

```python
# Vorher (fehlerhaft):
if not coord.data.get("is_mining", True):   # Default = True ← BUG
    await miner.resume_mining()
```

**Zwei Fehler in einer Zeile:**

1. **Falscher Default (`True`)**: Wenn die Coordinator-Daten fehlen oder `is_mining` nicht vorhanden ist, wird `True` als Standardwert verwendet → `not True = False` → `resume_mining()` wird übersprungen. Der Miner bleibt im Standby, auch wenn er eingeschaltet werden soll.

2. **Kein None-Check auf `coord.data`**: Wenn der Coordinator noch keine Daten hat (`coord.data = None`), wirft `None.get(...)` einen `AttributeError`. Der gesamte `set_work_mode`-Service-Handler schlägt still fehl — der Miner bekommt gar keinen Befehl.

**Resultat beider Fehler:**
- S21+ bleibt im Standby (0W) nach Engine-turn_on
- Watchdog sieht nach 10 Min. weiterhin 0W → feuert Abschaltung
- Engine schaltet nach 90s (Dedup) wieder ein
- Schleife: 325+ Starts bei gleichbleibendem 0W-Verbrauch

**Fix:**
```python
# Nachher (korrekt):
if not (coord.data or {}).get("is_mining", False):   # Default = False → immer versuchen
    await miner.resume_mining()
```

- `(coord.data or {})` schützt gegen `None`-Daten
- Default `False` bedeutet: wenn Status unbekannt → sicherheitshalber `resume_mining()` aufrufen

---

**Full Changelog**: v1.4.9 → v1.4.10 | Powered by OpenKairo ₿
