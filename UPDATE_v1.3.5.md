# 🚀 Updatebericht: OpenKairo Mining v1.3.5 "Command Center"

Die Version **1.3.5** ist das bisher größte Update für OpenKairo Mining seit dem Release von Version 1.2. Sie verwandelt das Dashboard von einer statischen Anzeige in eine interaktive, Theme-basierte Kommandozentrale für Mining-Setups und beinhaltet dutzende Performance-Optimierungen.

Hier ist eine Zusammenfassung aller Neuerungen und Fixes:

## ✨ Neue Features in v1.3.5

### ⚡ Native ASIC Controller (Pyasic Integration)
Wir haben die komplette Backend-Architektur überarbeitet. Anstatt sich auf externe Proxys zu verlassen, werden nun native ASIC Firmware-Datenbanken (Antminer, Avalon, Whatsminer, BraiinsOS, Vnish) per **Pyasic** ausgelesen. Dies erzeugt (ähnlich wie beim Hass-Miner) dynamisch alle benötigten Sensoren und steuert Power Limit & Reboot direkt innerhalb von Home Assistant!

### 🎨 Theme & Design Manager
Das Dashboard muss nicht mehr langweilig aussehen. Über den neuen **"Design"-Tab** kannst du jetzt Live-Themes aufschalten:
- **Matrix & Solar:** Heller Cyberpunk- und Retro-Vibe.
- **Midnight & Atlantis:** Tiefes, sattes High-Tech Blau.
- **Lava Field:** Rote, pulsierende Akzente.
- **Gladbeck Edition:** Das "Solar-Module Gladbeck" Brand-Overdrive.
Das Design passt sich sofort farblich in allen Diagrammen, Knöpfen und Graphen dynamisch (via CSS) an.

### 📈 BTC Mempool & Market Engine
Der Dashboard-Kopfbereich zeigt nun in Echtzeit wichtige Bitcoin-Netzwerkdaten von `mempool.space` und `blockchain.info` an:
- Live Bitcoin-Preis in EUR/USD
- Empfohlene Netzwerk-Transaktionsgebühren (Low/Med/High in sat/vB)
- Voraussichtliche Difficulty-Adjustments (inkl. Live-Graphen)
- Blockhöhe & Halving-Countdown

### 📜 Automatisiertes "Logs"-Zentrum
Statt im dunklen Home Assistant Systemprotokoll zu wühlen, gibt es nun einen eigenen **"Logs"-Reiter** ganz rechts im Panel-Menü. OpenKairo speichert intern die letzten **100 Aktionen** und zeigt dir farblich markiert genau, *wann* und *warum* Schaltentscheidungen getroffen wurden:
- 🔵 **Info**: PV-Überschuss erkannt, Soft-Start eingeleitet (Hochfahren...).
- 🟢 **Erfolg**: Miner erfolgreich ans Netz gegangen.
- 🔴 **Warnung**: Fehler oder Hardware-Aufhänger (Watchdog-Trigger).
- ⚪ **Neutral**: Abschaltung wegen leerem Hausakku / zu wenig Sonne.

---

## 🛠️ Performance & Fehlerbehebungen (Bugfixes)

- **Home Assistant 2024.10+ & 2025 Kompatibilität**:
  - `500 Server Error (Config Flow)`: Die tiefe Umstrukturierung der Home Assistant Config-Flow-Klassen (`FlowResult` wurde veraltet) hat die Integration blockiert. Dies wurde gepatched (`ConfigFlowResult` Fallback integriert).
  - `UV Resolver Fix`: Der neue, viel strengere Home Assistant Paket-Manager hat die Installation von `pyasic` blockiert, weil eine Abhängigkeit (betterproto) ein Alpha-Release war. Dies wurde über ein manuelles Requirement Protocol in der `manifest.json` behoben.
- **Live UI Ramping Sync**: Der "Hochfahren 2/3" bzw. "Soft-Start"-Fortschritt wurde oft in der Benutzeroberfläche nicht sauber synchronisiert. Das Dashboard zwingt jetzt periodische Datenabgleiche (alle 15 Sekunden), wodurch auch der "Avalon Miner" direkt seinen Status ändert, wenn man ihn stumm/aktiv schaltet.
- **Watchdog "Unbekannt" Status**: Ein Darstellungsfehler, der den Watchdog im UI als "Unbekannt" betitelte, ist behoben.
- **Memory Leaks & Stabilität**: Diverse Caching-Lücken im Infinity Studio Builder und Backend wurden geschlossen, sodass auch Langzeit-Dashboards auf Tablets noch flüssig agieren.

### 💡 Update-Hinweis:
Nach einem Versionsupdate über HACS auf v1.3.5 empfiehlt es sich **immer**, den Home Assistent einmal komplett neu zu starten und im Vorfeld bei geöffnetem Dashboard Cache und Cookies zu flashen (`STRG + F5` im Windows-Browser oder Swipe-Down-To-Refresh am Handy), damit die neuen Layout-Funktionen und das Log-Skript von Home Assistant geladen werden!

*Powered by [openkairo.de](https://openkairo.de)*
