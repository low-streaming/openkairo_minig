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

    render() {
        return html`
      <div class="header">
        <h1>⚡ OpenKairo Mining ⚡</h1>
        <p class="subtitle">powered by OpenKairo</p>
      </div>

      <div class="tabs">
        <div class="tab ${this.activeTab === 'dashboard' ? 'active' : ''}" @click="${() => { this.activeTab = 'dashboard'; this.editingMinerId = null; }}">Dashboard</div>
        <div class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => { this.activeTab = 'settings'; this.editingMinerId = null; }}">Einstellungen & Miner verwalten</div>
      </div>

      <div class="content">
        ${this.activeTab === 'dashboard' ? this.renderDashboard() : this.renderSettings()}
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
                priceValue = this.hass.states[miner.price_sensor].state + ' c';
            }

            return html`
            <div class="miner-card">
              <div class="miner-header">
                <h3>${miner.name}</h3>
                <span class="prio-badge">Prio: ${miner.priority || '-'}</span>
              </div>
              
              <div class="miner-status">
                <span class="status-badge ${switchState === 'on' ? 'on' : switchState === 'off' ? 'off' : ''}">
                  ${switchState === 'on' ? 'AN ⚡' : switchState === 'off' ? 'AUS 💤' : switchState}
                </span>
              </div>
              
              <div class="miner-details">
                <p><b>Modus:</b> ${modeMap[miner.mode] || 'Unbekannt'}</p>
                <p><b>Schalter:</b> ${miner.switch || 'Nicht gesetzt'}</p>
                
                ${miner.mode === 'pv' ? html`
                  <p><b>PV Sensor:</b> ${pvValue}</p>
                  <p><b>Schwelle:</b> An &ge;${miner.pv_on}W | Aus &le;${miner.pv_off}W</p>
                ` : ''}

                ${miner.mode === 'price' ? html`
                  <p><b>Preis Sensor:</b> ${priceValue}</p>
                  <p><b>Schwelle:</b> An &le;${miner.price_on}c | Aus &ge;${miner.price_off}c</p>
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
        <h2>⚙️ Miner verwalten</h2>
        <p>Hier kannst du mehrere Miner mit verschiedenen Steckdosen, Modi und Prioritäten anlegen.</p>
        
        <button class="btn-primary" @click="${this.startAddMiner}">+ Neuen Miner hinzufügen</button>

        <div class="miner-list">
          ${this.config.miners && this.config.miners.length > 0 ? this.config.miners.map(miner => html`
            <div class="miner-list-item">
              <div>
                <strong>${miner.name}</strong> 
                <span class="prio-badge small">Prio: ${miner.priority || '-'}</span>
                <p class="small-text">Schalter: ${miner.switch} | Modus: ${miner.mode}</p>
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
        return html`
      <div class="card">
        <h2>${this.editingMinerId === 'new' ? 'Neuen Miner anlegen' : 'Miner bearbeiten'}</h2>
        
        <div class="form-row">
            <div class="form-group flex-2">
            <label>Name des Miners</label>
            <input type="text" name="name" .value="${this.editForm.name}" @input="${this.handleFormInput}">
            </div>
            <div class="form-group flex-1">
            <label>Priorität</label>
            <input type="number" name="priority" .value="${this.editForm.priority}" @input="${this.handleFormInput}">
            <small>1 = Höchste Priorität</small>
            </div>
        </div>

        <div class="form-group">
          <label>Schalter / Steckdose (Entity ID)</label>
          <input type="text" name="switch" placeholder="switch.miner_plug" .value="${this.editForm.switch || ''}" @input="${this.handleFormInput}">
        </div>

        <div class="form-group">
          <label>Betriebsmodus</label>
          <select name="mode" .value="${this.editForm.mode}" @change="${this.handleFormInput}">
            <option value="manual">Manuell (Nur Überwachung)</option>
            <option value="pv">PV-Überschuss (Einspeisung / Ertrag)</option>
            <option value="price">Strompreis (z.B. Tibber, aWATTar)</option>
          </select>
        </div>

        ${this.editForm.mode === 'pv' ? html`
          <div class="mode-section">
            <h3>☀️ PV-Überschuss Setup</h3>
            <div class="form-group">
                <label>PV-Sensor (z.B. Netzeinspeisung in Watt)</label>
                <input type="text" name="pv_sensor" placeholder="sensor.grid_export" .value="${this.editForm.pv_sensor || ''}" @input="${this.handleFormInput}">
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
          <div class="mode-section">
            <h3>💶 Dynamischer Strompreis Setup</h3>
            <div class="form-group">
                <label>Strompreis-Sensor (z.B. Tibber Preis in Cent/kWh)</label>
                <input type="text" name="price_sensor" placeholder="sensor.tibber_price" .value="${this.editForm.price_sensor || ''}" @input="${this.handleFormInput}">
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
            <button class="btn-save" @click="${this.saveForm}">Speichern</button>
        </div>
      </div>
    `;
    }

    static get styles() {
        return css`
      :host {
        display: block;
        padding: 20px;
        font-family: 'Inter', 'Roboto', sans-serif;
        background: var(--primary-background-color, #121212);
        min-height: 100vh;
        color: var(--primary-text-color, #ffffff);
      }
      .header {
        text-align: center;
        margin-bottom: 25px;
        background: linear-gradient(135deg, #FF8C00 0%, #FFA500 100%);
        padding: 30px;
        border-radius: 12px;
        color: #fff;
        box-shadow: 0 4px 15px rgba(255, 140, 0, 0.2);
      }
      .header h1 { margin: 0; font-size: 2.8em; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); }
      .subtitle { margin-top: 5px; font-size: 1.1em; opacity: 0.9; font-weight: 500; }
      
      .tabs { display: flex; justify-content: center; margin-bottom: 25px; gap: 15px; }
      .tab {
        padding: 12px 30px; background: var(--card-background-color, #1e1e1e); border-radius: 8px; cursor: pointer; font-weight: bold;
        transition: all 0.3s ease; border: 1px solid var(--divider-color, #333); color: var(--primary-text-color, #ccc);
      }
      .tab:hover { background: var(--secondary-background-color, #2a2a2a); transform: translateY(-2px); }
      .tab.active { background: #FF8C00; color: white; border-color: #FF8C00; }
      
      .content { max-width: 900px; margin: 0 auto; }
      .card { background: var(--card-background-color, #1e1e1e); border-radius: 12px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 20px; border: 1px solid var(--divider-color, #333); }
      .card h2 { margin-top: 0; border-bottom: 2px solid #FF8C00; padding-bottom: 10px; color: #FF8C00; }
      
      .empty-state { text-align: center; padding: 50px 20px; color: #aaa; }
      
      /* Grid for Miners Dashboard */
      .miners-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
      .miner-card { background: var(--secondary-background-color, #252525); border-radius: 10px; padding: 20px; border-left: 4px solid #FF8C00; border-top: 1px solid var(--divider-color, #333); border-right: 1px solid var(--divider-color, #333); border-bottom: 1px solid var(--divider-color, #333); }
      .miner-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 10px; margin-bottom: 15px; }
      .miner-header h3 { margin: 0; font-size: 1.3em; }
      .prio-badge { background: #333; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; color: #FF8C00; font-weight: bold; border: 1px solid #555;}
      .prio-badge.small { font-size: 0.75em; padding: 2px 6px; }
      .miner-status { display: flex; justify-content: center; margin-bottom: 15px; }
      .status-badge { padding: 8px 20px; border-radius: 20px; font-weight: bold; background: #444; color: #fff; text-align: center; width: 100%; font-size: 1.1em;}
      .status-badge.on { background: #4caf50; }
      .status-badge.off { background: #f44336; }
      .miner-details p { margin: 5px 0; font-size: 0.9em; color: var(--primary-text-color, #ddd); }
      
      /* List in Settings */
      .btn-primary { background: #FF8C00; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 20px; width: 100%; font-size: 1.05em; transition: 0.3s; }
      .btn-primary:hover { background: #e07b00; }
      
      .miner-list { display: flex; flex-direction: column; gap: 10px; }
      .miner-list-item { background: var(--input-background-color, #2a2a2a); padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #444; }
      .miner-list-item strong { font-size: 1.1em; color: #fff;}
      .small-text { margin: 5px 0 0 0; font-size: 0.85em; color: #aaa; }
      .empty-text { color: #888; font-style: italic; }
      .actions { display: flex; gap: 10px; }
      .btn-icon { background: none; border: none; font-size: 1.2em; cursor: pointer; padding: 5px; opacity: 0.7; transition: 0.2s; }
      .btn-icon:hover { opacity: 1; transform: scale(1.1); }
      
      /* Forms */
      .form-row { display: flex; gap: 15px; }
      .flex-1 { flex: 1; }
      .flex-2 { flex: 2; }
      .form-group { margin-bottom: 18px; }
      .form-group label { display: block; margin-bottom: 8px; font-weight: bold; font-size: 0.95em; color: var(--secondary-text-color, #bbb); }
      .form-group input, .form-group select { width: 100%; padding: 12px; border-radius: 6px; border: 1px solid var(--divider-color, #444); box-sizing: border-box; font-size: 1em; background: var(--input-background-color, #2a2a2a); color: var(--primary-text-color, #fff); }
      .form-group input:focus, .form-group select:focus { outline: none; border-color: #FF8C00; }
      .form-group small { display: block; margin-top: 5px; color: #888; font-size: 0.85em; }
      
      .mode-section { background: var(--secondary-background-color, #252525); padding: 20px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #FF8C00; }
      .mode-section h3 { margin-top: 0; font-size: 1.1em; color: #FF8C00; margin-bottom: 15px;}
      
      .form-actions { display: flex; gap: 15px; margin-top: 30px; }
      .btn-save { background: #FF8C00; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; flex: 2; font-weight: bold; font-size: 1.1em; transition: 0.3s;}
      .btn-save:hover { background: #e07b00; }
      .btn-cancel { background: #444; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; flex: 1; font-weight: bold; font-size: 1.1em; transition: 0.3s;}
      .btn-cancel:hover { background: #555; }
      
      @media (max-width: 600px) {
        .form-row { flex-direction: column; gap: 0; }
        .header h1 { font-size: 2em; }
        .miners-grid { grid-template-columns: 1fr; }
      }
    `;
    }
}

customElements.define("openkairo-mining-panel", OpenKairoMiningPanel);
