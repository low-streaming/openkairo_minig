# 🚀 Updatebericht: OpenKairo Mining v1.2

Mit der **Version 1.2** liefert OpenKairo Mining ein wichtiges Stabilitätsupdate für alle Nutzer, die das Dashboard als Daueranzeige (z.B. auf Wand-Tablets) verwenden, sowie finale Namensanpassungen für das Projekt.

## ✨ Neue Features in v1.2

- **Ramping (Soft-Start & Soft-Stop):** 
  Wir haben eine komplett neue, mehrstufige Leistungs-Skalierung für kompatible Asic-Miner (mit einstellbarem `power_entity` via Hass-Miner) eingeführt. Der Miner kann nun beim Starten in festgelegten Watt-Schritten schonend hochgefahren und vor dem Abschalten ebenso sicher heruntergestuft werden. Dies entlastet die Hardware-Netzteile sowie das Hausstromnetz erheblich, gerade bei spontanem Wolkendurchzug.

- **Dual-Plug Support (2 Steckdosen):** 
  Viele Hochleistungs-Miner besitzen zwei separate Netzteile (und damit 2 getrennte Schukostecker-Anschlüsse). Es ist nun möglich, diese in den Miner-Settings ganz einfach auf eine *zweite* smarte Schaltsteckdose ("Schalter / Steckdose 2") zu verknüpfen. Beide Relais werden fortan vom System absolut zeitsynchron geschaltet, um Boot-Probleme bei getrennten Stromzufuhren vorzubeugen! *(Achtung: Grundsätzlich erfolgt der Parallelbetrieb von Hochstrom auf eigenen Gefahr.)*

## 🛠️ Fehlerbehebungen (Bugfixes)

- **"Black Screen" Fix für Dauer-Dashboards:** 
  In Home Assistant kann es vorkommen, dass Entitäten für den Bruchteil einer Sekunde keine zusätzlichen Attribute (wie `unit_of_measurement` oder `friendly_name`) senden (z.B. bei Integration-Reloads oder WLAN-Aussetzern). Dies führte in den Vorgängerversionen gelegentlich dazu, dass die gesamte Panel-Anzeige "abstürzte" und einfach schwarz wurde (bis zu einem manuellen Seiten-Reload). 
  In v1.2 wurde die gesamte Datenauswertung durch strenges *Optional Chaining* abgesichert, sodass fehlende Werte im Hintergrund einfach souverän ignoriert werden und die UI dauerhaft stabil bleibt!

## 🏷️ Rebranding & Systemanpassungen

- **Namensanpassung (Weg von Low-Streaming):**
  Alle internen und externen Namensreferenzen wurden endgültig von `low-streaming` auf `openkairo` zurückgeändert, um die Markenidentität einheitlich auf OpenKairo auszurichten. Dazu gehört auch der PayPal-Support-Link.
- Die Integration-Version in der `manifest.json` lautet nun offiziell **1.2.0**.

---

### Installation des Updates:
1. Im HACS-Store auf das OpenKairo Mining-Repository gehen und **Aktualisieren** klicken.
2. Zur Sicherheit den Browser-Cache löschen (oder STRG + F5 drücken), damit die alte JavaScript-Datei (`openkairo-mining-panel.js`) überschrieben wird.
3. Home Assistant kann optional neu gestartet werden.

*Powered by [openkairo.de](https://openkairo.de)*
