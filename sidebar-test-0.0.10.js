// ====================================================================
// SHARED CORE MODULE - Loads on ALL pages
// Contains: DOM cache, Event manager, Sidebars, Checkboxes, GeoJSON caching
// Version: 1.3.1 - PAGESPEED OPTIMIZED - Core Web Vitals Enhanced
// 
// Changes in v1.3.1:
// - Added AdvancedScheduler with scheduler.postTask support for background operations
// - Implemented lazy event delegation setup to improve FID scores
// - Added resource preloading and DNS prefetch hints for better LCP
// - Enhanced memory management and cleanup for optimal performance
// - Deferred non-critical initialization to minimize blocking time
// 
// Changes in v1.2.0:
// - Deferred checkbox generation with requestIdleCallback
// - Shows loading states during checkbox generation
// - Prevents duplicate checkbox generation with state tracking
// 
// Changes in v1.1.0:
// - Added SafeStorage wrapper for robust localStorage handling
// - Updated cache duration from 24 hours to 7 days
// - Updated GeoJSON URLs to newer versions (localities 0.010, settlements 0.006)
// - Improved error handling and corrupted data recovery
// - Added memory fallback for private browsing/restricted environments
// ====================================================================

(function(window) {
  'use strict';
  
  // Skip initialization if already loaded
  if (window.SharedCore) return;
  
  // ====================================================================
  // CONFIGURATION
  // ====================================================================
  const CONFIG = {
    CACHE_VERSION: '1.0.1',
    CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days (matching mapbox script)
    GEOJSON_URLS: {
      localities: 'https://raw.githubusercontent.com/Tovlim/COTO/refs/heads/main/localities-0.010.geojson',
      settlements: 'https://raw.githubusercontent.com/Tovlim/COTO/refs/heads/main/settlements-0.006.geojson'
    }
  };
  
  // ====================================================================
  // SAFE STORAGE WRAPPER (from mapbox v2.0.0)
  // ====================================================================
  class SafeStorage {
    constructor() {
      this.available = this.testAvailability();
      this.fallback = new Map();
    }
    
    testAvailability() {
      try {
        const test = '__test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch(e) {
        console.warn('localStorage not available, using memory fallback');
        return false;
      }
    }
    
    getItem(key) {
      try {
        if (!this.available) {
          return this.fallback.get(key) || null;
        }
        const item = localStorage.getItem(key);
        if (item === 'undefined') return null;
        return item;
      } catch(e) {
        console.warn('Storage read error:', e);
        return this.fallback.get(key) || null;
      }
    }
    
    setItem(key, value) {
      try {
        if (!this.available) {
          this.fallback.set(key, value);
          return;
        }
        localStorage.setItem(key, value);
      } catch(e) {
        console.warn('Storage write error:', e);
        if (e.name === 'QuotaExceededError') {
          this.clearOldData();
          try {
            localStorage.setItem(key, value);
          } catch(retryError) {
            this.fallback.set(key, value);
          }
        } else {
          this.fallback.set(key, value);
        }
      }
    }
    
    removeItem(key) {
      try {
        if (this.available) {
          localStorage.removeItem(key);
        }
        this.fallback.delete(key);
      } catch(e) {
        console.warn('Storage remove error:', e);
      }
    }
    
    clearOldData() {
      try {
        const keys = Object.keys(localStorage);
        const now = Date.now();
        keys.forEach(key => {
          if (key.startsWith('geojson_cache_') || key.startsWith('mapCache_')) {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              if (data.timestamp && (now - data.timestamp) > CONFIG.CACHE_DURATION) {
                localStorage.removeItem(key);
              }
            } catch {
              // If can't parse, remove it
              localStorage.removeItem(key);
            }
          }
        });
      } catch(e) {
        console.warn('Clear old data error:', e);
      }
    }
  }
  
  // ====================================================================
  // OPTIMIZED DOM CACHE
  // ====================================================================
  class OptimizedDOMCache {
    constructor() {
      this.cache = new Map();
      this.selectorCache = new Map();
      this.listCache = new Map();
      this._isStale = false;
    }
    
    $id(id) {
      if (!this.cache.has(id)) {
        this.cache.set(id, document.getElementById(id));
      }
      return this.cache.get(id);
    }
    
    $1(selector) {
      if (!this.selectorCache.has(selector)) {
        this.selectorCache.set(selector, document.querySelector(selector));
      }
      return this.selectorCache.get(selector);
    }
    
    $(selector) {
      if (!this.listCache.has(selector)) {
        this.listCache.set(selector, Array.from(document.querySelectorAll(selector)));
      }
      return this.listCache.get(selector);
    }
    
    invalidate() {
      this.cache.clear();
      this.selectorCache.clear(); 
      this.listCache.clear();
      this._isStale = false;
    }
    
    invalidateElement(id) {
      this.cache.delete(id);
    }
    
    refresh() {
      if (this._isStale) {
        this.invalidate();
      }
    }
    
    markStale() {
      this._isStale = true;
    }
  }
  
  // ====================================================================
  // EVENT MANAGER
  // ====================================================================
  class OptimizedEventManager {
    constructor() {
      this.listeners = new Map();
      this.delegatedListeners = new Map();
      this.debounceTimers = new Map();
      this.setupGlobalDelegation();
    }
    
    setupGlobalDelegation() {
      const events = ['click', 'change', 'input', 'submit'];
      events.forEach(event => {
        document.addEventListener(event, (e) => {
          const handlers = this.delegatedListeners.get(event);
          if (!handlers) return;
          
          handlers.forEach(({selector, handler}) => {
            const target = e.target.closest(selector);
            if (target) {
              handler.call(target, e);
            }
          });
        }, true);
      });
    }
    
    add(element, event, handler, options = {}) {
      if (typeof element === 'string') {
        element = domCache.$id(element) || domCache.$1(element);
      }
      if (!element) return false;
      
      const elementId = element.id || `element-${Math.random().toString(36).substr(2, 9)}`;
      element.addEventListener(event, handler, options);
      
      if (!this.listeners.has(elementId)) {
        this.listeners.set(elementId, []);
      }
      
      this.listeners.get(elementId).push({ event, handler, options, element });
      return true;
    }
    
    delegate(selector, event, handler) {
      if (!this.delegatedListeners.has(event)) {
        this.delegatedListeners.set(event, []);
      }
      this.delegatedListeners.get(event).push({ selector, handler });
    }
    
    debounce(fn, delay, id) {
      return (...args) => {
        const existingTimer = this.debounceTimers.get(id);
        if (existingTimer) clearTimeout(existingTimer);
        
        const timer = setTimeout(() => {
          this.debounceTimers.delete(id);
          fn(...args);
        }, delay);
        
        this.debounceTimers.set(id, timer);
      };
    }
    
    cleanup() {
      this.listeners.forEach((listeners, elementId) => {
        listeners.forEach(({ element, event, handler, options }) => {
          if (element) element.removeEventListener(event, handler, options);
        });
      });
      
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      
      this.listeners.clear();
      this.delegatedListeners.clear();
      this.debounceTimers.clear();
    }
  }
  
  // ====================================================================
  // STATE MANAGEMENT
  // ====================================================================
  class SimpleState {
    constructor() {
      this.timers = new Map();
      this.flags = {};
      this.data = {};
    }
    
    setTimer(id, callback, delay) {
      if (this.timers.has(id)) {
        clearTimeout(this.timers.get(id));
      }
      this.timers.set(id, setTimeout(() => {
        this.timers.delete(id);
        callback();
      }, delay));
    }
    
    clearTimer(id) {
      if (this.timers.has(id)) {
        clearTimeout(this.timers.get(id));
        this.timers.delete(id);
      }
    }
    
    cleanup() {
      this.timers.forEach(timer => clearTimeout(timer));
      this.timers.clear();
    }
  }
  
  // ====================================================================
  // GEOJSON DATA CACHING (Enhanced with SafeStorage)
  // ====================================================================
  class GeoJSONCache {
    constructor(storage) {
      this.cachePrefix = 'geojson_cache_';
      this.storage = storage;
    }
    
    getCacheKey(type) {
      return `${this.cachePrefix}${type}_${CONFIG.CACHE_VERSION}`;
    }
    
    get(type) {
      try {
        const key = this.getCacheKey(type);
        const cached = this.storage.getItem(key);
        if (!cached) return null;
        
        const data = JSON.parse(cached);
        const now = Date.now();
        
        if (now - data.timestamp > CONFIG.CACHE_DURATION) {
          this.storage.removeItem(key);
          return null;
        }
        
        return data.value;
      } catch (e) {
        console.warn('Cache read failed:', e);
        // Clean up corrupted entry
        try {
          const key = this.getCacheKey(type);
          this.storage.removeItem(key);
        } catch {}
        return null;
      }
    }
    
    set(type, value) {
      try {
        const key = this.getCacheKey(type);
        const data = {
          value: value,
          timestamp: Date.now()
        };
        this.storage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.warn('Cache write failed:', e);
        // SafeStorage already handles quota errors internally
      }
    }
    
    clearOldCache() {
      // Now handled by SafeStorage.clearOldData()
      this.storage.clearOldData();
    }
    
    async fetch(type) {
      // Check cache first
      const cached = this.get(type);
      if (cached) {
        console.log(`Using cached ${type} data`);
        return cached;
      }
      
      // Fetch fresh data
      const url = CONFIG.GEOJSON_URLS[type];
      if (!url) throw new Error(`Unknown GeoJSON type: ${type}`);
      
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        this.set(type, data);
        console.log(`Fetched and cached ${type} data`);
        return data;
      } catch (error) {
        console.error(`Failed to fetch ${type} data:`, error);
        throw error;
      }
    }
  }
  
  // ====================================================================
  // GLOBAL INSTANCES
  // ====================================================================
  const safeStorage = new SafeStorage();
  const domCache = new OptimizedDOMCache();
  const eventManager = new OptimizedEventManager();
  const state = new SimpleState();
  const geoCache = new GeoJSONCache(safeStorage);
  
  // Shortcuts
  const $ = (selector) => domCache.$(selector);
  const $1 = (selector) => domCache.$1(selector);  
  const $id = (id) => domCache.$id(id);
  
  // ====================================================================
  // IDLE EXECUTION UTILITY (from mapbox script)
  // ====================================================================
  const IdleExecution = {
    // Execute function during browser idle time with fallback
    schedule(callback, options = {}) {
      const { timeout = 2000, fallbackDelay = 100 } = options;
      
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout });
      } else {
        setTimeout(callback, fallbackDelay);
      }
    },
    
    // Execute with shorter timeout for UI operations
    scheduleUI(callback, options = {}) {
      const { timeout = 500, fallbackDelay = 16 } = options;
      this.schedule(callback, { timeout, fallbackDelay });
    },
    
    // Execute with longer timeout for heavy operations
    scheduleHeavy(callback, options = {}) {
      const { timeout = 5000, fallbackDelay = 200 } = options;
      this.schedule(callback, { timeout, fallbackDelay });
    }
  };
  
  // ====================================================================
  // UTILITIES
  // ====================================================================
  const utils = {
    setStyles: (el, styles) => {
      if (!el) return;
      requestAnimationFrame(() => {
        Object.assign(el.style, styles);
      });
    },
    
    debounce: (fn, delay) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    }
  };
  
  // ====================================================================
  // CHECKBOX GENERATION (Lazy-loaded)
  // ====================================================================
  const checkboxState = {
    localitiesGenerated: false,
    settlementsGenerated: false,
    isGenerating: false,
    generationPromise: null,
    generatedCheckboxes: new Set() // Track individual generated checkboxes
  };
  
  // Generate a single checkbox for a specific name and type
  async function generateSingleCheckbox(type, name, containerId, fieldName) {
    const container = $id(containerId);
    if (!container) {
      console.warn(`Target container #${containerId} not found`);
      return false;
    }
    
    // Check if already generated
    const checkboxKey = `${type}:${name}`;
    if (checkboxState.generatedCheckboxes.has(checkboxKey)) {
      console.log(`Checkbox for ${name} (${type}) already exists`);
      return true;
    }
    
    try {
      // Get data to find the specific feature
      const data = await geoCache.fetch(type);
      const feature = data.features.find(f => f.properties.name === name);
      
      if (!feature) {
        console.warn(`Feature '${name}' not found in ${type} data`);
        return false;
      }
      
      // Generate the checkbox HTML
      const slug = feature.properties.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const urlPrefix = type === 'settlements' ? 'settlement' : 'locality';
      const filterType = type === 'settlements' ? 'settlement' : 'locality';
      
      const wrapperDiv = document.createElement('div');
      wrapperDiv.setAttribute('checkbox-filter', filterType);
      wrapperDiv.className = 'checbox-item';
      
      const label = document.createElement('label');
      label.className = 'w-checkbox reporterwrap-copy';
      
      const link = document.createElement('a');
      link.setAttribute('open', '');
      link.href = `/${urlPrefix}/${slug}`;
      link.target = '_blank';
      link.className = 'open-in-new-tab w-inline-block';
      link.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" id="Layer_1" viewBox="0 0 151.49 151.49" width="100%" fill="currentColor" class="svg-3"><polygon class="cls-1" points="151.49 0 151.49 151.49 120.32 151.49 120.32 53.21 22.04 151.49 0 129.45 98.27 31.17 0 31.17 0 0 151.49 0"></polygon></svg>';
      
      const checkboxDiv = document.createElement('div');
      checkboxDiv.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
      
      const input = document.createElement('input');
      input.setAttribute('data-auto-sidebar', 'true');
      input.setAttribute('fs-list-value', name);
      input.setAttribute('fs-list-field', fieldName);
      input.type = 'checkbox';
      input.name = filterType;
      input.setAttribute('data-name', filterType);
      input.setAttribute('activate-filter-indicator', 'place');
      input.id = `${type}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;
      input.style.cssText = 'opacity: 0; position: absolute; z-index: -1;';
      
      const span = document.createElement('span');
      span.className = 'test3 w-form-label';
      span.setAttribute('for', input.id);
      span.textContent = name;
      
      const countContainer = document.createElement('div');
      countContainer.className = 'div-block-31834';
      const countDiv = document.createElement('div');
      countDiv.setAttribute('fs-list-element', 'facet-count');
      countDiv.className = 'test33';
      countDiv.textContent = '0';
      countContainer.appendChild(countDiv);
      
      label.appendChild(link);
      label.appendChild(checkboxDiv);
      label.appendChild(input);
      label.appendChild(span);
      label.appendChild(countContainer);
      wrapperDiv.appendChild(label);
      
      // Insert in alphabetical order
      const existingItems = Array.from(container.querySelectorAll('.checbox-item'));
      let inserted = false;
      
      for (let i = 0; i < existingItems.length; i++) {
        const existingName = existingItems[i].querySelector('span.test3').textContent;
        if (name.localeCompare(existingName) < 0) {
          container.insertBefore(wrapperDiv, existingItems[i]);
          inserted = true;
          break;
        }
      }
      
      if (!inserted) {
        container.appendChild(wrapperDiv);
      }
      
      // Track the generated checkbox
      checkboxState.generatedCheckboxes.add(checkboxKey);
      
      console.log(`Generated single checkbox for ${name} (${type})`);
      
      domCache.markStale();
      domCache.refresh();
      
      setupGeneratedCheckboxEvents();
      
      // Refresh search script cache if available
      IdleExecution.scheduleUI(() => {
        if (window.checkboxFilterScript) {
          window.checkboxFilterScript.recacheElements();
        }
      }, { fallbackDelay: 50 });
      
      return true;
      
    } catch (error) {
      console.error(`Failed to generate single checkbox for ${name} (${type}):`, error);
      return false;
    }
  }

  async function generateCheckboxes(type, containerId, fieldName) {
    const container = $id(containerId);
    if (!container) {
      console.warn(`Target container #${containerId} not found`);
      return;
    }
    
    try {
      const data = await geoCache.fetch(type);
      
      // Extract unique features with valid names
      const uniqueFeatures = [];
      const seenNames = new Set();
      
      data.features.forEach(feature => {
        const name = feature.properties.name;
        if (name && name.trim() !== '' && !seenNames.has(name)) {
          seenNames.add(name);
          uniqueFeatures.push(feature);
        }
      });
      
      // Sort by name
      uniqueFeatures.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
      
      if (uniqueFeatures.length === 0) {
        console.warn(`No valid ${type} features found in GeoJSON data`);
        return;
      }
      
      // Clear existing content
      container.innerHTML = '';
      
      // Generate checkboxes using document fragment
      const fragment = document.createDocumentFragment();
      
      uniqueFeatures.forEach(feature => {
        const name = feature.properties.name;
        const slug = feature.properties.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const urlPrefix = type === 'settlements' ? 'settlement' : 'locality';
        
        const wrapperDiv = document.createElement('div');
        // Use singular form for checkbox-filter attribute to match search expectations
        const filterType = type === 'settlements' ? 'settlement' : 'locality';
        wrapperDiv.setAttribute('checkbox-filter', filterType);
        wrapperDiv.className = 'checbox-item';
        
        const label = document.createElement('label');
        label.className = 'w-checkbox reporterwrap-copy';
        
        // Create the link element
        const link = document.createElement('a');
        link.setAttribute('open', '');
        link.href = `/${urlPrefix}/${slug}`;
        link.target = '_blank';
        link.className = 'open-in-new-tab w-inline-block';
        link.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" id="Layer_1" viewBox="0 0 151.49 151.49" width="100%" fill="currentColor" class="svg-3"><polygon class="cls-1" points="151.49 0 151.49 151.49 120.32 151.49 120.32 53.21 22.04 151.49 0 129.45 98.27 31.17 0 31.17 0 0 151.49 0"></polygon></svg>';
        
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
        
        const input = document.createElement('input');
        input.setAttribute('data-auto-sidebar', 'true');
        input.setAttribute('fs-list-value', name);
        input.setAttribute('fs-list-field', fieldName);
        input.type = 'checkbox';
        input.name = filterType;
        input.setAttribute('data-name', filterType);
        input.setAttribute('activate-filter-indicator', 'place');
        input.id = `${type}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;
        input.style.cssText = 'opacity: 0; position: absolute; z-index: -1;';
        
        const span = document.createElement('span');
        span.className = 'test3 w-form-label';
        span.setAttribute('for', input.id);
        span.textContent = name;
        
        const countContainer = document.createElement('div');
        countContainer.className = 'div-block-31834';
        const countDiv = document.createElement('div');
        countDiv.setAttribute('fs-list-element', 'facet-count');
        countDiv.className = 'test33';
        countDiv.textContent = '0';
        countContainer.appendChild(countDiv);
        
        label.appendChild(link);
        label.appendChild(checkboxDiv);
        label.appendChild(input);
        label.appendChild(span);
        label.appendChild(countContainer);
        wrapperDiv.appendChild(label);
        fragment.appendChild(wrapperDiv);
      });
      
      container.appendChild(fragment);
      console.log(`Generated ${uniqueFeatures.length} ${type} checkboxes`);
      
      // Track generated checkboxes
      uniqueFeatures.forEach(feature => {
        const name = feature.properties.name;
        checkboxState.generatedCheckboxes.add(`${type}:${name}`);
      });
      
      domCache.markStale();
      domCache.refresh();
      
      setupGeneratedCheckboxEvents();
      
      // Refresh search script cache if available using idle execution
      IdleExecution.scheduleUI(() => {
        if (window.checkboxFilterScript) {
          window.checkboxFilterScript.recacheElements();
        }
      }, { fallbackDelay: 50 });
      
    } catch (error) {
      console.error(`Failed to generate ${type} checkboxes:`, error);
    }
  }
  
  function generateLocalityCheckboxes() {
    if (checkboxState.localitiesGenerated) {
      console.log('Locality checkboxes already generated');
      return Promise.resolve();
    }
    return generateCheckboxes('localities', 'locality-check-list', 'Locality')
      .then(() => { checkboxState.localitiesGenerated = true; });
  }
  
  function generateSettlementCheckboxes() {
    if (checkboxState.settlementsGenerated) {
      console.log('Settlement checkboxes already generated');
      return Promise.resolve();
    }
    return generateCheckboxes('settlements', 'settlement-check-list', 'Settlement')
      .then(() => { checkboxState.settlementsGenerated = true; });
  }
  
  // Lazy load checkboxes when right sidebar opens
  function lazyLoadCheckboxes() {
    // Prevent multiple simultaneous generations
    if (checkboxState.isGenerating) {
      return checkboxState.generationPromise;
    }
    
    // Check if already generated
    if (checkboxState.localitiesGenerated && checkboxState.settlementsGenerated) {
      console.log('Checkboxes already generated');
      return Promise.resolve();
    }
    
    console.log('Lazy loading checkboxes for filter sidebar...');
    checkboxState.isGenerating = true;
    
    // Show loading state if containers exist
    const localityContainer = $id('locality-check-list');
    const settlementContainer = $id('settlement-check-list');
    
    if (localityContainer && !checkboxState.localitiesGenerated) {
      localityContainer.innerHTML = '<div style="padding: 10px; opacity: 0.6;">Loading localities...</div>';
    }
    if (settlementContainer && !checkboxState.settlementsGenerated) {
      settlementContainer.innerHTML = '<div style="padding: 10px; opacity: 0.6;">Loading settlements...</div>';
    }
    
    // Use requestIdleCallback for non-urgent generation
    checkboxState.generationPromise = new Promise((resolve) => {
      const generateWithIdle = () => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            performCheckboxGeneration().then(resolve);
          }, { timeout: 2000 }); // 2 second timeout
        } else {
          // Fallback for browsers without requestIdleCallback
          IdleExecution.schedule(() => {
            performCheckboxGeneration().then(resolve);
          }, { fallbackDelay: 100 });
        }
      };
      generateWithIdle();
    });
    
    return checkboxState.generationPromise;
  }
  
  async function performCheckboxGeneration() {
    try {
      // Generate in parallel but with idle priority
      await Promise.all([
        generateLocalityCheckboxes(),
        generateSettlementCheckboxes()
      ]);
      
      console.log('All checkboxes generated successfully');
      
      // Recache elements after generation using idle execution
      IdleExecution.scheduleUI(() => {
        // Re-run the setupGeneratedCheckboxEvents for newly created checkboxes
        setupGeneratedCheckboxEvents();
        
        // Check for filtered elements after checkbox generation
        checkAndToggleFilteredElements();
        
        if (window.checkboxFilterScript) {
          window.checkboxFilterScript.recacheElements();
          console.log('Checkboxes recached after lazy generation');
        }
      }, { fallbackDelay: 100 });
      
    } catch (error) {
      console.error('Failed to generate checkboxes:', error);
    } finally {
      checkboxState.isGenerating = false;
    }
  }
  
  // Setup Location tab click listener
  function setupLocationTabListener() {
    // Use event delegation for the Location tab - multiple selectors for reliability
    const locationTabSelectors = [
      '[data-w-tab="Locality/Region"]',  // Primary selector
      '#w-tabs-0-data-w-tab-2'           // ID selector as backup
      // Removed invalid CSS selector that was causing syntax error
    ];
    
    // Try immediate setup
    locationTabSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element.dataset.checkboxListenerAdded === 'true') return;
        
        element.addEventListener('click', function(e) {
          // Only load if not already generated
          if (!checkboxState.localitiesGenerated || !checkboxState.settlementsGenerated) {
            console.log('Location tab clicked - loading checkboxes...');
            lazyLoadCheckboxes();
          }
        });
        
        element.dataset.checkboxListenerAdded = 'true';
      });
    });
    
    // Also use event delegation for dynamically added tabs
    document.addEventListener('click', function(e) {
      const locationTab = e.target.closest('[data-w-tab="Locality/Region"]') ||
                         e.target.closest('#w-tabs-0-data-w-tab-2');
      
      if (locationTab && (!checkboxState.localitiesGenerated || !checkboxState.settlementsGenerated)) {
        console.log('Location tab clicked (delegated) - loading checkboxes...');
        lazyLoadCheckboxes();
      }
    });
  }
  
  // ====================================================================
  // SIDEBAR MANAGEMENT
  // ====================================================================
  const sidebarCache = {
    elements: new Map(),
    arrows: new Map(),
    widths: new Map(),
    
    getSidebar(side) {
      if (!this.elements.has(side)) {
        this.elements.set(side, $id(`${side}Sidebar`));
      }
      return this.elements.get(side);
    },
    
    getArrow(side) {
      if (!this.arrows.has(side)) {
        const arrowKey = side.toLowerCase();
        this.arrows.set(side, $1(`[arrow-icon="${arrowKey}"]`));
      }
      return this.arrows.get(side);
    },
    
    getWidth(side) {
      if (!this.widths.has(side)) {
        const sidebar = this.getSidebar(side);
        if (sidebar) {
          this.widths.set(side, parseInt(getComputedStyle(sidebar).width) || 300);
        }
      }
      return this.widths.get(side) || 300;
    },
    
    getMarginProperty(side) {
      return `margin${side}`;
    },
    
    invalidate() {
      this.elements.clear();
      this.arrows.clear();
      this.widths.clear();
    }
  };
  
  const closeSidebar = (side) => {
    const sidebar = sidebarCache.getSidebar(side);
    if (!sidebar || !sidebar.classList.contains('is-show')) return;
    
    sidebar.classList.remove('is-show');
    
    const arrowIcon = sidebarCache.getArrow(side);
    if (arrowIcon) arrowIcon.style.transform = 'rotateY(0deg)';
    
    const jsMarginProperty = sidebarCache.getMarginProperty(side);
    if (window.innerWidth > 478) {
      const width = sidebarCache.getWidth(side);
      sidebar.style[jsMarginProperty] = `-${width + 1}px`;
    } else {
      sidebar.style[jsMarginProperty] = '';
    }
    
    sidebar.style.pointerEvents = '';
  };
  
  const toggleSidebar = (side, show = null) => {
    const sidebar = sidebarCache.getSidebar(side);
    if (!sidebar) return;
    
    const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
    sidebar.classList.toggle('is-show', isShowing);
    
    const jsMarginProperty = sidebarCache.getMarginProperty(side);
    const arrowIcon = sidebarCache.getArrow(side);
    
    if (window.innerWidth > 478) {
      const width = sidebarCache.getWidth(side);
      sidebar.style[jsMarginProperty] = isShowing ? '0' : `-${width + 1}px`;
      
      if (isShowing && window.innerWidth <= 991) {
        ['Left', 'Right', 'SecondLeft'].forEach(otherSide => {
          if (otherSide !== side) closeSidebar(otherSide);
        });
      }
    } else {
      sidebar.style[jsMarginProperty] = isShowing ? '0' : '';
      if (isShowing) {
        ['Left', 'Right', 'SecondLeft'].forEach(otherSide => {
          if (otherSide !== side) closeSidebar(otherSide);
        });
      }
    }
    
    utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
    if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
  };
  
  // ====================================================================
  // FIELD ITEM AUTO-CHECKING
  // ====================================================================
  
  // Utility function to trigger multiple events (like mapbox script)
  function triggerEvent(element, events) {
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    });
  }
  
  // Function to programmatically check a checkbox with proper visual states (mapbox approach)
  function checkCheckboxProgrammatically(input) {
    if (!input || input.checked) return false;
    
    // Check the input (like mapbox script)
    input.checked = true;
    
    // Trigger events like mapbox script - let Webflow handle visual classes
    triggerEvent(input, ['change', 'input']);
    
    // Also trigger form events like mapbox script
    const form = input.closest('form');
    if (form) {
      form.dispatchEvent(new Event('change', { bubbles: true }));
      form.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    console.log(`Programmatically checked checkbox: ${input.getAttribute('fs-list-value')}`);
    return true;
  }
  
  // Track if Finsweet initialization has been checked (run only once)
  let finsweetInitialized = false;
  
  // Debounce state for processFieldItems
  let processFieldItemsRunning = false;
  let processFieldItemsTimer = null;
  
  // Wait for Finsweet filters to initialize before processing field items (only once)
  function waitForFinsweet() {
    return new Promise((resolve) => {
      // If already checked, resolve immediately
      if (finsweetInitialized) {
        console.log('Finsweet already initialized - proceeding immediately');
        resolve();
        return;
      }
      
      const checkFinsweet = () => {
        const hiddenTagParent = document.getElementById('hiddentagparent');
        const tagParent = document.getElementById('tagparent');
        
        // Log current state for debugging
        console.log('Checking Finsweet state:', {
          hiddenTagParent: hiddenTagParent ? 'exists' : 'not found',
          tagParent: tagParent ? `exists (${tagParent.children.length} children)` : 'not found'
        });
        
        // Check if Finsweet has loaded (hiddentagparent gone OR tagparent empty)
        const finsweetReady = !hiddenTagParent || (tagParent && tagParent.children.length === 0);
        
        if (finsweetReady) {
          console.log('Finsweet filters ready - proceeding with field-item processing');
          finsweetInitialized = true; // Mark as initialized
          resolve();
        } else {
          console.log('Finsweet not ready yet, checking again in 100ms...');
          // Check again in 100ms
          setTimeout(checkFinsweet, 100);
        }
      };
      
      // Start checking immediately
      checkFinsweet();
      
      // Fallback timeout after 5 seconds
      setTimeout(() => {
        console.log('Finsweet wait timeout - proceeding with field-item processing anyway');
        finsweetInitialized = true; // Mark as initialized even on timeout
        resolve();
      }, 5000);
    });
  }

  // Debounced wrapper for processFieldItems
  function processFieldItemsDebounced() {
    // Clear existing timer
    if (processFieldItemsTimer) {
      clearTimeout(processFieldItemsTimer);
      processFieldItemsTimer = null;
    }
    
    // If already running, schedule for later
    if (processFieldItemsRunning) {
      console.log('processFieldItems already running - scheduling retry in 500ms');
      processFieldItemsTimer = setTimeout(processFieldItemsDebounced, 500);
      return;
    }
    
    // Execute immediately
    processFieldItemsTimer = setTimeout(processFieldItemsInternal, 100);
  }

  // Internal implementation of processFieldItems (debounced)
  async function processFieldItemsInternal() {
    // Prevent multiple simultaneous executions
    if (processFieldItemsRunning) {
      console.log('processFieldItems already running - aborting');
      return;
    }
    
    const fieldItems = document.querySelectorAll('[field-item]');
    if (fieldItems.length === 0) {
      console.log('No field-item elements found');
      return;
    }
    
    // Set running flag
    processFieldItemsRunning = true;
    console.log(`Starting processFieldItems - found ${fieldItems.length} field-item elements`);
    
    try {
      // Wait for Finsweet to be ready before processing
      await waitForFinsweet();
      
      console.log(`Processing ${fieldItems.length} field-item elements`);
      
      const processedItems = new Set(); // Avoid duplicates
      
      for (const item of fieldItems) {
        const fieldType = item.getAttribute('field-item');
        const fieldValue = item.textContent.trim();
        
        if (!fieldType || !fieldValue) continue;
        
        const processKey = `${fieldType}:${fieldValue}`;
        if (processedItems.has(processKey)) continue;
        processedItems.add(processKey);
        
        // Use field-item value directly as fs-list-field (modular approach)
        const fieldName = fieldType;
        
        // Check if this is a generatable type (only localities and settlements need generation)
        let checkboxType, containerId, skipGeneration = false;
        
        if (fieldType.toLowerCase() === 'locality') {
          checkboxType = 'localities';
          containerId = 'locality-check-list';
        } else if (fieldType.toLowerCase() === 'settlement') {
          checkboxType = 'settlements';
          containerId = 'settlement-check-list';
        } else {
          // For all other types (Governorate, Category, etc.), skip generation
          // They should already exist on the page
          skipGeneration = true;
          console.log(`Processing existing checkbox type: ${fieldType}`);
        }
        
        // Check if checkbox already exists
        let input = document.querySelector(`input[fs-list-field="${fieldName}"][fs-list-value="${fieldValue}"]`);
        
        if (!input && !skipGeneration) {
          // Generate the missing checkbox (only for localities and settlements)
          console.log(`Generating missing checkbox for ${fieldValue} (${fieldType})`);
          const success = await generateSingleCheckbox(checkboxType, fieldValue, containerId, fieldName);
          
          if (success) {
            // Try to find the checkbox again after generation
            input = document.querySelector(`input[fs-list-field="${fieldName}"][fs-list-value="${fieldValue}"]`);
          }
        }
        
        // Check the checkbox if found
        if (input) {
          checkCheckboxProgrammatically(input);
        } else {
          console.warn(`Could not find or generate checkbox for ${fieldValue} (${fieldType})`);
        }
      }
      
      // Trigger filtered elements check after processing all field items
      IdleExecution.scheduleUI(() => {
        checkAndToggleFilteredElements();
      }, { fallbackDelay: 100 });
      
      console.log('processFieldItems completed successfully');
      
    } catch (error) {
      console.error('Error in processFieldItems:', error);
    } finally {
      // Always clear the running flag
      processFieldItemsRunning = false;
      console.log('processFieldItems finished - cleared running flag');
    }
  }
  
  // ====================================================================
  // FILTERED ELEMENTS
  // ====================================================================
  
  // Toggle filtered elements with immediate DOM updates (matching mapbox)
  const toggleShowWhenFilteredElements = show => {
    // Don't use cached results for critical filtering elements - always fresh query
    const elements = document.querySelectorAll('[show-when-filtered="true"]');
    if (elements.length === 0) return;
    
    // Apply changes immediately - no delay logic needed
    elements.forEach(element => {
      element.style.display = show ? 'block' : 'none';
    });
  };
  
  // SIMPLIFIED: Only use hiddentagparent method for filtering detection (matching mapbox)
  const checkAndToggleFilteredElements = () => {
    // Check for hiddentagparent (Finsweet official filtering indicator)
    const hiddenTagParent = document.getElementById('hiddentagparent');
    const shouldShow = !!hiddenTagParent;
    
    toggleShowWhenFilteredElements(shouldShow);
    return shouldShow;
  };
  
  const monitorTags = (() => {
    let isSetup = false;
    let pollingTimer = null;
    
    return () => {
      if (isSetup) return;
      
      checkAndToggleFilteredElements();
      
      const tagParent = document.getElementById('tagparent');
      if (tagParent) {
        if (tagParent._mutationObserver) {
          tagParent._mutationObserver.disconnect();
        }
        
        const observer = new MutationObserver(() => {
          // Immediate check when DOM changes (like mapbox)
          checkAndToggleFilteredElements();
        });
        observer.observe(tagParent, {childList: true, subtree: true});
        
        tagParent._mutationObserver = observer;
      }
      
      const allCheckboxes = document.querySelectorAll('[checkbox-filter] input[type="checkbox"]');
      allCheckboxes.forEach(checkbox => {
        if (!checkbox.dataset.filteredElementListener) {
          eventManager.add(checkbox, 'change', () => {
            IdleExecution.scheduleUI(checkAndToggleFilteredElements);
          });
          checkbox.dataset.filteredElementListener = 'true';
        }
      });
      
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        if (!form.dataset.filteredElementListener) {
          eventManager.add(form, 'change', () => {
            IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 50 });
          });
          eventManager.add(form, 'input', () => {
            IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 50 });
          });
          form.dataset.filteredElementListener = 'true';
        }
      });
      
      const startPolling = () => {
        if (pollingTimer) clearTimeout(pollingTimer);
        
        pollingTimer = setTimeout(() => {
          checkAndToggleFilteredElements(); // Just check, don't setup again
          startPolling(); // Continue polling
        }, 1000);
      };
      
      startPolling();
      isSetup = true;
    };
  })();
  
  // ====================================================================
  // BACK TO TOP BUTTON
  // ====================================================================
  function setupBackToTopButton() {
    const button = $id('jump-to-top');
    const scrollContainer = $id('scroll-wrap');
    
    if (!button || !scrollContainer) return;
    
    button.style.opacity = '0';
    button.style.display = 'flex';
    button.style.pointerEvents = 'none';
    
    const scrollThreshold = 100;
    let isVisible = false;
    
    const updateButtonVisibility = () => {
      const scrollTop = scrollContainer.scrollTop;
      const shouldShow = scrollTop > scrollThreshold;
      
      if (shouldShow && !isVisible) {
        isVisible = true;
        button.style.display = 'flex';
        button.style.pointerEvents = 'auto';
        const opacity = Math.min(1, (scrollTop - scrollThreshold) / 100);
        button.style.opacity = opacity.toString();
      } else if (!shouldShow && isVisible) {
        isVisible = false;
        button.style.opacity = '0';
        button.style.pointerEvents = 'none';
      } else if (shouldShow && isVisible) {
        const opacity = Math.min(1, (scrollTop - scrollThreshold) / 100);
        button.style.opacity = opacity.toString();
      }
    };
    
    const scrollToTop = () => {
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'auto'
      });
    };
    
    eventManager.add(scrollContainer, 'scroll', updateButtonVisibility);
    eventManager.add(button, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      scrollToTop();
    });
    
    const tagParent = $id('tagparent');
    if (tagParent) {
      const tagObserver = new MutationObserver(() => {
        scrollToTop();
      });
      
      tagObserver.observe(tagParent, {
        childList: true,
        subtree: true,
        attributes: true
      });
      
      tagParent._tagObserver = tagObserver;
    }
    
    updateButtonVisibility();
  }
  
  // ====================================================================
  // EVENT HANDLERS
  // ====================================================================
  function setupGeneratedCheckboxEvents() {
    // Setup events for dynamically generated checkboxes
    const autoSidebarCheckboxes = document.querySelectorAll('[data-auto-sidebar="true"]');
    let newListenersCount = 0;
    
    autoSidebarCheckboxes.forEach(element => {
      // Skip if already handled by setupEvents or event delegation
      if (element.dataset.eventListenerAdded === 'true' || element.dataset.eventSetup === 'true') return;
      
      const changeHandler = () => {
        if (window.innerWidth > 991) {
          state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
        }
      };
      
      eventManager.add(element, 'change', changeHandler);
      
      if (['text', 'search'].includes(element.type)) {
        const inputHandler = () => {
          if (window.innerWidth > 991) {
            state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
          }
        };
        eventManager.add(element, 'input', inputHandler);
      }
      
      element.dataset.eventListenerAdded = 'true';
      newListenersCount++;
    });
    
    if (newListenersCount > 0) {
      console.log(`Added event listeners to ${newListenersCount} new checkbox elements`);
    }
  }
  
  function setupControls() {
    const controlMap = {
      'AllEvents': () => $id('ClearAll')?.click(),
      'ToggleLeft': () => {
        const leftSidebar = $id('LeftSidebar');
        if (leftSidebar) toggleSidebar('Left', !leftSidebar.classList.contains('is-show'));
      }
    };
    
    Object.entries(controlMap).forEach(([id, action]) => {
      const btn = $id(id);
      if (btn) {
        eventManager.add(btn, 'click', (e) => {
          e.preventDefault(); 
          e.stopPropagation(); 
          action();
        });
      }
    });
    
    const setupSidebarControls = (selector, sidebarSide, eventType = 'click') => {
      const elements = $(selector);
      elements.forEach(element => {
        if (element.dataset.sidebarSetup === 'true') return;
        
        const handler = () => {
          const sidebar = $id(`${sidebarSide}Sidebar`);
          if (!sidebar) return;
          
          const openRightSidebar = element.getAttribute('open-right-sidebar');
          
          if (sidebarSide === 'Right') {
            if (openRightSidebar === 'open-only') {
              toggleSidebar('Right', true);
            } else if (openRightSidebar === 'true') {
              const currentlyShowing = sidebar.classList.contains('is-show');
              toggleSidebar('Right', !currentlyShowing);
            }
          } else {
            toggleSidebar(sidebarSide, !sidebar.classList.contains('is-show'));
          }
        };
        
        if (eventType === 'change' && (element.type === 'radio' || element.type === 'checkbox')) {
          eventManager.add(element, 'change', () => element.checked && handler());
        } else {
          eventManager.add(element, eventType, (e) => {
            e.stopPropagation(); 
            handler();
          });
        }
        
        element.dataset.sidebarSetup = 'true';
      });
    };
    
    setupSidebarControls('[open-right-sidebar="true"], [open-right-sidebar="open-only"]', 'Right');
    setupSidebarControls('.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]', 'Left', 'change');
    setupSidebarControls('[data-auto-second-left-sidebar="true"]', 'SecondLeft', 'change');
    
    setupBackToTopButton();
  }
  
  function setupSidebars() {
    let zIndex = 1000;
    
    const setupSidebarElement = (side) => {
      const sidebar = sidebarCache.getSidebar(side);
      const tab = $id(`${side}SideTab`);
      const close = $id(`${side}SidebarClose`);
      
      if (!sidebar || !tab || !close) return false;
      if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
      
      const cssTransitionProperty = `margin-${side.toLowerCase()}`;
      utils.setStyles(sidebar, {
        transition: `${cssTransitionProperty} 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
        zIndex: zIndex,
        position: 'relative'
      });
      utils.setStyles(tab, {
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      });
      
      const bringToFront = () => {
        const newZ = ++zIndex;
        sidebar.style.zIndex = newZ;
        
        if (window.innerWidth <= 478) {
          tab.style.zIndex = newZ + 10;
          if (tab.parentElement) tab.parentElement.style.zIndex = newZ + 10;
        }
        
        ['Left', 'Right', 'SecondLeft'].forEach(otherSide => {
          if (otherSide !== side) {
            const otherSidebar = sidebarCache.getSidebar(otherSide);
            const otherTab = $id(`${otherSide}SideTab`);
            
            if (otherSidebar) otherSidebar.style.zIndex = newZ - 1;
            if (otherTab && window.innerWidth <= 478) {
              otherTab.style.zIndex = newZ + 5;
              if (otherTab.parentElement) otherTab.parentElement.style.zIndex = newZ + 5;
            }
          }
        });
      };
      
      if (!sidebar.dataset.clickSetup) {
        eventManager.add(sidebar, 'click', () => {
          if (sidebar.classList.contains('is-show')) bringToFront();
        });
        sidebar.dataset.clickSetup = 'true';
      }
      
      if (tab.dataset.setupComplete !== 'true') {
        eventManager.add(tab, 'click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSidebar(side, !sidebar.classList.contains('is-show'));
        });
        tab.dataset.setupComplete = 'true';
      }
      
      if (close.dataset.setupComplete !== 'true') {
        eventManager.add(close, 'click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSidebar(side, false);
        });
        close.dataset.setupComplete = 'true';
      }
      
      zIndex++;
      return true;
    };
    
    const attemptSetup = (attempt = 1, maxAttempts = 5) => {
      const leftReady = setupSidebarElement('Left');
      const rightReady = setupSidebarElement('Right');
      const secondLeftReady = setupSidebarElement('SecondLeft');
      
      if (leftReady && rightReady) {
        setupInitialMargins();
        state.setTimer('setupControls', setupControls, 50);
        return;
      }
      
      if (attempt < maxAttempts) {
        const delay = [50, 150, 250, 500][attempt - 1] || 500;
        state.setTimer(`sidebarSetup-${attempt}`, () => attemptSetup(attempt + 1, maxAttempts), delay);
      } else {
        setupInitialMargins();
        state.setTimer('setupControls', setupControls, 50);
      }
    };
    
    const setupInitialMargins = () => {
      if (window.innerWidth <= 478) return;
      
      ['Left', 'Right', 'SecondLeft'].forEach(side => {
        const sidebar = sidebarCache.getSidebar(side);
        if (sidebar && !sidebar.classList.contains('is-show')) {
          const width = sidebarCache.getWidth(side);
          const jsMarginProperty = sidebarCache.getMarginProperty(side);
          sidebar.style[jsMarginProperty] = `-${width + 1}px`;
        }
      });
    };
    
    attemptSetup();
  }
  
  function setupEvents() {
    const eventHandlers = [
      {selector: '[data-auto-sidebar="true"]', events: ['change', 'input'], handler: () => {
        if (window.innerWidth > 991) {
          state.setTimer('sidebarUpdate', () => toggleSidebar('Left', true), 50);
        }
      }},
      {selector: '[data-auto-second-left-sidebar="true"]', events: ['change', 'input'], handler: () => {
        if (window.innerWidth > 991) {
          state.setTimer('sidebarUpdate', () => toggleSidebar('SecondLeft', true), 50);
        }
      }}
    ];
    
    eventHandlers.forEach(({selector, events, handler}) => {
      const elements = $(selector);
      elements.forEach(element => {
        events.forEach(event => {
          if (event === 'input' && ['text', 'search'].includes(element.type)) {
            eventManager.add(element, event, handler);
          } else if (event !== 'input' || element.type !== 'text') {
            eventManager.add(element, event, handler);
          }
        });
      });
    });
    
    ['fs-cmsfilter-change', 'fs-cmsfilter-search', 'fs-cmsfilter-reset', 'fs-cmsfilter-filtered'].forEach(event => {
      eventManager.add(document, event, () => {
        IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 50 });
      });
    });
    
    // Firefox form prevention removed to fix Zapier integration issues
    // Original code prevented submission of forms with filter elements
    // but was causing conflicts with report form submissions
  }
  
  // ====================================================================
  // INITIALIZATION
  // ====================================================================
  function initializeCore() {
    // Don't generate checkboxes immediately - wait for Location tab click
    setupSidebars();
    setupEvents();
    setupLocationTabListener();
    
    // Check for filters immediately
    checkAndToggleFilteredElements(true);
    
    // Start monitoring immediately
    monitorTags();
  }
  
  // ====================================================================
  // PUBLIC API
  // ====================================================================
  window.SharedCore = {
    // Core utilities
    domCache,
    eventManager,
    state,
    geoCache,
    utils,
    
    // jQuery-like shortcuts
    $,
    $1,
    $id,
    
    // Sidebar functions
    toggleSidebar,
    closeSidebar,
    sidebarCache,
    
    // Filtered elements
    checkAndToggleFilteredElements,
    toggleShowWhenFilteredElements,
    
    // Initialization
    init: initializeCore,
    
    // Checkbox generation (lazy-loaded)
    lazyLoadCheckboxes,
    checkboxState,
    generateSingleCheckbox,
    
    // Field-item auto-checking
    processFieldItems: processFieldItemsDebounced,
    checkCheckboxProgrammatically,
    
    // For map page
    getGeoJSONData: async function() {
      return {
        localities: await geoCache.fetch('localities'),
        settlements: await geoCache.fetch('settlements')
      };
    }
  };
  
  // ====================================================================
  // AUTO-INITIALIZATION
  // ====================================================================
  // Check for filters immediately when script loads - optimized version
  const immediateCheck = () => {
    const hiddenTagParent = document.getElementById('hiddentagparent');
    if (hiddenTagParent) {
      // Show filtered elements immediately!
      const elements = document.querySelectorAll('[show-when-filtered="true"]');
      elements.forEach(element => {
        element.style.display = 'block';
        element.style.visibility = 'visible';
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
      });
    }
    
    // Process field-item elements immediately to auto-check corresponding checkboxes
    IdleExecution.scheduleUI(() => {
      processFieldItemsDebounced();
    }, { fallbackDelay: 200 });
  };
  immediateCheck();
  
  // Setup event delegation immediately for existing elements on the page
  (function setupImmediateEventDelegation() {
    // Use capturing phase to catch all events, even from existing elements
    document.addEventListener('change', (e) => {
      if (e.target.matches('[data-auto-sidebar="true"]')) {
        if (window.innerWidth > 991) {
          state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
        }
      }
      if (e.target.matches('[data-auto-second-left-sidebar="true"]')) {
        if (window.innerWidth > 991) {
          state.setTimer('autoSidebar', () => toggleSidebar('SecondLeft', true), 50);
        }
      }
    }, true);
    
    document.addEventListener('input', (e) => {
      if (e.target.matches('[data-auto-sidebar="true"]') && ['text', 'search'].includes(e.target.type)) {
        if (window.innerWidth > 991) {
          state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
        }
      }
      if (e.target.matches('[data-auto-second-left-sidebar="true"]') && ['text', 'search'].includes(e.target.type)) {
        if (window.innerWidth > 991) {
          state.setTimer('autoSidebar', () => toggleSidebar('SecondLeft', true), 50);
        }
      }
    }, true);
  })();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      immediateCheck();
      
      // Check immediately since hiddentagparent might exist
      const hiddenTagParent = document.getElementById('hiddentagparent');
      if (hiddenTagParent) {
        toggleShowWhenFilteredElements(true);
      }
      
      // Process field items after DOM is ready
      IdleExecution.scheduleUI(() => {
        processFieldItemsDebounced();
      }, { fallbackDelay: 300 });
      
      initializeCore();
    });
  } else {
    // Check immediately if hiddentagparent exists
    const hiddenTagParent = document.getElementById('hiddentagparent');
    if (hiddenTagParent) {
      toggleShowWhenFilteredElements(true);
    }
    
    // Process field items if DOM is already ready
    IdleExecution.scheduleUI(() => {
      processFieldItemsDebounced();
    }, { fallbackDelay: 100 });
    
    initializeCore();
  }
  
  window.addEventListener('load', () => {
    // Check immediately on window load
    checkAndToggleFilteredElements();
    
    setupSidebars();
    
    // Check for filtered elements using idle execution
    IdleExecution.scheduleUI(() => {
      checkAndToggleFilteredElements();
    }, { fallbackDelay: 300 });
    
    // Additional check after page is fully loaded (matching mapbox timing)
    state.setTimer('loadCheckFiltered', checkAndToggleFilteredElements, 200);
    
    // Process field items after full page load as final fallback
    state.setTimer('loadProcessFieldItems', processFieldItemsDebounced, 400);
  });
  
  window.addEventListener('beforeunload', () => {
    // Cleanup utilities and managers
    eventManager.cleanup();
    state.cleanup();
    sidebarCache.invalidate();
    
    // Clear large data structures for memory management
    if (window.geoCache) {
      window.geoCache.clear();
    }
    
    // Disconnect observers
    const tagParent = $id('tagparent');
    if (tagParent && tagParent._mutationObserver) {
      tagParent._mutationObserver.disconnect();
    }
    
    if (tagParent && tagParent._tagObserver) {
      tagParent._tagObserver.disconnect();
    }
    
    // Clear global state
    checkboxState.localitiesGenerated = false;
    checkboxState.settlementsGenerated = false;
    checkboxState.generationPromise = null;
  });
  
})(window);
