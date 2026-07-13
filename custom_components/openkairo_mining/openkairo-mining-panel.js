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
      open: { type: Boolean, reflect: true },
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
    this._fixedTop = 0;
    this._fixedLeft = 0;
    this._fixedWidth = 300;
    this._documentClickListener = this._handleDocumentClick.bind(this);
    this._scrollListener = () => { if (this.open) this._updateFixedPosition(); };
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._documentClickListener);
    window.addEventListener('scroll', this._scrollListener, true);
    window.addEventListener('resize', this._scrollListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._documentClickListener);
    window.removeEventListener('scroll', this._scrollListener, true);
    window.removeEventListener('resize', this._scrollListener);
  }

  _updateFixedPosition() {
    const container = this.shadowRoot ? this.shadowRoot.querySelector('.picker-container') : null;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    this._fixedTop = rect.bottom + 2;
    this._fixedLeft = rect.left;
    this._fixedWidth = rect.width;
    this.requestUpdate();
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
    this.updateComplete.then(() => this._updateFixedPosition());
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
          <div class="dropdown" style="position:fixed;top:${this._fixedTop}px;left:${this._fixedLeft}px;width:${this._fixedWidth}px;z-index:9999;">
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
        z-index: 1;
      }
      :host([open]) {
        z-index: 1000;
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
        /* position/top/left/width/z-index come from inline style (fixed positioning for iPad compat) */
        background: #1a1a1f;
        border: 1px solid #0bc4e2;
        border-radius: 8px;
        max-height: 280px;
        overflow-y: auto;
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
      kasPriceEur: { type: Number },
      kasPriceUsd: { type: Number },
      kasNetworkHashrate: { type: Number },
      kasReward: { type: Number },
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

    // Debug helper for black screens (early catch)
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && (event.reason.name === 'AbortError' || event.reason.message?.includes('Transition'))) {
        event.preventDefault();
        return;
      }
      console.error('CRITICAL: Unhandled Promise Rejection:', event.reason);
    });

    this.fetchingHistory = {};
    this.simulatorModels = {};
    this.switchHistoryData = {};
    this.fetchingSwitchHistory = {};
    this.manualInputs = {};
    this.difficulty_adjustment = null;
    this.btc_price_history = [];
    this.kasPriceEur = 0;
    this.kasPriceUsd = 0;
    this.kasNetworkHashrate = 0;
    this.kasReward = 0;
    this.previewConfig = null;
    this.loadedFonts = new Set();
    this.logs = [];
    this.intervals = [];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.intervals) {
      this.intervals.forEach(id => clearInterval(id));
      this.intervals = [];
    }
  }

  connectedCallback() {
    super.connectedCallback();
    // Panel was reconnected (e.g. tablet woke from sleep) — restart intervals and reload data
    if (this._initialized && this.intervals && this.intervals.length === 0) {
      this._startIntervals();
      this.loadConfig().catch(e => console.error("loadConfig reconnect fail:", e));
    }
  }

  _startIntervals() {
    this.intervals.push(setInterval(() => { this.loadConfig(); }, 15 * 1000));
    this.intervals.push(setInterval(() => {
      this.fetchBtcPrice();
      this.fetchMarketData();
      this.fetchKaspaData();
    }, 10 * 60 * 1000));
    this.intervals.push(setInterval(() => { this.fetchBtcPriceHistory(); }, 60 * 60 * 1000));
  }

  firstUpdated() {
    this.loadConfig().catch(e => console.error("loadConfig fail:", e));
    this.fetchBtcDifficulty().catch(e => console.error("fetchBtcDiff fail:", e));
    this.fetchBtcPrice().catch(e => console.error("fetchBtcPrice fail:", e));
    this.fetchMarketData().catch(e => console.error("fetchMarket fail:", e));
    this.fetchBtcPriceHistory().catch(e => console.error("fetchBtcHist fail:", e));
    this.fetchKaspaData().catch(e => console.error("fetchKaspa fail:", e));

    console.log("OpenKairoMiningPanel: firstUpdated called");
    this._startIntervals();
    this._initialized = true;
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
            const response = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=eur&days=1');
            if (response.status === 429) return;
            const data = await response.json();
            
            if (data && data.prices && Array.isArray(data.prices)) {
                this.btc_price_history = data.prices.map(p => ({
                    time: p[0],
                    EUR: p[1]
                }));
                this.requestUpdate();
            }
        } catch (e) {
            // Silently fail
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

    async fetchKaspaData() {
        try {
            const priceResp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=eur,usd');
            if (priceResp.status === 429) return;
            const priceData = await priceResp.json();
            if (priceData && priceData.kaspa) {
                this.kasPriceEur = parseFloat(priceData.kaspa.eur || 0);
                this.kasPriceUsd = parseFloat(priceData.kaspa.usd || 0);
            }

            const rewardResp = await fetch('https://api.kaspa.org/info/blockreward');
            const rewardData = await rewardResp.json();
            if (rewardData && rewardData.blockreward) {
                this.kasReward = parseFloat(rewardData.blockreward);
            }

            const hrResp = await fetch('https://api.kaspa.org/info/hashrate');
            const hrData = await hrResp.json();
            if (hrData && hrData.hashrate) {
                this.kasNetworkHashrate = parseFloat(hrData.hashrate) || 0;
            }
            
            this.requestUpdate();
        } catch (e) {
            // Silently fail
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
      } else {
        this.historyData = { ...this.historyData, [entityId]: [] };
      }
    } catch (e) {
      console.error("Failed to fetch history for " + entityId, e);
      this.historyData = { ...this.historyData, [entityId]: [] };
    } finally {
      this.fetchingHistory[entityId] = false;
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
      } else {
        this.switchHistoryData = { ...this.switchHistoryData, [entityId]: [] };
      }
    } catch (e) {
      console.error("Failed to fetch switch history for " + entityId, e);
      this.switchHistoryData = { ...this.switchHistoryData, [entityId]: [] };
    } finally {
      this.fetchingSwitchHistory[entityId] = false;
      this.requestUpdate();
    }
  }

  ensureSwitchHistory(entityId) {
    if (!entityId || !this.hass) return;
    if (!this.switchHistoryData[entityId] && !this.fetchingSwitchHistory[entityId]) {
      this.fetchingSwitchHistory[entityId] = true;
      this.fetchSwitchHistory(entityId);
    }
  }

  calculateRuntime(entityId) {
    this.ensureSwitchHistory(entityId);
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

  buildHeatmapBuckets(entityId) {
    this.ensureSwitchHistory(entityId);
    const historyData = this.switchHistoryData[entityId] || [];
    const currentStateObj = this.hass ? this.hass.states[entityId] : null;

    let data = [...historyData];
    if (currentStateObj) {
      const lastHistoryTime = data.length > 0 ? new Date(data[data.length - 1].last_changed).getTime() : 0;
      const currentTime = new Date(currentStateObj.last_changed).getTime();
      if (currentTime > lastHistoryTime) {
        data.push({ state: currentStateObj.state, last_changed: currentStateObj.last_changed });
      }
    }

    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
    const windowEnd = now.getTime();

    const bucketMinutes = Array.from({ length: 7 }, () => new Array(24).fill(0));

    const addOnInterval = (fromMs, toMs) => {
      let cursor = Math.max(fromMs, windowStart);
      const to = Math.min(toMs, windowEnd);
      while (cursor < to) {
        const cursorDate = new Date(cursor);
        const dayIdx = Math.floor((new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate()).getTime() - windowStart) / 86400000);
        const hour = cursorDate.getHours();
        const hourEnd = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate(), hour).getTime() + 3600000;
        const segEnd = Math.min(to, hourEnd);
        if (dayIdx >= 0 && dayIdx < 7) {
          bucketMinutes[dayIdx][hour] += (segEnd - cursor) / 60000;
        }
        cursor = segEnd;
      }
    };

    let lastOnTime = null;
    for (let i = 0; i < data.length; i++) {
      const time = new Date(data[i].last_changed).getTime();
      const state = data[i].state;
      if (state === 'on') {
        if (!lastOnTime) lastOnTime = time;
      } else if (state === 'off' || state === 'unavailable' || state === 'unknown') {
        if (lastOnTime) {
          addOnInterval(lastOnTime, time);
          lastOnTime = null;
        }
      }
    }
    if (lastOnTime && currentStateObj && currentStateObj.state === 'on') {
      addOnInterval(lastOnTime, now.getTime());
    }

    const dayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const currentHour = now.getHours();
    const days = [];
    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(windowStart + d * 86400000);
      const isToday = d === 6;
      const hours = bucketMinutes[d].map((mins, h) => {
        if (isToday && h > currentHour) return null;
        return Math.min(1, mins / 60);
      });
      days.push({
        label: dayLabels[dayDate.getDay()],
        dateStr: `${String(dayDate.getDate()).padStart(2, '0')}.${String(dayDate.getMonth() + 1).padStart(2, '0')}`,
        hours
      });
    }
    return days;
  }

  renderActivityHeatmap(entityId) {
    if (!entityId) return '';
    const days = this.buildHeatmapBuckets(entityId);
    const cellColor = (v) => {
      if (v === null) return 'rgba(255,255,255,0.03)';
      if (v <= 0) return 'rgba(255,255,255,0.06)';
      if (v < 0.25) return 'rgba(11,196,226,0.25)';
      if (v < 0.5) return 'rgba(11,196,226,0.5)';
      if (v < 0.75) return 'rgba(11,196,226,0.75)';
      return 'rgba(11,196,226,1)';
    };
    return html`
      <div style="margin-top: 20px; text-align: left;">
        <h4 style="color: #888; margin: 0 0 10px 0; font-size: 0.85em; text-transform: uppercase;">🟩 Aktivität — letzte 7 Tage</h4>
        <div style="display: flex; flex-direction: column; gap: 3px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); padding: 12px; overflow-x: auto;">
          ${days.map(day => html`
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 50px; flex-shrink: 0; font-size: 0.7em; color: #888;">${day.label} ${day.dateStr}</span>
              <div style="display: flex; gap: 2px;">
                ${day.hours.map((v, h) => html`
                  <div
                    title="${day.label} ${day.dateStr} ${String(h).padStart(2, '0')}:00 — ${v === null ? 'keine Daten' : Math.round(v * 100) + '% an'}"
                    style="width: 10px; height: 10px; border-radius: 2px; background: ${cellColor(v)};">
                  </div>
                `)}
              </div>
            </div>
          `)}
          <div style="display: flex; justify-content: flex-end; gap: 4px; margin-top: 6px; align-items: center;">
            <span style="font-size: 0.65em; color: #666;">0%</span>
            ${[0, 0.2, 0.5, 0.75, 1].map(v => html`<div style="width: 10px; height: 10px; border-radius: 2px; background: ${cellColor(v)};"></div>`)}
            <span style="font-size: 0.65em; color: #666;">100%</span>
          </div>
        </div>
      </div>
    `;
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
          this.fleet = data.fleet || {};
        } else {
          this.config = { miners: [] };
          this.states = {};
          this.mempool = { fees: null, height: null, halving: null };
          this.fleet = {};
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
      mining_coin: 'BTC',
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
      battery_min_soc: 50,
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
      forecast_enabled: true,
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
      offgrid_soc_start: 90,
      offgrid_soc_stop: 85,
      offgrid_soc_max: 98,
      offgrid_min_power: 400,
      offgrid_max_power: 1400,
      watchdog_type: 'power',
      watchdog_action: 'off',
      min_run_time: 5,
      grid_price_limit: null,
      min_power: 400,
      max_power: 1400,
      scaling_mode: 'steps',
      scaling_factor: 0.95,
      power_step_limit: 0,
      soc_proportional_scaling: false,
      miner_ip: '',
      is_solo: false,
      standby_switch_2: '',
      target_temp_sensor: '',
      target_temp_on: 21.0,
      target_temp_off: 22.0,
      offgrid_soc_mid: 94,
      offgrid_mid_power: 800,
      soft_target_power: null,
      target_soc: 10,
      target_time: '07:00',
      battery_capacity: 10,
      battery_power_sensor: '',
      weather_optimization_enabled: false,
      pv_peak_power: 10,
      weather_lat: '',
      weather_lon: '',
    };
  }

  // Fields that contain mode logic and thresholds — safe to copy between miners.
  // Device-specific fields (id, name, ip, switch, sensors) are intentionally excluded.
  static get _COPY_FIELDS() {
    return [
      'mode', 'mining_coin',
      'pv_on', 'pv_off', 'delay_minutes', 'allow_battery', 'battery_min_soc',
      'price_on', 'price_off', 'grid_price_limit',
      'soc_on', 'soc_off',
      'forecast_enabled', 'forecast_min',
      'offgrid_soc_start', 'offgrid_soc_stop', 'offgrid_soc_max', 'offgrid_min_power', 'offgrid_max_power',
      'min_power', 'max_power', 'min_run_time',
      'soft_start_enabled', 'soft_stop_enabled', 'soft_continuous_scaling',
      'soft_start_steps', 'soft_stop_steps', 'soft_interval',
      'standby_watchdog_enabled', 'watchdog_type', 'watchdog_action', 'standby_power', 'standby_delay',
      'scaling_mode', 'scaling_factor', 'power_step_limit', 'soc_proportional_scaling',
      'calc_method', 'coin_price_source', 'electricity_price_source', 'electricity_price_manual',
    ];
  }

  _importMinerTemplate(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const tpl = JSON.parse(event.target.result);
        const patch = {};
        for (const f of OpenKairoMiningPanel._COPY_FIELDS) {
          if (tpl[f] !== undefined) patch[f] = tpl[f];
        }
        if (!Object.keys(patch).length) {
          alert('❌ Keine gültigen Einstellungsfelder in der Datei gefunden.');
          return;
        }
        const label = tpl._miner_model ? ` (${tpl._miner_model})` : '';
        if (!confirm(`Vorlage${label} anwenden?\n\nModus, Schwellenwerte, Soft-Start und Watchdog werden übernommen. Name, IP und Sensoren bleiben unverändert.`)) return;
        this.editForm = { ...this.editForm, ...patch };
        this.requestUpdate();
      } catch (err) {
        alert('❌ Datei konnte nicht gelesen werden: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  exportMinerTemplate(miner) {
    const template = { _type: 'openkairo_miner_template', _miner_model: miner.name };
    for (const f of OpenKairoMiningPanel._COPY_FIELDS) {
      if (miner[f] !== undefined) template[f] = miner[f];
    }
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openkairo_template_${miner.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  applyMinerSettings(sourceId) {
    const source = this.config.miners.find(m => m.id === sourceId);
    if (!source) return;
    const patch = {};
    for (const f of OpenKairoMiningPanel._COPY_FIELDS) {
      if (source[f] !== undefined) patch[f] = source[f];
    }
    this.editForm = { ...this.editForm, ...patch };
    this.requestUpdate();
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

  exportConfig() {
    const json = JSON.stringify(this.config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openkairo_config_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!imported || !Array.isArray(imported.miners)) {
          alert('❌ Ungültige Config-Datei — kein "miners" Array gefunden.');
          return;
        }
        const count = imported.miners.length;
        if (!confirm(`Config importieren?\n\n${count} Miner werden geladen. Die aktuelle Config wird überschrieben.`)) return;
        this.config = imported;
        await this.saveConfig();
      } catch (err) {
        alert('❌ Datei konnte nicht gelesen werden: ' + err.message);
      }
    };
    reader.readAsText(file);
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

  _getMinerSwitchEntities(miner) {
    const entities = [];
    if (miner.switch) entities.push(miner.switch);
    if (miner.switch_2) entities.push(miner.switch_2);
    if (miner.standby_switch) entities.push(miner.standby_switch);
    if (miner.standby_switch_2) entities.push(miner.standby_switch_2);
    
    // Auto-Discovery Fallback if no switch is configured
    if (entities.length === 0 && miner.miner_ip) {
        const ipSlug = miner.miner_ip.replace(/\./g, '_');
        const p1 = `switch.openkairo_mining_${ipSlug}_switch`;
        const p2 = `switch.openkairo_mining_${ipSlug}_mining_aktiv`;
        if (this.hass?.states[p1]) entities.push(p1);
        else if (this.hass?.states[p2]) entities.push(p2);
    }
    return entities;
  }

  toggleMiner(minerOrEntityId) {
    if (!this.hass || !minerOrEntityId) return;
    
    let entities = [];
    if (typeof minerOrEntityId === 'string') {
      entities = [minerOrEntityId];
    } else {
      entities = this._getMinerSwitchEntities(minerOrEntityId);
    }
    
    if (entities.length === 0) {
        console.warn("Could not find a switch to toggle:", minerOrEntityId);
        return;
    }
    
    // Toggle the first one found as binary state master
    this.hass.callService("switch", "toggle", { entity_id: entities[0] });
  }

  stopAutomationAndHardware(miner) {
    // 1. Merke den aktuellen Modus, bevor wir auf Manuell schalten
    const index = this.config.miners.findIndex(m => m.id === miner.id);
    if (index > -1) {
      const currentMode = this.config.miners[index].mode;
      if (currentMode && currentMode !== 'manual') {
        this.config.miners[index].last_auto_mode = currentMode;
      }
      this.config.miners[index].mode = 'manual';
      this.saveConfig(true);
    }
    
    // 2. Turn off all related power switches
    if (!this.hass) return;
    const entities = this._getMinerSwitchEntities(miner);
    if (entities.length > 0) {
      this.hass.callService("switch", "turn_off", { entity_id: entities });
    }
  }

  handleFormInput(e) {
    const { name, value, type, checked } = e.target;
    let finalValue;
    if (type === 'checkbox') {
      finalValue = checked;
    } else if (type === 'number' || type === 'range') {
      finalValue = value === '' ? '' : parseFloat(value);
    } else {
      finalValue = value;
    }
    
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
      // Merke den letzten aktiven Automatik-Modus
      if (key === 'mode' && value !== 'manual') {
        this.config.miners[index]['last_auto_mode'] = value;
      }
      
      if (typeof value === 'boolean') {
        this.config.miners[index][key] = value;
      } else {
        const numVal = parseFloat(value);
        this.config.miners[index][key] = isNaN(numVal) ? value : numVal;
      }
      this.saveConfig(true);
      this.requestUpdate();
    }
  }

  showMoreInfo(entityId) {
    if (!entityId) return;
    const event = new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true });
    this.dispatchEvent(event);
  }

  setPowerLimit(entityId, value) {
    if (!this.hass || !entityId) return;
    this.hass.callService("number", "set_value", { entity_id: entityId, value: value })
      .then(() => console.log(`Power Limit gesetzt: ${value}`))
      .catch(err => alert(`Fehler beim Setzen des Power Limits: ${err.message}`));
  }

  saveForm() {
    // Merke den letzten aktiven Automatik-Modus auch beim Speichern des gesamten Formulars
    if (this.editForm.mode && this.editForm.mode !== 'manual') {
      this.editForm.last_auto_mode = this.editForm.mode;
    }

    if (this.editingMinerId === 'new') {
      this.config.miners.push(this.editForm);
    } else {
      const index = this.config.miners.findIndex(m => m.id === this.editingMinerId);
      if (index > -1) {
        // Bestehende last_auto_mode beibehalten, falls das Formular sie nicht hat
        if (!this.editForm.last_auto_mode && this.config.miners[index].last_auto_mode) {
          this.editForm.last_auto_mode = this.config.miners[index].last_auto_mode;
        }
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
        const lastUpdate = stateObj.last_sensor_update || 0;
        const isStale = lastUpdate > 0 && (Date.now() / 1000 - lastUpdate > 300);
        return {
          id: entityId,
          name: stateObj.attributes?.friendly_name ? `${stateObj.attributes.friendly_name} (${entityId})` : entityId,
          isStale: isStale
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
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return "11, 196, 226";
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
    // MOVED TO updated() to prevent infinite loops during render
  }


  updated(changedProperties) {
    // Only update theme styles if config actually changed.
    // hass changes too frequently (on every state change in HA) to run this every time.
    if (changedProperties.has('config')) {
      this._applyThemeStyles();
      const theme = this.config?.theme || 'cyberpunk';
      if (this.getAttribute('theme') !== theme) {
        this.setAttribute('theme', theme);
      }
    }
  }

  render() {
    // DIAGNOSTIC RENDER
    // Diagnostic logging removed to improve performance during frequent state updates
    
    try {
      if (!this.config || (this.config.miners && this.config.miners.length === 0 && !this.hass)) {
        return html`
          <div style="height: 100vh; width: 100vw; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; color: #fff; position: fixed; top: 0; left: 0; z-index: 9999;">
             <div style="color: #0bc4e2; font-size: 2em; font-weight: bold; margin-bottom: 20px;">OpenKairo Mining</div>
             <ha-circular-progress active></ha-circular-progress>
             <div style="margin-top: 25px; font-size: 1.1em;">Initialisiere Dashboard...</div>
             <div style="margin-top: 10px; font-size: 0.8em; color: #555;">Warte auf Daten von Home Assistant</div>
          </div>
        `;
      }
      
      const theme = this.config.theme || 'cyberpunk';
      const walletSensor = this.config.wallet_btc_sensor;
      const walletState = (this.hass && this.hass.states && walletSensor && this.hass.states[walletSensor]) ? this.hass.states[walletSensor].state : '0.0000';
      const profileImg = this.config.profile_image || 'https://openkairo.de/wp-content/uploads/2024/01/openkairo-logo-icon.png';

      // Side-effects moved to updated() lifecycle method
      // this._applyThemeStyles();

      return html`
        ${this.config.background_animations_enabled !== false ? html`<div class="theme-bg-overlay"></div>` : ''}
        <div class="dashboard-container">
          <!-- Debug Info (hidden by default) -->
          <div style="display: none;">Render: ${this.activeTab} | Miners: ${this.config.miners?.length}</div>

          <!-- [NEW] Sponsoring Edition Header -->
          <div class="sponsoring-header" style="display: grid; grid-template-columns: 1.2fr 1fr 1.2fr; gap: 20px; padding: 25px 35px; background: linear-gradient(135deg, rgba(0,25,50,0.8) 0%, rgba(0,10,20,0.9) 100%); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; margin-bottom: 10px; position: relative; overflow: hidden;">
            
            <!-- Left: Portfolio -->
            <div class="header-left" style="display: flex; align-items: center; gap: 25px;">
              <div class="portfolio-avatar" style="position: relative; width: 85px; height: 85px;">
                <div style="width: 100%; height: 100%; border-radius: 50%; background: #000; border: 3px solid var(--theme-accent-1); box-shadow: 0 0 30px rgba(var(--theme-accent-1-rgb), 0.4); overflow: hidden; display: flex; align-items: center; justify-content: center;">
                  <img src="${profileImg}" 
                       @error="${(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }}"
                       style="width: 100%; height: 100%; object-fit: cover;">
                  <ha-icon icon="mdi:account" style="display: none; --mdc-icon-size: 40px; color: var(--theme-accent-1);"></ha-icon>
                </div>
                <div style="position: absolute; bottom: 5px; right: 5px; width: 18px; height: 18px; background: #00ff00; border: 3px solid #000; border-radius: 50%; box-shadow: 0 0 10px #00ff00;"></div>
              </div>
              <div class="portfolio-data">
                <div style="color: var(--theme-text-dim); font-size: 0.65em; text-transform: uppercase; letter-spacing: 3px; font-weight: 900; opacity: 0.7;">Gesamt-Portfolio</div>
                <div style="color: #fff; font-size: 2.5em; font-weight: 950; font-family: 'Space Mono', monospace; line-height: 1; display: flex; align-items: baseline; gap: 10px;">
                  ${walletState} <span style="font-size: 0.4em; color: var(--theme-accent-1); font-weight: 900; letter-spacing: 2px;">BTC</span>
                </div>
                <div style="color: var(--theme-accent-3); font-size: 1.1em; font-weight: 900; font-family: 'Space Mono', monospace; margin-top: 5px; opacity: 0.9;">
                  ≈ ${((parseFloat(walletState) || 0) * (this.btcPriceEur || 0)).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>
            </div>

            <!-- Center: Stats -->
            <div class="header-center" style="display: flex; align-items: center; justify-content: center; gap: 20px;">
              <div class="stats-box" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px 20px; border-radius: 15px; display: flex; align-items: center; gap: 15px;">
                <div class="halving-circle" style="width: 45px; height: 45px; border-radius: 50%; border: 3px solid #f39c12; display: flex; align-items: center; justify-content: center; font-size: 0.7em; font-weight: 900; color: #f39c12;">50%</div>
                <div>
                   <div style="font-size: 0.55em; color: #aaa; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800;">Halving</div>
                   <div style="font-size: 0.9em; font-weight: 900; color: #fff;">103.4k <span style="font-size: 0.7em; color: #666;">Blocks</span></div>
                </div>
              </div>
              <div class="stats-box" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px 20px; border-radius: 15px;">
                 <div style="font-size: 0.55em; color: #aaa; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; margin-bottom: 5px;">BTC Trend</div>
                 <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: #e74c3c; font-weight: 900; font-size: 0.9em;">↓ 0.5%</span>
                    <div style="width: 40px; height: 18px; background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 30%22><path d=%22M0,10 L20,15 L40,12 L60,25 L80,20 L100,28%22 fill=%22none%22 stroke=%22%23e74c3c%22 stroke-width=%223%22/></svg>'); background-size: contain; background-repeat: no-repeat; background-position: center;"></div>
                 </div>
              </div>
            </div>

            <!-- Right: Branding & Partner -->
            <div class="header-right" style="text-align: right; display: flex; flex-direction: column; justify-content: center; align-items: flex-end;">
              ${this.config.theme === 'gladbeck' ? html`
                <div style="position: absolute; top: 15px; right: 25px; opacity: 0.8;">
                  <div style="font-size: 0.5em; color: #888; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px;">Exklusiver Partner</div>
                  <img src="https://solarmodule-gladbeck.de/wp-content/uploads/2023/07/cropped-logo_new.png" style="height: 22px; filter: brightness(1.5);">
                </div>
              ` : ''}
              <div style="margin-top: 25px;">
                <h1 style="margin: 0; font-size: 2.2em; font-weight: 950; letter-spacing: -1px; display: flex; align-items: center; gap: 15px; color: #fff;">
                  <span style="color: var(--theme-accent-1); opacity: 0.4;">₿</span> OpenKairo <span style="color: var(--theme-accent-1);">Mining</span>
                </h1>
                <div style="display: flex; align-items: center; gap: 10px; justify-content: flex-end; margin-top: 5px;">
                  <span style="font-size: 0.6em; background: rgba(var(--theme-accent-1-rgb), 0.15); border: 1px solid rgba(var(--theme-accent-1-rgb), 0.3); border-radius: 4px; padding: 3px 12px; color: var(--theme-accent-1); font-weight: 950; letter-spacing: 2px;">PREMIUM v1.3</span>
                  <span style="color: #666; font-size: 0.65em; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;">Sponsoring Edition</span>
                </div>
              </div>
            </div>
          </div>

          <div class="tabs">
            <div class="tab ${this.activeTab === 'dashboard' ? 'active' : ''}" @click="${() => { this.activeTab = 'dashboard'; this.editingMinerId = null; }}">
              <ha-icon icon="mdi:view-dashboard-outline"></ha-icon> Dashboard
            </div>
            <div class="tab ${this.activeTab === 'statistics' ? 'active' : ''}" @click="${() => { this.activeTab = 'statistics'; this.editingMinerId = null; }}">
              <ha-icon icon="mdi:chart-timeline-variant"></ha-icon> Graphen
            </div>
            <div class="tab ${this.activeTab === 'design' ? 'active' : ''}" @click="${() => { this.activeTab = 'design'; this.editingMinerId = null; }}">
              <ha-icon icon="mdi:palette-outline"></ha-icon> Design
            </div>
            ${this.config.show_energy_tab ? html`
              <div class="tab ${this.activeTab === 'energy' ? 'active' : ''}" @click="${() => { this.activeTab = 'energy'; this.editingMinerId = null; }}">
                <ha-icon icon="mdi:lightning-bolt-outline"></ha-icon> Rentabilität
              </div>
            ` : ''}
            <div class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => { this.activeTab = 'settings'; this.editingMinerId = null; }}">
              <ha-icon icon="mdi:cog-outline"></ha-icon> Setup
            </div>
            <div class="tab ${this.activeTab === 'info' ? 'active' : ''}" @click="${() => { this.activeTab = 'info'; this.editingMinerId = null; }}">
              <ha-icon icon="mdi:help-circle-outline"></ha-icon> Hilfe
            </div>
            <div class="tab ${this.activeTab === 'logs' ? 'active' : ''}" @click="${() => { this.activeTab = 'logs'; this.editingMinerId = null; }}">
              <ha-icon icon="mdi:script-text-outline"></ha-icon> Logs
            </div>
          </div>

          ${this._renderTicker()}
          ${this.renderActivityTicker()}
          <button class="mobile-back-btn" @click="${() => {
            if (this.activeTab !== 'dashboard') {
              this.activeTab = 'dashboard';
              this.editingMinerId = null;
              window.scrollTo(0, 0);
            } else {
              window.history.back();
            }
          }}">
            <ha-icon icon="mdi:arrow-left" style="--mdc-icon-size: 18px;"></ha-icon>
            ${this.activeTab !== 'dashboard' ? 'Dashboard' : 'HA Menü'}
          </button>

          <div class="content">
        ${(() => {
          try {
            if (this.activeTab === 'dashboard') return html`
              <div class="tab-content-anim">
                ${this.renderDashboard()}
              </div>
            `;
            if (this.activeTab === 'statistics') return html`<div class="tab-content-anim">${this.renderStatistics()}</div>`;
            if (this.activeTab === 'energy') return html`<div class="tab-content-anim">${this.renderEnergyStats()}</div>`;
            if (this.activeTab === 'design') return html`<div class="tab-content-anim">${this.renderDesignSettings()}</div>`;
            if (this.activeTab === 'settings') return html`<div class="tab-content-anim">${this.renderSettings()}</div>`;
            if (this.activeTab === 'info') return html`<div class="tab-content-anim">${this.renderInfo()}</div>`;
            if (this.activeTab === 'logs') return html`<div class="tab-content-anim">${this.renderLogs()}</div>`;
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
    } catch (e) {
      console.error("Critical Render Error:", e);
      return html`
        <div style="height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1a1a1a; color: #fff; font-family: sans-serif; padding: 20px; text-align: center; border-radius: 20px; border: 2px solid #e74c3c; margin: 20px;">
          <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
          <h2 style="color: #e74c3c; margin: 0;">Anzeige-Fehler abgefangen</h2>
          <p style="max-width: 400px; line-height: 1.4; color: #aaa; font-size: 0.9em; margin: 15px 0;">
            Ein Rendering-Problem wurde erkannt. Um einen Absturz (Black Screen) zu verhindern, wurde das Dashboard vorübergehend angehalten.
          </p>
          <div style="margin-bottom: 20px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; font-family: monospace; font-size: 0.8em; color: #ff9800; max-width: 100%; word-break: break-all;">
            ${e.message}
          </div>
          <button @click="${() => window.location.reload()}" style="background: #e74c3c; border: none; color: #fff; padding: 10px 25px; border-radius: 30px; font-weight: bold; cursor: pointer;">
            Dashboard neu laden
          </button>
        </div>
      `;
    }
  }

  renderLogs() {
    if (!this.logs || this.logs.length === 0) {
      return html`
        <div class="card">
          <h2>📜 System Logs</h2>
          <div class="empty-state">Noch keine Logs vorhanden.</div>
        </div>
      `;
    }

    return html`
      <div class="card" style="padding: 25px;">
        <h2>📜 System Logs <span style="font-size: 0.5em; color: var(--theme-text-dim); margin-left: 10px;">Letzte ${this.logs.length} Einträge</span></h2>
        
        <div style="background: rgba(0,0,0,0.3); border-radius: var(--theme-radius); border: 1px solid var(--theme-border-color); overflow: hidden; max-height: 600px; display: flex; flex-direction: column;">
          <div style="overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 8px;">
            ${this.logs.map(log => {
              const match = log.match(/^\[(.*?)\] (.*)$/);
              let time = '';
              let msg = log;
              if (match) {
                time = match[1];
                msg = match[2];
              } else {
                // If regex fails (e.g. log added without time prefix), fallback
                msg = log;
              }

              let color = 'var(--theme-text-main)';
              let border = 'rgba(255,255,255,0.05)';
              let bg = 'rgba(255,255,255,0.02)';

              if (msg.includes('Watchdog') || msg.includes('ausgelöst') || msg.includes('Fehler')) {
                color = '#e74c3c';
                border = 'rgba(231, 76, 60, 0.3)';
                bg = 'rgba(231, 76, 60, 0.05)';
              } else if (msg.includes('eingeschaltet') || msg.includes('✅') || msg.includes('erfolgreich')) {
                color = 'var(--theme-accent-2)';
                border = 'rgba(var(--theme-accent-2-rgb), 0.3)';
                bg = 'rgba(var(--theme-accent-2-rgb), 0.05)';
              } else if (msg.includes('ausgeschaltet') || msg.includes('💤') || msg.includes('Stop')) {
                color = 'var(--theme-text-dim)';
              } else if (msg.includes('Soft-Start') || msg.includes('🎢') || msg.includes('Soft-Stop')) {
                color = 'var(--theme-primary)';
                border = 'rgba(var(--theme-primary-rgb), 0.3)';
                bg = 'rgba(var(--theme-primary-rgb), 0.05)';
              }

              return html`
                <div style="display: flex; gap: 15px; padding: 12px 15px; background: ${bg}; border-left: 3px solid ${border}; border-radius: 6px; font-family: monospace;">
                  ${time ? html`<span style="color: var(--theme-text-dim); font-size: 0.9em; white-space: nowrap; font-weight: bold;">[${time}]</span>` : ''}
                  <span style="color: ${color}; line-height: 1.4; font-size: 0.95em;">${msg}</span>
                </div>
              `;
            })}
          </div>
        </div>
      </div>
    `;
  }

  renderInfo() {
    const h2Style = 'display: flex; align-items: center; gap: 12px; margin: 0 0 18px 0; color: #fff; font-size: 1.2em; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;';
    const badgeStyle = (color) => `display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 0.8em; font-weight: 700; background: ${color}22; color: ${color}; border: 1px solid ${color}44; white-space: nowrap;`;
    const tipBox = (color, icon, text) => `<div style="display:flex;align-items:flex-start;gap:10px;background:${color}08;border-left:3px solid ${color};border-radius:0 8px 8px 0;padding:10px 14px;margin-top:12px;"><span style="font-size:1.2em;flex-shrink:0;">${icon}</span><span style="color:#bbb;font-size:0.88em;line-height:1.6;">${text}</span></div>`;

    return html`
      <div style="padding: 30px; max-width: 1060px; margin: 0 auto;">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 36px;">
          <div style="font-size: 2.8em; margin-bottom: 8px;">⛏️</div>
          <h1 style="margin: 0 0 6px 0; font-size: 1.7em; color: #fff;">OpenKairo Mining</h1>
          <div style="color: var(--theme-accent-1); font-size: 1em; font-weight: 600; margin-bottom: 10px;">Benutzerhandbuch — Version 1.4.6</div>
          <p style="color: #888; max-width: 560px; margin: 0 auto; line-height: 1.6; font-size: 0.95em;">
            Alles was du wissen musst, um deine Miner intelligent zu steuern.
          </p>
        </div>

        <!-- ═══ 1. WELCHEN MODUS WÄHLE ICH? ═══ -->
        <div class="tech-box" style="margin-top: 0;">
          <h2 style="${h2Style}"><span>🤖</span> Welchen Modus soll ich wählen?</h2>
          <p style="color:#bbb; font-size:0.9em; line-height:1.6; margin-bottom: 18px;">
            Den Automations-Modus wählst du im Miner-Formular unter <strong>Einstellungen → Miner bearbeiten</strong>.
            Jeder Miner kann seinen eigenen Modus haben.
          </p>

          <div style="display: flex; flex-direction: column; gap: 12px;">

            <div style="border-left: 4px solid #aaa; background: rgba(255,255,255,0.02); border-radius: 0 10px 10px 0; padding: 12px 16px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="${badgeStyle('#aaa')}">Manuell</span>
                <span style="font-weight: 700; color: #fff; font-size: 0.95em;">Immer laufen (manuell steuern)</span>
              </div>
              <p style="color: #888; margin: 0; font-size: 0.88em; line-height: 1.5;">
                Der Miner läuft, solange sein HA-Schalter eingeschaltet ist — du entscheidest selbst wann er an und aus geht.
                Gut zum Testen und für Miner, die dauerhaft laufen sollen.
              </p>
            </div>

            <div style="border-left: 4px solid var(--theme-accent-1); background: rgba(var(--theme-accent-1-rgb), 0.03); border-radius: 0 10px 10px 0; padding: 12px 16px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="${badgeStyle('var(--theme-accent-1)')}">PV-Überschuss</span>
                <span style="font-weight: 700; color: #fff; font-size: 0.95em;">Nur mit Solarstrom minen</span>
              </div>
              <p style="color: #888; margin: 0 0 6px 0; font-size: 0.88em; line-height: 1.5;">
                Du hast eine Solaranlage und willst den Überschuss zum Minen nutzen statt ihn einzuspeisen.
                Gib deinen PV-Sensor an (Watt-Einspeisung oder Überschuss-Sensor). Der Miner startet automatisch
                wenn genug Leistung vorhanden ist, und passt seine Leistung laufend an. Sinkt der Überschuss,
                fährt er runter — fällt er ganz weg, schaltet er sich aus.
              </p>
              <div style="font-size: 0.8em; color: #666;">Voraussetzung: PV-Sensor in Home Assistant · Optional: Batterie-Sensor für SOC-Sperre</div>
            </div>

            <div style="border-left: 4px solid #27ae60; background: rgba(39,174,96,0.03); border-radius: 0 10px 10px 0; padding: 12px 16px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="${badgeStyle('#27ae60')}">Batterie SOC</span>
                <span style="font-weight: 700; color: #fff; font-size: 0.95em;">Nur minen wenn Akku voll genug ist</span>
              </div>
              <p style="color: #888; margin: 0 0 6px 0; font-size: 0.88em; line-height: 1.5;">
                Du hast einen Heimspeicher und willst minen wenn er ausreichend geladen ist.
                Stelle ein <em>ab welchem Ladestand</em> der Miner startet (z.B. 80%) und <em>bis zu welchem</em> er läuft (z.B. 40%).
                Eine kleine Toleranz (Hysterese) verhindert, dass er ständig um den Schwellwert ein- und ausschaltet.
              </p>
              <div style="font-size: 0.8em; color: #666;">Voraussetzung: Batterie-Sensor (% Ladestand) in Home Assistant</div>
            </div>

            <div style="border-left: 4px solid #e67e22; background: rgba(230,126,34,0.03); border-radius: 0 10px 10px 0; padding: 12px 16px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="${badgeStyle('#e67e22')}">Heiz-Modus</span>
                <span style="font-weight: 700; color: #fff; font-size: 0.95em;">Mining als Heizung nutzen</span>
              </div>
              <p style="color: #888; margin: 0 0 6px 0; font-size: 0.88em; line-height: 1.5;">
                Dein Miner heizt einen Raum mit seiner Abwärme. Er läuft, wenn es zu kalt ist — und schaltet sich aus,
                sobald die Zieltemperatur erreicht ist. Gib einen Raumtemperatur-Sensor an und stelle die gewünschten
                Temperaturgrenzen ein (z.B. an bei 19°C, aus bei 21°C). Optional: Sperre aktivieren wenn der Akku zu leer ist.
              </p>
              <div style="font-size: 0.8em; color: #666;">Voraussetzung: Temperatur-Sensor in Home Assistant</div>
            </div>

            <div style="border-left: 4px solid #8e44ad; background: rgba(142,68,173,0.03); border-radius: 0 10px 10px 0; padding: 12px 16px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="${badgeStyle('#8e44ad')}">Offgrid</span>
                <span style="font-weight: 700; color: #fff; font-size: 0.95em;">Inselanlage / Netzunabhängig — Beta</span>
              </div>
              <p style="color: #888; margin: 0 0 6px 0; font-size: 0.88em; line-height: 1.5;">
                Für vollständig netzunabhängige Systeme. Die Miner-Leistung wird anhand einer SOC-Kurve berechnet:
                Je voller der Akku, desto mehr darf der Miner verbrauchen. Optional kann ein mittlerer Kurven-Punkt
                für eine nicht-lineare Steuerung gesetzt werden.
              </p>
              <div style="font-size: 0.8em; color: #666;">Voraussetzung: PV-Sensor + Batterie-Sensor · Beta-Funktion</div>
            </div>

            <div style="border-left: 4px solid #e74c3c; background: rgba(231,76,60,0.03); border-radius: 0 10px 10px 0; padding: 12px 16px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="${badgeStyle('#e74c3c')}">AI Akku-Optimierer</span>
                <span style="font-weight: 700; color: #fff; font-size: 0.95em;">Nachts minen mit Akkustrom — Beta</span>
              </div>
              <p style="color: #888; margin: 0 0 6px 0; font-size: 0.88em; line-height: 1.5;">
                Die Engine berechnet, wie viel Akkuenergie nach Abzug des Hausverbrauchs noch für's Mining übrig ist —
                und plant die Startzeit so, dass der Akku morgens früh genau auf dem gewünschten Restladestand ankommt.
                Optional: Wetter-Anbindung für Solar-Prognose am nächsten Tag.
              </p>
              <div style="font-size: 0.8em; color: #666;">Voraussetzung: Batterie-Sensor + Hausverbrauch-Sensor · Beta-Funktion</div>
            </div>

          </div>
        </div>

        <!-- ═══ 2. SOFT-START & LEISTUNGSSKALIERUNG ═══ -->
        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>🎢</span> Soft-Start, Soft-Stop &amp; automatische Leistungsanpassung</h2>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div style="background: rgba(255,152,0,0.04); border-radius: 10px; padding: 14px; border: 1px solid rgba(255,152,0,0.15);">
              <div style="font-weight: 700; color: #ff9800; margin-bottom: 8px;">🚀 Soft-Start</div>
              <p style="color: #888; font-size: 0.88em; line-height: 1.55; margin: 0;">
                Statt sofort auf volle Leistung zu springen, fährt der Miner stufenweise hoch — vom Mindestwert
                bis zur Maximalleistung. Schont das Netzteil und verhindert Spannungsspitzen im Hausnetz.
                Erkennbar am orangenen SOFT-UP-Badge im Dashboard.
              </p>
              <div style="margin-top: 10px; font-size: 0.8em; color: #666;">Aktivieren: Miner bearbeiten → "Soft-Start aktivieren"</div>
            </div>
            <div style="background: rgba(52,152,219,0.04); border-radius: 10px; padding: 14px; border: 1px solid rgba(52,152,219,0.15);">
              <div style="font-weight: 700; color: #3498db; margin-bottom: 8px;">🛬 Soft-Stop</div>
              <p style="color: #888; font-size: 0.88em; line-height: 1.55; margin: 0;">
                Beim Abschalten wird die Leistung erst auf den Mindestwert reduziert, bevor der Schalter ausgeht.
                Verhindert abrupte Laständerungen und verlängert die Lebensdauer der Hardware.
              </p>
              <div style="margin-top: 10px; font-size: 0.8em; color: #666;">Aktivieren: Miner bearbeiten → "Soft-Stop aktivieren"</div>
            </div>
            <div style="background: rgba(var(--theme-accent-1-rgb),0.04); border-radius: 10px; padding: 14px; border: 1px solid rgba(var(--theme-accent-1-rgb),0.15);">
              <div style="font-weight: 700; color: var(--theme-accent-1); margin-bottom: 8px;">⚖️ Automatische Nachskalierung</div>
              <p style="color: #888; font-size: 0.88em; line-height: 1.55; margin: 0;">
                Im PV-Modus passt die Engine die Leistung alle 15 Sekunden an den aktuellen Solarüberschuss an.
                Zwei Methoden: <strong>Stufen</strong> (sanfte Schritte, gut für schwankende Anlagen) oder
                <strong>Proportional</strong> (direkte 1:1-Anpassung, reagiert schneller).
              </p>
              <div style="margin-top: 10px; font-size: 0.8em; color: #666;">Aktivieren: Miner bearbeiten → "Automatische Nachskalierung" + Skalierungs-Modus wählen</div>
            </div>
          </div>

          <div style="${tipBox('#ff9800', '💡', 'Min. Leistung und Max. Leistung definieren den erlaubten Bereich. Liegt der PV-Überschuss unter der Mindestleistung, schaltet der Miner komplett aus statt auf einem nicht-sinnvollen Niedrigstwert zu laufen.')}"></div>
        </div>

        <!-- ═══ 3. SICHERHEITSFUNKTIONEN ═══ -->
        <!-- ═══ 4. STANDBY-WÄCHTER ═══ -->
        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>🔒</span> Standby-Wächter — automatischer Neustart bei Hängern</h2>
          <p style="color:#bbb; font-size:0.9em; line-height:1.6; margin-bottom: 16px;">
            Miner können sich aufhängen: der Schalter ist an, aber es kommt keine Hashrate.
            Der Standby-Wächter erkennt das und greift automatisch ein.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 16px;">
            <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-weight: 700; color: #fff; margin-bottom: 6px; font-size: 0.9em;">1. Wächter aktivieren</div>
              <div style="color: #888; font-size: 0.85em; line-height: 1.5;">Im Miner-Formular die Option "Standby-Wächter aktivieren" einschalten.</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-weight: 700; color: #fff; margin-bottom: 6px; font-size: 0.9em;">2. Überwachungstyp wählen</div>
              <div style="color: #888; font-size: 0.85em; line-height: 1.5;"><strong style="color:#aaa;">Verbrauch:</strong> Wächter prüft den Watt-Sensor. Wenn er dauerhaft zu niedrig ist, liegt ein Hänger vor.<br><strong style="color:#aaa;">Limit:</strong> Wächter prüft ob das Power-Limit gesetzt ist aber kein Verbrauch stattfindet.</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-weight: 700; color: #fff; margin-bottom: 6px; font-size: 0.9em;">3. Wartezeit einstellen</div>
              <div style="color: #888; font-size: 0.85em; line-height: 1.5;">Wie lange soll der Wächter warten bevor er eingreift? (Standard: 10 Minuten). Im Dashboard siehst du einen orangenen Countdown.</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-weight: 700; color: #fff; margin-bottom: 6px; font-size: 0.9em;">4. Aktion wählen</div>
              <div style="color: #888; font-size: 0.85em; line-height: 1.5;"><strong style="color:#aaa;">Toggle:</strong> Schalter kurz aus und wieder an (einfachste Option).<br><strong style="color:#aaa;">Reboot:</strong> Hardware-Neustart via pyasic.<br><strong style="color:#aaa;">Backend-Neustart:</strong> Nur den Mining-Prozess neu starten (schonender).</div>
            </div>
          </div>

          <div style="${tipBox('#3498db', '⏱️', 'Stelle unter "Mindest-Anlaufzeit" ein, wie lange der Miner braucht bis er hashrat (z.B. 5 Minuten für Antminer). Der Countdown startet erst danach — so wird ein normaler Boot-Vorgang nicht als Hänger erkannt.')}"></div>
        </div>

        <!-- ═══ 5. MEHRERE MINER & FLEET-BUDGET ═══ -->
        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>🏭</span> Mehrere Miner &amp; Fleet Power Budget</h2>
          <p style="color:#bbb; font-size:0.9em; line-height:1.6;">
            Du kannst beliebig viele Miner hinzufügen. Jeder läuft mit seinem eigenen Modus unabhängig.
            Das <strong>Fleet Power Budget</strong> setzt eine gemeinsame Obergrenze für alle Miner zusammen.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-top: 14px;">
            <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-weight: 700; color: var(--theme-accent-1); margin-bottom: 6px; font-size: 0.9em;">Gesamt-Leistungslimit</div>
              <div style="color: #888; font-size: 0.85em; line-height: 1.5;">Unter <strong>Einstellungen → Globale Optionen</strong> kannst du eine maximale Gesamtleistung (Watt) für alle Miner festlegen. 0 = kein Limit.</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-weight: 700; color: var(--theme-accent-1); margin-bottom: 6px; font-size: 0.9em;">Priorität</div>
              <div style="color: #888; font-size: 0.85em; line-height: 1.5;">Jeder Miner hat eine Priorität (0–100). Wenn das Budget knapp wird, werden niedrig priorisierte Miner zuerst gedrosselt oder gestoppt. Setze wichtige Miner auf einen höheren Wert.</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-weight: 700; color: var(--theme-accent-1); margin-bottom: 6px; font-size: 0.9em;">Fleet-Übersicht</div>
              <div style="color: #888; font-size: 0.85em; line-height: 1.5;">Oben im Dashboard werden Gesamt-Hashrate, Gesamt-Leistung, Anzahl laufender Miner und dein Budget auf einen Blick angezeigt.</div>
            </div>
          </div>
        </div>

        <!-- ═══ 6. STATISTIKEN ═══ -->
        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>📊</span> Statistiken &amp; Energie-Tracking</h2>
          <p style="color:#bbb; font-size:0.9em; line-height:1.6; margin-bottom: 16px;">
            Die Engine trackt automatisch Laufzeit und Energieverbrauch pro Miner — vollständig integriert in Home Assistant.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
            <div style="text-align: center; background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-size: 1.6em; margin-bottom: 6px;">⏱️</div>
              <div style="font-weight: 700; color: #fff; font-size: 0.9em; margin-bottom: 4px;">Session-Laufzeit</div>
              <div style="color: #888; font-size: 0.82em;">Stunden seit dem letzten Einschalten. Wird bei Abschalten auf 0 zurückgesetzt.</div>
            </div>
            <div style="text-align: center; background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-size: 1.6em; margin-bottom: 6px;">📅</div>
              <div style="font-weight: 700; color: #fff; font-size: 0.9em; margin-bottom: 4px;">Heute-Laufzeit</div>
              <div style="color: #888; font-size: 0.82em;">Kumulative Betriebsstunden heute. Automatischer Reset um Mitternacht.</div>
            </div>
            <div style="text-align: center; background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-size: 1.6em; margin-bottom: 6px;">⚡</div>
              <div style="font-weight: 700; color: #fff; font-size: 0.9em; margin-bottom: 4px;">Energie (Wh)</div>
              <div style="color: #888; font-size: 0.82em;">Verbrauch der Session und des Tages in Wattstunden. Kompatibel mit der HA Energie-Karte.</div>
            </div>
            <div style="text-align: center; background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px;">
              <div style="font-size: 1.6em; margin-bottom: 6px;">🔢</div>
              <div style="font-weight: 700; color: #fff; font-size: 0.9em; margin-bottom: 4px;">Start-Zähler</div>
              <div style="color: #888; font-size: 0.82em;">Wie oft wurde der Miner in dieser Session gestartet? Nützlich zur Watchdog-Analyse.</div>
            </div>
          </div>

          <div style="${tipBox('#27ae60', '🏠', 'Die Statistiken werden als <strong>HA-Entitäten</strong> unter deinem Miner angelegt (Kategorie: Diagnose). Du kannst sie direkt in HA-Dashboards, Energie-Karte und Automationen verwenden.')}"></div>
          <div style="${tipBox('#3498db', '🔄', 'Session-Statistiken zurücksetzen: HA-Service <strong>openkairo_mining.reset_session_stats</strong> aufrufen (Entwicklerwerkzeuge → Dienste). Oder im Dashboard den Reset-Button beim Miner nutzen.')}"></div>
        </div>

        <!-- ═══ 7. MQTT ═══ -->
        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>📡</span> MQTT — Daten nach außen übertragen</h2>
          <p style="color:#bbb; font-size:0.9em; line-height:1.6;">
            OpenKairo kann alle Miner-Zustände in Echtzeit an einen MQTT-Broker schicken — nützlich für
            externes Monitoring, Node-RED Automationen, Grafana oder andere Systeme.
          </p>
          <div style="${tipBox('#9b59b6', '⚙️', 'MQTT einrichten: Unter <strong>Einstellungen → Globale Optionen</strong> ein Topic-Präfix eintragen (z.B. <strong>haus/miner</strong>). Die Engine veröffentlicht dann unter <em>haus/miner/{miner-name}/state</em> den aktuellen Zustand als JSON. Voraussetzung: HA MQTT-Broker ist aktiv (Einstellungen → Integrationen → MQTT).')}"></div>
        </div>

        <!-- ═══ 8. STATUS-BADGES ═══ -->
        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>🚦</span> Was bedeuten die Status-Anzeigen?</h2>
          <div style="display: flex; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 10px 16px; border-radius: 10px; flex: 1; min-width: 200px;">
              <span style="${badgeStyle('#27ae60')}">MINING</span>
              <span style="color: #888; font-size: 0.88em;">Miner läuft und schürft aktiv.</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 10px 16px; border-radius: 10px; flex: 1; min-width: 200px;">
              <span style="${badgeStyle('#3498db')}">STANDBY</span>
              <span style="color: #888; font-size: 0.88em;">Eingeschaltet, aber noch keine Hashrate (Hochfahren).</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 10px 16px; border-radius: 10px; flex: 1; min-width: 200px;">
              <span style="${badgeStyle('#ff9800')}">SOFT-UP</span>
              <span style="color: #888; font-size: 0.88em;">Leistung wird gerade schrittweise hochgefahren.</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 10px 16px; border-radius: 10px; flex: 1; min-width: 200px;">
              <span style="${badgeStyle('#e67e22')}">SOFT-DN</span>
              <span style="color: #888; font-size: 0.88em;">Leistung wird sanft heruntergefahren vor dem Ausschalten.</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 10px 16px; border-radius: 10px; flex: 1; min-width: 200px;">
              <span style="${badgeStyle('#e74c3c')}">TEMP-ALARM</span>
              <span style="color: #888; font-size: 0.88em;">Notabschaltung wegen Überhitzung. Kühlt automatisch ab.</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 10px 16px; border-radius: 10px; flex: 1; min-width: 200px;">
              <span style="${badgeStyle('#666')}">AUS</span>
              <span style="color: #888; font-size: 0.88em;">Miner ist ausgeschaltet.</span>
            </div>
          </div>
        </div>

        <!-- ═══ 9. SUPPORT ═══ -->
        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>💾</span> Konfiguration sichern &amp; wiederherstellen</h2>
          <p style="color:#bbb; font-size:0.9em; line-height:1.7; margin-bottom:16px;">
            OpenKairo speichert alle Miner-Einstellungen in der HA-Konfiguration. Mit dem integrierten Backup-System kannst du alles mit einem Klick sichern — und nach einem Neuaufbau oder Umzug sofort wiederherstellen.
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px;">
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:16px;">
              <div style="font-weight:700; color:#2196f3; margin-bottom:8px;">⬇️ Vollständiges Backup exportieren</div>
              <div style="color:#aaa; font-size:0.85em; line-height:1.6;">Speichert <strong>alle Miner</strong> inklusive aller Einstellungen als <code>openkairo_config_YYYY-MM-DD.json</code>.<br><br>Zu finden unter: <strong>Einstellungen → ⬇️ Backup exportieren</strong></div>
            </div>
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:16px;">
              <div style="font-weight:700; color:#4caf50; margin-bottom:8px;">⬆️ Backup wiederherstellen</div>
              <div style="color:#aaa; font-size:0.85em; line-height:1.6;">Lädt eine exportierte Backup-Datei und <strong>ersetzt die gesamte Konfiguration</strong>. Nach dem Import werden alle Miner-Karten sofort aktualisiert.<br><br>Zu finden unter: <strong>Einstellungen → ⬆️ Backup importieren</strong></div>
            </div>
          </div>
          <div style="${tipBox('#2196f3', '⚠️', 'Beim Import wird die komplette bestehende Konfiguration ersetzt. Das System fragt vorher zur Bestätigung. Erstelle immer zuerst ein Export-Backup bevor du einen Import durchführst.')}"></div>
        </div>

        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>📋</span> Miner-Vorlagen — Einstellungen teilen &amp; übernehmen</h2>
          <p style="color:#bbb; font-size:0.9em; line-height:1.7; margin-bottom:16px;">
            Hast du einen Miner perfekt konfiguriert und möchtest dieselben Regel-Einstellungen auf einen zweiten Miner übertragen? Oder die Community mit deiner bewährten Konfiguration versorgen? Miner-Vorlagen machen genau das — ohne gerätespezifische Daten (Name, IP, Switch, Sensoren) zu übernehmen.
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-top:16px;">
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:14px;">
              <div style="font-weight:700; color:#ff9800; margin-bottom:8px;">📋 Vorlage exportieren</div>
              <div style="color:#aaa; font-size:0.83em; line-height:1.6;">Klick auf das <strong>📋</strong> Symbol neben einem Miner in der Dashboard-Liste. Lädt <code>openkairo_template_Name.json</code> — enthält nur Regel-Einstellungen, keine Gerätedaten.</div>
            </div>
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:14px;">
              <div style="font-weight:700; color:#9c27b0; margin-bottom:8px;">📂 Vorlage laden</div>
              <div style="color:#aaa; font-size:0.83em; line-height:1.6;">Im Miner bearbeiten-Dialog: <strong>📂 Vorlage laden</strong>. Wähle eine JSON-Vorlage (eigene oder aus der Community). Nur Regel-Felder werden übernommen — dein Gerät bleibt unberührt.</div>
            </div>
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:14px;">
              <div style="font-weight:700; color:#00bcd4; margin-bottom:8px;">🔄 Einstellungen übernehmen von</div>
              <div style="color:#aaa; font-size:0.83em; line-height:1.6;">Im Miner bearbeiten-Dialog: Dropdown <strong>"Einstellungen übernehmen von"</strong>. Wähle einen anderen Miner aus der selben Installation — perfekt für schnelles Klonen.</div>
            </div>
          </div>
          <div style="${tipBox('#ff9800', '🌍', 'Vorlagen sind ideal zum Community-Sharing! Sie enthalten einen <code>_type: "openkairo_miner_template"</code> Marker und den Miner-Typ (<code>_miner_model</code>) damit andere wissen für welches Gerät die Vorlage gemacht wurde. Teile deine Vorlagen auf GitHub oder Discord.')}"></div>
        </div>

        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>🛡️</span> Watchdog Status-Badge</h2>
          <p style="color:#bbb; font-size:0.9em; line-height:1.7; margin-bottom:16px;">
            Wenn der Standby-Wächter aktiviert ist, zeigt die Miner-Karte einen Status-Badge direkt unterhalb der "Letzte Entscheidung" Zeile — so weißt du sofort was der Watchdog gerade tut.
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px;">
            <div style="background:rgba(255,152,0,0.08); border:1px solid rgba(255,152,0,0.25); border-radius:12px; padding:16px;">
              <div style="font-weight:700; color:#ff9800; margin-bottom:8px;">🟡 Watchdog Countdown: noch X min</div>
              <div style="color:#aaa; font-size:0.85em; line-height:1.6;">Der Miner läuft, aber Verbrauch oder Power-Limit liegt unter dem Schwellenwert. Wenn der Countdown abläuft, feuert der Watchdog die konfigurierte Aktion (Neustart oder Ausschalten).</div>
            </div>
            <div style="background:rgba(150,150,150,0.06); border:1px solid rgba(150,150,150,0.2); border-radius:12px; padding:16px;">
              <div style="font-weight:700; color:#aaa; margin-bottom:8px;">⬜ Watchdog Cooldown: noch X min</div>
              <div style="color:#aaa; font-size:0.85em; line-height:1.6;">Eine Watchdog-Aktion wurde bereits ausgelöst. Der nächste Countdown startet erst wenn der Cooldown vorbei ist — damit der Miner nach einem Neustart genug Zeit zum Hochfahren hat.</div>
            </div>
          </div>
          <div style="${tipBox('#3498db', '💡', 'Kein Badge sichtbar? Dann läuft alles normal — kein Countdown, kein Cooldown aktiv. Der Badge erscheint nur wenn der Watchdog für diesen Miner aktiviert ist und gerade etwas zu melden hat.')}"></div>
        </div>

        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>🔄</span> State-Persistenz — Statistiken überleben HA-Neustart</h2>
          <p style="color:#bbb; font-size:0.9em; line-height:1.7; margin-bottom:16px;">
            Früher lag der komplette Engine-Zustand nur im RAM. Nach jedem HA-Neustart waren Tagesstatistiken, Watchdog-Cooldown-Schutz und Min-Pause-Tracking verloren. Ab v1.4.5 speichert die Engine relevante Zustandsfelder automatisch und stellt sie nach dem Neustart wieder her.
          </p>
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:16px; margin-top:8px;">
            <div style="font-weight:700; color:#fff; margin-bottom:12px;">Was wird gespeichert?</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div style="color:#aaa; font-size:0.85em;">✅ <code>today_runtime_s</code> / <code>today_energy_wh</code><br><span style="color:#666; font-size:0.9em;">Tagesstatistiken bleiben korrekt</span></div>
              <div style="color:#aaa; font-size:0.85em;">✅ <code>total_starts</code><br><span style="color:#666; font-size:0.9em;">Gesamtzähler geht nicht verloren</span></div>
              <div style="color:#aaa; font-size:0.85em;">✅ <code>watchdog_last_action</code><br><span style="color:#666; font-size:0.9em;">Cooldown-Schutz bleibt nach Neustart aktiv</span></div>
              <div style="color:#aaa; font-size:0.85em;">✅ <code>off_since_actual</code> / <code>on_since_actual</code><br><span style="color:#666; font-size:0.9em;">Min-Pause und Max-Laufzeit korrekt</span></div>
            </div>
          </div>
          <div style="${tipBox('#27ae60', '💾', 'Der Zustand wird alle ~5 Minuten und beim sauberen HA-Shutdown automatisch in <code>.storage/openkairo_mining_state.json</code> gespeichert. Session-Werte (seit letztem Start) setzen bei Neustart bewusst zurück — das ist gewollt.')}"></div>
        </div>

        <div class="tech-box" style="margin-top: 24px;">
          <h2 style="${h2Style}"><span>📋</span> Versionslog</h2>

          <div style="display: flex; flex-direction: column; gap: 12px;">

            <div style="border-left: 4px solid var(--theme-accent-1); background: rgba(255,255,255,0.02); border-radius: 0 10px 10px 0; padding: 14px 16px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <span style="${badgeStyle('var(--theme-accent-1)')}">v1.4.6</span>
                <span style="font-weight: 700; color: #fff; font-size: 0.95em;">Stabilitäts-Update — Engine &amp; Config</span>
              </div>
              <ul style="color: #aaa; font-size: 0.88em; line-height: 1.7; margin: 0; padding-left: 18px;">
                <li><strong style="color:#fff;">Unavailable-Switch-Schutz:</strong> Wenn ein Schalter (z.B. Zigbee-Plug) kurz ausfällt und auf "unavailable" geht, schickt die Engine keine turn_on-Befehle mehr — verhindert Log-Spam und falsch hochgezählte Starts. Sobald der Switch wieder verfügbar ist, greift der normale 90s-Cooldown.</li>
                <li><strong style="color:#fff;">Race-Condition bei Mehrminer-Setup behoben:</strong> Bei gleichzeitigem HA-Start mehrerer Miner-Entries konnten Config-Schreibvorgänge sich gegenseitig überschreiben. Ein Domain-weiter Lock serialisiert jetzt alle <code>sync_with_config</code>-Läufe.</li>
                <li><strong style="color:#fff;">Fehlerbehandlung in sync_with_config:</strong> Unerwartete Fehler beim automatischen Eintragen neuer Miner werden jetzt geloggt statt als unhandled Task Exception zu verschwinden.</li>
                <li><strong style="color:#fff;">Switch-Entity ohne API-Calls:</strong> Der OpenKairo-Schalter führt keine Miner-API-Aufrufe mehr durch — kein Hashboard-Reset durch den Engine-Loop.</li>
                <li><strong style="color:#fff;">battery_hysteresis entfernt:</strong> Der versteckte SOC-Puffer ist raus — der eingestellte Schwellenwert wird direkt verwendet.</li>
                <li><strong style="color:#fff;">Sicherheit &amp; Grenzen-Panel entfernt:</strong> Vereinfachte Oberfläche — max_temp, max_runtime und min_off_time wurden entfernt.</li>
              </ul>
            </div>

            <div style="border-left: 4px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.01); border-radius: 0 10px 10px 0; padding: 14px 16px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <span style="${badgeStyle('#888')}">v1.4.5</span>
                <span style="font-weight: 700; color: #aaa; font-size: 0.95em;">State-Persistenz &amp; Watchdog</span>
              </div>
              <ul style="color: #666; font-size: 0.88em; line-height: 1.7; margin: 0; padding-left: 18px;">
                <li>Engine-Zustand überlebt HA-Neustart (Tagesstatistiken, Watchdog-Cooldown, Min-Pause-Tracking)</li>
                <li>Standby-Watchdog mit konfigurierbarer Aktion</li>
                <li>Entity-Registry-Lookup in sync_with_config statt statisch generierter Entity-IDs</li>
              </ul>
            </div>

          </div>
        </div>

        <div class="tech-box" style="margin-top: 24px; border-color: rgba(var(--theme-accent-1-rgb), 0.2); background: rgba(0,0,0,0.1); border-radius: 20px; padding: 30px;">
          <h2 style="margin-top:0; color:#fff; text-align: center; margin-bottom: 28px;">☕ Projekt unterstützen</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div style="font-size: 2.5em; margin-bottom: 15px;">🚀</div>
              <h3 style="margin: 0 0 10px 0; color: #fff;">PayPal</h3>
              <p style="color: #888; font-size: 0.9em; margin-bottom: 20px;">Die klassische Unterstützung für Kaffee & Energie.</p>
              <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=info@low-streaming.de&currency_code=EUR&source=url" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none; width:100%; padding: 12px 0; border-radius:30px; font-weight: 800; font-size: 0.9em;">
                Spenden via PayPal
              </a>
            </div>
            <div style="background: rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.03); border: 1px solid rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.1); border-radius: 16px; padding: 25px; text-align: center; display: flex; flex-direction: column; align-items: center;">
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
                    const ta = document.createElement('textarea'); ta.value = addr;
                    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
                    document.body.removeChild(ta);
                    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message: 'BTC Adresse kopiert!' }, bubbles: true, composed: true }));
                  });
                } else {
                  const ta = document.createElement('textarea'); ta.value = addr;
                  document.body.appendChild(ta); ta.select(); document.execCommand('copy');
                  document.body.removeChild(ta);
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
    let val = stateObj.state;
    
    // Automatisch auf 1 Nachkommastelle runden, wenn es eine Zahl ist
    if (!isNaN(parseFloat(val)) && isFinite(val) && val.toString().includes('.')) {
      val = parseFloat(val).toFixed(1);
    }
    
    const u = unit || stateObj.attributes?.unit_of_measurement || '';
    return val + (u ? ' ' + u : '');
  }

  renderDashboard() {
    if (!this.hass) {
      return html`
        <div class="card" style="text-align: center; padding: 40px;">
          <ha-circular-progress active></ha-circular-progress>
          <p style="margin-top: 15px; color: #888;">Verbinde mit Home Assistant...</p>
        </div>
      `;
    }

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
      'soc': 'Batterie SOC',
      'offgrid': 'Offgrid PV (SOC Kurve) (Beta)',
      'heating': 'Heiz-Modus',
      'ai_discharge': 'AI Akku-Optimierer (Beta)'
    };

    // --- OVERVIEW AGGREGATION ---
    let totalHashrateTH = 0;
    let totalPowerW = 0;
    let totalDailyRevBTC = 0;
    let totalDailyRevKAS = 0;
    let activeMiners = 0;
    let anyBtcPrice = this.btcPriceEur || 0;
    let anyKasPrice = this.kasPriceEur || 0;
    let totalMinersOnline = 0;

    this.config.miners.forEach(miner => {
        try {
            const domain = 'openkairo_mining';
            const _ipForSlug = miner.miner_ip || (miner.switch && miner.switch.includes('.') ? miner.switch : '');
            const _ipSlug = _ipForSlug ? _ipForSlug.replace(/\./g, '_') : '';

            // Switch State
            let effectiveSwitch = miner.switch;
            if (!effectiveSwitch && _ipSlug) {
                effectiveSwitch = `switch.${domain}_${_ipSlug}_switch`;
            }
            let switchState = 'off';
            if (this.hass?.states[effectiveSwitch]) {
              switchState = this.hass.states[effectiveSwitch].state;
            }
            if (switchState === 'on') activeMiners++;

            // Power
            let pSensor = miner.power_consumption_sensor || (_ipSlug ? `sensor.${domain}_${_ipSlug}_power` : '');
            if (this.hass?.states[pSensor]) {
               const watts = parseFloat(this.hass.states[pSensor].state) || 0;
               if (watts > 0 && switchState === 'on') totalPowerW += watts;
            }

            // Hashrate
            let hSensor = miner.hashrate_sensor || (_ipSlug ? `sensor.${domain}_${_ipSlug}_hashrate` : '');
            let hrInTH = 0;
            if (this.hass?.states[hSensor]) {
                const hrState = this.hass.states[hSensor];
                const hrValue = parseFloat(hrState.state) || 0;
                const unit = (hrState.attributes?.unit_of_measurement || 'TH/S').toUpperCase();
                
                if (unit.includes('PH')) hrInTH = hrValue * 1000;
                else if (unit.includes('TH')) hrInTH = hrValue;
                else if (unit.includes('GH')) hrInTH = hrValue / 1000;
                else if (unit.includes('MH')) hrInTH = hrValue / 1000000;
                else if (unit.includes('KH')) hrInTH = hrValue / 1000000000;
                else hrInTH = hrValue / 1000000000000; // Raw H/s
                
                if (hrInTH > 0 && switchState === 'on') {
                    totalHashrateTH += hrInTH;
                    totalMinersOnline++;
                }
            }

            // Multi-Coin Earnings (BTC or KAS)
            const currentDifficulty = this.btcDifficulty || 82000000000000;
            const miningCoin = miner.mining_coin || 'BTC';
            
            if (miningCoin === 'BTC') {
                let btcPerDay = 0;
                if (miner.calc_method === 'btc_auto' && hrInTH > 0 && switchState === 'on') {
                    btcPerDay = (hrInTH * 1e12 / (currentDifficulty * Math.pow(2, 32))) * 86400 * 3.125;
                } else if (miner.crypto_revenue_sensor && this.hass?.states[miner.crypto_revenue_sensor] && switchState === 'on') {
                    btcPerDay = parseFloat(this.hass.states[miner.crypto_revenue_sensor].state) || 0;
                } else if (hrInTH > 0 && switchState === 'on') {
                    btcPerDay = (hrInTH * 1e12 / (currentDifficulty * Math.pow(2, 32))) * 86400 * 3.125;
                }
                if (!miner.is_solo) {
                    totalDailyRevBTC += btcPerDay;
                }
            } else if (miningCoin === 'KAS') {
                let kasPerDay = 0;
                const netHR_TH = parseFloat(this.kasNetworkHashrate || 0); // Already normalized to TH/s
                if (hrInTH > 0 && switchState === 'on' && netHR_TH > 0) {
                    kasPerDay = (hrInTH / netHR_TH) * 86400 * (parseFloat(this.kasReward) || 0);
                } else if (miner.crypto_revenue_sensor && this.hass?.states[miner.crypto_revenue_sensor] && switchState === 'on') {
                    kasPerDay = parseFloat(this.hass.states[miner.crypto_revenue_sensor].state) || 0;
                }
                if (!miner.is_solo) {
                    totalDailyRevKAS += kasPerDay;
                }
            }
        } catch (e) {
            console.error("Aggregation Error for Miner:", miner.id, e);
        }
    });

    const totalEuroRev = (totalDailyRevBTC * anyBtcPrice) + (totalDailyRevKAS * anyKasPrice);
    const totalDailyKwh = (totalPowerW / 1000) * 24;
    
    // Efficiency baseline (Euro per kWh)
    const euroPerKwh = totalDailyKwh > 0 ? totalEuroRev / totalDailyKwh : 0;

    const btcPerKwh = totalDailyKwh > 0 ? totalDailyRevBTC / totalDailyKwh : 0;
    const satsPerKwh = btcPerKwh * 100000000;

    const housePower = this.config.house_power_sensor ? parseFloat(this.hass?.states[this.config.house_power_sensor]?.state || 0) : 0;
    const batteryPower = this.config.battery_power_sensor ? parseFloat(this.hass?.states[this.config.battery_power_sensor]?.state || 0) : 0;
    const overviewHtml = html`
      <div class="overview-cards-grid">
          <!-- Card 1: Hashrate -->
          <div class="stat-card" style="border-left: 5px solid var(--theme-accent-1);">
            <div class="card-header-row">
               <div class="lbl" style="color: var(--theme-accent-1);">Gesamt-Hashrate</div>
               <div class="badge" style="background: rgba(var(--theme-accent-1-rgb), 0.1); color: var(--theme-accent-1); border: 1px solid rgba(var(--theme-accent-1-rgb), 0.3);">Online: ${totalMinersOnline}/${this.config.miners.length}</div>
            </div>
            <div class="stat-val">${totalHashrateTH.toFixed(2)}</div>
            <div class="unit">TH/s</div>
          </div>

          <!-- Card 2: Revenue -->
          <div class="stat-card" style="border-left: 5px solid #f39c12;">
            <div class="card-header-row">
               <div class="lbl" style="color: #f39c12;">Erw. Tagesertrag</div>
               <div class="badge" style="background: rgba(243, 156, 18, 0.1); color: #f39c12; border: 1px solid rgba(243, 156, 18, 0.3);">Pool-Schätzung</div>
            </div>
            <div class="stat-val">${totalEuroRev.toFixed(2)}</div>
            <div class="sub-row">
               <div class="sub-val">≈ ${totalDailyRevBTC.toFixed(6)} BTC</div>
               <div class="unit">€</div>
            </div>
          </div>

          <!-- Card 3: Efficiency -->
          <div class="stat-card" style="border-left: 5px solid #fff;">
            <div class="card-header-row">
               <div class="lbl" style="color: #fff;">Effizienz</div>
               <div class="badge" style="background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255, 255, 255, 0.3);">Netzwerk-Ø</div>
            </div>
            <div class="stat-val">${(totalPowerW / (totalHashrateTH || 1)).toFixed(1)}</div>
            <div class="sub-row">
               <div class="sub-val">${euroPerKwh.toFixed(2)} €/kWh</div>
               <div class="unit">J/TH</div>
            </div>
          </div>

          <!-- Card 4: Total Power + Fleet Budget -->
          <div class="stat-card" style="border-left: 5px solid var(--theme-accent-4);">
            <div class="card-header-row">
               <div class="lbl" style="color: var(--theme-accent-4);">Gesamtverbrauch</div>
               <div class="badge" style="background: rgba(var(--theme-accent-4-rgb), 0.1); color: var(--theme-accent-4); border: 1px solid rgba(var(--theme-accent-4-rgb), 0.3);">
                 ${this.fleet && this.fleet.miners_mining !== undefined ? `${this.fleet.miners_mining} Mining` : 'Live'}
               </div>
            </div>
            <div class="stat-val">${(totalPowerW / 1000).toFixed(2)}</div>
            <div class="unit">kW</div>
            ${this.fleet && this.fleet.budget_w ? (() => {
              const pct = Math.min(100, Math.round((this.fleet.total_power_w / this.fleet.budget_w) * 100));
              const color = pct > 90 ? '#e74c3c' : pct > 70 ? '#f39c12' : 'var(--theme-accent-4)';
              return html`
                <div style="margin-top: 8px;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.6em; color: rgba(255,255,255,0.4); margin-bottom: 3px;">
                    <span>Fleet Budget</span><span style="color:${color}">${pct}%</span>
                  </div>
                  <div style="height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 2px; transition: width 0.5s;"></div>
                  </div>
                  <div style="font-size: 0.55em; color: rgba(255,255,255,0.3); margin-top: 2px;">${Math.round(this.fleet.total_power_w)}W / ${this.fleet.budget_w}W</div>
                </div>
              `;
            })() : ''}
          </div>
      </div>
    `;

    return html`
      <div class="dashboard-wrapper" style="display: flex; flex-direction: column; width: 100%; gap: 20px; padding-top: 20px;">
        ${overviewHtml}

        ${totalPowerW > 0 ? html`
          <div class="energy-flow-container" style="height: 40px; margin-top: 10px; display: flex; justify-content: center; overflow: hidden;">
             <svg width="100%" height="40" preserveAspectRatio="none" viewBox="0 0 1000 40">
               <path class="energy-flow-line" d="M 0 20 Q 250 0, 500 20 T 1000 20" 
                     fill="none" stroke="var(--theme-accent-1)" stroke-width="2" opacity="0.3" />
               <path class="energy-flow-line" d="M 0 20 Q 250 40, 500 20 T 1000 20" 
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
                if (this.hass?.states[p1]) effectiveSwitch = p1;
                else if (this.hass?.states[p2]) effectiveSwitch = p2;
                else effectiveSwitch = p1; // Fallback
            }

            let switchState = 'Unbekannt';
            if (this.hass && effectiveSwitch && this.hass.states[effectiveSwitch]) {
              switchState = this.hass.states[effectiveSwitch].state;
            }

            const stateObj = this.states[miner.id] || {};
            const lastUpdate = stateObj.last_sensor_update || 0;
            const isStale = lastUpdate > 0 && (Date.now() / 1000 - lastUpdate > 300);

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
            let forecastValue = this.hass && miner.forecast_sensor ? this.hass.states[miner.forecast_sensor] : null;

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
              const hrValue = parseFloat(hrState?.state || 0);
              let hrInTH = 0;
              const unit = (hrState.attributes?.unit_of_measurement || 'TH/S').toUpperCase();
              
              if (unit.includes('PH')) hrInTH = hrValue * 1000;
              else if (unit.includes('TH')) hrInTH = hrValue;
              else if (unit.includes('GH')) hrInTH = hrValue / 1000;
              else if (unit.includes('MH')) hrInTH = hrValue / 1000000;
              else if (unit.includes('KH')) hrInTH = hrValue / 1000000000;
              else hrInTH = hrValue / 1000000000000; // Assume H/s if no prefix match
              
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

            // let stateObj = this.states ? this.states[miner.id] : null; // Already defined above

            const pSensorState = this.hass?.states[pSensor];
            const hSensorState = this.hass?.states[hSensor];
            const currentWatts = pSensorState ? parseFloat(pSensorState.state) || 0 : 0;
            const currentHash = hSensorState ? parseFloat(hSensorState.state) || 0 : 0;
            
            const isActuallyMining = switchState === 'on' && (currentWatts > 10 || currentHash > 0.1);
            const isStandby = switchState === 'on' && !isActuallyMining;
            const runtime = this.calculateRuntime(effectiveSwitch);

            const cardStateClass = stateObj?.ramping ? 'is-ramping' : (isActuallyMining ? 'is-on' : isStandby ? 'is-standby' : '');

            return html`
              <div class="card miner-card ${cardStateClass}" style="position: relative; background: rgba(0,0,0,0.75) !important; /* Removed backdrop-filter to prevent black screen issues */">
                ${this.config.theme === 'gladbeck' ? html`
                  <img src="https://solarmodule-gladbeck.de/wp-content/uploads/2023/07/cropped-logo_new.png" style="position: absolute; top: 10px; right: 10px; height: 18px; opacity: 0.1; filter: grayscale(1) brightness(2); pointer-events: none; z-index: 0;">
                ` : ''}
                ${miner.image ? html`<div class="miner-image" style="background-image: url('${miner.image}')"></div>` : html`<div class="miner-image placeholder">₿</div>`}
                <div class="miner-header">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                      <span style="color: #fff; font-weight: 900; font-size: 1.1em; line-height: 1.2;">${miner.name}</span>
                      ${miner.miner_ip && !miner.name.includes(miner.miner_ip) ? html`
                        <span style="color: rgba(255,255,255,0.4); font-size: 0.75em; font-weight: normal; font-family: 'Space Mono', monospace;">${miner.miner_ip}</span>
                      ` : ''}
                    </div>
                  <div class="prio-badge" style="background: rgba(var(--theme-accent-1-rgb), 0.1); border: 1px solid rgba(var(--theme-accent-1-rgb), 0.2); color: var(--theme-accent-1); padding: 4px 10px; border-radius: 6px; font-size: 0.7em; font-weight: 800; letter-spacing: 1px;">Prio: ${miner.priority || 10}</div>
                  ${miner.is_solo ? html`<span class="prio-badge" style="background: rgba(231, 76, 60, 0.15); color: #e74c3c; border-color: rgba(231, 76, 60, 0.3);">SOLO</span>` : ''}
                </div>
                
                  <!-- Status Pill & Power Button (Vibrant Edition) -->
                  <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin: 15px 0 25px 0;">
                    
                    <div class="status-pill-vibrant" 
                         style="flex: 1; max-width: 200px; height: 48px; border-radius: 24px; 
                                background: ${isActuallyMining ? '#f39c12' : (isStandby ? '#0bc4e2' : '#222')}; 
                                border: 1px solid ${isActuallyMining ? '#ffcc00' : (isStandby ? '#55efff' : 'rgba(255,255,255,0.1)')}; 
                                display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;
                                box-shadow: ${isActuallyMining ? '0 4px 25px rgba(243, 156, 18, 0.5), inset 0 1px 1px rgba(255,255,255,0.4)' : (isStandby ? '0 4px 20px rgba(11, 196, 226, 0.4), inset 0 1px 1px rgba(255,255,255,0.3)' : 'none')};
                                transition: all 0.3s;"
                         @click="${() => this.toggleMiner(effectiveSwitch)}">
                      <span style="font-weight: 950; letter-spacing: 2px; font-size: 1.1em; color: ${isActuallyMining || isStandby ? '#000' : '#888'}; text-transform: uppercase; text-shadow: 0 0 1px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px;">
                        ${isActuallyMining ? 'Mining' : (isStandby ? 'Standby' : html`AUS <ha-icon icon="mdi:fan" style="--mdc-icon-size: 14px; opacity: 0.5;"></ha-icon>`)}
                      </span>
                      ${isActuallyMining ? html`<span style="font-size: 1.2em; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));">🚀</span>` : ''}
                    </div>

                    <div class="power-btn-neon" 
                         style="width: 48px; height: 48px; border-radius: 50%; 
                                background: ${switchState === 'on' ? 'rgba(11, 196, 226, 0.2)' : 'rgba(0,0,0,0.4)'}; 
                                border: 2px solid ${switchState === 'on' ? '#0bc4e2' : 'rgba(255,255,255,0.1)'}; 
                                display: flex; align-items: center; justify-content: center; cursor: pointer;
                                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                                box-shadow: ${switchState === 'on' ? '0 0 20px rgba(11, 196, 226, 0.5), inset 0 0 10px rgba(11, 196, 226, 0.2)' : 'none'};"
                         @click="${() => this.toggleMiner(effectiveSwitch)}"
                         @mouseover="${(e) => e.currentTarget.style.transform = 'scale(1.1)'}"
                         @mouseout="${(e) => e.currentTarget.style.transform = 'scale(1)'}">
                      <ha-icon icon="mdi:power" 
                               style="color: ${switchState === 'on' ? '#0bc4e2' : '#666'}; --mdc-icon-size: 26px; filter: ${switchState === 'on' ? 'drop-shadow(0 0 5px #0bc4e2)' : 'none'};">
                      </ha-icon>
                    </div>

                  </div>
                
                ${stateObj && stateObj.temp_alarm ? html`
                  <div style="background: rgba(231,76,60,0.25); border: 1px solid #e74c3c; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; animation: pulse 1.5s infinite;">
                    <span style="font-size: 1.3em;">🌡️</span>
                    <div>
                      <div style="color: #e74c3c; font-weight: 900; font-size: 0.85em; letter-spacing: 1px;">TEMPERATUR-ALARM</div>
                      <div style="color: rgba(255,255,255,0.6); font-size: 0.75em;">Miner wegen Überhitzung abgeschaltet</div>
                    </div>
                  </div>
                ` : ''}

                ${stateObj && stateObj.hardware_error ? html`
                    <div style="background: rgba(231, 76, 60, 0.2); border: 1px solid #e74c3c; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                       <strong style="color: #e74c3c; display: block; margin-bottom: 5px;">⚠️ HARDWARE NICHT GEFUNDEN</strong>
                       <p style="font-size: 0.85em; color: #fff; margin: 0;">
                         Die Entitäten <code style="background: rgba(0,0,0,0.3); padding: 2px 4px;">${stateObj.missing_entities?.join(', ')}</code> wurden in Home Assistant nicht gefunden.
                         Bitte prüfe die <strong>Miner-Integration</strong>.
                       </p>
                    </div>
                  ` : ''}

                ${stateObj && (stateObj.log_reason_on || stateObj.log_reason_off) ? html`
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px; padding: 6px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; font-size: 0.75em; color: rgba(255,255,255,0.45);">
                    <ha-icon icon="mdi:information-outline" style="--mdc-icon-size: 13px; flex-shrink: 0;"></ha-icon>
                    <span>${switchState === 'on' ? (stateObj.log_reason_on || '') : (stateObj.log_reason_off || '')}</span>
                  </div>
                ` : ''}

                ${stateObj && miner.standby_watchdog_enabled ? html`
                  ${stateObj.watchdog_remaining > 0 ? html`
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px; padding: 6px 10px; background: rgba(243,156,18,0.1); border: 1px solid rgba(243,156,18,0.35); border-radius: 8px; font-size: 0.75em; color: rgba(243,156,18,0.9);">
                      <ha-icon icon="mdi:shield-alert-outline" style="--mdc-icon-size: 13px; flex-shrink: 0;"></ha-icon>
                      <span>Watchdog Countdown: noch ${Math.ceil(stateObj.watchdog_remaining / 60)} min</span>
                    </div>
                  ` : stateObj.watchdog_cooldown_remaining > 0 ? html`
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px; padding: 6px 10px; background: rgba(100,116,139,0.1); border: 1px solid rgba(100,116,139,0.3); border-radius: 8px; font-size: 0.75em; color: rgba(148,163,184,0.8);">
                      <ha-icon icon="mdi:shield-sync-outline" style="--mdc-icon-size: 13px; flex-shrink: 0;"></ha-icon>
                      <span>Watchdog Cooldown: noch ${Math.ceil(stateObj.watchdog_cooldown_remaining / 60)} min</span>
                    </div>
                  ` : ''}
                ` : ''}

                <div class="api-stats" style="background: rgba(15,15,20,0.9); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px; /* Removed backdrop-filter */">
                  <div class="stat" style="text-align: center;">
                    <div style="font-size: 0.55em; color: rgba(255,255,255,0.4); text-transform: uppercase; font-weight: 900; letter-spacing: 1.5px; margin-bottom: 5px;">Hashrate:</div>
                    <div style="font-size: 1.1em; font-weight: 950; color: #0bc4e2; font-family: 'Space Mono', monospace;">${hashrateValue}</div>
                  </div>
                  <div class="stat" style="text-align: center; border-left: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size: 0.55em; color: rgba(255,255,255,0.4); text-transform: uppercase; font-weight: 900; letter-spacing: 1.5px; margin-bottom: 5px;">Temp:</div>
                    <div style="font-size: 1.1em; font-weight: 950; color: ${stateObj.temp_alarm ? '#e74c3c' : '#0bc4e2'}; font-family: 'Space Mono', monospace;">${tempValue}</div>
                  </div>
                  <div class="stat" style="text-align: center; border-left: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size: 0.55em; color: rgba(255,255,255,0.4); text-transform: uppercase; font-weight: 900; letter-spacing: 1.5px; margin-bottom: 5px;">Verbrauch:</div>
                    <div style="font-size: 1.1em; font-weight: 950; color: #0bc4e2; font-family: 'Space Mono', monospace;">${powerConsumptionValue}</div>
                  </div>
                  <div class="stat" style="text-align: center; border-left: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size: 0.55em; color: rgba(255,255,255,0.4); text-transform: uppercase; font-weight: 900; letter-spacing: 1.5px; margin-bottom: 5px;">SOC:</div>
                    <div style="font-size: 1.1em; font-weight: 950; color: #0bc4e2; font-family: 'Space Mono', monospace;">${batterySOCValue || '0%'}</div>
                  </div>
                </div>

                <!-- Session Stats Row -->
                ${(stateObj.session_runtime_h > 0 || stateObj.today_energy_wh > 0 || stateObj.total_starts > 0) ? html`
                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px;">
                    <div style="text-align: center;">
                      <div style="font-size: 0.5em; color: rgba(255,255,255,0.3); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 3px;">Session</div>
                      <div style="font-size: 0.9em; font-weight: 900; color: rgba(255,255,255,0.7); font-family: 'Space Mono', monospace;">${stateObj.session_runtime_h?.toFixed(1) || '0.0'}h</div>
                    </div>
                    <div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.05);">
                      <div style="font-size: 0.5em; color: rgba(255,255,255,0.3); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 3px;">Heute</div>
                      <div style="font-size: 0.9em; font-weight: 900; color: rgba(255,255,255,0.7); font-family: 'Space Mono', monospace;">${stateObj.today_energy_wh?.toFixed(0) || '0'} Wh</div>
                    </div>
                    <div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.05);">
                      <div style="font-size: 0.5em; color: rgba(255,255,255,0.3); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 3px;">Starts</div>
                      <div style="font-size: 0.9em; font-weight: 900; color: rgba(255,255,255,0.7); font-family: 'Space Mono', monospace;">${stateObj.total_starts || 0}</div>
                    </div>
                  </div>
                ` : html`<div style="margin-bottom: 14px;"></div>`}
                
                ${powerObj ? html`
                  <div class="power-limit-box" style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                      <span style="font-size: 0.8em; color: var(--theme-text-dim); font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Power Limit (${miner.name.includes('Axe') ? 'Bitaxe' : 'S9/ASIC'})</span>
                        ${stateObj && stateObj.ramping ? html`
                          <span class="badge" style="background: rgba(11, 196, 226, 0.1); color: #0bc4e2; font-size: 0.75em; padding: 2px 6px; border: 1px solid rgba(11, 196, 226, 0.3); animation: pulse 2s infinite; text-transform: none;">
                            🎢 Auto-Ramping
                          </span>
                        ` : ''}
                      <div style="display: flex; align-items: center; gap: 5px;">
                        <input type="number" 
                               .value="${powerObj.state}" 
                               min="${powerObj.attributes?.min || 0}" 
                               max="${powerObj.attributes?.max || 2500}"
                               ?disabled="${(stateObj && stateObj.hardware_error) || (stateObj && stateObj.ramping)}"
                               @change="${(e) => this.setPowerLimit(miner.power_entity, e.target.value)}"
                               style="background: rgba(0,0,0,0.5); border: 1px solid rgba(11, 196, 226, 0.3); color: #0bc4e2; border-radius: 4px; padding: 2px 6px; width: 65px; text-align: right; font-weight: bold; font-family: monospace; outline: none;">
                        <span style="color: var(--theme-text-dim); font-size: 0.8em; font-weight: bold;">${powerUnit}</span>
                      </div>
                    </div>
                    <div class="slider-container">
                      ${(() => {
                        const min = powerObj.attributes?.min || 0;
                        const max = miner.soft_target_power || miner.max_power || powerObj.attributes?.max || 100;
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
                             max="${miner.soft_target_power || miner.max_power || powerObj.attributes?.max || 100}" 
                             step="${powerObj.attributes?.step || 1}" 
                             .value="${powerObj.state}" 
                             ?disabled="${(stateObj && stateObj.hardware_error) || (stateObj && stateObj.ramping)}"
                             @change="${(e) => this.setPowerLimit(miner.power_entity, e.target.value)}"
                             style="width: 100%; accent-color: #0bc4e2; cursor: ${(stateObj?.hardware_error || stateObj?.ramping) ? 'not-allowed' : 'pointer'}; position: relative; z-index: 2; background: transparent;">
                    </div>
                  </div>
                ` : ''}

                
                <div class="miner-details">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; margin-top: 0;">
                    <span style="color: #0bc4e2; font-size: 0.85em; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
                      MODUS: <span style="color: #fff;">${modeMap[miner.mode] || 'Unbekannt'}</span>
                    </span>
                    ${miner.mode !== 'manual' ? html`
                      <button class="btn-control action warn" @click="${() => this.stopAutomationAndHardware(miner)}" style="padding: 6px 16px; font-size: 0.8em; flex: none; width: auto; border-radius: 8px; letter-spacing: 1px; font-weight: 950; margin-left: 10px; box-shadow: 0 0 15px rgba(231, 76, 60, 0.2);">
                        STOPP
                      </button>
                    ` : html`
                      <button class="btn-control mode-normal" @click="${() => this.quickUpdateMiner(miner.id, 'mode', miner.last_auto_mode || 'pv')}" style="padding: 6px 16px; font-size: 0.8em; flex: none; width: auto; border-radius: 8px; letter-spacing: 1px; font-weight: 950; margin-left: 10px;">
                        START
                      </button>
                    `}
                  </div>
                  <p><b>Dose:</b> ${friendlySwitchName || 'Nicht gesetzt'} ${friendlySwitchName2 ? html` + ${friendlySwitchName2}` : ''}</p>
                  
                  ${miner.mode === 'pv' ? html`
                    <div class="tech-box" style="${isStale ? 'border-color: #e67e22; background: rgba(230, 126, 34, 0.05);' : ''}">
                      <p><b>Aktueller PV-Wert:</b> <span class="highlight-val" style="${isStale ? 'color: #e67e22; animation: pulse 2s infinite;' : ''}">${pvValue}</span></p>
                      ${isStale ? html`<p style="color: #e67e22; font-size: 0.75em; margin-bottom: 5px;">⚠️ Sensordaten veraltet! (Timeout-Gefahr)</p>` : ''}
                      <div class="small-text mt-1" style="margin-bottom: 8px; display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                        Regeln: An &ge; <input type="number" class="tech-input" .value="${miner.pv_on}" @change="${(e) => this.quickUpdateMiner(miner.id, 'pv_on', e.target.value)}"> W 
                        | Aus &le; <input type="number" class="tech-input" .value="${miner.pv_off}" @change="${(e) => this.quickUpdateMiner(miner.id, 'pv_off', e.target.value)}"> W
                      </div>
                      ${miner.allow_battery ? html`
                        <div style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px;">
                          <p><b>Batterie (SOC):</b> <span class="highlight-val" style="${isStale ? 'color: #e67e22;' : ''}">${batteryValue || 'N/A'}</span></p>
                          <p class="small-text mt-1">🔋 Unterstützung erlaubt bis min. ${miner.battery_min_soc}%</p>
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}
                  
                  ${miner.mode === 'soc' ? html`
                    <div class="tech-box">
                      <p><b>Aktueller SOC:</b> <span class="highlight-val" style="color: #0bc4e2;">${batterySOCValue || 'N/A'}</span></p>
                      <div class="small-text mt-1" style="margin-bottom: 8px; display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                        Regeln: An &ge; <input type="number" class="tech-input" .value="${miner.soc_on !== undefined ? miner.soc_on : 90}" @change="${(e) => this.quickUpdateMiner(miner.id, 'soc_on', e.target.value)}"> % 
                        | Aus &le; <input type="number" class="tech-input" .value="${miner.soc_off !== undefined ? miner.soc_off : 30}" @change="${(e) => this.quickUpdateMiner(miner.id, 'soc_off', e.target.value)}"> %
                      </div>
                    </div>
                  ` : ''}

                  ${miner.mode === 'offgrid' ? html`
                    <div class="tech-box" style="border-color: rgba(255, 152, 0, 0.3); background: rgba(255, 152, 0, 0.05);">
                      <p><b>Offgrid SOC:</b> <span class="highlight-val" style="color: #ff9800;">${batterySOCValue || 'N/A'}</span></p>
                      <div class="small-text mt-1" style="display: flex; flex-direction: column; gap: 4px;">
                        <div>
                          Kurve: ${miner.offgrid_soc_start}% (${miner.offgrid_min_power}W) 
                          &rarr; ${miner.offgrid_soc_mid ? html`${miner.offgrid_soc_mid}% (${miner.offgrid_mid_power}W) &rarr; ` : ''}
                          ${miner.offgrid_soc_max}% (${miner.offgrid_max_power}W)
                        </div>
                        <div style="color: #e74c3c;">Stopp bei: ${miner.offgrid_soc_stop}%</div>
                      </div>
                    </div>
                  ` : ''}

                  ${miner.mode === 'ai_discharge' ? html`
                    <div class="tech-box ai-box" style="border-color: #9b59b6; background: rgba(155, 89, 182, 0.08); border-width: 1px; box-shadow: 0 0 25px rgba(155, 89, 182, 0.1); position: relative; overflow: hidden; padding: 18px;">
                      <!-- Scanline Effect (subtle) -->
                      <div style="position: absolute; top: 0; left: 0; right: 0; height: 100%; background: linear-gradient(to bottom, transparent, rgba(155, 89, 182, 0.03) 50%, transparent); animation: scanline 6s linear infinite; pointer-events: none; z-index: 0;"></div>
                      
                      <div style="position: relative; z-index: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                          <ha-icon icon="mdi:alien-outline" style="color: #9b59b6; --mdc-icon-size: 22px; filter: drop-shadow(0 0 8px rgba(155, 89, 182, 0.5));"></ha-icon>
                          <span style="color: #d1a3e6; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; font-size: 0.85em;">AI-Optimierung:</span>
                        </div>

                        <div style="margin-bottom: 15px; font-size: 1em;">
                          <span style="color: #0bc4e2; font-weight: 800;">Ziel: <span style="color: #fff; font-weight: 950;">${miner.target_soc || 15}%</span></span>
                          <span style="color: #0bc4e2; font-weight: 800; margin-left: 8px;">bis <span style="color: #fff; font-weight: 950;">${miner.target_time || '07:00'}</span></span>
                        </div>

                        <div style="border-top: 1px dotted rgba(255,255,255,0.15); margin: 12px 0;"></div>

                        <div style="display: flex; flex-direction: column; gap: 8px;">
                          <div style="color: #9b59b6; font-weight: 800; font-size: 0.95em;">
                            ${isActuallyMining ? 'Aktiv seit:' : 'Geplante Startzeit:'} <span style="color: #fff; font-weight: 950; font-family: 'Space Mono', monospace; background: rgba(155, 89, 182, 0.2); padding: 1px 6px; border-radius: 4px;">${stateObj && stateObj.ai_start_time && stateObj.ai_start_time !== '--:--' ? stateObj.ai_start_time : 'Warten...'}</span>
                          </div>
                          
                          <div style="color: #0bc4e2; font-weight: 800; font-size: 0.9em; opacity: 0.9; display: flex; flex-direction: column; gap: 4px;">
                            <div>Dauer: <span style="color: #fff; font-weight: 900;">${stateObj?.ai_runtime || '0.0'}h</span> | <span style="font-size: 0.9em;">Basierend auf ${miner.battery_capacity || 10} kWh Akku</span></div>
                            <div style="font-size: 0.85em; color: rgba(255,255,255,0.6);">Haus-Last (Ø Nacht): <span style="color: #fff;">${stateObj?.ai_avg_p || '...'} W</span></div>
                          </div>

                          <div style="margin-top: 10px; color: rgba(255,255,255,0.4); font-size: 0.85em; display: flex; align-items: flex-start; gap: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                            <ha-icon icon="${stateObj?.ai_status?.includes('>') ? 'mdi:home-lightning-bolt' : 'mdi:information-outline'}" style="--mdc-icon-size: 14px; margin-top: 2px; color: ${stateObj?.ai_status?.includes('>') ? '#e74c3c' : 'inherit'}"></ha-icon>
                            <span style="line-height: 1.3;">${stateObj?.ai_status || 'Berechne optimale Startzeit...'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ` : ''}

                  ${miner.mode === 'heating' ? html`
                    <div class="tech-box" style="border-color: #e67e22; background: rgba(230, 126, 34, 0.05);">
                      <p><b>Raumtemperatur:</b> <span class="highlight-val" style="color: #e67e22;">${this._formatValue(this.hass?.states[miner.target_temp_sensor], '°C', 'N/A')}</span></p>
                      <div class="small-text mt-1" style="margin-bottom: 8px; display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                        Heizen: An &le; <input type="number" class="tech-input" .value="${miner.target_temp_on || 21}" @change="${(e) => this.quickUpdateMiner(miner.id, 'target_temp_on', e.target.value)}"> °C 
                        | Aus &ge; <input type="number" class="tech-input" .value="${miner.target_temp_off || 22}" @change="${(e) => this.quickUpdateMiner(miner.id, 'target_temp_off', e.target.value)}"> °C
                      </div>
                      ${miner.allow_battery ? html`
                        <div style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px; margin-top: 8px;">
                          <p><b>Batterie (SOC):</b> <span class="highlight-val">${batterySOCValue || 'N/A'}</span></p>
                          <p class="small-text mt-1">🔋 Nur Heizen bei min. ${miner.battery_min_soc}% SOC</p>
                        </div>
                      ` : ''}
                      <small style="color: #888; display: block; margin-top: 5px;">Der Miner heizt solange die Temperatur unter dem Zielwert liegt.</small>
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

                      if (hasWatchData && switchState === 'on' && watchObj) {
                        const threshold = miner.standby_power || 100;
                        const delayMins = miner.standby_delay || 10;

                        const sensorState = watchObj.state;
                        const isNumeric = sensorState !== 'unavailable' && sensorState !== 'unknown' && !isNaN(parseFloat(sensorState));

                        if ((isNumeric && currentWatchValue < threshold) || (stateObj && stateObj.standby_since)) {
                          // Priorität: Backend Standby-Zeitstempel (Sekunden -> Millisekunden)
                          // Falls das Backend noch keine Zeit hat, nehmen wir last_changed als Fallback
                          const startMillis = (stateObj && stateObj.standby_since) 
                                              ? (stateObj.standby_since * 1000) 
                                              : new Date(watchObj.last_changed).getTime();
                                              
                          const nowMillis = new Date().getTime();
                          const elapsedMins = (nowMillis - startMillis) / 60000;
                          
                          if (elapsedMins >= 0) {
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
                              <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${watchdogProgress}%; background: rgba(231, 76, 60, 0.1); z-index: 0; transition: width 15s linear;"></div>
                          ` : ''}
                          <div style="position: relative; z-index: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 10px;">
                                <label style="margin: 0; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                    <input type="checkbox" .checked="${miner.standby_watchdog_enabled}" @change="${(e) => this.quickUpdateMiner(miner.id, 'standby_watchdog_enabled', e.target.checked)}" style="width: 18px; height: 18px; margin: 0; accent-color: #e74c3c;">
                                    <b style="font-size: 1.1em;">🛡️ Watchdog:</b> <span class="highlight-val" style="color: ${stState === 'on' ? '#d62cf6' : '#e74c3c'}; text-transform: uppercase; font-weight: 900; font-size: 1.1em; margin-left: 5px;">${stState === 'on' ? 'ON' : 'OFF'}</span>
                                </label>
                                <div class="badge" style="background: rgba(var(--theme-accent-1-rgb), 0.2); color: #fff; border: 1px solid rgba(var(--theme-accent-1-rgb), 0.5); border-radius: 6px; padding: 6px 14px; font-weight: 900; display: flex; align-items: center; gap: 8px; font-size: 0.8em; cursor: pointer; text-transform: uppercase; box-shadow: 0 0 15px rgba(var(--theme-accent-1-rgb), 0.3);" @click="${() => this.toggleMiner(miner.standby_switch)}">
                                   <span>🔌</span> Plug
                                </div>
                            </div>
                            <div class="small-text mt-1 watchdog-controls" style="margin-top: 10px; display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                                <span>Off wenn &lt; <input type="number" class="tech-input" .value="${miner.standby_power || 100}" @change="${(e) => this.quickUpdateMiner(miner.id, 'standby_power', e.target.value)}"> W</span>
                                <span>für &ge; <input type="number" class="tech-input" .value="${miner.standby_delay || 10}" @change="${(e) => this.quickUpdateMiner(miner.id, 'standby_delay', e.target.value)}"> Min.</span>
                            </div>
                            ${watchdogWarning ? html`
                                <div style="margin-top: 10px; color: #e74c3c; font-weight: 800; font-size: 0.9em; display: flex; align-items: center; gap: 5px; animation: pulse 2s infinite;">
                                    ${watchdogWarning}
                                </div>
                            ` : ''}
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

                   ${miner.forecast_sensor && miner.forecast_enabled !== false ? html`
                        ${(() => {
                           const fState = forecastValue ? forecastValue.state : 'N/A';
                           const fMin = parseFloat(miner.forecast_min) || 0;
                           const currentVal = parseFloat(fState) || 0;
                           const isOk = !forecastValue || forecastValue.state === 'unavailable' || forecastValue.state === 'unknown' ? true : currentVal >= fMin;
                           
                           return html`
                            <div class="tech-box" style="margin-top: 15px; border-color: #3498db; background: rgba(52, 152, 219, 0.05);">
                              <p style="display: flex; justify-content: space-between; align-items: center; margin: 0;">
                                <span><b>⛅ Prognose heute:</b> <span class="highlight-val">${fState}</span></span>
                                <span class="status-badge small ${isOk ? 'on' : 'off'}" style="padding: 2px 8px; font-size: 0.7em; width: auto; box-shadow: none;">${isOk ? 'OK' : 'ZU NIEDRIG'}</span>
                              </p>
                              <p class="small-text mt-1" style="color: ${isOk ? '#888' : '#e74c3c'};">Zusatz-Info: Schwelle bei ${fMin} kWh</p>
                            </div>
                           `;
                        })()}
                      ` : ''}

                  <!-- Stats Row -->
                  <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px;">
                    <div style="flex: 1; min-width: 80px; background: rgba(15,15,20,0.9); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); /* Removed backdrop-filter */ box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
                      <div style="font-size: 0.7em; color: var(--theme-text-dim); text-transform: uppercase; letter-spacing: 1px; font-weight: 800; opacity: 0.8; margin-bottom: 4px;">Verbrauch</div>
                      <div style="font-size: 1.3em; font-weight: 950; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${powerConsumptionValue}</div>
                    </div>
                    <div style="flex: 1; min-width: 80px; background: rgba(15,15,20,0.9); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); /* Removed backdrop-filter */ box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
                      <div style="font-size: 0.7em; color: var(--theme-text-dim); text-transform: uppercase; letter-spacing: 1px; font-weight: 800; opacity: 0.8; margin-bottom: 4px;">Tagesertrag</div>
                      <div style="font-size: 1.3em; font-weight: 950; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${dailyRevenue.toFixed(2)} <span style="font-size: 0.7em; opacity: 0.5;">€</span></div>
                    </div>
                  </div>

                  <!-- Runtime Row -->
                  <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 12px; margin-top: 12px;">
                    <div style="text-align: center; flex: 1; border-right: 1px solid rgba(255,255,255,0.15);">
                      <div style="font-size: 0.7em; color: var(--theme-text-dim); text-transform: uppercase; opacity: 0.8; margin-bottom: 4px;">Heute</div>
                      <div style="font-size: 1.1em; font-weight: 900; color: var(--theme-accent-2); text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${Math.floor(runtime.todayMinutes / 60)}h ${Math.floor(runtime.todayMinutes % 60)}m</div>
                    </div>
                    <div style="text-align: center; flex: 1;">
                      <div style="font-size: 0.7em; color: var(--theme-text-dim); text-transform: uppercase; opacity: 0.8; margin-bottom: 4px;">7 Tage</div>
                      <div style="font-size: 1.1em; font-weight: 900; color: var(--theme-accent-2); text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${Math.floor(runtime.weekMinutes / 60)}h ${Math.floor(runtime.weekMinutes % 60)}m</div>
                    </div>
                  </div>

                  <div class="miner-controls" style="margin-top: 15px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 15px;">
                    <p style="margin: 0 0 10px 0; font-size: 0.75em; color: #888; text-transform: uppercase; letter-spacing: 1px;">⚡ Hardware Steuerung (Direkt)</p>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <button class="btn-control mode-low" @click="${() => this.callHardwareService(miner, 'set_work_mode', 'low')}">LOW</button>
                      <button class="btn-control mode-normal" @click="${() => this.callHardwareService(miner, 'set_work_mode', 'normal')}">NORM</button>
                      <button class="btn-control mode-high" @click="${() => this.callHardwareService(miner, 'set_work_mode', 'high')}">HIGH</button>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                      <button class="btn-control action" @click="${() => this.callHardwareService(miner, 'restart_backend')}">🔄 Neustart</button>
                      <button class="btn-control action warn" @click="${() => this.callHardwareService(miner, 'reboot')}">⚡ Reboot</button>
                    </div>
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

            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 250px;">
              <label>Haus-Stromsensor (für echten PV-Überschuss)</label>
              <openkairo-entity-picker
                placeholder="-- Sensor wählen --"
                .value="${this.config.house_power_sensor || ''}"
                .entities="${this.getEntitiesByDomain('sensor')}"
                @change="${(e) => { this.config.house_power_sensor = e.target.value; this.saveConfig(true); }}">
              </openkairo-entity-picker>
              <small style="color: #888;">Netz-Sensor (z.B. Shelly EM, Tibber Pulse). <b>Negativ = Bezug, Positiv = Einspeisung.</b> Wenn gesetzt, berechnet der PV-Modus den echten Überschuss statt der Rohproduktion.</small>
            </div>
            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 250px;">
              <label>Akku-Leistung Sensor (Laden/Entladen)</label>
              <openkairo-entity-picker 
                placeholder="-- Sensor wählen --" 
                .value="${this.config.battery_power_sensor || ''}" 
                .entities="${this.getEntitiesByDomain('sensor')}" 
                @change="${(e) => { this.config.battery_power_sensor = e.target.value; this.saveConfig(true); }}">
              </openkairo-entity-picker>
            </div>
            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 250px;">
              <label>BTC Portfolio Sensor (Guthaben)</label>
              <openkairo-entity-picker 
                placeholder="-- Sensor wählen --" 
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

          <div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px; display: flex; gap: 20px; flex-wrap: wrap;">
            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 220px;">
              <label>Fleet Max Power (Watt)</label>
              <input type="number" min="0" step="100" .value="${this.config.fleet_max_power || ''}" @change="${(e) => { this.config.fleet_max_power = e.target.value ? parseFloat(e.target.value) : null; this.saveConfig(true); }}" placeholder="z.B. 3000">
              <small>Maximale Gesamt-Leistung aller Miner. Neue Einschaltvorgänge werden geblockt wenn Budget überschritten.</small>
            </div>
            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 220px;">
              <label>MQTT Prefix (Optional)</label>
              <input type="text" .value="${this.config.mqtt_prefix || ''}" @change="${(e) => { this.config.mqtt_prefix = e.target.value; this.saveConfig(true); }}" placeholder="z.B. homeassistant/mining">
              <small>Wenn gesetzt, werden Miner-States auf MQTT publiziert. Benötigt die MQTT-Integration in HA.</small>
            </div>
          </div>
        </div>

        <div style="margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px;">
          <h3 style="margin: 0 0 6px 0; font-size: 0.95em; color: rgba(255,255,255,0.7);">🗂 Config Backup</h3>
          <p style="font-size: 0.82em; color: rgba(255,255,255,0.4); margin: 0 0 14px 0;">Config als JSON exportieren oder aus einer Backup-Datei wiederherstellen.</p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <button class="btn-primary" style="font-size: 0.85em; padding: 8px 16px;" @click="${() => this.exportConfig()}">
              ⬇️ Config exportieren
            </button>
            <label style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; font-size: 0.85em; color: rgba(255,255,255,0.75); transition: background 0.2s;">
              ⬆️ Config importieren
              <input type="file" accept=".json,application/json" @change="${(e) => this.importConfig(e)}" style="display: none;">
            </label>
          </div>
        </div>

        <h2>🛠 Miner verwalten</h2>
        <p>Hier legst du deine ASIC oder GPU Miner an und weist ihnen Steckdosen zu.</p>
        
        <button class="btn-primary" @click="${() => this.startAddMiner()}">+ Neuen Miner hinzufügen</button>

        <div class="miner-list">
          ${this.config.miners && this.config.miners.length > 0 ? this.config.miners.map(miner => html`
            <div class="miner-list-item">
              <div>
                <strong>${miner.name}</strong> 
                <span class="prio-badge small">Prio: ${miner.priority || '-'}</span>
                <p class="small-text">Dose: ${miner.switch} <br> Modus: ${miner.mode}</p>
              </div>
              <div class="actions">
                <button class="btn-icon edit" @click="${() => this.startEditMiner(miner)}" title="Bearbeiten">✏️</button>
                <button class="btn-icon" style="opacity:0.6;" @click="${() => this.exportMinerTemplate(miner)}" title="Einstellungen als Vorlage exportieren">📋</button>
                <button class="btn-icon delete" @click="${() => this.deleteMiner(miner.id)}" title="Löschen">🗑️</button>
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

        ${(() => {
          const others = (this.config.miners || []).filter(m => m.id !== this.editingMinerId);
          if (!others.length) return '';
          return html`
            <div style="background: rgba(11,196,226,0.06); border: 1px solid rgba(11,196,226,0.2); border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <span style="font-size: 0.82em; color: rgba(255,255,255,0.55); white-space: nowrap;">📋 Einstellungen übernehmen von:</span>
              <select style="flex: 1; min-width: 160px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; padding: 6px 10px; font-size: 0.82em;"
                @change="${(e) => { if (e.target.value) { this.applyMinerSettings(e.target.value); e.target.value = ''; } }}">
                <option value="">— Miner wählen …</option>
                ${others.map(m => html`<option value="${m.id}">${m.name}</option>`)}
              </select>
              <label style="cursor:pointer; white-space:nowrap; font-size:0.82em; color:rgba(11,196,226,0.8); border:1px solid rgba(11,196,226,0.25); border-radius:6px; padding:5px 10px;">
                📂 Vorlage laden
                <input type="file" accept=".json,application/json" style="display:none;" @change="${(e) => this._importMinerTemplate(e)}">
              </label>
              <span style="font-size: 0.75em; color: rgba(255,255,255,0.3);">Modus, Schwellenwerte, Soft-Start, Watchdog — Name/IP/Sensoren bleiben unverändert.</span>
            </div>
          `;
        })()}

        <div class="form-row">
            <div class="form-group flex-2">
              <label>Name des Miners</label>
              <input type="text" name="name" placeholder="z.B. KS0 Pro" .value="${this.editForm.name}" @input="${this.handleFormInput}">
            </div>
            <div class="form-group flex-1">
              <label>Geschürfter Coin</label>
              <select name="mining_coin" @change="${this.handleFormInput}">
                <option value="BTC" ?selected="${this.editForm.mining_coin === 'BTC'}">Bitcoin (BTC)</option>
                <option value="KAS" ?selected="${this.editForm.mining_coin === 'KAS'}">Kaspa (KAS)</option>
              </select>
            </div>
            <div class="form-group flex-1">
              <label>Priorität</label>
              <input type="number" name="priority" .value="${this.editForm.priority}" @input="${this.handleFormInput}">
              <small>1 = Höchste</small>
            </div>
            <div class="form-group flex-1" style="display: flex; flex-direction: column; justify-content: center;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 0;">
                <input type="checkbox" name="is_solo" .checked="${this.editForm.is_solo}" @change="${this.handleFormInput}" style="width: 18px; height: 18px; accent-color: var(--theme-accent-2);">
                <b>Solo Miner</b>
              </label>
              <small style="line-height:1.1; margin-top:2px;">Kein Ertrag (NerdAxe)</small>
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

            <div class="form-row" style="margin-top: 12px;">
                <div class="form-group flex-1">
                    <label>Avalon Startmodus</label>
                    <select name="avalon_work_mode" @change="${this.handleFormInput}" style="width: 100%; padding: 8px; background: var(--card-bg, #1a1a2e); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: inherit;">
                        <option value="normal" ?selected="${(this.editForm.avalon_work_mode || 'normal') === 'normal'}">Standard (Normal)</option>
                        <option value="low"    ?selected="${this.editForm.avalon_work_mode === 'low'}">Eco (Low Power)</option>
                        <option value="high"   ?selected="${this.editForm.avalon_work_mode === 'high'}">Super (High Performance)</option>
                    </select>
                    <small>Nur für Avalon-Miner. Bestimmt den Leistungsmodus beim Einschalten (API-gesteuert).</small>
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

                ${this.editForm.mode !== 'pv' ? html`
                <div class="form-row" style="margin-top: -10px; margin-bottom: 20px;">
                    <div class="form-group flex-1">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;" title="Versucht die Leistung auch nach manueller Änderung automatisch wieder an den Zielwert anzupassen.">
                            <input type="checkbox" name="soft_continuous_scaling" .checked="${this.editForm.soft_continuous_scaling}" @change="${this.handleFormInput}" style="width: 16px; height: 16px; margin: 0; accent-color: #0bc4e2;">
                            <b>Automatische Nachskalierung (SOC/Heizung)</b>
                        </label>
                    </div>
                </div>
                ` : ''}

                ${this.editForm.soft_start_enabled || this.editForm.soft_stop_enabled || this.editForm.soft_continuous_scaling ? html`

                    <div class="form-row">
                        <div class="form-group flex-1">
                            <label style="display: flex; align-items: center; justify-content: space-between;">
                                Start-Abstufungen (Watt)
                                <button type="button" @click="${() => { const mn = parseFloat(this.editForm.min_power || 400); const mx = parseFloat(this.editForm.max_power || 1400); const s = Array.from({length: 4}, (_, i) => Math.round(mn + (mx - mn) * i / 3)); this.editForm = { ...this.editForm, soft_start_steps: s.join(', '), soft_stop_steps: [...s].reverse().join(', ') }; this.requestUpdate(); }}" style="font-size: 0.75em; padding: 2px 8px; background: rgba(11,196,226,0.15); border: 1px solid rgba(11,196,226,0.4); border-radius: 4px; color: #0bc4e2; cursor: pointer;">⚡ Auto</button>
                            </label>
                            <input type="text" name="soft_start_steps" .value="${this.editForm.soft_start_steps || '100, 500, 1000'}" @input="${this.handleFormInput}">
                            <small>Kommasepariert. "Auto" berechnet 4 gleichmäßige Stufen zwischen Min. und Max. Leistung.</small>
                        </div>
                        <div class="form-group flex-1">
                            <label>Stopp-Abstufungen (Watt)</label>
                            <input type="text" name="soft_stop_steps" .value="${this.editForm.soft_stop_steps || '1000, 500, 100'}" @input="${this.handleFormInput}">
                            <small>Umgekehrte Reihenfolge zum Herunterfahren. Wird von "Auto" automatisch befüllt.</small>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group flex-1">
                            <label>Intervall (Sekunden)</label>
                            <input type="number" name="soft_interval" min="10" .value="${this.editForm.soft_interval || 60}" @input="${this.handleFormInput}">
                            <small>Wartezeit zwischen den Stufen.</small>
                        </div>
                        <div class="form-group flex-1" style="display: flex; align-items: center; background: rgba(11,196,226,0.05); border: 1px dashed rgba(11,196,226,0.2); border-radius: 8px; padding: 12px; gap: 10px;">
                            <span style="font-size: 1.4em;">ℹ️</span>
                            <span style="color: #888; font-size: 0.85em; line-height: 1.5;">Die Ziel-Leistung nach dem Hochfahren wird aus <strong style="color: var(--theme-accent-1);">Max. Leistung</strong> des Miners übernommen.</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>

        <div style="margin-top: 20px; padding: 15px; border: 1px dashed rgba(52, 152, 219, 0.3); border-radius: 8px; background: rgba(52, 152, 219, 0.05); margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h4 style="margin: 0; color: #3498db; display: flex; align-items: center; gap: 8px;">🌤️ Solar-Vorhersage (Global/Visual)</h4>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" .checked="${this.editForm.forecast_enabled !== false}" @change="${(e) => this.handleFormInput({ target: { name: 'forecast_enabled', type: 'checkbox', checked: e.target.checked } })}" style="width: 16px; height: 16px; margin: 0; accent-color: #3498db;">
                <span style="font-size: 0.9em; font-weight: bold; color: var(--theme-text-main);">Aktiv</span>
              </label>
            </div>
            
            <div class="form-row" style="opacity: ${this.editForm.forecast_enabled !== false ? '1' : '0.5'}; pointer-events: ${this.editForm.forecast_enabled !== false ? 'auto' : 'none'};">
                <div class="form-group flex-2">
                    <label>Prognose-Sensor (z.B. Solcast Today)</label>
                    <openkairo-entity-picker name="forecast_sensor" placeholder="-- Wetter/Prognose Sensor suchen --" .value="${this.editForm.forecast_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                </div>
                <div class="form-group flex-1">
                    <label>Min. Prognose (kWh)</label>
                    <input type="number" step="0.1" name="forecast_min" .value="${this.editForm.forecast_min || 0}" @input="${this.handleFormInput}">
                    <small>Zusatz-Regel für PV-Modi.</small>
                </div>
            </div>
            <small style="color: #888; display: block; margin-top: -5px;">Zeigt die Prognose auf dem Dashboard an. In PV-Modi dient dies zusätzlich als Einschaltschwelle.</small>
        </div>

        <div class="form-group mt-3">
          <label>Betriebsmodus</label>
          <select class="btc-select" name="mode" @change="${this.handleFormInput}">
            <option value="manual" ?selected="${this.editForm.mode === 'manual'}">Manuell (Nur Überwachung)</option>
            <option value="pv" ?selected="${this.editForm.mode === 'pv'}">PV-Überschuss (Einspeisung)</option>
            <option value="soc" ?selected="${this.editForm.mode === 'soc'}">Batterie SOC</option>
            <option value="offgrid" ?selected="${this.editForm.mode === 'offgrid'}">Offgrid PV (SOC Kurve) (Beta)</option>
            <option value="heating" ?selected="${this.editForm.mode === 'heating'}">Heiz-Modus (Temperatur-Steuerung)</option>
            <option value="ai_discharge" ?selected="${this.editForm.mode === 'ai_discharge'}">🤖 AI Akku-Optimierer (Predictive) (Beta)</option>
          </select>
        </div>

        ${this.editForm.mode === 'pv' ? html`
          <div class="mode-section btc-section">
            <h3>☀️ PV-Überschuss Steuerung</h3>
            <div class="form-group">
                <label>PV-Sensor (Wechselrichter-Leistung in Watt)</label>
                <openkairo-entity-picker name="pv_sensor" placeholder="-- PV-Produktions-Sensor suchen --" .value="${this.editForm.pv_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                <small style="color: #888;">Trage hier die <b>PV-Produktion</b> deines Wechselrichters ein (z.B. sensor.solaredge_ac_power) — nicht die Netzeinspeisung. Für echten Überschuss (PV minus Hausverbrauch) stelle den Haus-Stromsensor in den <b>globalen Einstellungen</b> ein.</small>
            </div>
            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Einschalten ab (Watt)</label>
                    <input type="number" name="pv_on" .value="${this.editForm.pv_on}" @input="${this.handleFormInput}">
                    <small>Miner startet wenn Überschuss ≥ diesem Wert.</small>
                </div>
                <div class="form-group flex-1">
                    <label>Ausschalten unter (Watt)</label>
                    <input type="number" name="pv_off" .value="${this.editForm.pv_off}" @input="${this.handleFormInput}">
                    <small>Miner stoppt wenn Überschuss dauerhaft unter diesem Wert fällt.</small>
                </div>
            </div>

            <div style="margin-top: 20px; padding: 15px; border: 1px dashed rgba(214, 44, 246, 0.3); border-radius: 8px; background: rgba(214, 44, 246, 0.05);">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #d62cf6; font-weight: bold;">
                    <input type="checkbox" name="allow_battery" .checked="${this.editForm.allow_battery}" @change="${this.handleFormInput}" style="width: 20px; height: 20px; accent-color: #d62cf6;">
                    🔋 Optionale Batterie-Unterstützung erlauben
                </label>
                
                <p style="margin: 8px 0 0 30px; font-size: 0.85em; color: #888;">Aktiviere dies wenn du eine Hausbatterie hast. Der Miner bleibt dann auch bei kurzen Wolken an, solange die Batterie noch ausreichend geladen ist.</p>
                ${this.editForm.allow_battery ? html`
                <div class="form-row" style="margin-top: 15px;">
                    <div class="form-group flex-2">
                        <label>Batterie SOC-Sensor (Ladezustand in %)</label>
                        <openkairo-entity-picker name="battery_sensor" placeholder="-- Batterie % Sensor suchen --" .value="${this.editForm.battery_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                    </div>
                    <div class="form-group flex-1">
                        <label>Mindest-Ladestand (%)</label>
                        <input type="number" min="0" max="100" name="battery_min_soc" .value="${this.editForm.battery_min_soc || 50}" @input="${this.handleFormInput}">
                        <small>Unter diesem SOC wird der Miner abgeschaltet, auch wenn noch PV vorhanden ist.</small>
                    </div>
                </div>
                ` : ''}
            </div>

            <div class="form-row mt-3" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                <div class="form-group flex-1">
                    <label>Abschaltverzögerung (Minuten)</label>
                    <input type="number" min="0" step="1" name="delay_minutes" .value="${this.editForm.delay_minutes !== undefined ? this.editForm.delay_minutes : 5}" @input="${this.handleFormInput}">
                    <small>Erst ausschalten wenn Überschuss X Minuten lang unter der Schwelle bleibt. Verhindert häufiges Schalten bei Wolken.</small>
                </div>
                <div class="form-group flex-1">
                    <label>🛡️ Min. Laufzeit (Minuten)</label>
                    <input type="number" min="0" step="1" name="min_run_time" .value="${this.editForm.min_run_time || 5}" @input="${this.handleFormInput}">
                    <small>Schont Netzteile.</small>
                </div>
            </div>

            <div style="margin-top: 20px; padding: 15px; border: 1px dashed rgba(var(--theme-accent-1-rgb), 0.3); border-radius: 8px; background: rgba(var(--theme-accent-1-rgb), 0.05); margin-bottom: 20px;">
                <h4 style="margin: 0 0 15px 0; color: var(--theme-accent-1); display: flex; align-items: center; gap: 8px;">🏷️ Grid Price Awareness (Tibber/Awattar)</h4>
                <div class="form-row">
                    <div class="form-group flex-2">
                        <label>Preis-Sensor (z.B. sensor.tibber_price)</label>
                        <openkairo-entity-picker name="electricity_price_sensor" placeholder="-- Preis-Sensor suchen --" .value="${this.editForm.electricity_price_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                    </div>
                    <div class="form-group flex-1">
                        <label>Limit (Erlaubt bis €)</label>
                        <input type="number" step="0.01" name="grid_price_limit" .value="${this.editForm.grid_price_limit}" @input="${this.handleFormInput}">
                    </div>
                </div>
                <small style="color: #888;">Ermöglicht Mining bei günstigen Netzpreisen, auch ohne PV-Überschuss.</small>
            </div>

            <!-- Live-Tracking Block -->
            ${this.editForm.power_entity ? html`
            <div style="margin-top: 15px; padding: 14px; background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.25); border-radius: 8px;">
                <div style="color: #00ff88; font-weight: bold; margin-bottom: 6px;">⚡ Leistungs-Tracking aktiv</div>
                <p style="font-size: 0.85em; color: #bbb; margin: 0 0 12px 0;">Leistung wird automatisch dem PV-Überschuss nachgeführt. Kein weiteres Einrichten nötig.</p>
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label>Skalierungs-Faktor</label>
                        <input type="number" name="scaling_factor" min="0.1" max="1.0" step="0.01" .value="${this.editForm.scaling_factor !== undefined ? this.editForm.scaling_factor : 0.95}" @input="${this.handleFormInput}">
                        <small>Anteil des Überschusses für den Miner (Standard: 0.95 = 95%)</small>
                    </div>
                    <div class="form-group flex-1">
                        <label>Skalierungs-Modus</label>
                        <select name="scaling_mode" @change="${this.handleFormInput}">
                            <option value="proportional" ?selected="${(this.editForm.scaling_mode || 'proportional') === 'proportional'}">Proportional (empfohlen)</option>
                            <option value="steps" ?selected="${this.editForm.scaling_mode === 'steps'}">Stufen</option>
                        </select>
                    </div>
                </div>
            </div>
            ` : html`
            <div style="margin-top: 15px; padding: 12px; background: rgba(255,152,0,0.05); border: 1px dashed rgba(255,152,0,0.3); border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.3em;">⚠️</span>
                <span style="font-size: 0.85em; color: #bbb;">Für Live-Tracking (Leistung folgt dem Überschuss): unter <strong style="color: #ff9800;">Sensoren &amp; Steuerung</strong> einen <strong>Power-Limit Sensor</strong> auswählen.</span>
            </div>
            `}
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

        ${this.editForm.mode === 'offgrid' ? html`
          <div class="mode-section btc-section" style="border-color: #ff9800; background: rgba(255, 152, 0, 0.05);">
            <h3 style="color: #ff9800; margin-top: 0; margin-bottom: 20px;">🏝️ Offgrid PV (SOC Kurve) (Beta)</h3>
            <p style="font-size: 0.85em; color: #bbb; margin-bottom: 15px;">Ideal für Inselsysteme. Der Miner agiert als "Dump-Load" und erhöht seine Leistung linear zum Batteriefüllstand.</p>
            
            <div class="form-group">
                <label>Batterie SOC-Sensor (Ladezustand in %)</label>
                <openkairo-entity-picker name="battery_sensor" placeholder="-- Batterie % Sensor suchen --" .value="${this.editForm.battery_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
            </div>

            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Einschalten ab SOC (%)</label>
                    <input type="number" name="offgrid_soc_start" min="0" max="100" .value="${this.editForm.offgrid_soc_start || 90}" @input="${this.handleFormInput}">
                    <small>Startet mit Minimal-Leistung.</small>
                </div>
                <div class="form-group flex-1">
                    <label>Ausschalten ab SOC (%)</label>
                    <input type="number" name="offgrid_soc_stop" min="0" max="100" .value="${this.editForm.offgrid_soc_stop || 85}" @input="${this.handleFormInput}">
                    <small>Sicherheits-Stopp.</small>
                </div>
            </div>

            <div class="form-row mt-3">
                <div class="form-group flex-1">
                    <label>SOC Mittel-Punkt (%)</label>
                    <input type="number" name="offgrid_soc_mid" min="0" max="100" .value="${this.editForm.offgrid_soc_mid || 94}" @input="${this.handleFormInput}">
                    <small>Optionaler Zwischenschritt.</small>
                </div>
                <div class="form-group flex-1">
                    <label>SOC für Max-Leistung (%)</label>
                    <input type="number" name="offgrid_soc_max" min="0" max="100" .value="${this.editForm.offgrid_soc_max || 98}" @input="${this.handleFormInput}">
                    <small>Punkt für maximale Leistung.</small>
                </div>
            </div>

            <div class="form-row mt-3">
                <div class="form-group flex-1">
                    <label>Minimal-Leistung (Watt)</label>
                    <input type="number" name="offgrid_min_power" .value="${this.editForm.offgrid_min_power || 400}" @input="${this.handleFormInput}">
                </div>
                <div class="form-group flex-1">
                    <label>Mittlere Leistung (Watt)</label>
                    <input type="number" name="offgrid_mid_power" .value="${this.editForm.offgrid_mid_power || 800}" @input="${this.handleFormInput}">
                </div>
                <div class="form-group flex-1">
                    <label>Maximal-Leistung (Watt)</label>
                    <input type="number" name="offgrid_max_power" .value="${this.editForm.offgrid_max_power || 1400}" @input="${this.handleFormInput}">
                </div>
            </div>

            <div class="form-group mt-3" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                <label>Update-Intervall (Sekunden)</label>
                <input type="number" min="15" step="1" name="soft_interval" .value="${this.editForm.soft_interval || 60}" @input="${this.handleFormInput}">
                <small>Wie oft soll die Leistung angepasst werden?</small>
            </div>
          </div>
        ` : ''}

        ${this.editForm.mode === 'heating' ? html`
          <div class="mode-section btc-section" style="border-color: #e67e22; background: rgba(230, 126, 34, 0.05);">
            <h3 style="color: #e67e22; margin-top: 0; margin-bottom: 20px;">🔥 Heiz-Modus (Temperatur-Steuerung)</h3>
            <p style="font-size: 0.85em; color: #bbb; margin-bottom: 15px;">Nutze deinen Miner als Heizung. Er schaltet sich automatisch ein, wenn es zu kalt wird.</p>
            
            <div class="form-group">
                <label>Raumtemperatur-Sensor</label>
                <openkairo-entity-picker name="target_temp_sensor" placeholder="-- Temperatur Sensor suchen --" .value="${this.editForm.target_temp_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                ${this.editForm.target_temp_sensor && this.hass?.states[this.editForm.target_temp_sensor] ? html`
                <div style="margin-top: 6px; padding: 6px 10px; background: rgba(230,126,34,0.1); border-radius: 6px; font-size: 0.85em; color: #e67e22;">
                    📍 Aktuell: <strong>${this.hass.states[this.editForm.target_temp_sensor].state} °C</strong>
                </div>` : ''}
            </div>

            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Einschalten unterhalb (°C)</label>
                    <input type="number" step="0.5" name="target_temp_on" .value="${this.editForm.target_temp_on || 21.0}" @input="${this.handleFormInput}">
                </div>
                <div class="form-group flex-1">
                    <label>Ausschalten oberhalb (°C)</label>
                    <input type="number" step="0.5" name="target_temp_off" .value="${this.editForm.target_temp_off || 22.0}" @input="${this.handleFormInput}">
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
                        <input type="number" min="0" max="100" name="battery_min_soc" .value="${this.editForm.battery_min_soc || 50}" @input="${this.handleFormInput}">
                        <small>Nur heizen bei SOC ≥ X%.</small>
                    </div>
                </div>
                ` : html`
                <p style="margin: 8px 0 0 30px; font-size: 0.85em; color: #888;">Ermöglicht Heizen nur dann, wenn der Hausakku ausreichend geladen ist.</p>
                `}
            </div>

            <div class="form-row mt-3" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                <div class="form-group flex-1">
                    <label>Verzögerung (Hysterese in Minuten)</label>
                    <input type="number" min="0" step="1" name="delay_minutes" .value="${this.editForm.delay_minutes !== undefined ? this.editForm.delay_minutes : 5}" @input="${this.handleFormInput}">
                    <small>Verhindert zu häufiges Schalten.</small>
                </div>
                <div class="form-group flex-1">
                    <label>🛡️ Min. Laufzeit (Minuten)</label>
                    <input type="number" min="0" step="1" name="min_run_time" .value="${this.editForm.min_run_time || 5}" @input="${this.handleFormInput}">
                    <small>Schont die Hardware.</small>
                </div>
            </div>
          </div>
        ` : ''}

        ${this.editForm.mode === 'ai_discharge' ? html`
          <div class="mode-section btc-section" style="border-color: #9b59b6; background: rgba(155, 89, 182, 0.05);">
            <h3 style="color: #9b59b6; margin-top: 0; margin-bottom: 20px;">🤖 AI Akku-Optimierer (Intelligentes Entladen) (Beta)</h3>
            <p style="font-size: 0.85em; color: #bbb; margin-bottom: 15px;">
                Die KI berechnet anhand des historischen Hausverbrauchs, wann der Miner nachts starten muss, 
                damit der Akku morgens genau den Zielwert erreicht.
            </p>
            
            <div class="form-row">
                <div class="form-group flex-2">
                    <label>Hausakku SOC-Sensor (%)</label>
                    <openkairo-entity-picker name="battery_sensor" placeholder="-- Batterie % Sensor --" .value="${this.editForm.battery_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                    ${this.editForm.battery_sensor && this.hass?.states[this.editForm.battery_sensor] ? html`
                    <div style="margin-top: 6px; padding: 6px 10px; background: rgba(155,89,182,0.1); border-radius: 6px; font-size: 0.85em; color: #9b59b6;">
                        🔋 Aktuell: <strong>${this.hass.states[this.editForm.battery_sensor].state} %</strong>
                    </div>` : ''}
                </div>
                <div class="form-group flex-1">
                    <label>Akku Kapazität (kWh)</label>
                    <input type="number" step="0.1" name="battery_capacity" .value="${this.editForm.battery_capacity || 10}" @input="${this.handleFormInput}">
                    <small>Nutzbare Kapazität des Akkus.</small>
                </div>
            </div>

            <div class="form-group">
                <label>Stromverbrauch-Sensor Haus/Akku (Watt)</label>
                <openkairo-entity-picker name="battery_power_sensor" placeholder="-- Entlade-Leistung Sensor (W) --" .value="${this.editForm.battery_power_sensor || ''}" .entities="${sensorOptions}" @change="${this.handleFormInput}"></openkairo-entity-picker>
                <small>Wird für die historische Analyse des Nachtverbrauchs genutzt.</small>
            </div>

            <div class="form-row">
                <div class="form-group flex-1">
                    <label>Ziel-Uhrzeit (Morgens)</label>
                    <input type="time" name="target_time" .value="${this.editForm.target_time || '07:00'}" @input="${this.handleFormInput}">
                    <small>Wann soll der Akku den Ziel-SOC erreicht haben?</small>
                </div>
                <div class="form-group flex-1">
                    <label>Ziel-SOC am Morgen (%)</label>
                    <input type="number" min="0" max="100" name="target_soc" .value="${this.editForm.target_soc || 10}" @input="${this.handleFormInput}">
                    <small>Restladung im Akku.</small>
                </div>
            </div>

            <div class="form-group mt-3" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                <label>⚡ Voraussichtlicher Miner-Verbrauch (Watt)</label>
                <input type="number" name="soft_target_power" .value="${this.editForm.soft_target_power || this.editForm.max_power || (this.editForm.name && this.editForm.name.toLowerCase().includes('nerd') ? 2 : 1200)}" @input="${this.handleFormInput}">
                <small>Für die KI-Berechnung (Standard: Max. Leistung des Miners). Für Nerdminer/Bitaxe manuell anpassen.</small>
            </div>

            <div class="form-group mt-3" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #9b59b6; font-weight: bold;">
                    <input type="checkbox" name="weather_optimization_enabled" .checked="${this.editForm.weather_optimization_enabled}" @change="${this.handleFormInput}" style="width: 20px; height: 20px; accent-color: #9b59b6;">
                    Wetter-Optimierung (Beta)
                </label>
                <p style="color: #888; font-size: 0.85em; margin-top: 10px;">
                    Bezieht die Solar-Prognose für morgen in die Planung ein. Wenn viel Sonne gemeldet wird, 
                    darf der Akku nachts tiefer entladen werden.
                </p>
                
                ${this.editForm.weather_optimization_enabled ? html`
                <div class="form-group mt-3">
                    <label>PV-Anlagengröße (kWp)</label>
                    <input type="number" step="0.1" name="pv_peak_power" .value="${this.editForm.pv_peak_power || 10}" @input="${this.handleFormInput}">
                    <small>Wird zur Schätzung des morgigen Ertrags genutzt.</small>
                </div>
                
                <div class="form-group mt-3">
                    <label>Manueller Standort (Breitengrad / Längengrad)</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="number" step="0.0001" placeholder="Lat (z.B. 51.5)" name="weather_lat" .value="${this.editForm.weather_lat || ''}" @input="${this.handleFormInput}">
                        <input type="number" step="0.0001" placeholder="Lon (z.B. 7.2)" name="weather_lon" .value="${this.editForm.weather_lon || ''}" @input="${this.handleFormInput}">
                    </div>
                    <small>Tipp: Leer lassen, um Home Assistant Standard zu nutzen.</small>
                </div>
                ` : ''}
            </div>

            <div class="form-group mt-2">
                <label>🛡️ Min. Laufzeit (Minuten)</label>
                <input type="number" min="0" step="1" name="min_run_time" .value="${this.editForm.min_run_time || 15}" @input="${this.handleFormInput}">
                <small>Schont die Hardware.</small>
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

            <div class="form-group mt-3">
                <label>Watchdog-Aktion (Was soll passieren?)</label>
                <select class="btc-select" name="watchdog_action" @change="${this.handleFormInput}">
                  <option value="off"              ?selected="${(this.editForm.watchdog_action || 'off') === 'off'}">🛑 Nur ausschalten — bleibt aus bis Modus-Regel greift (Standard)</option>
                  <option value="toggle"           ?selected="${this.editForm.watchdog_action === 'toggle'}">🔄 Neustart — Steckdose kurz aus/an</option>
                  <option value="reboot"           ?selected="${this.editForm.watchdog_action === 'reboot'}">⚡ Hardware-Reboot — API-Befehl direkt an Miner</option>
                  <option value="restart_backend"  ?selected="${this.editForm.watchdog_action === 'restart_backend'}">🔧 Backend-Neustart — nur Mining-Software neu starten</option>
                </select>
                <small>
                  ${(this.editForm.watchdog_action || 'off') === 'off'
                    ? 'Miner wird ausgeschaltet und bleibt aus. PV/SOC-Regel entscheidet wann er wieder startet.'
                    : (this.editForm.watchdog_action === 'reboot' || this.editForm.watchdog_action === 'restart_backend')
                      ? 'Benötigt eine konfigurierte Miner-IP.'
                      : 'Steckdose geht 5 Sekunden aus und wieder an — Miner bootet neu.'}
                </small>
            </div>
            ` : ''}
        </div>


        ${this.editForm.soft_continuous_scaling ? html`
        <!-- Leistungs-Skalierung -->
        <div class="mode-section btc-section" style="margin-top: 20px; border-color: rgba(var(--theme-accent-4-rgb, 0, 255, 136), 0.3); background: rgba(0, 255, 136, 0.02);">
          <h3 style="color: var(--theme-accent-4); margin-top: 0; margin-bottom: 5px;">⚡ Leistungs-Skalierung (Kontinuierlich)</h3>
          <p style="color: #bbb; font-size: 0.85em; margin-bottom: 20px;">Steuert wie smooth die Leistung an PV/SOC-Änderungen angepasst wird.</p>
          <div class="form-row">
            <div class="form-group flex-1">
              <label>Skalierungs-Modus</label>
              <select name="scaling_mode" @change="${this.handleFormInput}">
                <option value="steps" ?selected="${(this.editForm.scaling_mode || 'steps') === 'steps'}">Stufen (Standard)</option>
                <option value="proportional" ?selected="${this.editForm.scaling_mode === 'proportional'}">Proportional (PV-Tracking)</option>
              </select>
              <small>Proportional: Leistung ≈ PV-Wert × Faktor. Stufen: springt zwischen den konfigurierten Abstufungen.</small>
            </div>
            <div class="form-group flex-1">
              <label>Skalierungs-Faktor</label>
              <input type="number" name="scaling_factor" min="0.1" max="2.0" step="0.01" .value="${this.editForm.scaling_factor !== undefined ? this.editForm.scaling_factor : 0.95}" @input="${this.handleFormInput}">
              <small>Anteil der PV-Leistung für den Miner (Standard: 0.95 = 95%). Nur im Proportional-Modus.</small>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group flex-1">
              <label>Max. Änderung pro Tick (Watt)</label>
              <input type="number" name="power_step_limit" min="0" step="50" .value="${this.editForm.power_step_limit || 0}" @input="${this.handleFormInput}">
              <small>Rate-Limiting: Begrenzt die Leistungsänderung pro 15s-Zyklus. 0 = unbegrenzt (sofort).</small>
            </div>
            <div class="form-group flex-1" style="display: flex; flex-direction: column; justify-content: center; padding-top: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 6px;">
                <input type="checkbox" name="soc_proportional_scaling" .checked="${this.editForm.soc_proportional_scaling || false}" @change="${this.handleFormInput}" style="width: 16px; height: 16px; accent-color: var(--theme-accent-4);">
                <b>SOC-proportionale Skalierung</b>
              </label>
              <small>Im SOC-Modus: Leistung linear zum aktuellen Ladestand skalieren statt Schwellwert-Logik.</small>
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

  renderActivityTicker() {
    if (!this.logs || !Array.isArray(this.logs) || this.logs.length === 0) return '';
    // Duplicate logs for seamless looping on wide screens
    const tripledLogs = [...this.logs, ...this.logs, ...this.logs];
    return html`
      <div class="activity-ticker">
        <div class="activity-ticker-content">
          ${tripledLogs.map(log => html`<div class="activity-ticker-item">${log}</div>`)}
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

                if (miner.is_solo) {
                   // Solo miners don't yield crypto earnings in stats
                   powerKW = 0;
                   hashrateTH = 0;
                } else if (simModel === 'manual') {
                   powerKW = manualInput.power / 1000;
                   hashrateTH = manualInput.hashrate;
                } else if (simModel === 'sensor') {
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
          ${this.config.miners && this.config.miners.length > 0 ? this.config.miners.map(miner => {
            const domain = 'openkairo_mining';
            const _ipForSlug = miner.miner_ip || (miner.switch && miner.switch.includes('.') ? miner.switch : '');
            const _ipSlug = _ipForSlug ? _ipForSlug.replace(/\./g, '_') : '';
            let effectiveSwitch = miner.switch;
            if (!effectiveSwitch && _ipSlug) {
              effectiveSwitch = `switch.${domain}_${_ipSlug}_switch`;
            }
            return html`
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

              ${effectiveSwitch && this.hass?.states[effectiveSwitch] ? this.renderActivityHeatmap(effectiveSwitch) : ''}
            </div>
          `;
          }) : html`<p class="empty-text">Noch keine Miner vorhanden.</p>`}
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
        background: rgba(0, 0, 0, 0.4);
        border-bottom: 1px solid rgba(var(--theme-accent-1-rgb), 0.2);
        height: 38px;
        overflow: hidden;
        position: relative;
        z-index: 101;
        display: flex;
        align-items: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        margin-bottom: 25px;
        border-radius: 8px;
      }

      .activity-ticker-content {
        display: flex;
        white-space: nowrap;
        animation: ticker-scroll 60s infinite linear;
      }

      .activity-ticker-item {
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
        .activity-ticker-content {
          animation: none;
          justify-content: center;
          padding: 0 20px;
        }
        .activity-ticker-item {
          margin-right: 40px;
          letter-spacing: 1px;
        }
        /* Hide duplicated logs on desktop to keep it static and clean */
        .activity-ticker-item:nth-child(n+21) {
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
      
      .overview-section {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
        padding: 0 20px;
        margin-bottom: 20px;
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
        background: rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 10px;
        padding: 5px 25px;
        margin: 5px 0 15px 0;
        overflow: hidden;
        position: relative;
        box-shadow: inset 0 2px 10px rgba(0,0,0,0.4);
        /* Removed backdrop-filter */
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
      :host { overflow: hidden; }
      .dashboard-container { 
        width: 100%; 
        max-width: 100vw; 
        overflow-x: hidden; 
        position: relative;
        box-sizing: border-box;
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
        /* Removed backdrop-filter */
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
      
      .content { 
        max-width: 1600px; 
        margin: 80px auto 0 auto;
      }
      
      /* Techy Cards */
      .card { 
        background: var(--theme-bg-card); 
        border-radius: var(--theme-radius); 
        padding: 35px; 
        box-shadow: 0 25px 60px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.08); 
        margin-bottom: 25px; 
        border: 1px solid var(--theme-border-color); 
        position: relative;
        overflow: hidden;
      }
      .card::after {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%);
        pointer-events: none;
      }
      .card h2 { 
        margin-top: 0; 
        font-size: 2em;
        color: var(--theme-primary); 
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 30px;
        font-weight: 950;
        letter-spacing: -0.5px;
        text-shadow: 0 0 20px rgba(var(--theme-primary-rgb), 0.4);
      }
      
      .empty-state { text-align: center; padding: 60px 20px; color: var(--theme-text-dim); border: 1px dashed var(--theme-border-color); }
      
      .dashboard-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 20px;
      }
      
      /* Grid for Miners Dashboard */
      .overview-section {
        display: grid; 
        grid-template-columns: repeat(4, 1fr); 
        gap: 15px; 
        margin-bottom: 25px;
      }

      .miners-grid { 
        display: grid; 
        grid-template-columns: repeat(3, 1fr); 
        gap: 25px; 
        width: 100%;
      }

      /* Responsive Adjustments */
      @media (max-width: 1400px) {
        .overview-section { grid-template-columns: repeat(2, 1fr); }
        .miners-grid { grid-template-columns: repeat(2, 1fr); }
      }
      
      @media (max-width: 850px) {
        .overview-section { grid-template-columns: 1fr; }
        .miners-grid { grid-template-columns: 1fr; }
        .content { margin-top: 20px; }
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
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
        overflow: hidden;
      }
      .miner-card:hover { 
        border-color: var(--theme-primary); 
        transform: translateY(-5px) scale(1.015); 
        box-shadow: 0 15px 45px rgba(var(--theme-primary-rgb), 0.15);
      }
      
      /* Dynamischer Overflow für Dropdowns (iPad UI Fix) */
      .card:focus-within, .miner-card:focus-within, .tech-box:focus-within,
      .card:has(openkairo-entity-picker[open]), .miner-card:has(openkairo-entity-picker[open]), .tech-box:has(openkairo-entity-picker[open]) {
        overflow: visible !important;
        z-index: 999;
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
      .miner-header h3 { margin: 0; font-size: 1.5em; color: var(--theme-text-main); text-shadow: 0 0 10px rgba(0,0,0,0.5); }
      .status-badge { 
        padding: 15px 30px; border-radius: 40px; font-weight: 950; 
        background: rgba(0,0,0,0.6); color: var(--theme-text-dim); text-align: center; width: 100%; font-size: 1.2em;
        letter-spacing: 2px; border: 1px solid rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 10px 25px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.1);
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        text-transform: uppercase;
        margin-bottom: 25px;
      }
      .status-badge.on { 
        background: rgba(0,0,0,0.7); color: #fff; 
        border-color: rgba(var(--theme-accent-1-rgb), 0.5); 
        box-shadow: 0 0 30px rgba(var(--theme-accent-1-rgb), 0.2), inset 0 0 15px rgba(var(--theme-accent-1-rgb), 0.1);
        animation: status-breathing 4s infinite ease-in-out;
      }
      .status-badge.standby { 
        background: rgba(0,0,0,0.5); color: var(--theme-accent-3, #ffcc00); 
        border-color: rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.3); 
      }
      .status-badge.off { 
        background: rgba(231, 76, 60, 0.08); color: #e74c3c; 
        border-color: rgba(231, 76, 60, 0.25); 
        box-shadow: inset 0 2px 10px rgba(231, 76, 60, 0.05);
      }
      @keyframes status-breathing {
        0%, 100% { transform: scale(1); opacity: 0.9; }
        50% { transform: scale(1.02); opacity: 1; box-shadow: 0 0 25px rgba(var(--theme-accent-2-rgb), 0.25); }
      }
      
      /* Card Level State Effects */
      .card.is-on {
        border-color: rgba(var(--theme-accent-2-rgb), 0.3);
        box-shadow: 0 15px 45px rgba(0,0,0,0.4), 0 0 30px rgba(var(--theme-accent-2-rgb), 0.08);
      }
      
      .card.is-on::after {
        content: ""; position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px;
        background: linear-gradient(45deg, transparent, rgba(var(--theme-accent-2-rgb), 0.2), transparent);
        border-radius: inherit; z-index: -1; pointer-events: none;
        animation: border-flow 6s linear infinite;
        background-size: 200% 200%;
      }
      
      @keyframes border-flow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      
      .card.is-standby {
        filter: saturate(0.7);
        border-color: rgba(var(--theme-accent-3-rgb), 0.2);
        animation: standby-pulse 8s infinite ease-in-out;
      }
      
      @keyframes standby-pulse {
        0%, 100% { opacity: 1; transform: translateY(0); }
        50% { opacity: 0.85; transform: translateY(2px); }
      }
      
      .card.is-ramping {
        border-color: var(--theme-primary);
        animation: ramping-glow 2s infinite alternate ease-in-out;
      }
      
      @keyframes ramping-glow {
        0% { box-shadow: 0 10px 30px rgba(0,0,0,0.3); border-color: rgba(var(--theme-primary-rgb), 0.2); }
        100% { box-shadow: 0 0 40px rgba(var(--theme-primary-rgb), 0.2); border-color: var(--theme-primary); }
      }

      .pulse-orange { 
        animation: pulse-orange 2s infinite; 
        background: rgba(var(--theme-primary-rgb), 0.12) !important;
        color: var(--theme-primary) !important;
        border-color: rgba(var(--theme-primary-rgb), 0.5) !important;
      }
      @keyframes pulse-orange {
        0% { box-shadow: 0 0 0 0 rgba(var(--theme-primary-rgb), 0.3); }
        70% { box-shadow: 0 0 0 12px rgba(var(--theme-primary-rgb), 0); }
        100% { box-shadow: 0 0 0 0 rgba(var(--theme-primary-rgb), 0); }
      }
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.6; }
        100% { opacity: 1; }
      }

      .btn-power {
        background: rgba(30, 30, 35, 0.5); border: 1px solid var(--theme-border-color); border-radius: var(--theme-radius); color: var(--theme-text-dim);
        font-size: 1.5em; padding: 0 20px; cursor: pointer; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        display: flex; align-items: center; justify-content: center;
        /* Removed backdrop-filter */
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      }
      .btn-power:hover { background: rgba(50,50,55,0.7); color: var(--theme-primary); border-color: var(--theme-primary); transform: translateY(-3px); box-shadow: 0 8px 25px rgba(var(--theme-primary-rgb), 0.2); }
      .btn-power:active { transform: translateY(-1px) scale(0.95); }
      .btn-power.on { color: var(--theme-accent-2); border-color: rgba(var(--theme-accent-2-rgb), 0.5); background: rgba(var(--theme-accent-2-rgb), 0.12); box-shadow: 0 0 25px rgba(var(--theme-accent-2-rgb), 0.2); }
      
      .miner-details p { margin: 10px 0; font-size: 0.95em; color: var(--theme-text-dim); }
      .accent-text { color: var(--theme-primary); font-weight: 800; text-shadow: 0 0 8px rgba(var(--theme-primary-rgb), 0.3); letter-spacing: 0.5px; }
      
      .api-stats {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; 
        background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; margin-bottom: 25px; 
        border: 1px solid rgba(255,255,255,0.05);
        box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
      }
      .api-stats .stat { display: flex; flex-direction: column; align-items: center; }
      .api-stats .lbl { font-size: 0.6em; color: var(--theme-text-dim); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; opacity: 0.5; margin-bottom: 4px; }
      .api-stats .val { font-size: 1.25em; font-weight: 900; color: var(--theme-accent-1); font-family: 'Space Mono', monospace; text-shadow: 0 0 10px rgba(var(--theme-accent-1-rgb), 0.3); }
      
      /* New: Mining Sparkle Effect */
      .card.is-on::before {
        content: "₿"; position: absolute; top: 10px; left: 10px; font-size: 1.2em;
        color: var(--theme-accent-2); opacity: 0; animation: mining-sparkle 3s infinite;
        z-index: 5; font-weight: bold; pointer-events: none;
      }
      
      @keyframes mining-sparkle {
        0% { opacity: 0; transform: translateY(0) scale(0.5); }
        50% { opacity: 0.5; transform: translateY(-10px) scale(1.2); }
        100% { opacity: 0; transform: translateY(-20px) scale(0.5); }
      }
      
      /* New: Standby Sleep Effect */
      .card.is-standby .miner-header h3::after {
        content: "💤"; font-size: 0.6em; margin-left: 8px; opacity: 0.6;
        animation: zzz-float 4s infinite; display: inline-block;
      }
      
      @keyframes zzz-float {
        0% { transform: translateY(0) scale(1); opacity: 0; }
        50% { transform: translateY(-5px) scale(1.1); opacity: 0.6; }
        100% { transform: translateY(-10px) scale(1.2); opacity: 0; }
      }

      .btn-control {
        background: rgba(30, 30, 35, 0.6); border: 1px solid var(--theme-border-color); border-radius: 10px; color: var(--theme-text-dim);
        font-size: 0.8em; padding: 10px 14px; cursor: pointer; transition: all 0.3s;
        font-weight: 800; letter-spacing: 1px; flex: 1; text-align: center;
        text-transform: uppercase;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
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

      @keyframes scanline {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100%); }
      }

      @keyframes tickerScroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }

      .tech-box {
        background: rgba(0,0,0,0.25);
        border: 1px solid var(--theme-border-color);
        padding: 15px;
        border-radius: 12px;
        margin-top: 20px;
        box-shadow: inset 0 2px 15px rgba(0,0,0,0.3);
      }
      .tech-input {
        width: 70px; 
        padding: 4px 8px; 
        background: rgba(0,0,0,0.5); 
        border: 1px solid #444; 
        color: var(--theme-primary); 
        border-radius: 4px; 
        font-weight: bold;
        font-family: monospace;
        outline: none;
        transition: border-color 0.2s;
      }
      .tech-input:focus { border-color: var(--theme-primary); }
      
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
      
      .overview-cards-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        margin-bottom: 30px;
      }
      .stat-card {
        background: rgba(0,0,0,0.4);
        border-radius: 12px;
        padding: 22px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        position: relative;
        transition: transform 0.3s;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 140px;
        border: 1px solid rgba(255,255,255,0.05);
      }
      .stat-card:hover { transform: translateY(-5px); border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); }
      .stat-card .lbl { font-size: 0.85em; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
      .stat-card .stat-val { font-size: 2.8em; font-weight: 950; line-height: 1; margin: 10px 0; font-family: 'Space Mono', monospace; }
      .stat-card .unit { font-size: 1.3em; opacity: 0.8; font-weight: 800; align-self: flex-end; color: #fff; }
      .stat-card .sub-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: auto; }
      .stat-card .sub-val { font-size: 1.1em; opacity: 0.8; font-family: 'Space Mono', monospace; }
      .stat-card .card-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
      .stat-card .badge { font-size: 0.65em; padding: 4px 8px; border-radius: 6px; font-weight: 950; letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; }
      

      /* Custom Range Slider */
      input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
      input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 24px; width: 24px; border-radius: 50%;
        background: #fff; cursor: pointer; margin-top: -10px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5), 0 0 15px rgba(var(--theme-accent-1-rgb), 0.5);
        border: 3px solid var(--theme-accent-1);
        transition: transform 0.2s;
      }
      input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.1); }
      input[type=range]::-webkit-slider-runnable-track {
        width: 100%; height: 6px; cursor: pointer;
        background: rgba(255,255,255,0.08); border-radius: 10px;
      }
      
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
        .header h1 { font-size: 1.8em; }
        .header { margin-bottom: 20px; }
        .subtitle { font-size: 0.9em; letter-spacing: 1px; }
        
        .tabs { 
          display: flex;
          overflow-x: auto;
          white-space: nowrap;
          gap: 10px; 
          margin-bottom: 20px; 
          padding: 5px 2px 15px 2px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none; /* Firefox */
          mask-image: linear-gradient(to right, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, black 85%, transparent);
        }
        .tabs::-webkit-scrollbar { display: none; } /* Chrome/Safari */

        .tab { 
          padding: 10px 18px; 
          font-size: 0.9em; 
          flex: 0 0 auto;
          min-width: auto;
          max-width: none;
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

      /* Mobile back button - hidden on desktop */
      .mobile-back-btn {
        display: none;
      }

      /* Bitcoin Ticker Styles */
      .ticker-container {
        display: flex;
        justify-content: space-around;
        align-items: center;
        background: rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 15px 40px;
        margin: 10px 0 25px 0;
        box-shadow: inset 0 2px 20px rgba(0,0,0,0.8);
      }
      .ticker-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 25px;
        border-right: 1px solid rgba(255,255,255,0.05);
      }
      .ticker-item:last-child { border-right: none; }
      .ticker-label { color: #555; font-weight: 900; text-transform: uppercase; font-size: 0.65em; letter-spacing: 2px; }
      .ticker-val { color: #fff; font-weight: 900; font-family: 'Space Mono', monospace; font-size: 1.1em; letter-spacing: 1px; }
      .ticker-divider { color: rgba(255,255,255,0.2); margin: 0 5px; }

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
          grid-template-columns: 1fr !important; 
          gap: 12px !important; 
          margin-bottom: 20px !important;
        }
        .overview-section .card { padding: 18px !important; }
        .overview-section .card div:nth-child(2) { font-size: 1.8em !important; margin-top: 8px !important; }
        .overview-section .card span { font-size: 0.7em !important; }
        
        .tabs { margin: 0 5px 15px 5px !important; gap: 8px !important; }

        .tab { padding: 10px 5px !important; font-size: 0.8em !important; flex: 1 1 45% !important; border-radius: 8px !important; }
        
        .ticker-container { 
          padding: 8px 0 !important;
          margin: 0 !important;
          border-radius: 0 !important;
          background: rgba(0,0,0,0.4) !important;
          border-left: none !important;
          border-right: none !important;
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }
        .ticker-container .ticker-content {
          animation: tickerScroll 35s linear infinite;
          width: auto !important;
          justify-content: flex-start !important;
          gap: 40px !important;
          font-size: 0.8em !important;
          letter-spacing: 1px !important;
        }
        .ticker-mobile-extra {
          display: flex !important;
          align-items: center;
          gap: 60px;
        }
        .ticker-container .ticker-content:hover { animation-play-state: paused; }
        .activity-ticker-content {
          animation: ticker-scroll 80s linear infinite !important;
          white-space: nowrap;
        }
        .activity-ticker-item {
          margin-right: 8vw !important;
          font-size: 0.75em !important;
        }
        
        .miner-card { padding: 15px !important; margin-bottom: 12px !important; }
        .miner-header { flex-direction: column; align-items: flex-start; gap: 8px; }
        .btn-mining { padding: 12px !important; font-size: 1.0em !important; letter-spacing: 1px !important; }
        
        .stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
        .stat-card { padding: 12px !important; min-height: 100px; }
        .stat-val { font-size: 1.2em !important; }
        .stat-card .lbl { font-size: 0.55em !important; }

        .overview-cards-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; margin-bottom: 20px !important; }
        
        .sponsoring-header { 
          grid-template-columns: 1fr !important; 
          padding: 15px !important; 
          gap: 10px !important;
          margin-bottom: 15px !important;
        }
        .header-left { flex-direction: column !important; gap: 10px !important; align-items: center !important; text-align: center !important; }
        .header-center { display: none !important; } 
        .header-right { text-align: center !important; align-items: center !important; margin-top: 5px !important; }
        .header-right h1 { font-size: 1.5em !important; }
        .portfolio-data { text-align: center !important; }
        .portfolio-data div:last-child { font-size: 1.8em !important; }
        
        .tabs { 
          display: grid !important;
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 12px !important;
          margin-bottom: 20px !important;
          width: 100% !important;
          box-sizing: border-box !important;
          padding: 0 5px !important;
        }
        .tab { 
          padding: 14px 10px !important; 
          font-size: 0.85em !important; 
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          border-radius: 12px !important;
          background: rgba(255,255,255,0.04) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3) !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .tab.active {
          background: rgba(var(--theme-accent-1-rgb), 0.15) !important;
          border-color: var(--theme-accent-1) !important;
          color: var(--theme-accent-1) !important;
          box-shadow: 0 0 15px rgba(var(--theme-accent-1-rgb), 0.3) !important;
        }
        .tab ha-icon { --mdc-icon-size: 18px !important; }

        .mobile-back-btn {
          display: flex !important;
          position: fixed !important;
          bottom: 24px !important;
          left: 16px !important;
          z-index: 9999 !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 12px 20px !important;
          background: rgba(var(--theme-accent-1-rgb), 0.92) !important;
          color: #000 !important;
          border: none !important;
          border-radius: 30px !important;
          font-weight: 900 !important;
          font-size: 0.85em !important;
          letter-spacing: 1px !important;
          cursor: pointer !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 15px rgba(var(--theme-accent-1-rgb), 0.3) !important;
          text-transform: uppercase !important;
        }

        .api-stats { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; flex-wrap: unset !important; padding: 10px !important; }
        .api-stats .stat { min-width: unset !important; padding: 5px !important; }
        

        
        .miner-details { grid-template-columns: 1fr !important; }
        
        /* Form Optimierungen */
        .form-row { flex-direction: column !important; gap: 0 !important; }
        .form-group { margin-bottom: 15px !important; width: 100% !important; }
        .form-group input, .form-group select { padding: 14px !important; font-size: 16px !important; } /* 16px prevents iOS zoom */
        
        .tech-input { width: 85px !important; height: 38px !important; font-size: 1.1em !important; }
        .power-limit-box input[type="number"] { width: 85px !important; height: 36px !important; }

        .miner-list-item { 
          flex-direction: column !important; 
          align-items: flex-start !important; 
          gap: 15px !important; 
          padding: 20px !important;
        }
        .miner-list-item .actions { 
          width: 100% !important; 
          justify-content: flex-end !important; 
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-top: 12px;
        }
        .miner-list-item div:first-child { width: 100%; overflow: hidden; }
        .miner-list-item div:first-child p { word-break: break-all; }

        .sponsoring-header { 
          grid-template-columns: 1fr !important; 
          padding: 20px !important; 
          text-align: center !important;
          gap: 15px !important;
        }
        .header-left, .header-center, .header-right { 
          justify-content: center !important; 
          align-items: center !important; 
          text-align: center !important; 
          width: 100%;
        }
        .header-left { flex-direction: column !important; }
        .header-right { margin-top: 10px; }
        .header-right h1 { font-size: 1.8em !important; justify-content: center; }

        /* Watchdog Mobile Optimization */
        .watchdog-controls {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 12px !important;
          margin-top: 15px !important;
        }
        .watchdog-controls span {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          color: var(--theme-text-main);
          font-weight: 600;
        }
        .watchdog-controls .tech-input {
          width: 90px !important;
          height: 40px !important;
          margin: 0 5px;
        }
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
        <span class="ticker-label">Preis:</span>
        <span class="ticker-val" style="color: var(--theme-accent-3); text-shadow: 0 0 10px rgba(var(--theme-accent-3-rgb, 255, 204, 0), 0.3);">
          ${this.btcPriceEur ? this.btcPriceEur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }) : '...'}
        </span>
      </div>
      <div class="ticker-item" title="Empfohlene Gebühren (Fast | Medium | Low)">
        <span class="ticker-label">Gebühren:</span>
        <span class="ticker-val" style="color: var(--theme-accent-1); text-shadow: 0 0 8px rgba(var(--theme-accent-1-rgb), 0.4);">${fees.fastestFee}</span>
        <span class="ticker-divider">/</span>
        <span class="ticker-val">${fees.halfHourFee}</span>
        <span class="ticker-divider">/</span>
        <span class="ticker-val">${fees.hourFee}</span>
        <span style="font-size: 0.7em; opacity: 0.4; margin-left: 2px;">sat/vB</span>
      </div>
      <div class="ticker-item">
        <span class="ticker-label">Höhe:</span>
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
        <span class="ticker-val" style="color: var(--theme-primary); font-family: var(--theme-font);">${halving?.toLocaleString()} <span style="font-size: 0.7em; opacity: 0.5;">Blöcke</span></span>
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


