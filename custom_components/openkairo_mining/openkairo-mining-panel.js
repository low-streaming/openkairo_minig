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
    this.btcDifficulty = null;
    this.historyData = {};
    this.fetchingHistory = {};
  }

  firstUpdated() {
    this.loadConfig();
    this.fetchBtcDifficulty();
    this.fetchBtcPrice();
  }

  async fetchBtcPrice() {
    try {
      const response = await fetch('https://mempool.space/api/v1/prices');
      const data = await response.json();
      if (data && data.EUR) {
        this.btcPriceEur = data.EUR;
        this.btcPriceUsd = data.USD;
        this.requestUpdate();
      }
    } catch (e) {
      console.error("Failed to fetch BTC price", e);
    }
  }

  async fetchBtcDifficulty() {
    try {
      const response = await fetch('https://blockchain.info/q/getdifficulty');
      const text = await response.text();
      const diff = parseFloat(text);
      if (diff > 0) {
        this.btcDifficulty = diff;
        this.requestUpdate();
      }
    } catch (e) {
      console.error("Failed to fetch BTC difficulty", e);
    }
  }

  async fetchHistoryData(entityId) {
    if (!this.hass || !entityId) return;
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startStr = yesterday.toISOString();

    try {
      const response = await this.hass.callApi('GET', `history/period/${startStr}?filter_entity_id=${entityId}&minimal_response`);
      if (response && response.length > 0) {
        this.historyData = { ...this.historyData, [entityId]: response[0] };
        this.requestUpdate();
      } else {
        this.historyData = { ...this.historyData, [entityId]: [] };
        this.requestUpdate();
      }
    } catch (e) {
      console.error("Failed to fetch history for " + entityId, e);
      this.historyData = { ...this.historyData, [entityId]: [] };
      this.requestUpdate();
    }
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

  async saveConfig(silent = false) {
    try {
      await fetch('/api/openkairo_mining/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.hass?.auth?.token?.access_token || ''}`
        },
        body: JSON.stringify(this.config)
      });
      if (!silent) {
        alert('Einstellungen erfolgreich gespeichert!');
        this.editingMinerId = null; // Zurück zur Liste
      }
    } catch (error) {
      console.error("Error saving config", error);
      if (!silent) alert('Fehler beim Speichern der Einstellungen.');
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
      delay_minutes: 5,
      pv_sensor: '',
      allow_battery: false,
      battery_sensor: '',
      battery_min_soc: 100,
      price_sensor: '',
      image: '',
      hashrate_sensor: '',
      temp_sensor: '',
      power_entity: '',
      calc_method: 'sensor',
      coin_price_source: 'sensor',
      electricity_price_source: 'sensor',
      electricity_price_manual: 0.30,
      crypto_revenue_sensor: '',
      coin_price_sensor: '',
      power_consumption_sensor: '',
      electricity_price_sensor: '',
      forecast_sensor: '',
      forecast_min: 0
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

  handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        this.editForm = { ...this.editForm, image: event.target.result };
      };
      reader.readAsDataURL(file);
    }
  }

  toggleMiner(entityId) {
    if (!this.hass || !entityId) return;
    this.hass.callService("switch", "toggle", { entity_id: entityId });
  }

  callMinerService(miner, serviceName, serviceData = {}) {
    if (!this.hass || !miner.switch) {
      alert("Es muss ein Schalter hinterlegt sein, um den Miner zu steuern.");
      return;
    }

    const deviceId = this.hass.states[miner.switch]?.attributes?.device_id;

    if (!deviceId) {
      alert("Konnte die zugehörige Hass-Miner Device-ID nicht finden.");
      return;
    }

    const finalData = { device_id: deviceId, ...serviceData };

    if (serviceName === 'reboot' && !confirm("Möchtest du den Miner wirklich neustarten?")) return;
    if (serviceName === 'restart_backend' && !confirm("Möchtest du das Mining (Backend) auf dem Miner wirklich neustarten?")) return;

    this.hass.callService("miner", serviceName, finalData)
      .then(() => alert(`Befehl '${serviceName}' erfolgreich gesendet!`))
      .catch(err => alert(`Fehler beim Senden des Befehls: ${err.message}`));
  }

  handleFormInput(e) {
    const { name, value, type, checked } = e.target;
    this.editForm = { ...this.editForm, [name]: type === 'checkbox' ? checked : value };
    this.requestUpdate();
  }

  setPowerLimit(entityId, value) {
    if (!this.hass || !entityId) return;
    this.hass.callService("number", "set_value", { entity_id: entityId, value: value })
      .then(() => console.log(`Power Limit gesetzt: ${value}`))
      .catch(err => alert(`Fehler beim Setzen des Power Limits: ${err.message}`));
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
        <div class="tab ${this.activeTab === 'statistics' ? 'active' : ''}" @click="${() => { this.activeTab = 'statistics'; this.editingMinerId = null; }}">Graphen</div>
        ${this.config.show_energy_tab ? html`<div class="tab ${this.activeTab === 'energy' ? 'active' : ''}" @click="${() => { this.activeTab = 'energy'; this.editingMinerId = null; }}">⚡ Ersparnis</div>` : ''}
        <div class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => { this.activeTab = 'settings'; this.editingMinerId = null; }}">Einstellungen</div>
        <div class="tab ${this.activeTab === 'info' ? 'active' : ''}" @click="${() => { this.activeTab = 'info'; this.editingMinerId = null; }}">Hilfe</div>
      </div>

      <div class="content">
        ${this.activeTab === 'dashboard' ? this.renderDashboard() : ''}
        ${this.activeTab === 'statistics' ? this.renderStatistics() : ''}
        ${this.activeTab === 'energy' ? this.renderEnergyStats() : ''}
        ${this.activeTab === 'settings' ? this.renderSettings() : ''}
        ${this.activeTab === 'info' ? this.renderInfo() : ''}
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
        <p>Willkommen beim <strong>OpenKairo Mining</strong> Panel. Diese Integration ermöglicht es dir, deine Krypto-Miner effizient mit deinem eigenen Solarstrom zu betreiben.</p>
        
        <div class="tech-box">
          <h3 style="margin-top:0; color:#F7931A;">☀️ Intelligente PV-Steuerung:</h3>
          <p style="color:#bbb; line-height:1.6; margin-top: 5px;">Das System überwacht permanent deine Netzeinspeisung und schaltet Miner basierend auf deinen Regeln ein:</p>
          <ul style="color:#bbb; line-height:1.6; padding-left:20px;">
            <li><strong style="color:#ddd;">Priorisierung:</strong> Miner mit niedrigerer Priorität (z.B. 1) starten zuerst. So kannst du festlegen, welche Hardware bei wenig Sonne den Vorrang hat.</li>
            <li><strong style="color:#ddd;">Überschuss-Logik:</strong> Gib an, ab wie viel Watt Einspeisung ein Miner starten soll und ab welchem Wert (z.B. Netzbezug) er wieder stoppt.</li>
            <li><strong style="color:#ddd;">Batterie-Support:</strong> Erlaube dem Miner optional, auch bei sinkendem PV-Ertrag weiterzulaufen, solange dein Heimspeicher noch ausreichend gefüllt ist.</li>
            <li><strong style="color:#ddd;">Hysterese (Verzögerung):</strong> Um ständiges Schalten bei vorbeiziehenden Wolken zu vermeiden, kannst du eine Zeitverzögerung in Minuten einstellen.</li>
          </ul>
        </div>

        <div class="tech-box" style="margin-top: 15px;">
          <h3 style="margin-top:0; color:#F7931A;">🔌 Hass-Miner Integration:</h3>
          <p style="color:#bbb; line-height:1.6; margin-top: 5px;">In Kombination mit der <strong>Hass-Miner</strong> Integration von Schnitzel schaltest du das volle Potenzial frei:</p>
          <ul style="color:#bbb; line-height:1.6; padding-left:20px;">
            <li><strong style="color:#ddd;">Echtzeit-Monitoring:</strong> Visualisierung von Hashrate und Temperatur direkt im Dashboard.</li>
            <li><strong style="color:#ddd;">Remote Control:</strong> Sende Befehle wie Neustart, Reboot oder Modus-Wechsel (Low/Normal/High Power) direkt vom Sofa aus.</li>
            <li><strong style="color:#ddd;">Power Limit Slider:</strong> Reguliere den Stromverbrauch kompatibler Miner (z.B. S9 mit Braiins OS+) stufenlos direkt auf der Miner-Karte.</li>
          </ul>
        </div>

        <div class="tech-box" style="margin-top: 25px; text-align: center; border-color: rgba(247, 147, 26, 0.4); background: rgba(247, 147, 26, 0.05);">
          <h3 style="margin-top:0; color:#fff;">☕ Unterstütze das Projekt</h3>
          <p style="color:#bbb; margin-bottom: 25px;">OpenKairo ist ein Community-Projekt. Wenn dir die Integration hilft, Energiekosten zu sparen, freuen wir uns über eine kleine Unterstützung für die Weiterentwicklung!</p>
          <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=info@low-streaming.de&currency_code=EUR&source=url" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none; width:auto; padding: 15px 40px; border-radius:30px; line-height:1;">
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
      'pv': 'PV-Überschuss'
    };

    return html`
      <div class="miners-grid ${this.config.miners.length === 1 ? 'single-miner' : ''}">
        ${this.config.miners.map(miner => {
      let switchState = 'Unbekannt';
      if (this.hass && miner.switch && this.hass.states[miner.switch]) {
        switchState = this.hass.states[miner.switch].state;
      }

      let pvValue = 'N/A';
      if (miner.mode === 'pv' && this.hass && miner.pv_sensor && this.hass.states[miner.pv_sensor]) {
        pvValue = this.hass.states[miner.pv_sensor].state + ' W';
      }

      let batteryValue = '';
      if (miner.mode === 'pv' && miner.allow_battery && this.hass && miner.battery_sensor && this.hass.states[miner.battery_sensor]) {
        batteryValue = this.hass.states[miner.battery_sensor].state + ' %';
      }



      let hashrateValue = '';
      if (miner.hashrate_sensor && this.hass && this.hass.states[miner.hashrate_sensor]) {
        const stateObj = this.hass.states[miner.hashrate_sensor];
        hashrateValue = stateObj.state + ' ' + (stateObj.attributes.unit_of_measurement || 'TH/s');
      }

      let tempValue = '';
      if (miner.temp_sensor && this.hass && this.hass.states[miner.temp_sensor]) {
        const stateObj = this.hass.states[miner.temp_sensor];
        tempValue = stateObj.state + ' ' + (stateObj.attributes.unit_of_measurement || '°C');
      }

      // Profitabilitäts-Berechnung
      let dailyRevenue = 0;
      let dailyCosts = 0;
      let profit = 0;
      let hasProfitData = false;
      let fiatSymbol = '€';
      let currentCoinPrice = 0;

      if (miner.coin_price_source === 'api' && this.btcPriceEur) {
        currentCoinPrice = this.btcPriceEur;
        fiatSymbol = '€';
      } else if ((!miner.coin_price_source || miner.coin_price_source === 'sensor') && miner.coin_price_sensor && this.hass && this.hass.states[miner.coin_price_sensor]) {
        const priceState = this.hass.states[miner.coin_price_sensor];
        currentCoinPrice = parseFloat(priceState.state) || 0;
        if (priceState.attributes.unit_of_measurement) {
          fiatSymbol = priceState.attributes.unit_of_measurement.replace('/BTC', '').replace('/ETH', '').replace('/KAS', '').trim();
        }
      }

      if (miner.calc_method === 'btc_auto' && miner.hashrate_sensor && currentCoinPrice > 0 && this.hass && this.hass.states[miner.hashrate_sensor] && this.btcDifficulty) {
        const hrState = this.hass.states[miner.hashrate_sensor];
        const hrValue = parseFloat(hrState.state) || 0;

        let hrInTH = hrValue;
        const unit = (hrState.attributes.unit_of_measurement || 'TH/s').toUpperCase();
        if (unit.includes('GH')) hrInTH = hrValue / 1000;
        if (unit.includes('PH')) hrInTH = hrValue * 1000;

        // BTC Ertrag pro Tag
        const btcPerDay = (hrInTH * 1e12 / (this.btcDifficulty * Math.pow(2, 32))) * 86400 * 3.125;
        dailyRevenue = btcPerDay * currentCoinPrice;
        hasProfitData = true;

      } else if ((!miner.calc_method || miner.calc_method === 'sensor') && miner.crypto_revenue_sensor && currentCoinPrice > 0 && this.hass && this.hass.states[miner.crypto_revenue_sensor]) {
        const cryptoState = this.hass.states[miner.crypto_revenue_sensor];
        const cryptoVal = parseFloat(cryptoState.state) || 0;
        dailyRevenue = cryptoVal * currentCoinPrice;
        hasProfitData = true;
      }

      let electricityPrice = 0;
      let hasPowerData = false;

      if (miner.mode === 'pv') {
        electricityPrice = 0;
        hasPowerData = true;
      } else if (miner.electricity_price_source === 'manual') {
        electricityPrice = parseFloat(String(miner.electricity_price_manual).replace(',', '.')) || 0;
        hasPowerData = true;
      } else if ((!miner.electricity_price_source || miner.electricity_price_source === 'sensor') && miner.electricity_price_sensor && this.hass && this.hass.states[miner.electricity_price_sensor]) {
        const eleState = this.hass.states[miner.electricity_price_sensor];
        electricityPrice = parseFloat(eleState.state) || 0;
        const priceUnit = eleState.attributes.unit_of_measurement || '';
        if (priceUnit.toLowerCase().includes('cent') || priceUnit === 'ct' || priceUnit === '¢' || electricityPrice > 5) {
          electricityPrice = electricityPrice / 100; // assume >5 means cents if not EUR exactly
        }
        if (priceUnit.includes('€') || priceUnit.includes('EUR')) { fiatSymbol = '€'; }
        if (priceUnit.includes('$') || priceUnit.includes('USD')) { fiatSymbol = '$'; }
        hasPowerData = true;
      }

      if (hasProfitData && hasPowerData && miner.power_consumption_sensor && this.hass && this.hass.states[miner.power_consumption_sensor]) {
        const watts = parseFloat(this.hass.states[miner.power_consumption_sensor].state) || 0;
        dailyCosts = (watts / 1000) * 24 * electricityPrice;
      } else {
        hasProfitData = false;
      }

      profit = dailyRevenue - dailyCosts;
      const profitColor = profit > 0 ? '#2ecc71' : (profit < 0 ? '#e74c3c' : '#aaa');
      const dailyRevenueStr = dailyRevenue > 0 ? dailyRevenue.toFixed(2) : '0.00';
      const dailyCostsStr = miner.mode === 'pv' ? `0.00 (PV)` : (dailyCosts > 0 ? `-${dailyCosts.toFixed(2)}` : '0.00');
      const profitStr = hasProfitData ? profit.toFixed(2) : '';

      let powerObj = null;
      if (miner.power_entity && this.hass && this.hass.states[miner.power_entity]) {
        powerObj = this.hass.states[miner.power_entity];
      }

      const friendlySwitchName = this.hass && this.hass.states[miner.switch] && this.hass.states[miner.switch].attributes.friendly_name
        ? this.hass.states[miner.switch].attributes.friendly_name
        : miner.switch;

      return html`
            <div class="miner-card">
              ${miner.image ? html`<div class="miner-image" style="background-image: url('${miner.image}')"></div>` : html`<div class="miner-image placeholder">₿</div>`}
              <div class="miner-header">
                <h3>${miner.name}</h3>
                <span class="prio-badge">Prio: ${miner.priority || '-'}</span>
              </div>
              
              <div class="miner-status">
                <span class="status-badge ${switchState === 'on' ? 'on' : switchState === 'off' ? 'off' : ''}">
                  ${switchState === 'on' ? 'MINING 🚀' : switchState === 'off' ? 'STANDBY 💤' : switchState}
                </span>
                <button class="btn-power ${switchState === 'on' ? 'on' : ''}" @click="${() => this.toggleMiner(miner.switch)}" title="Manuell ein/ausschalten">
                  ⏻
                </button>
              </div>
              
              ${(hashrateValue || tempValue) ? html`
              <div class="api-stats">
                  ${hashrateValue ? html`<div class="stat"><span class="lbl">Hashrate:</span> <span class="val">${hashrateValue}</span></div>` : ''}
                  ${tempValue ? html`<div class="stat"><span class="lbl">Temp:</span> <span class="val">${tempValue}</span></div>` : ''}
              </div>
              ` : ''}
              
              ${powerObj ? html`
              <div class="power-limit-box" style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                      <span style="font-size: 0.85em; color: #888;">Power Limit (S9/ASIC)</span>
                      <strong style="color: #F7931A;">${powerObj.state} ${powerObj.attributes.unit_of_measurement || 'W'}</strong>
                  </div>
                  <input type="range" 
                         min="${powerObj.attributes.min || 0}" 
                         max="${powerObj.attributes.max || 100}" 
                         step="${powerObj.attributes.step || 1}" 
                         .value="${powerObj.state}" 
                         @change="${(e) => this.setPowerLimit(miner.power_entity, e.target.value)}"
                         style="width: 100%; accent-color: #F7931A; cursor: pointer;">
              </div>
              ` : ''}
              
              
              <div class="miner-details">
                <p><b>Modus:</b> <span class="accent-text">${modeMap[miner.mode] || 'Unbekannt'}</span></p>
                <p><b>Dose:</b> ${friendlySwitchName || 'Nicht gesetzt'}</p>
                
                ${miner.mode === 'pv' ? html`
                  <div class="tech-box">
                    <p><b>Aktueller PV-Wert:</b> <span class="highlight-val">${pvValue}</span></p>
                    <p class="small-text mt-1" style="margin-bottom: 8px;">Regeln: An &ge; ${miner.pv_on}W | Aus &le; ${miner.pv_off}W</p>
                    ${miner.allow_battery ? html`
                      <div style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px;">
                          <p><b>Batterie (SOC):</b> <span class="highlight-val">${batteryValue || 'N/A'}</span></p>
                          <p class="small-text mt-1">🔋 Unterstützung erlaubt bis min. ${miner.battery_min_soc}%</p>
                      </div>
                    ` : ''}
                    ${miner.forecast_sensor && this.hass && this.hass.states[miner.forecast_sensor] ? html`
                      <div style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px;">
                          <p><b>Prognose heute:</b> <span class="highlight-val">${this.hass.states[miner.forecast_sensor].state} ${this.hass.states[miner.forecast_sensor].attributes.unit_of_measurement || 'kWh'}</span></p>
                          <p class="small-text mt-1">🌤️ Limit: Miner startet nur ab ${miner.forecast_min || 0} kWh</p>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}


              </div>



              ${(hashrateValue || tempValue) ? html`
              <div class="miner-controls" style="margin-top: 15px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 15px;">
                <p style="margin: 0 0 10px 0; font-size: 0.8em; color: #888; text-transform: uppercase;">⚡ Hass-Miner Steuerung <span style="font-size: 0.8em; color: #666; text-transform: none;">(Nicht für S9)</span></p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn-control mode-low" @click="${() => this.callMinerService(miner, 'set_work_mode', { mode: 'low' })}" title="Low Power Modus">LOW</button>
                    <button class="btn-control mode-normal" @click="${() => this.callMinerService(miner, 'set_work_mode', { mode: 'normal' })}" title="Normaler Modus">NORM</button>
                    <button class="btn-control mode-high" @click="${() => this.callMinerService(miner, 'set_work_mode', { mode: 'high' })}" title="High Power Modus">HIGH</button>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                     <button class="btn-control action" @click="${() => this.callMinerService(miner, 'restart_backend')}" title="Restart Mining">🔄 Restart</button>
                     <button class="btn-control action warn" @click="${() => this.callMinerService(miner, 'reboot')}" title="Reboot Miner">⚡ Reboot</button>
                </div>
              </div>
              ` : ''}
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
        <h2>🛠 Einstellungen & Globales</h2>
        
        <div class="tech-box" style="margin-bottom: 30px; border-color: rgba(247, 147, 26, 0.4);">
          <h3 style="color: #F7931A; margin-top: 0;">🌍 Globale Optionen</h3>
          <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 200px;">
              <label>Strompreis Referenz (€/kWh)</label>
              <input type="number" step="0.01" .value="${this.config.ref_price || 0.30}" @change="${(e) => { this.config.ref_price = parseFloat(e.target.value); this.saveConfig(true); }}">
              <small>Wird für die Berechnung der Ersparnis genutzt.</small>
            </div>
            <div style="flex: 1; min-width: 200px;">
               <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                  <input type="checkbox" ?checked="${this.config.show_energy_tab}" @change="${(e) => { this.config.show_energy_tab = e.target.checked; this.saveConfig(true); }}" style="width: 20px; height: 20px; accent-color: #F7931A;">
                  Energy-Stats Tab anzeigen
               </label>
               <small>Aktiviert den Tab zur Visualisierung der Ersparnis.</small>
            </div>
          </div>
        </div>

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
    const numberOptions = this.getEntitiesByDomain('number');

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
          <label>Miner Bild (Optional)</label>
          <input type="file" accept="image/*" @change="${this.handleImageUpload}" style="padding: 10px;">
          ${this.editForm.image ? html`<div style="margin-top: 10px; max-width: 200px; border-radius: 8px; overflow: hidden; border: 1px solid #444;"><img src="${this.editForm.image}" style="width: 100%; display: block;"></div>` : ''}
          <small>Lade ein Foto deines Miners hoch (wird lokal im Browser/Dashboard gespeichert).</small>
        </div>

        <div class="form-group">
          <label>Schalter / Steckdose</label>
          <select name="switch" @change="${this.handleFormInput}">
            <option value="" ?selected="${!this.editForm.switch}">-- Steckdose für diesen Miner wählen --</option>
            ${switchOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.switch === opt.id}">${opt.name}</option>`)}
          </select>
          <small>Die Steckdose oder der 'hass-miner' Switch, an dem der Miner pausiert wird.</small>
        </div>

        <div class="mode-section btc-section" style="margin-top: 20px; border-color: rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);">
            <h3 style="color: #aaa; font-size: 1.1em;">🔌 Hass-Miner Integration (Optional)</h3>
            <p style="color: #888; font-size: 0.85em; margin-top: -10px; margin-bottom: 20px;">
                Wenn du die <a href="https://github.com/Schnitzel/hass-miner" target="_blank" style="color: #F7931A;">Hass-Miner</a> Integration von Schnitzel installiert hast, kannst du hier die Dashboard-Statistiken verknüpfen.
            </p>
            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Miner Hashrate-Sensor</label>
                    <select name="hashrate_sensor" @change="${this.handleFormInput}">
                    <option value="" ?selected="${!this.editForm.hashrate_sensor}">-- Hashrate Sensor wählen --</option>
                    ${sensorOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.hashrate_sensor === opt.id}">${opt.name}</option>`)}
                    </select>
                </div>
                <div class="form-group flex-1">
                    <label>Miner Temperatur-Sensor</label>
                    <select name="temp_sensor" @change="${this.handleFormInput}">
                    <option value="" ?selected="${!this.editForm.temp_sensor}">-- Temp Sensor wählen --</option>
                    ${sensorOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.temp_sensor === opt.id}">${opt.name}</option>`)}
                    </select>
                </div>
            </div>
            <div class="form-group mt-3" style="width: 50%;">
                <label>Power Limit ('number' Entität)</label>
                <select name="power_entity" @change="${this.handleFormInput}">
                <option value="" ?selected="${!this.editForm.power_entity}">-- Power Limit wählen --</option>
                ${numberOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.power_entity === opt.id}">${opt.name}</option>`)}
                </select>
                <small>Optional: ASIC Power Limit Slider für das Dashboard aktivieren.</small>
            </div>
        </div>

        <div class="form-group mt-3">
          <label>Betriebsmodus</label>
          <select class="btc-select" name="mode" @change="${this.handleFormInput}">
            <option value="manual" ?selected="${this.editForm.mode === 'manual'}">Manuell (Nur Überwachung)</option>
            <option value="pv" ?selected="${this.editForm.mode === 'pv'}">PV-Überschuss (Einspeisung)</option>
          </select>
        </div>

        ${this.editForm.mode === 'pv' ? html`
          <div class="mode-section btc-section">
            <h3>☀️ PV-Überschuss Steuerung</h3>
            <div class="form-group">
                <label>PV-Sensor (Netzeinspeisung/Ertrag in Watt)</label>
                <select name="pv_sensor" @change="${this.handleFormInput}">
                  <option value="" ?selected="${!this.editForm.pv_sensor}">-- Einspeise-/Watt-Sensor wählen --</option>
                  ${sensorOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.pv_sensor === opt.id}">${opt.name}</option>`)}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Einschalten ab PV-Überschuss (Watt)</label>
                    <input type="number" name="pv_on" .value="${this.editForm.pv_on}" @input="${this.handleFormInput}">
                </div>
                <div class="form-group flex-1">
                    <label>PV-Überschuss ignorieren ab (Watt)</label>
                    <input type="number" name="pv_off" .value="${this.editForm.pv_off}" @input="${this.handleFormInput}">
                </div>
            </div>

            <div style="margin-top: 20px; padding: 15px; border: 1px dashed rgba(46, 204, 113, 0.3); border-radius: 8px; background: rgba(46, 204, 113, 0.05);">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #2ecc71; font-weight: bold;">
                    <input type="checkbox" name="allow_battery" .checked="${this.editForm.allow_battery}" @change="${this.handleFormInput}" style="width: 20px; height: 20px; accent-color: #2ecc71;">
                    🔋 Optionale Batterie-Unterstützung erlauben
                </label>
                
                ${this.editForm.allow_battery ? html`
                <div class="form-row" style="margin-top: 15px;">
                    <div class="form-group flex-2">
                        <label>Batterie SOC-Sensor (Ladezustand in %)</label>
                        <select name="battery_sensor" @change="${this.handleFormInput}">
                        <option value="" ?selected="${!this.editForm.battery_sensor}">-- Batterie % Sensor wählen --</option>
                        ${sensorOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.battery_sensor === opt.id}">${opt.name}</option>`)}
                        </select>
                    </div>
                    <div class="form-group flex-1">
                        <label>Minimale Batterieladung (%)</label>
                        <input type="number" min="0" max="100" name="battery_min_soc" .value="${this.editForm.battery_min_soc || 100}" @input="${this.handleFormInput}">
                        <small>Miner läuft, solange Batterie ≥ diesem Wert.</small>
                    </div>
                </div>
                ` : html`
                <p style="margin: 8px 0 0 30px; font-size: 0.85em; color: #888;">Schaltet den Miner auch bei zu wenig PV-Überschuss ein, solange die Batterie noch genügend (z.B. ≥ 95%) geladen ist.</p>
                `}
            </div>

            <div style="margin-top: 20px; padding: 15px; border: 1px dashed rgba(52, 152, 219, 0.3); border-radius: 8px; background: rgba(52, 152, 219, 0.05);">
                <h4 style="margin: 0 0 10px 0; color: #3498db; display: flex; align-items: center; gap: 8px;">🌤️ Solar-Vorhersage (Optional)</h4>
                <div class="form-row">
                    <div class="form-group flex-2">
                        <label>Prognose-Sensor (z.B. Solcast Today)</label>
                        <select name="forecast_sensor" @change="${this.handleFormInput}">
                        <option value="" ?selected="${!this.editForm.forecast_sensor}">-- Wetter/Prognose Sensor wählen --</option>
                        ${sensorOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.forecast_sensor === opt.id}">${opt.name}</option>`)}
                        </select>
                    </div>
                    <div class="form-group flex-1">
                        <label>Min. Prognose (kWh)</label>
                        <input type="number" step="0.1" name="forecast_min" .value="${this.editForm.forecast_min || 0}" @input="${this.handleFormInput}">
                        <small>Nur starten, wenn Ertrag heute ≥ X.</small>
                    </div>
                </div>
                <small style="color: #888;">Schaltet den Miner erst ein, wenn die Tagesprognose diesen Wert erreicht. Ideal um Akkus bei schlechtem Wetter zu schonen.</small>
            </div>

            <div class="form-group mt-3" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                <label>Verzögerung (Hysterese in Minuten)</label>
                <input type="number" min="0" step="1" name="delay_minutes" .value="${this.editForm.delay_minutes !== undefined ? this.editForm.delay_minutes : 5}" @input="${this.handleFormInput}">
                <small>Verhindert ständiges An/Aus, z.B. bei kurzen Wolken. Miner schaltet erst nach X Minuten.</small>
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

  renderEnergyStats() {
    return html`
      <div class="card">
        <h2>⚡ Energie-Ersparnis (PV-Eigennutzung)</h2>
        <p>Hier siehst du, wie viel Stromkosten du durch die intelligente PV-Steuerung deiner Miner bereits eingespart hast.</p>
        
        <div class="dashboard-grid" style="margin-top: 25px;">
           ${this.config.miners && this.config.miners.length > 0 ? this.config.miners.map(miner => {
      const isPV = miner.mode === 'pv';
      const refPrice = this.config.ref_price || 0.30;
      let powerKW = 0;

      if (this.hass && miner.power_consumption_sensor && this.hass.states[miner.power_consumption_sensor]) {
        powerKW = (parseFloat(this.hass.states[miner.power_consumption_sensor].state) || 0) / 1000;
      }

      const hourlySaving = isPV ? (powerKW * refPrice) : 0;
      const dailySavingPotential = hourlySaving * 24; // Theoretisch wenn 24h Sonne

      return html`
               <div class="miner-card">
                 <div class="miner-header">
                   <h3>${miner.name}</h3>
                   <span class="prio-badge ${isPV ? 'on' : ''}">${isPV ? 'PV-Modus aktiv' : 'Manuell'}</span>
                 </div>
                 
                 <div class="tech-box" style="background: rgba(46, 204, 113, 0.05); border-color: rgba(46, 204, 113, 0.2);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="color: #888;">Live-Ersparnis:</span>
                        <strong style="color: #2ecc71; font-size: 1.2em;">${hourlySaving.toFixed(3)} € / Std.</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                        <span style="color: #888;">Potential (24h):</span>
                        <span style="color: #fff;">${dailySavingPotential.toFixed(2)} €</span>
                    </div>
                 </div>

                 <div style="margin-top: 15px; font-size: 0.85em; color: #666;">
                    * Basierend auf dem Referenzpreis von ${refPrice.toFixed(2)} €/kWh und aktuellem Verbrauch.
                 </div>
                 
                 ${miner.power_consumption_sensor ? '' : html`
                   <div style="margin-top: 10px; color: #e67e22; font-size: 0.8em; border: 1px dashed #e67e22; padding: 8px; border-radius: 4px;">
                     ⚠️ Kein Verbrauchssensor hinterlegt. Bitte in den Einstellungen ergänzen.
                   </div>
                 `}
               </div>
             `;
    }) : html`<p>Keine Miner konfiguriert.</p>`}
        </div>

        <div class="tech-box" style="margin-top: 30px; border-color: rgba(247, 147, 26, 0.2);">
           <h3 style="color: #F7931A; margin-top: 0;">💡 Info zur Ersparnis</h3>
           <p style="color: #bbb; font-size: 0.9em; line-height: 1.5;">
              Die Live-Ersparnis wird berechnet, indem der aktuelle Stromverbrauch deines Miners mit deinem eingestellten Referenz-Strompreis multipliziert wird – vorausgesetzt der Miner läuft im PV-Modus. 
              Dies entspricht den Kosten, die du hättest, wenn du den Strom stattdessen aus dem Netz beziehen müsstest.
           </p>
        </div>
      </div>
    `;
  }

  renderStatistics() {
    return html`
      <div class="card">
        <h2>📊 Statistiken & Graphen</h2>
        <p>Übersicht über den Stromverbrauch und die Hashrate deiner Miner im zeitlichen Verlauf.</p>
        
        <div class="dashboard-grid" style="margin-top: 20px;">
          ${this.config.miners && this.config.miners.length > 0 ? this.config.miners.map(miner => html`
            <div class="miner-card">
              <div class="miner-header" style="border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 15px;">
                <h3>${miner.name}</h3>
              </div>
              
              ${miner.hashrate_sensor || miner.power_consumption_sensor ? html`
                  <div class="chart-box" style="text-align: center;">
                      <div style="display: flex; flex-direction: column; gap: 10px;">
                          ${miner.power_consumption_sensor ? this.renderChart(miner.power_consumption_sensor, '#2ecc71', '⚡ Stromverbrauch', this.hass?.states[miner.power_consumption_sensor]?.attributes?.unit_of_measurement || 'W') : ''}
                          ${miner.hashrate_sensor ? this.renderChart(miner.hashrate_sensor, '#F7931A', '⛏️ Hashrate', this.hass?.states[miner.hashrate_sensor]?.attributes?.unit_of_measurement || 'TH/s') : ''}
                          ${miner.temp_sensor ? this.renderChart(miner.temp_sensor, '#e74c3c', '🌡️ Temperatur', this.hass?.states[miner.temp_sensor]?.attributes?.unit_of_measurement || '°C') : ''}
                      </div>

                      <div style="margin-top: 20px; text-align: left; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                        <h4 style="margin: 0; color: #888; font-size: 0.85em;">Klicke auf einen Graphen, um die detaillierte Ansicht von Home Assistant zu öffnen.</h4>
                      </div>
                  </div>
              ` : html`
                  <p style="color: #888; text-align: center; margin-top: 20px;">Keine Sensoren für diesen Miner konfiguriert. Füge diese in den Einstellungen hinzu, um Statistiken zu sehen.</p>
              `}
            </div>
          `) : html`<p class="empty-text">Noch keine Miner vorhanden.</p>`}
        </div>
      </div>
    `;
  }

  renderChart(entityId, colorHex, label, unit) {
    if (!this.historyData[entityId] && !this.fetchingHistory[entityId]) {
      this.fetchingHistory[entityId] = true;
      this.fetchHistoryData(entityId);
      return html`<div style="height: 150px; display: flex; align-items: center; justify-content: center; color: #888; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 15px;">Lade ${label}...</div>`;
    }

    const data = this.historyData[entityId];
    if (!data || data.length === 0) {
      const currentState = this.hass && this.hass.states[entityId] ? this.hass.states[entityId].state : '-';
      return html`
        <div style="margin-bottom: 20px; text-align: left; cursor: pointer;" @click="${() => this.showMoreInfo(entityId)}">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
              <h4 style="color: ${colorHex}; margin: 0; font-size: 1.0em; text-transform: uppercase;">${label}</h4>
              <span style="color: #fff; font-size: 1.1em; font-weight: bold;">${currentState} ${unit}</span>
          </div>
          <div style="height: 120px; display: flex; align-items: center; justify-content: center; color: #888; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">Keine Verlaufsdaten für ${label} gefunden.</div>
        </div>
      `;
    }

    const validData = data.filter(d => !isNaN(parseFloat(d.state)));
    if (validData.length === 0) {
      const currentState = this.hass && this.hass.states[entityId] ? this.hass.states[entityId].state : '-';
      return html`
        <div style="margin-bottom: 20px; text-align: left; cursor: pointer;" @click="${() => this.showMoreInfo(entityId)}">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                <h4 style="color: ${colorHex}; margin: 0; font-size: 1.0em; text-transform: uppercase;">${label}</h4>
                <span style="color: #fff; font-size: 1.1em; font-weight: bold;">${currentState}</span>
            </div>
            <div style="height: 120px; display: flex; align-items: center; justify-content: center; color: #888; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">Keine numerischen Daten für ${label} gefunden.</div>
        </div>
      `;
    }

    const values = validData.map(d => parseFloat(d.state));
    const times = validData.map(d => new Date(d.last_changed).getTime());

    const minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    if (minVal === maxVal) maxVal = minVal + 1; // Unendlichkeit vermeiden
    const minTime = Math.min(...times);
    let maxTime = Math.max(...times);
    if (minTime === maxTime) maxTime = minTime + 1000;

    const rangeY = maxVal - minVal;
    const rangeX = maxTime - minTime;

    const width = 600;
    const height = 120;
    const padding = 20;

    const points = validData.map(d => {
      const x = ((new Date(d.last_changed).getTime() - minTime) / rangeX) * width;
      const y = height - (((parseFloat(d.state) - minVal) / rangeY) * height);
      return `${x},${y}`;
    });

    const pathData = `M ${points[0]} L ${points.join(' L ')}`;
    const fillPathData = `M ${points[0].split(',')[0]},${height} L ${points.join(' L ')} L ${points[points.length - 1].split(',')[0]},${height} Z`;
    const safeId = entityId.replace(/\./g, '_');

    return html`
      <div style="margin-bottom: 20px; text-align: left; cursor: pointer;" @click="${() => this.showMoreInfo(entityId)}">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
            <h4 style="color: ${colorHex}; margin: 0; font-size: 1.0em; text-transform: uppercase;">${label}</h4>
            <span style="color: #fff; font-size: 1.1em; font-weight: bold;">
                ${validData[validData.length - 1].state} ${unit}
            </span>
        </div>
        <div style="position: relative; height: ${height + padding * 2}px; border-radius: 8px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); overflow: hidden;">
          <svg viewBox="0 -${padding} ${width} ${height + padding * 2}" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
             <defs>
               <linearGradient id="grad_${safeId}" x1="0%" y1="0%" x2="0%" y2="100%">
                 <stop offset="0%" style="stop-color:${colorHex};stop-opacity:0.4" />
                 <stop offset="100%" style="stop-color:${colorHex};stop-opacity:0.0" />
               </linearGradient>
             </defs>
             <path d="${fillPathData}" fill="url(#grad_${safeId})" />
             <path d="${pathData}" fill="none" stroke="${colorHex}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
          <div style="position: absolute; top: 10px; left: 10px; color: rgba(255,255,255,0.8); font-size: 0.8em; font-weight: bold;">
             MAX: ${maxVal.toFixed(2)}
          </div>
          <div style="position: absolute; bottom: 10px; left: 10px; color: rgba(255,255,255,0.4); font-size: 0.8em;">
             MIN: ${minVal.toFixed(2)}
          </div>
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
      
      .tabs { display: flex; justify-content: center; margin-bottom: 35px; gap: 15px; flex-wrap: wrap; }
      .tab {
        padding: 14px 25px; 
        background: rgba(30, 30, 30, 0.6); 
        border: 1px solid rgba(247, 147, 26, 0.2); 
        border-radius: 8px; 
        cursor: pointer; 
        font-weight: 700;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 
        color: #a0a0a0;
        backdrop-filter: blur(10px);
        text-align: center;
        flex: 1 1 auto;
        min-width: 140px;
        max-width: 300px;
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
      
      /* Single Miner Layout */
      .miners-grid.single-miner { display: flex; justify-content: center; }
      .miners-grid.single-miner .miner-card { width: 100%; max-width: 700px; padding: 40px; }
      .miners-grid.single-miner .miner-header h3 { font-size: 2.2em; }
      .miners-grid.single-miner .status-badge { font-size: 1.5em; padding: 15px 30px; }
      .miners-grid.single-miner .miner-details p { font-size: 1.1em; }
      .miners-grid.single-miner .btn-power { font-size: 1.8em; padding: 0 30px; }
      .miners-grid.single-miner .tech-box { padding: 20px; }
      
      .miner-card { 
        background: linear-gradient(180deg, rgba(35,35,40,1) 0%, rgba(20,20,22,1) 100%);
        border-radius: 12px; 
        padding: 25px; 
        position: relative;
        border: 1px solid #333;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 5px 15px rgba(0,0,0,0.3);
        transition: transform 0.2s;
        overflow: hidden;
      }
      .miner-card:hover { border-color: #F7931A; transform: translateY(-3px); }
      .miner-card::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
        background: linear-gradient(90deg, #F7931A, #ffd800); border-radius: 12px 12px 0 0;
        z-index: 2;
      }
      
      .miner-image {
        position: absolute;
        top: 0; right: 0; bottom: 0; left: 0;
        background-size: cover; background-position: center;
        opacity: 0.15; z-index: 0;
        pointer-events: none;
      }
      .miner-image.placeholder {
        display: flex; justify-content: right; align-items: end; padding: 20px;
        font-size: 8em; color: rgba(247, 147, 26, 0.05); font-weight: bold; line-height: 1;
      }
      
      .miner-header, .miner-status, .miner-details {
        position: relative; z-index: 1;
      }
      
      .miner-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 18px; }
      .miner-header h3 { margin: 0; font-size: 1.5em; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.1); }
      .prio-badge { background: rgba(247, 147, 26, 0.15); padding: 4px 10px; border-radius: 6px; font-size: 0.85em; color: #F7931A; font-weight: bold; border: 1px solid rgba(247, 147, 26, 0.4);}
      .prio-badge.small { font-size: 0.75em; padding: 2px 6px; }
      
      .miner-status { display: flex; justify-content: center; gap: 15px; margin-bottom: 20px; align-items: stretch; }
      .status-badge { 
        padding: 10px 20px; border-radius: 8px; font-weight: 800; 
        background: #111; color: #555; text-align: center; width: 100%; font-size: 1.2em;
        letter-spacing: 1px; border: 1px solid #222;
        display: flex; align-items: center; justify-content: center;
      }
      .status-badge.on { 
        background: rgba(39, 174, 96, 0.1); color: #2ecc71; 
        border-color: rgba(46, 204, 113, 0.4); text-shadow: 0 0 10px rgba(46, 204, 113, 0.5); 
      }
      .status-badge.off { 
        background: rgba(231, 76, 60, 0.1); color: #e74c3c; 
        border-color: rgba(231, 76, 60, 0.3); 
      }
      
      .btn-power {
        background: #252528; border: 1px solid #444; border-radius: 8px; color: #888;
        font-size: 1.5em; padding: 0 20px; cursor: pointer; transition: 0.3s;
        display: flex; align-items: center; justify-content: center;
      }
      .btn-power:hover { background: #333; color: #F7931A; border-color: #F7931A; }
      .btn-power.on { color: #2ecc71; border-color: #2ecc71; background: rgba(46, 204, 113, 0.1); }
      .btn-power.on:hover { background: rgba(46, 204, 113, 0.2); }
      
      .miner-details p { margin: 8px 0; font-size: 0.95em; color: #bbb; }
      .accent-text { color: #F7931A; font-weight: bold; }
      
      .api-stats {
        display: flex; gap: 10px; background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 1px solid rgba(247, 147, 26, 0.2);
        justify-content: space-around;
      }
      .api-stats .stat { display: flex; flex-direction: column; align-items: center; }
      .api-stats .lbl { font-size: 0.75em; color: #888; text-transform: uppercase; letter-spacing: 1px; }
      .api-stats .val { font-size: 1.25em; font-weight: bold; color: #F7931A; font-family: monospace; margin-top: 3px; }

      .btn-control {
        background: #252528; border: 1px solid #444; border-radius: 6px; color: #ccc;
        font-size: 0.8em; padding: 6px 12px; cursor: pointer; transition: 0.2s;
        font-weight: bold; letter-spacing: 0.5px; flex: 1; text-align: center;
      }
      .btn-control:hover { filter: brightness(1.2); transform: scale(1.02); }
      .btn-control.mode-low { border-color: #3498db; color: #3498db; }
      .btn-control.mode-normal { border-color: #2ecc71; color: #2ecc71; }
      .btn-control.mode-high { border-color: #e74c3c; color: #e74c3c; }
      .btn-control.action { background: rgba(255,255,255,0.05); }
      .btn-control.action.warn { border-color: #e67e22; color: #e67e22; }

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
      
      @media (max-width: 768px) {
        :host { padding: 15px 10px; }
        .header h1 { font-size: 2.4em; }
        .header { margin-bottom: 25px; }
        .subtitle { font-size: 1em; }
        
        .tabs { gap: 8px; margin-bottom: 25px; }
        .tab { 
          padding: 12px 10px; 
          font-size: 0.9em; 
          min-width: calc(50% - 10px); /* 2 columns on mobile */
          max-width: 100%;
        }
        
        .card { padding: 20px 15px; border-radius: 12px; }
        .card h2 { font-size: 1.5em; margin-bottom: 20px; }
        
        .miners-grid { gap: 15px; }
        .miner-card { padding: 20px; }
        .miner-header h3 { font-size: 1.3em; }
        .status-badge { font-size: 1.1em; padding: 12px; }
        .btn-power { padding: 15px 20px; font-size: 1.6em; }
        
        .api-stats { flex-wrap: wrap; gap: 15px; }
        .api-stats .stat { min-width: 40%; }
        
        .form-row { flex-direction: column; gap: 0; }
        .form-group { margin-bottom: 18px; }
        .form-group input, .form-group select { padding: 12px; }
        
        .btn-save, .btn-cancel { padding: 14px; font-size: 1em; }
        .form-actions { gap: 10px; }
        
        .footer { padding: 20px 10px; margin-top: 30px; }
        .footer a { font-size: 0.75em; letter-spacing: 1.5px; }
      }

      /* Ultra compact for very small screens */
      @media (max-width: 400px) {
        .tab { min-width: 100%; }
        .header h1 { font-size: 2em; }
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
