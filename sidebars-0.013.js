// ====================================================================
// SHARED CORE MODULE - Loads on ALL pages
// Contains: DOM cache, Event manager, Sidebars, Checkboxes, GeoJSON caching
// Version: 1.0.0
// ====================================================================

(function(window) {
  'use strict';
  
  // Skip initialization if already loaded
  if (window.SharedCore) return;
  
  // ====================================================================
  // CONFIGURATION
  // ====================================================================
  const CONFIG = {
    CACHE_VERSION: '1.0.0',
    CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
    GEOJSON_URLS: {
      localities: 'https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/localities-0.003.geojson',
      settlements: 'https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/settlements-0.001.geojson'
    }
  };
  
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
    constructor() {
      this.cachePrefix = 'geojson_cache_';
    }
    
    getCacheKey(type) {
      return `${this.cachePrefix}${type}_${CONFIG.CACHE_VERSION}`;
    }
    
    get(type) {
      try {
        const key = this.getCacheKey(type);
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        
        const data = JSON.parse(cached);
        const now = Date.now();
        
        if (now - data.timestamp > CONFIG.CACHE_DURATION) {
          localStorage.removeItem(key);
          return null;
        }
        
        return data.value;
      } catch (e) {
        console.warn('Cache read failed:', e);
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
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.warn('Cache write failed:', e);
        // Clear old cache if storage is full
        this.clearOldCache();
      }
    }
    
    clearOldCache() {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.cachePrefix)) {
          const version = key.split('_').pop();
          if (version !== CONFIG.CACHE_VERSION) {
            localStorage.removeItem(key);
          }
        }
      });
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
  // MODULE LOADING SYSTEM
  // ====================================================================
  class PageDetector {
    constructor() {
      this.detectionMethods = [
        () => document.body.dataset.page,
        () => document.body.className.match(/page-(\w+)/)?.[1],
        () => document.querySelector('meta[name="page-type"]')?.content,
        () => this.detectFromURL()
      ];
    }
    
    detectFromURL() {
      const path = window.location.pathname;
      const segments = path.split('/').filter(s => s);
      
      // Common page patterns
      const patterns = {
        'map': /map|location|geo/i,
        'dashboard': /dashboard|admin|control/i,
        'profile': /profile|account|user/i,
        'search': /search|find|filter/i,
        'home': /^$|index|home/i
      };
      
      for (const [pageType, pattern] of Object.entries(patterns)) {
        if (pattern.test(segments.join('/'))) {
          return pageType;
        }
      }
      
      return segments[0] || 'home';
    }
    
    getPageType() {
      for (const method of this.detectionMethods) {
        const result = method();
        if (result) return result;
      }
      return 'default';
    }
    
    getPageFeatures() {
      const features = [];
      
      // Feature detection based on DOM elements
      const featureMap = {
        'map': () => $id('map-container') || $1('.map-wrapper'),
        'filtering': () => $1('[fs-cmsfilter-element]') || $('.filter-checkbox').length > 0,
        'search': () => $1('input[type="search"]') || $1('.search-input'),
        'charts': () => $1('.chart-container') || $1('[data-chart]'),
        'forms': () => $('form').length > 0,
        'gallery': () => $1('.gallery') || $('.image-grid').length > 0,
        'video': () => $1('video') || $1('.video-player'),
        'data-table': () => $1('.data-table') || $1('[data-table]')
      };
      
      Object.entries(featureMap).forEach(([feature, detector]) => {
        if (detector()) features.push(feature);
      });
      
      return features;
    }
  }

  class ModuleLoader {
    constructor() {
      this.modules = new Map();
      this.loadedModules = new Set();
      this.loadingModules = new Set();
      this.dependencies = new Map();
      this.hooks = new Map();
      this.basePath = this.getBasePath();
    }
    
    getBasePath() {
      const scripts = document.querySelectorAll('script[src*="shared-core"]');
      if (scripts.length > 0) {
        const scriptPath = scripts[0].src;
        return scriptPath.substring(0, scriptPath.lastIndexOf('/') + 1);
      }
      return '/js/';
    }
    
    register(name, config) {
      if (typeof config === 'string') {
        config = { src: config };
      }
      
      this.modules.set(name, {
        src: config.src,
        dependencies: config.dependencies || [],
        features: config.features || [],
        pages: config.pages || [],
        init: config.init || null,
        cleanup: config.cleanup || null,
        condition: config.condition || null,
        priority: config.priority || 0,
        ...config
      });
      
      if (config.dependencies) {
        this.dependencies.set(name, config.dependencies);
      }
      
      return this;
    }
    
    async load(name, force = false) {
      if (this.loadedModules.has(name) && !force) {
        this.trigger('module:already-loaded', { name });
        return Promise.resolve();
      }
      
      if (this.loadingModules.has(name)) {
        return this.waitForModule(name);
      }
      
      const module = this.modules.get(name);
      if (!module) {
        console.warn(`Module '${name}' not registered`);
        return Promise.reject(new Error(`Module '${name}' not found`));
      }
      
      // Check condition
      if (module.condition && !module.condition()) {
        console.log(`Module '${name}' condition not met, skipping`);
        return Promise.resolve();
      }
      
      this.loadingModules.add(name);
      this.trigger('module:loading', { name, module });
      
      try {
        // Load dependencies first
        if (module.dependencies.length > 0) {
          await Promise.all(module.dependencies.map(dep => this.load(dep)));
        }
        
        // Load the module script
        await this.loadScript(module.src, name);
        
        // Run initialization if provided
        if (module.init) {
          await Promise.resolve(module.init());
        }
        
        this.loadedModules.add(name);
        this.loadingModules.delete(name);
        
        this.trigger('module:loaded', { name, module });
        console.log(`Module '${name}' loaded successfully`);
        
      } catch (error) {
        this.loadingModules.delete(name);
        this.trigger('module:error', { name, error });
        console.error(`Failed to load module '${name}':`, error);
        throw error;
      }
    }
    
    loadScript(src, name) {
      return new Promise((resolve, reject) => {
        // Check if already loaded by src
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        
        const script = document.createElement('script');
        script.src = src.startsWith('http') ? src : this.basePath + src;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        script.dataset.module = name;
        
        document.head.appendChild(script);
      });
    }
    
    waitForModule(name) {
      return new Promise((resolve) => {
        const checkLoaded = () => {
          if (this.loadedModules.has(name)) {
            resolve();
          } else {
            setTimeout(checkLoaded, 50);
          }
        };
        checkLoaded();
      });
    }
    
    async loadForPage(pageType, features = []) {
      const modulesToLoad = [];
      
      this.modules.forEach((module, name) => {
        let shouldLoad = false;
        
        // Check page-specific modules
        if (module.pages.length > 0) {
          shouldLoad = module.pages.includes(pageType) || module.pages.includes('*');
        }
        
        // Check feature-specific modules
        if (module.features.length > 0) {
          shouldLoad = shouldLoad || module.features.some(feature => features.includes(feature));
        }
        
        // Load if no specific requirements (universal modules)
        if (module.pages.length === 0 && module.features.length === 0) {
          shouldLoad = true;
        }
        
        if (shouldLoad) {
          modulesToLoad.push({ name, priority: module.priority });
        }
      });
      
      // Sort by priority (higher numbers load first)
      modulesToLoad.sort((a, b) => b.priority - a.priority);
      
      // Load modules in batches by priority
      const priorityGroups = new Map();
      modulesToLoad.forEach(({ name, priority }) => {
        if (!priorityGroups.has(priority)) {
          priorityGroups.set(priority, []);
        }
        priorityGroups.get(priority).push(name);
      });
      
      for (const [priority, modules] of [...priorityGroups.entries()].sort((a, b) => b[0] - a[0])) {
        await Promise.all(modules.map(name => this.load(name)));
      }
    }
    
    unload(name) {
      if (!this.loadedModules.has(name)) return;
      
      const module = this.modules.get(name);
      if (module && module.cleanup) {
        module.cleanup();
      }
      
      // Remove script tag
      const script = document.querySelector(`script[data-module="${name}"]`);
      if (script) {
        script.remove();
      }
      
      this.loadedModules.delete(name);
      this.trigger('module:unloaded', { name });
    }
    
    isLoaded(name) {
      return this.loadedModules.has(name);
    }
    
    getLoadedModules() {
      return Array.from(this.loadedModules);
    }
    
    // Event system for module lifecycle
    on(event, callback) {
      if (!this.hooks.has(event)) {
        this.hooks.set(event, []);
      }
      this.hooks.get(event).push(callback);
      return this;
    }
    
    trigger(event, data = {}) {
      const callbacks = this.hooks.get(event);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in ${event} hook:`, error);
          }
        });
      }
    }
    
    // Cleanup all modules
    cleanup() {
      this.loadedModules.forEach(name => {
        const module = this.modules.get(name);
        if (module && module.cleanup) {
          module.cleanup();
        }
      });
      this.loadedModules.clear();
      this.loadingModules.clear();
    }
  }

  // ====================================================================
  // ENHANCED STATE MANAGEMENT
  // ====================================================================
  class EnhancedState extends SimpleState {
    constructor() {
      super();
      this.modules = new Map();
      this.pageData = {};
      this.crossPageData = this.loadCrossPageData();
    }
    
    // Module-specific state management
    setModuleData(moduleName, key, value) {
      if (!this.modules.has(moduleName)) {
        this.modules.set(moduleName, {});
      }
      this.modules.get(moduleName)[key] = value;
    }
    
    getModuleData(moduleName, key) {
      const moduleData = this.modules.get(moduleName);
      return moduleData ? moduleData[key] : undefined;
    }
    
    // Cross-page data persistence
    saveCrossPageData(key, value, expiry = null) {
      this.crossPageData[key] = {
        value,
        timestamp: Date.now(),
        expiry: expiry ? Date.now() + expiry : null
      };
      
      try {
        localStorage.setItem('sharedcore_cross_page', JSON.stringify(this.crossPageData));
      } catch (e) {
        console.warn('Failed to save cross-page data:', e);
      }
    }
    
    getCrossPageData(key) {
      const data = this.crossPageData[key];
      if (!data) return null;
      
      if (data.expiry && Date.now() > data.expiry) {
        delete this.crossPageData[key];
        this.saveCrossPageData(); // Update storage
        return null;
      }
      
      return data.value;
    }
    
    loadCrossPageData() {
      try {
        const stored = localStorage.getItem('sharedcore_cross_page');
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        console.warn('Failed to load cross-page data:', e);
        return {};
      }
    }
    
    cleanup() {
      super.cleanup();
      this.modules.clear();
    }
  }

  // ====================================================================
  // GLOBAL INSTANCES
  // ====================================================================
  const domCache = new OptimizedDOMCache();
  const eventManager = new OptimizedEventManager();
  const state = new EnhancedState();
  const geoCache = new GeoJSONCache();
  const pageDetector = new PageDetector();
  const moduleLoader = new ModuleLoader();
  
  // Shortcuts
  const $ = (selector) => domCache.$(selector);
  const $1 = (selector) => domCache.$1(selector);  
  const $id = (id) => domCache.$id(id);
  
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
  async function generateCheckboxes(type, containerId, fieldName) {
    const container = $id(containerId);
    if (!container) {
      console.warn(`Target container #${containerId} not found`);
      return;
    }
    
    try {
      const data = await geoCache.fetch(type);
      
      // Extract unique names
      const names = data.features
        .map(feature => feature.properties.name)
        .filter(name => name && name.trim() !== '')
        .sort()
        .filter((name, index, array) => array.indexOf(name) === index);
      
      if (names.length === 0) {
        console.warn(`No valid ${type} names found in GeoJSON data`);
        return;
      }
      
      // Clear existing content
      container.innerHTML = '';
      
      // Generate checkboxes using document fragment
      const fragment = document.createDocumentFragment();
      
      names.forEach(name => {
        const wrapperDiv = document.createElement('div');
        wrapperDiv.setAttribute('checkbox-filter', type);
        wrapperDiv.className = 'checbox-item';
        
        const label = document.createElement('label');
        label.className = 'w-checkbox reporterwrap-copy';
        
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
        
        const input = document.createElement('input');
        input.setAttribute('data-auto-sidebar', 'true');
        input.setAttribute('fs-list-value', name);
        input.setAttribute('fs-list-field', fieldName);
        input.type = 'checkbox';
        input.name = type;
        input.setAttribute('data-name', type);
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
        
        label.appendChild(checkboxDiv);
        label.appendChild(input);
        label.appendChild(span);
        label.appendChild(countContainer);
        wrapperDiv.appendChild(label);
        fragment.appendChild(wrapperDiv);
      });
      
      container.appendChild(fragment);
      console.log(`Generated ${names.length} ${type} checkboxes`);
      
      domCache.markStale();
      domCache.refresh();
      
      setupGeneratedCheckboxEvents();
      
      // Refresh search script cache if available
      if (window.checkboxFilterScript) {
        window.checkboxFilterScript.recacheElements();
      }
      
    } catch (error) {
      console.error(`Failed to generate ${type} checkboxes:`, error);
    }
  }
  
  function generateLocalityCheckboxes() {
    return generateCheckboxes('localities', 'locality-check-list', 'Locality');
  }
  
  function generateSettlementCheckboxes() {
    return generateCheckboxes('settlements', 'settlement-check-list', 'Settlement');
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
  // FILTERED ELEMENTS
  // ====================================================================
  const toggleShowWhenFilteredElements = (show, skipDelay = false) => {
    const elements = document.querySelectorAll('[show-when-filtered="true"]');
    if (elements.length === 0) return;
    
    const applyStyles = () => {
      elements.forEach(element => {
        element.style.display = show ? 'block' : 'none';
        element.style.visibility = show ? 'visible' : 'hidden';
        element.style.opacity = show ? '1' : '0';
        element.style.pointerEvents = show ? 'auto' : 'none';
      });
    };
    
    if (show && !skipDelay && !state.flags.pageLoadDelayComplete) {
      state.setTimer('showFilteredElementsDelay', applyStyles, 1000);
    } else {
      applyStyles();
    }
  };
  
  const checkAndToggleFilteredElements = (skipDelay = false) => {
    const hiddenTagParent = document.getElementById('hiddentagparent');
    const shouldShow = !!hiddenTagParent;
    
    toggleShowWhenFilteredElements(shouldShow, skipDelay);
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
          checkAndToggleFilteredElements(true);
        });
        observer.observe(tagParent, {childList: true, subtree: true});
        
        tagParent._mutationObserver = observer;
      }
      
      const allCheckboxes = document.querySelectorAll('[checkbox-filter] input[type="checkbox"]');
      allCheckboxes.forEach(checkbox => {
        if (!checkbox.dataset.filteredElementListener) {
          eventManager.add(checkbox, 'change', () => {
            setTimeout(() => checkAndToggleFilteredElements(true), 50);
          });
          checkbox.dataset.filteredElementListener = 'true';
        }
      });
      
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        if (!form.dataset.filteredElementListener) {
          eventManager.add(form, 'change', () => {
            setTimeout(() => checkAndToggleFilteredElements(true), 100);
          });
          eventManager.add(form, 'input', () => {
            setTimeout(() => checkAndToggleFilteredElements(true), 100);
          });
          form.dataset.filteredElementListener = 'true';
        }
      });
      
      const startPolling = () => {
        if (pollingTimer) clearTimeout(pollingTimer);
        
        pollingTimer = setTimeout(() => {
          checkAndToggleFilteredElements(true);
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
  function setupGeneratedCheckboxEvents() {
    const autoSidebarCheckboxes = $('[data-auto-sidebar="true"]');
    let newListenersCount = 0;
    
    autoSidebarCheckboxes.forEach(element => {
      if (element.dataset.eventListenerAdded === 'true') return;
      
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
      console.log(`Added event listeners to ${newListenersCount} new elements`);
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
        setTimeout(() => checkAndToggleFilteredElements(true), 100);
      });
    });
    
    if (navigator.userAgent.toLowerCase().includes('firefox')) {
      const forms = $('form');
      forms.forEach(form => {
        const hasFilterElements = form.querySelector('[fs-cmsfilter-element]') !== null;
        
        if (hasFilterElements) {
          eventManager.add(form, 'submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }, {capture: true});
        }
      });
    }
  }
  
  // ====================================================================
  // ENHANCED INITIALIZATION
  // ====================================================================
  async function initializeCore() {
    console.log('SharedCore: Starting initialization...');
    
    // Phase 1: Detect page context
    const pageType = pageDetector.getPageType();
    const features = pageDetector.getPageFeatures();
    
    console.log(`SharedCore: Detected page type: ${pageType}, features: [${features.join(', ')}]`);
    state.pageData = { type: pageType, features };
    
    // Phase 2: Load page-specific modules
    try {
      await moduleLoader.loadForPage(pageType, features);
      console.log(`SharedCore: Loaded modules for ${pageType} page`);
    } catch (error) {
      console.error('SharedCore: Module loading failed:', error);
    }
    
    // Phase 3: Core functionality (original initialization)
    Promise.all([
      generateLocalityCheckboxes(),
      generateSettlementCheckboxes()
    ]).then(() => {
      console.log('SharedCore: All checkboxes generated');
    });
    
    setupSidebars();
    setupEvents();
    
    state.setTimer('initMonitorTags', () => {
      monitorTags();
    }, 100);
    
    // Phase 4: Trigger post-init hooks
    moduleLoader.trigger('core:initialized', { pageType, features });
    console.log('SharedCore: Initialization complete');
  }

  // Convenience function for registering modules before initialization
  function registerModule(name, config) {
    return moduleLoader.register(name, config);
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
    
    // Module system
    moduleLoader,
    pageDetector,
    registerModule,
    
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
    monitorTags,
    
    // Initialization
    init: initializeCore,
    
    // Module management shortcuts
    loadModule: (name, force = false) => moduleLoader.load(name, force),
    unloadModule: (name) => moduleLoader.unload(name),
    isModuleLoaded: (name) => moduleLoader.isLoaded(name),
    getLoadedModules: () => moduleLoader.getLoadedModules(),
    getPageType: () => pageDetector.getPageType(),
    getPageFeatures: () => pageDetector.getPageFeatures(),
    
    // Cross-page data management
    saveCrossPageData: (key, value, expiry) => state.saveCrossPageData(key, value, expiry),
    getCrossPageData: (key) => state.getCrossPageData(key),
    
    // Module event hooks
    onModuleLoaded: (callback) => moduleLoader.on('module:loaded', callback),
    onModuleError: (callback) => moduleLoader.on('module:error', callback),
    onCoreReady: (callback) => moduleLoader.on('core:initialized', callback),
    
    // For map page
    getGeoJSONData: async function() {
      return {
        localities: await geoCache.fetch('localities'),
        settlements: await geoCache.fetch('settlements')
      };
    }
  };
  
  // ====================================================================
  // USAGE EXAMPLES & MODULE REGISTRATION
  // ====================================================================
  /*
  
  EXAMPLE: Register modules for different pages and features
  
  // Register a map-specific module
  SharedCore.registerModule('leaflet-map', {
    src: 'modules/map.js',
    pages: ['map', 'location'],
    features: ['map'],
    dependencies: ['leaflet'],
    priority: 10,
    init: function() {
      console.log('Map module initialized');
    }
  });
  
  // Register a data visualization module  
  SharedCore.registerModule('charts', {
    src: 'modules/charts.js',
    features: ['charts'],
    dependencies: ['d3'],
    condition: () => document.querySelector('.chart-container'),
    init: function() {
      window.initCharts();
    }
  });
  
  // Register a universal utility module
  SharedCore.registerModule('analytics', {
    src: 'modules/analytics.js',
    pages: ['*'], // Load on all pages
    priority: 5
  });
  
  // Register external library dependency
  SharedCore.registerModule('leaflet', {
    src: 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js',
    priority: 100 // Load first
  });
  
  EXAMPLE: Manual module loading
  
  // Load a specific module
  SharedCore.loadModule('custom-feature').then(() => {
    console.log('Module loaded!');
  });
  
  // Check if module is loaded
  if (SharedCore.isModuleLoaded('charts')) {
    // Module is available
  }
  
  EXAMPLE: Cross-page data sharing
  
  // Save data that persists across page navigation
  SharedCore.saveCrossPageData('userPreferences', {theme: 'dark'});
  
  // Retrieve data on another page
  const prefs = SharedCore.getCrossPageData('userPreferences');
  
  EXAMPLE: Page detection
  
  const pageType = SharedCore.getPageType(); // 'map', 'dashboard', etc.
  const features = SharedCore.getPageFeatures(); // ['filtering', 'search']
  
  EXAMPLE: Module lifecycle hooks
  
  SharedCore.onModuleLoaded(({name, module}) => {
    console.log(`Module ${name} loaded successfully`);
  });
  
  SharedCore.onCoreReady(({pageType, features}) => {
    console.log('SharedCore initialization complete');
  });
  
  */

  // ====================================================================
  // AUTO-INITIALIZATION
  // ====================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCore);
  } else {
    initializeCore();
  }
  
  window.addEventListener('load', () => {
    state.setTimer('loadGenerateCheckboxes', () => {
      generateLocalityCheckboxes();
      generateSettlementCheckboxes();
    }, 500);
    
    setupSidebars();
    state.setTimer('loadCheckFiltered', () => {
      state.flags.pageLoadDelayComplete = true;
      checkAndToggleFilteredElements();
    }, 1200);
  });
  
  window.addEventListener('beforeunload', () => {
    moduleLoader.cleanup();
    eventManager.cleanup();
    state.cleanup();
    sidebarCache.invalidate();
    
    const tagParent = $id('tagparent');
    if (tagParent && tagParent._mutationObserver) {
      tagParent._mutationObserver.disconnect();
    }
    
    if (tagParent && tagParent._tagObserver) {
      tagParent._tagObserver.disconnect();
    }
  });
  
})(window);
