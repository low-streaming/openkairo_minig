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
  }

  firstUpdated() {
    this.loadConfig();
    this.fetchBtcDifficulty();
  }

  async fetchBtcDifficulty() {
    try {
      const response = await fetch('https://mempool.space/api/v1/difficulty-adjustment');
      const data = await response.json();
      if (data && data.difficulty) {
        this.btcDifficulty = data.difficulty;
        this.requestUpdate();
      }
    } catch (e) {
      console.error("Failed to fetch BTC difficulty", e);
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
      price_sensor: '',
      image: '',
      hashrate_sensor: '',
      temp_sensor: '',
      power_entity: '',
      calc_method: 'sensor',
      crypto_revenue_sensor: '',
      coin_price_sensor: '',
      power_consumption_sensor: '',
      electricity_price_sensor: ''
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
    const { name, value } = e.target;
    this.editForm = { ...this.editForm, [name]: value };
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

        <div class="tech-box" style="margin-top: 15px;">
          <h3 style="margin-top:0; color:#F7931A;">🔌 Erweiterte Miner-Steuerung (Hass-Miner):</h3>
          <p style="color:#bbb; line-height:1.6; margin-top: 5px;">Nutzt du die <strong>hass-miner</strong> Integration, bietet OpenKairo dir erweiterte Live-Funktionen direkt auf dem Dashboard:</p>
          <ul style="color:#bbb; line-height:1.6; padding-left:20px;">
            <li><strong style="color:#ddd;">Live-Daten:</strong> Wähle Hashrate- und Temperatur-Sensoren aus, um diese direkt auf der Miner-Karte anzuzeigen.</li>
            <li><strong style="color:#ddd;">ASIC Power Limit:</strong> Hinterlege einen 'number' Sensor (z.B. für deinen Antminer S9), um das maximale Watt-Limit live über einen Slider auf dem Dashboard anzupassen!</li>
            <li><strong style="color:#ddd;">Modus-Steuerung:</strong> Steuere kompatible ASIC-Miner (z.B. IceRiver KS0) direkt per Knopfdruck in den Low, Normal oder High Modus.</li>
            <li><strong style="color:#ddd;">Restart & Reboot:</strong> Starte den Mining-Prozess oder das gesamte Gerät remote neu.</li>
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

      let priceValue = 'N/A';
      if (miner.mode === 'price' && this.hass && miner.price_sensor && this.hass.states[miner.price_sensor]) {
        priceValue = this.hass.states[miner.price_sensor].state + ' ¢';
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

      if (miner.calc_method === 'btc_auto' && miner.hashrate_sensor && miner.coin_price_sensor && this.hass && this.hass.states[miner.hashrate_sensor] && this.hass.states[miner.coin_price_sensor] && this.btcDifficulty) {
        const hrState = this.hass.states[miner.hashrate_sensor];
        const hrValue = parseFloat(hrState.state) || 0;
        const priceState = this.hass.states[miner.coin_price_sensor];
        const priceVal = parseFloat(priceState.state) || 0;

        let hrInTH = hrValue;
        const unit = (hrState.attributes.unit_of_measurement || 'TH/s').toUpperCase();
        if (unit.includes('GH')) hrInTH = hrValue / 1000;
        if (unit.includes('PH')) hrInTH = hrValue * 1000;

        if (priceState.attributes.unit_of_measurement) {
          fiatSymbol = priceState.attributes.unit_of_measurement.replace('/BTC', '').replace('/ETH', '').replace('/KAS', '').trim();
        }

        // BTC Ertrag pro Tag = (Hashrate_in_TH * 1e12 / (Difficulty * 2^32)) * 86400 * 3.125
        const btcPerDay = (hrInTH * 1e12 / (this.btcDifficulty * Math.pow(2, 32))) * 86400 * 3.125;
        dailyRevenue = btcPerDay * priceVal;
        hasProfitData = true;

      } else if ((!miner.calc_method || miner.calc_method === 'sensor') && miner.crypto_revenue_sensor && miner.coin_price_sensor && this.hass && this.hass.states[miner.crypto_revenue_sensor] && this.hass.states[miner.coin_price_sensor]) {
        const cryptoState = this.hass.states[miner.crypto_revenue_sensor];
        const priceState = this.hass.states[miner.coin_price_sensor];
        const cryptoVal = parseFloat(cryptoState.state) || 0;
        const priceVal = parseFloat(priceState.state) || 0;

        // If the price sensor has a recognizable unit
        if (priceState.attributes.unit_of_measurement) {
          fiatSymbol = priceState.attributes.unit_of_measurement.replace('/BTC', '').replace('/ETH', '').replace('/KAS', '').trim();
        }

        dailyRevenue = cryptoVal * priceVal;
        hasProfitData = true;
      }

      if (miner.power_consumption_sensor && miner.electricity_price_sensor && this.hass && this.hass.states[miner.power_consumption_sensor] && this.hass.states[miner.electricity_price_sensor]) {
        const watts = parseFloat(this.hass.states[miner.power_consumption_sensor].state) || 0;
        let price = parseFloat(this.hass.states[miner.electricity_price_sensor].state) || 0;

        const priceUnit = this.hass.states[miner.electricity_price_sensor].attributes.unit_of_measurement || '';
        if (priceUnit.toLowerCase().includes('cent') || priceUnit === 'ct' || priceUnit === '¢' || price > 5) {
          price = price / 100; // assume >5 means cents if not EUR exactly
        }
        if (priceUnit.includes('€') || priceUnit.includes('EUR')) { fiatSymbol = '€'; }
        if (priceUnit.includes('$') || priceUnit.includes('USD')) { fiatSymbol = '$'; }

        dailyCosts = (watts / 1000) * 24 * price;
        hasProfitData = true;
      }

      profit = dailyRevenue - dailyCosts;
      const profitColor = profit > 0 ? '#2ecc71' : (profit < 0 ? '#e74c3c' : '#aaa');
      const dailyRevenueStr = dailyRevenue > 0 ? dailyRevenue.toFixed(2) : '0.00';
      const dailyCostsStr = dailyCosts > 0 ? dailyCosts.toFixed(2) : '0.00';
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

              ${hasProfitData ? html`
              <div class="profit-box" style="margin-top: 15px; border-radius: 8px; border: 1px solid rgba(46, 204, 113, 0.2); background: rgba(46, 204, 113, 0.05); padding: 15px;">
                  <h4 style="margin: 0 0 10px 0; font-size: 0.9em; color: #2ecc71; text-transform: uppercase;">💰 24h Profitabilität</h4>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.9em; color: #bbb;">
                      <span>Ertrag:</span>
                      <span style="color: #fff;">${dailyRevenueStr} ${fiatSymbol}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.9em; color: #bbb; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 5px;">
                      <span>Stromkosten:</span>
                      <span style="color: #e74c3c;">-${dailyCostsStr} ${fiatSymbol}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em;">
                      <span>Profit:</span>
                      <span style="color: ${profitColor};">${profit > 0 ? '+' : ''}${profitStr} ${fiatSymbol}</span>
                  </div>
              </div>
              ` : ''}

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
            <option value="price" ?selected="${this.editForm.mode === 'price'}">Günstiger Strompreis</option>
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
                <select name="price_sensor" @change="${this.handleFormInput}">
                  <option value="" ?selected="${!this.editForm.price_sensor}">-- Preis-Sensor wählen --</option>
                  ${sensorOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.price_sensor === opt.id}">${opt.name}</option>`)}
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

        <div class="mode-section btc-section" style="margin-top: 20px; border-color: rgba(46, 204, 113, 0.4); background: rgba(46, 204, 113, 0.05);">
            <h3 style="color: #2ecc71; font-size: 1.1em;">💰 Profitabilitäts-Rechner (Optional)</h3>
            <p style="color: #888; font-size: 0.85em; margin-top: -10px; margin-bottom: 20px;">
                Berechne live den Profit deines Miners auf dem Dashboard!
            </p>
            <div class="form-group">
                <label>Berechnung des Ertrags</label>
                <select name="calc_method" @change="${this.handleFormInput}" style="background: rgba(0,0,0,0.5); border-color: #2ecc71;">
                    <option value="sensor" ?selected="${!this.editForm.calc_method || this.editForm.calc_method === 'sensor'}">Ertrag über Sensor lesen (z.B. BTC/Tag)</option>
                    <option value="btc_auto" ?selected="${this.editForm.calc_method === 'btc_auto'}">Live aus Hashrate berechnen (Nur Bitcoin)</option>
                </select>
            </div>
            
            <div class="form-row">
                ${(!this.editForm.calc_method || this.editForm.calc_method === 'sensor') ? html`
                <div class="form-group flex-1">
                    <label>Ertrag-Sensor (z.B. BTC/Tag)</label>
                    <select name="crypto_revenue_sensor" @change="${this.handleFormInput}">
                    <option value="" ?selected="${!this.editForm.crypto_revenue_sensor}">-- Ertrags-Sensor wählen --</option>
                    ${sensorOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.crypto_revenue_sensor === opt.id}">${opt.name}</option>`)}
                    </select>
                </div>
                ` : html`
                <div class="form-group flex-1" style="display: flex; align-items: center;">
                    <p style="font-size: 0.85em; color: #888; margin: 0;">Der BTC-Ertrag wird automatisch anhand deiner Hashrate und der aktuellen Network-Difficulty berechnet.</p>
                </div>
                `}
                
                <div class="form-group flex-1">
                    <label>Coin-Preis Sensor (z.B. Fiat/BTC)</label>
                    <select name="coin_price_sensor" @change="${this.handleFormInput}">
                    <option value="" ?selected="${!this.editForm.coin_price_sensor}">-- Coin-Preis Sensor wählen --</option>
                    ${sensorOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.coin_price_sensor === opt.id}">${opt.name}</option>`)}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Stromverbrauch-Sensor (Watt)</label>
                    <select name="power_consumption_sensor" @change="${this.handleFormInput}">
                    <option value="" ?selected="${!this.editForm.power_consumption_sensor}">-- Watt Sensor wählen --</option>
                    ${sensorOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.power_consumption_sensor === opt.id}">${opt.name}</option>`)}
                    </select>
                </div>
                <div class="form-group flex-1">
                    <label>Strompreis-Sensor (€/kWh)</label>
                    <select name="electricity_price_sensor" @change="${this.handleFormInput}">
                    <option value="" ?selected="${!this.editForm.electricity_price_sensor}">-- Preis Sensor wählen --</option>
                    ${sensorOptions.map(opt => html`<option value="${opt.id}" ?selected="${this.editForm.electricity_price_sensor === opt.id}">${opt.name}</option>`)}
                    </select>
                </div>
            </div>
        </div>

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
        .form-row { flex-direction: column; gap: 0; }
        .header h1 { font-size: 2.2em; }
        .miners-grid { grid-template-columns: 1fr; }
        .miners-grid.single-miner .miner-card { padding: 25px; }
        .btn-cancel, .btn-save { flex: 1; }
        .tab { min-width: 100%; }
        .miner-status { flex-direction: column; }
        .btn-power { padding: 15px; }
        .content { padding: 0 10px; }
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
