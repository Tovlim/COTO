// ====================================================================
// RIGHT SIDEBAR SCRIPT - Simplified from SharedCore
// Contains: DOM cache, Event manager, Right Sidebar, Checkboxes, GeoJSON caching, Field-item auto-checking
// Version: 1.1.0
//
// Simplified version with only right sidebar functionality
// Added in v1.1.0: Field-item auto-checking functionality
// ====================================================================

(function(window) {
  'use strict';

  // Skip initialization if already loaded
  if (window.RightSidebarScript) return;

  // ====================================================================
  // CONFIGURATION
  // ====================================================================
  const CONFIG = {
    CACHE_VERSION: '1.0.1',
    CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
    GEOJSON_URLS: {
      localities: 'https://raw.githubusercontent.com/Tovlim/COTO/refs/heads/main/localities-0.010.geojson',
      settlements: 'https://raw.githubusercontent.com/Tovlim/COTO/refs/heads/main/settlements-0.006.geojson'
    }
  };

  // ====================================================================
  // SAFE STORAGE WRAPPER
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
  // GEOJSON DATA CACHING
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
      }
    }

    clearOldCache() {
      this.storage.clearOldData();
    }

    async fetch(type) {
      const cached = this.get(type);
      if (cached) {
        return cached;
      }

      const url = CONFIG.GEOJSON_URLS[type];
      if (!url) throw new Error(`Unknown GeoJSON type: ${type}`);

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        this.set(type, data);
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
  // IDLE EXECUTION UTILITY
  // ====================================================================
  const IdleExecution = {
    schedule(callback, options = {}) {
      const { timeout = 2000, fallbackDelay = 100 } = options;

      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout });
      } else {
        setTimeout(callback, fallbackDelay);
      }
    },

    scheduleUI(callback, options = {}) {
      const { timeout = 500, fallbackDelay = 16 } = options;
      this.schedule(callback, { timeout, fallbackDelay });
    },

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
  // CHECKBOX GENERATION
  // ====================================================================
  const checkboxState = {
    localitiesGenerated: false,
    settlementsGenerated: false,
    isGenerating: false,
    generationPromise: null,
    generatedCheckboxes: new Set()
  };

  async function generateSingleCheckbox(type, name, containerId, fieldName) {
    const container = $id(containerId);
    if (!container) {
      console.warn(`Target container #${containerId} not found`);
      return false;
    }

    const checkboxKey = `${type}:${name}`;
    if (checkboxState.generatedCheckboxes.has(checkboxKey)) {
      return true;
    }

    try {
      const data = await geoCache.fetch(type);
      const feature = data.features.find(f => f.properties.name === name);

      if (!feature) {
        console.warn(`Feature '${name}' not found in ${type} data`);
        return false;
      }

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

      checkboxState.generatedCheckboxes.add(checkboxKey);

      domCache.markStale();
      domCache.refresh();

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

      const uniqueFeatures = [];
      const seenNames = new Set();

      data.features.forEach(feature => {
        const name = feature.properties.name;
        if (name && name.trim() !== '' && !seenNames.has(name)) {
          seenNames.add(name);
          uniqueFeatures.push(feature);
        }
      });

      uniqueFeatures.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

      if (uniqueFeatures.length === 0) {
        console.warn(`No valid ${type} features found in GeoJSON data`);
        return;
      }

      container.innerHTML = '';

      const fragment = document.createDocumentFragment();

      uniqueFeatures.forEach(feature => {
        const name = feature.properties.name;
        const slug = feature.properties.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const urlPrefix = type === 'settlements' ? 'settlement' : 'locality';

        const wrapperDiv = document.createElement('div');
        const filterType = type === 'settlements' ? 'settlement' : 'locality';
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

      uniqueFeatures.forEach(feature => {
        const name = feature.properties.name;
        checkboxState.generatedCheckboxes.add(`${type}:${name}`);
      });

      domCache.markStale();
      domCache.refresh();

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
      return Promise.resolve();
    }
    return generateCheckboxes('localities', 'locality-check-list', 'Locality')
      .then(() => { checkboxState.localitiesGenerated = true; });
  }

  function generateSettlementCheckboxes() {
    if (checkboxState.settlementsGenerated) {
      return Promise.resolve();
    }
    return generateCheckboxes('settlements', 'settlement-check-list', 'Settlement')
      .then(() => { checkboxState.settlementsGenerated = true; });
  }

  function lazyLoadCheckboxes() {
    if (checkboxState.isGenerating) {
      return checkboxState.generationPromise;
    }

    if (checkboxState.localitiesGenerated && checkboxState.settlementsGenerated) {
      return Promise.resolve();
    }

    checkboxState.isGenerating = true;

    const localityContainer = $id('locality-check-list');
    const settlementContainer = $id('settlement-check-list');

    if (localityContainer && !checkboxState.localitiesGenerated) {
      localityContainer.innerHTML = '<div style="padding: 10px; opacity: 0.6;">Loading localities...</div>';
    }
    if (settlementContainer && !checkboxState.settlementsGenerated) {
      settlementContainer.innerHTML = '<div style="padding: 10px; opacity: 0.6;">Loading settlements...</div>';
    }

    checkboxState.generationPromise = new Promise((resolve) => {
      const generateWithIdle = () => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            performCheckboxGeneration().then(resolve);
          }, { timeout: 2000 });
        } else {
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
      await Promise.all([
        generateLocalityCheckboxes(),
        generateSettlementCheckboxes()
      ]);

      IdleExecution.scheduleUI(() => {
        checkAndToggleFilteredElements();

        if (window.checkboxFilterScript) {
          window.checkboxFilterScript.recacheElements();
        }
      }, { fallbackDelay: 100 });

    } catch (error) {
      console.error('Failed to generate checkboxes:', error);
    } finally {
      checkboxState.isGenerating = false;
    }
  }

  function setupLocationTabListener() {
    const locationTabSelectors = [
      '[data-w-tab="Locality/Region"]',
      '#w-tabs-0-data-w-tab-2'
    ];

    locationTabSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element.dataset.checkboxListenerAdded === 'true') return;

        element.addEventListener('click', function(e) {
          if (e.target.tagName === 'INPUT' || e.target.hasAttribute('fs-list-field')) {
            return;
          }

          if (!checkboxState.localitiesGenerated || !checkboxState.settlementsGenerated) {
            lazyLoadCheckboxes();
          }
        });

        element.dataset.checkboxListenerAdded = 'true';
      });
    });

    document.addEventListener('click', function(e) {
      const locationTab1 = e.target.closest('[data-w-tab="Locality/Region"]');
      const locationTab2 = e.target.closest('#w-tabs-0-data-w-tab-2');
      const locationTab = locationTab1 || locationTab2;

      if (locationTab && (!checkboxState.localitiesGenerated || !checkboxState.settlementsGenerated)) {
        if (e.target.tagName === 'INPUT' || e.target.hasAttribute('fs-list-field')) {
          return;
        }

        lazyLoadCheckboxes();
      }
    });
  }

  // ====================================================================
  // FIELD ITEM AUTO-CHECKING
  // ====================================================================

  // Utility function to trigger multiple events
  function triggerEvent(element, events, isProgrammatic = false) {
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      if (isProgrammatic) {
        event.isProgrammaticFieldItemCheck = true;
      }
      element.dispatchEvent(event);
    });
  }

  // Function to programmatically check a checkbox with proper visual states
  function checkCheckboxProgrammatically(input) {
    if (!input || input.checked) return false;

    input.checked = true;

    // Trigger events - let Webflow handle visual classes
    triggerEvent(input, ['change', 'input'], true);

    // Also trigger form events
    const form = input.closest('form');
    if (form) {
      const changeEvent = new Event('change', { bubbles: true });
      const inputEvent = new Event('input', { bubbles: true });

      changeEvent.isProgrammaticFieldItemCheck = true;
      inputEvent.isProgrammaticFieldItemCheck = true;

      form.dispatchEvent(changeEvent);
      form.dispatchEvent(inputEvent);
    }

    return true;
  }

  // Track if Finsweet initialization has been checked (run only once)
  let finsweetInitialized = false;

  // Debounce state for processFieldItems
  let processFieldItemsRunning = false;
  let processFieldItemsTimer = null;

  // Early detection of field-items to skip unnecessary processing
  let hasFieldItemsOnPage = false;

  // Check once if page has field-items
  function checkForFieldItems() {
    if (!hasFieldItemsOnPage) {
      hasFieldItemsOnPage = document.querySelector('[field-item]') !== null;
    }
    return hasFieldItemsOnPage;
  }

  // Wait for Finsweet filters to initialize before processing field items (only once)
  function waitForFinsweet() {
    return new Promise((resolve) => {
      if (finsweetInitialized) {
        resolve();
        return;
      }

      const checkFinsweet = () => {
        const hiddenTagParent = document.getElementById('hiddentagparent');
        const tagParent = document.getElementById('tagparent');

        // Check if Finsweet has loaded (hiddentagparent gone OR tagparent empty)
        const finsweetReady = !hiddenTagParent || (tagParent && tagParent.children.length === 0);

        if (finsweetReady) {
          finsweetInitialized = true;
          resolve();
        } else {
          setTimeout(checkFinsweet, 100);
        }
      };

      checkFinsweet();

      // Fallback timeout after 5 seconds
      setTimeout(() => {
        finsweetInitialized = true;
        resolve();
      }, 5000);
    });
  }

  // Debounced wrapper for processFieldItems
  function processFieldItemsDebounced() {
    if (!checkForFieldItems()) {
      return;
    }

    if (processFieldItemsTimer) {
      clearTimeout(processFieldItemsTimer);
      processFieldItemsTimer = null;
    }

    if (processFieldItemsRunning) {
      processFieldItemsTimer = setTimeout(processFieldItemsDebounced, 500);
      return;
    }

    processFieldItemsTimer = setTimeout(processFieldItemsInternal, 100);
  }

  // Internal implementation of processFieldItems (debounced)
  async function processFieldItemsInternal() {
    if (processFieldItemsRunning) {
      return;
    }

    const allFieldItems = document.querySelectorAll('[field-item]');
    const fieldItems = Array.from(allFieldItems).filter(item => {
      return !item.classList.contains('w-condition-invisible');
    });

    if (fieldItems.length === 0) {
      return;
    }

    processFieldItemsRunning = true;

    try {
      await waitForFinsweet();

      const processedItems = new Set();

      for (const item of fieldItems) {
        const fieldType = item.getAttribute('field-item');
        const fieldValue = item.textContent.trim();

        if (!fieldType || !fieldValue) continue;

        const processKey = `${fieldType}:${fieldValue}`;
        if (processedItems.has(processKey)) continue;
        processedItems.add(processKey);

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
          // For all other types, skip generation - they should already exist on the page
          skipGeneration = true;
        }

        // Check if checkbox already exists
        let input = document.querySelector(`input[fs-list-field="${fieldName}"][fs-list-value="${fieldValue}"]`);

        if (!input && !skipGeneration) {
          // Generate the missing checkbox (only for localities and settlements)
          const success = await generateSingleCheckbox(checkboxType, fieldValue, containerId, fieldName);

          if (success) {
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

    } catch (error) {
      console.error('Error in processFieldItems:', error);
    } finally {
      processFieldItemsRunning = false;
    }
  }

  // ====================================================================
  // RIGHT SIDEBAR MANAGEMENT
  // ====================================================================
  const sidebarCache = {
    element: null,
    arrow: null,
    width: null,

    getSidebar() {
      if (!this.element) {
        this.element = $id('RightSidebar');
      }
      return this.element;
    },

    getArrow() {
      if (!this.arrow) {
        this.arrow = $1('[arrow-icon="right"]');
      }
      return this.arrow;
    },

    getWidth() {
      if (!this.width) {
        const sidebar = this.getSidebar();
        if (sidebar) {
          this.width = parseInt(getComputedStyle(sidebar).width) || 300;
        }
      }
      return this.width || 300;
    },

    invalidate() {
      this.element = null;
      this.arrow = null;
      this.width = null;
    }
  };

  const closeSidebar = () => {
    const sidebar = sidebarCache.getSidebar();
    if (!sidebar || !sidebar.classList.contains('is-show')) return;

    sidebar.classList.remove('is-show');

    const arrowIcon = sidebarCache.getArrow();
    if (arrowIcon) arrowIcon.style.transform = 'rotateY(0deg)';

    if (window.innerWidth > 478) {
      const width = sidebarCache.getWidth();
      sidebar.style.marginRight = `-${width + 1}px`;
    } else {
      sidebar.style.marginRight = '';
    }

    sidebar.style.pointerEvents = '';
  };

  const toggleSidebar = (show = null) => {
    const sidebar = sidebarCache.getSidebar();
    if (!sidebar) return;

    const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
    sidebar.classList.toggle('is-show', isShowing);

    const arrowIcon = sidebarCache.getArrow();

    if (window.innerWidth > 478) {
      const width = sidebarCache.getWidth();
      sidebar.style.marginRight = isShowing ? '0' : `-${width + 1}px`;
    } else {
      sidebar.style.marginRight = isShowing ? '0' : '';
    }

    utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
    if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
  };

  // ====================================================================
  // FILTERED ELEMENTS
  // ====================================================================
  const toggleShowWhenFilteredElements = show => {
    const elements = document.querySelectorAll('[show-when-filtered="true"]');
    if (elements.length === 0) return;

    elements.forEach(element => {
      element.style.display = show ? 'block' : 'none';
    });
  };

  const checkAndToggleFilteredElements = () => {
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
          checkAndToggleFilteredElements();
        });
        observer.observe(tagParent, {childList: true, subtree: true});

        tagParent._mutationObserver = observer;
      }

      const startPolling = () => {
        if (pollingTimer) clearTimeout(pollingTimer);

        pollingTimer = setTimeout(() => {
          checkAndToggleFilteredElements();
          startPolling();
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
  function setupSidebar() {
    const sidebar = sidebarCache.getSidebar();
    const tab = $id('RightSideTab');
    const close = $id('RightSidebarClose');

    if (!sidebar || !tab || !close) return;

    utils.setStyles(sidebar, {
      transition: 'margin-right 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative'
    });

    if (tab.dataset.setupComplete !== 'true') {
      eventManager.add(tab, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar(!sidebar.classList.contains('is-show'));
      });
      tab.dataset.setupComplete = 'true';
    }

    if (close.dataset.setupComplete !== 'true') {
      eventManager.add(close, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar(false);
      });
      close.dataset.setupComplete = 'true';
    }

    if (window.innerWidth > 478 && !sidebar.classList.contains('is-show')) {
      const width = sidebarCache.getWidth();
      sidebar.style.marginRight = `-${width + 1}px`;
    }
  }

  function setupControls() {
    const setupSidebarControls = (selector) => {
      const elements = $(selector);
      elements.forEach(element => {
        if (element.dataset.sidebarSetup === 'true') return;

        const handler = () => {
          const sidebar = sidebarCache.getSidebar();
          if (!sidebar) return;

          const openRightSidebar = element.getAttribute('open-right-sidebar');

          if (openRightSidebar === 'open-only') {
            toggleSidebar(true);
          } else if (openRightSidebar === 'true') {
            const currentlyShowing = sidebar.classList.contains('is-show');
            toggleSidebar(!currentlyShowing);
          }
        };

        eventManager.add(element, 'click', (e) => {
          e.stopPropagation();
          handler();
        });

        element.dataset.sidebarSetup = 'true';
      });
    };

    setupSidebarControls('[open-right-sidebar="true"], [open-right-sidebar="open-only"]');
    setupBackToTopButton();
  }

  // ====================================================================
  // INITIALIZATION
  // ====================================================================
  function initializeCore() {
    setupSidebar();
    setupControls();
    setupLocationTabListener();

    checkAndToggleFilteredElements();
    monitorTags();
  }

  // ====================================================================
  // PUBLIC API
  // ====================================================================
  window.RightSidebarScript = {
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

    // Checkbox generation
    lazyLoadCheckboxes,
    checkboxState,
    generateSingleCheckbox,

    // Field-item auto-checking
    processFieldItems: processFieldItemsDebounced,
    checkCheckboxProgrammatically,

    // GeoJSON data access
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
  const immediateCheck = () => {
    const hiddenTagParent = document.getElementById('hiddentagparent');
    if (hiddenTagParent) {
      const elements = document.querySelectorAll('[show-when-filtered="true"]');
      elements.forEach(element => {
        element.style.display = 'block';
        element.style.visibility = 'visible';
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
      });
    }

    // Process field-item elements immediately to auto-check corresponding checkboxes
    if (checkForFieldItems()) {
      IdleExecution.scheduleUI(() => {
        processFieldItemsDebounced();
      }, { fallbackDelay: 200 });
    }
  };
  immediateCheck();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      immediateCheck();

      const hiddenTagParent = document.getElementById('hiddentagparent');
      if (hiddenTagParent) {
        toggleShowWhenFilteredElements(true);
      }

      // Process field items after DOM is ready
      if (checkForFieldItems()) {
        IdleExecution.scheduleUI(() => {
          processFieldItemsDebounced();
        }, { fallbackDelay: 300 });
      }

      initializeCore();
    });
  } else {
    const hiddenTagParent = document.getElementById('hiddentagparent');
    if (hiddenTagParent) {
      toggleShowWhenFilteredElements(true);
    }

    // Process field items if DOM is already ready
    if (checkForFieldItems()) {
      IdleExecution.scheduleUI(() => {
        processFieldItemsDebounced();
      }, { fallbackDelay: 100 });
    }

    initializeCore();
  }

  window.addEventListener('load', () => {
    checkAndToggleFilteredElements();
    setupSidebar();

    IdleExecution.scheduleUI(() => {
      checkAndToggleFilteredElements();
    }, { fallbackDelay: 300 });

    state.setTimer('loadCheckFiltered', checkAndToggleFilteredElements, 200);

    // Process field items after full page load as final fallback
    if (checkForFieldItems()) {
      state.setTimer('loadProcessFieldItems', processFieldItemsDebounced, 400);
    }
  });

  window.addEventListener('beforeunload', () => {
    eventManager.cleanup();
    state.cleanup();
    sidebarCache.invalidate();

    if (window.geoCache) {
      window.geoCache.clear();
    }

    const tagParent = $id('tagparent');
    if (tagParent && tagParent._mutationObserver) {
      tagParent._mutationObserver.disconnect();
    }

    if (tagParent && tagParent._tagObserver) {
      tagParent._tagObserver.disconnect();
    }

    checkboxState.localitiesGenerated = false;
    checkboxState.settlementsGenerated = false;
    checkboxState.generationPromise = null;
  });

})(window);
