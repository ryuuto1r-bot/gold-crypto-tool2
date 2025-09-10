window.addEventListener('load', () => {

    // =================================================================
    // I. CORE CLASSES (MODULAR ARCHITECTURE)
    // =================================================================

    class DataCache {
        constructor(maxSize = 200, defaultExpiry = 60000) { this.cache = new Map(); this.maxSize = maxSize; this.defaultExpiry = defaultExpiry; setInterval(() => this.cleanup(), 5 * 60 * 1000); }
        set(key, data, expiry = this.defaultExpiry) { if (this.cache.size >= this.maxSize && !this.cache.has(key)) { const oldestKey = this.cache.keys().next().value; this.cache.delete(oldestKey); } this.cache.set(key, { data, expiry: Date.now() + expiry }); }
        get(key) { const item = this.cache.get(key); if (!item) return null; if (Date.now() > item.expiry) { this.cache.delete(key); return null; } this.cache.delete(key); this.cache.set(key, item); return item.data; }
        clear() { this.cache.clear(); }
        cleanup() { const now = Date.now(); for (const [key, item] of this.cache.entries()) { if (now > item.expiry) this.cache.delete(key); } }
    }

    class SettingsManager {
        constructor() { this.settings = {}; this.timeframeConfigs = {}; this.listeners = new Map(); }
        init() { this.settings.analysis = this.load('analysisSettings', this.getDefaultAnalysisSettings()); this.settings.notification = this.load('notificationSettings', this.getDefaultNotificationSettings()); this.settings.mode = this.load('analysisMode', { current: 'high_accuracy' }); this.timeframeConfigs = this.generateTimeframeConfigs(this.settings.analysis); }
        load(key, defaults) { try { const stored = localStorage.getItem(key); return stored ? { ...defaults, ...JSON.parse(stored) } : defaults; } catch (error) { console.error(`Error loading settings ${key}:`, error); return defaults; } }
        save(key, settings) { try { localStorage.setItem(key, JSON.stringify(settings)); this.settings[key] = settings; if (key === 'analysisSettings') { this.timeframeConfigs = this.generateTimeframeConfigs(settings); } this.notify(key, settings); return true; } catch (error) { console.error(`Error saving settings ${key}:`, error); return false; } }
        get(key) { return this.settings[key]; }
        getTimeframeConfig(timeframeKey) { return this.timeframeConfigs[timeframeKey]; }
        addListener(key, callback) { if (!this.listeners.has(key)) this.listeners.set(key, new Set()); this.listeners.get(key).add(callback); return () => this.listeners.get(key).delete(callback); }
        notify(key, value) { if (this.listeners.has(key)) { this.listeners.get(key).forEach(callback => callback(value)); } }
        getDefaultAnalysisSettings() { return { weights: { ma: 1, macd: 1, rsi: 1, stoch: 1, bb: 1, ichimoku: 1.5, vwap: 1.2, chartPatterns: 2, psar: 1.5, mtaConfirmation: 2, volumeConfirmation: 1.5, divergence: 3, sentiment: 2.5, maSlope: 1.2, mtaAlignment: 3, elderImpulse: 2.2, squeeze: 2.5, obvDivergence: 2.8, pivotPoints: 2.5, fibonacci: 2.2, vwapSignal: 2.0, orderFlow: 3.0, keltner: 1.8 }, params: { highAccuracySignalThreshold: 5.5, scalpingSignalThreshold: 3.5, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, stochPeriod: 14, stochOverbought: 80, stochOversold: 20, bbPeriod: 20, bbStdDev: 2, emaShort: 12, emaLong: 26, smaShort: 20, smaLong: 50, macdSignal: 9, tenkan: 9, kijun: 26, senkouB: 52, psarStart: 0.02, psarIncrement: 0.02, psarMax: 0.2, adxPeriod: 14, adxThreshold: 25, volumeSpikeMultiplier: 2.5, divergenceLookback: 40, divergenceOffset: 5, atrPeriod: 14, slopePeriod: 10, bbwSqueezeLookback: 50, bbwSqueezeThreshold: 0.1, keltnerPeriod: 20, keltnerMultiplier: 2.0, scalpingAtrMinMultiplier: 0.5, scalpingAtrMaxMultiplier: 3.0, obvPeriod: 20 } }; }
        getDefaultNotificationSettings() { return { desktop: true, sound: true, threshold: 8.0 }; }
        generateTimeframeConfigs(baseSettings) { return { 'minute': { label: '1分足', endpoint: 'histominute', aggregate: 1, limit: 240, verificationPeriod: 30, mta: [{key: '5minute', weight: 0.6}, {key: '15minute', weight: 0.4}], params: { ...baseSettings.params, rsiPeriod: 9, emaShort: 9, emaLong: 21 }, weights: { ...baseSettings.weights }, useEMA: true }, '5minute': { label: '5分足', endpoint: 'histominute', aggregate: 5, limit: 96, verificationPeriod: 12, mta: [{key: '15minute', weight: 0.7}, {key: 'hour', weight: 0.3}], params: { ...baseSettings.params, rsiPeriod: 9, emaShort: 9, emaLong: 21 }, weights: { ...baseSettings.weights }, useEMA: true }, '15minute': { label: '15分足', endpoint: 'histominute', aggregate: 15, limit: 96, verificationPeriod: 16, mta: [{key: 'hour', weight: 0.8}, {key: '4hour', weight: 0.2}], params: { ...baseSettings.params }, weights: { ...baseSettings.weights, bb: 1.8, volumeConfirmation: 2.0 }, useEMA: false }, 'hour': { label: '1時間足', endpoint: 'histohour', aggregate: 1, limit: 168, verificationPeriod: 12, mta: [{key: '4hour', weight: 0.7}, {key: 'day', weight: 0.3}], params: { ...baseSettings.params }, weights: { ...baseSettings.weights, ichimoku: 2.5 }, useEMA: true }, '4hour': { label: '4時間足', endpoint: 'histohour', aggregate: 4, limit: 180, verificationPeriod: 12, mta: [{key: 'day', weight: 1.0}], params: { ...baseSettings.params, emaShort: 21, emaLong: 50 }, weights: { ...baseSettings.weights, psar: 2.0, ma: 1.5 }, useEMA: true }, 'day': { label: '日足', endpoint: 'histoday', aggregate: 1, limit: 200, verificationPeriod: 7, mta: [], params: { ...baseSettings.params }, weights: { ...baseSettings.weights, ichimoku: 2.0, macd: 1.5 }, useEMA: true }, }; }
    }

    class AppState {
        constructor() { this.state = { openPositions: {}, signalHistory: [], analysisHistory: [], tradeHistory: [], jpyRate: 150, lastNotifiedSignal: {}, currentAnalysisScores: {} }; this.listeners = new Map(); }
        init() { Object.keys(this.state).forEach(key => { this.state[key] = this.load(key, this.state[key]); }); }
        load(key, defaultValue) { try { const stored = localStorage.getItem(key); return stored ? JSON.parse(stored) : defaultValue; } catch (error) { console.error(`Error loading state ${key}:`, error); return defaultValue; } }
        save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); this.state[key] = value; this.notify(key, value); return true; } catch (error) { console.error(`Error saving state ${key}:`, error); return false; } }
        get(key) { return this.state[key]; }
        set(key, value) { this.save(key, value); }
        addListener(key, callback) { if (!this.listeners.has(key)) this.listeners.set(key, new Set()); this.listeners.get(key).add(callback); return () => this.listeners.get(key).delete(callback); }
        notify(key, value) { if (this.listeners.has(key)) this.listeners.get(key).forEach(callback => callback(value)); }
        clearAll() { localStorage.clear(); this.state = { openPositions: {}, signalHistory: [], analysisHistory: [], tradeHistory: [], jpyRate: 150, lastNotifiedSignal: {}, currentAnalysisScores: {} }; Object.keys(this.state).forEach(key => this.notify(key, this.state[key])); }
    }

    class DataManager {
        constructor() { this.CLOUD_FUNCTION_URL = 'https://crypto-tool-backend1-991185168999.asia-northeast1.run.app'; this.cache = new DataCache(); this.requestQueue = new Map(); this.isProcessingQueue = false; }
        async fetchWithCache(url, cacheKey, expiry = 60000) { const cachedData = this.cache.get(cacheKey); if (cachedData) return cachedData; if (this.requestQueue.has(cacheKey)) return this.requestQueue.get(cacheKey); const fetchPromise = this._performFetch(url, cacheKey, expiry).finally(() => { this.requestQueue.delete(cacheKey); }); this.requestQueue.set(cacheKey, fetchPromise); if (!this.isProcessingQueue) this.processRequestQueue(); return fetchPromise; }
        async _performFetch(url, cacheKey, expiry) { try { const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`); const data = await response.json(); if (data.Response === 'Error') throw new Error(data.Message); this.cache.set(cacheKey, data, expiry); return data; } catch (error) { console.error(`Fetch error for ${url.substring(0, 80)}...:`, error.message); throw error; } }
        async processRequestQueue() { if (this.isProcessingQueue) return; this.isProcessingQueue = true; for (const promise of this.requestQueue.values()) { try { await promise; await new Promise(resolve => setTimeout(resolve, 100)); } catch (error) { /* Already logged */ } } this.isProcessingQueue = false; }
        async fetchData(symbol, endpoint, limit = 200, aggregate = 1) { const tsym = app.getTsymForSymbol(symbol); const aggParam = aggregate > 1 ? `&aggregate=${aggregate}` : ''; const url = `${this.CLOUD_FUNCTION_URL}/proxy/v2/${endpoint}?fsym=${symbol}&tsym=${tsym}&limit=${limit}${aggParam}`; const cacheKey = `${symbol}-${tsym}-${endpoint}-${limit}-${aggregate}`; try { const data = await this.fetchWithCache(url, cacheKey); return data ? data.Data.Data : null; } catch (error) { if (url.includes('fsym=N225')) console.warn(`N225 data might be unavailable (off-market hours).`); return null; } }
        async fetchCurrentPrice(symbols) { const symbolsByTsym = symbols.reduce((acc, symbol) => { const tsym = app.getTsymForSymbol(symbol); if (!acc[tsym]) acc[tsym] = []; acc[tsym].push(symbol); return acc; }, {}); let finalData = {}; const fetchDataFor = async (syms, tsyms) => { if (!syms) return; const url = `${this.CLOUD_FUNCTION_URL}/proxy/pricemultifull?fsyms=${syms}&tsyms=${tsyms}`; const cacheKey = `pricemultifull-${syms}-${tsyms}`; try { const data = await this.fetchWithCache(url, cacheKey, 10000); if (data && data.RAW) Object.assign(finalData, data.RAW); } catch (error) { /* Already handled */ } }; for (const [tsym, syms] of Object.entries(symbolsByTsym)) { await fetchDataFor(syms.join(','), tsym); } return Object.keys(finalData).length > 0 ? finalData : null; }
        async updateJpyRate() { const url = `${this.CLOUD_FUNCTION_URL}/proxy/price?fsym=USD&tsyms=JPY`; const cacheKey = 'jpy-rate'; try { const data = await this.fetchWithCache(url, cacheKey, 3600000); if (data && data.JPY) app.appState.set('jpyRate', data.JPY); } catch (error) { /* Already handled */ } }
        async fetchSentimentData(symbols) { const url = `${this.CLOUD_FUNCTION_URL}/proxy/v2/news/?categories=${symbols.join(',')}&lang=EN`; const cacheKey = `sentiment-${symbols.join(',')}`; try { const data = await this.fetchWithCache(url, cacheKey, 1800000); return data ? data.Data : null; } catch (error) { return null; } }
    }

    class UIManager {
        constructor(controller) { this.controller = controller; this.elements = {}; this.chart = null; }
        init() { this.cacheDOMElements(); this.setupEventListeners(); this.setupTabs(); this.populateTimeframeSelect(); this.elements['analysis-mode-select'].value = this.controller.settingsManager.get('mode').current; this.controller.appState.addListener('openPositions', p => this.updatePositionsUI(p)); this.controller.appState.addListener('signalHistory', h => this.updateAccuracyUI(h)); this.controller.appState.addListener('tradeHistory', h => this.updateTradeHistoryUI(h)); this.controller.appState.addListener('currentAnalysisScores', s => this.updateDashboardMeters(s)); this.updatePositionsUI(this.controller.appState.get('openPositions')); this.updateAccuracyUI(this.controller.appState.get('signalHistory')); this.updateTradeHistoryUI(this.controller.appState.get('tradeHistory')); }
        cacheDOMElements() { const ids = ['loading-overlay', 'timeframe-select', 'run-analysis-btn', 'auto-refresh-checkbox', 'auto-refresh-countdown', 'toast-container', 'price-ticker-wrap', 'quick-price-view', 'analysis-results', 'accuracy-rate', 'verified-signals', 'success-signals', 'fail-signals', 'reset-accuracy-btn', 'accuracy-tooltip-icon', 'open-positions-section', 'open-positions-body', 'trade-history-body', 'tabs', 'tab-content-ranking', 'tab-content-all-pairs', 'tab-content-analysis-history', 'tab-content-trade-history', 'main-content', 'clear-data-btn', 'trade-entry-modal', 'trade-modal-close-btn', 'trade-form', 'modal-pair', 'modal-signal', 'modal-price', 'modal-stop-loss', 'modal-take-profit', 'modal-lot', 'confirm-trade-btn', 'chart-modal', 'chart-modal-close-btn', 'chart-canvas', 'chart-title', 'timeframe-buttons', 'dashboard-meters', 'analysis-mode-select']; ids.forEach(id => { this.elements[id] = document.getElementById(id); }); }
        setupEventListeners() { this.elements['run-analysis-btn'].addEventListener('click', () => this.controller.performAnalysis()); this.elements['auto-refresh-checkbox'].addEventListener('change', e => this.controller.toggleAutoRefresh(e.target.checked)); this.elements['reset-accuracy-btn'].addEventListener('click', () => this.controller.resetAccuracy()); this.elements['clear-data-btn'].addEventListener('click', () => this.controller.clearAllData()); this.elements['trade-modal-close-btn'].addEventListener('click', () => this.hideModal('trade-entry-modal')); this.elements['chart-modal-close-btn'].addEventListener('click', () => this.hideModal('chart-modal')); this.elements['trade-form'].addEventListener('submit', e => { e.preventDefault(); this.controller.handleTradeSubmission(); }); window.addEventListener('keydown', e => { if (e.key === 'Escape') { this.hideModal('trade-entry-modal'); this.hideModal('chart-modal'); } }); this.elements['analysis-mode-select'].addEventListener('change', e => this.controller.setAnalysisMode(e.target.value)); }
        setupTabs() { this.elements.tabs.addEventListener('click', e => { if (e.target.classList.contains('tab')) { const targetId = e.target.dataset.target; this.elements.tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); e.target.classList.add('active'); document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden')); document.getElementById(targetId).classList.remove('hidden'); } }); }
        populateTimeframeSelect() { const configs = this.controller.settingsManager.timeframeConfigs; for (const key in configs) { const option = document.createElement('option'); option.value = key; option.textContent = configs[key].label; this.elements['timeframe-select'].appendChild(option); } this.elements['timeframe-select'].value = 'hour'; }
        toggleLoading(isLoading) { this.elements['loading-overlay'].style.display = isLoading ? 'flex' : 'none'; this.elements['run-analysis-btn'].disabled = isLoading; this.elements['run-analysis-btn'].innerHTML = isLoading ? '<div class="loader"></div>分析中...' : '総合分析を実行'; }
        createToast(message, type = 'info') { const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.textContent = message; this.elements['toast-container'].appendChild(toast); setTimeout(() => toast.remove(), 5000); }
        updatePriceTicker(priceData) { let html = ''; this.controller.assetSymbols.forEach(symbol => { const tsym = this.controller.getTsymForSymbol(symbol); const data = priceData[symbol] ? priceData[symbol][tsym] : null; if (data) { const price = data.PRICE.toLocaleString('en-US', { style: 'currency', currency: tsym, minimumFractionDigits: this.controller.getPairPrecision(symbol), maximumFractionDigits: this.controller.getPairPrecision(symbol) }); const changePct = data.CHANGEPCT24HOUR; const colorClass = changePct >= 0 ? 'text-green-400' : 'text-red-400'; html += `<div class="ticker-item"><strong>${this.controller.getFullPairName(symbol)}</strong> <span class="${colorClass}">${price} (${changePct.toFixed(2)}%)</span></div>`; } }); this.elements['price-ticker-wrap'].innerHTML = html + html; }
        updateQuickPriceView(priceData) { let html = ''; this.controller.assetSymbols.forEach(symbol => { const tsym = this.controller.getTsymForSymbol(symbol); const data = priceData[symbol] ? priceData[symbol][tsym] : null; if(data) { const price = data.PRICE.toLocaleString('en-US', { style: 'currency', currency: tsym, minimumFractionDigits: this.controller.getPairPrecision(symbol), maximumFractionDigits: this.controller.getPairPrecision(symbol) }); const changePct = data.CHANGEPCT24HOUR; const colorClass = changePct >= 0 ? 'text-green-400' : 'text-red-400'; const sign = changePct >= 0 ? '+' : ''; html += `<div class="bg-gray-800 p-4 rounded-lg text-center"><h3 class="font-bold text-white">${this.controller.getFullPairName(symbol)}</h3><p class="text-xl font-semibold text-white">${price}</p><p class="${colorClass} text-sm">${sign}${changePct.toFixed(2)}%</p></div>`; } }); this.elements['quick-price-view'].innerHTML = html; }
        renderAnalysisResults(results) { const sortedResults = [...results].sort((a, b) => b.score - a.score); let rankingHtml = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">'; sortedResults.forEach((result, index) => { rankingHtml += this.createReportCard(result, index + 1); }); rankingHtml += '</div>'; this.elements['tab-content-ranking'].innerHTML = rankingHtml; let allPairsHtml = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">'; results.forEach(result => { allPairsHtml += this.createReportCard(result); }); allPairsHtml += '</div>'; this.elements['tab-content-all-pairs'].innerHTML = allPairsHtml; this.addCardEventListeners(); }
        createReportCard(result, rank = null) { const signalColorClass = result.signal === 'buy' ? 'text-green-400' : (result.signal === 'sell' ? 'text-red-400' : 'text-yellow-400'); const scoreColorClass = result.score > 0 ? 'bg-green-500' : (result.score < 0 ? 'bg-red-500' : 'bg-gray-500'); const signalText = result.signal.toUpperCase(); const rankBadge = rank ? `<div class="rank-badge rank-${rank}">${rank}</div>` : ''; const tsym = this.controller.getTsymForSymbol(result.pair); return `<div class="report-card bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 flex flex-col justify-between" data-pair="${result.pair}" data-price="${result.price}" data-signal="${result.signal}" data-result='${JSON.stringify(result)}'><div><div class="flex justify-between items-start"><h3 class="text-xl font-bold text-white">${this.controller.getFullPairName(result.pair)}</h3>${rankBadge}</div><p class="text-gray-400 text-sm mb-2">${this.controller.settingsManager.getTimeframeConfig(result.timeframe).label}</p><p class="text-2xl font-semibold ${signalColorClass} mb-2">${signalText}</p><div class="w-full bg-gray-700 rounded-full h-2.5 mb-2"><div class="${scoreColorClass} h-2.5 rounded-full" style="width: ${Math.min(Math.abs(result.score) * 10, 100)}%"></div></div><p class="text-sm text-gray-300">スコア: ${result.score.toFixed(2)}</p><p class="text-sm text-gray-300">現在価格: ${result.price.toLocaleString('en-US', { style: 'currency', currency: tsym, minimumFractionDigits: this.controller.getPairPrecision(result.pair), maximumFractionDigits: this.controller.getPairPrecision(result.pair) })}</p></div><div class="flex mt-4 gap-2"><button class="trade-btn flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-300">トレード</button><button class="chart-btn flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition duration-300">チャート</button></div></div>`; }
        addCardEventListeners() { document.querySelectorAll('.trade-btn').forEach(btn => { btn.addEventListener('click', e => { const card = e.target.closest('.report-card'); this.showTradeEntryModal(card.dataset.pair, card.dataset.signal, card.dataset.price); }); }); document.querySelectorAll('.chart-btn').forEach(btn => { btn.addEventListener('click', e => { const card = e.target.closest('.report-card'); const result = JSON.parse(card.dataset.result); this.showChartModal(result); }); }); }
        updateAccuracyUI(signalHistory) { const verifiedSignals = signalHistory.filter(s => s.result !== 'pending'); const successSignals = verifiedSignals.filter(s => s.result === 'success'); const rate = verifiedSignals.length > 0 ? (successSignals.length / verifiedSignals.length) * 100 : 0; this.elements['accuracy-rate'].textContent = `${rate.toFixed(1)}%`; this.elements['verified-signals'].textContent = verifiedSignals.length; this.elements['success-signals'].textContent = successSignals.length; this.elements['fail-signals'].textContent = verifiedSignals.length - successSignals.length; }
        updatePositionsUI(positions) { if (Object.keys(positions).length === 0) { this.elements['open-positions-section'].classList.add('hidden'); return; } this.elements['open-positions-section'].classList.remove('hidden'); let html = ''; for (const id in positions) { const pos = positions[id]; const pnl = pos.pnl || 0; const pnlColor = pnl >= 0 ? 'text-green-400' : 'text-red-400'; const tsym = this.controller.getTsymForSymbol(pos.pair); html += `<tr class="border-b border-gray-700"><td class="p-2">${this.controller.getFullPairName(pos.pair)}</td><td class="p-2 ${pos.signal === 'buy' ? 'text-green-400' : 'text-red-400'}">${pos.signal.toUpperCase()}</td><td class="p-2">${pos.entryPrice.toLocaleString('en-US', { style: 'currency', currency: tsym })}</td><td class="p-2">${pos.currentPrice.toLocaleString('en-US', { style: 'currency', currency: tsym })}</td><td class="p-2 ${pnlColor}">${pnl.toLocaleString('en-US', { style: 'currency', currency: tsym, minimumFractionDigits: 2 })}</td><td class="p-2"><button class="close-position-btn bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs" data-id="${id}">決済</button></td></tr>`; } this.elements['open-positions-body'].innerHTML = html; document.querySelectorAll('.close-position-btn').forEach(btn => { btn.addEventListener('click', e => this.controller.closePosition(e.target.dataset.id)); }); }
        updateTradeHistoryUI(tradeHistory) { let html = ''; [...tradeHistory].reverse().forEach(trade => { const pnlColor = trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'; const tsym = this.controller.getTsymForSymbol(trade.pair); html += `<tr class="border-b border-gray-700"><td class="p-2">${new Date(trade.entryTime).toLocaleString()}</td><td class="p-2">${this.controller.getFullPairName(trade.pair)}</td><td class="p-2 ${trade.signal === 'buy' ? 'text-green-400' : 'text-red-400'}">${trade.signal.toUpperCase()}</td><td class="p-2">${trade.entryPrice.toLocaleString('en-US', {style: 'currency', currency: tsym})}</td><td class="p-2">${trade.exitPrice.toLocaleString('en-US', {style: 'currency', currency: tsym})}</td><td class="p-2 ${pnlColor}">${trade.pnl.toLocaleString('en-US', {style: 'currency', currency: tsym})}</td><td class="p-2">${trade.reason}</td></tr>`; }); this.elements['trade-history-body'].innerHTML = html; }
        updateDashboardMeters(scores) { let html = ''; this.controller.assetSymbols.forEach(symbol => { const scoreData = scores[symbol]; if (scoreData) { const score = scoreData.score; const rotation = (score / 10) * 90; const signalText = score > 3.5 ? "強い買い" : score > 0 ? "買い" : score < -3.5 ? "強い売り" : score < 0 ? "売り" : "中立"; html += `<div class="text-center"><h4 class="font-bold text-lg">${this.controller.getFullPairName(symbol)}</h4><div class="meter-container"><div class="meter-bg"></div><div class="meter-value"></div><div class="meter-pointer" style="transform: translateX(-50%) rotate(${rotation}deg);"></div><div class="meter-center"></div></div><p class="text-sm mt-2">${signalText} (${score.toFixed(2)})</p></div>`; } }); this.elements.dashboardMeters.innerHTML = html; }
        showModal(id) { document.getElementById(id).classList.remove('hidden'); }
        hideModal(id) { document.getElementById(id).classList.add('hidden'); }
        showTradeEntryModal(pair, signal, price) { const atr = this.controller.analysisManager.getLastAtr(pair) || (price * 0.01); const defaultSL = signal === 'buy' ? parseFloat(price) - atr : parseFloat(price) + atr; const defaultTP = signal === 'buy' ? parseFloat(price) + (atr * 2) : parseFloat(price) - (atr * 2); const precision = this.controller.getPairPrecision(pair); this.elements['modal-pair'].value = pair; this.elements['modal-signal'].value = signal; this.elements['modal-price'].value = price; this.elements['modal-stop-loss'].value = defaultSL.toFixed(precision); this.elements['modal-take-profit'].value = defaultTP.toFixed(precision); this.showModal('trade-entry-modal'); }
        showChartModal(result) { this.elements['chart-title'].textContent = `${this.controller.getFullPairName(result.pair)} チャート (${this.controller.settingsManager.getTimeframeConfig(result.timeframe).label})`; this.renderChart(result); this.showModal('chart-modal'); }
        renderChart(result) { const ctx = this.elements['chart-canvas'].getContext('2d'); if (this.chart) { this.chart.destroy(); } const data = result.historicalData; const labels = data.map(d => new Date(d.time * 1000)); const closePrices = data.map(d => d.close); const annotations = {}; if(result.pivot_points) { Object.entries(result.pivot_points).forEach(([level, price]) => { annotations[`pivot_${level}`] = { type: 'line', yMin: price, yMax: price, borderColor: 'rgba(0, 204, 255, 0.5)', borderWidth: 1, label: { content: level, enabled: true, position: 'end' } }; }); } if(result.fib_levels) { Object.entries(result.fib_levels).forEach(([level, price]) => { annotations[`fib_${level}`] = { type: 'line', yMin: price, yMax: price, borderColor: 'rgba(255, 204, 0, 0.5)', borderWidth: 1, label: { content: level, enabled: true, position: 'start' } }; }); } this.chart = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: '価格', data: closePrices, borderColor: 'rgb(75, 192, 192)', tension: 0.1 }] }, options: { scales: { x: { type: 'time', time: { unit: 'hour' } } }, plugins: { annotation: { annotations } } } }); }
    }

    class AnalysisManager {
        constructor(settingsManager) { this.settingsManager = settingsManager; this.lastAtrValues = {}; }
        
        // --- Technical Analysis Calculation Methods ---
        calculateSMA(data, period) { let r = []; for (let i = period - 1; i < data.length; i++) { let s = 0; for (let j = 0; j < period; j++) { s += data[i - j]; } r.push(s / period); } return r; }
        calculateEMA(data, period) { let r = []; let m = 2 / (period + 1); if(data.length < period) return []; let s = data.slice(0, period).reduce((a, b) => a + b, 0) / period; r.push(s); for (let i = period; i < data.length; i++) { let e = (data[i] - r[r.length - 1]) * m + r[r.length - 1]; r.push(e); } return r; }
        calculateATR(data, period) { if(data.length <= 1) return []; let tr = []; for (let i = 1; i < data.length; i++) { tr.push(Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i - 1].close), Math.abs(data[i].low - data[i - 1].close))); } return this.calculateEMA(tr, period); }
        calculatePivotPoints(data) { const yesterday = data[data.length - 2]; if (!yesterday) return {}; const P = (yesterday.high + yesterday.low + yesterday.close) / 3; return { R2: P + (yesterday.high - yesterday.low), R1: (2 * P) - yesterday.low, P: P, S1: (2 * P) - yesterday.high, S2: P - (yesterday.high - yesterday.low) }; }
        calculateFibonacciRetracement(data, lookback = 50) { if(data.length < lookback) lookback = data.length; const recentData = data.slice(-lookback); const high = Math.max(...recentData.map(d => d.high)); const low = Math.min(...recentData.map(d => d.low)); const diff = high - low; return { '0.0%': high, '23.6%': high - diff * 0.236, '38.2%': high - diff * 0.382, '50.0%': high - diff * 0.5, '61.8%': high - diff * 0.618, '100.0%': low }; }
        // ... Other TA function implementations ...

        getLastAtr(pair) { return this.lastAtrValues[pair]; }
        _runAnalysis(analysisFn, pair, timeframeKey, data, fiveMinData = null) { const result = analysisFn.call(this, pair, timeframeKey, data, fiveMinData); const atr = this.calculateATR(data, this.settingsManager.get('analysis').params.atrPeriod); this.lastAtrValues[pair] = atr.slice(-1)[0] || 0; return result; }

        performHighAccuracyAnalysis(pair, timeframeKey, data) {
            // This is a placeholder for the full, complex analysis logic.
            // It would use all the TA functions to calculate a score.
            let score = (Math.random() - 0.5) * 10;
            const analysisResult = {
                pair, timeframe: timeframeKey, price: data[data.length - 1].close,
                historicalData: data, score: score, signal: 'neutral', details: {}
            };
            if(pair === 'XAU' || pair === 'EUR') {
                analysisResult.pivot_points = this.calculatePivotPoints(data);
                analysisResult.fib_levels = this.calculateFibonacciRetracement(data);
            }
            if (score > 5.5) analysisResult.signal = 'buy';
            if (score < -5.5) analysisResult.signal = 'sell';
            return analysisResult;
        }
        performScalpingMaxAnalysis(pair, timeframeKey, data, fiveMinData) {
            // Placeholder for the scalping logic.
            let score = (Math.random() - 0.5) * 8;
            const analysisResult = {
                pair, timeframe: timeframeKey, price: data[data.length - 1].close,
                historicalData: data, score: score, signal: 'neutral', details: {}
            };
            if (score > 3.5) analysisResult.signal = 'buy';
            if (score < -3.5) analysisResult.signal = 'sell';
            return analysisResult;
        }
    }
    
    class AppController {
        constructor() { this.settingsManager = new SettingsManager(); this.appState = new AppState(); this.dataManager = new DataManager(); this.uiManager = new UIManager(this); this.analysisManager = new AnalysisManager(this.settingsManager); this.isAnalyzing = false; this.autoRefreshInterval = null; this.countdownInterval = null; this.assetSymbols = ['BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOGE', 'N225', 'XAU', 'EUR']; }
        
        async init() {
            this.settingsManager.init();
            this.appState.init();
            this.uiManager.init();
            this.setupPeriodicTasks();
            await this.dataManager.updateJpyRate();
            await this.updatePrices();
            await this.performAnalysis(true);
        }
        
        setupPeriodicTasks() {
            setInterval(() => this.updatePrices(), 15000);
            setInterval(() => this.updateOpenPositions(), 5000);
            setInterval(() => this.verifySignals(), 60 * 1000);
        }

        async performAnalysis(isInitial = false) {
            if (this.isAnalyzing) return;
            this.isAnalyzing = true;
            this.uiManager.toggleLoading(true);
            const mode = this.settingsManager.get('mode').current;
            const timeframeKey = this.uiManager.elements['timeframe-select'].value;
            const config = this.settingsManager.getTimeframeConfig(timeframeKey);
            if (!isInitial) this.uiManager.createToast(`${config.label}の「${mode === 'high_accuracy' ? '高精度' : 'スキャルピング'}」モードで分析を開始...`, 'info');
            
            const analysisPromises = this.assetSymbols.map(async (pair) => {
                const data = await this.dataManager.fetchData(pair, config.endpoint, config.limit, config.aggregate);
                if (!data || data.length < 2) return null;
                
                let analysisFunction = this.analysisManager.performHighAccuracyAnalysis;
                let fiveMinData = null;
                
                if (mode === 'scalping_max' && (timeframeKey === 'minute' || timeframeKey === '5minute')) {
                    analysisFunction = this.analysisManager.performScalpingMaxAnalysis;
                    fiveMinData = await this.dataManager.fetchData(pair, 'histominute', 96, 5);
                    if (!fiveMinData || fiveMinData.length === 0) return null;
                }
                
                return this.analysisManager._runAnalysis(analysisFunction, pair, timeframeKey, data, fiveMinData);
            });
            
            const results = (await Promise.all(analysisPromises)).filter(Boolean);
            const scores = {};
            results.forEach(r => { scores[r.pair] = { score: r.score, signal: r.signal }; });
            this.appState.set('currentAnalysisScores', scores);
            this.uiManager.renderAnalysisResults(results);
            
            if (!isInitial) this.uiManager.createToast('分析が完了しました。', 'success');
            this.uiManager.toggleLoading(false);
            this.isAnalyzing = false;
        }

        async updatePrices() {
            const priceData = await this.dataManager.fetchCurrentPrice(this.assetSymbols);
            if (priceData) {
                this.uiManager.updatePriceTicker(priceData);
                this.uiManager.updateQuickPriceView(priceData);
            }
        }

        async updateOpenPositions() {
            const openPositions = this.appState.get('openPositions');
            if (Object.keys(openPositions).length === 0) return;
            const symbolsToUpdate = [...new Set(Object.values(openPositions).map(p => p.pair))];
            const priceData = await this.dataManager.fetchCurrentPrice(symbolsToUpdate);
            if (!priceData) return;
            let positionsChanged = false;
            for (const id in openPositions) {
                const pos = openPositions[id];
                const tsym = this.getTsymForSymbol(pos.pair);
                const currentPriceData = priceData[pos.pair] ? priceData[pos.pair][tsym] : null;
                if (!currentPriceData) continue;
                const currentPrice = currentPriceData.PRICE;
                pos.currentPrice = currentPrice;
                let pnl = (currentPrice - pos.entryPrice) * pos.lot;
                if (pos.signal === 'sell') pnl = (pos.entryPrice - currentPrice) * pos.lot;
                pos.pnl = pnl;
                if (pos.signal === 'buy') { if (currentPrice <= pos.sl) this.closePosition(id, 'Stop Loss'); else if (currentPrice >= pos.tp) this.closePosition(id, 'Take Profit'); } 
                else { if (currentPrice >= pos.sl) this.closePosition(id, 'Stop Loss'); else if (currentPrice <= pos.tp) this.closePosition(id, 'Take Profit'); }
                positionsChanged = true;
            }
            if (positionsChanged) this.appState.set('openPositions', openPositions);
        }

        async verifySignals() {
            const signalHistory = this.appState.get('signalHistory');
            const pendingSignals = signalHistory.filter(s => s.result === 'pending');
            if (pendingSignals.length === 0) return;
            const config = this.settingsManager.getTimeframeConfig(pendingSignals[0].timeframe);
            for (const signal of pendingSignals) {
                const data = await this.dataManager.fetchData(signal.pair, config.endpoint, config.verificationPeriod, config.aggregate);
                if (!data || data.length === 0) continue;
                const priceAtSignal = signal.price;
                const currentPrice = data[data.length - 1].close;
                const priceChange = currentPrice - priceAtSignal;
                let success = false;
                if (signal.signal === 'buy' && priceChange > 0) success = true;
                if (signal.signal === 'sell' && priceChange < 0) success = true;
                signal.result = success ? 'success' : 'fail';
                signal.verifiedTime = Date.now();
            }
            this.appState.set('signalHistory', signalHistory);
        }
        
        setAnalysisMode(mode) { this.settingsManager.save('mode', { current: mode }); this.uiManager.createToast(`分析モードを「${mode === 'high_accuracy' ? '高精度安定型' : 'スキャルピング特化型'}」に変更しました。`, 'info'); this.performAnalysis(); }
        getTsymForSymbol(symbol) { if (symbol === 'N225') return 'JPY'; return 'USD'; }
        getFullPairName(symbol) { if (symbol === 'N225') return 'Nikkei 225'; if (symbol === 'XAU') return 'Gold (XAU/USD)'; if (symbol === 'EUR') return 'EUR/USD'; return `${symbol}/USD`; }
        getPairPrecision(symbol) { switch(symbol) { case 'N225': return 0; case 'XAU': return 2; case 'EUR': return 5; default: return 4; } }
        handleError(error, context, isCritical = false) { console.error(`Error in ${context}:`, error); const toastType = isCritical ? 'error' : 'warning'; this.uiManager.createToast(`${context}でエラー: ${error.message}`, toastType); }
        toggleAutoRefresh(isEnabled) { if (this.countdownInterval) clearInterval(this.countdownInterval); if (isEnabled) { this.performAnalysis(); const fiveMinutes = 5 * 60 * 1000; this.autoRefreshInterval = setInterval(() => this.performAnalysis(), fiveMinutes); } else if (!isEnabled && this.autoRefreshInterval) { clearInterval(this.autoRefreshInterval); this.autoRefreshInterval = null; } }
        resetAccuracy() { if (confirm('本当にシグナル正答率の履歴をリセットしますか？')) { this.appState.set('signalHistory', []); this.uiManager.createToast('正答率履歴をリセットしました。', 'info'); } }
        clearAllData() { if (confirm('警告: すべての取引履歴、ポジション、設定が削除されます。本当によろしいですか？')) { this.appState.clearAll(); this.uiManager.createToast('すべてのデータをクリアしました。', 'warning'); window.location.reload(); } }
        handleTradeSubmission() { const form = this.uiManager.elements['trade-form']; const pair = form.querySelector('#modal-pair').value; const signal = form.querySelector('#modal-signal').value; const entryPrice = parseFloat(form.querySelector('#modal-price').value); const sl = parseFloat(form.querySelector('#modal-stop-loss').value); const tp = parseFloat(form.querySelector('#modal-take-profit').value); const lot = parseFloat(form.querySelector('#modal-lot').value); if (isNaN(lot) || lot <= 0) { this.handleError({ message: 'ロット数は正の数値で入力してください。' }, 'Trade Submission'); return; } const newPosition = { id: `pos_${Date.now()}`, pair, signal, entryPrice, sl, tp, lot, entryTime: Date.now(), currentPrice: entryPrice, pnl: 0 }; const openPositions = this.appState.get('openPositions'); openPositions[newPosition.id] = newPosition; this.appState.set('openPositions', openPositions); this.uiManager.hideModal('trade-entry-modal'); this.uiManager.createToast(`${pair}の${signal.toUpperCase()}ポジションを建てました。`, 'success'); }
        closePosition(positionId, reason = 'Manual Close') { const openPositions = this.appState.get('openPositions'); const position = openPositions[positionId]; if (!position) return; delete openPositions[positionId]; const tradeHistory = this.appState.get('tradeHistory'); tradeHistory.push({ ...position, exitPrice: position.currentPrice, exitTime: Date.now(), reason }); this.appState.set('openPositions', openPositions); this.appState.set('tradeHistory', tradeHistory); this.uiManager.createToast(`${position.pair}のポジションを決済しました。 PnL: ${position.pnl.toFixed(2)}`, 'info'); }
    }

    const app = new AppController();
    app.init().catch(error => {
        console.error('Failed to initialize application:', error);
        document.body.innerHTML = `<div style="color: white; padding: 2rem; text-align: center;"><h2>アプリケーションの起動に失敗しました。</h2><p>詳細はコンソールを確認してください。</p></div>`;
    });
});

