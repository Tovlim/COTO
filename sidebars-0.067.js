// ====================================================================
// SHARED CORE MODULE - Loads on ALL pages
// Contains: DOM cache, Event manager, Sidebars, GeoJSON caching
// Version: 1.4.0 - PAGESPEED OPTIMIZED - Core Web Vitals Enhanced
//
// Changes in v1.4.0:
// - Removed checkbox generation functionality (localities/settlements)
// - Checkboxes should now be pre-rendered on the page
//
// Changes in v1.3.1:
// - Added AdvancedScheduler with scheduler.postTask support for background operations
// - Implemented lazy event delegation setup to improve FID scores
// - Added resource preloading and DNS prefetch hints for better LCP
// - Enhanced memory management and cleanup for optimal performance
// - Deferred non-critical initialization to minimize blocking time
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

  // Track whether CMS reports have finished initial loading
  let cmsReportsLoaded = false;
  
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
  // CHECKBOX GENERATION - REMOVED
  // ====================================================================
  // Checkbox generation has been removed. Checkboxes should be pre-rendered on the page.

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

    // Prevent opening sidebars until CMS reports have loaded
    const wouldOpen = show !== null ? show : !sidebar.classList.contains('is-show');
    if (wouldOpen && !cmsReportsLoaded) return;

    const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
    sidebar.classList.toggle('is-show', isShowing);

    // Dispatch event when Right sidebar opens
    if (side === 'Right' && isShowing) {
      document.dispatchEvent(new CustomEvent('rightSidebarOpened'));
    }
    
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
  function triggerEvent(element, events, isProgrammatic = false) {
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      if (isProgrammatic) {
        // Mark programmatic events to prevent auto-sidebar opening
        event.isProgrammaticFieldItemCheck = true;
      }
      element.dispatchEvent(event);
    });
  }
  
  // Function to programmatically check a checkbox with proper visual states (mapbox approach)
  function checkCheckboxProgrammatically(input) {
    if (!input || input.checked) return false;
    
    // Check the input (like mapbox script)
    input.checked = true;
    
    // Trigger events like mapbox script - let Webflow handle visual classes
    // Mark as programmatic to prevent auto-sidebar opening
    triggerEvent(input, ['change', 'input'], true);
    
    // Also trigger form events like mapbox script
    const form = input.closest('form');
    if (form) {
      const changeEvent = new Event('change', { bubbles: true });
      const inputEvent = new Event('input', { bubbles: true });
      
      // Mark form events as programmatic too
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
  let hasFieldItemsOnPage = null; // null = not checked yet, true/false = cached result

  // Check once if page has field-items
  function checkForFieldItems() {
    if (hasFieldItemsOnPage === null) {
      hasFieldItemsOnPage = document.querySelector('[field-item]') !== null;
    }
    return hasFieldItemsOnPage;
  }
  
  // Wait for Finsweet filters to initialize before processing field items (only once)
  function waitForFinsweet() {
    return new Promise((resolve) => {
      // If already checked, resolve immediately
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
          finsweetInitialized = true; // Mark as initialized
          resolve();
        } else {
          // Check again in 100ms
          setTimeout(checkFinsweet, 100);
        }
      };
      
      // Start checking immediately
      checkFinsweet();
      
      // Fallback timeout after 5 seconds
      setTimeout(() => {
        finsweetInitialized = true; // Mark as initialized even on timeout
        resolve();
      }, 5000);
    });
  }

  // Debounced wrapper for processFieldItems
  function processFieldItemsDebounced() {
    // Early exit if no field-items on page
    if (!checkForFieldItems()) {
      return;
    }
    
    // Clear existing timer
    if (processFieldItemsTimer) {
      clearTimeout(processFieldItemsTimer);
      processFieldItemsTimer = null;
    }
    
    // If already running, schedule for later
    if (processFieldItemsRunning) {
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
      return;
    }
    
    const allFieldItems = document.querySelectorAll('[field-item]');
    const fieldItems = Array.from(allFieldItems).filter(item => {
      return !item.classList.contains('w-condition-invisible');
    });
    
    if (fieldItems.length === 0) {
      return;
    }
    
    // Set running flag
    processFieldItemsRunning = true;
    
    try {
      // Wait for Finsweet to be ready before processing
      await waitForFinsweet();
      
      
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
        
        // Find the checkbox (all checkboxes should be pre-rendered on the page)
        const input = document.querySelector(`input[fs-list-field="${fieldName}"][fs-list-value="${fieldValue}"]`);

        // Check the checkbox if found
        if (input) {
          checkCheckboxProgrammatically(input);
        } else {
          console.warn(`Checkbox not found for ${fieldValue} (${fieldType}) - ensure checkboxes are pre-rendered on the page`);
        }
      }
      
      // Trigger filtered elements check after processing all field items
      IdleExecution.scheduleUI(() => {
        checkAndToggleFilteredElements();
      }, { fallbackDelay: 100 });
      
      
    } catch (error) {
      console.error('Error in processFieldItems:', error);
    } finally {
      // Always clear the running flag
      processFieldItemsRunning = false;
    }
  }
  
  // ====================================================================
  // FILTERED ELEMENTS - Using Finsweet API
  // ====================================================================

  // Toggle filtered elements with immediate DOM updates
  const toggleShowWhenFilteredElements = show => {
    const elements = document.querySelectorAll('[show-when-filtered="true"]');
    if (elements.length === 0) return;

    elements.forEach(element => {
      element.style.display = show ? 'block' : 'none';
    });
  };

  // Use Finsweet List API to detect active filters
  const checkAndToggleFilteredElements = () => {
    // Check if Finsweet API is available
    if (typeof window.FinsweetAttributes === 'undefined') {
      return false;
    }

    // Get list instances from stored reference
    if (!window._finsweetListInstances || window._finsweetListInstances.length === 0) {
      toggleShowWhenFilteredElements(false);
      return false;
    }

    // Check if any list has active filters by examining the filters object
    const hasActiveFilters = window._finsweetListInstances.some(instance => {
      if (!instance.filters || !instance.filters.value) return false;

      const filters = instance.filters.value;

      // Check if any group has conditions with values
      if (filters.groups && filters.groups.length > 0) {
        return filters.groups.some(group => {
          return group.conditions && group.conditions.some(condition => {
            const value = condition.value;
            // Check if value exists and is not empty
            if (Array.isArray(value)) {
              return value.length > 0;
            }
            return value !== '' && value !== null && value !== undefined;
          });
        });
      }

      return false;
    });

    toggleShowWhenFilteredElements(hasActiveFilters);
    return hasActiveFilters;
  };

  const monitorTags = (() => {
    let isSetup = false;

    return () => {
      if (isSetup) return;

      // Wait for Finsweet to be ready
      window.FinsweetAttributes = window.FinsweetAttributes || [];
      window.FinsweetAttributes.push([
        'list',
        (listInstances) => {
          // Store instances globally for access
          window._finsweetListInstances = listInstances;

          // Listen to filter changes via reactive watch on filters object
          listInstances.forEach(instance => {
            instance.watch(
              () => instance.filters,
              () => {
                checkAndToggleFilteredElements();
              },
              { deep: true } // Watch nested changes in filters
            );
          });

          // Initial check
          checkAndToggleFilteredElements();
        }
      ]);

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
    // No longer needed - using document-level delegation only
    // This function is kept for backward compatibility but does nothing
  }
  
  function setupControls() {
    const controlMap = {
      'AllEvents': () => {
        // Use Finsweet API to reset all filters
        if (window._finsweetListInstances && window._finsweetListInstances.length > 0) {
          window._finsweetListInstances.forEach(instance => {
            // Reset filters in the API by clearing condition values (Finsweet approach)
            if (instance.filters && instance.filters.value) {
              const filters = instance.filters.value;

              // Clear all condition values in all groups
              if (filters.groups && filters.groups.length > 0) {
                filters.groups.forEach(group => {
                  if (group.conditions && group.conditions.length > 0) {
                    group.conditions.forEach(condition => {
                      // Set value to empty array or empty string based on type
                      condition.value = Array.isArray(condition.value) ? [] : '';
                      // Mark as not interacted (like Finsweet's clear button does)
                      condition.interacted = false;
                    });
                  }
                });
              }
            }

            // Reset form inputs to sync with API state
            const forms = document.querySelectorAll('form[fs-cmsfilter-element="filters"]');
            forms.forEach(form => {
              // Reset all checkboxes
              form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
              });

              // Reset all radio buttons
              form.querySelectorAll('input[type="radio"]').forEach(radio => {
                radio.checked = false;
              });

              // Clear all text inputs
              form.querySelectorAll('input[type="text"], input[type="search"]').forEach(input => {
                input.value = '';
              });

              // Clear all select dropdowns
              form.querySelectorAll('select').forEach(select => {
                select.selectedIndex = 0;
              });
            });
          });
        }
      },
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
    
    const attemptSetup = (attempt = 1, maxAttempts = 3) => {
      const leftReady = setupSidebarElement('Left');
      const rightReady = setupSidebarElement('Right');
      const secondLeftReady = setupSidebarElement('SecondLeft');

      if (leftReady && rightReady) {
        setupInitialMargins();
        setupControls();
        return;
      }

      if (attempt < maxAttempts) {
        const delay = [50, 100, 200][attempt - 1] || 200;
        state.setTimer(`sidebarSetup-${attempt}`, () => attemptSetup(attempt + 1, maxAttempts), delay);
      } else {
        // Final attempt - setup with whatever elements are available
        setupInitialMargins();
        setupControls();
      }
    };

    const setupInitialMargins = () => {
      if (window.innerWidth > 478) {
        ['Left', 'Right', 'SecondLeft'].forEach(side => {
          const sidebar = sidebarCache.getSidebar(side);
          if (sidebar && !sidebar.classList.contains('is-show')) {
            const width = sidebarCache.getWidth(side);
            const jsMarginProperty = sidebarCache.getMarginProperty(side);
            sidebar.style[jsMarginProperty] = `-${width + 1}px`;
          }
        });
      }
    };

    attemptSetup();
  }
  
  function setupEvents() {
    const eventHandlers = [
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
    setupSidebars();
    setupEvents();

    // Check for filters immediately
    checkAndToggleFilteredElements(true);

    // Start monitoring immediately
    monitorTags();
  }

  function hideSidebarLoadingIndicators() {
    // Early bailout if no loading indicators exist
    if (!document.querySelector('[sidebar-loading="indicator"]')) return;

    const loadingIndicators = document.querySelectorAll('[sidebar-loading="indicator"]');
    loadingIndicators.forEach(indicator => {
      indicator.style.display = 'none';
    });
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
  // CMS DATA LOADED LISTENER
  // ====================================================================
  // Wait for CMS reports to finish loading before enabling sidebars and hiding loading indicators
  window.addEventListener('cmsDataLoaded', function() {
    cmsReportsLoaded = true;
    hideSidebarLoadingIndicators();
  }, { once: true });

  // ====================================================================
  // AUTO-INITIALIZATION
  // ====================================================================
  // Check for filters immediately when script loads - optimized version
  const immediateCheck = () => {
    const hiddenTagParent = document.getElementById('hiddentagparent');
    if (hiddenTagParent) {
      // Don't show filtered elements immediately - wait for 10 second delay to pass
      // The setTimeout at line 742-746 will handle showing them after the delay
    }

    // Process field-item elements immediately to auto-check corresponding checkboxes
    // Only schedule if field-items exist
    if (checkForFieldItems()) {
      IdleExecution.scheduleUI(() => {
        processFieldItemsDebounced();
      }, { fallbackDelay: 200 });
    }
  };
  immediateCheck();
  
  // Setup event delegation immediately for existing elements on the page
  (function setupImmediateEventDelegation() {
    // Use capturing phase to catch all events, even from existing elements
    document.addEventListener('change', (e) => {
      if (e.target.matches('[data-auto-sidebar="true"]')) {
        // Skip auto-sidebar for programmatic field-item checks
        if (e.isProgrammaticFieldItemCheck) {
          return;
        }
        if (window.innerWidth > 991) {
          state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
        }
      }
      if (e.target.matches('[data-auto-second-left-sidebar="true"]')) {
        if (window.innerWidth > 991) {
          state.setTimer('autoSidebar', () => toggleSidebar('SecondLeft', true), 50);
        }
      }
      
      // Handle form filtering events via delegation
      if (e.target.closest('form')) {
        IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 50 });
      }
    }, true);
    
    document.addEventListener('input', (e) => {
      if (e.target.matches('[data-auto-sidebar="true"]') && ['text', 'search'].includes(e.target.type)) {
        // Skip auto-sidebar for programmatic field-item checks
        if (e.isProgrammaticFieldItemCheck) {
          return;
        }
        if (window.innerWidth > 991) {
          state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
        }
      }
      if (e.target.matches('[data-auto-second-left-sidebar="true"]') && ['text', 'search'].includes(e.target.type)) {
        if (window.innerWidth > 991) {
          state.setTimer('autoSidebar', () => toggleSidebar('SecondLeft', true), 50);
        }
      }
      
      // Handle form filtering input events via delegation
      if (e.target.closest('form')) {
        IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 50 });
      }
    }, true);
  })();

  // Listen for site search sidebar opening to close the Right sidebar
  document.addEventListener('siteSearchSidebarOpened', () => {
    closeSidebar('Right');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      immediateCheck();

      // Don't show filtered elements immediately - wait for 10 second delay to pass

      // Process field items after DOM is ready
      if (checkForFieldItems()) {
        IdleExecution.scheduleUI(() => {
          processFieldItemsDebounced();
        }, { fallbackDelay: 300 });
      }

      initializeCore();
    });
  } else {
    // Don't show filtered elements immediately - wait for 10 second delay to pass

    // Process field items if DOM is already ready
    if (checkForFieldItems()) {
      IdleExecution.scheduleUI(() => {
        processFieldItemsDebounced();
      }, { fallbackDelay: 100 });
    }

    initializeCore();
  }
  
  window.addEventListener('load', () => {
    // Check immediately on window load
    checkAndToggleFilteredElements();

    // Check for filtered elements using idle execution
    IdleExecution.scheduleUI(() => {
      checkAndToggleFilteredElements();
    }, { fallbackDelay: 300 });

    // Additional check after page is fully loaded (matching mapbox timing)
    state.setTimer('loadCheckFiltered', checkAndToggleFilteredElements, 200);

    // Process field items after full page load as final fallback
    if (checkForFieldItems()) {
      state.setTimer('loadProcessFieldItems', processFieldItemsDebounced, 400);
    }
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
    
  });
  
})(window);
