import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

// New custom element for beautiful entity search dropdowns
class OpenKairoEntityPicker extends LitElement {
  static get properties() {
    return {
      name: { type: String },
      value: { type: String },
      entities: { type: Array },
      placeholder: { type: String },
      open: { type: Boolean },
      search: { type: String }
    };
  }

  constructor() {
    super();
    this.value = '';
    this.entities = [];
    this.placeholder = '-- Element suchen oder wählen --';
    this.open = false;
    this.search = '';
    this._documentClickListener = this._handleDocumentClick.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._documentClickListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._documentClickListener);
  }

  _handleDocumentClick(e) {
    if (!e.composedPath().includes(this)) {
      this.open = false;
      this._syncSearchToValue();
    }
  }

  _syncSearchToValue() {
    if (this.value) {
      const selected = this.entities.find(e => e.id === this.value);
      this.search = selected ? selected.name : this.value;
    } else {
      this.search = '';
    }
  }

  _handleInput(e) {
    this.search = e.target.value;
    this.open = true;
  }

  _handleFocus() {
    this.open = true;
    this._syncSearchToValue();
    setTimeout(() => {
      const input = this.shadowRoot.querySelector('input');
      if (input) input.select();
    }, 10);
  }

  _selectItem(id, name) {
    this.value = id;
    this.search = name;
    this.open = false;
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  _clearSelection(e) {
    e.stopPropagation();
    this.value = '';
    this.search = '';
    this.open = false;
    this.shadowRoot.querySelector('input').focus();
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  updated(changedProperties) {
    if (changedProperties.has('value') && changedProperties.get('value') !== this.value) {
      this._syncSearchToValue();
    }
    if (changedProperties.has('entities') && this.value && !this.search) {
      this._syncSearchToValue();
    }
  }

  render() {
    const terms = this.search.toLowerCase().split(' ').filter(t => t);
    const filtered = this.entities.filter(ent => {
      if (terms.length === 0) return true;
      const searchable = (ent.name + ' ' + ent.id).toLowerCase();
      return terms.every(term => searchable.includes(term));
    });

    const displayValue = this.search;

    return html`
      <div class="picker-container">
        <input 
          type="text" 
          .value="${displayValue}"
          placeholder="${this.placeholder}"
          @input="${this._handleInput}"
          @focus="${this._handleFocus}"
          @click="${() => this.open = true}"
        >
        
        <div class="chevron ${this.open ? 'open' : ''}" @click="${(e) => { e.stopPropagation(); this.open = !this.open; }}"></div>
        
        ${this.value ? html`<div class="clear-btn" @click="${this._clearSelection}">✕</div>` : ''}
        
        ${this.open ? html`
          <div class="dropdown">
            ${filtered.length > 0 ? filtered.map(ent => html`
              <div class="item ${this.value === ent.id ? 'selected' : ''}" @mousedown="${(e) => { e.preventDefault(); this._selectItem(ent.id, ent.name); }}">
                <div class="item-name">${ent.name.replace(` (${ent.id})`, '')}</div>
                <div class="item-id">${ent.id}</div>
              </div>
            `) : html`<div class="item empty">Keine Entitäten gefunden</div>`}
          </div>
        ` : ''}
      </div>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        position: relative;
        width: 100%;
        color-scheme: dark;
      }
      .picker-container {
        position: relative;
        width: 100%;
      }
      input {
        width: 100%;
        padding: 14px 16px;
        padding-right: 60px;
        border-radius: 8px;
        border: 1px solid #3a3a40;
        box-sizing: border-box;
        font-size: 1em;
        background: rgba(10, 10, 12, 0.8);
        color: #fff;
        transition: all 0.3s;
        font-family: inherit;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
        cursor: text;
      }
      input:focus {
        outline: none;
        border-color: #0bc4e2;
        box-shadow: 0 0 0 2px rgba(11, 196, 226, 0.2);
      }
      .chevron {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 0; 
        height: 0; 
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid #888;
        cursor: pointer;
        transition: transform 0.2s;
        pointer-events: none;
      }
      .chevron.open {
        transform: translateY(-50%) rotate(180deg);
      }
      .clear-btn {
        position: absolute;
        right: 35px;
        top: 50%;
        transform: translateY(-50%);
        cursor: pointer;
        color: #888;
        font-size: 14px;
        background: rgba(255,255,255,0.05);
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }
      .clear-btn:hover {
        color: #fff;
        background: rgba(255,255,255,0.15);
      }
      .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 5px;
        background: #1a1a1f;
        border: 1px solid #0bc4e2;
        border-radius: 8px;
        max-height: 280px;
        overflow-y: auto;
        z-index: 9999;
        box-shadow: 0 10px 40px rgba(0,0,0,0.7);
      }
      .dropdown::-webkit-scrollbar {
        width: 8px;
      }
      .dropdown::-webkit-scrollbar-track {
        background: rgba(0,0,0,0.1);
        border-radius: 0 8px 8px 0;
      }
      .dropdown::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
      }
      .dropdown::-webkit-scrollbar-thumb:hover {
        background: #666;
      }
      .item {
        padding: 10px 14px;
        cursor: pointer;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .item:last-child {
        border-bottom: none;
      }
      .item:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .item.selected {
        background: rgba(11, 196, 226, 0.1);
        border-left: 3px solid #0bc4e2;
      }
      .item-name {
        color: #fff;
        font-size: 0.95em;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .item-id {
        color: #888;
        font-size: 0.8em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .item.empty {
        color: #888;
        font-style: italic;
        cursor: default;
        text-align: center;
        padding: 20px;
      }
      .item.empty:hover {
        background: none;
      }
    `;
  }
}
if (!customElements.get('openkairo-entity-picker')) {
    customElements.define('openkairo-entity-picker', OpenKairoEntityPicker);
}

class OpenKairoMiningPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      activeTab: { type: String },
      editingMinerId: { type: String },
      editForm: { type: Object },
      simulatorModels: { type: Object },
      mempool: { type: Object },
      difficulty_adjustment: { type: Object },
      btc_price_history: { type: Array },
      btcPriceEur: { type: Number },
      btcPriceUsd: { type: Number },
      previewConfig: { type: Object },
      logs: { type: Array }
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
    this.mempool = { fees: null, height: null, halving: null };

    this.fetchingHistory = {};
    this.simulatorModels = {};
    this.switchHistoryData = {};
    this.fetchingSwitchHistory = {};
    this.manualInputs = {};
    this.difficulty_adjustment = null;
    this.btc_price_history = [];
    this.previewConfig = null;
    this.loadedFonts = new Set();
    this.logs = [];
  }

  firstUpdated() {
    this.loadConfig();
    this.fetchBtcDifficulty();
    this.fetchBtcPrice();
    this.fetchMarketData();
    this.fetchBtcPriceHistory();
    
    // Refresh miner states/config every 30 seconds
    setInterval(() => {
      this.loadConfig();
    }, 30 * 1000);

    // Refresh market data every 10 minutes
    setInterval(() => {
      this.fetchBtcPrice();
      this.fetchMarketData();
    }, 10 * 60 * 1000);

    // Refresh history every hour
    setInterval(() => {
      this.fetchBtcPriceHistory();
    }, 60 * 60 * 1000);
  }

  async fetchMarketData() {
    try {
      const response = await fetch('https://mempool.space/api/v1/difficulty-adjustment');
      const data = await response.json();
      if (data) {
        this.difficulty_adjustment = data;
        this.requestUpdate();
      }
    } catch (e) {
      console.error("Failed to fetch difficulty adjustment", e);
    }
  }

  async fetchBtcPriceHistory() {
    try {
      // Use CoinGecko API (CORS friendly) for granular 24h data
      const response = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=eur&days=1');
      const data = await response.json();
      
      if (data && data.prices && Array.isArray(data.prices)) {
        // CoinGecko returns {"prices": [[timestamp, price], ...]}
        this.btc_price_history = data.prices.map(p => ({
          time: p[0],
          EUR: p[1]
        }));
        this.requestUpdate();
      }
    } catch (e) {
      console.error("Failed to fetch BTC price history from CoinGecko", e);
    }
  }

  _loadGoogleFont(fontName) {
    if (!fontName || fontName === 'Inter' || fontName === 'sans-serif' || this.loadedFonts.has(fontName)) return;
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;700;800&display=swap`;
    document.head.appendChild(link);
    this.loadedFonts.add(fontName);
    console.log(`Font loaded: ${fontName}`);
  }

  _renderPriceChart() {
    if (!this.btc_price_history || this.btc_price_history.length < 2) return '';
    
    const prices = this.btc_price_history.map(p => p.EUR).filter(v => v != null && !isNaN(v));
    if (prices.length < 2) return '';
    
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1; // Fallback to 1 to avoid division by zero
    
    const width = 120; // Increased width
    const height = 30;
    const padding = 4;
    
    const points = prices.map((p, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - (((p - min) / range) * (height - padding * 2) + padding);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    
    const d = `M ${points.join(' L ')}`;
    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? 'var(--theme-accent-4)' : '#ff4d4d';

    return html`
      <div style="display: flex; align-items: center; gap: 12px; margin-left: 12px; opacity: 0.9; background: rgba(0,0,0,0.4); padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(var(--theme-accent-1-rgb), 0.1); box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 1px;">
          <span style="font-size: 0.6em; text-transform: uppercase; color: var(--theme-text-dim); letter-spacing: 1px; font-weight: 800; opacity: 0.6;">BTC Trend</span>
          <span style="font-size: 0.9em; font-weight: 950; color: ${color}; font-family: var(--theme-font); line-height: 1;">
            ${isUp ? '↑' : '↓'} ${Math.abs(((prices[prices.length - 1] - prices[0]) / (prices[0] || 1)) * 100).toFixed(1)}%
          </span>
        </div>
        <svg width="60" height="24" viewBox="0 0 120 30" preserveAspectRatio="none" style="margin-left: 6px;">
          <path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 5px ${color}88);" />
        </svg>
      </div>
    `;
  }

  _renderHalvingCircle() {
    if (!this.mempool || !this.mempool.halving) return '';
    
    const blocksRemaining = this.mempool.halving;
    const totalBlocksPerHalving = 210000;
    const progress = Math.max(0, Math.min(100, (1 - (blocksRemaining / totalBlocksPerHalving)) * 100));
    
    const size = 54; // Reduced size
    const stroke = 4; // Reduced stroke
    const radius = (size - stroke) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return html`
      <div class="halving-widget" style="display: flex; gap: 15px; align-items: center; background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
        <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
          <svg width="${size}" height="${size}">
            <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="${stroke}" />
            <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="var(--theme-accent-2)" stroke-width="${stroke}" 
                    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
                    style="transition: stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1); transform: rotate(-90deg); transform-origin: 50% 50%; filter: drop-shadow(0 0 8px var(--theme-accent-2));" />
          </svg>
          <div style="position: absolute; text-align: center;">
            <div style="font-size: 0.8em; font-weight: 950; color: var(--theme-text-main); font-family: var(--theme-font); letter-spacing: -0.5px;">${Math.floor(progress)}%</div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="font-size: 0.6em; text-transform: uppercase; letter-spacing: 1.5px; color: var(--theme-text-dim); font-weight: 800; opacity: 0.7;">Halving</div>
          <div style="font-size: 0.9em; font-weight: 950; color: var(--theme-accent-2); font-family: var(--theme-font); line-height: 1.1;">
            ${(blocksRemaining/1000).toFixed(1)}k <span style="font-size: 0.7em; color: var(--theme-text-dim); font-weight: 600;">Blocks</span>
          </div>
        </div>
      </div>
    `;
  }

  _renderDesignPreview() {
    return html`
      <div class="preview-box" style="margin-bottom: 30px; padding: 25px; background: rgba(var(--theme-primary-rgb), 0.03); border: 2px dashed rgba(var(--theme-primary-rgb), 0.2); border-radius: var(--theme-radius); overflow: hidden; animation: fadeIn 1s ease-out;">
        <div style="font-size: 0.75em; text-transform: uppercase; letter-spacing: 2px; color: var(--theme-text-dim); margin-bottom: 15px; font-weight: 800;">Live Vorschau</div>
        
        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 150px; background: var(--theme-bg-card); border: 1px solid var(--theme-border-color); padding: 15px; border-radius: var(--theme-radius); box-shadow: 0 5px 15px rgba(0,0,0,0.2);">
            <div style="color: var(--theme-accent-1); font-weight: 800; font-size: 0.6em; text-transform: uppercase;">Example Metric</div>
            <div style="font-size: 1.4em; font-weight: 800; color: var(--theme-text-main); margin-top: 5px;">140.5 <span style="font-size: 0.5em; color: var(--theme-text-dim);">TH/s</span></div>
          </div>
          <div style="flex: 1; min-width: 200px; background: var(--theme-bg-card); border: 1px solid var(--theme-border-color); padding: 15px; border-radius: var(--theme-radius); box-shadow: 0 5px 15px rgba(0,0,0,0.2);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 30px; height: 30px; background: var(--theme-accent-2); border-radius: 50%; box-shadow: 0 0 10px var(--theme-accent-2);"></div>
              <div>
                <div style="font-weight: 800; font-size: 0.8em; color: var(--theme-primary);">Antminer S21</div>
                <div style="font-size: 0.6em; color: var(--theme-text-dim);">Status: Aktiv</div>
              </div>
            </div>
            <div style="margin-top: 10px; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
              <div style="width: 70%; height: 100%; background: var(--theme-accent-1); box-shadow: 0 0 5px var(--theme-accent-1);"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async fetchBtcPrice() {
    try {
      // Use Blockchain.info for better decimal precision
      const response = await fetch('https://blockchain.info/ticker');
      const data = await response.json();
      if (data && data.EUR) {
        this.btcPriceEur = data.EUR.last;
        this.btcPriceUsd = data.USD.last;
        this.requestUpdate();
      }
    } catch (e) {
      console.error("Failed to fetch BTC price", e);
      // Fallback to mempool if blockchain.info fails
      try {
        const response = await fetch('https://mempool.space/api/v1/prices');
        const data = await response.json();
        if (data && data.EUR) {
          this.btcPriceEur = data.EUR;
          this.btcPriceUsd = data.USD;
          this.requestUpdate();
        }
      } catch (e2) {}
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
      } else {
        // Fallback-Difficulty (approximierter Wert für 2024/2025)
        this.btcDifficulty = 82000000000000; 
      }
    } catch (e) {
      console.error("Failed to fetch BTC difficulty", e);
      this.btcDifficulty = 82000000000000; // Final Fallback
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

  async fetchSwitchHistory(entityId) {
    if (!this.hass || !entityId) return;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); // roughly 7 days including today
    const startStr = sevenDaysAgo.toISOString();

    try {
      const response = await this.hass.callApi('GET', `history/period/${startStr}?filter_entity_id=${entityId}`);
      if (response && response.length > 0) {
        this.switchHistoryData = { ...this.switchHistoryData, [entityId]: response[0] };
        this.requestUpdate();
      } else {
        this.switchHistoryData = { ...this.switchHistoryData, [entityId]: [] };
        this.requestUpdate();
      }
    } catch (e) {
      console.error("Failed to fetch switch history for " + entityId, e);
      this.switchHistoryData = { ...this.switchHistoryData, [entityId]: [] };
      this.requestUpdate();
    }
  }

  calculateRuntime(entityId) {
    const historyData = this.switchHistoryData[entityId] || [];
    const currentStateObj = this.hass ? this.hass.states[entityId] : null;

    let data = [...historyData];

    if (currentStateObj) {
      const lastHistoryTime = data.length > 0 ? new Date(data[data.length - 1].last_changed).getTime() : 0;
      const currentTime = new Date(currentStateObj.last_changed).getTime();

      if (currentTime > lastHistoryTime) {
        data.push({
          state: currentStateObj.state,
          last_changed: currentStateObj.last_changed
        });
      }
    }

    if (data.length === 0 && !currentStateObj) {
      return { todayMinutes: 0, weekMinutes: 0 };
    }

    let todayMinutes = 0;
    let weekMinutes = 0;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const currentMillis = now.getTime();
    const sevenDaysAgo = currentMillis - (7 * 24 * 60 * 60 * 1000);

    let lastOnTime = null;

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const time = new Date(item.last_changed).getTime();
      const state = item.state;

      if (state === 'on') {
        if (!lastOnTime) lastOnTime = time;
      } else if (state === 'off' || state === 'unavailable' || state === 'unknown') {
        if (lastOnTime) {
          const interval = time - lastOnTime;

          // Woche
          if (lastOnTime >= sevenDaysAgo) {
            weekMinutes += interval / 60000;
          } else if (time > sevenDaysAgo) {
            weekMinutes += (time - sevenDaysAgo) / 60000;
          }

          // Heute
          if (lastOnTime >= startOfToday) {
            todayMinutes += interval / 60000;
          } else if (time > startOfToday) {
            todayMinutes += (time - startOfToday) / 60000;
          }
          lastOnTime = null;
        }
      }
    }

    // Wenn der Miner *jetzt* an ist, die laufende Strecke ab dem letzten 'on' addieren
    if (lastOnTime && currentStateObj && currentStateObj.state === 'on') {
      const interval = currentMillis - lastOnTime;

      if (lastOnTime >= sevenDaysAgo) {
        weekMinutes += interval / 60000;
      } else if (currentMillis > sevenDaysAgo) {
        weekMinutes += (currentMillis - sevenDaysAgo) / 60000;
      }

      if (lastOnTime >= startOfToday) {
        todayMinutes += interval / 60000;
      } else if (currentMillis > startOfToday) {
        todayMinutes += (currentMillis - startOfToday) / 60000;
      }
    }

    return { todayMinutes, weekMinutes };
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
          this.states = data.states || {};
          this.mempool = data.mempool || { fees: null, height: null, halving: null };
          this.logs = data.logs || [];
        } else {
          this.config = { miners: [] };
          this.states = {};
          this.mempool = { fees: null, height: null, halving: null };
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
      forecast_min: 0,
      soc_on: 90,
      soc_off: 30,
      standby_watchdog_enabled: false,
      standby_switch: '',
      standby_power: 100,
      standby_delay: 10,
      soft_start_enabled: false,
      soft_stop_enabled: false,
      soft_continuous_scaling: false,
      soft_start_steps: '100, 500, 1000',

      soft_stop_steps: '1000, 500, 100',
      soft_interval: 60,
      switch_2: '',
      watchdog_type: 'power'
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

  async callHardwareService(miner, service, option = null) {
    if (!this.hass) return;
    const ipAddress = miner.miner_ip || '';
    if (ipAddress && ipAddress.includes('.')) { 
        // Falls IP-Adresse erkannt (Punkte enthalten)
        const data = { ip_address: ipAddress };
        if (option) data.mode = option;
        
        try {
            await this.hass.callService('openkairo_mining', service, data);
            console.log(`Calling service ${service} for ${ipAddress}`);
        } catch (e) {
            console.error("Error calling hardware service", e);
        }
    } else {
        // Fallback auf alte Methode
        this.callMinerService(miner, service, option ? { mode: option } : {});
    }
  }

  async callMinerService(miner, service, data = {}) {
    if (!this.hass) return;
    // Da wir jetzt alles in openkairo_mining haben, leiten wir ggf. um
    try {
      await this.hass.callService('openkairo_mining', service, data);
    } catch (e) {
      // Fallback auf alte miner integration falls noch vorhanden
      await this.hass.callService('miner', service, data);
    }
  }

  toggleMiner(miner) {
    if (!this.hass) return;
    let entityId = typeof miner === 'string' ? miner : miner.switch;
    
    // Auto-Discovery Fallback if no switch is configured
    if (!entityId && typeof miner === 'object' && miner.miner_ip) {
        const ipSlug = miner.miner_ip.replace(/\./g, '_');
        // Versuche den Standardnamen der Integration
        const discovered = `switch.openkairo_mining_${ipSlug}_switch`;
        if (this.hass.states[discovered]) {
            entityId = discovered;
        } else {
            // Alternativer Name (mining_switch unique_id suffix)
            const alt = `switch.openkairo_mining_${ipSlug}_mining_aktiv`;
             if (this.hass.states[alt]) entityId = alt;
        }
    }

    if (!entityId) {
        console.warn("Could not find a switch to toggle for miner:", miner);
        return;
    }
    
    this.hass.callService("switch", "toggle", { entity_id: entityId });
  }

  callMinerService(miner, serviceName, serviceData = {}) {
    if (!this.hass || (!miner.switch && !miner.switch_2)) {
      alert("Es muss ein Schalter hinterlegt sein, um den Miner zu steuern.");
      return;
    }

    const targetSwitch = miner.switch || miner.switch_2;
    const stateObj = this.hass.states[targetSwitch];
    const deviceId = stateObj?.attributes?.device_id;

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
    const finalValue = type === 'checkbox' ? checked : value;
    
    if ((name === 'switch_2' || name === 'standby_switch_2') && finalValue && finalValue !== this.editForm[name]) {
        if (!confirm("⚠️ WARNUNG: Der Betrieb eines Miners an zwei getrennten smarten Steckdosen ist eigentlich nicht zulässig und erfolgt auf eigene Gefahr! \n\nEs kann zu Problemen beim Leistungsschutz oder zur Überlastung führen. Möchtest du fortfahren?")) {
            e.target.value = '';
            return;
        }
    }

    let updatedForm = { ...this.editForm, [name]: finalValue };

    // Automatische Entitäten-Vorauswahl bei IP-Eingabe
    if (name === 'miner_ip' && finalValue.includes('.')) {
        const ipSlug = finalValue.replace(/\./g, '_');
        const domain = 'openkairo_mining';
        
        const autoHashrate = `sensor.${domain}_${ipSlug}_hashrate`;
        const autoTemp = `sensor.${domain}_${ipSlug}_temperature`;
        const autoPower = `sensor.${domain}_${ipSlug}_power`;
        const autoLimit = `number.${domain}_${ipSlug}_power_limit`;

        if (this.hass?.states[autoHashrate] && !updatedForm.hashrate_sensor) updatedForm.hashrate_sensor = autoHashrate;
        if (this.hass?.states[autoTemp] && !updatedForm.temp_sensor) updatedForm.temp_sensor = autoTemp;
        if (this.hass?.states[autoPower] && !updatedForm.power_consumption_sensor) updatedForm.power_consumption_sensor = autoPower;
        if (this.hass?.states[autoLimit] && !updatedForm.power_entity) updatedForm.power_entity = autoLimit;
    }

    this.editForm = updatedForm;
    this.requestUpdate();
  }

  quickUpdateMiner(id, key, value) {
    const index = this.config.miners.findIndex(m => m.id === id);
    if (index > -1) {
      if (typeof value === 'boolean') {
        this.config.miners[index][key] = value;
      } else {
        this.config.miners[index][key] = parseFloat(value);
      }
      this.saveConfig(true);
      this.requestUpdate();
    }
  }

  showMoreInfo(entityId) {
    if (!entityId) return;
    const event = new Event('hass-more-info', { bubbles: true, composed: true });
    event.detail = { entityId: entityId };
    this.dispatchEvent(event);
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
          name: stateObj.attributes?.friendly_name ? `${stateObj.attributes.friendly_name} (${entityId})` : entityId
        };
      });
  }

  _getPowerMarkers(miner) {
    const startSteps = (miner.soft_start_steps || '').split(',').map(s => parseFloat(s.trim()));
    const stopSteps = (miner.soft_stop_steps || '').split(',').map(s => parseFloat(s.trim()));
    const allSteps = [...new Set([...startSteps, ...stopSteps])]
      .filter(v => !isNaN(v))
      .sort((a, b) => a - b);
    return allSteps;
  }


  _hexToRgb(hex) {
    if (!hex) return "11, 196, 226";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  }

  _applyThemeStyles() {
    const theme = this.config.theme || 'cyberpunk';
    
    // Default system colors (fallback)
    let colors = {
      accent1: this.config.color_hashrate || '#0bc4e2',
      accent2: this.config.color_earnings || '#d62cf6',
      accent3: this.config.color_efficiency || '#ffcc00',
      accent4: this.config.color_power || '#00ff88',
      primary: this.config.color_primary || '#0bc4e2',
      bgText: this.config.color_text_main || '#ffffff',
      bgTextDim: this.config.color_text_dim || '#888888',
      bgApp: this.config.color_bg_app || 'radial-gradient(circle at center 0%, #201a14 0%, #0d0c0b 100%)',
      bgHeader: this.config.color_bg_header || 'rgba(18, 18, 20, 0.5)',
      bgCard: this.config.color_bg_card || 'rgba(18, 18, 20, 0.4)',
      borderColor: this.config.color_border || `rgba(${this._hexToRgb(this.config.color_hashrate || '#0bc4e2')}, 0.1)`
    };
    
    let layout = {
      radius: this.config.radius || '16px',
      font: this.config.font_family || "'Inter', sans-serif",
      glow: this.config.glow_intensity || '0.15'
    };

    // Presets override defaults unless custom is selected
    if (theme === 'matrix') {
       colors = { 
         accent1: '#00ff41', accent2: '#008f11', accent3: '#d1d1d1', accent4: '#003b00',
         primary: '#00ff41', bgText: '#00ff41', bgTextDim: '#008f11',
         bgApp: '#000000', bgHeader: 'rgba(0, 20, 0, 0.8)', bgCard: 'rgba(0, 10, 0, 0.6)',
         borderColor: 'rgba(0, 255, 65, 0.3)'
       };
       layout = { radius: '0px', font: "'Courier New', monospace", glow: '0.4' };
    } else if (theme === 'classic') {
       colors = { 
         accent1: '#f7931a', accent2: '#ffffff', accent3: '#4d4d4d', accent4: '#f7931a',
         primary: '#f7931a', bgText: '#ffffff', bgTextDim: '#a0a0a0',
         bgApp: 'radial-gradient(circle at center, #2e2e2e 0%, #111111 100%)', 
         bgHeader: 'rgba(40, 40, 40, 0.6)', bgCard: 'rgba(40, 40, 40, 0.4)',
         borderColor: 'rgba(247, 147, 26, 0.3)'
       };
       layout = { radius: '12px', font: "'Inter', sans-serif", glow: '0.15' };
    } else if (theme === 'solar') {
       colors = { 
         accent1: '#ff9d00', accent2: '#ffcc00', accent3: '#ff5e00', accent4: '#ffcc00',
         primary: '#ff9d00', bgText: '#fff4e6', bgTextDim: '#a68b6d',
         bgApp: 'linear-gradient(135deg, #2d1b0d 0%, #000000 100%)', 
         bgHeader: 'rgba(45, 30, 20, 0.6)', bgCard: 'rgba(45, 30, 20, 0.4)',
         borderColor: 'rgba(255, 157, 0, 0.2)'
       };
       layout = { radius: '24px', font: "'Outfit', sans-serif", glow: '0.1' };
    } else if (theme === 'cyberpunk') {
       colors = {
         accent1: '#00fbff', accent2: '#ff00ff', accent3: '#ffff00', accent4: '#00ff88',
         primary: '#00fbff', bgText: '#ffffff', bgTextDim: '#a0a0b0',
         bgApp: 'linear-gradient(135deg, #120a1f 0%, #050505 100%)',
         bgHeader: 'rgba(20, 10, 30, 0.6)', bgCard: 'rgba(20, 10, 30, 0.4)',
         borderColor: 'rgba(0, 251, 255, 0.2)'
       };
       layout = { radius: '16px', font: "'Inter', sans-serif", glow: '0.2' };
    } else if (theme === 'midnight') {
       colors = {
         accent1: '#a29bfe', accent2: '#6c5ce7', accent3: '#dfe6e9', accent4: '#ff7675',
         primary: '#6c5ce7', bgText: '#ffffff', bgTextDim: '#b2bec3',
         bgApp: 'linear-gradient(180deg, #1e1e2f 0%, #0f0f1a 100%)',
         bgHeader: 'rgba(30, 30, 47, 0.6)', bgCard: 'rgba(45, 45, 70, 0.3)',
         borderColor: 'rgba(108, 92, 231, 0.2)'
       };
       layout = { radius: '12px', font: "'Outfit', sans-serif", glow: '0.2' };
    } else if (theme === 'atlantis') {
       colors = {
         accent1: '#00cec9', accent2: '#0984e3', accent3: '#81ecec', accent4: '#55efc4',
         primary: '#0984e3', bgText: '#f1f2f6', bgTextDim: '#74b9ff',
         bgApp: 'radial-gradient(circle at top left, #002f4b 0%, #000000 100%)',
         bgHeader: 'rgba(0, 47, 75, 0.5)', bgCard: 'rgba(0, 100, 150, 0.1)',
         borderColor: 'rgba(0, 206, 201, 0.15)'
       };
       layout = { radius: '20px', font: "'Inter', sans-serif", glow: '0.25' };
    } else if (theme === 'lava') {
       colors = {
         accent1: '#ff7675', accent2: '#d63031', accent3: '#fdcb6e', accent4: '#e17055',
         primary: '#d63031', bgText: '#ffffff', bgTextDim: '#fab1a0',
         bgApp: 'linear-gradient(135deg, #1a0f0f 0%, #000000 100%)',
         bgHeader: 'rgba(45, 20, 20, 0.7)', bgCard: 'rgba(60, 25, 25, 0.3)',
         borderColor: 'rgba(214, 48, 49, 0.25)'
       };
       layout = { radius: '4px', font: "'Outfit', sans-serif", glow: '0.3' };
    } else if (theme === 'ice') {
       colors = {
         accent1: '#00d2ff', accent2: '#e1e1e1', accent3: '#ffffff', accent4: '#00d2ff',
         primary: '#00d2ff', bgText: '#ffffff', bgTextDim: '#b0e0e6',
         bgApp: 'linear-gradient(135deg, #001f3f 0%, #000000 100%)',
         bgHeader: 'rgba(0, 40, 80, 0.6)', bgCard: 'rgba(255, 255, 255, 0.05)',
         borderColor: 'rgba(0, 210, 255, 0.4)'
       };
       layout = { radius: '16px', font: "'Inter', sans-serif", glow: '0.4' };
    } else if (theme === 'abyss') {
       colors = {
         accent1: '#00ff9f', accent2: '#001f3f', accent3: '#00d2ff', accent4: '#00ff9f',
         primary: '#00ff9f', bgText: '#ffffff', bgTextDim: '#00ccff',
         bgApp: '#000000',
         bgHeader: 'rgba(0, 15, 30, 0.9)', bgCard: 'rgba(0, 31, 63, 0.3)',
         borderColor: 'rgba(0, 255, 159, 0.3)'
       };
       layout = { radius: '30px', font: "'Outfit', sans-serif", glow: '0.3' };
    } else if (theme === 'gladbeck') {
       colors = {
         accent1: '#0078bb', accent2: '#ff9900', accent3: '#ffffff', accent4: '#0078bb',
         primary: '#0078bb', bgText: '#ffffff', bgTextDim: '#a0c4ff',
         bgApp: 'linear-gradient(135deg, #001f3f 0%, #000000 100%)',
         bgHeader: 'rgba(0, 40, 80, 0.8)', bgCard: 'rgba(255, 255, 255, 0.05)',
         borderColor: 'rgba(0, 120, 187, 0.4)'
       };
       layout = { radius: '12px', font: "'Inter', sans-serif", glow: '0.35' };
    }

    // Try loading font if it looks like a Google Font
    if (layout.font && layout.font.includes("'")) {
        const cleanFont = layout.font.replace(/'/g, '').split(',')[0].trim();
        this._loadGoogleFont(cleanFont);
    }

    // Apply styles directly to host for maximum reliability
    const root = this;
    root.style.setProperty('--theme-accent-1', colors.accent1);
    root.style.setProperty('--theme-accent-2', colors.accent2);
    root.style.setProperty('--theme-accent-3', colors.accent3);
    root.style.setProperty('--theme-accent-4', colors.accent4);
    root.style.setProperty('--theme-accent-1-rgb', this._hexToRgb(colors.accent1));
    root.style.setProperty('--theme-accent-2-rgb', this._hexToRgb(colors.accent2));
    root.style.setProperty('--theme-accent-3-rgb', this._hexToRgb(colors.accent3));
    root.style.setProperty('--theme-accent-4-rgb', this._hexToRgb(colors.accent4));
    
    root.style.setProperty('--theme-primary', colors.primary);
    root.style.setProperty('--theme-primary-rgb', this._hexToRgb(colors.primary));
    root.style.setProperty('--theme-text-main', colors.bgText);
    root.style.setProperty('--theme-text-dim', colors.bgTextDim);
    root.style.setProperty('--theme-bg-app', colors.bgApp);
    root.style.setProperty('--theme-bg-header', colors.bgHeader);
    root.style.setProperty('--theme-bg-card', colors.bgCard);
    root.style.setProperty('--theme-border-color', colors.borderColor);
    
    root.style.setProperty('--theme-radius', layout.radius);
    root.style.setProperty('--theme-font', layout.font);
    root.style.setProperty('--theme-glow-op', layout.glow);

    // Set host attribute for CSS targeting
    this.setAttribute('theme', theme);
    return html``;
  }


  render() {
    const theme = this.config.theme || 'cyberpunk';
    const walletSensor = this.config.wallet_btc_sensor;
    const walletState = (this.hass && walletSensor && this.hass.states[walletSensor]) ? this.hass.states[walletSensor].state : '0.0000';
    const profileImg = this.config.profile_image || 'https://openkairo.de/wp-content/uploads/2024/01/openkairo-logo-icon.png';

    // Apply variables to host
    this._applyThemeStyles();

    return html`
      ${this.config.background_animations_enabled !== false ? html`<div class="theme-bg-overlay"></div>` : ''}
      <div class="dashboard-container">
        <div class="header">
          <div class="profile-section">
            <div class="avatar-container" style="width: 72px; height: 72px;">
              <div style="width: 100%; height: 100%; border-radius: 50%; border: 2px solid var(--theme-accent-2); box-shadow: 0 0 25px rgba(var(--theme-accent-2-rgb), 0.4); overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center;">
                <img src="${profileImg}" style="width: 110%; height: 110%; object-fit: cover;">
              </div>
              <div style="position: absolute; bottom: 4px; right: 4px; width: 16px; height: 16px; background: var(--theme-accent-1); border: 3px solid #111; border-radius: 50%; box-shadow: 0 0 15px var(--theme-accent-1);"></div>
            </div>
            <div class="wallet-info">
              <div style="color: var(--theme-text-dim); font-size: 0.65em; text-transform: uppercase; letter-spacing: 3px; font-weight: 800; margin-bottom: 2px; opacity: 0.6;">Total Portfolio</div>
              <div style="color: var(--theme-text-main); font-size: 2.6em; font-weight: 950; font-family: var(--theme-font); text-shadow: 0 0 20px rgba(var(--theme-text-main-rgb, 255,255,255), 0.1); display: flex; align-items: baseline; gap: 8px; letter-spacing: -1.5px; line-height: 1;">
                ${walletState} <span style="font-size: 0.35em; color: var(--theme-accent-2); letter-spacing: 2px; font-weight: 900; opacity: 0.9;">BTC</span>
              </div>
              ${this.btcPriceEur && walletState && parseFloat(walletState) > 0 ? html`
                <div style="font-size: 0.9em; color: #888; font-weight: bold; margin-top: 2px; letter-spacing: 1px; opacity: 0.8;">
                   ≈ ${(parseFloat(walletState) * this.btcPriceEur).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                </div>
              ` : ''}
            </div>
          </div>

          <div class="market-section">
            ${this._renderHalvingCircle()}
            <div style="height: 40px; width: 1px; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent);"></div>
            ${this._renderPriceChart()}
          </div>

          <div class="title-section" style="text-align: right;">
            ${theme === 'gladbeck' ? html`
              <div class="partner-sponsorship" style="margin-bottom: 15px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 0.65em; letter-spacing: 2px; opacity: 0.4; text-transform: uppercase; font-weight: 800; color: #fff;">Exklusiver Partner</span>
                  <img src="https://solarmodule-gladbeck.de/wp-content/uploads/2023/07/cropped-logo_new.png" style="height: 55px; filter: drop-shadow(0 0 15px rgba(0,120,187,0.4));">
                </div>
                <a href="https://solarmodule-gladbeck.de" target="_blank" class="partner-btn" style="text-decoration: none; background: rgba(0,120,187,0.2); border: 1px solid rgba(0,120,187,0.5); color: #fff; padding: 6px 15px; border-radius: 20px; font-size: 0.75em; font-weight: bold; letter-spacing: 1px; transition: all 0.3s ease; box-shadow: 0 0 15px rgba(0,120,187,0.2); display: flex; align-items: center; gap: 8px;">
                  <span>Website besuchen</span>
                  <span style="font-size: 1.25em;">↗</span>
                </a>
              </div>
            ` : ''}
            <h1 style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; margin: 0;">
              <span style="opacity: 0.6; font-size: 0.8em;">₿</span> OpenKairo <span style="color: var(--theme-accent-1); opacity: 0.9;">Mining</span>
              <span style="font-size: 0.3em; background: rgba(var(--theme-accent-1-rgb), 0.15); border: 1px solid rgba(var(--theme-accent-1-rgb), 0.3); border-radius: 6px; padding: 4px 10px; color: var(--theme-accent-1); font-weight: 950; text-shadow: none; vertical-align: middle; letter-spacing: 1px;">PREMIUM v1.3</span>
            </h1>
            <p class="subtitle" style="margin-top: 5px;">${theme === 'gladbeck' ? 'Sponsoring Edition' : 'Next-Gen Miner Control'}</p>
          </div>
        </div>


      ${this._renderTicker()}


      <div class="tabs">
        <div class="tab ${this.activeTab === 'dashboard' ? 'active' : ''}" @click="${() => { this.activeTab = 'dashboard'; this.editingMinerId = null; }}">Dashboard</div>
        <div class="tab ${this.activeTab === 'statistics' ? 'active' : ''}" @click="${() => { this.activeTab = 'statistics'; this.editingMinerId = null; }}">Graphen</div>
        <div class="tab ${this.activeTab === 'design' ? 'active' : ''}" @click="${() => { this.activeTab = 'design'; this.editingMinerId = null; }}">🎨 Design</div>
        ${this.config.show_energy_tab ? html`<div class="tab ${this.activeTab === 'energy' ? 'active' : ''}" @click="${() => { this.activeTab = 'energy'; this.editingMinerId = null; }}">⚡ Rentabilität</div>` : ''}
        <div class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => { this.activeTab = 'settings'; this.editingMinerId = null; }}">Einstellungen</div>
        <div class="tab ${this.activeTab === 'info' ? 'active' : ''}" @click="${() => { this.activeTab = 'info'; this.editingMinerId = null; }}">Hilfe</div>
      </div>

      <div class="content">
        ${(() => {
          try {
            if (this.activeTab === 'dashboard') return html`
              ${this.renderActivityTicker()}
              <div class="tab-content-anim">${this.renderDashboard()}</div>
            `;
            if (this.activeTab === 'statistics') return html`<div class="tab-content-anim">${this.renderStatistics()}</div>`;
            if (this.activeTab === 'energy') return html`<div class="tab-content-anim">${this.renderEnergyStats()}</div>`;
            if (this.activeTab === 'design') return html`<div class="tab-content-anim">${this.renderDesignSettings()}</div>`;
            if (this.activeTab === 'settings') return html`<div class="tab-content-anim">${this.renderSettings()}</div>`;
            if (this.activeTab === 'info') return html`<div class="tab-content-anim">${this.renderInfo()}</div>`;
            return '';
          } catch (e) {
            console.error("Dashboard Render Error:", e);
            return html`
              <div class="card" style="border-color: #e74c3c; background: rgba(231, 76, 60, 0.1);">
                <h2 style="color: #e74c3c;">⚠️ Anzeige-Fehler</h2>
                <p>Ein Fehler ist beim Erstellen dieser Ansicht aufgetreten. Dies passiert oft, wenn Home Assistant Sensoren fehlen oder ungültige Daten liefern.</p>
                <div class="tech-box" style="font-family: monospace; font-size: 0.85em; background: #000;">
                  ${e.message}
                </div>
                <button class="btn-primary" style="margin-top: 15px;" @click="${() => window.location.reload()}">Dashboard neu laden</button>
              </div>
            `;
          }
        })()}
      </div>

      <div class="footer">
        <a href="https://openkairo.de" target="_blank">powered by OpenKAIRO</a>
      </div>
      </div>
    `;
  }

  renderInfo() {
    return html`
      <div class="card" style="padding: 30px;">
        <h2 style="display: flex; align-items: center; gap: 15px; margin-top: 0;">
          <span style="font-size: 1.5em;">🚀</span> OpenKairo Dashboard v1.3
        </h2>
        <p style="font-size: 1.1em; color: var(--theme-text-main); line-height: 1.6;">
          <strong>Dein ultimatives Mining Control Center.</strong> <br>
          Dieses Dashboard vereint alle Innovationen der letzten Monate in einer Oberfläche. Hier erfährst du, was OpenKairo so besonders macht:
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-top: 30px;">
          
          <div class="tech-box" style="border-top: 4px solid var(--theme-accent-1); background: rgba(var(--theme-accent-1-rgb), 0.03);">
            <h3 style="margin-top:0; color:var(--theme-accent-1); display: flex; align-items: center; gap: 10px;">
              <span>⚡</span> Direkte Steuerung & Power-Limit
            </h3>
            <p style="color:#bbb; line-height:1.6;">
              Kontrolliere deine Hardware direkt aus dem Dashboard ohne Umwege:
            </p>
            <ul style="color:#888; font-size: 0.9em; padding-left: 20px; margin-bottom: 0; line-height: 1.5;">
              <li><strong>Power Limit Slider:</strong> Reguliere die Wattzahl kompatibler Miner stufenlos im Dashboard.</li>
              <li><strong>Hardware Buttons:</strong> Schalte zwischen LOW, NORM und HIGH Modus oder führe einen Reboot direkt vom Sofa aus durch.</li>
            </ul>
          </div>

          <div class="tech-box" style="border-top: 4px solid var(--theme-accent-4); background: rgba(var(--theme-accent-4-rgb), 0.03);">
            <h3 style="margin-top:0; color:var(--theme-accent-4); display: flex; align-items: center; gap: 10px;">
              <span>🤖</span> Smarter Profit-Rechner (Auto-Fallback)
            </h3>
            <p style="color:#bbb; line-height:1.6;">
              Du weißt immer genau, was hängen bleibt – auch wenn deine Pool-Daten mal nicht da sind:
            </p>
            <ul style="color:#888; font-size: 0.9em; padding-left: 20px; margin-bottom: 0; line-height: 1.5;">
              <li><strong>Auto-Schätzung:</strong> Findet kein Pool-Sensor, nutzt das Dashboard die Live-Netzwerkdaten zur automatischen Ertrags-Vorschau.</li>
              <li><strong>Echtzeit-Statistiken:</strong> Verfolgt deine 7-Tage Historie live aus der Home Assistant Datenbank.</li>
            </ul>
          </div>

          <div class="tech-box" style="border-top: 4px solid var(--theme-accent-3); background: rgba(var(--theme-accent-3-rgb), 0.03);">
            <h3 style="margin-top:0; color:var(--theme-accent-3); display: flex; align-items: center; gap: 10px;">
              <span>📊</span> Präzise Markt-Daten & Ticker
            </h3>
            <p style="color:#bbb; line-height:1.6;">
              Keine Schätzwerte mehr. Wir nutzen hochpräzise Schnittstellen:
            </p>
            <ul style="color:#888; font-size: 0.9em; padding-left: 20px; margin-bottom: 0; line-height: 1.5;">
              <li><strong>High-Precision Price:</strong> Bitcoin Preise mit zwei Nachkommastellen für dein gesamtes Portfolio.</li>
              <li><strong>Live Network Data:</strong> Aktuelle Gebühren (Fees), Halving-Countdown und Block-Height in Echtzeit vom Mempool.</li>
            </ul>
          </div>

          <div class="tech-box" style="border-top: 4px solid var(--theme-accent-2); background: rgba(var(--theme-accent-2-rgb), 0.03);">
            <h3 style="margin-top:0; color:var(--theme-accent-2); display: flex; align-items: center; gap: 10px;">
              <span>🎨</span> Premium Design Studio
            </h3>
            <p style="color:#bbb; line-height:1.6;">
              Dein Dashboard, dein Style. Wähle aus exklusiven Design-Presets:
            </p>
            <ul style="color:#888; font-size: 0.9em; padding-left: 20px; margin-bottom: 0; line-height: 1.5;">
              <li><strong>Themen:</strong> Midnight Glow, Atlantis, Lava Field, Matrix und Solar.</li>
              <li><strong>Anpassung:</strong> Jedes Design wurde für maximale Performance und eine premium Ästhetik optimiert.</li>
            </ul>
          </div>

        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-top: 20px;">
          
          <div class="tech-box" style="border-left: 4px solid #ff9800; background: rgba(255,152,0,0.03);">
             <h3 style="margin-top:0; color:#ff9800; display: flex; align-items: center; gap: 10px;">
              <span>🎢</span> Ramping & Soft-Start
            </h3>
            <p style="color:#bbb; line-height:1.6;">
              Schone deine Hardware und dein Stromnetz. Anstatt sofort auf 100% zu springen, fährt das System die Leistung stufenweise hoch oder runter.
            </p>
            <ul style="color:#888; font-size: 0.85em; padding-left: 20px; margin-bottom: 0;">
              <li><strong>Schonung:</strong> Verhindert Spannungsspitzen und schont das Netzteil.</li>
              <li><strong>Visualisierung:</strong> Während des Vorgangs pulsieren die Status-Badges <strong>orange</strong>.</li>
            </ul>
          </div>

          <div class="tech-box" style="border-left: 4px solid #fff; background: rgba(255,255,255,0.03);">
             <h3 style="margin-top:0; color:#fff; display: flex; align-items: center; gap: 10px;">
              <span>🔒</span> Hardware Wächter 2.0
            </h3>
            <p style="color:#bbb; line-height:1.6;">
              Vollautomatische Überwachung deiner Miner. Wenn etwas hängen bleibt, greift das System ein und startet die Hardware neu – inklusive Countdown-Timer im Dashboard.
            </p>
          </div>

          <div class="tech-box" style="border-left: 4px solid var(--theme-accent-1); background: rgba(var(--theme-accent-1-rgb), 0.03);">
             <h3 style="margin-top:0; color:var(--theme-accent-1); display: flex; align-items: center; gap: 10px;">
              <span>☀️</span> PV & SOC Intelligenz
            </h3>
            <p style="color:#bbb; line-height:1.6;">
              Maximiere die Nutzung deines Solarstroms. Miner schalten basierend auf deiner Einspeisung oder deinem Batterie-Ladestand (Hysterese-gesteuert).
            </p>
          </div>

        </div>

        <div class="tech-box" style="margin-top: 40px; border-color: rgba(var(--theme-accent-1-rgb), 0.2); background: rgba(0,0,0,0.1); border-radius: 20px; padding: 30px;">
          <h2 style="margin-top:0; color:#fff; text-align: center; margin-bottom: 30px;">☕ Projekt unterstützen</h2>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            
            <!-- PayPal Card -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: transform 0.3s ease; cursor: default;">
              <div style="font-size: 2.5em; margin-bottom: 15px;">🚀</div>
              <h3 style="margin: 0 0 10px 0; color: #fff;">PayPal</h3>
              <p style="color: #888; font-size: 0.9em; margin-bottom: 20px;">Die klassische Unterstützung für Kaffee & Energie.</p>
              <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=info@openkairo.de&currency_code=EUR&source=url" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none; width:100%; padding: 12px 0; border-radius:30px; font-weight: 800; font-size: 0.9em;">
                Spenden via PayPal
              </a>
            </div>

            <!-- Bitcoin Card -->
            <div style="background: rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.03); border: 1px solid rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.1); border-radius: 16px; padding: 25px; text-align: center; display: flex; flex-direction: column; align-items: center; transition: transform 0.3s ease;">
              <div style="background: #fff; padding: 10px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 0 20px rgba(0,0,0,0.3);">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=bitcoin:37KAus3ABc6krJ5T4jZyLKVB3uzbfQZGWD" style="width: 100px; height: 100px; display: block;" alt="Bitcoin QR Code">
              </div>
              <h3 style="margin: 0 0 10px 0; color: var(--theme-accent-3);">Bitcoin</h3>
              <p style="color: #888; font-size: 0.8em; margin-bottom: 15px;">Direkt, dezentral & für Miner gemacht.</p>
              <div @click="${(e) => { 
                const addr = '37KAus3ABc6krJ5T4jZyLKVB3uzbfQZGWD';
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(addr).then(() => {
                    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message: 'BTC Adresse kopiert!' }, bubbles: true, composed: true }));
                  }).catch(() => {
                    // Fallback if clipboard fails
                    const textArea = document.createElement('textarea');
                    textArea.value = addr;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message: 'BTC Adresse kopiert!' }, bubbles: true, composed: true }));
                  });
                } else {
                  // Immediate fallback for non-secure contexts
                  const textArea = document.createElement('textarea');
                  textArea.value = addr;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                  this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message: 'BTC Adresse kopiert!' }, bubbles: true, composed: true }));
                }
              }}" 
                   style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; border: 1px dashed rgba(var(--theme-accent-3-rgb), 0.3); font-family: monospace; font-size: 0.75em; color: var(--theme-accent-3); cursor: pointer; width: 100%; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; margin-top: 5px; min-height: 44px;" 
                   title="Klick zum Kopieren">
                <code style="word-break: break-all; text-align: left; padding-right: 10px;">37KAus3AB...QZGWD</code>
                <span style="font-size: 1.2em;">📋</span>
              </div>
            </div>

          </div>

          <p style="color:#555; text-align: center; margin-top: 25px; font-size: 0.85em; font-style: italic;">
            OpenKairo ist ein leidenschaftliches Community-Projekt. Danke für deine Unterstützung!
          </p>
        </div>
      </div>
    `;
  }

  _formatValue(stateObj, unit = '', fallback = '-') {
    if (!stateObj || stateObj.state === 'unavailable' || stateObj.state === 'unknown') {
      return fallback;
    }
    const val = stateObj.state;
    const u = unit || stateObj.attributes?.unit_of_measurement || '';
    return val + (u ? ' ' + u : '');
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
      'soc': 'Batterie SOC'
    };

    // --- OVERVIEW AGGREGATION ---
    let totalHashrateTH = 0;
    let totalPowerW = 0;
    let totalDailyRevBTC = 0;
    let activeMiners = 0;
    let anyBtcPrice = this.btcPriceEur || 0;

    this.config.miners.forEach(miner => {
        const domain = 'openkairo_mining';
        const _ipForSlug = miner.miner_ip || (miner.switch && miner.switch.includes('.') ? miner.switch : '');
        const _ipSlug = _ipForSlug ? _ipForSlug.replace(/\./g, '_') : '';

        // Switch State
        let effectiveSwitch = miner.switch;
        if (!effectiveSwitch && _ipSlug) {
            effectiveSwitch = `switch.${domain}_${_ipSlug}_switch`;
        }
        let switchState = 'off';
        if (this.hass && effectiveSwitch && this.hass.states[effectiveSwitch]) {
          switchState = this.hass.states[effectiveSwitch].state;
        }
        if (switchState === 'on') activeMiners++;

        // Power
        let pSensor = miner.power_consumption_sensor || (_ipSlug ? `sensor.${domain}_${_ipSlug}_power` : '');
        if (this.hass && pSensor && this.hass.states[pSensor]) {
           const watts = parseFloat(this.hass.states[pSensor].state) || 0;
           if (watts > 0 && switchState === 'on') totalPowerW += watts;
        }

        // Hashrate
        let hSensor = miner.hashrate_sensor || (_ipSlug ? `sensor.${domain}_${_ipSlug}_hashrate` : '');
        let hrInTH = 0;
        if (this.hass && hSensor && this.hass.states[hSensor]) {
           const hrState = this.hass.states[hSensor];
           const hrValue = parseFloat(hrState.state) || 0;
           hrInTH = hrValue;
           const unit = (hrState.attributes?.unit_of_measurement || 'TH/s').toUpperCase();
           if (unit.includes('GH')) hrInTH = hrValue / 1000;
           if (unit.includes('PH')) hrInTH = hrValue * 1000;
           if (hrInTH > 0 && switchState === 'on') totalHashrateTH += hrInTH;
        }

        // BTC Earnings (Estimated via Braiins standard formula or direct if sensor exists)
        let btcPerDay = 0;
        const currentDifficulty = this.btcDifficulty || 82000000000000; // Final Fallback
        
        if (miner.calc_method === 'btc_auto' && hrInTH > 0 && switchState === 'on') {
            btcPerDay = (hrInTH * 1e12 / (currentDifficulty * Math.pow(2, 32))) * 86400 * 3.125;
        } else if (miner.crypto_revenue_sensor && this.hass && this.hass.states[miner.crypto_revenue_sensor] && switchState === 'on') {
            btcPerDay = parseFloat(this.hass.states[miner.crypto_revenue_sensor].state) || 0;
        } else if (hrInTH > 0 && switchState === 'on') {
            // AUTO-FALLBACK: Wenn hS vorhanden aber kein Profit-Sensor gesetzt, nutze Auto-Vorschau
            btcPerDay = (hrInTH * 1e12 / (currentDifficulty * Math.pow(2, 32))) * 86400 * 3.125;
        }
        totalDailyRevBTC += btcPerDay;
    });

    const overviewHtml = html`
      <div class="overview-section" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
        
        <div class="card" style="margin-bottom: 0; padding: 25px; border-color: rgba(var(--theme-accent-1-rgb, 11, 196, 226), 0.4); box-shadow: 0 10px 30px rgba(var(--theme-accent-1-rgb, 11, 196, 226), 0.1); position: relative; overflow: hidden; height: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1;">
            <span style="color: var(--theme-accent-1); font-weight: 800; letter-spacing: 1.5px; font-size: 0.8em; text-transform: uppercase;">Total Hashrate</span>
            <span style="background: rgba(var(--theme-accent-1-rgb, 11, 196, 226), 0.15); padding: 4px 8px; border-radius: 6px; color: var(--theme-accent-1); font-size: 0.7em; border: 1px solid rgba(var(--theme-accent-1-rgb, 11, 196, 226), 0.3);">Online: ${activeMiners}/${this.config.miners.length}</span>
          </div>
          <div style="font-size: 2.3em; font-weight: 800; color: #fff; margin-top: 15px; text-shadow: 0 0 15px rgba(255,255,255,0.2); font-family: monospace; position: relative; z-index: 1;">
             ${totalHashrateTH > 0 ? totalHashrateTH.toFixed(2) : '0.00'} <span style="font-size: 0.5em; color: #888;">TH/s</span>
          </div>
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--theme-accent-1); box-shadow: 0 0 10px var(--theme-accent-1);"></div>
          ${this.config.theme === 'gladbeck' ? html`
            <img src="https://solarmodule-gladbeck.de/wp-content/uploads/2023/07/cropped-logo_new.png" style="position: absolute; bottom: 10px; right: 10px; height: 25px; opacity: 0.12; filter: grayscale(1) brightness(1.5); pointer-events: none; z-index: 0;">
          ` : ''}
        </div>

        <div class="card" style="margin-bottom: 0; padding: 25px; border-color: rgba(var(--theme-accent-2-rgb, 214, 44, 246), 0.4); box-shadow: 0 10px 30px rgba(var(--theme-accent-2-rgb, 214, 44, 246), 0.1); position: relative; overflow: hidden; height: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1;">
            <span style="color: var(--theme-accent-2); font-weight: 800; letter-spacing: 1.5px; font-size: 0.8em; text-transform: uppercase;">Est. Daily Earnings</span>
            <span style="background: rgba(var(--theme-accent-2-rgb, 214, 44, 246), 0.15); padding: 4px 8px; border-radius: 6px; color: var(--theme-accent-2); font-size: 0.7em; border: 1px solid rgba(var(--theme-accent-2-rgb, 214, 44, 246), 0.3);">Pool Est</span>
          </div>
          <div style="font-size: 2.3em; font-weight: 800; color: #fff; margin-top: 15px; text-shadow: 0 0 15px rgba(255,255,255,0.2); font-family: monospace; position: relative; z-index: 1;">
             ${anyBtcPrice > 0 ? (totalDailyRevBTC * anyBtcPrice).toFixed(2) : '0.00'} <span style="font-size: 0.5em; color: #888;">€</span>
          </div>
          <div style="color: #888; font-size: 0.85em; margin-top: 5px; font-weight: bold; position: relative; z-index: 1;">≈ ${totalDailyRevBTC.toFixed(6)} BTC</div>
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--theme-accent-2); box-shadow: 0 0 10px var(--theme-accent-2);"></div>
          ${this.config.theme === 'gladbeck' ? html`
            <img src="https://solarmodule-gladbeck.de/wp-content/uploads/2023/07/cropped-logo_new.png" style="position: absolute; bottom: 10px; right: 10px; height: 25px; opacity: 0.12; filter: grayscale(1) brightness(1.5); pointer-events: none; z-index: 0;">
          ` : ''}
        </div>

        <div class="card" style="margin-bottom: 0; padding: 25px; border-color: rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.4); box-shadow: 0 10px 30px rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.05); position: relative; overflow: hidden; height: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1;">
            <span style="color: var(--theme-accent-3); font-weight: 800; letter-spacing: 1.5px; font-size: 0.8em; text-transform: uppercase;">Efficiency</span>
            <span style="background: rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.1); padding: 4px 8px; border-radius: 6px; color: var(--theme-accent-3); font-size: 0.7em; border: 1px solid rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.2);">Avg J/TH</span>
          </div>
          <div style="font-size: 2.3em; font-weight: 800; color: var(--theme-text-main); margin-top: 15px; text-shadow: 0 0 15px rgba(255,255,255,0.2); font-family: monospace; position: relative; z-index: 1;">
             ${(totalHashrateTH > 0 && totalPowerW > 0) ? (totalPowerW / totalHashrateTH).toFixed(1) : '0.0'} <span style="font-size: 0.5em; color: var(--theme-text-dim);">J/TH</span>
          </div>
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--theme-accent-3); box-shadow: 0 0 10px var(--theme-accent-3);"></div>
          ${this.config.theme === 'gladbeck' ? html`
            <img src="https://solarmodule-gladbeck.de/wp-content/uploads/2023/07/cropped-logo_new.png" style="position: absolute; bottom: 8px; right: 8px; height: 22px; opacity: 0.1; filter: grayscale(1) brightness(1.8); pointer-events: none; z-index: 0;">
          ` : ''}
        </div>

        <div class="card" style="margin-bottom: 0; padding: 25px; border-color: rgba(var(--theme-accent-4-rgb, 0, 255, 136), 0.4); box-shadow: 0 10px 30px rgba(var(--theme-accent-4-rgb, 0, 255, 136), 0.05); position: relative; overflow: hidden; height: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1;">
            <span style="color: var(--theme-accent-4); font-weight: 800; letter-spacing: 1.5px; font-size: 0.8em; text-transform: uppercase;">Total Power</span>
             <span style="background: rgba(var(--theme-accent-4-rgb, 0, 255, 136), 0.1); padding: 4px 8px; border-radius: 6px; color: var(--theme-accent-4); font-size: 0.7em; border: 1px solid rgba(var(--theme-accent-4-rgb, 0, 255, 136), 0.2);">Live</span>
          </div>
          <div style="font-size: 2.3em; font-weight: 800; color: var(--theme-text-main); margin-top: 15px; text-shadow: 0 0 15px rgba(255,255,255,0.2); font-family: monospace; position: relative; z-index: 1;">
             ${totalPowerW > 0 ? (totalPowerW / 1000).toFixed(2) : '0.00'} <span style="font-size: 0.5em; color: var(--theme-text-dim);">kW</span>
          </div>
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--theme-accent-4); box-shadow: 0 0 10px var(--theme-accent-4);"></div>
          ${this.config.theme === 'gladbeck' ? html`
            <img src="https://solarmodule-gladbeck.de/wp-content/uploads/2023/07/cropped-logo_new.png" style="position: absolute; bottom: 8px; right: 8px; height: 22px; opacity: 0.1; filter: grayscale(1) brightness(1.8); pointer-events: none; z-index: 0;">
          ` : ''}
        </div>

      </div>
    `;



    return html`
      <div class="dashboard-wrapper" style="display: flex; flex-direction: column; width: 100%; gap: 10px;">
        ${overviewHtml}

        ${totalPowerW > 0 ? html`
          <div class="energy-flow-container" style="height: 40px; margin-top: 10px; display: flex; justify-content: center; overflow: hidden;">
             <svg width="100%" height="40" preserveAspectRatio="none">
               <path class="energy-flow-line" d="M 0 20 Q ${this.offsetWidth/4 || 200} 0, ${this.offsetWidth/2 || 400} 20 T ${this.offsetWidth || 800} 20" 
                     fill="none" stroke="var(--theme-accent-1)" stroke-width="2" opacity="0.3" />
               <path class="energy-flow-line" d="M 0 20 Q ${this.offsetWidth/4 || 200} 40, ${this.offsetWidth/2 || 400} 20 T ${this.offsetWidth || 800} 20" 
                     fill="none" stroke="var(--theme-accent-4)" stroke-width="1.5" opacity="0.2" style="animation-delay: -1s;" />
             </svg>
          </div>
        ` : ''}

        <div class="miners-grid ${this.config.miners.length === 1 ? 'single-miner' : ''}" style="margin-top: 5px;">
        ${this.config.miners.map(miner => {
          try {
            const domain = 'openkairo_mining';
            const _ipForSlug = miner.miner_ip || (miner.switch && miner.switch.includes('.') ? miner.switch : '');
            const _ipSlug = _ipForSlug ? _ipForSlug.replace(/\./g, '_') : '';
            
            let effectiveSwitch = miner.switch;
            if (!effectiveSwitch && _ipSlug) {
                const domain = 'openkairo_mining';
                // Try multiple patterns
                const p1 = `switch.${domain}_${_ipSlug}_switch`;
                const p2 = `switch.${domain}_${_ipSlug}_mining_aktiv`;
                if (this.hass.states[p1]) effectiveSwitch = p1;
                else if (this.hass.states[p2]) effectiveSwitch = p2;
                else effectiveSwitch = p1; // Fallback
            }

            let switchState = 'Unbekannt';
            if (this.hass && effectiveSwitch && this.hass.states[effectiveSwitch]) {
              switchState = this.hass.states[effectiveSwitch].state;
            }

            let pvValue = this._formatValue(this.hass?.states[miner.pv_sensor], 'W', 'N/A');
            let batteryValue = this._formatValue(this.hass?.states[miner.battery_sensor], '%', '');

            let hSensor = miner.hashrate_sensor;
            let tSensor = miner.temp_sensor;
            let pSensor = miner.power_consumption_sensor;
            let pEntity = miner.power_entity;

            if (!hSensor && _ipSlug) hSensor = `sensor.${domain}_${_ipSlug}_hashrate`;
            if (!tSensor && _ipSlug) tSensor = `sensor.${domain}_${_ipSlug}_temperature`;
            if (!pSensor && _ipSlug) pSensor = `sensor.${domain}_${_ipSlug}_power`;
            if (!pEntity && _ipSlug) pEntity = `number.${domain}_${_ipSlug}_power_limit`;

            let hashrateValue = this._formatValue(this.hass?.states[hSensor], 'TH/s');
            let tempValue = this._formatValue(this.hass?.states[tSensor], '°C');
            let powerConsumptionValue = this._formatValue(this.hass?.states[pSensor], 'W');
            let batterySOCValue = this._formatValue(this.hass?.states[miner.battery_sensor], '%');

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
              if (priceState.attributes?.unit_of_measurement) {
                fiatSymbol = priceState.attributes.unit_of_measurement.replace('/BTC', '').replace('/ETH', '').replace('/KAS', '').trim();
              }
            }

            const currentDifficulty = this.btcDifficulty || 82000000000000;

            if (miner.calc_method === 'btc_auto' && miner.hashrate_sensor && currentCoinPrice > 0 && this.hass && this.hass.states[miner.hashrate_sensor]) {
              const hrState = this.hass.states[miner.hashrate_sensor];
              const hrValue = parseFloat(hrState.state) || 0;

              let hrInTH = hrValue;
              const unit = (hrState.attributes?.unit_of_measurement || 'TH/s').toUpperCase();
              if (unit.includes('GH')) hrInTH = hrValue / 1000;
              if (unit.includes('PH')) hrInTH = hrValue * 1000;

              const btcPerDay = (hrInTH * 1e12 / (currentDifficulty * Math.pow(2, 32))) * 86400 * 3.125;
              dailyRevenue = btcPerDay * currentCoinPrice;
              hasProfitData = true;

            } else if ((!miner.calc_method || miner.calc_method === 'sensor') && miner.crypto_revenue_sensor && currentCoinPrice > 0 && this.hass && this.hass.states[miner.crypto_revenue_sensor]) {
              const cryptoState = this.hass.states[miner.crypto_revenue_sensor];
              const cryptoVal = parseFloat(cryptoState.state) || 0;
              dailyRevenue = cryptoVal * currentCoinPrice;
              hasProfitData = true;
            } else if (miner.hashrate_sensor && currentCoinPrice > 0 && this.hass && this.hass.states[miner.hashrate_sensor]) {
              // AUTO-FALLBACK for individual miner
              const hrState = this.hass.states[miner.hashrate_sensor];
              const hrValue = parseFloat(hrState.state) || 0;
              let hrInTH = hrValue;
              const unit = (hrState.attributes?.unit_of_measurement || 'TH/s').toUpperCase();
              if (unit.includes('GH')) hrInTH = hrValue / 1000;
              if (unit.includes('PH')) hrInTH = hrValue * 1000;
              
              const btcPerDay = (hrInTH * 1e12 / (currentDifficulty * Math.pow(2, 32))) * 86400 * 3.125;
              dailyRevenue = btcPerDay * currentCoinPrice;
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
              const priceUnit = eleState.attributes?.unit_of_measurement || '';
              if (priceUnit.toLowerCase().includes('cent') || priceUnit === 'ct' || priceUnit === '¢' || electricityPrice > 5) {
                electricityPrice = electricityPrice / 100;
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
            const profitColor = profit > 0 ? '#d62cf6' : (profit < 0 ? '#e74c3c' : '#aaa');
            const profitStr = hasProfitData ? (isFinite(profit) ? profit.toFixed(2) : '0.00') : '';

            let powerObj = (miner.power_entity && this.hass) ? this.hass.states[miner.power_entity] : null;
            const powerState = powerObj ? powerObj.state : '-';
            const powerUnit = powerObj?.attributes?.unit_of_measurement || 'W';

            const friendlySwitchName = this.hass && this.hass.states[effectiveSwitch] && this.hass.states[effectiveSwitch].attributes?.friendly_name
              ? this.hass.states[effectiveSwitch].attributes.friendly_name
              : (effectiveSwitch || 'Nicht gesetzt');
            
            const friendlySwitchName2 = miner.switch_2 && this.hass && this.hass.states[miner.switch_2] && this.hass.states[miner.switch_2].attributes?.friendly_name
              ? this.hass.states[miner.switch_2].attributes.friendly_name
              : miner.switch_2;

            let stateObj = this.states ? this.states[miner.id] : null;

            const pSensorState = this.hass?.states[pSensor];
            const hSensorState = this.hass?.states[hSensor];
            const currentWatts = pSensorState ? parseFloat(pSensorState.state) || 0 : 0;
            const currentHash = hSensorState ? parseFloat(hSensorState.state) || 0 : 0;
            
            const isActuallyMining = switchState === 'on' && (currentWatts > 10 || currentHash > 0.1);
            const isStandby = switchState === 'on' && !isActuallyMining;

            return html`
              <div class="miner-card">
                ${this.config.theme === 'gladbeck' ? html`
                  <img src="https://solarmodule-gladbeck.de/wp-content/uploads/2023/07/cropped-logo_new.png" style="position: absolute; top: 10px; right: 10px; height: 18px; opacity: 0.1; filter: grayscale(1) brightness(2); pointer-events: none; z-index: 0;">
                ` : ''}
                ${miner.image ? html`<div class="miner-image" style="background-image: url('${miner.image}')"></div>` : html`<div class="miner-image placeholder">₿</div>`}
                <div class="miner-header">
                  <h3>${miner.name}</h3>
                  <span class="prio-badge">Prio: ${miner.priority || '-'}</span>
                </div>
                
                <div class="miner-status">
                  <span class="status-badge ${isActuallyMining ? 'on' : isStandby ? 'standby' : 'off'} ${stateObj && stateObj.ramping ? 'pulse-orange' : ''}">
                    ${stateObj && stateObj.ramping === 'up' ? `HOCHFAHREN ${stateObj.ramping_total ? `(${stateObj.ramping_step}/${stateObj.ramping_total})` : ''} ⚡` : 
                      stateObj && stateObj.ramping === 'down' ? `HERUNTERFAHREN ${stateObj.ramping_total ? `(${stateObj.ramping_step}/${stateObj.ramping_total})` : ''} 💤` : 
                      (isActuallyMining ? 'MINING 🚀' : isStandby ? 'STANDBY 💤' : 'AUS 🌑')}
                  </span>
                  <button class="btn-power ${switchState === 'on' ? 'on' : ''}" ?disabled="${stateObj && stateObj.hardware_error}" @click="${() => this.toggleMiner(miner)}" title="Manuell ein/ausschalten">
                    ⏻
                  </button>
                </div>
                
                ${stateObj && stateObj.hardware_error ? html`
                    <div style="background: rgba(231, 76, 60, 0.2); border: 1px solid #e74c3c; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                       <strong style="color: #e74c3c; display: block; margin-bottom: 5px;">⚠️ HARDWARE NICHT GEFUNDEN</strong>
                       <p style="font-size: 0.85em; color: #fff; margin: 0;">
                         Die Entitäten <code style="background: rgba(0,0,0,0.3); padding: 2px 4px;">${stateObj.missing_entities?.join(', ')}</code> wurden in Home Assistant nicht gefunden. 
                         Bitte prüfe die <strong>Miner-Integration</strong>.
                       </p>
                    </div>
                  ` : ''}

                  ${(hashrateValue || tempValue || powerConsumptionValue || batterySOCValue) ? html`
                  <div class="api-stats">
                    ${hashrateValue !== '-' ? html`<div class="stat"><span class="lbl">Hashrate:</span> <span class="val">${hashrateValue}</span></div>` : ''}
                    ${tempValue !== '-' ? html`<div class="stat"><span class="lbl">Temp:</span> <span class="val">${tempValue}</span></div>` : ''}
                    ${powerConsumptionValue !== '-' ? html`<div class="stat"><span class="lbl">Verbrauch:</span> <span class="val">${powerConsumptionValue}</span></div>` : ''}
                    ${batterySOCValue !== '-' ? html`<div class="stat"><span class="lbl">SOC:</span> <span class="val">${batterySOCValue}</span></div>` : ''}
                  </div>
                ` : ''}
                
                ${powerObj ? html`
                  <div class="power-limit-box" style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <span style="font-size: 0.85em; color: var(--theme-text-dim);">Power Limit (S9/ASIC)</span>
                      <div style="display: flex; align-items: center; gap: 5px;">
                        <input type="number" 
                               .value="${powerObj.state}" 
                               min="${powerObj.attributes?.min || 0}" 
                               max="${powerObj.attributes?.max || 2500}"
                               ?disabled="${stateObj && stateObj.hardware_error}"
                               @change="${(e) => this.setPowerLimit(miner.power_entity, e.target.value)}"
                               style="background: rgba(0,0,0,0.5); border: 1px solid rgba(11, 196, 226, 0.3); color: #0bc4e2; border-radius: 4px; padding: 2px 6px; width: 65px; text-align: right; font-weight: bold; font-family: monospace; outline: none;">
                        <span style="color: var(--theme-text-dim); font-size: 0.8em; font-weight: bold;">${powerUnit}</span>
                      </div>
                    </div>
                    <div class="slider-container">
                      ${(() => {
                        const min = powerObj.attributes?.min || 0;
                        const max = ((miner.soft_start_enabled || miner.soft_stop_enabled) && miner.soft_target_power) ? miner.soft_target_power : (powerObj.attributes?.max || 100);
                        const markers = this._getPowerMarkers(miner);
                        return html`
                          <div class="slider-markers">
                            ${markers.map(val => {
                              if (val < min || val > max) return '';
                              const percent = ((val - min) / (max - min)) * 100;
                              return html`<div class="slider-marker" style="left: ${percent}%;" title="${val} W"></div>`;
                            })}
                          </div>
                        `;
                      })()}
                      <input type="range" 
                             min="${powerObj.attributes?.min || 0}" 
                             max="${((miner.soft_start_enabled || miner.soft_stop_enabled) && miner.soft_target_power) ? miner.soft_target_power : (powerObj.attributes?.max || 100)}" 
                             step="${powerObj.attributes?.step || 1}" 
                             .value="${powerObj.state}" 
                             ?disabled="${stateObj && stateObj.hardware_error}"
                             @change="${(e) => this.setPowerLimit(miner.power_entity, e.target.value)}"
                             style="width: 100%; accent-color: #0bc4e2; cursor: ${stateObj?.hardware_error ? 'not-allowed' : 'pointer'}; position: relative; z-index: 2; background: transparent;">
                    </div>
                  </div>
                ` : ''}

                
                <div class="miner-details">
                  <p><b>Modus:</b> <span class="accent-text">${modeMap[miner.mode] || 'Unbekannt'}</span></p>
                  <p><b>Dose:</b> ${friendlySwitchName || 'Nicht gesetzt'} ${friendlySwitchName2 ? html` + ${friendlySwitchName2}` : ''}</p>
                  
                  ${miner.mode === 'pv' ? html`
                    <div class="tech-box">
                      <p><b>Aktueller PV-Wert:</b> <span class="highlight-val">${pvValue}</span></p>
                      <div class="small-text mt-1" style="margin-bottom: 8px; display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                        Regeln: An &ge; <input type="number" .value="${miner.pv_on}" @change="${(e) => this.quickUpdateMiner(miner.id, 'pv_on', e.target.value)}" style="width: 70px; padding: 4px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #0bc4e2; border-radius: 4px; font-weight: bold;"> W 
                        | Aus &le; <input type="number" .value="${miner.pv_off}" @change="${(e) => this.quickUpdateMiner(miner.id, 'pv_off', e.target.value)}" style="width: 70px; padding: 4px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #0bc4e2; border-radius: 4px; font-weight: bold;"> W
                      </div>
                      ${miner.allow_battery ? html`
                        <div style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px;">
                          <p><b>Batterie (SOC):</b> <span class="highlight-val">${batteryValue || 'N/A'}</span></p>
                          <p class="small-text mt-1">🔋 Unterstützung erlaubt bis min. ${miner.battery_min_soc}%</p>
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}
                  
                  ${miner.mode === 'soc' ? html`
                    <div class="tech-box">
                      <p><b>Aktueller SOC:</b> <span class="highlight-val">${batterySOCValue || 'N/A'}</span></p>
                      <div class="small-text mt-1" style="margin-bottom: 8px; display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                        Regeln: An &ge; <input type="number" .value="${miner.soc_on !== undefined ? miner.soc_on : 90}" @change="${(e) => this.quickUpdateMiner(miner.id, 'soc_on', e.target.value)}" style="width: 60px; padding: 4px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #0bc4e2; border-radius: 4px; font-weight: bold;"> % 
                        | Aus &le; <input type="number" .value="${miner.soc_off !== undefined ? miner.soc_off : 30}" @change="${(e) => this.quickUpdateMiner(miner.id, 'soc_off', e.target.value)}" style="width: 60px; padding: 4px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #0bc4e2; border-radius: 4px; font-weight: bold;"> %
                      </div>
                    </div>
                  ` : ''}

                  ${miner.standby_watchdog_enabled ? html`
                    ${(() => {
                      let stState = 'Unbekannt';
                      if (this.hass && miner.standby_switch && this.hass.states[miner.standby_switch]) {
                        stState = this.hass.states[miner.standby_switch].state;
                      }

                      let watchdogWarning = '';
                      let watchdogProgress = 0;
                      const wType = miner.watchdog_type || 'power';
                      
                      let currentWatchValue = 0;
                      let hasWatchData = false;
                      let watchObj = null;

                      if (wType === 'limit' && miner.power_entity && this.hass && this.hass.states[miner.power_entity]) {
                          watchObj = this.hass.states[miner.power_entity];
                          currentWatchValue = parseFloat(watchObj.state) || 0;
                          hasWatchData = true;
                      } else if (miner.power_consumption_sensor && this.hass && this.hass.states[miner.power_consumption_sensor]) {
                          watchObj = this.hass.states[miner.power_consumption_sensor];
                          currentWatchValue = parseFloat(watchObj.state) || 0;
                          hasWatchData = true;
                      }

                      if (hasWatchData && stState === 'on' && watchObj) {
                        const threshold = miner.standby_power || 100;
                        const delayMins = miner.standby_delay || 10;

                        const sensorState = watchObj.state;
                        const isNumeric = sensorState !== 'unavailable' && sensorState !== 'unknown' && !isNaN(parseFloat(sensorState));

                        if (isNumeric && currentWatchValue < threshold) {
                          const lastChanged = new Date(watchObj.last_changed).getTime();
                          const nowMillis = new Date().getTime();
                          const elapsedMins = (nowMillis - lastChanged) / 60000;
                          
                          if (elapsedMins > 0) {
                            const remainingMins = Math.max(0, delayMins - elapsedMins);
                            watchdogProgress = Math.min(100, (elapsedMins / delayMins) * 100);

                            if (remainingMins > 0) {
                              watchdogWarning = `⏳ Abschaltung in ${Math.ceil(remainingMins)} Min.`;
                            } else {
                              watchdogWarning = `⚠️ Abschaltung wird ausgelöst...`;
                            }
                          }
                        }
                      }

                      return html`
                        <div class="tech-box" style="margin-top: 15px; border-color: rgba(231, 76, 60, 0.4); background: rgba(231, 76, 60, 0.05); position: relative; overflow: hidden;">
                          ${watchdogWarning ? html`
                              <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${watchdogProgress}%; background: rgba(231, 76, 60, 0.1); z-index: 0; transition: width 5s linear;"></div>
                          ` : ''}
                          <div style="position: relative; z-index: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <label style="margin: 0; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" .checked="${miner.standby_watchdog_enabled}" @change="${(e) => this.quickUpdateMiner(miner.id, 'standby_watchdog_enabled', e.target.checked)}" style="width: 16px; height: 16px; margin: 0; accent-color: #e74c3c;">
                                    <b>🛡️ Watchdog:</b> <span class="highlight-val" style="color: ${stState === 'on' ? '#d62cf6' : '#e74c3c'};">${stState === 'on' ? 'ON' : stState === 'off' ? 'OFF' : stState}</span>
                                </label>
                                <button class="btn-power ${stState === 'on' ? 'on' : ''}" @click="${() => this.toggleMiner(miner.standby_switch)}" title="Watchdog Plug manuell schalten" style="font-size: 1.2em; padding: 4px 12px; min-height: 36px;">
                                  ${watchdogWarning ? html`<span style="color: #e74c3c; font-size: 0.85em; margin-right: 10px; animation: pulse 2s infinite;">${watchdogWarning}</span>` : ''}
                                  ⏻ Plug
                                </button>
                            </div>
                            <div class="small-text mt-1" style="margin-top: 10px; display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                                Off wenn &lt; <input type="number" .value="${miner.standby_power || 100}" @change="${(e) => this.quickUpdateMiner(miner.id, 'standby_power', e.target.value)}" style="width: 60px; padding: 4px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #e74c3c; border-radius: 4px; font-weight: bold;"> W 
                                für &ge; <input type="number" .value="${miner.standby_delay || 10}" @change="${(e) => this.quickUpdateMiner(miner.id, 'standby_delay', e.target.value)}" style="width: 50px; padding: 4px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #e74c3c; border-radius: 4px; font-weight: bold;"> Min.
                            </div>
                          </div>
                        </div>`;
                    })()}
                  ` : html`
                    <div class="tech-box" style="margin-top: 15px; border-color: rgba(255, 255, 255, 0.1); background: rgba(0, 0, 0, 0.2);">
                      <label style="margin: 0; display: flex; align-items: center; gap: 8px; cursor: pointer; color: #888;">
                        <input type="checkbox" .checked="${miner.standby_watchdog_enabled}" @change="${(e) => this.quickUpdateMiner(miner.id, 'standby_watchdog_enabled', e.target.checked)}" style="width: 16px; height: 16px; margin: 0; accent-color: #e74c3c;">
                        <b>🛡️ Watchdog aktivieren</b>
                      </label>
                    </div>
                  `}
                </div>

                  <div class="miner-controls" style="margin-top: 15px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 15px;">
                    <p style="margin: 0 0 10px 0; font-size: 0.8em; color: #888; text-transform: uppercase;">⚡ Hardware Steuerung (Direkt)</p>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <button class="btn-control mode-low" @click="${() => this.callHardwareService(miner, 'set_work_mode', 'low')}">LOW</button>
                      <button class="btn-control mode-normal" @click="${() => this.callHardwareService(miner, 'set_work_mode', 'normal')}">NORM</button>
                      <button class="btn-control mode-high" @click="${() => this.callHardwareService(miner, 'set_work_mode', 'high')}">HIGH</button>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                      <button class="btn-control action" @click="${() => this.callHardwareService(miner, 'restart_backend')}">🔄 Restart</button>
                      <button class="btn-control action warn" @click="${() => this.callHardwareService(miner, 'reboot')}">⚡ Reboot</button>
                    </div>
                  </div>
              </div>
            `;
          } catch (e) {
            console.error("Error rendering miner card:", miner.id, e);
            return html`<div class="card" style="border: 1px solid #e74c3c; background: rgba(231, 76, 60, 0.05); padding: 15px;">⚠️ Fehler bei <b>${miner.name}</b></div>`;
          }
        })}
        </div>
      </div>
    `;
  }

  renderDesignSettings() {
    return html`
      <div class="card">
        <h2>🎨 Design & Personalisierung</h2>
        <p>Passe das Aussehen deines Mining-Dashboards nach deinen Wünschen an.</p>

        ${this._renderDesignPreview()}

        <div class="tech-box" style="margin-bottom: 25px; border-color: var(--theme-accent-1);">
          <h3 style="color: var(--theme-accent-1); margin-top: 0;">Design-Vorlage</h3>
          <div class="form-group" style="display: flex; flex-direction: column; gap: 15px;">
            <div>
              <label>Wähle ein vordefiniertes Design</label>
              <select @change="${(e) => { this.config.theme = e.target.value; this.requestUpdate(); this.saveConfig(true); }}" .value="${this.config.theme || 'cyberpunk'}" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
                <option value="cyberpunk">Cyberpunk (Neon Cyan & Magenta)</option>
                <option value="midnight">Midnight Glow (Luxury Purple)</option>
                <option value="atlantis">Atlantis (Oceanic Teal)</option>
                <option value="lava">Lava Field (Energy Red)</option>
                <option value="matrix">Matrix (Hacker Green)</option>
                <option value="classic">Classic Bitcoin (Orange & White)</option>
                <option value="solar">Solar Energy (Yellow & Brown)</option>
                <option value="ice">Crystal Ice (Arctic Blue)</option>
                <option value="abyss">Deep Abyss (Bioluminescent)</option>
                <option value="gladbeck">☀️ Solarmodule Gladbeck (EXKLUSIV)</option>
                <option value="custom">Individuell (Eigene Farben)</option>
              </select>
            </div>
            
            <!-- Globaler Background-Switch (Immer sichtbar) -->
            <div style="background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 0.9em;">
                    <input type="checkbox" ?checked="${this.config.background_animations_enabled !== false}" @change="${(e) => { this.config.background_animations_enabled = e.target.checked; this.requestUpdate(); this.saveConfig(true); }}" style="width: 20px; height: 20px; accent-color: var(--theme-primary);">
                    <span><b>Hintergrund-Effekte aktivieren</b> (bewegte Animationen)</span>
                </label>
            </div>
            
            <small>Hinweis: Bei Auswahl eines Presets werden die individuellen Einstellungen unten überschrieben.</small>
          </div>
        </div>

        ${(this.config.theme === 'custom' || !this.config.theme) ? html`
          <div class="tech-box" style="border-color: var(--theme-accent-2); margin-top: 20px;">
            <h3 style="color: var(--theme-accent-2); margin-top: 0;">Erweiterte Einstellungen (Individuell)</h3>
            
            <h4 style="margin: 20px 0 10px 0; font-size: 0.85em; opacity: 0.6; text-transform: uppercase;">Typografie & Animation</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 25px;">
               <div class="form-group">
                 <label>Schriftart (Google Fonts)</label>
                 <select @change="${(e) => { this.config.font_family = `'${e.target.value}', sans-serif`; this.requestUpdate(); this.saveConfig(true); }}" .value="${(this.config.font_family || '').replace(/'/g, '').split(',')[0].trim()}" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
                   <option value="Inter">Inter (Standard)</option>
                   <option value="Roboto">Roboto (Klassisch)</option>
                   <option value="Space Mono">Space Mono (Tech)</option>
                   <option value="Outfit">Outfit (Elegant)</option>
                   <option value="Montserrat">Montserrat (Modern)</option>
                   <option value="Share Tech Mono">Share Tech Mono (Console)</option>
                   <option value="Ubuntu">Ubuntu (Clean)</option>
                   <option value="Fira Code">Fira Code (Dev)</option>
                 </select>
               </div>
               <div class="form-group">
                 <label>System-Animationen</label>
                 <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px;">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                      <input type="checkbox" ?checked="${this.config.animations_enabled !== false}" @change="${(e) => { this.config.animations_enabled = e.target.checked; this.requestUpdate(); this.saveConfig(true); }}" style="width: 20px; height: 20px; accent-color: var(--theme-primary);">
                      UI-Animationen (Blenden/Übergänge)
                    </label>
                 </div>
               </div>
            </div>

            <h4 style="margin: 20px 0 10px 0; font-size: 0.85em; opacity: 0.6; text-transform: uppercase;">Formen & Leuchten</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
              <div class="form-group">
                <label>Eckenabrundung: <b>${this.config.radius || '16px'}</b></label>
                <input type="range" min="0" max="40" step="1" .value="${parseInt(this.config.radius) || 16}" 
                       @input="${(e) => { this.config.radius = e.target.value + 'px'; this.requestUpdate(); }}" 
                       @change="${() => this.saveConfig(true)}"
                       style="width: 100%; accent-color: var(--theme-primary);">
              </div>
              <div class="form-group">
                <label>Glow-Intensität: <b>${this.config.glow_intensity || '0.15'}</b></label>
                <input type="range" min="0" max="0.5" step="0.01" .value="${this.config.glow_intensity || 0.15}" 
                       @input="${(e) => { this.config.glow_intensity = e.target.value; this.requestUpdate(); }}" 
                       @change="${() => this.saveConfig(true)}"
                       style="width: 100%; accent-color: var(--theme-primary);">
              </div>
            </div>

            <h4 style="margin: 20px 0 10px 0; font-size: 0.85em; opacity: 0.6; text-transform: uppercase;">Farbpalette</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 25px;">
              
              <div class="color-group">
                <h4 style="margin: 0 0 10px 0; font-size: 0.8em; opacity: 0.7;">Basisfarben</h4>
                <div class="form-group">
                  <label>Primär (Akzent)</label>
                  <input type="color" .value="${this.config.color_primary || '#0bc4e2'}" @input="${(e) => { this.config.color_primary = e.target.value; this.requestUpdate(); }}" @change="${() => this.saveConfig(true)}">
                </div>
                <div class="form-group">
                  <label>Hintergrund (App)</label>
                  <input type="color" .value="${this.config.color_bg_app || '#1a1a1a'}" @input="${(e) => { this.config.color_bg_app = e.target.value; this.requestUpdate(); }}" @change="${() => this.saveConfig(true)}">
                </div>
                <div class="form-group">
                  <label>Header-Leiste</label>
                  <input type="color" .value="${this.config.color_bg_header || '#121214'}" @input="${(e) => { this.config.color_bg_header = e.target.value; this.requestUpdate(); }}" @change="${() => this.saveConfig(true)}">
                </div>
              </div>

              <div class="color-group">
                <h4 style="margin: 0 0 10px 0; font-size: 0.8em; opacity: 0.7;">Texte & Details</h4>
                <div class="form-group">
                  <label>Text Hauptfarbe</label>
                  <input type="color" .value="${this.config.color_text_main || '#ffffff'}" @input="${(e) => { this.config.color_text_main = e.target.value; this.requestUpdate(); }}" @change="${() => this.saveConfig(true)}">
                </div>
                <div class="form-group">
                  <label>Text Gedimmt</label>
                  <input type="color" .value="${this.config.color_text_dim || '#888888'}" @input="${(e) => { this.config.color_text_dim = e.target.value; this.requestUpdate(); }}" @change="${() => this.saveConfig(true)}">
                </div>
                <div class="form-group">
                  <label>Rahmen / Linien</label>
                  <input type="color" .value="${this.config.color_border || '#333333'}" @input="${(e) => { this.config.color_border = e.target.value; this.requestUpdate(); }}" @change="${() => this.saveConfig(true)}">
                </div>
              </div>

              <div class="color-group">
                <h4 style="margin: 0 0 10px 0; font-size: 0.8em; opacity: 0.7;">Boxen (Status)</h4>
                <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div>
                    <label>Hashrate</label>
                    <input type="color" .value="${this.config.color_hashrate || '#0bc4e2'}" @input="${(e) => { this.config.color_hashrate = e.target.value; this.requestUpdate(); }}" @change="${() => this.saveConfig(true)}">
                  </div>
                  <div>
                    <label>Earnings</label>
                    <input type="color" .value="${this.config.color_earnings || '#d62cf6'}" @input="${(e) => { this.config.color_earnings = e.target.value; this.requestUpdate(); }}" @change="${() => this.saveConfig(true)}">
                  </div>
                  <div>
                    <label>Efficiency</label>
                    <input type="color" .value="${this.config.color_efficiency || '#ffcc00'}" @input="${(e) => { this.config.color_efficiency = e.target.value; this.requestUpdate(); }}" @change="${() => this.saveConfig(true)}">
                  </div>
                  <div>
                    <label>Power</label>
                    <input type="color" .value="${this.config.color_power || '#00ff88'}" @input="${(e) => { this.config.color_power = e.target.value; this.requestUpdate(); }}" @change="${() => this.saveConfig(true)}">
                  </div>
                </div>
              </div>

            </div>
          </div>
        ` : ''}
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
        
        <div class="tech-box" style="margin-bottom: 30px; border-color: rgba(11, 196, 226, 0.4);">
          <h3 style="color: #0bc4e2; margin-top: 0;">🌍 Globale Optionen</h3>
          <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 200px;">
              <label>Strompreis Referenz (€/kWh)</label>
              <input type="number" step="0.01" .value="${this.config.ref_price || 0.30}" @change="${(e) => { this.config.ref_price = parseFloat(e.target.value); this.saveConfig(true); }}">
              <small>Wird für die Berechnung der Rentabilität genutzt.</small>
            </div>
            <div style="flex: 1; min-width: 200px;">
               <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                  <input type="checkbox" ?checked="${this.config.show_energy_tab}" @change="${(e) => { this.config.show_energy_tab = e.target.checked; this.saveConfig(true); }}" style="width: 20px; height: 20px; accent-color: #0bc4e2;">
                  Energy-Stats Tab anzeigen
               </label>
               <small>Aktiviert den Tab zur Visualisierung der Rentabilität.</small>
            </div>
          </div>

          <div style="margin-top: 25px; padding-top: 20px; border-top: 1px dashed rgba(255,255,255,0.1); display: flex; gap: 20px; flex-wrap: wrap;">
            <div class="form-group" style="margin-bottom: 0; flex: 2; min-width: 300px;">
              <label>Globaler BTC-Guthaben Sensor (z.B. Braiins Pool Balance)</label>
              <openkairo-entity-picker 
                placeholder="-- Wallet/Pool Sensor suchen --" 
                .value="${this.config.wallet_btc_sensor || ''}" 
                .entities="${this.getEntitiesByDomain('sensor')}" 
                @change="${(e) => { this.config.wallet_btc_sensor = e.target.value; this.saveConfig(true); }}">
              </openkairo-entity-picker>
            </div>
            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 200px;">
              <label>Profil Avatar URL (Optional)</label>
              <input type="text" .value="${this.config.profile_image || ''}" @change="${(e) => { this.config.profile_image = e.target.value; this.saveConfig(true); }}" placeholder="https://...">
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
          ${this.editForm.image ? html`
            <div style="margin-top: 10px; position: relative; max-width: 200px;">
              <div style="border-radius: 8px; overflow: hidden; border: 1px solid #444;">
                <img src="${this.editForm.image}" style="width: 100%; display: block;">
              </div>
              <button class="btn-icon delete" 
                      style="position: absolute; top: -10px; right: -10px; background: #e74c3c; border-color: #e74c3c; padding: 5px; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; z-index: 10;" 
                      @click="${() => { this.editForm = { ...this.editForm, image: '' }; this.requestUpdate(); }}" 
                      title="Bild löschen">
                🗑️
              </button>
            </div>` : ''}
          <small>Lade ein Foto deines Miners hoch (wird lokal im Browser/Dashboard gespeichert).</small>
        </div>

        <div class="form-row">
            <div class="form-group flex-1">
              <label>Schalter / Steckdose 1</label>
              <openkairo-entity-picker name="switch" placeholder="-- Steckdose 1 wählen --" .value="${this.editForm.switch || ''}" .entities="${switchOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
            </div>
            <div class="form-group flex-1">
              <label>Schalter / Steckdose 2 (Optional)</label>
              <openkairo-entity-picker name="switch_2" placeholder="-- Steckdose 2 wählen --" .value="${this.editForm.switch_2 || ''}" .entities="${switchOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
            </div>
        </div>
        <small style="margin-top: -15px; display: block; margin-bottom: 20px;">Die Steckdose(n) oder der 'hass-miner' Switch, an dem der Miner pausiert wird.</small>

        <div class="mode-section btc-section" style="margin-top: 20px; border-color: rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);">
            <h3 style="color: #0bc4e2; font-size: 1.1em;">🔌 Native Hardware Integration</h3>
            <p style="color: #bbb; font-size: 0.85em; margin-top: -10px; margin-bottom: 20px;">
                <b>NEU:</b> Gehe in Home Assistant zu <b>Einstellungen -> Geräte & Dienste -> Integration hinzufügen</b> und suche nach "OpenKairo Mining". Füge dort die IP-Adresse (sowie Passwort falls nötig) deines Miners ein. Die Sensoren werden danach automatisch generiert und du kannst sie hier unten auswählen.
            </p>
            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Miner Hashrate-Sensor</label>
                    <openkairo-entity-picker name="hashrate_sensor" placeholder="-- Hashrate Sensor suchen --" .value="${this.editForm.hashrate_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                </div>
                <div class="form-group flex-1">
                    <label>Miner Stromverbrauch-Sensor (Watt)</label>
                    <openkairo-entity-picker name="power_consumption_sensor" placeholder="-- Stromverbrauch Sensor suchen --" .value="${this.editForm.power_consumption_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Miner Temperatur-Sensor</label>
                    <openkairo-entity-picker name="temp_sensor" placeholder="-- Temp Sensor suchen --" .value="${this.editForm.temp_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                </div>
                <div class="form-group flex-1">
                    <label>Power Limit ('number' Entität)</label>
                    <openkairo-entity-picker name="power_entity" placeholder="-- Power Limit suchen --" .value="${this.editForm.power_entity || ''}" .entities="${numberOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                    <small>Wichtig für Soft Start/Stop (S9/ASIC).</small>
                </div>
            </div>

            <div style="margin-top: 20px; padding: 15px; border: 1px dashed rgba(11, 196, 226, 0.3); border-radius: 8px; background: rgba(11, 196, 226, 0.05);">
                <h4 style="margin: 0 0 10px 0; color: #0bc4e2; display: flex; align-items: center; gap: 8px;">🚀 Soft Start / Stop (Mehrstufiges Hochfahren)</h4>
                
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" name="soft_start_enabled" .checked="${this.editForm.soft_start_enabled}" @change="${this.handleFormInput}" style="width: 16px; height: 16px; margin: 0; accent-color: #0bc4e2;">
                            <b>Soft-Start aktivieren</b>
                        </label>
                    </div>
                    <div class="form-group flex-1">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" name="soft_stop_enabled" .checked="${this.editForm.soft_stop_enabled}" @change="${this.handleFormInput}" style="width: 16px; height: 16px; margin: 0; accent-color: #0bc4e2;">
                            <b>Soft-Stop aktivieren</b>
                        </label>
                    </div>
                </div>

                <div class="form-row" style="margin-top: -10px; margin-bottom: 20px;">
                    <div class="form-group flex-1">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;" title="Versucht die Leistung auch nach manueller Änderung automatisch wieder an den PV Überschuss oder Zielwert anzupassen.">
                            <input type="checkbox" name="soft_continuous_scaling" .checked="${this.editForm.soft_continuous_scaling}" @change="${this.handleFormInput}" style="width: 16px; height: 16px; margin: 0; accent-color: #0bc4e2;">
                            <b>Automatische Nachskalierung (Kontinuierlich)</b>
                        </label>
                    </div>
                </div>


                ${this.editForm.soft_start_enabled || this.editForm.soft_stop_enabled || this.editForm.soft_continuous_scaling ? html`

                    <div class="form-row">
                        <div class="form-group flex-1">
                            <label>Start-Abstufungen (Watt)</label>
                            <input type="text" name="soft_start_steps" placeholder="100, 500, 1000" .value="${this.editForm.soft_start_steps || '100, 500, 1000'}" @input="${this.handleFormInput}">
                            <small>Kommasepariert, z.B. 100, 500, 1000</small>
                        </div>
                        <div class="form-group flex-1">
                            <label>Stopp-Abstufungen (Watt)</label>
                            <input type="text" name="soft_stop_steps" placeholder="1000, 500, 100" .value="${this.editForm.soft_stop_steps || '1000, 500, 100'}" @input="${this.handleFormInput}">
                            <small>Kommasepariert, z.B. 1000, 500, 100</small>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group flex-1">
                            <label>Intervall (Sekunden)</label>
                            <input type="number" name="soft_interval" min="10" .value="${this.editForm.soft_interval || 60}" @input="${this.handleFormInput}">
                            <small>Wartezeit zwischen den Stufen.</small>
                        </div>
                        <div class="form-group flex-1">
                             <label>End-Leistung (Watt)</label>
                             <input type="number" name="soft_target_power" .value="${this.editForm.soft_target_power || 1200}" @input="${this.handleFormInput}">
                             <small>Zielwert nach dem Hochfahren.</small>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="form-group mt-3">
          <label>Betriebsmodus</label>
          <select class="btc-select" name="mode" @change="${this.handleFormInput}">
            <option value="manual" ?selected="${this.editForm.mode === 'manual'}">Manuell (Nur Überwachung)</option>
            <option value="pv" ?selected="${this.editForm.mode === 'pv'}">PV-Überschuss (Einspeisung)</option>
            <option value="soc" ?selected="${this.editForm.mode === 'soc'}">Batterie SOC</option>
          </select>
        </div>

        ${this.editForm.mode === 'pv' ? html`
          <div class="mode-section btc-section">
            <h3>☀️ PV-Überschuss Steuerung</h3>
            <div class="form-group">
                <label>PV-Sensor (Netzeinspeisung/Ertrag in Watt)</label>
                <openkairo-entity-picker name="pv_sensor" placeholder="-- Einspeise-/Watt-Sensor suchen --" .value="${this.editForm.pv_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
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

            <div style="margin-top: 20px; padding: 15px; border: 1px dashed rgba(214, 44, 246, 0.3); border-radius: 8px; background: rgba(214, 44, 246, 0.05);">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #d62cf6; font-weight: bold;">
                    <input type="checkbox" name="allow_battery" .checked="${this.editForm.allow_battery}" @change="${this.handleFormInput}" style="width: 20px; height: 20px; accent-color: #d62cf6;">
                    🔋 Optionale Batterie-Unterstützung erlauben
                </label>
                
                ${this.editForm.allow_battery ? html`
                <div class="form-row" style="margin-top: 15px;">
                    <div class="form-group flex-2">
                        <label>Batterie SOC-Sensor (Ladezustand in %)</label>
                        <openkairo-entity-picker name="battery_sensor" placeholder="-- Batterie % Sensor suchen --" .value="${this.editForm.battery_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
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
                        <openkairo-entity-picker name="forecast_sensor" placeholder="-- Wetter/Prognose Sensor suchen --" .value="${this.editForm.forecast_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
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

        ${this.editForm.mode === 'soc' ? html`
          <div class="mode-section btc-section">
            <h3 style="color: #0bc4e2; margin-top: 0; margin-bottom: 20px;">🔋 Batterie SOC Steuerung</h3>
            <div class="form-group">
                <label>Batterie SOC-Sensor (Ladezustand in %)</label>
                <openkairo-entity-picker name="battery_sensor" placeholder="-- Batterie % Sensor suchen --" .value="${this.editForm.battery_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
            </div>
            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Einschalten ab SOC (%)</label>
                    <input type="number" name="soc_on" min="0" max="100" .value="${this.editForm.soc_on || 90}" @input="${this.handleFormInput}">
                </div>
                <div class="form-group flex-1">
                    <label>Ausschalten ab SOC (%)</label>
                    <input type="number" name="soc_off" min="0" max="100" .value="${this.editForm.soc_off || 30}" @input="${this.handleFormInput}">
                </div>
            </div>
            <div class="form-group mt-3" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                <label>Verzögerung (Hysterese in Minuten)</label>
                <input type="number" min="0" step="1" name="delay_minutes" .value="${this.editForm.delay_minutes !== undefined ? this.editForm.delay_minutes : 5}" @input="${this.handleFormInput}">
                <small>Verhindert ständiges An/Aus. Miner schaltet erst nach X Minuten.</small>
            </div>
          </div>
        ` : ''}

        <div class="mode-section btc-section" style="margin-top: 20px; border-color: rgba(231, 76, 60, 0.3); background: rgba(231, 76, 60, 0.05);">
            <h3 style="color: #e74c3c; margin-top: 0; margin-bottom: 20px;">🛡️ Standby-Watchdog (Hartes Abschalten)</h3>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #e74c3c; font-weight: bold;">
                <input type="checkbox" name="standby_watchdog_enabled" .checked="${this.editForm.standby_watchdog_enabled}" @change="${this.handleFormInput}" style="width: 20px; height: 20px; accent-color: #e74c3c;">
                Watchdog aktivieren
            </label>
            <p style="color: #888; font-size: 0.85em; margin-top: 10px;">Schaltet eine Steckdose (z.B. Shelly Plug) komplett ab, wenn der Stromverbrauch für längere Zeit<br>unter einen Grenzwert fällt. Nützlich wenn Miner sich aufhängen oder im Standby zu viel verbrauchen.</p>
            
            ${this.editForm.standby_watchdog_enabled ? html`
            <div class="form-row mt-3">
                <div class="form-group flex-1">
                    <label>Watchdog Steckdose 1 (Hard-Off)</label>
                    <openkairo-entity-picker name="standby_switch" placeholder="-- Steckdose suchen --" .value="${this.editForm.standby_switch || ''}" .entities="${switchOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                </div>
                <div class="form-group flex-1">
                    <label>Watchdog Steckdose 2 (Optional)</label>
                    <openkairo-entity-picker name="standby_switch_2" placeholder="-- Steckdose suchen --" .value="${this.editForm.standby_switch_2 || ''}" .entities="${switchOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                </div>
            </div>
            <small style="margin-top: -15px; display: block;">HINWEIS: Die Plugs werden automatisch wieder hochgefahren, sobald die PV- oder SOC-Einschaltregeln erfüllt sind.</small>
            
            <div class="form-group mt-3">
                <label>Überwachungs-Ziel (Was soll geprüft werden?)</label>
                <select class="btc-select" name="watchdog_type" @change="${this.handleFormInput}">
                  <option value="power" ?selected="${this.editForm.watchdog_type === 'power'}">Tatsächlicher Verbrauch (Watt-Sensor)</option>
                  <option value="limit" ?selected="${this.editForm.watchdog_type === 'limit'}">Eingestelltes Limit (Power-Entität)</option>
                </select>
                <small>Wähle "Limit", wenn dein Miner-Verbrauch stark vom eingestellten Wert abweicht.</small>
            </div>

            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Abschalten wenn Strom &lt; (Watt)</label>
                    <input type="number" name="standby_power" min="0" .value="${this.editForm.standby_power || 100}" @input="${this.handleFormInput}">
                </div>
                <div class="form-group flex-1">
                    <label>Verzögerung (Minuten)</label>
                    <input type="number" name="standby_delay" min="0" step="1" .value="${this.editForm.standby_delay || 10}" @input="${this.handleFormInput}">
                </div>
            </div>
            ` : ''}
        </div>

        <div class="form-actions">
            <button class="btn-cancel" @click="${this.cancelEdit}">Abbrechen</button>
            <button class="btn-save" @click="${this.saveForm}">Bitcoin-Miner speichern</button>
        </div>
      </div>
    `;
  }

  renderActivityTicker() {
    if (!this.logs || this.logs.length === 0) return '';
    // Duplicate logs for seamless looping on wide screens
    const tripledLogs = [...this.logs, ...this.logs, ...this.logs];
    return html`
      <div class="activity-ticker">
        <div class="ticker-content">
          ${tripledLogs.map(log => html`<div class="ticker-item">${log}</div>`)}
        </div>
      </div>
    `;
  }

  renderEnergyStats() {
    const formatDifficulty = (diff) => {
      if (!diff) return '-';
      const num = parseFloat(diff);
      if (num >= 1e12) return (num / 1e12).toFixed(2) + ' T';
      if (num >= 1e9) return (num / 1e9).toFixed(2) + ' G';
      if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M';
      return num.toLocaleString();
    };

    return html`
      <div class="card">
        <h2>⚡ Rentabilität & Überschuss-Nutzung</h2>
        <p>Hier berechnest du die Rentabilität deiner Hardware und siehst deinen theoretischen Ertrag, wenn du sie als "Heizung" oder mit PV-Überschuss betreibst.</p>
        
        <div class="dashboard-grid" style="margin-top: 25px;">
           ${this.config.miners && this.config.miners.length > 0 ? this.config.miners.map(miner => {
             try {
                const isPV = miner.mode === 'pv';
                const refPrice = this.config.ref_price || 0.30;

                let powerKW = 0;
                let hashrateTH = 0;

                const simModel = this.simulatorModels[miner.id] || 'sensor';
                const manualInput = this.manualInputs[miner.id] || { hashrate: 100, power: 3000 };

                if (simModel === 'manual') {
                  powerKW = (manualInput.power || 0) / 1000;
                  hashrateTH = manualInput.hashrate || 0;
                } else if (simModel === 'S9') {
                  powerKW = 1.372;
                  hashrateTH = 14;
                } else if (simModel === 'S19') {
                  powerKW = 3.250;
                  hashrateTH = 90;
                } else if (simModel === 'S19Pro') {
                  powerKW = 3.250;
                  hashrateTH = 110;
                } else if (simModel === 'S19XP') {
                  powerKW = 3.010;
                  hashrateTH = 140;
                } else if (simModel === 'S21') {
                  powerKW = 3.500;
                  hashrateTH = 200;
                } else if (simModel === 'Avalon') {
                  powerKW = 3.300;
                  hashrateTH = 110;
                } else if (simModel === 'AvalonQ') {
                  powerKW = 1.674;
                  hashrateTH = 90;
                } else if (simModel === 'AvalonNano3') {
                  powerKW = 0.140;
                  hashrateTH = 4;
                } else if (simModel === 'AvalonNano3s') {
                  powerKW = 0.140;
                  hashrateTH = 6;
                } else if (simModel === 'M30S') {
                  powerKW = 3.472;
                  hashrateTH = 112;
                } else if (simModel === 'M50') {
                  powerKW = 3.306;
                  hashrateTH = 114;
                } else if (simModel === 'Bitaxe') {
                  powerKW = 0.015;
                  hashrateTH = 0.5;
                } else {
                  if (this.hass && miner.power_consumption_sensor && this.hass.states[miner.power_consumption_sensor]) {
                    powerKW = (parseFloat(this.hass.states[miner.power_consumption_sensor].state) || 0) / 1000;
                  }
                  if (this.hass && miner.hashrate_sensor && this.hass.states[miner.hashrate_sensor]) {
                    hashrateTH = parseFloat(this.hass.states[miner.hashrate_sensor].state) || 0;
                  }
                }

                const hourlySaving = isPV ? (powerKW * refPrice) : 0;
                const dailySavingPotential = hourlySaving * 24;

                let btcHourlyRevenue = 0;
                let dailyRevenue = 0;
                let monthlyRevenue = 0;
                if (this.btcDifficulty && this.btcPriceEur && hashrateTH > 0) {
                  const btcPerDay = (hashrateTH * 1e12 / (this.btcDifficulty * Math.pow(2, 32))) * 86400 * 3.125;
                  dailyRevenue = btcPerDay * this.btcPriceEur;
                  btcHourlyRevenue = dailyRevenue / 24;
                  monthlyRevenue = dailyRevenue * 30.416;
                }

                const revenuePerKwh = powerKW > 0 ? (btcHourlyRevenue / powerKW) : 0;
                const profitPerKwh = revenuePerKwh - refPrice;
                const isProfitable = profitPerKwh > 0;

                return html`
                  <div class="miner-card">
                         <div style="margin-top: 10px; margin-bottom: 15px;">
                        <select @change="${(e) => { this.simulatorModels = { ...this.simulatorModels, [miner.id]: e.target.value }; this.requestUpdate(); }}" 
                                style="width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: var(--theme-text-main); border-radius: 6px; cursor: pointer;">
                            <option value="sensor">Eigene Sensoren verwenden</option>
                            <option value="manual">Eigene manuelle Eingabe</option>
                            <option value="Bitaxe">Bitaxe (0.5 TH/s | 15W)</option>
                            <option value="S9">Antminer S9 (14 TH/s | 1372W)</option>
                            <option value="S19">Antminer S19 (90 TH/s | 3250W)</option>
                            <option value="S19Pro">Antminer S19 Pro (110 TH/s | 3250W)</option>
                            <option value="S19XP">Antminer S19 XP (140 TH/s | 3010W)</option>
                            <option value="S21">Antminer S21 (200 TH/s | 3500W)</option>
                            <option value="M30S">Whatsminer M30S++ (112 TH/s | 3472W)</option>
                            <option value="M50">Whatsminer M50 (114 TH/s | 3306W)</option>
                            <option value="Avalon">Avalon A1346 (110 TH/s | 3300W)</option>
                            <option value="AvalonQ">Avalon Q (90 TH/s | 1674W)</option>
                            <option value="AvalonNano3">Avalon Nano 3 (4 TH/s | 140W)</option>
                            <option value="AvalonNano3s">Avalon Nano 3S (6 TH/s | 140W)</option>
                        </select>
                    </div>
                    
                    ${simModel === 'manual' ? html`
                        <div style="display: flex; gap: 10px; margin-top: -5px; margin-bottom: 15px;">
                          <div style="flex: 1;">
                            <label style="color: var(--theme-text-dim); font-size: 0.8em; display: block; margin-bottom: 4px;">Hashrate (TH/s)</label>
                            <input type="number" step="0.1" .value="${manualInput.hashrate}" @input="${(e) => { this.manualInputs = { ...this.manualInputs, [miner.id]: { ...manualInput, hashrate: parseFloat(e.target.value) || 0 } }; this.requestUpdate(); }}" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: var(--theme-text-main); border-radius: 4px; box-sizing: border-box;">
                          </div>
                          <div style="flex: 1;">
                            <label style="color: var(--theme-text-dim); font-size: 0.8em; display: block; margin-bottom: 4px;">Stromverbrauch (Watt)</label>
                            <input type="number" step="10" .value="${manualInput.power}" @input="${(e) => { this.manualInputs = { ...this.manualInputs, [miner.id]: { ...manualInput, power: parseFloat(e.target.value) || 0 } }; this.requestUpdate(); }}" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: var(--theme-text-main); border-radius: 4px; box-sizing: border-box;">
                          </div>
                        </div>
                      ` : ''}
                      
                     <div class="tech-box" style="background: rgba(0,0,0,0.3); border-color: rgba(var(--theme-accent-1-rgb), 0.4); box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: var(--theme-text-dim);">⛏️ Mining Ertrag:</span>
                            <strong style="color: var(--theme-accent-1); font-size: 1.1em;">${revenuePerKwh.toFixed(4)} € / kWh</strong>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed rgba(255,255,255,0.1);">
                            <span style="color: var(--theme-text-dim);">⚖️ Break-Even:</span>
                            <strong style="color: var(--theme-text-main); font-size: 1.1em;">${revenuePerKwh.toFixed(4)} € / kWh</strong>
                        </div>

                        <div style="display: flex; justify-content: space-between; margin-top: 12px; margin-bottom: 4px;">
                            <span style="color: var(--theme-text-main); font-weight: bold;">☀️ Profit (PV):</span>
                            <strong style="color: var(--theme-accent-2); font-size: 1.25em; text-shadow: 0 0 10px rgba(var(--theme-accent-2-rgb), 0.2);">
                                +${revenuePerKwh.toFixed(4)} € / kWh
                            </strong>
                        </div>
                     </div>

                     ${(dailyRevenue > 0) ? html`
                     <div class="tech-box" style="background: rgba(var(--theme-accent-2-rgb), 0.05); border-color: rgba(var(--theme-accent-2-rgb), 0.2); margin-top: 15px;">
                         <h4 style="margin: 0 0 10px 0; color: var(--theme-accent-2); font-size: 0.95em; text-transform: uppercase;">📈 Ertrag 24/7</h4>
                         <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                             <span style="color: var(--theme-text-dim);">Tag:</span>
                             <strong style="color: var(--theme-accent-2);">+${dailyRevenue.toFixed(2)} €</strong>
                         </div>
                         <div style="display: flex; justify-content: space-between;">
                             <span style="color: var(--theme-text-dim);">Monat:</span>
                             <strong style="color: var(--theme-accent-2); font-size: 1.2em;">+${monthlyRevenue.toFixed(2)} €</strong>
                         </div>
                     </div>
                     ` : ''}
                  </div>
                `;
             } catch (e) {
                console.error("Error rendering energy card:", miner.id, e);
                return html`<div class="card" style="border: 1px solid #e74c3c; background: rgba(231, 76, 60, 0.05); padding: 15px;">⚠️ Fehler</div>`;
             }
           }) : html`<p>Keine Miner konfiguriert.</p>`}
        </div>

        <div class="tech-box" style="margin-top: 30px; border-color: rgba(var(--theme-accent-1-rgb), 0.2);">
           <h3 style="color: var(--theme-accent-1); margin-top: 0;">💡 Bitcoin Infos</h3>
           <p style="color: var(--theme-text-dim); font-size: 0.9em;">
              Difficulty: <b>${formatDifficulty(this.btcDifficulty)}</b> | Preis: <b>${this.btcPriceEur ? this.btcPriceEur.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : '-'}</b>
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
                          ${miner.power_consumption_sensor ? this.renderChart(miner.power_consumption_sensor, '#d62cf6', '⚡ Stromverbrauch', this.hass?.states[miner.power_consumption_sensor]?.attributes?.unit_of_measurement || 'W') : ''}
                          ${miner.hashrate_sensor ? this.renderChart(miner.hashrate_sensor, '#0bc4e2', '⛏️ Hashrate', this.hass?.states[miner.hashrate_sensor]?.attributes?.unit_of_measurement || 'TH/s') : ''}
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
            <span style="color: var(--theme-text-main); font-size: 1.1em; font-weight: bold;">
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
        font-family: var(--theme-font, 'Inter', 'Roboto', sans-serif);
        background: var(--theme-bg-app);
        min-height: 100vh;
        color: var(--theme-text-main, #e0e0e0);
        color-scheme: dark;

        /* Default fallback variables if not set via _applyThemeStyles */
        --theme-primary: #0bc4e2;
        --theme-accent-1: #0bc4e2;
        --theme-accent-2: #d62cf6;
        --theme-accent-3: #ffcc00;
        --theme-accent-4: #00ff88;
        --theme-radius: 16px;
      }

      /* --- DYNAMIC BACKGROUND OVERLAYS --- */
      .theme-bg-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
      }

      /* Midnight Glow */
      :host([theme="midnight"]) .theme-bg-overlay::before {
        content: "";
        position: absolute;
        width: 200%; height: 200%;
        background: radial-gradient(circle at 30% 30%, rgba(138, 43, 226, 0.08) 0%, transparent 40%),
                    radial-gradient(circle at 70% 80%, rgba(75, 0, 130, 0.08) 0%, transparent 40%);
        animation: bg-float 40s infinite linear;
      }

      /* Atlantis */
      :host([theme="atlantis"]) .theme-bg-overlay::before {
        content: "";
        position: absolute;
        width: 100%; height: 100%;
        background: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7z' fill='rgba(0,255,255,0.03)' fill-rule='evenodd'/%3E%3C/svg%3E");
        animation: bg-water-flow 60s infinite linear;
      }

      /* Lava */
      :host([theme="lava"]) .theme-bg-overlay::before {
        content: "";
        position: absolute;
        width: 100%; height: 100%;
        background: radial-gradient(circle at 50% 120%, rgba(255, 69, 0, 0.08) 0%, transparent 60%);
        animation: bg-flicker 6s infinite alternate;
      }

      /* Cyberpunk - Neon Grid & Scanlines */
      :host([theme="cyberpunk"]) .theme-bg-overlay::before {
        content: "";
        position: absolute;
        width: 100%; height: 100%;
        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), 
                    linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
        background-size: 100% 4px, 3px 100%;
        z-index: 10;
        pointer-events: none;
      }
      :host([theme="cyberpunk"]) .theme-bg-overlay::after {
        content: "";
        position: absolute;
        bottom: 0; left: 0; right: 0; height: 300px;
        background: linear-gradient(transparent, rgba(255, 0, 255, 0.1));
        transform: perspective(500px) rotateX(60deg);
        background-size: 50px 50px;
        background-image: linear-gradient(to right, rgba(0, 251, 255, 0.1) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(0, 251, 255, 0.1) 1px, transparent 1px);
        animation: bg-grid-move 20s infinite linear;
      }

      /* Matrix - Digital Rain */
      :host([theme="matrix"]) .theme-bg-overlay::before {
        content: "";
        position: absolute;
        width: 100%; height: 100%;
        background: linear-gradient(rgba(0, 255, 65, 0.1) 0%, transparent 70%);
        background-size: 2px 100%;
        animation: bg-matrix-rain 8s infinite linear;
        opacity: 0.3;
      }

      /* Solar - Flares */
      :host([theme="solar"]) .theme-bg-overlay::before {
        content: "";
        position: absolute;
        width: 200%; height: 200%;
        background: radial-gradient(circle at center, rgba(255, 157, 0, 0.05) 0%, transparent 50%);
        animation: bg-float 30s infinite alternate ease-in-out;
      }

      /* Bitcoin Classic - Coin Patterns */
      :host([theme="classic"]) .theme-bg-overlay::before {
        content: "";
        position: absolute;
        width: 100%; height: 100%;
        background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='10' y='40' font-family='Arial' font-size='30' fill='rgba(247,147,26,0.03)'%3E₿%3C/text%3E%3C/svg%3E");
        animation: bg-water-flow 120s infinite linear;
      }

      /* Crystal Ice */
      :host([theme="ice"]) .theme-bg-overlay::before {
        content: "";
        position: absolute;
        width: 100%; height: 100%;
        background: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='1' fill='white' opacity='0.2' /%3E%3Ccircle cx='50' cy='80' r='1.5' fill='white' opacity='0.1' /%3E%3C/svg%3E");
        animation: bg-ice-float 30s infinite linear;
      }
      :host([theme="ice"]) .theme-bg-overlay::after {
        content: "";
        position: absolute;
        width: 100%; height: 100%;
        background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, transparent 80%);
        animation: bg-flicker 5s infinite;
      }

      /* Deep Abyss */
      :host([theme="abyss"]) .theme-bg-overlay::before {
        content: "";
        position: absolute;
        width: 100%; height: 100%;
        background: radial-gradient(circle at 20% 40%, rgba(0, 255, 159, 0.04) 0%, transparent 40%),
                    radial-gradient(circle at 80% 60%, rgba(0, 210, 255, 0.04) 0%, transparent 40%);
        animation: bg-float 25s infinite alternate ease-in-out;
      }
      :host([theme="abyss"]) .theme-bg-overlay::after {
        content: "";
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        background: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 255, 159, 0.02));
        animation: bg-flicker 10s infinite alternate;
      }

      /* Solarmodule Gladbeck - Solar Power Engine (Ultra Premium) */
      :host([theme="gladbeck"]) .theme-bg-overlay::before {
        content: "";
        position: absolute;
        width: 100%; height: 100%;
        background: 
          url("https://solarmodule-gladbeck.de/wp-content/uploads/2023/07/cropped-logo_new.png") no-repeat center 55% / 35%,
          url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='none'/%3E%3Cpath d='M0 30h60M30 0v60' stroke='rgba(0,120,187,0.15)' stroke-width='1.5'/%3E%3C/svg%3E") repeat,
          radial-gradient(circle at 50% 10%, rgba(255, 153, 0, 0.15) 0%, transparent 40%);
        filter: contrast(1.1) brightness(1.2);
        animation: bg-grid-float 35s infinite linear, bg-logo-pulse 12s infinite ease-in-out;
        z-index: 1;
      }
      :host([theme="gladbeck"]) .theme-bg-overlay::after {
        content: "";
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        background: 
          repeating-conic-gradient(from 0deg at 50% -10%, transparent 0deg, rgba(0, 120, 187, 0.03) 5deg, transparent 10deg),
          radial-gradient(circle at 50% -10%, rgba(255, 153, 0, 0.1) 0%, transparent 60%);
        animation: bg-sun-rays 25s infinite linear, bg-flicker 8s infinite alternate;
        mix-blend-mode: screen;
        z-index: 2;
      }

      /* Card Upgrades for Gladbeck Theme */
      :host([theme="gladbeck"]) .card, 
      :host([theme="gladbeck"]) .miner-card,
      :host([theme="gladbeck"]) .tech-box {
        backdrop-filter: blur(25px) saturate(180%);
        background: rgba(0, 31, 63, 0.4) !important;
        border: 1px solid rgba(0, 120, 187, 0.4);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(0, 120, 187, 0.1);
        animation: border-glow-cycle 8s infinite ease-in-out;
        position: relative;
        overflow: hidden;
      }
      :host([theme="gladbeck"]) .card::before,
      :host([theme="gladbeck"]) .miner-card::before {
        content: "";
        position: absolute;
        top: -50%; left: -50%; width: 200%; height: 200%;
        background: linear-gradient(45deg, transparent, rgba(255,255,255,0.03), transparent);
        transform: rotate(45deg);
        animation: card-sheen 6s infinite linear;
        pointer-events: none;
      }

      @keyframes bg-sun-rays {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes border-glow-cycle {
        0%, 100% { border-color: rgba(0, 120, 187, 0.4); box-shadow: 0 0 15px rgba(0, 120, 187, 0.2); }
        50% { border-color: rgba(255, 153, 0, 0.5); box-shadow: 0 0 25px rgba(255, 153, 0, 0.25); }
      }
      @keyframes card-sheen {
        0% { transform: translateX(-100%) rotate(45deg); }
        100% { transform: translateX(100%) rotate(45deg); }
      }

      @keyframes bg-logo-pulse {
        0%, 100% { opacity: 0.04; transform: scale(0.95); }
        50% { opacity: 0.08; transform: scale(1.02); }
      }

      @keyframes bg-grid-float {
        from { background-position: 0 0; }
        to { background-position: 400px 400px; }
      }

      @keyframes bg-ice-float {
        from { background-position: 0 0; }
        to { background-position: 500px 1000px; }
      }

      @keyframes bg-grid-move {
        from { background-position: 0 0; }
        to { background-position: 0 500px; }
      }

      @keyframes bg-matrix-rain {
        from { background-position: 0 -1000px; }
        to { background-position: 0 1000px; }
      }

      @keyframes bg-float {
        from { transform: translate(-25%, -25%) rotate(0deg); }
        to { transform: translate(0%, 0%) rotate(360deg); }
      }

      @keyframes bg-water-flow {
        from { background-position: 0 0; }
        to { background-position: 1000px 1000px; }
      }

      @keyframes bg-flicker {
        0% { opacity: 0.2; transform: scale(1); }
        100% { opacity: 0.8; transform: scale(1.1); }
      }

      /* --- ACTIVITY TICKER STYLES --- */
      .activity-ticker {
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(15px);
        border-bottom: 2px solid rgba(var(--theme-accent-1-rgb), 0.2);
        height: 40px;
        overflow: hidden;
        position: relative;
        z-index: 101;
        display: flex;
        align-items: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      }

      .ticker-content {
        display: flex;
        white-space: nowrap;
        animation: ticker-scroll 40s infinite linear;
      }

      .ticker-item {
        color: var(--theme-accent-1);
        font-family: 'Courier New', monospace;
        font-size: 0.85em;
        margin-right: 15vw;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        text-shadow: 0 0 10px rgba(var(--theme-accent-1-rgb), 0.6);
        flex-shrink: 0;
      }

      @media (min-width: 1024px) {
        .activity-ticker {
          overflow: hidden;
          background: rgba(0,0,0,0.2);
          border-bottom: 1px solid var(--theme-border-color);
        }
        .ticker-content {
          animation: none;
          justify-content: center;
          padding: 0 20px;
        }
        .ticker-item {
          margin-right: 40px;
          letter-spacing: 1px;
        }
        /* Hide duplicated logs on desktop to keep it static and clean */
        .ticker-item:nth-child(n+21) {
          display: none;
        }
      }

      @keyframes ticker-scroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(-33.333%); }
      }
      
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 30px;
        margin-bottom: 25px;
        padding: 30px 40px;
        background: linear-gradient(135deg, rgba(var(--theme-accent-1-rgb), 0.05) 0%, rgba(var(--theme-accent-2-rgb), 0.02) 100%), var(--theme-bg-header, rgba(18, 18, 20, 0.6));
        border-radius: var(--theme-radius);
        border: 1px solid rgba(var(--theme-accent-1-rgb), 0.15);
        backdrop-filter: blur(30px) saturate(150%);
        box-shadow: 0 20px 50px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05);
        flex-wrap: wrap;
        position: relative;
        overflow: hidden;
      }

      .header::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(var(--theme-accent-1-rgb), 0.3), transparent);
      }
      
      .profile-section {
        display: flex;
        align-items: center;
        gap: 25px;
        flex: 1.2;
        min-width: 300px;
      }

      .title-section {
        flex: 1;
        min-width: 250px;
        text-align: right;
      }

      .market-section {
        flex: 0.8;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 30px;
        padding: 10px 20px;
        background: rgba(0,0,0,0.2);
        border-radius: 20px;
        border: 1px solid rgba(var(--theme-accent-1-rgb), 0.1);
      }

      @media (max-width: 900px) {
        .header {
          flex-direction: column;
          text-align: center;
          gap: 20px;
          padding: 20px;
        }
        .title-section {
          order: -1;
          text-align: center !important;
          width: 100%;
        }
        .title-section h1 {
          justify-content: center !important;
          font-size: 1.8em !important;
        }
        .profile-section {
          justify-content: center;
          width: 100%;
          flex-direction: column;
          gap: 15px;
        }
        .market-section {
          width: 100%;
          flex-direction: row;
          justify-content: space-around;
          gap: 10px;
          padding: 15px;
        }
        .halving-widget, .market-pulse {
          flex: 1;
          justify-content: center;
        }
      }
      
      .avatar-container {
        position: relative;
        flex-shrink: 0;
      }

      .header h1 { 
        margin: 0; 
        font-size: 2.6em; 
        color: var(--theme-primary); 
        text-shadow: 0 0 30px rgba(var(--theme-primary-rgb), 0.5);
        font-weight: 800;
        letter-spacing: -1px;
        line-height: 1;
      }
      .subtitle { 
        margin-top: 8px; 
        font-size: 0.9em; 
        color: var(--theme-text-dim, #888);
        text-transform: uppercase;
        letter-spacing: 4px;
        font-weight: 700;
        opacity: 0.7;
      }
      .ticker-container {
        display: flex;
        align-items: center;
        background: rgba(0,0,0,0.4);
        border: 1px solid rgba(var(--theme-accent-1-rgb), 0.1);
        border-radius: 40px;
        padding: 12px 30px;
        margin: 0 20px 25px 20px;
        overflow: hidden;
        position: relative;
        box-shadow: inset 0 2px 10px rgba(0,0,0,0.3);
      }
      
      .ticker-content {
        display: flex;
        align-items: center;
        width: 100%;
        justify-content: space-between;
        gap: 20px;
      }
      
      .ticker-mobile-extra {
        display: none; /* Hidden on Desktop */
      }
      
      .ticker-item {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        font-family: 'Share Tech Mono', monospace;
        font-size: 0.9em;
        color: var(--theme-text-dim);
      }

      @keyframes tickerScroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }

      .btn-mining {
        font-family: var(--theme-font);
        font-weight: 900;
        font-size: 1.4em;
        padding: 18px 40px;
        border-radius: var(--theme-radius);
        text-transform: uppercase;
        letter-spacing: 4px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
        width: 100%;
        position: relative;
        overflow: hidden;
      }

      .btn-mining::after {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
        transform: rotate(45deg);
        transition: 0.5s;
        pointer-events: none;
      }

      .btn-mining:hover::after {
        left: 100%;
      }
      
      .tabs { display: flex; justify-content: center; margin-bottom: 35px; gap: 15px; flex-wrap: wrap; }
      .tab {
        padding: 14px 25px; 
        background: var(--theme-bg-card, rgba(30, 30, 30, 0.6)); 
        border: 1px solid var(--theme-border-color); 
        border-radius: var(--theme-radius); 
        cursor: pointer; 
        font-weight: 700;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 
        color: var(--theme-text-dim);
        backdrop-filter: blur(10px);
        text-align: center;
        flex: 1 1 auto;
        min-width: 140px;
        max-width: 300px;
      }
      .tab:hover { background: rgba(var(--theme-primary-rgb), 0.1); color: var(--theme-primary); transform: translateY(-2px); }
      .tab.active { 
        background: var(--theme-primary); 
        color: #000; 
        border-color: var(--theme-primary); 
        box-shadow: 0 5px 20px rgba(var(--theme-primary-rgb), 0.3);
      }
      
      .content { max-width: 900px; margin: 0 auto; }
      
      /* Techy Cards */
      .card { 
        background: var(--theme-bg-card); 
        border-radius: var(--theme-radius); 
        padding: 35px; 
        box-shadow: 0 15px 50px rgba(0,0,0,0.6); 
        margin-bottom: 25px; 
        border: 1px solid var(--theme-border-color); 
        backdrop-filter: blur(25px);
        -webkit-backdrop-filter: blur(25px);
      }
      .card h2 { 
        margin-top: 0; 
        font-size: 1.8em;
        color: var(--theme-primary); 
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 25px;
      }
      
      .empty-state { text-align: center; padding: 60px 20px; color: var(--theme-text-dim); border: 1px dashed var(--theme-border-color); }
      
      .dashboard-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 20px;
      }
      
      /* Grid for Miners Dashboard */
      .miners-grid { 
        display: grid; 
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
        gap: 25px; 
        width: 100%;
      }

      
      /* Single Miner Layout */
      .miners-grid.single-miner { 
        display: flex; 
        justify-content: center; 
        align-items: flex-start;
        width: 100%;
        margin-top: 40px !important;
      }
      .miners-grid.single-miner .miner-card { 
        width: 100%; 
        max-width: 700px; 
        padding: 40px; 
        margin: 0 auto;
      }
      
      .miner-card { 
        background: linear-gradient(180deg, rgba(35,35,40,0.6) 0%, rgba(20,20,22,0.6) 100%);
        border-radius: var(--theme-radius); 
        padding: 25px; 
        position: relative;
        border: 1px solid var(--theme-border-color);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.37);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
        overflow: hidden;
      }
      .miner-card:hover { 
        border-color: var(--theme-primary); 
        transform: translateY(-5px) scale(1.015); 
        box-shadow: 0 15px 45px rgba(var(--theme-primary-rgb), 0.15);
      }
      .miner-card::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
        background: linear-gradient(90deg, var(--theme-accent-1), var(--theme-accent-2)); border-radius: var(--theme-radius) var(--theme-radius) 0 0;
        z-index: 2;
      }
      
      .miner-image {
        position: absolute;
        top: 0; right: 0; bottom: 0; left: 0;
        background-size: cover; background-position: center;
        opacity: var(--theme-glow-op); z-index: 0;
        pointer-events: none;
      }
      .miner-image.placeholder {
        display: flex; justify-content: right; align-items: end; padding: 20px;
        font-size: 8em; color: rgba(var(--theme-primary-rgb), 0.05); font-weight: bold; line-height: 1;
      }
      
      .miner-header, .miner-status, .miner-details {
        position: relative; z-index: 1;
      }
      
      .miner-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--theme-border-color); padding-bottom: 12px; margin-bottom: 18px; }
      .miner-header h3 { margin: 0; font-size: 1.5em; color: var(--theme-text-main); text-shadow: 0 0 10px rgba(var(--theme-text-main-rgb, 255,255,255), 0.1); }
      .prio-badge { background: rgba(var(--theme-primary-rgb), 0.15); padding: 4px 10px; border-radius: var(--theme-radius); font-size: 0.85em; color: var(--theme-primary); font-weight: bold; border: 1px solid rgba(var(--theme-primary-rgb), 0.4);}
      .prio-badge.small { font-size: 0.75em; padding: 2px 6px; }
      
      .miner-status { display: flex; justify-content: center; gap: 15px; margin-bottom: 20px; align-items: stretch; }
      .status-badge { 
        padding: 10px 20px; border-radius: var(--theme-radius); font-weight: 800; 
        background: rgba(0,0,0,0.5); color: var(--theme-text-dim); text-align: center; width: 100%; font-size: 1.2em;
        letter-spacing: 1.5px; border: 1px solid var(--theme-border-color);
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(10px);
        box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
        transition: all 0.3s ease;
      }
      .status-badge.on { 
        background: rgba(var(--theme-accent-2-rgb), 0.15); color: var(--theme-accent-2); 
        border-color: rgba(var(--theme-accent-2-rgb), 0.5); 
        box-shadow: inset 0 2px 15px rgba(var(--theme-accent-2-rgb), 0.1), 0 0 15px rgba(var(--theme-accent-2-rgb), 0.15);
        text-shadow: 0 0 8px rgba(var(--theme-accent-2-rgb), 0.6); 
      }
      .status-badge.standby { 
        background: rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.15); color: var(--theme-accent-3, #ffcc00); 
        border-color: rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.4); 
        box-shadow: inset 0 2px 10px rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.1);
      }
      .status-badge.off { 
        background: rgba(231, 76, 60, 0.1); color: #e74c3c; 
        border-color: rgba(231, 76, 60, 0.3); 
        box-shadow: inset 0 2px 10px rgba(231, 76, 60, 0.1);
      }
      .pulse-orange { 
        animation: pulse-orange 2s infinite; 
        background: rgba(var(--theme-primary-rgb), 0.1) !important;
        color: var(--theme-primary) !important;
        border-color: rgba(var(--theme-primary-rgb), 0.4) !important;
      }
      @keyframes pulse-orange {
        0% { box-shadow: 0 0 0 0 rgba(var(--theme-primary-rgb), 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(var(--theme-primary-rgb), 0); }
        100% { box-shadow: 0 0 0 0 rgba(var(--theme-primary-rgb), 0); }
      }
      
      .btn-power {
        background: rgba(37, 37, 40, 0.6); border: 1px solid var(--theme-border-color); border-radius: var(--theme-radius); color: var(--theme-text-dim);
        font-size: 1.5em; padding: 0 20px; cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(5px);
      }
      .btn-power:hover { background: rgba(50,50,55,0.8); color: var(--theme-primary); border-color: var(--theme-primary); transform: scale(1.05); }
      .btn-power:active { transform: scale(0.95); }
      .btn-power.on { color: var(--theme-accent-2); border-color: rgba(var(--theme-accent-2-rgb), 0.5); background: rgba(var(--theme-accent-2-rgb), 0.15); box-shadow: 0 0 15px rgba(var(--theme-accent-2-rgb), 0.2); }
      .btn-power.on:hover { background: rgba(var(--theme-accent-2-rgb), 0.25); box-shadow: 0 0 20px rgba(var(--theme-accent-2-rgb), 0.3); }
      
      .miner-details p { margin: 8px 0; font-size: 0.95em; color: var(--theme-text-dim); }
      .accent-text { color: var(--theme-primary); font-weight: bold; text-shadow: 0 0 5px rgba(var(--theme-primary-rgb), 0.3); }
      
      .api-stats {
        display: flex; gap: 10px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid var(--theme-border-color);
        justify-content: space-around;
        box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
      }
      .api-stats .stat { display: flex; flex-direction: column; align-items: center; }
      .api-stats .lbl { font-size: 0.75em; color: var(--theme-text-dim); text-transform: uppercase; letter-spacing: 1.5px; }
      .api-stats .val { font-size: 1.35em; font-weight: 800; color: var(--theme-primary); font-family: monospace; margin-top: 5px; text-shadow: 0 0 8px rgba(var(--theme-primary-rgb), 0.4); }

      .btn-control {
        background: rgba(30, 30, 35, 0.6); border: 1px solid var(--theme-border-color); border-radius: 8px; color: var(--theme-text-dim);
        font-size: 0.85em; padding: 8px 12px; cursor: pointer; transition: all 0.2s;
        font-weight: 800; letter-spacing: 0.5px; flex: 1; text-align: center;
        backdrop-filter: blur(5px);
      }
      .btn-control:hover { filter: brightness(1.3); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
      .btn-control:active { transform: translateY(0); }
      .btn-control.mode-low { border-color: rgba(52, 152, 219, 0.4); color: #3498db; }
      .btn-control.mode-low:hover { background: rgba(52, 152, 219, 0.1); box-shadow: 0 0 15px rgba(52, 152, 219, 0.2); }
      .btn-control.mode-normal { border-color: rgba(var(--theme-accent-2-rgb), 0.4); color: var(--theme-accent-2); }
      .btn-control.mode-normal:hover { background: rgba(var(--theme-accent-2-rgb), 0.1); box-shadow: 0 0 15px rgba(var(--theme-accent-2-rgb), 0.2); }
      .btn-control.mode-high { border-color: rgba(231, 76, 60, 0.4); color: #e74c3c; }
      .btn-control.mode-high:hover { background: rgba(231, 76, 60, 0.1); box-shadow: 0 0 15px rgba(231, 76, 60, 0.2); }
      .btn-control.action { background: rgba(255,255,255,0.05); }
      .btn-control.action.warn { border-color: rgba(230, 126, 34, 0.4); color: #e67e22; }
      .btn-control.action.warn:hover { background: rgba(230, 126, 34, 0.1); box-shadow: 0 0 15px rgba(230, 126, 34, 0.2); }

      .tech-box {
        background: rgba(0,0,0,0.25);
        border: 1px solid var(--theme-border-color);
        padding: 15px;
        border-radius: 12px;
        margin-top: 20px;
        box-shadow: inset 0 2px 15px rgba(0,0,0,0.3);
      }
      .highlight-val { font-size: 1.25em; font-weight: 800; color: var(--theme-text-main); font-family: monospace; letter-spacing: 1px; }
      
      .slider-container {
        position: relative;
        padding: 12px 0;
        margin-top: 8px;
      }
      .slider-markers {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 16px;
        transform: translateY(-50%);
        z-index: 1;
        pointer-events: none;
      }
      .slider-marker {
        position: absolute;
        width: 4px;
        height: 100%;
        background: #e74c3c;
        transform: translateX(-50%);
        border-radius: 2px;
        box-shadow: 0 0 8px rgba(231, 76, 60, 0.6);
      }

      /* List in Settings */
      .btn-primary { 
        background: var(--theme-primary); color: #000; border: none; padding: 14px 20px; border-radius: 8px; 
        cursor: pointer; font-weight: 800; margin-bottom: 25px; width: 100%; font-size: 1.1em; 
        transition: 0.3s; box-shadow: 0 4px 15px rgba(var(--theme-primary-rgb), 0.3);
      }
      .btn-primary:hover { background: var(--theme-accent-2); box-shadow: 0 6px 20px rgba(var(--theme-primary-rgb), 0.5); }
      
      .miner-list { display: flex; flex-direction: column; gap: 12px; }
      .miner-list-item { 
        background: rgba(25, 25, 30, 0.6); padding: 18px; border-radius: 10px; 
        display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--theme-border-color); 
        transition: 0.2s;
      }
      .miner-list-item:hover { border-color: var(--theme-primary); background: rgba(35, 35, 40, 0.8); }
      .miner-list-item strong { font-size: 1.2em; color: var(--theme-text-main); display: inline-block; margin-bottom: 5px;}
      .small-text { margin: 5px 0 0 0; font-size: 0.85em; color: var(--theme-text-dim); line-height: 1.4; }
      .empty-text { color: var(--theme-text-dim); font-style: italic; text-align: center; padding: 20px; }
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
      .form-group label { display: block; margin-bottom: 8px; font-weight: 600; font-size: 0.95em; color: var(--theme-text-dim); }
      
      /* Dropdowns and Inputs in Tech Theme */
      .form-group input, .form-group select { 
        width: 100%; padding: 14px 16px; border-radius: 8px; border: 1px solid #3a3a40; 
        box-sizing: border-box; font-size: 1em; background: rgba(10, 10, 12, 0.8); 
        color: var(--theme-text-main); transition: all 0.3s; font-family: inherit;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
      }
      .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--theme-primary); box-shadow: 0 0 0 2px rgba(var(--theme-primary-rgb), 0.2); }
      
      /* Style Dropdown Options */
      .form-group select option { background: #1a1a1f; color: #fff; padding: 10px; }
      
      .form-group small { display: block; margin-top: 6px; color: var(--theme-text-dim, #666); font-size: 0.85em; }
      
      .btc-section { 
        background: rgba(var(--theme-primary-rgb), 0.03); 
        padding: 25px; border-radius: 10px; margin-top: 15px; 
        border: 1px dashed rgba(var(--theme-primary-rgb), 0.3); 
        position: relative;
      }
      .btc-section h3 { margin-top: 0; font-size: 1.2em; color: var(--theme-primary); margin-bottom: 20px; display: flex; align-items: center; gap: 8px;}
      
      .form-actions { display: flex; gap: 20px; margin-top: 40px; }
      .btn-save { 
        background: var(--theme-primary); color: #000; border: none; padding: 16px; border-radius: 8px; 
        cursor: pointer; flex: 2; font-weight: 800; font-size: 1.1em; transition: 0.3s;
        box-shadow: 0 4px 15px rgba(var(--theme-primary-rgb), 0.3);
      }
      .btn-save:hover { background: var(--theme-accent-2); box-shadow: 0 6px 20px rgba(var(--theme-primary-rgb), 0.5); transform: translateY(-2px); }
      .btn-cancel { 
        background: transparent; color: var(--theme-text-dim); border: 1px solid #555; padding: 16px; 
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
        color: #0bc4e2;
        text-shadow: 0 0 15px rgba(11, 196, 226, 0.6);
      }

      /* Bitcoin Ticker Styles */
      .ticker-container {
        display: flex;
        justify-content: space-around;
        align-items: center;
        background: rgba(11, 196, 226, 0.1);
        border: 1px solid rgba(11, 196, 226, 0.3);
        border-radius: 8px;
        padding: 8px 15px;
        margin: 0 20px 20px 20px;
        color: #ddd;
        font-size: 0.9em;
        overflow-x: auto;
        white-space: nowrap;
        gap: 20px;
        box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
      }
      .ticker-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ticker-label {
        color: #888;
        font-size: 0.85em;
        text-transform: uppercase;
        font-weight: bold;
      }
      .ticker-val {
        color: #0bc4e2;
        font-family: monospace;
        font-weight: bold;
      }
      .ticker-divider {
        color: rgba(255,255,255,0.1);
      }

      /* Mobile Optimierungen - ÜBERSCHREIBEN ODER ERGÄNZEN BESTEHENDER STYLES */
      @media (max-width: 768px) {
        .header { 
          flex-direction: column !important; 
          text-align: center !important; 
          padding: 15px !important;
          gap: 15px !important;
          margin-bottom: 20px !important;
          border-radius: 12px !important;
          position: relative;
          z-index: 100;
        }
        .header .title-section { text-align: center !important; width: 100%; }
        .header .title-section h1 { justify-content: center !important; font-size: 1.6em !important; }
        .header .subtitle { letter-spacing: 1px !important; font-size: 0.75em !important; }
        
        .profile-section { 
          flex-direction: column !important; 
          gap: 10px !important; 
          width: 100%;
          padding-bottom: 15px;
          border-bottom: 1px dashed rgba(255,255,255,0.1);
        }
        .avatar-container { width: 50px !important; height: 50px !important; }
        .wallet-info { text-align: center !important; }
        .wallet-info div:first-child { font-size: 0.6em !important; }
        .wallet-info div:last-child { font-size: 1.4em !important; }
        
        .overview-section { 
          grid-template-columns: repeat(2, 1fr) !important; 
          gap: 10px !important; 
          margin-bottom: 20px !important;
        }
        .overview-section .card { padding: 15px !important; }
        .overview-section .card div:nth-child(2) { font-size: 1.5em !important; margin-top: 10px !important; }
        .overview-section .card span { font-size: 0.65em !important; }
        
        .tabs { margin: 0 5px 15px 5px !important; gap: 8px !important; }

        .tab { padding: 10px 5px !important; font-size: 0.8em !important; flex: 1 1 45% !important; border-radius: 8px !important; }
        
        .ticker-container { 
          padding: 15px 0 !important;
          margin: 0 !important;
          border-radius: 0 !important;
          background: rgba(0,0,0,0.6) !important;
          border-left: none !important;
          border-right: none !important;
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }
        .ticker-content {
          animation: tickerScroll 25s linear infinite;
          width: auto !important;
          justify-content: flex-start !important;
          gap: 60px !important;
        }
        .ticker-mobile-extra {
          display: flex !important;
          align-items: center;
          gap: 60px;
        }
        .ticker-content:hover { animation-play-state: paused; }
        
        .miner-card { padding: 15px !important; margin-bottom: 15px !important; }
        .miner-header { flex-direction: column; align-items: flex-start; gap: 10px; }
        .btn-mining { padding: 15px !important; font-size: 1.1em !important; letter-spacing: 2px !important; }
        
        .stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
        .stat-card { padding: 10px !important; }
        .stat-val { font-size: 1.1em !important; }
        
        .miner-details { grid-template-columns: 1fr !important; }
      }

      /* Speziell für sehr schmale Handys */
      @media (max-width: 480px) {
        .overview-section { 
          grid-template-columns: 1fr !important; 
        }
        .header .title-section h1 { font-size: 1.3em !important; }
        .tab { flex: 1 1 100% !important; }
      }
    `;
  }

  _renderTicker() {
    if (!this.mempool || !this.mempool.fees) return html`<div style="margin-bottom: 20px;"></div>`;
    
    const fees = this.mempool.fees;
    const height = this.mempool.height;
    const halving = this.mempool.halving;

    const tickerItems = html`
      ${this.config.theme === 'gladbeck' ? html`
        <div class="ticker-item" style="border-right: 1px solid rgba(0,120,187,0.3); padding-right: 20px;">
          <span style="color: var(--theme-accent-2); font-weight: bold; font-size: 0.9em; letter-spacing: 1px;">☀️ Solarmodule Gladbeck:</span>
          <span style="color: #fff; font-size: 0.8em; opacity: 0.8; margin-left: 8px;">Ihr Experte für Photovoltaik & Balkonkraftwerke</span>
        </div>
      ` : ''}
      <div class="ticker-item" title="Aktueller Bitcoin Preis">
        <span class="ticker-label">Price:</span>
        <span class="ticker-val" style="color: var(--theme-accent-3); text-shadow: 0 0 10px rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.3);">
          ${this.btcPriceEur ? this.btcPriceEur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }) : '...'}
        </span>
      </div>
      <div class="ticker-item" title="Empfohlene Gebühren (Fast | Medium | Low)">
        <span class="ticker-label">Fees:</span>
        <span class="ticker-val" style="color: var(--theme-accent-1); text-shadow: 0 0 8px rgba(var(--theme-accent-1-rgb), 0.4);">${fees.fastestFee}</span>
        <span class="ticker-divider">/</span>
        <span class="ticker-val">${fees.halfHourFee}</span>
        <span class="ticker-divider">/</span>
        <span class="ticker-val">${fees.hourFee}</span>
        <span style="font-size: 0.7em; opacity: 0.4; margin-left: 2px;">sat/vB</span>
      </div>
      <div class="ticker-item">
        <span class="ticker-label">Height:</span>
        <span class="ticker-val" style="color: var(--theme-text-main); font-family: var(--theme-font);">${height?.toLocaleString()}</span>
      </div>
      <div class="ticker-item" title="Difficulty Adjustment">
        <span class="ticker-label">Diff:</span>
        <span class="ticker-val" style="color: ${this.difficulty_adjustment?.difficultyChange >= 0 ? '#ff4d4d' : 'var(--theme-accent-4)'}; font-weight: 900;">
          ${this.difficulty_adjustment ? (this.difficulty_adjustment.difficultyChange >= 0 ? '↑' : '↓') : ''}
          ${this.difficulty_adjustment ? Math.abs(this.difficulty_adjustment.difficultyChange).toFixed(2) : '-'}%
        </span>
      </div>
      <div class="ticker-item">
        <span class="ticker-label">Halving:</span>
        <span class="ticker-val" style="color: var(--theme-primary); font-family: var(--theme-font);">${halving?.toLocaleString()} <span style="font-size: 0.7em; opacity: 0.5;">blocks</span></span>
      </div>
    `;

    return html`
      <div class="ticker-container" id="btc-ticker">
        <div class="ticker-content">
          ${tickerItems}
          <div class="ticker-mobile-extra">
            ${tickerItems}
          </div>
        </div>
      </div>
    `;
  }

}

customElements.define("openkairo-mining-panel", OpenKairoMiningPanel);


