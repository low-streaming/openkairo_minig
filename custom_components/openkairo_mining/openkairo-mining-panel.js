import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class OpenKairoMiningPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      narrow: { type: Boolean },
      route: { type: Object },
      panel: { type: Object },
      config: { type: Object },
      activeTab: { type: String }
    };
  }

  constructor() {
    super();
    this.config = { mode: 'manual', pv_on_threshold: 1000, pv_off_threshold: 200, price_on_threshold: 20, price_off_threshold: 25 };
    this.activeTab = 'dashboard';
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
        if (data.config && Object.keys(data.config).length > 0) {
            this.config = data.config;
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
    } catch (error) {
      console.error("Error saving config", error);
      alert('Fehler beim Speichern der Einstellungen.');
    }
  }

  handleInputChange(e) {
    const { name, value } = e.target;
    this.config = { ...this.config, [name]: value };
  }

  render() {
    return html`
      <div class="header">
        <h1>⚡ OpenKairo Mining ⚡</h1>
        <p class="subtitle">powered by OpenKairo</p>
      </div>

      <div class="tabs">
        <div class="tab ${this.activeTab === 'dashboard' ? 'active' : ''}" @click="${() => this.activeTab = 'dashboard'}">Dashboard</div>
        <div class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => this.activeTab = 'settings'}">Einstellungen</div>
      </div>

      <div class="content">
        ${this.activeTab === 'dashboard' ? this.renderDashboard() : this.renderSettings()}
      </div>
    `;
  }

  renderDashboard() {
    const modeMap = {
      'manual': 'Manuell',
      'pv': 'PV-Überschuss',
      'price': 'Dynamischer Strompreis'
    };

    let switchState = 'Unbekannt';
    if (this.hass && this.config.miner_switch && this.hass.states[this.config.miner_switch]) {
      switchState = this.hass.states[this.config.miner_switch].state;
    }

    let pvValue = 'N/A';
    if (this.hass && this.config.pv_sensor && this.hass.states[this.config.pv_sensor]) {
      pvValue = this.hass.states[this.config.pv_sensor].state + ' W';
    }

    let priceValue = 'N/A';
    if (this.hass && this.config.price_sensor && this.hass.states[this.config.price_sensor]) {
      priceValue = this.hass.states[this.config.price_sensor].state + ' Cent';
    }

    return html`
      <div class="card">
        <h2>📊 Aktueller Status</h2>
        <p>Übersicht der Mining-Automatisierung</p>
        <div class="status-grid">
          <div class="status-item">
              <h3>Betriebsmodus</h3>
              <p><b>${modeMap[this.config.mode] || 'Unbekannt'}</b></p>
          </div>
          <div class="status-item">
              <h3>Miner Status (${this.config.miner_switch || 'nicht gesetzt'})</h3>
              <p class="status-badge ${switchState === 'on' ? 'on' : switchState === 'off' ? 'off' : ''}">
                ${switchState === 'on' ? 'AN ⚡' : switchState === 'off' ? 'AUS 💤' : switchState}
              </p>
          </div>
          
          ${this.config.mode === 'pv' ? html`
            <div class="status-item">
                <h3>Aktueller PV-Wert</h3>
                <p>${pvValue}</p>
            </div>
            <div class="status-item">
                <h3>Schwellenwerte</h3>
                <p>An: >= ${this.config.pv_on_threshold}W | Aus: <= ${this.config.pv_off_threshold}W</p>
            </div>
          ` : ''}

          ${this.config.mode === 'price' ? html`
            <div class="status-item">
                <h3>Aktueller Strompreis</h3>
                <p>${priceValue}</p>
            </div>
            <div class="status-item">
                <h3>Schwellenwerte</h3>
                <p>An: <= ${this.config.price_on_threshold}c | Aus: >= ${this.config.price_off_threshold}c</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderSettings() {
    return html`
      <div class="card">
        <h2>⚙️ Einstellungen</h2>
        
        <div class="form-group">
          <label>Betriebsmodus</label>
          <select name="mode" .value="${this.config.mode || 'manual'}" @change="${this.handleInputChange}">
            <option value="manual">Manuell (Nur Überwachung)</option>
            <option value="pv">PV-Überschuss (Einspeisung / Ertrag)</option>
            <option value="price">Strompreis (z.B. Tibber, aWATTar)</option>
          </select>
        </div>

        <div class="form-group">
          <label>Miner Schalter / Steckdose (Entity ID)</label>
          <input type="text" name="miner_switch" placeholder="switch.miner_plug" .value="${this.config.miner_switch || ''}" @input="${this.handleInputChange}">
          <small>Der Schalter, der den Miner ein- und ausschaltet.</small>
        </div>

        ${this.config.mode === 'pv' ? html`
          <div class="mode-section">
            <h3>☀️ PV-Überschuss Setup</h3>
            <div class="form-group">
                <label>PV-Sensor (z.B. Netzeinspeisung in Watt)</label>
                <input type="text" name="pv_sensor" placeholder="sensor.grid_export" .value="${this.config.pv_sensor || ''}" @input="${this.handleInputChange}">
            </div>
            <div class="form-group">
                <label>Einschalt-Schwelle (Watt)</label>
                <input type="number" name="pv_on_threshold" .value="${this.config.pv_on_threshold}" @input="${this.handleInputChange}">
                <small>Miner schaltet EIN, wenn der Wert <b>größer oder gleich</b> diesem Wert ist.</small>
            </div>
            <div class="form-group">
                <label>Ausschalt-Schwelle (Watt)</label>
                <input type="number" name="pv_off_threshold" .value="${this.config.pv_off_threshold}" @input="${this.handleInputChange}">
                <small>Miner schaltet AUS, wenn der Wert <b>kleiner oder gleich</b> diesem Wert ist.</small>
            </div>
          </div>
        ` : ''}

        ${this.config.mode === 'price' ? html`
          <div class="mode-section">
            <h3>💶 Dynamischer Strompreis Setup</h3>
            <div class="form-group">
                <label>Strompreis-Sensor (z.B. Tibber Preis in Cent/kWh)</label>
                <input type="text" name="price_sensor" placeholder="sensor.tibber_price" .value="${this.config.price_sensor || ''}" @input="${this.handleInputChange}">
            </div>
            <div class="form-group">
                <label>Einschalt-Schwelle (Cent/kWh)</label>
                <input type="number" step="0.1" name="price_on_threshold" .value="${this.config.price_on_threshold}" @input="${this.handleInputChange}">
                <small>Miner schaltet EIN, wenn der Preis <b>kleiner oder gleich</b> diesem Wert ist.</small>
            </div>
             <div class="form-group">
                <label>Ausschalt-Schwelle (Cent/kWh)</label>
                <input type="number" step="0.1" name="price_off_threshold" .value="${this.config.price_off_threshold}" @input="${this.handleInputChange}">
                <small>Miner schaltet AUS, wenn der Preis <b>größer oder gleich</b> diesem Wert ist.</small>
            </div>
          </div>
        ` : ''}

        <button class="btn-save" @click="${this.saveConfig}">Speichern & Anwenden</button>
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
      .header h1 {
        margin: 0;
        font-size: 2.8em;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
      }
      .subtitle {
        margin-top: 5px;
        font-size: 1.1em;
        opacity: 0.9;
        font-weight: 500;
        letter-spacing: 1px;
      }
      .tabs {
        display: flex;
        justify-content: center;
        margin-bottom: 25px;
        gap: 15px;
      }
      .tab {
        padding: 12px 30px;
        background: var(--card-background-color, #1e1e1e);
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
        border: 1px solid var(--divider-color, #333);
        color: var(--primary-text-color, #ccc);
      }
      .tab:hover {
        background: var(--secondary-background-color, #2a2a2a);
        transform: translateY(-2px);
      }
      .tab.active {
        background: #FF8C00;
        color: white;
        border-color: #FF8C00;
        box-shadow: 0 4px 10px rgba(255, 140, 0, 0.3);
      }
      .content {
        max-width: 800px;
        margin: 0 auto;
      }
      .card {
        background: var(--card-background-color, #1e1e1e);
        border-radius: 12px;
        padding: 30px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        margin-bottom: 20px;
        border: 1px solid var(--divider-color, #333);
      }
      .card h2 {
        margin-top: 0;
        border-bottom: 2px solid #FF8C00;
        padding-bottom: 10px;
        color: #FF8C00;
      }
      .mode-section {
        background: var(--secondary-background-color, #252525);
        padding: 20px;
        border-radius: 8px;
        margin-top: 20px;
        border-left: 4px solid #FF8C00;
      }
      .form-group {
        margin-bottom: 18px;
      }
      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: bold;
        font-size: 0.95em;
        color: var(--secondary-text-color, #bbb);
      }
      .form-group input, .form-group select {
        width: 100%;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid var(--divider-color, #444);
        box-sizing: border-box;
        font-size: 1em;
        background: var(--input-background-color, #2a2a2a);
        color: var(--primary-text-color, #fff);
        transition: border-color 0.3s;
      }
      .form-group input:focus, .form-group select:focus {
        outline: none;
        border-color: #FF8C00;
      }
      .form-group small {
        display: block;
        margin-top: 5px;
        color: #888;
        font-size: 0.85em;
      }
      .btn-save {
        background: #FF8C00;
        color: white;
        border: none;
        padding: 15px 25px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1.1em;
        font-weight: bold;
        width: 100%;
        margin-top: 20px;
        transition: all 0.3s ease;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .btn-save:hover {
        background: #e07b00;
        box-shadow: 0 4px 12px rgba(255, 140, 0, 0.4);
      }
      .status-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 25px;
      }
      .status-item {
          background: var(--secondary-background-color, #252525);
          padding: 20px;
          border-radius: 10px;
          border-left: 4px solid #FF8C00;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .status-item h3 {
          margin: 0 0 10px 0;
          font-size: 0.9em;
          color: var(--secondary-text-color, #aaa);
          text-transform: uppercase;
          letter-spacing: 0.5px;
      }
      .status-item p {
          margin: 0;
          font-size: 1.3em;
          font-weight: bold;
      }
      .status-badge {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 0.9em !important;
          font-weight: bold;
          background: #444;
          color: #fff;
      }
      .status-badge.on {
          background: #4caf50;
      }
      .status-badge.off {
          background: #f44336;
      }
      @media (max-width: 600px) {
        .status-grid {
            grid-template-columns: 1fr;
        }
        .header h1 {
            font-size: 2em;
        }
      }
    `;
  }
}

customElements.define("openkairo-mining-panel", OpenKairoMiningPanel);
