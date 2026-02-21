import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class OpenKairoMiningPanel extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            config: { type: Object },
            activeTab: { type: String },
            editingMinerId: { type: String },
            editForm: { type: Object }
        };
    }

    constructor() {
        super();
        this.config = { miners: [] };
        this.activeTab = 'dashboard';
        this.editingMinerId = null;
        this.editForm = {};
    }

    firstUpdated() {
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/openkairo_mining/data', {
                headers: {
                    'Authorization': `Bearer ${this.hass?.auth?.token?.access_token || ''}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.config && data.config.miners) {
                    this.config = data.config;
                } else {
                    this.config = { miners: [] };
                }
            }
        } catch (error) {
            console.error("Error loading config", error);
        }
    }

    async saveConfig() {
        try {
            await fetch('/api/openkairo_mining/data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.hass?.auth?.token?.access_token || ''}`
                },
                body: JSON.stringify(this.config)
            });
            alert('Einstellungen erfolgreich gespeichert!');
            this.editingMinerId = null; // Zurück zur Liste
        } catch (error) {
            console.error("Error saving config", error);
            alert('Fehler beim Speichern der Einstellungen.');
        }
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    startAddMiner() {
        this.editingMinerId = 'new';
        this.editForm = {
            id: this.generateId(),
            name: 'Neuer Miner',
            switch: '',
            mode: 'manual',
            priority: this.config.miners.length + 1,
            pv_on: 1000,
            pv_off: 500,
            price_on: 20,
            price_off: 25,
            pv_sensor: '',
            price_sensor: ''
        };
    }

    startEditMiner(miner) {
        this.editingMinerId = miner.id;
        this.editForm = { ...miner };
    }

    deleteMiner(id) {
        if (confirm("Möchtest du diesen Miner wirklich löschen?")) {
            this.config.miners = this.config.miners.filter(m => m.id !== id);
            this.saveConfig();
        }
    }

    cancelEdit() {
        this.editingMinerId = null;
    }

    handleFormInput(e) {
        const { name, value } = e.target;
        this.editForm = { ...this.editForm, [name]: value };
    }

    saveForm() {
        if (this.editingMinerId === 'new') {
            this.config.miners.push(this.editForm);
        } else {
            const index = this.config.miners.findIndex(m => m.id === this.editingMinerId);
            if (index > -1) {
                this.config.miners[index] = this.editForm;
            }
        }

        // Nach Priorität sortieren
        this.config.miners.sort((a, b) => parseInt(a.priority || 99) - parseInt(b.priority || 99));

        this.saveConfig();
    }

    // Helper Methode um Entitäten für Dropdowns zu bekommen
    getEntitiesByDomain(domainPrefix) {
        if (!this.hass) return [];

        // Prüft z.B. ob entityId mit 'switch.' oder 'input_boolean.' startet (bei Arrays)
        const prefixes = Array.isArray(domainPrefix) ? domainPrefix : [domainPrefix];

        return Object.keys(this.hass.states)
            .filter(entityId => prefixes.some(prefix => entityId.startsWith(prefix + '.')))
            .sort()
            .map(entityId => {
                const stateObj = this.hass.states[entityId];
                return {
                    id: entityId,
                    name: stateObj.attributes.friendly_name ? `${stateObj.attributes.friendly_name} (${entityId})` : entityId
                };
            });
    }

    render() {
        return html`
      <div class="header">
        <h1>₿ OpenKairo Mining ⚡</h1>
        <p class="subtitle">Intelligente Miner-Steuerung</p>
      </div>

      <div class="tabs">
        <div class="tab ${this.activeTab === 'dashboard' ? 'active' : ''}" @click="${() => { this.activeTab = 'dashboard'; this.editingMinerId = null; }}">Dashboard</div>
        <div class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => { this.activeTab = 'settings'; this.editingMinerId = null; }}">Einstellungen & Miner verwalten</div>
        <div class="tab ${this.activeTab === 'info' ? 'active' : ''}" @click="${() => { this.activeTab = 'info'; this.editingMinerId = null; }}">Info & Hilfe</div>
      </div>

      <div class="content">
        ${this.activeTab === 'dashboard' ? this.renderDashboard()
                : this.activeTab === 'settings' ? this.renderSettings()
                    : this.renderInfo()}
      </div>

      <div class="footer">
        <a href="https://openkairo.de" target="_blank">powered by OpenKAIRO</a>
      </div>
    `;
    }

    renderInfo() {
        return html`
      <div class="card">
        <h2>ℹ️ Informationen & Anleitung</h2>
        <p>Willkommen beim <strong>OpenKairo Mining</strong> Panel. Mit dieser Integration kannst du deine Miner intelligent und kosteneffizient steuern.</p>
        
        <div class="tech-box">
          <h3 style="margin-top:0; color:#F7931A;">⚙️ So funktioniert's:</h3>
          <ul style="color:#bbb; line-height:1.6; padding-left:20px;">
            <li><strong style="color:#ddd;">Prioritäten:</strong> Jeder Miner hat eine Priorität. Der Miner mit Priorität "1" wird als Erstes eingeschaltet, wenn genügend Überschuss vorhanden ist. Danach folgt "2" usw.</li>
            <li><strong style="color:#ddd;">PV-Überschuss:</strong> Nutze deinen eigenen Solarstrom! Der Miner schaltet sich automatisch ein, wenn du mehr Strom ins Netz einspeist, als deine gewählte Schwelle vorgibt.</li>
            <li><strong style="color:#ddd;">Günstiger Strom:</strong> Nutze Börsenpreise (z.B. Tibber)! Trage einen Preis-Sensor ein und der Miner läuft vollautomatisch nur unter einem bestimmten Cent-Betrag.</li>
          </ul>
        </div>

        <div class="tech-box" style="margin-top: 25px; text-align: center; border-color: rgba(247, 147, 26, 0.4); background: rgba(247, 147, 26, 0.05);">
          <h3 style="margin-top:0; color:#fff;">☕ Unterstütze das Projekt</h3>
          <p style="color:#bbb; margin-bottom: 25px;">Wenn dir diese Integration dabei hilft, die Kosten deiner Miner zu senken, würde ich mich über eine Kaffee-Spende für die Entwicklung sehr freuen!</p>
          <a href="https://paypal.me/OpenKAIRO" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none; width:auto; padding: 15px 40px; border-radius:30px; line-height:1;">
            ☕ Kaffee / Energy spendieren (PayPal)
          </a>
        </div>
      </div>
    `;
    }

    renderDashboard() {
        if (!this.config.miners || this.config.miners.length === 0) {
            return html`
        <div class="card empty-state">
          <h2>Keine Miner konfiguriert</h2>
          <p>Wechsle zu den Einstellungen, um deinen ersten Miner hinzuzufügen.</p>
        </div>
      `;
        }

        const modeMap = {
            'manual': 'Manuell',
            'pv': 'PV-Überschuss',
            'price': 'Dyn. Strompreis'
        };

        return html`
      <div class="miners-grid">
        ${this.config.miners.map(miner => {
            let switchState = 'Unbekannt';
            if (this.hass && miner.switch && this.hass.states[miner.switch]) {
                switchState = this.hass.states[miner.switch].state;
            }

            let pvValue = 'N/A';
            if (miner.mode === 'pv' && this.hass && miner.pv_sensor && this.hass.states[miner.pv_sensor]) {
                pvValue = this.hass.states[miner.pv_sensor].state + ' W';
            }

            let priceValue = 'N/A';
            if (miner.mode === 'price' && this.hass && miner.price_sensor && this.hass.states[miner.price_sensor]) {
                priceValue = this.hass.states[miner.price_sensor].state + ' ¢';
            }

            const friendlySwitchName = this.hass && this.hass.states[miner.switch] && this.hass.states[miner.switch].attributes.friendly_name
                ? this.hass.states[miner.switch].attributes.friendly_name
                : miner.switch;

            return html`
            <div class="miner-card">
              <div class="miner-header">
                <h3>${miner.name}</h3>
                <span class="prio-badge">Prio: ${miner.priority || '-'}</span>
              </div>
              
              <div class="miner-status">
                <span class="status-badge ${switchState === 'on' ? 'on' : switchState === 'off' ? 'off' : ''}">
                  ${switchState === 'on' ? 'MINING 🚀' : switchState === 'off' ? 'STANDBY 💤' : switchState}
                </span>
              </div>
              
              <div class="miner-details">
                <p><b>Modus:</b> <span class="accent-text">${modeMap[miner.mode] || 'Unbekannt'}</span></p>
                <p><b>Dose:</b> ${friendlySwitchName || 'Nicht gesetzt'}</p>
                
                ${miner.mode === 'pv' ? html`
                  <div class="tech-box">
                    <p><b>Aktueller PV-Wert:</b> <span class="highlight-val">${pvValue}</span></p>
                    <p class="small-text mt-1">Regeln: An &ge; ${miner.pv_on}W | Aus &le; ${miner.pv_off}W</p>
                  </div>
                ` : ''}

                ${miner.mode === 'price' ? html`
                  <div class="tech-box">
                    <p><b>Aktueller Preis:</b> <span class="highlight-val">${priceValue}</span></p>
                    <p class="small-text mt-1">Regeln: An &le; ${miner.price_on}¢ | Aus &ge; ${miner.price_off}¢</p>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        })}
      </div>
    `;
    }

    renderSettings() {
        if (this.editingMinerId) {
            return this.renderMinerForm();
        }

        return html`
      <div class="card">
        <h2>🛠 Miner verwalten</h2>
        <p>Hier legst du deine ASIC oder GPU Miner an und weist ihnen Steckdosen zu.</p>
        
        <button class="btn-primary" @click="${this.startAddMiner}">+ Neuen Miner hinzufügen</button>

        <div class="miner-list">
          ${this.config.miners && this.config.miners.length > 0 ? this.config.miners.map(miner => html`
            <div class="miner-list-item">
              <div>
                <strong>${miner.name}</strong> 
                <span class="prio-badge small">Prio: ${miner.priority || '-'}</span>
                <p class="small-text">Dose: ${miner.switch} <br> Modus: ${miner.mode}</p>
              </div>
              <div class="actions">
                <button class="btn-icon edit" @click="${() => this.startEditMiner(miner)}">✏️</button>
                <button class="btn-icon delete" @click="${() => this.deleteMiner(miner.id)}">🗑️</button>
              </div>
            </div>
          `) : html`<p class="empty-text">Noch keine Miner vorhanden.</p>`}
        </div>
      </div>
    `;
    }

    renderMinerForm() {
        const switchOptions = this.getEntitiesByDomain(['switch', 'input_boolean']);
        const sensorOptions = this.getEntitiesByDomain('sensor');

        return html`
      <div class="card edit-card">
        <h2 class="edit-title">${this.editingMinerId === 'new' ? 'Neuen Miner anlegen' : 'Miner bearbeiten'}</h2>
        
        <div class="form-row">
            <div class="form-group flex-2">
              <label>Name des Miners</label>
              <input type="text" name="name" placeholder="z.B. KS0 Pro" .value="${this.editForm.name}" @input="${this.handleFormInput}">
            </div>
            <div class="form-group flex-1">
              <label>Priorität</label>
              <input type="number" name="priority" .value="${this.editForm.priority}" @input="${this.handleFormInput}">
              <small>1 = Höchste Prio (startet zuerst)</small>
            </div>
        </div>

        <div class="form-group">
          <label>Schalter / Steckdose</label>
          <select name="switch" .value="${this.editForm.switch || ''}" @change="${this.handleFormInput}">
            <option value="">-- Steckdose für diesen Miner wählen --</option>
            ${switchOptions.map(opt => html`<option value="${opt.id}">${opt.name}</option>`)}
          </select>
          <small>Die Steckdose (Entity), an der der Miner angeschlossen ist.</small>
        </div>

        <div class="form-group mt-3">
          <label>Betriebsmodus</label>
          <select class="btc-select" name="mode" .value="${this.editForm.mode}" @change="${this.handleFormInput}">
            <option value="manual">Manuell (Nur Überwachung)</option>
            <option value="pv">PV-Überschuss (Einspeisung)</option>
            <option value="price">Günstiger Strompreis</option>
          </select>
        </div>

        ${this.editForm.mode === 'pv' ? html`
          <div class="mode-section btc-section">
            <h3>☀️ PV-Überschuss Steuerung</h3>
            <div class="form-group">
                <label>PV-Sensor (Netzeinspeisung/Ertrag in Watt)</label>
                <select name="pv_sensor" .value="${this.editForm.pv_sensor || ''}" @change="${this.handleFormInput}">
                  <option value="">-- Einspeise-/Watt-Sensor wählen --</option>
                  ${sensorOptions.map(opt => html`<option value="${opt.id}">${opt.name}</option>`)}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Einschalten ab (Watt)</label>
                    <input type="number" name="pv_on" .value="${this.editForm.pv_on}" @input="${this.handleFormInput}">
                </div>
                <div class="form-group flex-1">
                    <label>Ausschalten bei (Watt)</label>
                    <input type="number" name="pv_off" .value="${this.editForm.pv_off}" @input="${this.handleFormInput}">
                </div>
            </div>
          </div>
        ` : ''}

        ${this.editForm.mode === 'price' ? html`
          <div class="mode-section btc-section">
            <h3>💶 Dynamischer Strompreis Steuerung</h3>
            <div class="form-group">
                <label>Strompreis-Sensor (z.B. Tibber, in Cent/kWh)</label>
                <select name="price_sensor" .value="${this.editForm.price_sensor || ''}" @change="${this.handleFormInput}">
                  <option value="">-- Preis-Sensor wählen --</option>
                  ${sensorOptions.map(opt => html`<option value="${opt.id}">${opt.name}</option>`)}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Einschalten unter (Cent)</label>
                    <input type="number" step="0.1" name="price_on" .value="${this.editForm.price_on}" @input="${this.handleFormInput}">
                </div>
                <div class="form-group flex-1">
                    <label>Ausschalten über (Cent)</label>
                    <input type="number" step="0.1" name="price_off" .value="${this.editForm.price_off}" @input="${this.handleFormInput}">
                </div>
            </div>
          </div>
        ` : ''}

        <div class="form-actions">
            <button class="btn-cancel" @click="${this.cancelEdit}">Abbrechen</button>
            <button class="btn-save" @click="${this.saveForm}">Bitcoin-Miner speichern</button>
        </div>
      </div>
    `;
    }

    static get styles() {
        return css`
      :host {
        display: block;
        padding: 30px 20px;
        font-family: 'Inter', 'Roboto', sans-serif;
        background: radial-gradient(circle at center 0%, #201a14 0%, #0d0c0b 100%);
        min-height: 100vh;
        color: #e0e0e0;
      }
      
      .header {
        text-align: center;
        margin-bottom: 35px;
        padding: 10px;
      }
      .header h1 { 
        margin: 0; 
        font-size: 3.2em; 
        color: #F7931A; /* Bitcoin Orange */
        text-shadow: 0 0 20px rgba(247, 147, 26, 0.4);
        font-weight: 800;
        letter-spacing: -0.5px;
      }
      .subtitle { 
        margin-top: 10px; 
        font-size: 1.2em; 
        color: #8E9BAE; 
        text-transform: uppercase;
        letter-spacing: 2px;
        font-weight: 600;
      }
      
      .tabs { display: flex; justify-content: center; margin-bottom: 35px; gap: 15px; }
      .tab {
        padding: 14px 35px; 
        background: rgba(30, 30, 30, 0.6); 
        border: 1px solid rgba(247, 147, 26, 0.2); 
        border-radius: 8px; 
        cursor: pointer; 
        font-weight: 700;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 
        color: #a0a0a0;
        backdrop-filter: blur(10px);
      }
      .tab:hover { background: rgba(247, 147, 26, 0.1); color: #F7931A; transform: translateY(-2px); }
      .tab.active { 
        background: #F7931A; 
        color: #000; 
        border-color: #F7931A; 
        box-shadow: 0 5px 20px rgba(247, 147, 26, 0.3);
      }
      
      .content { max-width: 900px; margin: 0 auto; }
      
      /* Techy Cards */
      .card { 
        background: rgba(18, 18, 20, 0.85); 
        border-radius: 16px; 
        padding: 35px; 
        box-shadow: 0 10px 40px rgba(0,0,0,0.5); 
        margin-bottom: 25px; 
        border: 1px solid #2a2a2f; 
        backdrop-filter: blur(15px);
      }
      .card h2 { 
        margin-top: 0; 
        font-size: 1.8em;
        color: #F7931A; 
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 25px;
      }
      
      .empty-state { text-align: center; padding: 60px 20px; color: #777; border: 1px dashed #444; }
      
      /* Grid for Miners Dashboard */
      .miners-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 25px; }
      
      .miner-card { 
        background: linear-gradient(180deg, rgba(35,35,40,1) 0%, rgba(20,20,22,1) 100%);
        border-radius: 12px; 
        padding: 25px; 
        position: relative;
        border: 1px solid #333;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 5px 15px rgba(0,0,0,0.3);
        transition: transform 0.2s;
      }
      .miner-card:hover { border-color: #F7931A; transform: translateY(-3px); }
      .miner-card::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
        background: linear-gradient(90deg, #F7931A, #ffd800); border-radius: 12px 12px 0 0;
      }
      
      .miner-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 12px; margin-bottom: 18px; }
      .miner-header h3 { margin: 0; font-size: 1.5em; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.1); }
      .prio-badge { background: rgba(247, 147, 26, 0.15); padding: 4px 10px; border-radius: 6px; font-size: 0.85em; color: #F7931A; font-weight: bold; border: 1px solid rgba(247, 147, 26, 0.4);}
      .prio-badge.small { font-size: 0.75em; padding: 2px 6px; }
      
      .miner-status { display: flex; justify-content: center; margin-bottom: 20px; }
      .status-badge { 
        padding: 10px 20px; border-radius: 8px; font-weight: 800; 
        background: #111; color: #555; text-align: center; width: 100%; font-size: 1.2em;
        letter-spacing: 1px; border: 1px solid #222;
      }
      .status-badge.on { 
        background: rgba(39, 174, 96, 0.1); color: #2ecc71; 
        border-color: rgba(46, 204, 113, 0.4); text-shadow: 0 0 10px rgba(46, 204, 113, 0.5); 
      }
      .status-badge.off { 
        background: rgba(231, 76, 60, 0.1); color: #e74c3c; 
        border-color: rgba(231, 76, 60, 0.3); 
      }
      
      .miner-details p { margin: 8px 0; font-size: 0.95em; color: #bbb; }
      .accent-text { color: #F7931A; font-weight: bold; }
      
      .tech-box {
        background: rgba(0,0,0,0.3);
        border: 1px solid #2a2a2a;
        padding: 12px;
        border-radius: 8px;
        margin-top: 15px;
      }
      .highlight-val { font-size: 1.2em; font-weight: bold; color: #fff; font-family: monospace; }
      
      /* List in Settings */
      .btn-primary { 
        background: #F7931A; color: #000; border: none; padding: 14px 20px; border-radius: 8px; 
        cursor: pointer; font-weight: 800; margin-bottom: 25px; width: 100%; font-size: 1.1em; 
        transition: 0.3s; box-shadow: 0 4px 15px rgba(247, 147, 26, 0.3);
      }
      .btn-primary:hover { background: #ffaa33; box-shadow: 0 6px 20px rgba(247, 147, 26, 0.5); }
      
      .miner-list { display: flex; flex-direction: column; gap: 12px; }
      .miner-list-item { 
        background: rgba(25, 25, 30, 0.6); padding: 18px; border-radius: 10px; 
        display: flex; justify-content: space-between; align-items: center; border: 1px solid #333; 
        transition: 0.2s;
      }
      .miner-list-item:hover { border-color: #555; background: rgba(35, 35, 40, 0.8); }
      .miner-list-item strong { font-size: 1.2em; color: #fff; display: inline-block; margin-bottom: 5px;}
      .small-text { margin: 5px 0 0 0; font-size: 0.85em; color: #888; line-height: 1.4; }
      .empty-text { color: #888; font-style: italic; text-align: center; padding: 20px; }
      .actions { display: flex; gap: 12px; }
      .btn-icon { background: rgba(255,255,255,0.05); border: 1px solid #444; border-radius: 6px; font-size: 1.2em; cursor: pointer; padding: 8px; transition: 0.2s; color: white; }
      .btn-icon:hover { background: rgba(255,255,255,0.1); border-color: #666; transform: scale(1.05); }
      .btn-icon.delete:hover { border-color: #e74c3c; background: rgba(231, 76, 60, 0.1); }
      
      /* Forms */
      .form-row { display: flex; gap: 20px; }
      .flex-1 { flex: 1; }
      .flex-2 { flex: 2; }
      .form-group { margin-bottom: 22px; }
      .mt-3 { margin-top: 25px; }
      .form-group label { display: block; margin-bottom: 8px; font-weight: 600; font-size: 0.95em; color: #aaa; }
      
      /* Dropdowns and Inputs in Tech Theme */
      .form-group input, .form-group select { 
        width: 100%; padding: 14px 16px; border-radius: 8px; border: 1px solid #3a3a40; 
        box-sizing: border-box; font-size: 1em; background: rgba(10, 10, 12, 0.8); 
        color: #fff; transition: all 0.3s; font-family: inherit;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
      }
      .form-group input:focus, .form-group select:focus { outline: none; border-color: #F7931A; box-shadow: 0 0 0 2px rgba(247, 147, 26, 0.2); }
      
      /* Style Dropdown Options */
      .form-group select option { background: #1a1a1f; color: #fff; padding: 10px; }
      
      .form-group small { display: block; margin-top: 6px; color: #666; font-size: 0.85em; }
      
      .btc-section { 
        background: rgba(247, 147, 26, 0.03); 
        padding: 25px; border-radius: 10px; margin-top: 15px; 
        border: 1px dashed rgba(247, 147, 26, 0.3); 
        position: relative;
      }
      .btc-section h3 { margin-top: 0; font-size: 1.2em; color: #F7931A; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;}
      
      .form-actions { display: flex; gap: 20px; margin-top: 40px; }
      .btn-save { 
        background: #F7931A; color: #000; border: none; padding: 16px; border-radius: 8px; 
        cursor: pointer; flex: 2; font-weight: 800; font-size: 1.1em; transition: 0.3s;
        box-shadow: 0 4px 15px rgba(247, 147, 26, 0.3);
      }
      .btn-save:hover { background: #ffaa33; box-shadow: 0 6px 20px rgba(247, 147, 26, 0.5); transform: translateY(-2px); }
      .btn-cancel { 
        background: transparent; color: #aaa; border: 1px solid #555; padding: 16px; 
        border-radius: 8px; cursor: pointer; flex: 1; font-weight: bold; font-size: 1.1em; transition: 0.3s;
      }
      .btn-cancel:hover { background: rgba(255,255,255,0.05); color: #fff; border-color: #888; }
      
      @media (max-width: 600px) {
        .form-row { flex-direction: column; gap: 0; }
        .header h1 { font-size: 2.2em; }
        .miners-grid { grid-template-columns: 1fr; }
        .btn-cancel, .btn-save { flex: 1; }
      }

      .footer {
        text-align: center;
        margin-top: 50px;
        padding: 30px;
      }
      .footer a {
        color: #777;
        text-decoration: none;
        font-size: 0.9em;
        letter-spacing: 2.5px;
        text-transform: uppercase;
        font-weight: 800;
        transition: all 0.3s;
      }
      .footer a:hover {
        color: #F7931A;
        text-shadow: 0 0 15px rgba(247, 147, 26, 0.6);
      }
    `;
    }
}

customElements.define("openkairo-mining-panel", OpenKairoMiningPanel);
