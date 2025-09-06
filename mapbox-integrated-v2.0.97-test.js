/**
 * MAPBOX INTEGRATED SCRIPT v2.1.0 - Ultra Performance
 * 
 * High-performance map with lazy loading, virtual DOM autocomplete, 
 * 7-day caching, and enhanced user experience optimizations.
 * 
 * Key Features: Lazy checkbox/autocomplete loading, recent searches,
 * circular navigation, enhanced error handling, modular architecture.
 */


// ========================
// IMMEDIATE SIDEBAR FUNCTIONALITY
// ========================
// This runs immediately to make sidebars responsive before anything else loads
(function initializeImmediateSidebars() {
  // Minimal sidebar toggle functionality - works instantly
  function toggleSidebar(side, forceOpen) {
    // Map sidebar names to IDs (compatible with enhanced version)
    const sidebarMap = {
      'Left': 'leftsidebar',
      'SecondLeft': 'secondleftsidebar', 
      'Right': 'right-sidebar'
    };
    
    const sidebarId = sidebarMap[side] || (side === 'Right' ? 'right-sidebar' : 'leftsidebar');
    const sidebar = document.getElementById(sidebarId);
    
    if (!sidebar) return false;
    
    // Use 'is-show' class to match enhanced version
    const isOpen = sidebar.classList.contains('is-show');
    const shouldOpen = forceOpen !== undefined ? forceOpen : !isOpen;
    
    if (shouldOpen) {
      sidebar.classList.add('is-show');
      // Basic margin adjustment for immediate visual feedback
      if (window.innerWidth > 478) {
        const marginProp = side === 'Right' ? 'marginRight' : 'marginLeft';
        sidebar.style[marginProp] = '0';
      }
    } else {
      sidebar.classList.remove('is-show');
      // Hide sidebar
      if (window.innerWidth > 478) {
        const marginProp = side === 'Right' ? 'marginRight' : 'marginLeft';
        sidebar.style[marginProp] = '-350px'; // Default width assumption
      }
    }
    
    return shouldOpen;
  }
  
  // Attach to global scope immediately
  window.toggleSidebar = toggleSidebar;
  
  // Setup click handlers as soon as possible
  function setupImmediateHandlers() {
    // Left sidebar (menu button)
    const menuButton = document.getElementById('menu-button');
    if (menuButton && !menuButton.dataset.immediateHandler) {
      menuButton.addEventListener('click', () => toggleSidebar('Left'));
      menuButton.dataset.immediateHandler = 'true';
    }
    
    // Right sidebar button
    const rightButton = document.getElementById('right-sidebar-button');
    if (rightButton && !rightButton.dataset.immediateHandler) {
      rightButton.addEventListener('click', () => toggleSidebar('Right'));
      rightButton.dataset.immediateHandler = 'true';
    }
    
    // Close buttons
    const closeButtons = document.querySelectorAll('.close-sidebar-button');
    closeButtons.forEach(btn => {
      if (!btn.dataset.immediateHandler) {
        const sidebar = btn.closest('[id$="-sidebar"]');
        if (sidebar) {
          const side = sidebar.id.includes('right') ? 'Right' : 'Left';
          btn.addEventListener('click', () => toggleSidebar(side, false));
          btn.dataset.immediateHandler = 'true';
        }
      }
    });
  }
  
  // Try to setup immediately if elements exist
  setupImmediateHandlers();
  
  // Also try on DOMContentLoaded in case elements don't exist yet
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupImmediateHandlers, { once: true });
  }
  
  // Add minimal loading indicator to sidebars
  function addLoadingStates() {
    const sidebars = document.querySelectorAll('#left-sidebar, #right-sidebar');
    sidebars.forEach(sidebar => {
      if (!sidebar.querySelector('.sidebar-loading-indicator')) {
        const existingContent = sidebar.querySelector('.sidebar-content, .sidebar-wrapper');
        if (existingContent && existingContent.children.length === 0) {
          existingContent.innerHTML = '<div class="sidebar-loading-indicator" style="padding: 20px; text-align: center; opacity: 0.6;">Loading...</div>';
        }
      }
    });
  }
  
  // Add loading states if sidebars exist but are empty
  if (document.readyState !== 'loading') {
    addLoadingStates();
  } else {
    document.addEventListener('DOMContentLoaded', addLoadingStates, { once: true });
  }
})();

// Helper function to get URL from config
function getOptimalUrl(type) {
  return APP_CONFIG.urls[type];
}

// ========================
// CONFIGURATION
// ========================
const APP_CONFIG = {
  cache: {
    duration: 10080, // 7 days in minutes
    maxRecentSearches: 10,
    storagePrefix: 'mapCache_',
    metaPrefix: 'mapMeta_'
  },
  timeouts: {
    debounce: 50,
    filterUpdate: 200,
    refreshDelay: 600,
    mapReady: 3000,
    idle: 5000
  },
  urls: {
    localities: 'https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/localities-0.010.geojson',
    settlements: 'https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/settlements-0.006.geojson'
  },
  features: {
    enableCache: true,
    enableRecentSearches: true,
    enableMemoization: true,
    enableLazyCheckboxes: true
  },
  breakpoints: {
    mobile: 478,
    tablet: 991,
    desktop: 992
  },
  ui: {
    scoreThreshold: 0.3,
    maxResults: 50,
    sidebarWidth: 300
  }
};

// ========================
// LAZY CHECKBOX STATE
// ========================
const LazyCheckboxState = {
  generatedCheckboxes: new Set(), // Track which checkboxes exist
  localitiesFullyGenerated: false,
  settlementsFullyGenerated: false,
  isGeneratingBulk: false,
  
  hasCheckbox(name, type) {
    return this.generatedCheckboxes.has(`${type}:${name}`);
  },
  
  addCheckbox(name, type) {
    this.generatedCheckboxes.add(`${type}:${name}`);
  },
  
  clearType(type) {
    // Remove all checkboxes of a specific type from tracking
    const toRemove = Array.from(this.generatedCheckboxes).filter(key => key.startsWith(`${type}:`));
    toRemove.forEach(key => this.generatedCheckboxes.delete(key));
    
    // Reset fully generated flag
    if (type === 'locality') this.localitiesFullyGenerated = false;
    if (type === 'settlement') this.settlementsFullyGenerated = false;
  },
  
  isFullyGenerated(type) {
    return type === 'locality' ? this.localitiesFullyGenerated : 
           type === 'settlement' ? this.settlementsFullyGenerated : false;
  },
  
  markFullyGenerated(type) {
    if (type === 'locality') this.localitiesFullyGenerated = true;
    if (type === 'settlement') this.settlementsFullyGenerated = true;
  }
};

// ========================
// IDLE EXECUTION UTILITY
// ========================
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

// ========================
// CHECKBOX FACTORY (Deduplication)
// ========================
const CheckboxFactory = {
  // Create standardized checkbox HTML structure
  createCheckboxElement(name, type, properties) {
    const pluralType = type === 'locality' ? 'localities' : 'settlements';
    const urlPrefix = type === 'settlement' ? 'settlement' : 'locality';
    const fieldName = type.charAt(0).toUpperCase() + type.slice(1);
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '-');
    const slug = properties.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Create wrapper
    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.setAttribute('checkbox-filter', type);
    checkboxWrapper.className = 'checbox-item';
    
    const label = document.createElement('label');
    label.className = 'w-checkbox reporterwrap-copy';
    
    // Create external link using DOMFactory
    const link = DOMFactory.createExternalLink(null, slug, urlPrefix);
    
    // Create checkbox input wrapper
    const checkboxInputWrapper = document.createElement('div');
    checkboxInputWrapper.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
    
    // Create checkbox input using DOMFactory
    const checkbox = DOMFactory.createCheckboxInput({
      name: type,
      value: name,
      fieldName: fieldName,
      id: `${pluralType}-${cleanName}`,
      autoSidebar: true,
      filterIndicator: 'place'
    });
    
    // Create label text
    const labelText = document.createElement('span');
    labelText.className = 'test3 w-form-label';
    labelText.setAttribute('for', checkbox.id);
    labelText.textContent = name;
    
    // Create count wrapper using DOMFactory
    const countWrapper = DOMFactory.createCountElement();
    
    // Assemble structure
    label.appendChild(link);
    label.appendChild(checkboxInputWrapper);
    label.appendChild(checkbox);
    label.appendChild(labelText);
    label.appendChild(countWrapper);
    checkboxWrapper.appendChild(label);
    
    return checkboxWrapper;
  },
  
  // Generic bulk generation function
  generateBulkCheckboxes(containerId, features, type, stateName) {
    if (LazyCheckboxState.isFullyGenerated(type)) {
      return Promise.resolve();
    }
    
    const container = document.getElementById(containerId);
    if (!container) return Promise.resolve();
    
    
    return new Promise((resolve) => {
      const generate = () => {
        try {
          // Clear and reset using DOMFactory
          DOMFactory.clearContainer(container);
          LazyCheckboxState.clearType(type);
          
          // Extract unique features
          const uniqueFeatures = [];
          const seenNames = new Set();
          
          features.forEach(feature => {
            if (feature?.properties?.name) {
              const name = feature.properties.name.trim();
              if (name && !seenNames.has(name)) {
                seenNames.add(name);
                uniqueFeatures.push(feature);
              }
            }
          });
          
          // Sort alphabetically
          uniqueFeatures.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
          
          // Generate using document fragment
          const fragment = document.createDocumentFragment();
          
          uniqueFeatures.forEach(feature => {
            const name = feature.properties.name;
            const checkboxElement = this.createCheckboxElement(name, type, feature.properties);
            fragment.appendChild(checkboxElement);
            LazyCheckboxState.addCheckbox(name, type);
          });
          
          // Single DOM insertion
          container.appendChild(fragment);
          
          LazyCheckboxState.markFullyGenerated(type);
          resolve();
        } catch (error) {
          const recovery = ErrorHandler.handle(error, ErrorHandler.categories.GENERATION, {
            operation: `generateAll${type.charAt(0).toUpperCase() + type.slice(1)}Checkboxes`,
            type: type,
            container: container?.id
          });
          
          if (recovery.recovered) {
          }
          resolve();
        }
      };
      
      // Generate during idle time for non-blocking performance
      IdleExecution.scheduleHeavy(generate, { timeout: 2000, fallbackDelay: 100 });
    });
  }
};

// ========================
// DOM FACTORY PATTERNS (Standardized Element Creation)
// ========================
const DOMFactory = {
  // Standardized external link with SVG icon
  createExternalLink(href, slug, urlPrefix) {
    const link = document.createElement('a');
    link.setAttribute('open', '');
    link.href = `/${urlPrefix}/${slug}`;
    link.target = '_blank';
    link.className = 'open-in-new-tab w-inline-block';
    link.innerHTML = this.getSVGIcon('external');
    return link;
  },

  // Standardized SVG icons
  getSVGIcon(type) {
    const icons = {
      external: '<svg xmlns="http://www.w3.org/2000/svg" id="Layer_1" viewBox="0 0 151.49 151.49" width="100%" fill="currentColor" class="svg-3"><polygon class="cls-1" points="151.49 0 151.49 151.49 120.32 151.49 120.32 53.21 22.04 151.49 0 129.45 98.27 31.17 0 31.17 0 0 151.49 0"></polygon></svg>'
    };
    return icons[type] || '';
  },

  // Standardized loading states
  createLoadingState(message = 'Loading...') {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 10px; opacity: 0.6;';
    div.textContent = message;
    return div;
  },

  // Standardized container clearing
  clearContainer(container) {
    if (container) {
      container.innerHTML = '';
    }
  },

  // Standardized count elements
  createCountElement(initialValue = '0') {
    const countWrapper = document.createElement('div');
    countWrapper.className = 'div-block-31834';
    const countElement = document.createElement('div');
    countElement.setAttribute('fs-list-element', 'facet-count');
    countElement.className = 'test33';
    countElement.textContent = initialValue;
    countWrapper.appendChild(countElement);
    return countWrapper;
  },

  // Standardized checkbox input creation
  createCheckboxInput(config) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = config.name;
    checkbox.setAttribute('data-name', config.name);
    checkbox.setAttribute('fs-list-value', config.value);
    checkbox.setAttribute('fs-list-field', config.fieldName);
    checkbox.id = config.id;
    checkbox.style.cssText = 'opacity: 0; position: absolute; z-index: -1;';
    
    // Add optional attributes
    if (config.autoSidebar) checkbox.setAttribute('data-auto-sidebar', 'true');
    if (config.filterIndicator) checkbox.setAttribute('activate-filter-indicator', config.filterIndicator);
    
    return checkbox;
  }
};

// ========================
// EVENT SETUP MODULES (Focused & Reusable)
// ========================
const EventSetup = {
  // Setup sidebar auto-opening events
  setupSidebarEvents() {
    const sidebarHandlers = [
      {selector: '[data-auto-sidebar="true"]', target: 'Left'},
      {selector: '[data-auto-second-left-sidebar="true"]', target: 'SecondLeft'}
    ];
    
    sidebarHandlers.forEach(({selector, target}) => {
      const elements = $(selector);
      elements.forEach(element => {
        ['change', 'input'].forEach(event => {
          if (event === 'input' && !['text', 'search'].includes(element.type)) return;
          
          eventManager.add(element, event, () => {
            if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
              state.setTimer('sidebarUpdate', () => toggleSidebar(target, true), APP_CONFIG.timeouts.debounce);
            }
          });
        });
      });
    });
  },
  
  // Setup filter-related events
  setupFilterEvents() {
    const filterHandlers = [
      'select, [fs-cmsfilter-element="select"]',
      '[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select'
    ];
    
    filterHandlers.forEach(selector => {
      const elements = $(selector);
      elements.forEach(element => {
        eventManager.add(element, 'change', () => {
          state.setTimer('filterUpdate', handleFilterUpdate, APP_CONFIG.timeouts.debounce);
        });
      });
    });
  },
  
  // Setup map filter application events
  setupMapFilterEvents() {
    const filterElements = $('[apply-map-filter="true"], .filterrefresh, #filter-button');
    
    filterElements.forEach(element => {
      const events = element.getAttribute('apply-map-filter') === 'true' 
        ? ['click', 'keypress', 'input'] 
        : ['click'];
      
      events.forEach(eventType => {
        eventManager.add(element, eventType, () => {
          state.setTimer('applyFilter', () => {
            applyFilterToMarkers();
            state.setTimer('applyFilterCleanup', () => {
              checkAndToggleFilteredElements();
            }, APP_CONFIG.timeouts.debounce);
          }, 50);
        });
      });
    });
  },
  
  // Setup special form handling events
  setupFormEvents() {
    $('[fs-cmsfilter-element="form"]').forEach(form => {
      // Form-specific event handling
      if (form.action && form.action.includes('cloneable') && window.location.href.includes('cloneable')) {
        eventManager.add(form, 'submit', (e) => {
          if (window.navigator.userAgent.includes('Firefox')) {
            state.setTimer('firefoxSubmit', () => {
              applyFilterToMarkers();
              state.setTimer('firefoxSubmitCleanup', () => {
                checkAndToggleFilteredElements();
              }, APP_CONFIG.timeouts.debounce);
            }, 200);
          }
        });
      }
    });
  },
  
  // Setup Finsweet integration events
  setupFinsweetEvents() {
    ['fs-cmsfilter-change', 'fs-cmsfilter-search', 'fs-cmsfilter-reset'].forEach(event => {
      eventManager.add(document, event, () => {
        IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 100 });
      });
    });
  }
};

// ========================
// ENHANCED ERROR HANDLING
// ========================
const ErrorHandler = {
  // Error categories for different handling
  categories: {
    STORAGE: 'storage',
    NETWORK: 'network', 
    DOM: 'dom',
    GENERATION: 'generation',
    UI: 'ui'
  },
  
  // Handle different types of errors with appropriate recovery
  handle(error, category, context = {}) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      category,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
    
    // Log error with context
    // // console.error(`[${category.toUpperCase()}] Error in ${context.operation || 'unknown'}:`, errorInfo);
    
    // Category-specific handling
    switch (category) {
      case this.categories.STORAGE:
        return this.handleStorageError(error, context);
      case this.categories.NETWORK:
        return this.handleNetworkError(error, context);
      case this.categories.DOM:
        return this.handleDOMError(error, context);
      case this.categories.GENERATION:
        return this.handleGenerationError(error, context);
      case this.categories.UI:
        return this.handleUIError(error, context);
      default:
        return this.handleGenericError(error, context);
    }
  },
  
  handleStorageError(error, context) {
    // console.warn('Storage error - falling back to memory storage');
    // Storage errors are already handled by SafeStorage
    return { recovered: true, fallback: 'memory' };
  },
  
  handleNetworkError(error, context) {
    // console.warn('Network error - will retry with cached data if available');
    return { 
      recovered: false, 
      retry: true,
      fallback: 'cache',
      retryDelay: context.retryDelay || 5000
    };
  },
  
  handleDOMError(error, context) {
    // console.warn('DOM error - element may not exist yet');
    return { 
      recovered: false, 
      retry: true,
      retryDelay: context.retryDelay || 100,
      maxRetries: 3
    };
  },
  
  handleGenerationError(error, context) {
    // console.warn('Checkbox generation error - continuing with partial generation');
    return { 
      recovered: true, 
      continuePartial: true,
      affectedType: context.type
    };
  },
  
  handleUIError(error, context) {
    // console.warn('UI error - interface may continue with reduced functionality');
    return { recovered: true, reducedFunctionality: true };
  },
  
  handleGenericError(error, context) {
    // console.error('Unhandled error - check console for details');
    return { recovered: false };
  },
  
  // Retry mechanism with exponential backoff
  retry(operation, maxRetries = 3, baseDelay = 1000) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const attemptOperation = () => {
        attempts++;
        Promise.resolve(operation())
          .then(resolve)
          .catch(error => {
            if (attempts >= maxRetries) {
              reject(error);
            } else {
              const delay = baseDelay * Math.pow(2, attempts - 1);
              // console.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempts}/${maxRetries})`);
              setTimeout(attemptOperation, delay);
            }
          });
      };
      
      attemptOperation();
    });
  }
};

// ========================
// OPTIMIZED EVENT DELEGATION
// ========================
const OptimizedEventDelegate = {
  // Single document-level delegation for better performance
  init() {
    // Sidebar events with single delegation
    this.setupSidebarDelegation();
    
    // Filter events with single delegation  
    this.setupFilterDelegation();
    
    // Map filter events with single delegation
    this.setupMapFilterDelegation();
    
    // Finsweet events (already optimal as document events)
    this.setupFinsweetDelegation();
  },
  
  setupSidebarDelegation() {
    const sidebarHandler = (e) => {
      if (window.innerWidth <= APP_CONFIG.breakpoints.tablet) return;
      
      const target = e.target;
      if (target.hasAttribute('data-auto-sidebar')) {
        state.setTimer('sidebarUpdate', () => toggleSidebar('Left', true), APP_CONFIG.timeouts.debounce);
      } else if (target.hasAttribute('data-auto-second-left-sidebar')) {
        state.setTimer('sidebarUpdate', () => toggleSidebar('SecondLeft', true), APP_CONFIG.timeouts.debounce);
      }
    };
    
    // Single delegated listeners for all sidebar events
    eventManager.add(document, 'change', sidebarHandler);
    eventManager.add(document, 'input', sidebarHandler);
  },
  
  setupFilterDelegation() {
    // Single delegated listener for all filter changes
    eventManager.add(document, 'change', (e) => {
      const target = e.target;
      
      if (target.matches('select, [fs-cmsfilter-element="select"]') ||
          target.closest('[fs-cmsfilter-element="filters"]')) {
        state.setTimer('filterUpdate', handleFilterUpdate, APP_CONFIG.timeouts.debounce);
      }
    });
  },
  
  setupMapFilterDelegation() {
    const mapFilterHandler = (e) => {
      const target = e.target;
      
      // Check for map filter elements
      if (!target.hasAttribute('apply-map-filter') && 
          !target.classList.contains('filterrefresh') && 
          target.id !== 'filter-button') return;
      
      if (e.type === 'keypress' && e.key !== 'Enter') return;
      if (window.isMarkerClick) return;
      
      e.preventDefault();
      
      state.flags.forceFilteredReframe = true;
      state.flags.isRefreshButtonAction = true;
      
      const delay = e.type === 'input' ? APP_CONFIG.timeouts.filterUpdate : APP_CONFIG.timeouts.debounce;
      
      state.setTimer('applyFilter', () => {
        applyFilterToMarkers(true);
        state.setTimer('applyFilterCleanup', () => {
          state.flags.forceFilteredReframe = false;
          state.flags.isRefreshButtonAction = false;
        }, 1000);
      }, delay);
    };
    
    // Single delegated listeners for map filter events
    ['click', 'keypress', 'input'].forEach(event => {
      eventManager.add(document, event, mapFilterHandler);
    });
  },
  
  setupFinsweetDelegation() {
    // Single optimized handler for all Finsweet events
    const finsweetHandler = (e) => {
      if (window.isMarkerClick || state.markerInteractionLock) return;
      
      if (e.type.includes('filtered') || e.type.includes('pagination')) {
        handleFilterUpdate();
      }
      
      IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 100 });
    };
    
    // All Finsweet events handled by single function
    [
      'fs-cmsfilter-filtered',
      'fs-cmsfilter-pagination-page-changed',
      'fs-cmsfilter-change',
      'fs-cmsfilter-search',
      'fs-cmsfilter-reset'
    ].forEach(event => {
      eventManager.add(document, event, finsweetHandler);
    });
    
    // Delegated link handling
    eventManager.add(document, 'click', (e) => {
      const link = e.target.closest('a');
      if (!link || link.classList.contains('filterrefresh') || link.hasAttribute('fs-cmsfilter-element')) return;
      
      if (!link.closest('[fs-cmsfilter-element]') && 
          !link.classList.contains('w-pagination-next') && 
          !link.classList.contains('w-pagination-previous')) {
        window.isLinkClick = true;
        state.setTimer('linkCleanup', () => window.isLinkClick = false, 500);
      }
    });
  }
};

// ========================
// SAFE STORAGE WRAPPER
// ========================
const SafeStorage = {
  available: false,
  
  init() {
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.available = true;
    } catch(e) {
      this.available = false;
      // console.warn('localStorage not available, caching disabled');
    }
    return this.available;
  },
  
  getItem(key) {
    if (!this.available) return null;
    try {
      return localStorage.getItem(key);
    } catch(e) {
      return null;
    }
  },
  
  setItem(key, value) {
    if (!this.available) return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch(e) {
      // Quota exceeded or other error
      if (e.name === 'QuotaExceededError') {
        this.clearOldCache();
        try {
          localStorage.setItem(key, value);
          return true;
        } catch(e2) {
          return false;
        }
      }
      return false;
    }
  },
  
  removeItem(key) {
    if (!this.available) return;
    try {
      localStorage.removeItem(key);
    } catch(e) {
      // Silently fail
    }
  },
  
  clearOldCache() {
    if (!this.available) return;
    const now = Date.now();
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(APP_CONFIG.cache.metaPrefix)) {
        try {
          const meta = JSON.parse(localStorage.getItem(key));
          if (meta && meta.timestamp) {
            const age = (now - meta.timestamp) / (1000 * 60);
            if (age > APP_CONFIG.cache.duration) {
              localStorage.removeItem(key);
              const dataKey = key.replace(APP_CONFIG.cache.metaPrefix, APP_CONFIG.cache.storagePrefix);
              localStorage.removeItem(dataKey);
            }
          }
        } catch(e) {
          // Remove corrupted entries
          localStorage.removeItem(key);
        }
      }
    });
  }
};

// Initialize storage on load
SafeStorage.init();

// ========================
// FEATURE DETECTION
// ========================
const FeatureDetection = {
  hasWebGL: false,
  hasWebWorker: false,
  hasFetch: false,
  hasIntersectionObserver: false,
  isFirefox: false,
  isSafari: false,
  isMobile: false,
  
  init() {
    // WebGL support
    try {
      const canvas = document.createElement('canvas');
      this.hasWebGL = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch(e) {
      this.hasWebGL = false;
    }
    
    // Web Worker support
    this.hasWebWorker = typeof Worker !== 'undefined';
    
    // Fetch API support
    this.hasFetch = 'fetch' in window;
    
    // Intersection Observer support
    this.hasIntersectionObserver = 'IntersectionObserver' in window;
    
    // Browser detection (using feature detection where possible)
    // Firefox specific features
    this.isFirefox = typeof InstallTrigger !== 'undefined' || 
                     (navigator.userAgent.includes('Firefox') && !navigator.userAgent.includes('Seamonkey'));
    
    // Safari detection
    this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
                    (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
    
    // Mobile detection - using window width only for consistent behavior across browsers
    this.isMobile = window.innerWidth <= APP_CONFIG.breakpoints.mobile;
    
    return this;
  },
  
  // Get appropriate event for the browser
  getTransitionEndEvent() {
    const transitions = {
      'transition': 'transitionend',
      'OTransition': 'oTransitionEnd',
      'MozTransition': 'transitionend',
      'WebkitTransition': 'webkitTransitionEnd'
    };
    
    const el = document.createElement('div');
    for (let t in transitions) {
      if (el.style[t] !== undefined) {
        return transitions[t];
      }
    }
    return 'transitionend';
  }
};

// Initialize feature detection
FeatureDetection.init();

// ========================
// SIMPLE EVENT SYSTEM
// ========================
const EventBus = {
  events: new Map(),
  
  on(event, callback, context = null) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push({ callback, context });
  },
  
  off(event, callback) {
    if (!this.events.has(event)) return;
    const listeners = this.events.get(event);
    const index = listeners.findIndex(listener => listener.callback === callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  },
  
  emit(event, ...args) {
    if (!this.events.has(event)) return;
    this.events.get(event).forEach(({ callback, context }) => {
      try {
        context ? callback.call(context, ...args) : callback(...args);
      } catch (error) {
        // console.error(`Error in event listener for '${event}':`, error);
      }
    });
  },
  
  once(event, callback, context = null) {
    const onceCallback = (...args) => {
      this.off(event, onceCallback);
      context ? callback.call(context, ...args) : callback(...args);
    };
    this.on(event, onceCallback);
  }
};

// Make EventBus globally available
window.EventBus = EventBus;

// ========================
// MEMOIZATION UTILITY
// ========================
const Memoize = {
  cache: new Map(),
  maxSize: 1000,
  
  fn(func, keyGenerator) {
    return (...args) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      
      const result = func(...args);
      
      // Limit cache size
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      
      this.cache.set(key, result);
      return result;
    };
  },
  
  clear() {
    this.cache.clear();
  }
};

// Event setup with consolidated handlers and better management
function setupEvents() {
  // Use optimized event delegation for better performance
  OptimizedEventDelegate.init();
}

// Smart dropdown listeners with better timing
function setupDropdownListeners() {
  if (state.flags.dropdownListenersSetup) return;
  state.flags.dropdownListenersSetup = true;
  
  const districtSelectElements = $('[districtselect]');
  districtSelectElements.forEach(element => {
    eventManager.add(element, 'click', (e) => {
      if (window.isMarkerClick) return;
      
      state.setTimer('dropdownClick', () => {
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        state.setTimer('dropdownApplyFilter', () => {
          applyFilterToMarkers();
          state.setTimer('dropdownCleanup', () => {
            state.flags.forceFilteredReframe = false;
            state.flags.isRefreshButtonAction = false;
          }, 1000);
        }, 150);
      }, 100);
    });
  });
}

// Combined GeoJSON loading with better performance
function loadCombinedGeoData() {
  fetch('https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/Combined-GEOJSON-0.011.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(combinedData => {
      // Batch separate districts and areas
      const districts = [];
      const areas = [];
      
      combinedData.features.forEach(feature => {
        if (feature.properties.type === 'district') {
          districts.push(feature);
        } else if (feature.properties.type === 'area') {
          areas.push(feature);
        }
      });
      
      // Store district-territory mapping for highlighting
      state.districtTerritoryMap = new Map();
      
      // Batch process districts as regions
      mapLayers.addToBatch(() => {
        districts.forEach(districtFeature => {
          const name = districtFeature.properties.name;
          const territory = districtFeature.properties.territory;
          
          // Store the district-territory mapping
          if (territory) {
            state.districtTerritoryMap.set(name, territory);
          }
          
          addRegionBoundaryToMap(name, districtFeature);
        });
      });
      
      // Batch process areas
      mapLayers.addToBatch(() => {
        areas.forEach(areaFeature => {
          const name = areaFeature.properties.name;
          addAreaOverlayToMap(name, areaFeature);
        });
      });
      
      // Update region markers after processing
      state.setTimer('updateRegionMarkers', () => {
        addNativeRegionMarkers();
        
        state.setTimer('finalLayerOrder', () => mapLayers.optimizeLayerOrder(), 300);
        
        // GeoData loaded
      }, 100);
    })
    .catch(error => {
      // Still update region markers in case some data was loaded
      addNativeRegionMarkers();
      state.setTimer('errorLayerOrder', () => mapLayers.optimizeLayerOrder(), 300);
      
      // Continue even with error
    });
}

// Region boundary addition with batching
function addRegionBoundaryToMap(name, regionFeature) {
  const boundary = {
    name,
    sourceId: `${name.toLowerCase().replace(/\s+/g, '-')}-boundary`,
    fillId: `${name.toLowerCase().replace(/\s+/g, '-')}-fill`,
    borderId: `${name.toLowerCase().replace(/\s+/g, '-')}-border`
  };
  
  // Remove existing layers/sources if they exist (batch operation)
  [boundary.borderId, boundary.fillId].forEach(layerId => {
    if (mapLayers.hasLayer(layerId)) {
      map.removeLayer(layerId);
      mapLayers.layerCache.delete(layerId);
    }
  });
  
  if (mapLayers.hasSource(boundary.sourceId)) {
    map.removeSource(boundary.sourceId);
    mapLayers.sourceCache.delete(boundary.sourceId);
  }
  
  // Add source
  map.addSource(boundary.sourceId, {
    type: 'geojson',
    data: {
      type: "FeatureCollection",
      features: [regionFeature]
    }
  });
  
  // Get layer positioning
  const areaLayers = ['area-a-layer', 'area-b-layer', 'area-c-layer', 'firing-zones-layer'];
  const firstAreaLayer = areaLayers.find(layerId => mapLayers.hasLayer(layerId));
  
  // Don't specify beforeId if the layer doesn't exist yet
  const layerConfig = {
    id: boundary.fillId,
    type: 'fill',
    source: boundary.sourceId,
    layout: { 'visibility': 'visible' },
    paint: {
      'fill-color': '#1a1b1e',
      'fill-opacity': 0.15
    }
  };
  
  // Only add beforeId if the layer exists - check settlement layers first
  if (firstAreaLayer) {
    map.addLayer(layerConfig, firstAreaLayer);
  } else if (mapLayers.hasLayer('settlement-clusters')) {
    map.addLayer(layerConfig, 'settlement-clusters');
  } else if (mapLayers.hasLayer('settlement-points')) {
    map.addLayer(layerConfig, 'settlement-points');
  } else if (mapLayers.hasLayer('locality-clusters')) {
    map.addLayer(layerConfig, 'locality-clusters');
  } else {
    map.addLayer(layerConfig);
  }
  
  // Add border layer
  const borderConfig = {
    id: boundary.borderId,
    type: 'line',
    source: boundary.sourceId,
    layout: { 'visibility': 'visible' },
    paint: {
      'line-color': '#888888',
      'line-width': 1,
      'line-opacity': 0.8
    }
  };
  
  // Only add beforeId if the layer exists - check settlement layers first
  if (firstAreaLayer) {
    map.addLayer(borderConfig, firstAreaLayer);
  } else if (mapLayers.hasLayer('settlement-clusters')) {
    map.addLayer(borderConfig, 'settlement-clusters');
  } else if (mapLayers.hasLayer('settlement-points')) {
    map.addLayer(borderConfig, 'settlement-points');
  } else if (mapLayers.hasLayer('locality-clusters')) {
    map.addLayer(borderConfig, 'locality-clusters');
  } else {
    map.addLayer(borderConfig);
  }
  
  // Update cache
  mapLayers.sourceCache.set(boundary.sourceId, true);
  mapLayers.layerCache.set(boundary.fillId, true);
  mapLayers.layerCache.set(boundary.borderId, true);
}

// Area overlay addition with batching
function addAreaOverlayToMap(name, areaFeature) {
  const areaConfig = {
    'Area A': { color: '#adc278', layerId: 'area-a-layer', sourceId: 'area-a-source' },
    'Area B': { color: '#ffdcc6', layerId: 'area-b-layer', sourceId: 'area-b-source' },
    'Area C': { color: '#889c9b', layerId: 'area-c-layer', sourceId: 'area-c-source' },
    'Firing Zones': { color: '#c51d3c', layerId: 'firing-zones-layer', sourceId: 'firing-zones-source' }
  };
  
  const config = areaConfig[name];
  if (!config) return;
  
  // Remove existing layers/sources if they exist
  if (mapLayers.hasLayer(config.layerId)) {
    map.removeLayer(config.layerId);
    mapLayers.layerCache.delete(config.layerId);
  }
  if (mapLayers.hasSource(config.sourceId)) {
    map.removeSource(config.sourceId);
    mapLayers.sourceCache.delete(config.sourceId);
  }
  
  // Add source
  map.addSource(config.sourceId, {
    type: 'geojson',
    data: {
      type: "FeatureCollection",
      features: [areaFeature]
    }
  });
  
  // Add layer
  const layerConfig = {
    id: config.layerId,
    type: 'fill',
    source: config.sourceId,
    layout: { 'visibility': 'visible' },
    paint: {
      'fill-color': config.color,
      'fill-opacity': 0.25,
      'fill-outline-color': config.color
    }
  };
  
  // Only add beforeId if the layer exists - check settlement layers first, then locality
  if (mapLayers.hasLayer('settlement-clusters')) {
    map.addLayer(layerConfig, 'settlement-clusters');
  } else if (mapLayers.hasLayer('settlement-points')) {
    map.addLayer(layerConfig, 'settlement-points');
  } else if (mapLayers.hasLayer('locality-clusters')) {
    map.addLayer(layerConfig, 'locality-clusters');
  } else {
    map.addLayer(layerConfig);
  }
  
  // Update cache
  mapLayers.sourceCache.set(config.sourceId, true);
  mapLayers.layerCache.set(config.layerId, true);
}

// DEFERRED: Area key controls - loads after main functionality
function setupDeferredAreaControls() {
  // Defer loading area controls to improve initial load time
  const loadAreaControls = () => {
    // Check if controls already setup
    if (state.flags.areaControlsSetup) return;
    
    const areaControls = [
      {keyId: 'area-a-key', layerId: 'area-a-layer', wrapId: 'area-a-key-wrap'},
      {keyId: 'area-b-key', layerId: 'area-b-layer', wrapId: 'area-b-key-wrap'},
      {keyId: 'area-c-key', layerId: 'area-c-layer', wrapId: 'area-c-key-wrap'},
      {keyId: 'firing-zones-key', layerId: 'firing-zones-layer', wrapId: 'firing-zones-key-wrap'}
    ];
    
    const markerControls = [
      {
        keyId: 'territory-toggle-key',
        wrapId: 'territory-toggle-key-wrap',
        type: 'territory',
        layers: ['territory-points'],
        label: 'Territory Markers'
      },
      {
        keyId: 'governorate-toggle-key', 
        wrapId: 'governorate-toggle-key-wrap',
        type: 'region',
        layers: ['region-points', 'subregion-points'],
        label: 'Region Markers & Boundaries'
      },
      {
        keyId: 'locality-toggle-key', 
        wrapId: 'locality-toggle-key-wrap',
        type: 'locality',
        layers: ['locality-clusters', 'locality-points'],
        label: 'Locality Markers'
      },
      {
        keyId: 'settlement-toggle-key', 
        wrapId: 'settlement-toggle-key-wrap',
        type: 'settlement',
        layers: ['settlement-clusters', 'settlement-points'],
        label: 'Settlement Markers'
      }
    ];
    
    let setupCount = 0;
    
    // Setup area controls
    areaControls.forEach(control => {
      const checkbox = $id(control.keyId);
      if (!checkbox) return;
      
      checkbox.checked = false;
      
      if (!checkbox.dataset.mapboxListenerAdded) {
        checkbox.addEventListener('change', () => {
          if (!mapLayers.hasLayer(control.layerId)) return;
          
          const visibility = checkbox.checked ? 'none' : 'visible';
          map.setLayoutProperty(control.layerId, 'visibility', visibility);
        });
        checkbox.dataset.mapboxListenerAdded = 'true';
      }
      
      const wrapperDiv = $id(control.wrapId);
      if (wrapperDiv && !wrapperDiv.dataset.mapboxHoverAdded) {
        wrapperDiv.addEventListener('mouseenter', () => {
          if (!mapLayers.hasLayer(control.layerId)) return;
          map.setPaintProperty(control.layerId, 'fill-opacity', 0.5);
        });
        
        wrapperDiv.addEventListener('mouseleave', () => {
          if (!mapLayers.hasLayer(control.layerId)) return;
          map.setPaintProperty(control.layerId, 'fill-opacity', 0.25);
        });
        
        wrapperDiv.dataset.mapboxHoverAdded = 'true';
      }
      
      setupCount++;
    });
    
    // Setup marker controls
    markerControls.forEach(control => {
      // console.log(`🔍 Looking for marker control: keyId="${control.keyId}", wrapId="${control.wrapId}"`);
      const checkbox = $id(control.keyId);
      if (!checkbox) {
        // console.log(`❌ Could not find checkbox element with id: ${control.keyId}`);
        return;
      }
      // console.log(`✅ Found checkbox element: ${control.keyId}`);
      
      checkbox.checked = false;
      
      if (!checkbox.dataset.mapboxListenerAdded) {
        const changeHandler = (e) => {
          const visibility = e.target.checked ? 'none' : 'visible';
          
          if (control.type === 'territory') {
            control.layers.forEach(layerId => {
              if (mapLayers.hasLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visibility);
              }
            });
          } else if (control.type === 'region') {
            control.layers.forEach(layerId => {
              if (mapLayers.hasLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visibility);
              }
            });
            
            const allLayers = map.getStyle().layers;
            allLayers.forEach(layer => {
              if (layer.id.includes('-fill') || layer.id.includes('-border')) {
                map.setLayoutProperty(layer.id, 'visibility', visibility);
              }
            });
            
          } else if (control.type === 'locality') {
            control.layers.forEach(layerId => {
              if (mapLayers.hasLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visibility);
              }
            });
          } else if (control.type === 'settlement') {
            control.layers.forEach(layerId => {
              if (mapLayers.hasLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visibility);
              }
            });
          }
        };
        
        checkbox.addEventListener('change', changeHandler);
        checkbox.dataset.mapboxListenerAdded = 'true';
      }
      
      const wrapperDiv = $id(control.wrapId);
      // console.log(`🔍 Looking for wrapper element: ${control.wrapId}`);
      if (!wrapperDiv) {
        // console.log(`❌ Could not find wrapper element with id: ${control.wrapId}`);
      } else {
        // console.log(`✅ Found wrapper element: ${control.wrapId}`);
      }
      
      if (wrapperDiv && !wrapperDiv.dataset.mapboxHoverAdded) {
        const mouseEnterHandler = () => {
          if (control.type === 'territory') {
            if (mapLayers.hasLayer('territory-points')) {
              map.setPaintProperty('territory-points', 'text-halo-color', '#6a6a6a');
            }
            // Highlight all districts for both territories (since hover doesn't specify which)
            if (state.districtTerritoryMap) {
              state.districtTerritoryMap.forEach((territory, districtName) => {
                const fillId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-fill`;
                const borderId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-border`;
                
                if (mapLayers.hasLayer(fillId) && mapLayers.hasLayer(borderId)) {
                  map.setPaintProperty(fillId, 'fill-color', '#6e3500');
                  map.setPaintProperty(fillId, 'fill-opacity', 0.4);
                  map.setPaintProperty(borderId, 'line-color', '#6e3500');
                  map.setPaintProperty(borderId, 'line-opacity', 0.9);
                }
              });
            }
          } else if (control.type === 'region') {
            if (mapLayers.hasLayer('region-points')) {
              map.setPaintProperty('region-points', 'text-halo-color', '#8f4500');
            }
            if (mapLayers.hasLayer('subregion-points')) {
              map.setPaintProperty('subregion-points', 'text-halo-color', '#8f4500');
            }
            
            // Only highlight regions if territory highlighting is not active
            if (!state.territoryHighlightActive) {
              console.log(`🏛️ Region hover: Territory highlighting NOT active, applying region highlights`);
              const allLayers = map.getStyle().layers;
              allLayers.forEach(layer => {
                if (layer.id.includes('-fill')) {
                  map.setPaintProperty(layer.id, 'fill-color', '#6e3500');
                  map.setPaintProperty(layer.id, 'fill-opacity', 0.4);
                }
                if (layer.id.includes('-border')) {
                  map.setPaintProperty(layer.id, 'line-color', '#6e3500');
                  map.setPaintProperty(layer.id, 'line-opacity', 0.9);
                }
              });
            } else {
              console.log(`🏛️ Region hover: Territory highlighting IS active, skipping region highlights`);
            }
          } else if (control.type === 'locality') {
            if (mapLayers.hasLayer('locality-clusters')) {
              map.setPaintProperty('locality-clusters', 'text-halo-color', '#8a8a00');
            }
            if (mapLayers.hasLayer('locality-points')) {
              map.setPaintProperty('locality-points', 'text-halo-color', '#8a8a00');
            }
          } else if (control.type === 'settlement') {
            if (mapLayers.hasLayer('settlement-clusters')) {
              map.setPaintProperty('settlement-clusters', 'text-halo-color', '#b30000');
            }
            if (mapLayers.hasLayer('settlement-points')) {
              map.setPaintProperty('settlement-points', 'text-halo-color', '#b30000');
            }
          }
        };
        
        const mouseLeaveHandler = () => {
          if (control.type === 'territory') {
            if (mapLayers.hasLayer('territory-points')) {
              map.setPaintProperty('territory-points', 'text-halo-color', '#2d1810');
            }
            // Unhighlight all districts
            if (state.districtTerritoryMap) {
              state.districtTerritoryMap.forEach((territory, districtName) => {
                const fillId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-fill`;
                const borderId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-border`;
                
                if (mapLayers.hasLayer(fillId) && mapLayers.hasLayer(borderId)) {
                  const currentColor = document.getElementById('region-color') ? document.getElementById('region-color').value : '#1a1b1e';
                  map.setPaintProperty(fillId, 'fill-color', currentColor);
                  map.setPaintProperty(fillId, 'fill-opacity', 0.15);
                  map.setPaintProperty(borderId, 'line-color', '#888888');
                  map.setPaintProperty(borderId, 'line-opacity', 0.8);
                }
              });
            }
          } else if (control.type === 'region') {
            if (mapLayers.hasLayer('region-points')) {
              map.setPaintProperty('region-points', 'text-halo-color', '#6e3500');
            }
            if (mapLayers.hasLayer('subregion-points')) {
              map.setPaintProperty('subregion-points', 'text-halo-color', '#6e3500');
            }
            
            // Only unhighlight regions if territory highlighting is not active
            if (!state.territoryHighlightActive) {
              console.log(`🏛️ Region unhover: Territory highlighting NOT active, removing region highlights`);
              const allLayers = map.getStyle().layers;
              allLayers.forEach(layer => {
                if (layer.id.includes('-fill')) {
                  const currentColor = document.getElementById('region-color') ? document.getElementById('region-color').value : '#1a1b1e';
                  map.setPaintProperty(layer.id, 'fill-color', currentColor);
                  map.setPaintProperty(layer.id, 'fill-opacity', 0.15);
                }
                if (layer.id.includes('-border')) {
                  map.setPaintProperty(layer.id, 'line-color', '#888888');
                  map.setPaintProperty(layer.id, 'line-opacity', 0.8);
                }
              });
            } else {
              console.log(`🏛️ Region unhover: Territory highlighting IS active, skipping region unhighlight`);
            }
          } else if (control.type === 'locality') {
            if (mapLayers.hasLayer('locality-clusters')) {
              map.setPaintProperty('locality-clusters', 'text-halo-color', '#616100');
            }
            if (mapLayers.hasLayer('locality-points')) {
              map.setPaintProperty('locality-points', 'text-halo-color', '#616100');
            }
          } else if (control.type === 'settlement') {
            if (mapLayers.hasLayer('settlement-clusters')) {
              map.setPaintProperty('settlement-clusters', 'text-halo-color', '#800000');
            }
            if (mapLayers.hasLayer('settlement-points')) {
              map.setPaintProperty('settlement-points', 'text-halo-color', '#800000');
            }
          }
        };
        
        wrapperDiv.addEventListener('mouseenter', mouseEnterHandler);
        wrapperDiv.addEventListener('mouseleave', mouseLeaveHandler);
        wrapperDiv.dataset.mapboxHoverAdded = 'true';
      }
      
      setupCount++;
    });
    
    // Mark as complete
    if (setupCount > 0) {
      state.flags.areaControlsSetup = true;
    }
  };
  
  // Use requestIdleCallback if available, otherwise setTimeout
  // Load area controls during idle time for better performance
  IdleExecution.scheduleHeavy(loadAreaControls, { timeout: 3000, fallbackDelay: 2000 });
}

// Generate settlement checkboxes from loaded settlement data (modified for lazy loading) 
function generateSettlementCheckboxes() {
  if (APP_CONFIG.features.enableLazyCheckboxes) {
    return;
  }
  
  const container = $id('settlement-check-list');
  if (!container) {
    return;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Extract unique settlement names from settlement features
  const settlementNames = state.allSettlementFeatures
    .map(feature => feature.properties.name)
    .sort();
  
  if (settlementNames.length === 0) {
    return;
  }
  
  // Batch generate checkboxes using document fragment
  const fragment = document.createDocumentFragment();
  settlementNames.forEach(settlementName => {
    // Find the settlement feature to get the slug
    const settlementFeature = state.allSettlementFeatures.find(feature => feature.properties.name === settlementName);
    const settlementSlug = settlementFeature?.properties?.slug || settlementName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Create the wrapper div
    const wrapperDiv = document.createElement('div');
    wrapperDiv.setAttribute('checkbox-filter', 'settlement');
    wrapperDiv.className = 'checbox-item';
    
    // Create the label
    const label = document.createElement('label');
    label.className = 'w-checkbox reporterwrap-copy';
    
    // Create the link element using DOMFactory
    const link = DOMFactory.createExternalLink(null, settlementSlug, 'settlement');
    
    // Create the custom checkbox div
    const customCheckbox = document.createElement('div');
    customCheckbox.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
    
    // Create the actual input
    const input = document.createElement('input');
    input.setAttribute('data-auto-sidebar', 'true');
    input.setAttribute('fs-list-value', settlementName);
    input.setAttribute('fs-list-field', 'Settlement');
    input.type = 'checkbox';
    input.name = 'settlement';
    input.setAttribute('data-name', 'settlement');
    input.setAttribute('activate-filter-indicator', 'place');
    input.id = `settlement-${settlementName.replace(/[^a-zA-Z0-9]/g, '-')}`;
    input.style.opacity = '0';
    input.style.position = 'absolute';
    input.style.zIndex = '-1';
    
    // Create the span label
    const span = document.createElement('span');
    span.className = 'test3 w-form-label';
    span.setAttribute('for', input.id);
    span.textContent = settlementName;
    
    // Create the count div structure
    const countWrapper = document.createElement('div');
    countWrapper.className = 'div-block-31834';
    
    const countDiv = document.createElement('div');
    countDiv.setAttribute('fs-list-element', 'facet-count');
    countDiv.className = 'test33';
    countDiv.textContent = '0';
    
    countWrapper.appendChild(countDiv);
    
    // Assemble the structure
    label.appendChild(link);
    label.appendChild(customCheckbox);
    label.appendChild(input);
    label.appendChild(span);
    label.appendChild(countWrapper);
    wrapperDiv.appendChild(label);
    fragment.appendChild(wrapperDiv);
    
    // Setup events for this checkbox
    setupCheckboxEvents(wrapperDiv);
  });
  
  container.appendChild(fragment);
  
  // Check filtered elements after generating checkboxes
  state.setTimer('checkFilteredAfterSettlementGeneration', checkAndToggleFilteredElements, 200);
  
  // Invalidate DOM cache since we added new elements
  domCache.markStale();
  
  // Refresh search script cache if available
  if (window.checkboxFilterScript) {
    window.checkboxFilterScript.recacheElements();
  }
}

// Generate single checkbox for a specific location (lazy loading)
function generateSingleCheckbox(name, type, properties = {}) {
  if (!APP_CONFIG.features.enableLazyCheckboxes) {
    return false;
  }
  
  // Check if already generated
  if (LazyCheckboxState.hasCheckbox(name, type)) {
    return true;
  }
  
  const containerId = type === 'locality' ? 'locality-check-list' : 'settlement-check-list';
  const container = $id(containerId);
  if (!container) {
    // console.warn(`Container ${containerId} not found for single checkbox generation`);
    return false;
  }
  
  // Create the complex checkbox structure to match sidebars script EXACTLY
  const checkboxWrapper = document.createElement('div');
  checkboxWrapper.setAttribute('checkbox-filter', type);
  checkboxWrapper.className = 'checbox-item'; // Note: keeping original typo to match existing structure
  
  const label = document.createElement('label');
  label.className = 'w-checkbox reporterwrap-copy';
  
  // Generate slug and URL exactly like sidebars script
  const slug = properties.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const urlPrefix = type === 'settlement' ? 'settlement' : 'locality';
  
  // Create the external link
  const link = document.createElement('a');
  link.setAttribute('open', '');
  link.href = `/${urlPrefix}/${slug}`;
  link.target = '_blank';
  link.className = 'open-in-new-tab w-inline-block';
  
  // Add the SVG icon using DOMFactory
  link.innerHTML = DOMFactory.getSVGIcon('external');
  
  // Create the custom checkbox input wrapper
  const checkboxInputWrapper = document.createElement('div');
  checkboxInputWrapper.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
  
  // Create the actual checkbox input - MATCH SIDEBARS SCRIPT EXACTLY
  const checkbox = document.createElement('input');
  const pluralType = type === 'locality' ? 'localities' : 'settlements'; // Use plural for ID like sidebars
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '-'); // Match sidebars regex exactly
  const fieldName = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize for field name
  
  // Set attributes exactly like sidebars script
  checkbox.setAttribute('data-auto-sidebar', 'true');
  checkbox.setAttribute('fs-list-value', name);
  checkbox.setAttribute('fs-list-field', fieldName);
  checkbox.type = 'checkbox';
  checkbox.name = type;
  checkbox.setAttribute('data-name', type);
  checkbox.setAttribute('activate-filter-indicator', 'place');
  checkbox.id = `${pluralType}-${cleanName}`; // Match sidebars format exactly
  checkbox.style.cssText = 'opacity: 0; position: absolute; z-index: -1;';
  
  // Create the label text
  const labelText = document.createElement('span');
  labelText.className = 'test3 w-form-label';
  labelText.setAttribute('for', checkbox.id);
  labelText.textContent = name;
  
  // Create the count wrapper
  const countWrapper = document.createElement('div');
  countWrapper.className = 'div-block-31834';
  
  const countElement = document.createElement('div');
  countElement.setAttribute('fs-list-element', 'facet-count');
  countElement.className = 'test33';
  countElement.textContent = '0'; // Default count
  
  countWrapper.appendChild(countElement);
  
  // Assemble the structure
  label.appendChild(link);
  label.appendChild(checkboxInputWrapper);
  label.appendChild(checkbox);
  label.appendChild(labelText);
  label.appendChild(countWrapper);
  
  checkboxWrapper.appendChild(label);
  
  // Insert in alphabetical order
  const existingCheckboxes = Array.from(container.querySelectorAll('.checbox-item .test3'));
  let insertPosition = existingCheckboxes.length;
  
  for (let i = 0; i < existingCheckboxes.length; i++) {
    if (name.localeCompare(existingCheckboxes[i].textContent) < 0) {
      insertPosition = i;
      break;
    }
  }
  
  if (insertPosition >= existingCheckboxes.length) {
    container.appendChild(checkboxWrapper);
  } else {
    container.insertBefore(checkboxWrapper, existingCheckboxes[insertPosition].closest('.checbox-item'));
  }
  
  // Track the generated checkbox
  LazyCheckboxState.addCheckbox(name, type);
  
  // Setup event listeners for the new checkbox
  setupGeneratedCheckboxEvents();
  
  // Force complete rebuild of filter script cache for better integration
  if (window.checkboxFilterScript) {
    setTimeout(() => {
      // Use forceRebuild for single checkboxes to ensure cache invalidation
      window.checkboxFilterScript.forceRebuild();
    }, 150);
  }
  
  // Rescan filter indicators for the new checkbox
  if (window.filterIndicators) {
    setTimeout(() => {
      window.filterIndicators.rescan();
    }, 100);
  }
  
  return true;
}

// Bulk generate all locality checkboxes (for Location tab click)
function generateAllLocalityCheckboxes() {
  return CheckboxFactory.generateBulkCheckboxes(
    'locality-check-list',
    state.allLocalityFeatures || [],
    'locality',
    'allLocalityFeatures'
  );
}

// Bulk generate all settlement checkboxes (for Location tab click)
function generateAllSettlementCheckboxes() {
  return CheckboxFactory.generateBulkCheckboxes(
    'settlement-check-list',
    state.allSettlementFeatures || [],
    'settlement',
    'allSettlementFeatures'
  );
}

// Generate all checkboxes when Location tab is clicked
function generateAllCheckboxes() {
  if (LazyCheckboxState.isGeneratingBulk) {
    return Promise.resolve();
  }
  
  LazyCheckboxState.isGeneratingBulk = true;
  
  // Show loading state
  const localityContainer = $id('locality-check-list');
  const settlementContainer = $id('settlement-check-list');
  
  if (localityContainer && !LazyCheckboxState.isFullyGenerated('locality')) {
    DOMFactory.clearContainer(localityContainer);
    localityContainer.appendChild(DOMFactory.createLoadingState('Loading localities...'));
  }
  if (settlementContainer && !LazyCheckboxState.isFullyGenerated('settlement')) {
    DOMFactory.clearContainer(settlementContainer);
    settlementContainer.appendChild(DOMFactory.createLoadingState('Loading settlements...'));
  }
  
  return Promise.all([
    generateAllLocalityCheckboxes(),
    generateAllSettlementCheckboxes()
  ]).then(() => {
    LazyCheckboxState.isGeneratingBulk = false;
    
    // Setup event listeners for all new checkboxes
    setupGeneratedCheckboxEvents();
    
    // Recache after bulk generation (lighter than forceRebuild for batch operations)
    if (window.checkboxFilterScript) {
      setTimeout(() => {
        // Use lighter recacheElements for batch operations since we're not mixing individual insertions
        window.checkboxFilterScript.recacheElements();
      }, 100);
    }
    
    // Rescan filter indicators for all new checkboxes
    if (window.filterIndicators) {
      setTimeout(() => {
        window.filterIndicators.rescan();
      }, 50);
    }
  }).catch((error) => {
    LazyCheckboxState.isGeneratingBulk = false;
    // console.error('Bulk checkbox generation failed:', error);
  });
}

// Generate locality checkboxes from map data (modified for lazy loading)
function generateLocalityCheckboxes() {
  if (APP_CONFIG.features.enableLazyCheckboxes) {
    return;
  }
  
  const container = $id('locality-check-list');
  if (!container) {
    return;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Extract unique locality names from map data
  const localityNames = [...new Set(state.allLocalityFeatures.map(feature => feature.properties.name))].sort();
  
  if (localityNames.length === 0) {
    return;
  }
  
  // Batch generate checkboxes using document fragment
  const fragment = document.createDocumentFragment();
  localityNames.forEach(localityName => {
    // Find the locality feature to get the slug
    const localityFeature = state.allLocalityFeatures.find(feature => feature.properties.name === localityName);
    const localitySlug = localityFeature?.properties?.slug || localityName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Create the wrapper div
    const wrapperDiv = document.createElement('div');
    wrapperDiv.setAttribute('checkbox-filter', 'locality');
    wrapperDiv.className = 'checbox-item';
    
    // Create the label
    const label = document.createElement('label');
    label.className = 'w-checkbox reporterwrap-copy';
    
    // Create the link element
    const link = document.createElement('a');
    link.setAttribute('open', '');
    link.href = `/locality/${localitySlug}`;
    link.target = '_blank';
    link.className = 'open-in-new-tab w-inline-block';
    link.innerHTML = DOMFactory.getSVGIcon('external');
    
    // Create the custom checkbox div
    const customCheckbox = document.createElement('div');
    customCheckbox.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
    
    // Create the actual input
    const input = document.createElement('input');
    input.setAttribute('data-auto-sidebar', 'true');
    input.setAttribute('fs-list-value', localityName);
    input.setAttribute('fs-list-field', 'Locality');
    input.type = 'checkbox';
    input.name = 'locality';
    input.setAttribute('data-name', 'locality');
    input.setAttribute('activate-filter-indicator', 'place');
    input.id = `locality-${localityName.replace(/[^a-zA-Z0-9]/g, '-')}`;
    input.style.opacity = '0';
    input.style.position = 'absolute';
    input.style.zIndex = '-1';
    
    // Create the span label
    const span = document.createElement('span');
    span.className = 'test3 w-form-label';
    span.setAttribute('for', input.id);
    span.textContent = localityName;
    
    // Create the count div structure
    const countWrapper = document.createElement('div');
    countWrapper.className = 'div-block-31834';
    
    const countDiv = document.createElement('div');
    countDiv.setAttribute('fs-list-element', 'facet-count');
    countDiv.className = 'test33';
    countDiv.textContent = '0';
    
    countWrapper.appendChild(countDiv);
    
    // Assemble the structure
    label.appendChild(link);
    label.appendChild(customCheckbox);
    label.appendChild(input);
    label.appendChild(span);
    label.appendChild(countWrapper);
    wrapperDiv.appendChild(label);
    fragment.appendChild(wrapperDiv);
    
    // Setup events for this checkbox
    setupCheckboxEvents(wrapperDiv);
  });
  
  container.appendChild(fragment);
  
  // Check filtered elements after generating checkboxes
  state.setTimer('checkFilteredAfterGeneration', checkAndToggleFilteredElements, 200);
  
  // Invalidate DOM cache since we added new elements
  domCache.markStale();
  
  // Refresh search script cache if available
  if (window.checkboxFilterScript) {
    window.checkboxFilterScript.recacheElements();
  }
}

// Generate region checkboxes from map data
function generateRegionCheckboxes() {
  const container = $id('region-check-list');
  if (!container) {
    return;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Extract unique region names
  const regionNames = [...new Set(state.allRegionFeatures.map(feature => feature.properties.name))].sort();
  
  // Extract unique subregion names
  const subregionNames = state.allSubregionFeatures ? 
    [...new Set(state.allSubregionFeatures.map(feature => feature.properties.name))].sort() : [];
  
  if (regionNames.length === 0 && subregionNames.length === 0) {
    return;
  }
  
  // Combine both lists for alphabetical display
  const allItems = [
    ...regionNames.map(name => ({ name, type: 'region' })),
    ...subregionNames.map(name => ({ name, type: 'subregion' }))
  ].sort((a, b) => a.name.localeCompare(b.name));
  
  // Batch generate checkboxes using document fragment
  const fragment = document.createDocumentFragment();
  allItems.forEach(item => {
    // Create the wrapper div
    const wrapperDiv = document.createElement('div');
    wrapperDiv.setAttribute('checkbox-filter', item.type === 'region' ? 'Governorate' : 'Region');
    wrapperDiv.setAttribute('role', 'listitem');
    wrapperDiv.className = 'collection-item-3 w-dyn-item';
    
    // Create the label
    const label = document.createElement('label');
    label.className = 'w-checkbox reporterwrap-copy';
    
    // Create the custom checkbox div
    const customCheckbox = document.createElement('div');
    customCheckbox.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
    
    // Create the actual input
    const input = document.createElement('input');
    input.setAttribute('data-auto-sidebar', 'true');
    input.setAttribute('fs-list-value', item.name);
    input.setAttribute('fs-list-field', item.type === 'region' ? 'Governorate' : 'Region');
    input.type = 'checkbox';
    input.name = item.type;
    input.setAttribute('data-name', item.type);
    input.setAttribute('activate-filter-indicator', 'place');
    input.id = item.type;
    input.style.opacity = '0';
    input.style.position = 'absolute';
    input.style.zIndex = '-1';
    
    // Create the span label
    const span = document.createElement('span');
    span.className = 'checkbox-text w-form-label';
    span.setAttribute('for', item.type);
    span.textContent = item.name;
    
    // Create the count div structure
    const countWrapper = document.createElement('div');
    countWrapper.className = 'div-block-31834';
    
    const countDiv = document.createElement('div');
    countDiv.setAttribute('fs-list-element', 'facet-count');
    countDiv.className = 'test33';
    countDiv.textContent = '0';
    
    countWrapper.appendChild(countDiv);
    
    // Assemble the structure
    label.appendChild(customCheckbox);
    label.appendChild(input);
    label.appendChild(span);
    label.appendChild(countWrapper);
    wrapperDiv.appendChild(label);
    fragment.appendChild(wrapperDiv);
    
    // Setup events for this checkbox
    setupCheckboxEvents(wrapperDiv);
  });
  
  container.appendChild(fragment);
  
  // Check filtered elements after generating checkboxes
  state.setTimer('checkFilteredAfterRegionGeneration', checkAndToggleFilteredElements, 200);
  
  // Invalidate DOM cache since we added new elements
  domCache.markStale();
  
  // Refresh search script cache if available
  if (window.checkboxFilterScript) {
    window.checkboxFilterScript.recacheElements();
  }
}


// Setup events for newly generated checkboxes (matches sidebars script exactly)
function setupGeneratedCheckboxEvents() {
  const autoSidebarCheckboxes = document.querySelectorAll('[data-auto-sidebar="true"]');
  let newListenersCount = 0;
  
  autoSidebarCheckboxes.forEach(element => {
    if (element.dataset.eventListenerAdded === 'true') return;
    
    const changeHandler = () => {
      if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
        state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
      }
    };
    
    eventManager.add(element, 'change', changeHandler);
    
    if (['text', 'search'].includes(element.type)) {
      const inputHandler = () => {
        if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
          state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
        }
      };
      eventManager.add(element, 'input', inputHandler);
    }
    
    element.dataset.eventListenerAdded = 'true';
    newListenersCount++;
  });
  
  if (newListenersCount > 0) {
  }
}

// Setup events for generated checkboxes with better performance
function setupCheckboxEvents(checkboxContainer) {
  // Handle data-auto-sidebar="true"
  const autoSidebarElements = checkboxContainer.querySelectorAll('[data-auto-sidebar="true"]');
  autoSidebarElements.forEach(element => {
    ['change', 'input'].forEach(eventType => {
      eventManager.add(element, eventType, () => {
        if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
          state.setTimer('sidebarUpdate', () => toggleSidebar('Left', true), 50);
        }
      });
    });
  });
  
  // Handle fs-cmsfilter-element filters
  const filterElements = checkboxContainer.querySelectorAll('[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select');
  filterElements.forEach(element => {
    eventManager.add(element, 'change', () => state.setTimer('filterUpdate', handleFilterUpdate, 50));
  });
  
  // Handle activate-filter-indicator functionality
  const indicatorActivators = checkboxContainer.querySelectorAll('[activate-filter-indicator]');
  indicatorActivators.forEach(activator => {
    const groupName = activator.getAttribute('activate-filter-indicator');
    if (!groupName) return;
    
    // Function to toggle indicators for this group
    const toggleIndicators = (shouldShow) => {
      const indicators = $(`[filter-indicator="${groupName}"]`);
      indicators.forEach(indicator => {
        indicator.style.display = shouldShow ? 'flex' : 'none';
      });
    };
    
    // Function to check if any activator in this group is active
    const hasActiveFilters = () => {
      const groupActivators = $(`[activate-filter-indicator="${groupName}"]`);
      return groupActivators.some(el => {
        if (el.type === 'checkbox' || el.type === 'radio') {
          return el.checked;
        } else if (el.tagName.toLowerCase() === 'select') {
          return el.selectedIndex > 0;
        } else {
          return el.value.trim() !== '';
        }
      });
    };
    
    // Add change event listener for checkboxes
    if (activator.type === 'checkbox' || activator.type === 'radio') {
      eventManager.add(activator, 'change', () => {
        const shouldShow = hasActiveFilters();
        toggleIndicators(shouldShow);
      });
    }
  });
}

// SIMPLIFIED: Only use hiddentagparent method for filtering detection
const checkAndToggleFilteredElements = () => {
  // Check for hiddentagparent (Finsweet official filtering indicator)
  const hiddenTagParent = document.getElementById('hiddentagparent');
  const shouldShow = !!hiddenTagParent;
  
  toggleShowWhenFilteredElements(shouldShow);
  return shouldShow;
};

// Enhanced tag monitoring with proper cleanup and no recursion
const monitorTags = (() => {
  let isSetup = false; // Flag to prevent multiple setups
  let pollingTimer = null; // Store polling timer for cleanup
  
  return () => {
    // Prevent multiple setups
    if (isSetup) {
      return;
    }
    
    // Initial check
    checkAndToggleFilteredElements();
    
    // Don't use cached query for tagparent
    const tagParent = document.getElementById('tagparent');
    if (tagParent) {
      // Clean up existing observer if it exists
      if (tagParent._mutationObserver) {
        tagParent._mutationObserver.disconnect();
      }
      
      const observer = new MutationObserver(() => {
        // Immediate check when DOM changes
        checkAndToggleFilteredElements();
      });
      observer.observe(tagParent, {childList: true, subtree: true});
      
      // Store observer for cleanup
      tagParent._mutationObserver = observer;
    }
    
    // Additional monitoring: Watch for checkbox changes
    const allCheckboxes = document.querySelectorAll('[checkbox-filter] input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
      if (!checkbox.dataset.filteredElementListener) {
        eventManager.add(checkbox, 'change', () => {
          IdleExecution.scheduleUI(checkAndToggleFilteredElements);
        });
        checkbox.dataset.filteredElementListener = 'true';
      }
    });
    
    // Additional monitoring: Watch for form changes that might indicate filtering
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      if (!form.dataset.filteredElementListener) {
        eventManager.add(form, 'change', () => {
          IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 100 });
        });
        eventManager.add(form, 'input', () => {
          IdleExecution.scheduleUI(checkAndToggleFilteredElements, { fallbackDelay: 100 });
        });
        form.dataset.filteredElementListener = 'true';
      }
    });
    
    // Fallback polling that doesn't recursively call monitorTags
    const startPolling = () => {
      if (pollingTimer) {
        clearTimeout(pollingTimer);
      }
      
      pollingTimer = setTimeout(() => {
        checkAndToggleFilteredElements(); // Just check, don't setup again
        startPolling(); // Continue polling
      }, 1000);
    };
    
    // Start the polling
    startPolling();
    
    // Mark as setup
    isSetup = true;
    
    // Cleanup function (can be called to reset)
    const cleanup = () => {
      if (pollingTimer) {
        clearTimeout(pollingTimer);
        pollingTimer = null;
      }
      
      const tagParent = document.getElementById('tagparent');
      if (tagParent && tagParent._mutationObserver) {
        tagParent._mutationObserver.disconnect();
        tagParent._mutationObserver = null;
      }
      
      isSetup = false;
    };
    
    // Store cleanup function for external access
    window.cleanupTagMonitoring = cleanup;
  };
})();

// Smart initialization with deferred marker loading
function init() {
  // Core initialization - NO marker loading on initial page load
  setupEvents();
  
  // Only load overlays and regions initially (lightweight)
  setupZoomBasedMarkerLoading();
  
  // Layer optimization
  state.setTimer('initialLayerOrder', () => mapLayers.optimizeLayerOrder(), 100);
  
  const handleMapEvents = () => {
    state.clearTimer('mapEventHandler');
    state.setTimer('mapEventHandler', () => {
      // Map events handled by optimized layer management
    }, 10);
  };
  
  map.on('moveend', handleMapEvents);
  map.on('zoomend', handleMapEvents);
  
  // Setup zoom-based marker loading
  setupZoomBasedMarkerLoading();
  
  // Staggered setup with smart timing
  [300, 800].forEach(delay => 
    state.setTimer(`dropdownSetup-${delay}`, setupDropdownListeners, delay)
  );
  
  state.flags.mapInitialized = true;
  
  // Mark loading step complete
  loadingTracker.markComplete('mapInitialized');
  
  // Initial filtering check
  state.setTimer('initialFiltering', () => {
    if (state.flags.isInitialLoad) {
      const hasFiltering = checkMapMarkersFiltering();
      if (hasFiltering) {
        applyFilterToMarkers();
      }
      state.flags.isInitialLoad = false;
    }
    
    // Always check filtered elements on initial load
    checkAndToggleFilteredElements();
  }, 300);
}

// Zoom-based marker loading implementation
function setupZoomBasedMarkerLoading() {
  // Mobile users get markers at lower zoom level for better experience
  const MARKER_ZOOM_THRESHOLD = window.innerWidth <= APP_CONFIG.breakpoints.mobile ? 9 : 10;
  let markersLoaded = false;
  
  async function checkZoomAndLoadMarkers() {
    const currentZoom = map.getZoom();
    
    if (currentZoom >= MARKER_ZOOM_THRESHOLD && !markersLoaded) {
      // Load markers only when zoomed in enough
      markersLoaded = true;
      
      // Load settlement data if not already loaded
      await loadSettlementsIfNeeded('zoom-threshold');
      
      // Layers now use opacity interpolation for smooth fade in/out
      // No need to toggle visibility - opacity handles the transition
    } else if (currentZoom < MARKER_ZOOM_THRESHOLD) {
      // Reset flag so data can be loaded again when zooming back in
      markersLoaded = false;
    }
  }
  
  // Listen to zoom events
  map.on('zoom', checkZoomAndLoadMarkers);
  map.on('zoomend', checkZoomAndLoadMarkers);
  
  // Initial check when map is ready
  if (map.isStyleLoaded()) {
    checkZoomAndLoadMarkers();
  } else {
    map.on('style.load', checkZoomAndLoadMarkers);
  }
}

// Initialize territory data immediately (no loading required)
function initializeTerritoryData() {
  // Territory data is static and should always be available
  state.allTerritoryFeatures = [
    {
      type: "Feature",
      properties: {
        name: "Gaza",
        type: "territory"
      },
      geometry: {
        type: "Point",
        coordinates: [34.3950, 31.4458]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "West Bank",
        type: "territory"
      },
      geometry: {
        type: "Point",
        coordinates: [35.3050, 32.2873]
      }
    }
  ];
}

// Settlement loading helper - can be called from zoom or autocomplete interaction
async function loadSettlementsIfNeeded(trigger = 'unknown') {
  // Only load if not already loaded
  if (!state.allSettlementFeatures || state.allSettlementFeatures.length === 0) {
    try {
      await loadSettlementsFromCache();
      EventBus.emit('data:settlement-loaded', { trigger });
    } catch (error) {
      console.warn(`Error loading settlement data (${trigger}):`, error);
      EventBus.emit('data:settlement-error', { error, trigger });
    }
  }
}


// DOM ready handlers
document.addEventListener('DOMContentLoaded', () => {
  setupSidebars();
  setupBackToTopButton();
  
  // Enhanced tag monitoring initialization (moved inside DOMContentLoaded)
  state.setTimer('initMonitorTags', () => {
    monitorTags();
    
    // Monitoring initialized
  }, 100);
  
  // Early UI readiness checks
  state.setTimer('earlyUICheck', () => {
    // Check UI elements early
  }, 2000);
});

window.addEventListener('load', () => {
  setupSidebars();
  setupBackToTopButton();
  
  state.setTimer('loadFallbackInit', () => {
    if (!state.allLocalityFeatures.length && map.loaded()) {
      try { 
        init(); 
      } catch (error) { 
        // Silent error handling in production
      }
    }
  }, 100);
  
  // Auto-trigger reframing with smart logic
  const checkAndReframe = () => {
    if (map.loaded() && !map.isMoving() && checkMapMarkersFiltering()) {
      state.flags.forceFilteredReframe = true;
      state.flags.isRefreshButtonAction = true;
      applyFilterToMarkers();
      state.setTimer('autoReframeCleanup', () => {
        state.flags.forceFilteredReframe = false;
        state.flags.isRefreshButtonAction = false;
      }, 1000);
      
      // Also check filtered elements when reframing
      checkAndToggleFilteredElements();
      return true;
    }
    return false;
  };
  
  if (!checkAndReframe()) {
    state.setTimer('reframeCheck1', () => {
      if (!checkAndReframe()) {
        state.setTimer('reframeCheck2', checkAndReframe, 1000);
      }
    }, 500);
  }
  
  // Additional check after page is fully loaded
  state.setTimer('loadCheckFiltered', checkAndToggleFilteredElements, 200);
});

// ========================
// GLOBAL EXPORTS & UTILITIES
// ========================

// Defer global exports until after everything is initialized
function setupGlobalExports() {
  // MODULAR ARCHITECTURE - Clean Public API
  window.MapboxCore = {
    // ========================
    // CORE MODULES
    // ========================
    cache: {
      dom: domCache,
      sidebar: sidebarCache,
      lightweight: lightweightCache
    },
    
    events: eventManager,
    
    state: state,
    
    storage: SafeStorage,
    
    utilities: {
      idle: IdleExecution,
      errors: ErrorHandler,
      utils: utils
    },
    
    // ========================
    // CHECKBOX MANAGEMENT
    // ========================
    checkboxes: {
      state: LazyCheckboxState,
      select: {
        region: selectRegionCheckbox,
        subregion: selectSubregionCheckbox,
        territory: selectTerritoryCheckbox,
        locality: selectLocalityCheckbox,
        settlement: selectSettlementCheckbox
      },
      generate: {
        all: generateAllCheckboxes,
        single: generateSingleCheckbox
      }
    },
    
    // ========================
    // UI OPERATIONS
    // ========================
    ui: {
      sidebar: {
        toggle: toggleSidebar,
        close: closeSidebar
      },
      elements: {
        check: checkAndToggleFilteredElements,
        toggleFiltered: toggleShowWhenFilteredElements
      }
    },
    
    // ========================
    // MAP INTEGRATION
    // ========================
    map: {
      instance: map,
      layers: mapLayers,
      operations: {
        applyFilter: applyFilterToMarkers,
        highlightBoundary: highlightBoundary,
        frameRegionBoundary: frameRegionBoundary
      }
    },
    
    // ========================
    // DEBUGGING & DEVELOPMENT
    // ========================
    debug: {
      worker: lazyWorker,
      config: APP_CONFIG
    },
    
    // ========================
    // METADATA
    // ========================
    version: '2.1.0',
    build: 'Ultra Performance with Lazy Loading + Sidebar Optimizations',
    features: APP_CONFIG.features
  };
  
  // Legacy global exports for backwards compatibility
  window.selectRegionCheckbox = selectRegionCheckbox;
  window.selectSubregionCheckbox = selectSubregionCheckbox;
  window.selectLocalityCheckbox = selectLocalityCheckbox;
  window.selectSettlementCheckbox = selectSettlementCheckbox;
  window.selectTerritoryCheckbox = selectTerritoryCheckbox;
  window.applyFilterToMarkers = applyFilterToMarkers;
  window.highlightBoundary = highlightBoundary;
  window.highlightTerritoryBoundaries = highlightTerritoryBoundaries;
  window.frameTerritoryBoundaries = frameTerritoryBoundaries;
  window.frameRegionBoundary = frameRegionBoundary;
  window.map = map;
  window.mapboxgl = mapboxgl;
  
  // Legacy mapUtilities for backwards compatibility
  window.mapUtilities = {
    domCache,
    eventManager,
    state,
    utils,
    mapLayers,
    sidebarCache,
    toggleSidebar,
    closeSidebar,
    checkAndToggleFilteredElements,
    toggleShowWhenFilteredElements,
    lightweightCache,
    lazyWorker
  };
}

// Setup global exports during idle time
IdleExecution.scheduleUI(setupGlobalExports, { fallbackDelay: 0 });

// ========================
// CLEANUP
// ========================

// Cleanup on page unload (prevent memory leaks)
window.addEventListener('beforeunload', () => {
  // Clean up all managed resources
  eventManager.cleanup();
  state.cleanup();
  sidebarCache.invalidate();
  
  // Clean up mutation observers
  const tagParent = $id('tagparent');
  if (tagParent && tagParent._mutationObserver) {
    tagParent._mutationObserver.disconnect();
  }
  
  // Clean up back to top tag observer  
  if (tagParent && tagParent._tagObserver) {
    tagParent._tagObserver.disconnect();
  }
  
  // Clean up map resources
  if (map) {
    map.remove();
  }
});// ========================
// LAZY LOADED HIGH-PERFORMANCE AUTOCOMPLETE
// ========================

(function() {
    // Track loading state
    let autocompleteLoadState = 'pending'; // 'pending', 'loading', 'loaded'
    let autocompleteInstance = null;
    let loadPromise = null;
    
    // Lightweight stub that handles initial interactions
    class AutocompleteStub {
        constructor() {
            this.setupStubListeners();
            this.setupBlurredClassHandling();
        }
        
        setupBlurredClassHandling() {
            const searchInput = document.getElementById('map-search');
            const searchIconsWrap = document.querySelector('.search-icons-wrap');
            const clearSearchWrap = document.querySelector('.clear-search-wrap');
            
            if (!searchInput) {
                // Use enhanced error handling for DOM retry
                ErrorHandler.retry(() => {
                    const input = document.getElementById('map-search');
                    if (!input) throw new Error('map-search element not found');
                    this.setupBlurredClassHandling();
                }, 3, 100).catch(error => {
                    ErrorHandler.handle(error, ErrorHandler.categories.DOM, {
                        operation: 'setupBlurredClassHandling',
                        element: 'map-search'
                    });
                });
                return;
            }
            
            // Ensure blurred class is applied initially (input not focused)
            if (document.activeElement !== searchInput) {
                if (searchIconsWrap && !searchIconsWrap.classList.contains('blurred')) {
                    searchIconsWrap.classList.add('blurred');
                }
                if (clearSearchWrap && !clearSearchWrap.classList.contains('blurred')) {
                    clearSearchWrap.classList.add('blurred');
                }
            }
            
            // Handle focus - remove blurred classes
            searchInput.addEventListener('focus', () => {
                if (searchIconsWrap && searchIconsWrap.classList.contains('blurred')) {
                    searchIconsWrap.classList.remove('blurred');
                }
                if (clearSearchWrap && clearSearchWrap.classList.contains('blurred')) {
                    clearSearchWrap.classList.remove('blurred');
                }
            });
            
            // Handle blur - add blurred classes back
            searchInput.addEventListener('blur', () => {
                if (searchIconsWrap && !searchIconsWrap.classList.contains('blurred')) {
                    searchIconsWrap.classList.add('blurred');
                }
                if (clearSearchWrap && !clearSearchWrap.classList.contains('blurred')) {
                    clearSearchWrap.classList.add('blurred');
                }
            });
        }
        
        setupStubListeners() {
            const searchInput = document.getElementById('map-search');
            if (!searchInput) {
                // Retry if element not found
                setTimeout(() => this.setupStubListeners(), 100);
                return;
            }
            
            // Track if user has interacted
            let hasInteracted = false;
            
            // Load on first focus
            const handleFirstFocus = () => {
                if (!hasInteracted) {
                    hasInteracted = true;
                    searchInput.removeEventListener('focus', handleFirstFocus);
                    searchInput.removeEventListener('mouseenter', handleFirstMouseEnter);
                    loadAutocomplete('user-interaction');
                    // Also load settlement data for autocomplete functionality
                    loadSettlementsIfNeeded('autocomplete-focus');
                }
            };
            
            // Preload on hover (gives us a head start)
            const handleFirstMouseEnter = () => {
                if (!hasInteracted && autocompleteLoadState === 'pending') {
                    hasInteracted = true;
                    searchInput.removeEventListener('mouseenter', handleFirstMouseEnter);
                    searchInput.removeEventListener('focus', handleFirstFocus);
                    loadAutocomplete('user-hover');
                    // Also load settlement data for autocomplete functionality
                    loadSettlementsIfNeeded('autocomplete-hover');
                }
            };
            
            // Add lightweight listeners
            searchInput.addEventListener('focus', handleFirstFocus, { once: true });
            searchInput.addEventListener('mouseenter', handleFirstMouseEnter, { once: true });
            
            // Also prevent form submission while autocomplete is not loaded
            const form = searchInput.closest('form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    if (autocompleteLoadState !== 'loaded') {
                        e.preventDefault();
                    }
                });
            }
        }
    }
    
    // Function to load the actual autocomplete
    function loadAutocomplete(trigger = 'unknown') {
        // Prevent multiple simultaneous loads
        if (autocompleteLoadState === 'loading' || autocompleteLoadState === 'loaded') {
            return loadPromise;
        }
        
        autocompleteLoadState = 'loading';
        
        // Create a promise for the loading process
        loadPromise = new Promise((resolve) => {
            // Use requestIdleCallback if available, otherwise setTimeout
            const loadFunction = () => {
                try {
                    // Initialize the actual autocomplete
                    initializeFullAutocomplete();
                    autocompleteLoadState = 'loaded';
                    resolve();
                } catch (error) {
                    // console.error('Failed to load autocomplete:', error);
                    autocompleteLoadState = 'pending'; // Reset to allow retry
                    resolve(); // Resolve anyway to prevent blocking
                }
            };
            
            // Load autocomplete during idle time for better performance
            IdleExecution.schedule(loadFunction, { timeout: 1000, fallbackDelay: 10 });
        });
        
        return loadPromise;
    }
    
    // The actual autocomplete implementation (wrapped in a function)
    function initializeFullAutocomplete() {
        // ========================
        // FULL AUTOCOMPLETE CLASS
        // ========================
        
        class HighPerformanceAutocomplete {
            constructor(options = {}) {
                // Configuration
                this.config = {
                    inputId: options.inputId || "map-search",
                    wrapperId: options.wrapperId || "searchTermsWrapper",
                    clearId: options.clearId || "searchclear",
                    virtualScroll: false,
                    itemHeight: options.itemHeight || 45,
                    visibleItems: options.visibleItems || 8,
                    fuzzySearch: options.fuzzySearch !== false,
                    maxResults: options.maxResults || 200,
                    debounceMs: options.debounceMs || 50,
                    highlightMatches: false,
                    scoreThreshold: options.scoreThreshold || 0.3
                };
                
                // Data storage
                this.data = {
                    regions: [],
                    subregions: [],
                    localities: [],
                    settlements: [],
                    filteredResults: [],
                    selectedIndex: -1
                };
                
                // Click state tracking
                this.isClickingDropdownItem = false;
                
                // Virtual scrolling state
                this.virtualScroll = {
                    scrollTop: 0,
                    startIndex: 0,
                    endIndex: this.config.visibleItems,
                    containerHeight: this.config.itemHeight * this.config.visibleItems
                };
                
                // Performance optimization
                this.cache = new Map();
                this.renderFrame = null;
                this.scrollFrame = null;
                this.filterTimeout = null;
                this.isFirstShow = true;
                
                // Memoize the createSearchTokens function
                this.createSearchTokens = APP_CONFIG.features.enableMemoization ? 
                    Memoize.fn(this._createSearchTokens.bind(this), (text) => text.toLowerCase()) :
                    this._createSearchTokens.bind(this);
                    
                // Initialize recent searches
                this.recentSearches = this.loadRecentSearches();
                
                // Virtual DOM state
                this.virtualDOM = {
                    currentItems: [],
                    renderedCount: 0,
                    headerRendered: false
                };
                
                // Initialize
                this.init();
            }
            
            init() {
                // Cache DOM elements
                this.elements = {
                    input: document.getElementById(this.config.inputId),
                    wrapper: document.getElementById(this.config.wrapperId),
                    clear: document.getElementById(this.config.clearId)
                };
                
                if (!this.elements.input || !this.elements.wrapper) {
                    // console.error('Required elements not found');
                    return;
                }
                
                // Create optimized dropdown structure
                this.setupDropdownStructure();
                
                // Setup event listeners
                this.setupEventListeners();
                
                // Apply initial styles
                this.applyStyles();
                
                // Load data from window state when available
                this.waitForData();
                
            }
            
            setupDropdownStructure() {
                this.elements.wrapper.innerHTML = `
                    <ul id="search-terms" class="autocomplete-list"></ul>
                `;
                
                this.elements.list = this.elements.wrapper.querySelector('.autocomplete-list');
            }
            
  waitForData() {
  // Check if data is already loaded
  const checkData = () => {
    if (window.mapUtilities && window.mapUtilities.state) {
      const state = window.mapUtilities.state;
      // Wait for actual data to be loaded - now regions come from localities
      // Don't load until we have locality data (settlements will come later)
      if (state.allLocalityFeatures && state.allLocalityFeatures.length > 0) {
        this.loadDataFromState();
        // If settlements aren't loaded yet, they'll be added when refresh is called
        return true;
      }
    }
    return false;
  };
  
                // Check immediately
                if (checkData()) return;
                
                // Otherwise wait and retry
                const retryInterval = setInterval(() => {
                    if (checkData()) {
                        clearInterval(retryInterval);
                    }
                }, 500);
                
                // Stop trying after 30 seconds
                setTimeout(() => clearInterval(retryInterval), 30000);
            }
            
loadDataFromState() {
  if (!window.mapUtilities || !window.mapUtilities.state) {
    return;
  }
  const state = window.mapUtilities.state;
  
  // Load regions (districts) - now from extracted data
  if (state.allRegionFeatures && state.allRegionFeatures.length > 0) {
    this.data.regions = state.allRegionFeatures
      .filter(feature => feature.geometry && feature.geometry.coordinates)
      .map(feature => ({
        name: feature.properties.name,
        nameLower: feature.properties.name.toLowerCase(),
        type: 'region',
        territory: feature.properties.territory,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        searchTokens: this.createSearchTokens(feature.properties.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  
  // Load subregions - now from extracted data
  if (state.allSubregionFeatures && state.allSubregionFeatures.length > 0) {
    this.data.subregions = state.allSubregionFeatures
      .filter(feature => feature.geometry && feature.geometry.coordinates)
      .map(feature => ({
        name: feature.properties.name,
        nameLower: feature.properties.name.toLowerCase(),
        type: 'subregion',
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        searchTokens: this.createSearchTokens(feature.properties.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }                
                // Load localities
                if (state.allLocalityFeatures && state.allLocalityFeatures.length > 0) {
                    // Extract unique subregions
                    const subregionSet = new Set();
                    
                    this.data.localities = state.allLocalityFeatures
                        .filter(feature => feature.geometry && feature.geometry.coordinates)
                        .map(feature => {
                            const subregion = feature.properties.subRegion;
                            if (subregion) {
                                subregionSet.add(subregion);
                            }
                            
                            return {
                                name: feature.properties.name,
                                nameLower: feature.properties.name.toLowerCase(),
                                region: feature.properties.region,
                                subregion: subregion,
                                territory: feature.properties.territory,
                                lat: feature.geometry.coordinates[1],
                                lng: feature.geometry.coordinates[0],
                                type: 'locality',
                                searchTokens: this.createSearchTokens(feature.properties.name)
                            };
                        })
                        .sort((a, b) => a.name.localeCompare(b.name));
                    
                    // Create subregions array
                    this.data.subregions = Array.from(subregionSet)
                        .filter(subregion => subregion) // Filter out null/undefined
                        .map(subregion => {
                            // Find a locality with this subregion to get the territory
                            const localityWithSubregion = this.data.localities.find(loc => loc.subregion === subregion);
                            return {
                                name: subregion,
                                nameLower: subregion.toLowerCase(),
                                type: 'subregion',
                                territory: localityWithSubregion ? localityWithSubregion.territory : null,
                                searchTokens: this.createSearchTokens(subregion)
                            };
                        })
                        .sort((a, b) => a.name.localeCompare(b.name));
                }
                
                // Load settlements
                if (state.allSettlementFeatures && state.allSettlementFeatures.length > 0) {
                    this.data.settlements = state.allSettlementFeatures
                        .filter(feature => feature.geometry && feature.geometry.coordinates)
                        .map(feature => ({
                            name: feature.properties.name,
                            nameLower: feature.properties.name.toLowerCase(),
                            type: 'settlement',
                            region: feature.properties.region,
                            subRegion: feature.properties.subRegion,
                            territory: feature.properties.territory,
                            lat: feature.geometry.coordinates[1],
                            lng: feature.geometry.coordinates[0],
                            searchTokens: this.createSearchTokens(feature.properties.name)
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                }
                
                // Load territories
                if (state.allTerritoryFeatures && state.allTerritoryFeatures.length > 0) {
                    this.data.territories = state.allTerritoryFeatures
                        .filter(feature => feature.geometry && feature.geometry.coordinates)
                        .map(feature => ({
                            name: feature.properties.name,
                            nameLower: feature.properties.name.toLowerCase(),
                            type: 'territory',
                            lat: feature.geometry.coordinates[1],
                            lng: feature.geometry.coordinates[0],
                            searchTokens: this.createSearchTokens(feature.properties.name)
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                }
                
                // Shuffle each category once for variety in dropdown display
                this.shuffleArray(this.data.regions);
                this.shuffleArray(this.data.subregions);
                this.shuffleArray(this.data.localities);
                this.shuffleArray(this.data.settlements);
                if (this.data.territories) {
                    this.shuffleArray(this.data.territories);
                }
                
                
                // If we have data, trigger a refresh of the current search
                if (this.elements.input && this.elements.input.value) {
                    this.handleInput(this.elements.input.value);
                }
            }
            
            _createSearchTokens(text) {
                const tokens = text.toLowerCase().split(/\s+/);
                const ngrams = [];
                
                for (let n = 2; n <= 3; n++) {
                    for (let i = 0; i <= text.length - n; i++) {
                        ngrams.push(text.toLowerCase().substr(i, n));
                    }
                }
                
                return { tokens, ngrams };
            }
            
            // Recent searches functionality
            loadRecentSearches() {
                if (!APP_CONFIG.features.enableRecentSearches) return [];
                try {
                    const searches = SafeStorage.getItem('recentSearches');
                    return searches ? JSON.parse(searches) : [];
                } catch (e) {
                    return [];
                }
            }
            
            saveRecentSearch(searchTerm, selectedItem) {
                if (!APP_CONFIG.features.enableRecentSearches || !searchTerm.trim()) return;
                
                const search = {
                    term: searchTerm.trim(),
                    name: selectedItem.name,
                    type: selectedItem.type,
                    timestamp: Date.now()
                };
                
                // Remove if already exists
                this.recentSearches = this.recentSearches.filter(s => s.name !== search.name);
                
                // Add to beginning
                this.recentSearches.unshift(search);
                
                // Limit size
                this.recentSearches = this.recentSearches.slice(0, APP_CONFIG.cache.maxRecentSearches);
                
                // Save to storage
                SafeStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
            }
            
            removeRecentSearch(index) {
                if (!APP_CONFIG.features.enableRecentSearches) return;
                this.recentSearches.splice(index, 1);
                SafeStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
                
                // Refresh dropdown if open
                if (this.isDropdownVisible() && !this.elements.input.value.trim()) {
                    this.showAllItems();
                    this.renderResults();
                }
            }
            
            shuffleArray(array) {
                // Fisher-Yates shuffle algorithm
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            }
            
            setupEventListeners() {
                let inputTimeout;
                
                // Input handling
                this.elements.input.addEventListener('input', (e) => {
                    clearTimeout(inputTimeout);
                    inputTimeout = setTimeout(() => this.handleInput(e.target.value), this.config.debounceMs);
                });
                
                // Focus/blur handling
                this.elements.input.addEventListener('focus', () => this.handleFocus());
                this.elements.input.addEventListener('blur', () => this.handleBlur());
                
                // Keyboard navigation
                this.elements.input.addEventListener('keydown', (e) => this.handleKeydown(e));
                
                // Prevent blur only when clicking on dropdown items (not the whole wrapper)
                this.elements.wrapper.addEventListener('mousedown', (e) => {
                    // Only prevent default if clicking on an actual dropdown item
                    // This allows normal blur behavior when clicking elsewhere
                    if (e.target.closest('.list-term')) {
                        this.isClickingDropdownItem = true;
                        e.preventDefault();
                    }
                });
                
                // Reset flag on mouseup
                this.elements.wrapper.addEventListener('mouseup', () => {
                    this.isClickingDropdownItem = false;
                });
                
                // Click handling
                this.elements.wrapper.addEventListener('click', (e) => this.handleItemClick(e));
                
                // Clear button
                if (this.elements.clear) {
                    this.elements.clear.addEventListener('mousedown', (e) => e.preventDefault());
                    this.elements.clear.addEventListener('click', () => this.handleClear());
                }
                
                // Prevent form submission
                const form = this.elements.input.closest('form');
                if (form) {
                    form.addEventListener('submit', (e) => e.preventDefault());
                }
            }
            
            handleInput(searchText) {
                if (!searchText || searchText.length === 0) {
                    this.showAllItems();
                } else {
                    this.performSearch(searchText);
                }
                
                this.renderResults();
                this.showDropdown();
            }
            
            showAllItems() {
                // Always reload data from state to get latest
                this.loadDataFromState();
                
                const results = [];
                
                // Add recent searches first if enabled and available
                if (APP_CONFIG.features.enableRecentSearches && this.recentSearches.length > 0) {
                    const recentItems = this.recentSearches.slice(0, 5).map(search => ({
                        ...search,
                        isRecent: true,
                        display: `${search.name} (${search.type})`,
                        score: 1 // High score to appear first
                    }));
                    results.push(...recentItems);
                }
                
                // Make sure we have data before showing items
                if (this.data.regions.length === 0 && 
                    this.data.localities.length === 0 && 
                    this.data.settlements.length === 0) {
                    this.data.filteredResults = results;
                    return;
                }
                
                // Hierarchical display: Regions → Subregions → Localities → Settlements
                // (Territories excluded from default view - only appear in search)
                // results array already initialized with recent searches
                
                // 1. Show top 2-3 regions (most important geographic areas)
                const maxRegions = Math.min(3, this.data.regions.length);
                const selectedRegions = this.data.regions.slice(0, maxRegions);
                results.push(...selectedRegions);
                
                // 2. Show top 2-3 subregions (subdivisions of regions)
                const maxSubregions = Math.min(3, this.data.subregions.length);
                const selectedSubregions = this.data.subregions.slice(0, maxSubregions);
                results.push(...selectedSubregions);
                
                // 3. Show 4-5 major localities (important cities/towns)
                const maxLocalities = Math.min(5, this.data.localities.length);
                const selectedLocalities = this.data.localities.slice(0, maxLocalities);
                results.push(...selectedLocalities);
                
                // 4. Show 2-3 settlements (smaller communities)
                const maxSettlements = Math.min(3, this.data.settlements.length);
                const selectedSettlements = this.data.settlements.slice(0, maxSettlements);
                results.push(...selectedSettlements);
                
                
                this.data.filteredResults = results;
            }
            
            performSearch(searchText) {
                const startTime = performance.now();
                const searchLower = searchText.toLowerCase();
                const searchTokens = searchText.toLowerCase().split(/\s+/);
                
                const scoredResults = [];
                
                // Search all categories including settlements and territories
                const allItems = [
                    ...this.data.regions, 
                    ...this.data.subregions, 
                    ...this.data.localities, 
                    ...this.data.settlements,
                    ...(this.data.territories || [])
                ];
                allItems.forEach(item => {
                    const score = this.calculateMatchScore(searchLower, searchTokens, item);
                    if (score > this.config.scoreThreshold) {
                        scoredResults.push({ ...item, score });
                    }
                });
                
                // Sort by score and type
                scoredResults.sort((a, b) => {
                    if (Math.abs(b.score - a.score) > 0.1) {
                        return b.score - a.score;
                    }
                    if (a.type !== 'locality' && a.type !== 'settlement' && (b.type === 'locality' || b.type === 'settlement')) return -1;
                    if ((a.type === 'locality' || a.type === 'settlement') && b.type !== 'locality' && b.type !== 'settlement') return 1;
                    return a.name.localeCompare(b.name);
                });
                
                // Limit regions/subregions to 3 total
                let regionCount = 0;
                const limitedResults = [];
                
                for (const result of scoredResults) {
                    if (result.type === 'region' || result.type === 'subregion') {
                        if (regionCount < 3) {
                            limitedResults.push(result);
                            regionCount++;
                        }
                    } else {
                        limitedResults.push(result);
                    }
                    
                    if (limitedResults.length >= this.config.maxResults) break;
                }
                
                this.data.filteredResults = limitedResults;
                
            }
            
            calculateMatchScore(searchLower, searchTokens, item) {
                let score = 0;
                
                if (item.nameLower === searchLower) {
                    return 1.0;
                }
                
                if (item.nameLower.startsWith(searchLower)) {
                    score = 0.9;
                } else if (item.nameLower.includes(searchLower)) {
                    score = 0.7;
                }
                
                if (searchTokens.length > 1) {
                    const matchedTokens = searchTokens.filter(token => 
                        item.searchTokens.tokens.some(itemToken => itemToken.includes(token))
                    );
                    score = Math.max(score, matchedTokens.length / searchTokens.length * 0.8);
                }
                
                if (this.config.fuzzySearch && score < 0.5) {
                    const searchNgrams = new Set();
                    for (let i = 0; i <= searchLower.length - 2; i++) {
                        searchNgrams.add(searchLower.substr(i, 2));
                    }
                    
                    let matches = 0;
                    searchNgrams.forEach(ngram => {
                        if (item.searchTokens.ngrams.includes(ngram)) matches++;
                    });
                    
                    const fuzzyScore = matches / Math.max(searchNgrams.size, 1) * 0.6;
                    score = Math.max(score, fuzzyScore);
                }
                
                return score;
            }
            
            renderResults() {
                // Safety check - ensure we're properly initialized
                if (!this.elements || !this.elements.list) {
                    // console.warn('Autocomplete not properly initialized, skipping render');
                    return;
                }
                
                if (this.renderFrame) {
                    cancelAnimationFrame(this.renderFrame);
                }
                
                this.renderFrame = requestAnimationFrame(() => {
                    try {
                        this.renderWithVirtualDOM();
                    } catch (error) {
                        // console.error('Error in renderWithVirtualDOM:', error);
                        // Fallback to simple render
                        this.fallbackRender();
                    }
                    this.renderFrame = null;
                });
            }
            
            renderWithVirtualDOM() {
                // Ensure virtualDOM is initialized
                if (!this.virtualDOM) {
                    this.virtualDOM = {
                        currentItems: [],
                        renderedCount: 0,
                        headerRendered: false
                    };
                }
                
                const newItems = this.data.filteredResults || [];
                const oldItems = this.virtualDOM.currentItems || [];
                
                // Check if we need a full re-render or can do incremental updates
                const needsFullRender = this.shouldFullRender(newItems, oldItems);
                
                if (needsFullRender) {
                    this.fullRender(newItems);
                } else {
                    this.incrementalRender(newItems, oldItems);
                }
                
                // Update virtual DOM state
                this.virtualDOM.currentItems = [...newItems];
                this.virtualDOM.renderedCount = newItems.length;
            }
            
            shouldFullRender(newItems, oldItems) {
                // Full render if:
                // 1. Different lengths
                // 2. First render
                // 3. Items are in different order
                if (newItems.length !== oldItems.length || oldItems.length === 0) {
                    return true;
                }
                
                // Check if items have changed order or content
                for (let i = 0; i < Math.min(newItems.length, oldItems.length); i++) {
                    if (newItems[i].name !== oldItems[i].name || 
                        newItems[i].type !== oldItems[i].type ||
                        newItems[i].isRecent !== oldItems[i].isRecent) {
                        return true;
                    }
                }
                
                return false;
            }
            
            fullRender(items) {
                // Ensure elements exist
                if (!this.elements || !this.elements.list) {
                    // console.warn('Autocomplete elements not initialized yet');
                    return;
                }
                
                this.elements.list.innerHTML = '';
                
                // Ensure virtualDOM is initialized
                if (!this.virtualDOM) {
                    this.virtualDOM = {
                        currentItems: [],
                        renderedCount: 0,
                        headerRendered: false
                    };
                }
                
                this.virtualDOM.headerRendered = false;
                
                if (items.length === 0) {
                    const noResults = document.createElement('li');
                    noResults.className = 'no-results';
                    noResults.textContent = 'No results found';
                    this.elements.list.appendChild(noResults);
                    return;
                }
                
                const fragment = document.createDocumentFragment();
                
                // Recent searches header removed per user request
                
                items.forEach((item, index) => {
                    const itemElement = this.createItemElement(item, index);
                    
                    // Add recent search indicator
                    if (item.isRecent) {
                        const link = itemElement.querySelector('.list-term');
                        if (link) {
                            link.dataset.isRecent = 'true';
                            link.dataset.recentIndex = this.recentSearches.findIndex(r => r.name === item.name);
                            link.classList.add('recent-search');
                            
                            // Add custom remove button element
                            const removeBtn = document.createElement('a');
                            removeBtn.className = 'clear-search w-inline-block';
                            removeBtn.href = '#';
                            removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m6.94 6 4.06-4.06c.26-.26.26-.68 0-.94-.26-.26-.68-.26-.94 0L6 5.06 1.94 1c-.26-.26-.68-.26-.94 0-.26.26-.26.68 0 .94L5.06 6 1 10.06c-.26.26-.26.68 0 .94.13.13.3.2.47.2s.34-.07.47-.2L6 6.94l4.06 4.06c.13.13.3.2.47.2s.34-.07.47-.2c.26-.26.26-.68 0-.94L6.94 6z" fill="currentColor"></path></svg>`;
                            removeBtn.title = 'Remove from recent searches (Ctrl+Click or Ctrl+Delete)';
                            removeBtn.onclick = (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const recentIndex = parseInt(link.dataset.recentIndex);
                                this.removeRecentSearch(recentIndex);
                            };
                            link.appendChild(removeBtn);
                        }
                    }
                    
                    fragment.appendChild(itemElement);
                });
                
                this.elements.list.appendChild(fragment);
            }
            
            incrementalRender(newItems, oldItems) {
                // For now, use full render for simplicity
                // Future optimization: implement true incremental updates
                this.fullRender(newItems);
            }
            
            fallbackRender() {
                // Simple fallback rendering without virtual DOM
                if (!this.elements || !this.elements.list) return;
                
                const items = this.data.filteredResults || [];
                
                if (items.length === 0) {
                    this.elements.list.innerHTML = '<li class="no-results">No results found</li>';
                    return;
                }
                
                const fragment = document.createDocumentFragment();
                items.forEach((item, index) => {
                    const itemElement = this.createItemElement(item, index);
                    fragment.appendChild(itemElement);
                });
                
                this.elements.list.innerHTML = '';
                this.elements.list.appendChild(fragment);
            }
            
            createItemElement(item, index) {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = '#';
                a.className = `list-term ${item.type}-term ${index === this.data.selectedIndex ? 'active' : ''}`;
                a.dataset.index = index;
                a.dataset.type = item.type;
                a.dataset.term = item.name;
                
                // Add coordinates for localities and settlements
                if ((item.type === 'locality' || item.type === 'settlement') && item.lat && item.lng) {
                    a.dataset.lat = item.lat;
                    a.dataset.lng = item.lng;
                }
                
                if (item.type === 'territory') {
                    a.innerHTML = `
                        <div class="locality-info">
                            <span style="color: #2d1810;">${item.name}</span>
                        </div>
                        <span class="term-label">Territory</span>
                    `;
                } else if (item.type === 'locality' || item.type === 'settlement') {
                    let location = '';
                    if (item.type === 'locality') {
                        location = [item.subregion, item.region, item.territory].filter(Boolean).join(', ');
                    } else if (item.type === 'settlement') {
                        location = [item.subRegion, item.region, item.territory].filter(Boolean).join(', ');
                    }
                    const typeLabel = item.type === 'locality' ? 'Locality' : 'Settlement';
                    
                    a.innerHTML = `
                        <div class="locality-info">
                            <div class="locality-name">${item.name}</div>
                            ${location ? `<div class="locality-region">${location}</div>` : ''}
                        </div>
                        <span class="term-label">${typeLabel}</span>
                    `;
                } else {
                    const typeLabel = item.type === 'region' ? 'Governorate' : 'Region';
                    if (item.territory) {
                        a.innerHTML = `
                            <div class="locality-info">
                                <span style="color: #6e3500;">${item.name}</span>
                                <div class="locality-region">${item.territory}</div>
                            </div>
                            <span class="term-label">${typeLabel}</span>
                        `;
                    } else {
                        a.innerHTML = `
                            <div class="locality-info">
                                <div class="locality-name">${item.name}</div>
                            </div>
                            <span class="term-label">${typeLabel}</span>`;
                    }
                }
                
                li.appendChild(a);
                return li;
            }
            
            handleKeydown(e) {
                if (!this.isDropdownVisible()) return;
                
                const visibleItems = this.getDropdownItems();
                let currentActive = this.elements.list.querySelector('.list-term.active');
                let activeIndex = currentActive ? parseInt(currentActive.dataset.index) : -1;
                const totalItems = this.data.filteredResults.length;
                
                switch(e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        // Circular navigation - go from last to first
                        activeIndex = activeIndex < totalItems - 1 ? activeIndex + 1 : 0;
                        this.setActiveItem(visibleItems, activeIndex);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        // Circular navigation - go from first to last
                        activeIndex = activeIndex > 0 ? activeIndex - 1 : totalItems - 1;
                        this.setActiveItem(visibleItems, activeIndex);
                        break;
                    case 'Home':
                        e.preventDefault();
                        this.setActiveItem(visibleItems, 0);
                        break;
                    case 'End':
                        e.preventDefault();
                        this.setActiveItem(visibleItems, totalItems - 1);
                        break;
                    case 'Enter':
                        e.preventDefault();
                        if (currentActive) {
                            this.handleItemSelection(currentActive, e);
                        }
                        break;
                    case 'Delete':
                    case 'Backspace':
                        // Delete recent searches with Ctrl+Delete/Backspace
                        if (e.ctrlKey && currentActive && currentActive.dataset.isRecent === 'true') {
                            e.preventDefault();
                            const index = parseInt(currentActive.dataset.recentIndex);
                            this.removeRecentSearch(index);
                        }
                        break;
                    case 'Escape':
                        this.hideDropdown();
                        this.elements.input.blur();
                        break;
                }
            }
            
            getDropdownItems() {
                return Array.from(this.elements.list.querySelectorAll('.list-term'));
            }
            
            setActiveItem(items, index) {
                // Remove active class from all items
                items.forEach(item => item.classList.remove('active'));
                
                // Find and activate the target item
                const activeItem = items.find(item => parseInt(item.dataset.index) === index);
                if (activeItem) {
                    activeItem.classList.add('active');
                    
                    // Enhanced smooth scrolling
                    activeItem.scrollIntoView({ 
                        block: 'nearest', 
                        behavior: 'smooth',
                        inline: 'nearest'
                    });
                    
                    // Update aria attributes for accessibility
                    const itemId = activeItem.id || `autocomplete-item-${index}`;
                    activeItem.id = itemId;
                    this.elements.input.setAttribute('aria-activedescendant', itemId);
                }
                
                this.data.selectedIndex = index;
            }
            
            handleItemSelection(itemElement, event) {
                if (window.isMarkerClick) return;
                
                const term = itemElement.getAttribute('data-term');
                const type = itemElement.getAttribute('data-type');
                const isRecent = itemElement.dataset.isRecent === 'true';
                const lat = itemElement.dataset.lat ? parseFloat(itemElement.dataset.lat) : null;
                const lng = itemElement.dataset.lng ? parseFloat(itemElement.dataset.lng) : null;
                
                // Handle recent search removal with Ctrl+Click
                if (isRecent && event.ctrlKey) {
                    event.preventDefault();
                    const recentIndex = parseInt(itemElement.dataset.recentIndex);
                    this.removeRecentSearch(recentIndex);
                    return;
                }
                
                // Generate checkbox for selected item (lazy loading)
                if (APP_CONFIG.features.enableLazyCheckboxes && term && (type === 'locality' || type === 'settlement')) {
                    generateSingleCheckbox(term, type);
                }
                
                this.selectTerm(term, type, { 
                    isRecent,
                    searchTerm: this.elements.input.value,
                    lat: lat,
                    lng: lng
                });
            }
            
            handleItemClick(e) {
                e.preventDefault();
                const termElement = e.target.closest('.list-term');
                if (!termElement) return;
                
                this.handleItemSelection(termElement, e);
                
                // Reset flag after handling click
                this.isClickingDropdownItem = false;
            }
            
            selectTerm(term, type, options = {}) {
                if (window.isMarkerClick) return;
                
                this.elements.input.value = term;
                this.hideDropdown();
                this.elements.input.blur();
                
                // Always save recent search (except when selecting from recent searches)
                if (!options.isRecent) {
                    const selectedItem = this.data.filteredResults.find(item => 
                        item.name === term && item.type === type
                    );
                    if (selectedItem) {
                        // Use the input value as the search term (could be empty for default dropdown)
                        const searchTerm = options.searchTerm || this.elements.input.value || '';
                        this.saveRecentSearch(searchTerm, selectedItem);
                    }
                }
                
                // Save the search term for analytics if needed
                if (window.analytics && window.analytics.track) {
                    window.analytics.track('Autocomplete Selection', {
                        term: term,
                        type: type,
                        isRecent: options.isRecent || false
                    });
                }
                
                if (type === 'region') {
                    this.triggerRegionSelection(term);
                } else if (type === 'subregion') {
                    this.triggerSubregionSelection(term);
                } else if (type === 'locality') {
                    this.triggerLocalitySelection(term, options.lat, options.lng);
                } else if (type === 'settlement') {
                    this.triggerSettlementSelection(term, options.lat, options.lng);
                } else if (type === 'territory') {
                    this.triggerTerritorySelection(term);
                }
            }
            
            triggerSettlementSelection(settlementName, lat, lng) {
                // Set marker click flag
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                // Use checkbox selection for settlements
                if (window.selectSettlementCheckbox) {
                    window.selectSettlementCheckbox(settlementName);
                }
                
                if (window.mapUtilities?.toggleShowWhenFilteredElements) {
                    window.mapUtilities.toggleShowWhenFilteredElements(true);
                }
                
                if (window.innerWidth > APP_CONFIG.breakpoints.mobile && window.mapUtilities?.toggleSidebar) {
                    window.mapUtilities.toggleSidebar('Left', true);
                }
                
                // Fly to settlement using passed coordinates or find by name as fallback
                if (window.map && lat && lng) {
                    // Use passed coordinates directly (handles duplicates)
                    window.map.flyTo({
                        center: [lng, lat],
                        zoom: 13.5,
                        duration: 1000,
                        essential: true
                    });
                } else if (window.map) {
                    // Fallback to finding by name (for backward compatibility)
                    const settlement = this.data.settlements.find(s => s.name === settlementName);
                    if (settlement && settlement.lat && settlement.lng) {
                        window.map.flyTo({
                            center: [settlement.lng, settlement.lat],
                            zoom: 13.5,
                            duration: 1000,
                            essential: true
                        });
                    }
                }
                
                // Clean up flag
                setTimeout(() => {
                    window.isMarkerClick = false;
                }, 800);
            }
            
            triggerTerritorySelection(territoryName) {
                // Set marker click flag
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                // Use checkbox selection for territories
                if (window.selectTerritoryCheckbox) {
                    window.selectTerritoryCheckbox(territoryName);
                }
                
                if (window.mapUtilities?.toggleShowWhenFilteredElements) {
                    window.mapUtilities.toggleShowWhenFilteredElements(true);
                }
                
                if (window.innerWidth > APP_CONFIG.breakpoints.mobile && window.mapUtilities?.toggleSidebar) {
                    window.mapUtilities.toggleSidebar('Left', true);
                }
                
                // Highlight and frame territory boundaries
                if (window.highlightTerritoryBoundaries) {
                    window.highlightTerritoryBoundaries(territoryName);
                }
                if (window.frameTerritoryBoundaries) {
                    window.frameTerritoryBoundaries(territoryName);
                }
                
                // Clean up flag
                setTimeout(() => {
                    window.isMarkerClick = false;
                }, 800);
            }
            
            triggerRegionSelection(regionName) {
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                if (window.selectRegionCheckbox) {
                    window.selectRegionCheckbox(regionName);
                }
                
                if (window.mapUtilities?.toggleShowWhenFilteredElements) {
                    window.mapUtilities.toggleShowWhenFilteredElements(true);
                }
                
                if (window.innerWidth > APP_CONFIG.breakpoints.mobile && window.mapUtilities?.toggleSidebar) {
                    window.mapUtilities.toggleSidebar('Left', true);
                }
                
                // Highlight and frame region boundary
                if (window.highlightBoundary) {
                    window.highlightBoundary(regionName);
                }
                
                // Use the global function to frame region boundaries
                if (window.frameRegionBoundary) {
                    if (!window.frameRegionBoundary(regionName)) {
                        // No boundary found - fallback to filtered reframing
                        setTimeout(() => {
                            if (window.mapUtilities && window.mapUtilities.state) {
                                const state = window.mapUtilities.state;
                                state.flags.forceFilteredReframe = true;
                                state.flags.isRefreshButtonAction = true;
                                
                                if (window.applyFilterToMarkers) {
                                    window.applyFilterToMarkers();
                                    
                                    setTimeout(() => {
                                        state.flags.forceFilteredReframe = false;
                                        state.flags.isRefreshButtonAction = false;
                                    }, 1000);
                                }
                            }
                        }, 200);
                    }
                } else {
                    // Fallback if frameRegionBoundary doesn't exist
                    setTimeout(() => {
                        window.isMarkerClick = false;
                        if (window.applyFilterToMarkers) {
                            window.applyFilterToMarkers();
                        }
                    }, 100);
                }
                
                setTimeout(() => {
                    window.isMarkerClick = false;
                }, 800);
            }
            
            triggerSubregionSelection(subregionName) {
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                // Use checkbox selection like regions do
                if (window.selectSubregionCheckbox) {
                    window.selectSubregionCheckbox(subregionName);
                }
                
                if (window.mapUtilities?.toggleShowWhenFilteredElements) {
                    window.mapUtilities.toggleShowWhenFilteredElements(true);
                }
                
                if (window.innerWidth > APP_CONFIG.breakpoints.mobile && window.mapUtilities?.toggleSidebar) {
                    window.mapUtilities.toggleSidebar('Left', true);
                }
                
                // Trigger filtering with reframe for subregions - increased delay to ensure checkbox update
                setTimeout(() => {
                    if (window.mapUtilities && window.mapUtilities.state) {
                        const state = window.mapUtilities.state;
                        state.flags.forceFilteredReframe = true;
                        state.flags.isRefreshButtonAction = true;
                        
                        if (window.applyFilterToMarkers) {
                            window.applyFilterToMarkers();
                            
                            setTimeout(() => {
                                state.flags.forceFilteredReframe = false;
                                state.flags.isRefreshButtonAction = false;
                            }, 1000);
                        }
                    }
                }, 400);
                
                setTimeout(() => {
                    window.isMarkerClick = false;
                }, 800);
            }
            
            triggerLocalitySelection(localityName, lat, lng) {
                window.isMarkerClick = true;
                
                if (window.mapUtilities && window.mapUtilities.state) {
                    window.mapUtilities.state.markerInteractionLock = false;
                }
                
                if (window.selectLocalityCheckbox) {
                    window.selectLocalityCheckbox(localityName);
                }
                
                if (window.mapUtilities?.toggleShowWhenFilteredElements) {
                    window.mapUtilities.toggleShowWhenFilteredElements(true);
                }
                
                if (window.innerWidth > APP_CONFIG.breakpoints.mobile && window.mapUtilities?.toggleSidebar) {
                    window.mapUtilities.toggleSidebar('Left', true);
                }
                
                // Fly to locality using passed coordinates or find by name as fallback
                if (window.map && lat && lng) {
                    // Use passed coordinates directly (handles duplicates)
                    window.map.flyTo({
                        center: [lng, lat],
                        zoom: 13.5,
                        duration: 1000,
                        essential: true
                    });
                } else if (window.map) {
                    // Fallback to finding by name (for backward compatibility)
                    const locality = this.data.localities.find(l => l.name === localityName);
                    if (locality && locality.lat && locality.lng) {
                        window.map.flyTo({
                            center: [locality.lng, locality.lat],
                            zoom: 13.5,
                            duration: 1000,
                            essential: true
                        });
                    }
                }
                
                setTimeout(() => {
                    window.isMarkerClick = false;
                }, 800);
            }
            
            handleFocus() {
                // Blurred classes are already handled by the stub
                // Just handle autocomplete-specific functionality
                
                if (this.elements.input.value.length === 0) {
                    this.showAllItems();
                    this.renderResults();
                }
                
                this.showDropdown();
            }
            
            handleBlur() {
                // Blurred classes are already handled by the stub
                // Check if we're currently clicking on a dropdown item
                if (this.isClickingDropdownItem) {
                    return; // Don't hide dropdown if clicking on item
                }
                // Hide dropdown immediately
                this.hideDropdown();
            }
            
            handleClear() {
                if (this.elements.input.value) {
                    this.elements.input.value = '';
                    this.hideDropdown();
                    
                    // Only refocus on desktop or if not on iOS Safari
                    // iOS Safari has issues with programmatic focus after UI interactions
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const isMobileSafari = isIOS && /WebKit/.test(navigator.userAgent) && !/CriOS/.test(navigator.userAgent);
                    
                    if (!isMobileSafari) {
                        this.elements.input.focus();
                    }
                    
                    this.showAllItems();
                    this.renderResults();
                    this.showDropdown();
                }
            }
            
            showDropdown() {
                if (this.data.filteredResults.length === 0) {
                    this.hideDropdown();
                    return;
                }
                
                this.updatePosition();
                
                if (this.isFirstShow) {
                    this.elements.wrapper.style.visibility = 'hidden';
                    this.elements.wrapper.style.display = 'block';
                    this.elements.wrapper.offsetHeight;
                    this.updatePosition();
                    this.elements.wrapper.style.visibility = 'visible';
                    this.isFirstShow = false;
                } else {
                    this.elements.wrapper.style.display = 'block';
                }
            }
            
            hideDropdown() {
                this.elements.wrapper.style.display = 'none';
                this.elements.list.querySelectorAll('.list-term.active')
                    .forEach(item => item.classList.remove('active'));
                this.data.selectedIndex = -1;
            }
            
            isDropdownVisible() {
                return this.elements.wrapper.style.display === 'block';
            }
            
            updatePosition() {
                const inputRect = this.elements.input.getBoundingClientRect();
                const width = inputRect.width;
                
                Object.assign(this.elements.wrapper.style, {
                    position: 'fixed',
                    top: `${inputRect.bottom + 4}px`,
                    left: `${inputRect.left}px`,
                    width: `${width}px`,
                    maxHeight: `${this.config.itemHeight * this.config.visibleItems}px`,
                    overflowY: 'auto',
                    zIndex: '999999'
                });
            }
            
            applyStyles() {
                this.elements.input.setAttribute('autocomplete', 'off');
                this.elements.input.setAttribute('spellcheck', 'false');
                
                this.elements.wrapper.style.display = 'none';
                this.elements.wrapper.style.visibility = 'visible';
                
                // Load external CSS file instead of massive inline styles
                if (!document.getElementById('mapbox-integrated-styles')) {
                    const link = document.createElement('link');
                    link.id = 'mapbox-integrated-styles';
                    link.rel = 'stylesheet';
                    link.href = 'mapbox-integrated-styles.css';
                    document.head.appendChild(link);
                }
            }
            
            refresh() {
                // Clear any cached results to force fresh data
                this.cache.clear();
                this.data.filteredResults = [];
                
                // Clear memoization cache for fresh data
                if (APP_CONFIG.features.enableMemoization) {
                    Memoize.clear();
                }
                
                // Reload data from state
                this.loadDataFromState();
                
                // Force update the dropdown if it's visible OR if input is focused
                if (this.isDropdownVisible() || document.activeElement === this.elements.input) {
                    if (this.elements.input.value) {
                        // Re-run search with current value
                        this.handleInput(this.elements.input.value);
                    } else {
                        // Show all items with new data including recent searches
                        this.showAllItems();
                        this.renderResults();
                        if (this.data.filteredResults.length > 0) {
                            this.showDropdown();
                        }
                    }
                }
            }
            
            destroy() {
                try {
                    clearTimeout(this.filterTimeout);
                    cancelAnimationFrame(this.renderFrame);
                    cancelAnimationFrame(this.scrollFrame);
                    
                    if (this.elements.list) {
                        this.elements.list.innerHTML = '';
                    }
                    if (this.elements.wrapper) {
                        this.elements.wrapper.style.display = 'none';
                    }
                } catch (error) {
                    // Silently handle cleanup errors
                }
            }
            
            getStats() {
                return {
                    totalItems: this.data.regions.length + this.data.subregions.length + this.data.localities.length + this.data.settlements.length,
                    regions: this.data.regions.length,
                    subregions: this.data.subregions.length,
                    localities: this.data.localities.length,
                    settlements: this.data.settlements.length,
                    filteredResults: this.data.filteredResults.length,
                    cacheSize: this.cache.size
                };
            }
        }
        
        // Clean up old instances
        if (window.integratedAutocomplete) {
            window.integratedAutocomplete.destroy();
            window.integratedAutocomplete = null;
        }
        
        if (window.hpAutocomplete) {
            window.hpAutocomplete.destroy();
            window.hpAutocomplete = null;
        }
        
        // Create new instance
        autocompleteInstance = new HighPerformanceAutocomplete({
            inputId: "map-search",
            wrapperId: "searchTermsWrapper",
            clearId: "searchclear"
        });
        
        // Expose global functions
        window.hpAutocomplete = autocompleteInstance;
        
        window.refreshAutocomplete = () => {
            if (autocompleteInstance) {
                autocompleteInstance.refresh();
            }
        };
        
        window.getAutocompleteStats = () => {
            if (autocompleteInstance) {
                return autocompleteInstance.getStats();
            }
        };
    }
    
    // Smart loading strategy
    function setupSmartLoading() {
        // Initialize the stub immediately
        new AutocompleteStub();
        
        // Only load autocomplete when user interacts with search (huge performance win)
        const searchInput = document.getElementById('map-search');
        if (searchInput) {
            const loadOnInteraction = () => {
                if (autocompleteLoadState === 'pending') {
                    loadAutocomplete('user-interaction');
                    // Also load settlement data for autocomplete functionality
                    loadSettlementsIfNeeded('autocomplete-interaction');
                }
            };
            
            // Load on focus, click, or input
            searchInput.addEventListener('focus', loadOnInteraction, { once: true });
            searchInput.addEventListener('click', loadOnInteraction, { once: true });
            searchInput.addEventListener('input', loadOnInteraction, { once: true });
        }
        
        // Optional: Fallback load after 30 seconds for edge cases (uncomment if needed)
        // setTimeout(() => {
        //     if (autocompleteLoadState === 'pending') {
        //         loadAutocomplete('fallback-timeout');
        //     }
        // }, 30000);
    }
    
    // Initialize smart loading
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSmartLoading);
    } else {
        setupSmartLoading();
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (autocompleteInstance) {
            autocompleteInstance.destroy();
        }
    });
})();

// COMBINED MAPBOX SCRIPT - Production Version 2025
// Optimized version without autocomplete loading dependency

// Use feature detection for mobile
const isMobile = FeatureDetection.isMobile;

// Map control styles are now loaded from external CSS file

// Show loading screen at start
const loadingScreen = document.getElementById('loading-map-screen');
if (loadingScreen) {
  loadingScreen.style.display = 'flex';
}

// ENHANCED: Event-driven loading state tracker for better performance
const loadingTracker = {
  requirements: {
    mapReady: false,
    dataLoaded: false,
    initialRenderComplete: false
    // Removed markersRendered and sidebarsReady for faster loading with deferred content
    // These will be handled asynchronously and don't need to block the loading screen
  },
  
  promises: {
    mapReady: null,
    dataLoaded: null,
    initialRenderComplete: null
  },
  
  resolvers: {},
  observers: {},
  
  init() {
    // Create promises for each requirement
    this.promises.mapReady = new Promise(resolve => {
      this.resolvers.mapReady = resolve;
    });
    
    this.promises.dataLoaded = new Promise(resolve => {
      this.resolvers.dataLoaded = resolve;
    });
    
    this.promises.initialRenderComplete = new Promise(resolve => {
      this.resolvers.initialRenderComplete = resolve;
    });
    
    // When all promises resolve, hide loading screen
    Promise.all(Object.values(this.promises)).then(() => {
      this.hideLoadingScreen();
    });
    
    // Fallback timer - shortened for optimized loading
    setTimeout(() => {
      this.forceComplete();
    }, 8000);  // 8 second max wait
  },
  
  setupSidebarObserver() {
    // Watch for sidebar content to be added
    const checkSidebars = () => {
      const leftSidebar = document.getElementById('LeftSidebar');
      const hasCheckboxes = document.querySelectorAll('[checkbox-filter] input').length > 0;
      
      if (leftSidebar && leftSidebar.offsetHeight > 0 && hasCheckboxes) {
        this.markComplete('sidebarsReady');
        if (this.observers.sidebar) {
          this.observers.sidebar.disconnect();
        }
        return true;
      }
      return false;
    };
    
    // Check immediately
    if (!checkSidebars()) {
      // If not ready, setup observer
      this.observers.sidebar = new MutationObserver(() => {
        checkSidebars();
      });
      
      // Observe the document body for added nodes
      this.observers.sidebar.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  },
  
  markComplete(requirement) {
    if (this.requirements.hasOwnProperty(requirement) && !this.requirements[requirement]) {
      this.requirements[requirement] = true;
      
      // Resolve the corresponding promise
      if (this.resolvers[requirement]) {
        this.resolvers[requirement]();
      }
    }
  },
  
  // Called when map fires 'idle' event
  onMapIdle() {
    // Mark initial render complete when map is idle
    if (!this.requirements.initialRenderComplete) {
      // Small timeout to ensure paint has happened
      requestAnimationFrame(() => {
        this.markComplete('initialRenderComplete');
      });
    }
  },
  
  checkMarkersRendered() {
    if (!map || !map.loaded()) return false;
    
    // With deferred loading optimization, only check for initially loaded layers
    // Settlement layers are deferred until zoom/search, so don't require them for initial load
    const initialMarkerLayers = ['locality-clusters', 'locality-points'];
    const initialLayersExist = initialMarkerLayers.some(layerId => {
      return map.getLayer(layerId);
    });
    
    // If initial locality layers exist, consider markers rendered for initial load
    // Settlement layers will be added later when needed
    if (initialLayersExist) {
      return true;
    }
    
    // Also check if region layers exist (these load immediately)
    const regionLayers = ['region-points', 'subregion-points'];
    const regionLayersExist = regionLayers.some(layerId => {
      return map.getLayer(layerId);
    });
    
    if (regionLayersExist) {
      return true;
    }
    
    // Fallback: return false if no layers exist yet
    return false;
  },
  
  forceComplete() {
    // Force resolve any pending requirements
    Object.keys(this.requirements).forEach(req => {
      if (!this.requirements[req]) {
        this.markComplete(req);
      }
    });
  },
  
  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-map-screen');
    if (loadingScreen && loadingScreen.style.display !== 'none') {
      loadingScreen.style.display = 'none';
    }
    
    // Clean up observers
    Object.values(this.observers).forEach(observer => {
      if (observer && observer.disconnect) {
        observer.disconnect();
      }
    });
  }
};

// Initialize the loading tracker
loadingTracker.init();

// Lightweight cache manager with localStorage metadata
class LightweightCache {
  constructor() {
    this.prefix = 'mapCache_';
    this.metaPrefix = 'mapMeta_';
  }

  // Simple cache check using localStorage for metadata
  isDataFresh(url, maxAgeMinutes = APP_CONFIG.cache.duration) {
    try {
      const metaKey = this.metaPrefix + this.hashUrl(url);
      const metadata = JSON.parse(SafeStorage.getItem(metaKey) || 'null');
      if (!metadata) return false;
      
      const age = (Date.now() - metadata.timestamp) / (1000 * 60);
      return age < maxAgeMinutes;
    } catch (error) {
      return false;
    }
  }

  // Get cached processed data
  get(storeName) {
    try {
      const key = this.prefix + storeName;
      const cached = JSON.parse(SafeStorage.getItem(key) || 'null');
      return cached;
    } catch (error) {
      // Silently fail and return null for corrupted cache
      return null;
    }
  }

  // Store processed data
  set(storeName, data, url) {
    try {
      const key = this.prefix + storeName;
      const metaKey = this.metaPrefix + this.hashUrl(url);
      
      SafeStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      
      SafeStorage.setItem(metaKey, JSON.stringify({
        timestamp: Date.now(),
        size: JSON.stringify(data).length
      }));
      
      return true;
    } catch (error) {
      // Storage quota exceeded - clear old data
      this.clear();
      return false;
    }
  }

  clear() {
    if (!SafeStorage.available) return;
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix) || key.startsWith(this.metaPrefix)) {
        SafeStorage.removeItem(key);
      }
    });
  }

  // Simple URL hash for storage keys
  hashUrl(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }
}

// Lazy-loaded cache instance - only created when needed
let lightweightCache = null;

// Lazy worker manager - only creates worker when needed
class LazyWorkerManager {
  constructor() {
    this.worker = null;
    this.pendingTasks = new Map();
    this.taskId = 0;
  }

  // Only process in worker if dealing with large datasets (>100 features)
  async processData(type, data) {
    const featureCount = data.features?.length || 0;
    
    // Use main thread for small datasets
    if (featureCount < 100) {
      return this.processSync(type, data);
    }

    // Use worker for large datasets
    return this.processInWorker(type, data);
  }

  // Synchronous processing for small datasets (faster for small data)
  processSync(type, data) {
    switch(type) {
      case 'processLocalities':
        return this.processLocalitiesSync(data);
      case 'processSettlements':
        return this.processSettlementsSync(data);
      default:
        throw new Error('Unknown type: ' + type);
    }
  }

  processLocalitiesSync(localityData) {
    const localities = localityData.features
      .filter(f => f.geometry?.coordinates && f.properties?.name)
      .map(feature => ({
        name: feature.properties.name,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        region: feature.properties.region || '',
        subregion: feature.properties.subregion || ''
      }));

    return Promise.resolve({
      localities,
      features: localityData.features
    });
  }

  processSettlementsSync(settlementData) {
    const settlements = settlementData.features
      .filter(f => f.geometry?.coordinates && f.properties?.name)
      .map(feature => ({
        name: feature.properties.name,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0]
      }));

    return Promise.resolve({
      settlements,
      features: settlementData.features
    });
  }

  // Worker creation only when needed for large datasets
  async processInWorker(type, data) {
    if (!this.worker) {
      this.createWorker();
    }

    if (!this.worker) {
      // Fallback to sync if worker creation failed
      return this.processSync(type, data);
    }

    const taskId = ++this.taskId;
    
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { resolve, reject });
      
      this.worker.postMessage({ taskId, type, data });
      
      setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          this.pendingTasks.delete(taskId);
          reject(new Error('Worker timeout'));
        }
      }, 15000);
    });
  }

  createWorker() {
    try {
      // Minimal worker code - only for large datasets
      const workerCode = `
        self.onmessage = function(e) {
          const { taskId, type, data } = e.data;
          try {
            let result = type === 'processLocalities' ? 
              processLocalities(data) : processSettlements(data);
            self.postMessage({ taskId, success: true, result });
          } catch (error) {
            self.postMessage({ taskId, success: false, error: error.message });
          }
        };

        function processLocalities(data) {
          const localities = data.features
            .filter(f => f.geometry?.coordinates && f.properties?.name)
            .map(f => ({
              name: f.properties.name,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
              region: f.properties.region || '',
              subregion: f.properties.subregion || ''
            }));
          return { localities, features: data.features };
        }

        function processSettlements(data) {
          const settlements = data.features
            .filter(f => f.geometry?.coordinates && f.properties?.name)
            .map(f => ({
              name: f.properties.name,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0]
            }));
          return { settlements, features: data.features };
        }
      `;

      this.worker = new Worker(URL.createObjectURL(
        new Blob([workerCode], { type: 'application/javascript' })
      ));
      
      this.worker.onmessage = (e) => {
        const { taskId, success, result, error } = e.data;
        const task = this.pendingTasks.get(taskId);
        if (task) {
          this.pendingTasks.delete(taskId);
          task[success ? 'resolve' : 'reject'](success ? result : new Error(error));
        }
      };
    } catch (error) {
      this.worker = null;
    }
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingTasks.clear();
  }
}

// Lazy-loaded worker - only created when needed
let lazyWorker = null;

// Conditional data loader - only uses cache for return visits
async function loadDataWithOptionalCache(url, storeName, processingType) {
  // Initialize cache and worker only when needed
  if (!lightweightCache) {
    lightweightCache = new LightweightCache();
  }
  
  // Quick cache check (synchronous with localStorage)
  const isFresh = APP_CONFIG.features.enableCache && lightweightCache.isDataFresh(url);
  
  if (isFresh) {
    const cached = lightweightCache.get(storeName);
    if (cached?.data) {
      // Ensure we return the correct structure
      if (cached.data.features && Array.isArray(cached.data.features)) {
        return cached.data; // Instant return from cache
      }
      // Invalid cache structure, fall through to fetch fresh
    }
  }

  // Fetch fresh data
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();
    
    // Process data (use worker only for large datasets)
    if (!lazyWorker) {
      lazyWorker = new LazyWorkerManager();
    }
    
    const processedData = await lazyWorker.processData(processingType, rawData);
    
    // Cache result for next visit (fire and forget)
    setTimeout(() => {
      lightweightCache.set(storeName, processedData, url);
    }, 0);

    return processedData;
    
  } catch (error) {
    // Try stale cache as last resort
    const staleCache = lightweightCache?.get(storeName);
    if (staleCache?.data && staleCache.data.features) {
      return staleCache.data;
    }
    // Re-throw to let caller handle the error
    throw error;
  }
}

// Simple loading functions that conditionally use caching
const loadLocalitiesWithCache = () => loadDataWithOptionalCache(
  getOptimalUrl('localities'),
  'localities',
  'processLocalities'
);

const loadSettlementsWithCache = () => loadDataWithOptionalCache(
  getOptimalUrl('settlements'), 
  'settlements',
  'processSettlements'
);

// Comprehensive DOM Element Cache
class OptimizedDOMCache {
  constructor() {
    this.cache = new Map();
    this.selectorCache = new Map();
    this.listCache = new Map();
    this._isStale = false;
  }
  
  // Single element getters with caching
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
  
  // Multiple element getters with smart caching (avoid caching dynamic selectors)
  $(selector) {
    // Don't cache checkbox states or dynamic content
    const isDynamicSelector = selector.includes(':checked') || 
                             selector.includes(':selected') || 
                             selector.includes(':focus') ||
                             selector.includes(':hover') ||
                             selector.includes(':active');
    
    if (isDynamicSelector || !this.listCache.has(selector)) {
      const elements = Array.from(document.querySelectorAll(selector));
      if (!isDynamicSelector) {
        this.listCache.set(selector, elements);
      }
      return elements;
    }
    return this.listCache.get(selector);
  }
  
  // Clear cache when DOM changes significantly
  invalidate() {
    this.cache.clear();
    this.selectorCache.clear(); 
    this.listCache.clear();
    this._isStale = false;
  }
  
  // Partial invalidation for specific elements
  invalidateElement(id) {
    this.cache.delete(id);
  }
  
  // Smart cache refresh (only refresh elements that might have changed)
  refresh() {
    if (this._isStale) {
      this.invalidate();
    }
  }
  
  markStale() {
    this._isStale = true;
  }
}

// Bounds calculation utility with caching
class BoundsCalculator {
  constructor() {
    this.boundsCache = new Map();
  }
  
  // Create bounds from coordinates with caching
  fromCoordinates(coordinates, cacheKey = null) {
    if (cacheKey && this.boundsCache.has(cacheKey)) {
      return this.boundsCache.get(cacheKey);
    }
    
    const bounds = new mapboxgl.LngLatBounds();
    coordinates.forEach(coord => bounds.extend(coord));
    
    if (cacheKey) {
      this.boundsCache.set(cacheKey, bounds);
    }
    
    return bounds;
  }
  
  // Create bounds from GeoJSON coordinates with recursive handling
  fromGeoJSON(geoJsonCoords, cacheKey = null) {
    if (cacheKey && this.boundsCache.has(cacheKey)) {
      return this.boundsCache.get(cacheKey);
    }
    
    const bounds = new mapboxgl.LngLatBounds();
    const addCoords = coords => {
      if (Array.isArray(coords) && coords.length > 0) {
        if (typeof coords[0] === 'number') bounds.extend(coords);
        else coords.forEach(addCoords);
      }
    };
    
    addCoords(geoJsonCoords);
    
    if (cacheKey) {
      this.boundsCache.set(cacheKey, bounds);
    }
    
    return bounds;
  }
  
  clearCache() {
    this.boundsCache.clear();
  }
}

// Parallel data loader with caching and error handling
class DataLoader {
  constructor() {
    this.cache = new Map();
    this.loadingPromises = new Map();
  }
  
  // Parallel fetch with caching and compression support
  async fetchGeoJSON(url, cacheKey = null) {
    const key = cacheKey || url;
    
    // Return cached data if available
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Return existing promise if already loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }
    
    // Create new loading promise
    const promise = fetch(url, {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      this.cache.set(key, data);
      this.loadingPromises.delete(key);
      return data;
    })
    .catch(error => {
      this.loadingPromises.delete(key);
      // console.error(`Failed to load ${url}:`, error);
      throw error;
    });
    
    this.loadingPromises.set(key, promise);
    return promise;
  }
  
  // Load all GeoJSON data in parallel
  async loadAllData() {
    const urls = {
      localities: getOptimalUrl('localities'),
      settlements: getOptimalUrl('settlements')
    };
    
    try {
      // Start all fetches in parallel
      const promises = Object.entries(urls).map(async ([key, url]) => {
        const data = await this.fetchGeoJSON(url, key);
        return { key, data };
      });
      
      // Wait for all to complete
      const results = await Promise.all(promises);
      
      // Return organized data
      const organizedData = {};
      results.forEach(({ key, data }) => {
        organizedData[key] = data;
      });
      
      return organizedData;
    } catch (error) {
      // console.error('Failed to load data:', error);
      throw error;
    }
  }
  
  clearCache() {
    this.cache.clear();
  }
}

// Debounced source update utility
class SourceUpdateManager {
  constructor() {
    this.pendingUpdates = new Map();
    this.updateTimers = new Map();
  }
  
  // Debounced source data update
  updateSource(sourceId, data, delay = 100) {
    // Store the latest data for this source
    this.pendingUpdates.set(sourceId, data);
    
    // Clear existing timer for this source
    if (this.updateTimers.has(sourceId)) {
      clearTimeout(this.updateTimers.get(sourceId));
    }
    
    // Set new debounced update
    const timer = setTimeout(() => {
      const source = map.getSource(sourceId);
      if (source && this.pendingUpdates.has(sourceId)) {
        source.setData(this.pendingUpdates.get(sourceId));
        this.pendingUpdates.delete(sourceId);
        this.updateTimers.delete(sourceId);
      }
    }, delay);
    
    this.updateTimers.set(sourceId, timer);
  }
  
  // Immediate source update (bypass debouncing)
  updateSourceImmediate(sourceId, data) {
    // Clear any pending update
    if (this.updateTimers.has(sourceId)) {
      clearTimeout(this.updateTimers.get(sourceId));
      this.updateTimers.delete(sourceId);
    }
    this.pendingUpdates.delete(sourceId);
    
    const source = map.getSource(sourceId);
    if (source) {
      source.setData(data);
    }
  }
}

// Normalized data store to eliminate redundancy
class DataStore {
  constructor() {
    this.entities = {
      regions: new Map(),
      subregions: new Map(), 
      localities: new Map(),
      settlements: new Map()
    };
    
    this.indexes = {
      byRegion: new Map(),
      bySubregion: new Map(),
      coordinates: new Map(),
      searchIndex: new Map()
    };
    
    this.geoJsonCache = {
      localities: null,
      settlements: null,
      regions: null,
      subregions: null
    };
  }
  
  // Add entities with automatic indexing
  addEntity(type, id, data) {
    this.entities[type].set(id, data);
    
    // Build indexes
    if (data.region) {
      if (!this.indexes.byRegion.has(data.region)) {
        this.indexes.byRegion.set(data.region, new Set());
      }
      this.indexes.byRegion.get(data.region).add(id);
    }
    
    if (data.subRegion) {
      if (!this.indexes.bySubregion.has(data.subRegion)) {
        this.indexes.bySubregion.set(data.subRegion, new Set());
      }
      this.indexes.bySubregion.get(data.subRegion).add(id);
    }
    
    if (data.coordinates) {
      this.indexes.coordinates.set(id, data.coordinates);
    }
    
    // Build search index
    const searchTerms = [data.name, data.region, data.subRegion].filter(Boolean);
    searchTerms.forEach(term => {
      const normalized = term.toLowerCase();
      if (!this.indexes.searchIndex.has(normalized)) {
        this.indexes.searchIndex.set(normalized, new Set());
      }
      this.indexes.searchIndex.get(normalized).add(id);
    });
  }
  
  // Get entities with efficient filtering
  getEntities(type, filter = null) {
    if (!filter) {
      return Array.from(this.entities[type].values());
    }
    
    if (filter.region) {
      const ids = this.indexes.byRegion.get(filter.region) || new Set();
      return Array.from(ids).map(id => this.entities[type].get(id)).filter(Boolean);
    }
    
    if (filter.subregion) {
      const ids = this.indexes.bySubregion.get(filter.subregion) || new Set();
      return Array.from(ids).map(id => this.entities[type].get(id)).filter(Boolean);
    }
    
    return Array.from(this.entities[type].values());
  }
  
  // Get cached GeoJSON or generate on demand
  getGeoJSON(type, filter = null) {
    const cacheKey = `${type}-${JSON.stringify(filter)}`;
    
    if (this.geoJsonCache[cacheKey]) {
      return this.geoJsonCache[cacheKey];
    }
    
    const entities = this.getEntities(type, filter);
    const features = entities.map(entity => ({
      type: 'Feature',
      properties: { ...entity },
      geometry: {
        type: 'Point',
        coordinates: entity.coordinates
      }
    }));
    
    const geoJson = {
      type: 'FeatureCollection',
      features
    };
    
    this.geoJsonCache[cacheKey] = geoJson;
    return geoJson;
  }
  
  // Fast search with indexed lookup
  search(query, type = null) {
    const normalized = query.toLowerCase();
    const results = new Set();
    
    // Exact match
    if (this.indexes.searchIndex.has(normalized)) {
      this.indexes.searchIndex.get(normalized).forEach(id => results.add(id));
    }
    
    // Partial matches
    for (const [term, ids] of this.indexes.searchIndex.entries()) {
      if (term.includes(normalized) || normalized.includes(term)) {
        ids.forEach(id => results.add(id));
      }
    }
    
    // Convert IDs to entities
    const entities = [];
    results.forEach(id => {
      for (const [entityType, entityMap] of Object.entries(this.entities)) {
        if (!type || entityType === type) {
          const entity = entityMap.get(id);
          if (entity) {
            entities.push({ ...entity, type: entityType });
          }
        }
      }
    });
    
    return entities;
  }
  
  clearCache() {
    this.geoJsonCache = {};
  }
}

// Advanced search index using Trie for fast autocomplete
class AdvancedSearchIndex {
  constructor() {
    this.trie = {};
    this.fuzzyIndex = new Map();
    this.scoreCache = new Map();
  }
  
  // Add term to trie structure
  addToTrie(term, entityId, entityType) {
    const normalized = term.toLowerCase().trim();
    let current = this.trie;
    
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (!current[char]) {
        current[char] = { entities: new Set(), children: {} };
      }
      current[char].entities.add({ id: entityId, type: entityType, term: normalized });
      current = current[char].children;
    }
    
    // Build fuzzy index for character-level matching
    const chars = [...new Set(normalized.split(''))];
    chars.forEach(char => {
      if (!this.fuzzyIndex.has(char)) {
        this.fuzzyIndex.set(char, new Set());
      }
      this.fuzzyIndex.get(char).add({ id: entityId, type: entityType, term: normalized });
    });
  }
  
  // Fast prefix search using trie
  searchPrefix(query, maxResults = 50) {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];
    
    let current = this.trie;
    
    // Navigate to prefix
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (!current[char]) {
        return [];
      }
      current = current[char];
    }
    
    // Collect all entities under this prefix
    const results = new Set();
    const collectEntities = (node) => {
      if (node.entities) {
        node.entities.forEach(entity => {
          if (results.size < maxResults) {
            results.add(entity);
          }
        });
      }
      
      Object.values(node.children || {}).forEach(child => {
        if (results.size < maxResults) {
          collectEntities(child);
        }
      });
    };
    
    collectEntities(current);
    return Array.from(results);
  }
  
  // Fuzzy search with scoring
  searchFuzzy(query, threshold = 0.3, maxResults = 20) {
    const cacheKey = `${query}-${threshold}-${maxResults}`;
    if (this.scoreCache.has(cacheKey)) {
      return this.scoreCache.get(cacheKey);
    }
    
    const normalized = query.toLowerCase().trim();
    const queryChars = [...new Set(normalized.split(''))];
    const candidates = new Map();
    
    // Find candidates using character overlap
    queryChars.forEach(char => {
      if (this.fuzzyIndex.has(char)) {
        this.fuzzyIndex.get(char).forEach(entity => {
          if (!candidates.has(entity.id)) {
            candidates.set(entity.id, { entity, score: 0 });
          }
          candidates.get(entity.id).score++;
        });
      }
    });
    
    // Calculate similarity scores
    const results = [];
    candidates.forEach(({ entity, score }) => {
      const similarity = this.calculateSimilarity(normalized, entity.term);
      if (similarity >= threshold) {
        results.push({
          ...entity,
          score: similarity,
          charScore: score / queryChars.length
        });
      }
    });
    
    // Sort by combined score
    results.sort((a, b) => {
      const scoreA = a.score * 0.7 + a.charScore * 0.3;
      const scoreB = b.score * 0.7 + b.charScore * 0.3;
      return scoreB - scoreA;
    });
    
    const finalResults = results.slice(0, maxResults);
    this.scoreCache.set(cacheKey, finalResults);
    return finalResults;
  }
  
  // Optimized similarity calculation
  calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    if (str1 === str2) return 1;
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    
    // Simple character-based similarity for performance
    const chars1 = new Set(str1.split(''));
    const chars2 = new Set(str2.split(''));
    const intersection = new Set([...chars1].filter(x => chars2.has(x)));
    
    return intersection.size / Math.max(chars1.size, chars2.size);
  }
  
  // Combined search (prefix + fuzzy)
  search(query, options = {}) {
    const { 
      maxResults = 50, 
      fuzzyThreshold = 0.3,
      prefixWeight = 0.7,
      fuzzyWeight = 0.3
    } = options;
    
    const prefixResults = this.searchPrefix(query, Math.floor(maxResults * prefixWeight));
    const fuzzyResults = this.searchFuzzy(query, fuzzyThreshold, Math.floor(maxResults * fuzzyWeight));
    
    // Combine and deduplicate
    const combined = new Map();
    
    prefixResults.forEach(result => {
      combined.set(result.id, { ...result, matchType: 'prefix' });
    });
    
    fuzzyResults.forEach(result => {
      if (!combined.has(result.id)) {
        combined.set(result.id, { ...result, matchType: 'fuzzy' });
      }
    });
    
    return Array.from(combined.values()).slice(0, maxResults);
  }
  
  clearCache() {
    this.scoreCache.clear();
  }
}

// Web Worker manager for heavy calculations
class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.taskQueue = [];
    this.maxWorkers = navigator.hardwareConcurrency || 4;
    this.activeWorkers = 0;
  }
  
  // Create a worker from function code
  createWorker(name, workerFunction) {
    if (this.workers.has(name)) {
      return this.workers.get(name);
    }
    
    try {
      const blob = new Blob([`(${workerFunction.toString()})()`], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      
      worker.onmessage = (e) => this.handleWorkerMessage(name, e);
      worker.onerror = (e) => this.handleWorkerError(name, e);
      
      this.workers.set(name, {
        worker,
        busy: false,
        tasks: new Map()
      });
      
      URL.revokeObjectURL(workerUrl);
      return this.workers.get(name);
    } catch (error) {
      // console.warn('Web Worker not supported:', error);
      return null;
    }
  }
  
  // Execute task in worker
  async executeInWorker(workerName, taskData, taskId = null) {
    const workerInfo = this.workers.get(workerName);
    if (!workerInfo) {
      // Fallback to main thread
      return this.executeInMainThread(taskData);
    }
    
    const id = taskId || Math.random().toString(36).substr(2, 9);
    
    return new Promise((resolve, reject) => {
      workerInfo.tasks.set(id, { resolve, reject, startTime: Date.now() });
      workerInfo.worker.postMessage({ id, ...taskData });
    });
  }
  
  // Handle worker responses
  handleWorkerMessage(workerName, event) {
    const { id, result, error } = event.data;
    const workerInfo = this.workers.get(workerName);
    
    if (workerInfo?.tasks.has(id)) {
      const { resolve, reject } = workerInfo.tasks.get(id);
      workerInfo.tasks.delete(id);
      
      if (error) {
        reject(new Error(error));
      } else {
        resolve(result);
      }
    }
  }
  
  // Handle worker errors
  handleWorkerError(workerName, error) {
    // console.error(`Worker ${workerName} error:`, error);
    const workerInfo = this.workers.get(workerName);
    
    if (workerInfo) {
      workerInfo.tasks.forEach(({ reject }) => {
        reject(error);
      });
      workerInfo.tasks.clear();
    }
  }
  
  // Fallback for when workers aren't available
  executeInMainThread(taskData) {
    // This would contain the same logic as the worker but run on main thread
    switch (taskData.type) {
      case 'bounds_calculation':
        return this.calculateBounds(taskData.coordinates);
      case 'fuzzy_search':
        return this.performFuzzySearch(taskData.query, taskData.data);
      default:
        return Promise.resolve(null);
    }
  }
  
  // Bounds calculation helper
  calculateBounds(coordinates) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    coordinates.forEach(([lng, lat]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });
    
    return {
      southwest: [minLng, minLat],
      northeast: [maxLng, maxLat]
    };
  }
  
  // Fuzzy search helper
  performFuzzySearch(query, data) {
    // Simple fuzzy search implementation
    const results = data.filter(item => {
      const score = this.calculateSimilarity(query.toLowerCase(), item.name.toLowerCase());
      return score > 0.3;
    });
    
    return results.slice(0, 50);
  }
  
  calculateSimilarity(str1, str2) {
    const chars1 = new Set(str1.split(''));
    const chars2 = new Set(str2.split(''));
    const intersection = new Set([...chars1].filter(x => chars2.has(x)));
    return intersection.size / Math.max(chars1.size, chars2.size);
  }
  
  // Terminate all workers
  terminate() {
    this.workers.forEach(({ worker }) => {
      worker.terminate();
    });
    this.workers.clear();
  }
}

// Enhanced Worker function for multiple heavy calculations
function enhancedMapWorker() {
  self.onmessage = function(e) {
    const { id, type, data } = e.data;
    
    try {
      let result;
      
      switch(type) {
        case 'bounds_calculation':
          result = calculateBounds(data.coordinates);
          break;
          
        case 'search_indexing':
          result = buildSearchIndex(data.items);
          break;
          
        case 'distance_calculation':
          result = calculateDistances(data.points, data.center);
          break;
          
        case 'geojson_processing':
          result = processGeoJSON(data.features);
          break;
          
        case 'cluster_calculation':
          result = calculateClusters(data.points, data.zoom);
          break;
          
        default:
          throw new Error(`Unknown worker type: ${type}`);
      }
      
      self.postMessage({ id, result });
    } catch (error) {
      self.postMessage({ id, error: error.message });
    }
  };
  
  // Bounds calculation helper
  function calculateBounds(coordinates) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    coordinates.forEach(([lng, lat]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });
    
    return {
      southwest: [minLng, minLat],
      northeast: [maxLng, maxLat]
    };
  }
  
  // Search index building helper
  function buildSearchIndex(items) {
    const index = {};
    items.forEach((item, idx) => {
      const terms = item.name.toLowerCase().split(/\s+/);
      terms.forEach(term => {
        if (!index[term]) index[term] = [];
        index[term].push(idx);
      });
    });
    return index;
  }
  
  // Distance calculation helper
  function calculateDistances(points, center) {
    return points.map(point => {
      const distance = haversineDistance(center, point.coordinates);
      return { ...point, distance };
    });
  }
  
  // Haversine distance formula
  function haversineDistance([lng1, lat1], [lng2, lat2]) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  
  // GeoJSON processing helper
  function processGeoJSON(features) {
    return features.map(feature => ({
      id: feature.properties.id || feature.properties.name,
      name: feature.properties.name,
      type: feature.geometry.type,
      coordinates: feature.geometry.coordinates,
      bounds: feature.geometry.type === 'Point' ? 
        null : calculateBounds(flattenCoordinates(feature.geometry.coordinates))
    }));
  }
  
  // Cluster calculation helper
  function calculateClusters(points, zoom) {
    const clusters = [];
    const processed = new Set();
    const radius = 50 / Math.pow(2, zoom); // Adjust radius based on zoom
    
    points.forEach((point, i) => {
      if (processed.has(i)) return;
      
      const cluster = [point];
      processed.add(i);
      
      for (let j = i + 1; j < points.length; j++) {
        if (processed.has(j)) continue;
        
        const distance = haversineDistance(point.coordinates, points[j].coordinates);
        if (distance < radius) {
          cluster.push(points[j]);
          processed.add(j);
        }
      }
      
      if (cluster.length === 1) {
        clusters.push(cluster[0]);
      } else {
        const centerLat = cluster.reduce((sum, p) => sum + p.coordinates[1], 0) / cluster.length;
        const centerLng = cluster.reduce((sum, p) => sum + p.coordinates[0], 0) / cluster.length;
        clusters.push({
          type: 'cluster',
          coordinates: [centerLng, centerLat],
          count: cluster.length,
          items: cluster
        });
      }
    });
    
    return clusters;
  }
  
  // Helper to flatten nested coordinate arrays
  function flattenCoordinates(coords) {
    if (typeof coords[0] === 'number') return [coords];
    return coords.reduce((acc, coord) => {
      return acc.concat(flattenCoordinates(coord));
    }, []);
  }
}

// Progressive loading and lazy initialization manager
class ProgressiveLoader {
  constructor() {
    this.loadingSteps = [];
    this.currentStep = 0;
    this.stepPromises = new Map();
    this.criticalPath = new Set(['map', 'ui', 'search']);
    this.deferredFeatures = new Set(['settlements', 'advanced-search', 'analytics']);
  }
  
  // Define loading pipeline with enhanced prioritization
  defineSteps(steps) {
    this.loadingSteps = steps.map((step, index) => ({
      ...step,
      index,
      loaded: false,
      dependencies: step.dependencies || [],
      priority: this.calculatePriority(step),
      estimatedTime: step.estimatedTime || 1000,
      retryCount: 0,
      maxRetries: step.maxRetries || 3
    }));
    
    // Sort by priority for critical path optimization
    this.loadingSteps.sort((a, b) => b.priority - a.priority);
  }
  
  // Calculate step priority based on criticality and dependencies
  calculatePriority(step) {
    let priority = 0;
    
    // Critical path gets highest priority
    if (this.criticalPath.has(step.name)) {
      priority += 100;
    }
    
    // UI-related steps get higher priority
    if (step.name.includes('ui') || step.name.includes('interface')) {
      priority += 50;
    }
    
    // Steps with fewer dependencies load first
    priority -= (step.dependencies?.length || 0) * 10;
    
    // User-facing features get higher priority
    if (step.userFacing) {
      priority += 30;
    }
    
    return priority;
  }
  
  // Enhanced lazy loading with intersection observer
  setupLazyLoading() {
    if (!('IntersectionObserver' in window)) {
      // console.warn('IntersectionObserver not supported, falling back to immediate loading');
      return this.loadAllSteps();
    }
    
    const lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const stepName = entry.target.getAttribute('data-lazy-step');
          if (stepName) {
            this.loadStep(stepName);
            lazyObserver.unobserve(entry.target);
          }
        }
      });
    }, {
      rootMargin: '50px', // Load 50px before coming into view
      threshold: 0.1
    });
    
    // Observe elements that trigger lazy loading
    document.querySelectorAll('[data-lazy-step]').forEach(el => {
      lazyObserver.observe(el);
    });
    
    return lazyObserver;
  }
  
  // Load steps in chunks to prevent UI blocking
  async loadInChunks(chunkSize = 3) {
    const chunks = [];
    for (let i = 0; i < this.loadingSteps.length; i += chunkSize) {
      chunks.push(this.loadingSteps.slice(i, i + chunkSize));
    }
    
    for (const chunk of chunks) {
      // Load chunk in parallel but wait for completion before next chunk
      await Promise.all(chunk.map(step => this.loadStep(step.name)));
      
      // Small delay to prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  // Load step with dependencies
  async loadStep(stepName, force = false) {
    if (this.stepPromises.has(stepName) && !force) {
      return this.stepPromises.get(stepName);
    }
    
    const step = this.loadingSteps.find(s => s.name === stepName);
    if (!step) {
      throw new Error(`Step ${stepName} not found`);
    }
    
    if (step.loaded && !force) {
      return Promise.resolve();
    }
    
    // Load dependencies first
    const depPromises = step.dependencies.map(dep => this.loadStep(dep));
    await Promise.all(depPromises);
    
    // Create loading promise
    const promise = this.executeStep(step);
    this.stepPromises.set(stepName, promise);
    
    try {
      await promise;
      step.loaded = true;
      this.currentStep = Math.max(this.currentStep, step.index + 1);
      
      // Trigger step completion event
      const event = new CustomEvent('stepLoaded', {
        detail: { stepName, step: step.index + 1, total: this.loadingSteps.length }
      });
      document.dispatchEvent(event);
      
    } catch (error) {
      // console.error(`Failed to load step ${stepName}:`, error);
      throw error;
    }
    
    return promise;
  }
  
  // Execute individual step
  async executeStep(step) {
    const startTime = performance.now();
    
    try {
      if (step.loader) {
        await step.loader();
      }
      
      if (step.initializer) {
        await step.initializer();
      }
      
      const duration = performance.now() - startTime;
      
      // Report performance
      if (window.gtag) {
        gtag('event', 'step_loaded', {
          step_name: step.name,
          duration_ms: Math.round(duration),
          is_critical: this.criticalPath.has(step.name)
        });
      }
      
    } catch (error) {
      throw new Error(`Step ${step.name} failed: ${error.message}`);
    }
  }
  
  // Load critical path first
  async loadCriticalPath() {
    const criticalSteps = this.loadingSteps.filter(step => 
      this.criticalPath.has(step.name)
    ).sort((a, b) => a.index - b.index);
    
    for (const step of criticalSteps) {
      await this.loadStep(step.name);
    }
  }
  
  // Load deferred features in background
  loadDeferredFeatures() {
    const deferredSteps = this.loadingSteps.filter(step => 
      this.deferredFeatures.has(step.name)
    );
    
    // Use requestIdleCallback for non-critical loading
    if ('requestIdleCallback' in window) {
      deferredSteps.forEach((step, index) => {
        requestIdleCallback(() => {
          this.loadStep(step.name).catch(() => {});
        }, { timeout: 5000 + (index * 1000) });
      });
    } else {
      // Fallback with setTimeout
      deferredSteps.forEach((step, index) => {
        setTimeout(() => {
          this.loadStep(step.name).catch(() => {});
        }, 2000 + (index * 1000));
      });
    }
  }
  
  // Get loading progress
  getProgress() {
    const loadedSteps = this.loadingSteps.filter(s => s.loaded).length;
    return {
      current: loadedSteps,
      total: this.loadingSteps.length,
      percentage: (loadedSteps / this.loadingSteps.length) * 100
    };
  }
}

// Performance monitoring and optimization
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = [];
    this.enabled = false;
  }
  
  enable() {
    this.enabled = true;
    this.setupObservers();
  }
  
  setupObservers() {
    // Performance Observer for navigation and resource timing
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => this.recordMetric(entry));
        });
        
        observer.observe({ entryTypes: ['navigation', 'resource', 'measure', 'mark'] });
        this.observers.push(observer);
      } catch (e) {
        // console.warn('PerformanceObserver not fully supported');
      }
    }
    
    // Long Task Observer
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (entry.duration > 50) {
              this.recordLongTask(entry);
            }
          });
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        // Long task observer not supported
      }
    }
  }
  
  recordMetric(entry) {
    if (!this.enabled) return;
    
    const key = `${entry.entryType}_${entry.name}`;
    this.metrics.set(key, {
      ...entry,
      timestamp: Date.now()
    });
    
    // Report critical metrics
    if (entry.entryType === 'navigation') {
      this.reportNavigationTiming(entry);
    }
  }
  
  recordLongTask(entry) {
    // console.warn('Long task detected:', entry.duration + 'ms');
    
    if (window.gtag) {
      gtag('event', 'long_task', {
        duration_ms: Math.round(entry.duration),
        start_time: entry.startTime
      });
    }
  }
  
  reportNavigationTiming(entry) {
    const metrics = {
      dns_lookup: entry.domainLookupEnd - entry.domainLookupStart,
      tcp_connect: entry.connectEnd - entry.connectStart,
      request_response: entry.responseEnd - entry.requestStart,
      dom_processing: entry.domContentLoadedEventEnd - entry.responseEnd,
      load_complete: entry.loadEventEnd - entry.loadEventStart
    };
    
    Object.entries(metrics).forEach(([name, value]) => {
      if (value > 0 && window.gtag) {
        gtag('event', 'performance_timing', {
          timing_name: name,
          duration_ms: Math.round(value)
        });
      }
    });
  }
  
  // Manual timing measurement
  startTiming(name) {
    if (this.enabled) {
      performance.mark(`${name}_start`);
    }
  }
  
  endTiming(name) {
    if (this.enabled) {
      performance.mark(`${name}_end`);
      performance.measure(name, `${name}_start`, `${name}_end`);
    }
  }
  
  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
  
  // Enhanced memory monitoring
  monitorMemoryUsage() {
    if ('memory' in performance) {
      const memory = performance.memory;
      const memoryMetrics = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usage_percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
      
      this.metrics.set('memory', memoryMetrics);
      
      // Warn if memory usage is high
      if (memoryMetrics.usage_percentage > 80) {
        // console.warn('High memory usage detected:', memoryMetrics);
        this.triggerMemoryCleanup();
      }
      
      return memoryMetrics;
    }
    return null;
  }
  
  // Performance analytics with user timing
  trackUserInteraction(action, duration) {
    const timestamp = Date.now();
    const metric = {
      action,
      duration,
      timestamp,
      memory: this.monitorMemoryUsage()
    };
    
    this.metrics.set(`user_interaction_${timestamp}`, metric);
    
    // Analytics integration
    if (window.gtag) {
      gtag('event', 'user_interaction', {
        action_name: action,
        duration_ms: duration,
        memory_usage: metric.memory?.usage_percentage || 0
      });
    }
  }
  
  // Frame rate monitoring
  startFrameRateMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measureFrameRate = (currentTime) => {
      frameCount++;
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        this.metrics.set('fps', fps);
        
        // Log warning if FPS is low
        if (fps < 30) {
          // console.warn('Low FPS detected:', fps);
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      if (this.enabled) {
        requestAnimationFrame(measureFrameRate);
      }
    };
    
    requestAnimationFrame(measureFrameRate);
  }
  
  // Automatic optimization triggers
  triggerMemoryCleanup() {
    // Clear various caches
    if (window.domCache) {
      window.domCache.clearCache();
    }
    
    if (window.boundsCalculator) {
      window.boundsCalculator.clearCache();
    }
    
    if (window.dataStore) {
      window.dataStore.clearCache();
    }
    
    // Force garbage collection if available (Chrome DevTools)
    if (window.gc) {
      window.gc();
    }
  }
  
  // Performance bottleneck detection
  detectBottlenecks() {
    const bottlenecks = [];
    
    // Check long tasks
    const longTasks = Array.from(this.metrics.entries())
      .filter(([key]) => key.startsWith('longtask_'))
      .map(([, value]) => value);
    
    if (longTasks.length > 5) {
      bottlenecks.push({
        type: 'excessive_long_tasks',
        count: longTasks.length,
        avgDuration: longTasks.reduce((sum, task) => sum + task.duration, 0) / longTasks.length
      });
    }
    
    // Check memory usage
    const memoryMetric = this.metrics.get('memory');
    if (memoryMetric && memoryMetric.usage_percentage > 70) {
      bottlenecks.push({
        type: 'high_memory_usage',
        percentage: memoryMetric.usage_percentage
      });
    }
    
    // Check FPS
    const fps = this.metrics.get('fps');
    if (fps && fps < 30) {
      bottlenecks.push({
        type: 'low_fps',
        fps: fps
      });
    }
    
    return bottlenecks;
  }
  
  // Generate performance report
  generateReport() {
    const bottlenecks = this.detectBottlenecks();
    const memoryUsage = this.monitorMemoryUsage();
    
    return {
      timestamp: new Date().toISOString(),
      metrics: Object.fromEntries(this.metrics),
      bottlenecks,
      memory: memoryUsage,
      recommendations: this.generateRecommendations(bottlenecks)
    };
  }
  
  generateRecommendations(bottlenecks) {
    const recommendations = [];
    
    bottlenecks.forEach(bottleneck => {
      switch(bottleneck.type) {
        case 'excessive_long_tasks':
          recommendations.push('Consider breaking up large JavaScript operations into smaller chunks');
          break;
        case 'high_memory_usage':
          recommendations.push('Clear unnecessary caches and optimize data structures');
          break;
        case 'low_fps':
          recommendations.push('Reduce visual complexity or optimize animations');
          break;
      }
    });
    
    return recommendations;
  }
  
  disable() {
    this.enabled = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Global instances
const domCache = new OptimizedDOMCache();
const boundsCalculator = new BoundsCalculator();
const sourceUpdater = new SourceUpdateManager();
const dataLoader = new DataLoader();
const dataStore = new DataStore();
const searchIndex = new AdvancedSearchIndex();
const workerManager = new WorkerManager();
const progressiveLoader = new ProgressiveLoader();
const performanceMonitor = new PerformanceMonitor();
const $ = (selector) => domCache.$(selector);
const $1 = (selector) => domCache.$1(selector);  
const $id = (id) => domCache.$id(id);

// Event Listener Management System
class OptimizedEventManager {
  constructor() {
    this.listeners = new Map(); // elementId -> [{event, handler, options}]
    this.delegatedListeners = new Map(); // event -> [{selector, handler}]
    this.debounceTimers = new Map();
    this.setupGlobalDelegation();
  }
  
  // Setup global event delegation for common patterns
  setupGlobalDelegation() {
    // Delegate all checkbox and form interactions
    document.addEventListener('change', this.handleGlobalChange.bind(this), { passive: true });
    document.addEventListener('input', this.handleGlobalInput.bind(this), { passive: true });
    document.addEventListener('click', this.handleGlobalClick.bind(this), { passive: false });
    
    // Mobile optimizations
    if ('ontouchstart' in window) {
      document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
      document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    }
    
    // Intersection Observer for performance
    if ('IntersectionObserver' in window) {
      this.setupIntersectionObserver();
    }
    
    // Resize optimization
    this.setupOptimizedResize();
  }
  
  // Global change handler with delegation
  handleGlobalChange(event) {
    const target = event.target;
    
    // Handle checkbox filters
    if (target.matches('[checkbox-filter] input[type="checkbox"]') ||
        target.matches('[fs-cmsfilter-element="filters"] input') ||
        target.matches('[fs-cmsfilter-element="filters"] select')) {
      this.debounce('filterUpdate', () => {
        if (window.handleFilterUpdate) {
          window.handleFilterUpdate();
        }
      }, 50);
    }
    
    // Handle sidebar toggles
    if (target.matches('[data-auto-sidebar="true"]') ||
        target.matches('[data-auto-second-left-sidebar="true"]')) {
      if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
        const sidebarType = target.matches('[data-auto-second-left-sidebar="true"]') ? 'SecondLeft' : 'Left';
        this.debounce('sidebarUpdate', () => {
          if (window.toggleSidebar) {
            window.toggleSidebar(sidebarType, true);
          }
        }, 50);
      }
    }
  }
  
  // Global input handler with delegation  
  handleGlobalInput(event) {
    const target = event.target;
    
    // Handle search inputs
    if (target.matches('[searchbox-filter]')) {
      this.debounce(`search-${target.id || 'default'}`, () => {
        // Trigger search functionality
        const searchEvent = new CustomEvent('optimizedSearch', {
          detail: { value: target.value, element: target }
        });
        target.dispatchEvent(searchEvent);
      }, 150);
    }
    
    // Handle other input types that need sidebar updates
    if (target.matches('[data-auto-sidebar="true"]') && ['text', 'search'].includes(target.type)) {
      if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
        this.debounce('sidebarUpdate', () => {
          if (window.toggleSidebar) {
            window.toggleSidebar('Left', true);
          }
        }, 50);
      }
    }
  }
  
  // Global click handler with delegation
  handleGlobalClick(event) {
    const target = event.target;
    
    // Handle filter application buttons
    if (target.matches('[apply-map-filter="true"], .filterrefresh, #filter-button')) {
      if (event.type === 'keypress' && event.key !== 'Enter') return;
      if (window.isMarkerClick) return;
      
      event.preventDefault();
      
      if (window.mapUtilities?.state) {
        const state = window.mapUtilities.state;
        state.flags.forceFilteredReframe = true;
        state.flags.isRefreshButtonAction = true;
        
        this.debounce('applyFilter', () => {
          if (window.applyFilterToMarkers) {
            window.applyFilterToMarkers(true);
            setTimeout(() => {
              state.flags.forceFilteredReframe = false;
              state.flags.isRefreshButtonAction = false;
            }, 1000);
          }
        }, 50);
      }
    }
  }
  
  // Touch and intersection observer methods
  handleTouchStart(event) {
    if (event.target.closest('button, .clickable, [role="button"]')) {
      event.target.closest('button, .clickable, [role="button"]').classList.add('touching');
    }
  }
  
  handleTouchEnd(event) {
    if (event.target.closest('button, .clickable, [role="button"]')) {
      event.target.closest('button, .clickable, [role="button"]').classList.remove('touching');
    }
  }
  
  setupIntersectionObserver() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.target.hasAttribute('data-lazy-load')) {
          if (entry.isIntersecting) {
            const event = new CustomEvent('enterViewport');
            entry.target.dispatchEvent(event);
          }
        }
      });
    }, { threshold: 0.1 });
  }
  
  setupOptimizedResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        boundsCalculator.clearCache();
        domCache.refresh();
        const resizeEvent = new CustomEvent('optimizedResize');
        window.dispatchEvent(resizeEvent);
      }, 250);
    }, { passive: true });
  }
  
  // Add tracked event listener
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
  
  // Add event delegation
  delegate(parentSelector, event, childSelector, handler) {
    const parent = domCache.$1(parentSelector);
    if (!parent) return false;
    
    const delegatedHandler = (e) => {
      if (e.target.matches(childSelector)) {
        handler.call(e.target, e);
      }
    };
    
    parent.addEventListener(event, delegatedHandler);
    
    if (!this.delegatedListeners.has(event)) {
      this.delegatedListeners.set(event, []);
    }
    
    this.delegatedListeners.get(event).push({
      parent,
      parentSelector, 
      childSelector,
      handler: delegatedHandler,
      originalHandler: handler
    });
    
    return true;
  }
  
  // Optimized debounce with cleanup
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
  
  // Remove specific listener
  remove(elementId, event, handler) {
    const listeners = this.listeners.get(elementId);
    if (!listeners) return;
    
    const index = listeners.findIndex(l => l.event === event && l.handler === handler);
    if (index !== -1) {
      const listener = listeners[index];
      listener.element.removeEventListener(event, handler, listener.options);
      listeners.splice(index, 1);
    }
  }
  
  // Clean up all listeners (prevent memory leaks)
  cleanup() {
    // Clean up regular listeners
    this.listeners.forEach((listeners, elementId) => {
      listeners.forEach(({ element, event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
    });
    
    // Clean up delegated listeners  
    this.delegatedListeners.forEach((listeners) => {
      listeners.forEach(({ parent, handler }) => {
        parent.removeEventListener('click', handler);
      });
    });
    
    // Clean up timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    
    // Clear all maps
    this.listeners.clear();
    this.delegatedListeners.clear();
    this.debounceTimers.clear();
  }

  // Enhanced form delegation for better performance
  setupEnhancedFormDelegation() {
    // Checkbox delegation with type detection
    this.addDelegated('change', 'input[type="checkbox"]', (event, target) => {
      const checkboxId = target.id;
      if (checkboxId.includes('settlement-') || checkboxId.includes('locality-') || 
          checkboxId.includes('subregion-') || checkboxId.includes('area-')) {
        this.handleCheckboxChange(event, target);
      }
    });

    // Autocomplete input delegation
    this.addDelegated('input', '.autocomplete-input', (event, target) => {
      this.handleAutocompleteInput(event, target);
    });

    // Button action delegation
    this.addDelegated('click', 'button[data-action]', (event, target) => {
      const action = target.getAttribute('data-action');
      this.handleButtonClick(action, event, target);
    });
  }

  handleCheckboxChange(event, checkbox) {
    const value = checkbox.value;
    const type = checkbox.id.split('-')[0]; // settlement, locality, etc.
    
    if (checkbox.checked) {
      if (window.selectCheckbox) {
        window.selectCheckbox(type, value);
      }
    } else {
      if (window.unselectCheckbox) {
        window.unselectCheckbox(type, value);
      }
    }
  }

  handleAutocompleteInput(event, input) {
    const query = input.value.trim();
    const autocompleteType = input.getAttribute('data-autocomplete-type');
    
    if (window.advancedSearchIndex) {
      const results = window.advancedSearchIndex.search(query);
      this.displayAutocompleteResults(input, results, autocompleteType);
    }
  }

  handleButtonClick(action, event, button) {
    event.preventDefault();
    
    switch(action) {
      case 'toggle-sidebar':
        const side = button.getAttribute('data-side') || 'Left';
        if (window.toggleSidebar) {
          window.toggleSidebar(side);
        }
        break;
      case 'clear-filters':
        if (window.clearAllFilters) {
          window.clearAllFilters();
        }
        break;
      case 'reset-view':
        if (window.resetMapView) {
          window.resetMapView();
        }
        break;
      default:
        // console.warn('Unknown button action:', action);
    }
  }

  displayAutocompleteResults(input, results, type) {
    const container = input.parentElement?.querySelector('.autocomplete-results');
    if (!container) return;

    container.innerHTML = '';
    results.slice(0, 10).forEach(result => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = result.term;
      item.setAttribute('data-value', result.id);
      item.setAttribute('data-type', result.type);
      container.appendChild(item);
    });
  }
}

// Global event manager
const eventManager = new OptimizedEventManager();

// Initialize Mapbox with enhanced RTL support
const lang = navigator.language.split('-')[0];
mapboxgl.accessToken = "pk.eyJ1Ijoibml0YWloYXJkeSIsImEiOiJjbWRzNGIxemIwMHVsMm1zaWp3aDl2Y3RsIn0.l_GLzIUCO84SF5_4TcmF3g";

// Enhanced RTL text support for multiple languages
const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi'];
if (rtlLanguages.includes(lang)) {
  mapboxgl.setRTLTextPlugin(
    "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js",
    null,
    true // Lazy load the plugin
  );
}

// Smart State Management (moved here before map creation)
class OptimizedMapState {
  constructor() {
    this.locationData = {type: "FeatureCollection", features: []};
    this.settlementData = {type: "FeatureCollection", features: []};
    this.allLocalityFeatures = [];
    this.allSettlementFeatures = [];
    this.allRegionFeatures = [];
    this.allSubregionFeatures = []; // ADD THIS LINE
    this.timers = new Map();
    this.lastClickedMarker = null;
    this.lastClickTime = 0;
    this.markerInteractionLock = false;
    this.highlightedBoundary = null;
    this.highlightedTerritoryDistricts = null;
    this.territoryHighlightActive = false;
    this.districtTerritoryMap = null;
    this.clickPriority = 999; // Higher number = lower priority, 999 = no click yet
    
    this.flags = new Proxy({
      isInitialLoad: true,
      mapInitialized: false,
      forceFilteredReframe: false,
      isRefreshButtonAction: false,
      dropdownListenersSetup: false,
      regionsLoaded: false,
      localitiesLoaded: false,
      areaControlsSetup: false,
      skipNextReframe: false
    }, {
      set: (target, property, value) => {
        target[property] = value;
        return true;
      }
    });
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

// Global state management
const state = new OptimizedMapState();
window.isLinkClick = false;

// Define the bounding box for the map view
const mapBounds = [
  [34.15033592116498, 31.16632630001915], // Southwest coordinates
  [35.70311064830133, 32.60506354440827]  // Northeast coordinates
];

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/occupationcrimes/cmf7lxqtf000m01sj6gwl6t0v",
  bounds: mapBounds,
  fitBoundsOptions: {
    padding: isMobile ? 20 : 50 // Less padding on mobile, more on desktop
  },
  language: ['en','es','fr','de','zh','ja','ru','ar','he','fa','ur'].includes(lang) ? lang : 'en'
});

// Map load event handler with optimized parallel operations
map.on("load", () => {
  try {
    init();
    
    // Load data in parallel for better performance
    Promise.all([
      // Load regions and territories immediately (they should always be visible)
      loadCombinedGeoData(),
      
      // Load locality data in parallel (but don't show locality markers yet)
      loadLocalitiesFromGeoJSON()
    ]).then(() => {
      // Initialize territory data immediately (should always be visible)
      initializeTerritoryData();
      
      // Add territory markers right after data loads (no zoom requirement)
      addNativeTerritoryMarkers();
      
      // Mark data as loaded for loading screen (markers are deferred)
      loadingTracker.markComplete('dataLoaded');
      
      // Final layer optimization after all initial data is loaded
      state.setTimer('finalOptimization', () => mapLayers.optimizeLayerOrder(), 100);
      
      // Mark map as ready
      loadingTracker.markComplete('mapReady');
      
    }).catch(error => {
      console.warn('Error loading initial data:', error);
      // Mark as complete anyway to prevent infinite loading
      loadingTracker.markComplete('dataLoaded');
      loadingTracker.markComplete('mapReady');
    });
    
    // Ensure map initialization steps are marked as complete
    // These were moved inside Promise.all but need to be marked regardless
    loadingTracker.markComplete('mapReady');
    
    // Note: Settlement data loading is now deferred until zoom threshold is reached
    
  } catch (error) {
    // Force complete on error to prevent infinite loading
    loadingTracker.forceComplete();
  }
});

// Listen for map idle event to detect when rendering is complete
map.on('idle', () => {
  loadingTracker.onMapIdle();
});

map.addControl(new mapboxgl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserHeading: true}));

// Add zoom controls (zoom in/out buttons)
map.addControl(new mapboxgl.NavigationControl({
  showCompass: false,  // Hide compass, only show zoom buttons
  showZoom: true,      // Show zoom in/out buttons
  visualizePitch: false // Hide pitch visualization
}), 'top-right');

// Add scale control to bottom-right (desktop) or bottom-left (mobile)
const scaleControl = new mapboxgl.ScaleControl({
  maxWidth: 100,
  unit: 'metric'
});

// Add imperial scale control (miles/feet)
const imperialScaleControl = new mapboxgl.ScaleControl({
  maxWidth: 100,
  unit: 'imperial'
});

const scalePosition = window.innerWidth <= 478 ? 'bottom-left' : 'bottom-right';
map.addControl(scaleControl, scalePosition);
map.addControl(imperialScaleControl, scalePosition);

// Custom Map Reset Control
class MapResetControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    
    const button = document.createElement('button');
    button.className = 'mapboxgl-ctrl-icon';
    button.type = 'button';
    button.title = 'Reset map view';
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9.88 9.88" style="width: 20px; height: 20px; display: block; margin: auto;">
      <path fill="currentColor" d="M5.15,2.23c-.38,0-.73.07-1.05.21s-.62.34-.86.58-.44.53-.58.86-.21.68-.21,1.06v.04l.77-.75h.86l-1.95,1.88h-.02L.16,4.23h.87l.66.65c0-.47.1-.92.29-1.33s.44-.78.75-1.09.68-.55,1.1-.73.87-.27,1.34-.27.93.09,1.35.27.79.43,1.11.75.57.69.75,1.11.27.87.27,1.35-.09.93-.27,1.35-.43.79-.75,1.11-.69.57-1.11.75-.87.27-1.35.27c-.3,0-.58-.03-.83-.10s-.5-.16-.72-.27-.43-.25-.62-.4-.35-.32-.5-.5l.56-.48c.3.32.61.57.95.74s.72.25,1.15.25c.38,0,.73-.07,1.06-.21s.62-.34.86-.58.44-.53.58-.86.21-.68.21-1.06-.07-.73-.21-1.06-.34-.62-.58-.86-.53-.44-.86-.58-.68-.21-1.06-.21Z"/>
    </svg>`;
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    
    button.onclick = () => {
      map.fitBounds(mapBounds, {
        padding: isMobile ? 20 : 50,
        duration: 1000
      });
    };
    
    this._container.appendChild(button);
    return this._container;
  }
  
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

// Add the custom reset control
map.addControl(new MapResetControl(), 'top-right');

// High-performance utilities
const utils = {
  // Cached utility functions
  _eventCache: new Map(),
  _styleCache: new Map(),
  
  triggerEvent: (el, events) => {
    events.forEach(eventType => {
      if (!utils._eventCache.has(eventType)) {
        utils._eventCache.set(eventType, new Event(eventType, {bubbles: true}));
      }
      el.dispatchEvent(utils._eventCache.get(eventType));
    });
  },
  
  setStyles: (el, styles) => {
    // Batch style applications for better performance
    requestAnimationFrame(() => {
      Object.assign(el.style, styles);
    });
  },
  
  calculateCentroid: (() => {
    // Cache centroid calculations for same coordinate sets
    const cache = new Map();
    
    return (coordinates) => {
      const key = JSON.stringify(coordinates);
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      let totalLat = 0, totalLng = 0, pointCount = 0;
      
      const processCoords = coords => {
        if (Array.isArray(coords) && coords.length > 0) {
          if (typeof coords[0] === 'number') {
            totalLng += coords[0];
            totalLat += coords[1];
            pointCount++;
          } else coords.forEach(processCoords);
        }
      };
      
      processCoords(coordinates);
      const result = pointCount > 0 ? [totalLng / pointCount, totalLat / pointCount] : [0, 0];
      
      // Cache result (limit cache size)
      if (cache.size < 100) {
        cache.set(key, result);
      }
      
      return result;
    };
  })()
};

// Map Layer Management System
class OptimizedMapLayers {
  constructor(map) {
    this.map = map;
    this.layerOrder = [];
    this.sourceCache = new Map();
    this.layerCache = new Map();
    this.batchOperations = [];
    this.pendingBatch = false;
  }
  
  // Batch multiple operations for better performance
  addToBatch(operation) {
    this.batchOperations.push(operation);
    if (!this.pendingBatch) {
      this.pendingBatch = true;
      requestAnimationFrame(() => this.processBatch());
    }
  }
  
  processBatch() {
    this.batchOperations.forEach(operation => {
      try {
        operation();
      } catch (error) {
        // Silent error handling in production
      }
    });
    
    this.batchOperations = [];
    this.pendingBatch = false;
    
    // Optimize layer order once after batch
    this.optimizeLayerOrder();
  }
  
  // Optimized layer existence check with caching
  hasLayer(layerId) {
    if (this.layerCache.has(layerId)) {
      return this.layerCache.get(layerId);
    }
    
    const exists = !!this.map.getLayer(layerId);
    this.layerCache.set(layerId, exists);
    return exists;
  }
  
  hasSource(sourceId) {
    if (this.sourceCache.has(sourceId)) {
      return this.sourceCache.get(sourceId);
    }
    
    const exists = !!this.map.getSource(sourceId);
    this.sourceCache.set(sourceId, exists);
    return exists;
  }
  
  // Smart layer ordering - only reorder when necessary
  optimizeLayerOrder() {
    const markerLayers = ['settlement-clusters', 'settlement-points', 'locality-clusters', 'locality-points', 'region-points'];
    
    // Check if all expected layers exist first
    const existingLayers = markerLayers.filter(id => this.hasLayer(id));
    if (existingLayers.length === 0) return;
    
    const currentOrder = this.map.getStyle().layers.map(l => l.id);
    
    // Check if reordering is needed
    const markerIndices = existingLayers
      .map(id => currentOrder.indexOf(id));
      
    const needsReorder = markerIndices.some((index, i) => {
      return i > 0 && index < markerIndices[i - 1];
    });
    
    if (needsReorder) {
      existingLayers.forEach(layerId => {
        try {
          const layer = this.map.getStyle().layers.find(l => l.id === layerId);
          if (layer) {
            this.map.removeLayer(layerId);
            this.map.addLayer(layer);
            this.layerCache.delete(layerId); // Invalidate cache
          }
        } catch (e) {
          // Silent error handling in production
        }
      });
    }
  }
  
  // Clear caches when layers change significantly
  invalidateCache() {
    this.layerCache.clear();
    this.sourceCache.clear();
  }
}

// Global layer manager
const mapLayers = new OptimizedMapLayers(map);

// Sidebar element and arrow icon caching (moved here before setupSidebars)
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
      const arrowKey = side === 'SecondLeft' ? 'secondleft' : side.toLowerCase();
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
    return side === 'SecondLeft' ? 'marginLeft' : `margin${side}`;
  },
  
  invalidate() {
    this.elements.clear();
    this.arrows.clear();
    this.widths.clear();
  }
};

// Helper function to close a sidebar without recursion
// Helper function to close a sidebar without recursion
const closeSidebar = (side) => {
  const sidebar = sidebarCache.getSidebar(side);
  if (!sidebar || !sidebar.classList.contains('is-show')) return;
  
  // Remove the show class
  sidebar.classList.remove('is-show');
  
  // Reset arrow icon
  const arrowIcon = sidebarCache.getArrow(side);
  if (arrowIcon) arrowIcon.style.transform = 'rotateY(0deg)';
  
  // Handle margin based on screen size
  const jsMarginProperty = sidebarCache.getMarginProperty(side);
  if (window.innerWidth > APP_CONFIG.breakpoints.mobile) {
    const width = sidebarCache.getWidth(side);
    sidebar.style[jsMarginProperty] = `-${width + 1}px`;
  } else {
    sidebar.style[jsMarginProperty] = '';
  }
  
  // Reset pointer events
  sidebar.style.pointerEvents = '';
};

// Enhanced toggle sidebar (Phase 2) - Replaces immediate version when ready
const enhancedToggleSidebar = (side, show = null) => {
  const sidebar = sidebarCache.getSidebar(side);
  if (!sidebar) return;
  
  const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
  sidebar.classList.toggle('is-show', isShowing);
  
  const jsMarginProperty = sidebarCache.getMarginProperty(side);
  const arrowIcon = sidebarCache.getArrow(side);
  
  if (window.innerWidth > APP_CONFIG.breakpoints.mobile) {
    const width = sidebarCache.getWidth(side);
    sidebar.style[jsMarginProperty] = isShowing ? '0' : `-${width + 1}px`;
    
    // Close other sidebars based on screen size
    if (isShowing) {
      if (window.innerWidth <= 991) {
        // Close ALL other sidebars on devices 991px and down
        ['Left', 'SecondLeft', 'Right'].forEach(otherSide => {
          if (otherSide !== side) closeSidebar(otherSide);
        });
      } else if (side === 'Left' || side === 'SecondLeft') {
        // On desktop (>991px): only close other left sidebars when opening a left sidebar
        const otherLeftSide = side === 'Left' ? 'SecondLeft' : 'Left';
        closeSidebar(otherLeftSide);
      }
    }
  } else {
    // Mobile (478px and down): use margin behavior and close all other sidebars
    sidebar.style[jsMarginProperty] = isShowing ? '0' : '';
    if (isShowing) {
      ['Left', 'SecondLeft', 'Right'].forEach(otherSide => {
        if (otherSide !== side) closeSidebar(otherSide);
      });
    }
  }
  
  // Set pointer events and arrow icon for the current sidebar
  utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
  if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
};

// Upgrade the immediate sidebar to enhanced version when ready
setTimeout(() => {
  if (typeof enhancedToggleSidebar === 'function') {
    window.toggleSidebar = enhancedToggleSidebar;
  }
}, 100);

// Global function to frame region boundaries (used by both markers and autocomplete)
function frameRegionBoundary(regionName) {
  const boundarySourceId = `${regionName.toLowerCase().replace(/\s+/g, '-')}-boundary`;
  const source = map.getSource(boundarySourceId);
  
  if (source && source._data) {
    // Region has boundaries - frame them with cached bounds
    const cacheKey = `region-${regionName}`;
    const allCoordinates = source._data.features.flatMap(feature => feature.geometry.coordinates);
    const bounds = boundsCalculator.fromGeoJSON(allCoordinates, cacheKey);
    
    map.fitBounds(bounds, {padding: 50, duration: 1000, essential: true});
    return true; // Successfully framed
  }
  
  return false; // No boundary found
}

// Highlight boundary with subtle red color and move above area overlays
function highlightBoundary(regionName) {
  // Remove any existing highlight first
  removeBoundaryHighlight();
  
  const boundaryFillId = `${regionName.toLowerCase().replace(/\s+/g, '-')}-fill`;
  const boundaryBorderId = `${regionName.toLowerCase().replace(/\s+/g, '-')}-border`;
  
  if (mapLayers.hasLayer(boundaryFillId) && mapLayers.hasLayer(boundaryBorderId)) {
    // Batch boundary highlighting operations
    mapLayers.addToBatch(() => {
      map.setPaintProperty(boundaryFillId, 'fill-color', '#6e3500');
      map.setPaintProperty(boundaryFillId, 'fill-opacity', 0.4);
      map.setPaintProperty(boundaryBorderId, 'line-color', '#6e3500');
      map.setPaintProperty(boundaryBorderId, 'line-opacity', 0.9);
    });
    
    // Track the highlighted boundary
    state.highlightedBoundary = regionName;
  }
}

// Highlight all boundaries for a territory
function highlightTerritoryBoundaries(territoryName) {
  console.log(`🎯 Territory Highlighting: Starting for "${territoryName}"`);
  
  // Remove any existing highlight first
  removeBoundaryHighlight();
  
  // Get all district boundaries for this territory using our mapping
  const districtsToHighlight = [];
  
  console.log(`🗺️ District-Territory Map:`, state.districtTerritoryMap);
  
  if (state.districtTerritoryMap) {
    // Find all districts that belong to this territory
    state.districtTerritoryMap.forEach((territory, districtName) => {
      if (territory === territoryName) {
        const fillId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-fill`;
        const borderId = `${districtName.toLowerCase().replace(/\s+/g, '-')}-border`;
        
        console.log(`🔍 Found district "${districtName}" for territory "${territoryName}"`);
        console.log(`📍 Layer IDs: ${fillId}, ${borderId}`);
        
        // Check if layers exist
        const hasFill = mapLayers.hasLayer(fillId);
        const hasBorder = mapLayers.hasLayer(borderId);
        console.log(`✅ Layers exist - Fill: ${hasFill}, Border: ${hasBorder}`);
        
        if (hasFill && hasBorder) {
          districtsToHighlight.push({
            fillId: fillId,
            borderId: borderId,
            districtName: districtName
          });
        }
      }
    });
  }
  
  console.log(`🎨 Districts to highlight:`, districtsToHighlight);
  
  // Highlight all matching districts
  if (districtsToHighlight.length > 0) {
    console.log(`🎨 Applying territory highlight color #6e3500 to ${districtsToHighlight.length} districts`);
    
    mapLayers.addToBatch(() => {
      districtsToHighlight.forEach((district, index) => {
        console.log(`🎨 ${index + 1}. Highlighting ${district.districtName}: ${district.fillId}`);
        
        try {
          map.setPaintProperty(district.fillId, 'fill-color', '#6e3500');
          map.setPaintProperty(district.fillId, 'fill-opacity', 0.4);
          map.setPaintProperty(district.borderId, 'line-color', '#6e3500');
          map.setPaintProperty(district.borderId, 'line-opacity', 0.9);
          console.log(`✅ Successfully highlighted ${district.districtName}`);
          
          // Verify the colors were actually set
          setTimeout(() => {
            const currentFillColor = map.getPaintProperty(district.fillId, 'fill-color');
            const currentBorderColor = map.getPaintProperty(district.borderId, 'line-color');
            console.log(`🔍 ${district.districtName} colors after 100ms - Fill: ${currentFillColor}, Border: ${currentBorderColor}`);
            
            if (currentFillColor !== '#6e3500') {
              console.warn(`⚠️ ${district.districtName} fill color was overridden! Expected #6e3500, got ${currentFillColor}`);
            }
            if (currentBorderColor !== '#6e3500') {
              console.warn(`⚠️ ${district.districtName} border color was overridden! Expected #6e3500, got ${currentBorderColor}`);
            }
          }, 100);
          
        } catch (error) {
          console.error(`❌ Failed to highlight ${district.districtName}:`, error);
        }
      });
    });
    
    // Clear any single boundary highlights when activating territory highlighting
    if (state.highlightedBoundary && !state.territoryHighlightActive) {
      console.log(`🧹 Clearing previous single boundary highlight: ${state.highlightedBoundary}`);
      state.highlightedBoundary = null;
    }
    
    state.highlightedBoundary = territoryName;
    state.highlightedTerritoryDistricts = districtsToHighlight;
    state.territoryHighlightActive = true;
    
    console.log(`🎯 Territory highlighting activated for "${territoryName}" with ${districtsToHighlight.length} districts`);
  } else {
    console.log(`❌ No districts found to highlight for territory "${territoryName}"`);
  }
  
  return districtsToHighlight;
}

// Frame all boundaries for a territory
function frameTerritoryBoundaries(territoryName) {
  const districtsToFrame = state.highlightedTerritoryDistricts || [];
  
  if (districtsToFrame.length === 0) {
    return false;
  }
  
  // Collect all coordinates from all districts
  const allCoordinates = [];
  districtsToFrame.forEach(district => {
    // Get the source data for this district
    const sourceId = `${district.districtName.toLowerCase().replace(/\s+/g, '-')}-boundary`;
    const source = map.getSource(sourceId);
    
    if (source && source._data && source._data.features) {
      const feature = source._data.features[0];
      if (feature && feature.geometry && feature.geometry.coordinates) {
        const coords = feature.geometry.coordinates;
        if (Array.isArray(coords[0])) {
          coords[0].forEach(coord => {
            if (Array.isArray(coord) && coord.length >= 2) {
              allCoordinates.push(coord);
            }
          });
        }
      }
    }
  });
  
  if (allCoordinates.length === 0) {
    return false;
  }
  
  // Calculate bounds
  const cacheKey = `territory-${territoryName}`;
  const bounds = boundsCalculator.fromGeoJSON(allCoordinates, cacheKey);
  
  map.fitBounds(bounds, {padding: 50, duration: 1000, essential: true});
  return true;
}

// Remove boundary highlight and move back below area overlays
function removeBoundaryHighlight() {
  console.log(`🧹 RemoveBoundaryHighlight called`);
  console.log(`🧹 Territory active: ${state.territoryHighlightActive}`);
  console.log(`🧹 Territory districts:`, state.highlightedTerritoryDistricts);
  console.log(`🧹 Single boundary:`, state.highlightedBoundary);
  
  // Handle territory highlights
  if (state.highlightedTerritoryDistricts && state.highlightedTerritoryDistricts.length > 0) {
    console.log(`🧹 Removing territory highlights for ${state.highlightedTerritoryDistricts.length} districts`);
    
    mapLayers.addToBatch(() => {
      state.highlightedTerritoryDistricts.forEach((district, index) => {
        console.log(`🧹 ${index + 1}. Restoring ${district.districtName}: ${district.fillId}`);
        
        if (mapLayers.hasLayer(district.fillId)) {
          const currentColor = document.getElementById('region-color') ? document.getElementById('region-color').value : '#1a1b1e';
          map.setPaintProperty(district.fillId, 'fill-color', currentColor);
          map.setPaintProperty(district.fillId, 'fill-opacity', 0.15);
          console.log(`✅ Restored fill for ${district.districtName}`);
        }
        if (mapLayers.hasLayer(district.borderId)) {
          map.setPaintProperty(district.borderId, 'line-color', '#888888');
          map.setPaintProperty(district.borderId, 'line-opacity', 0.8);
          console.log(`✅ Restored border for ${district.districtName}`);
        }
      });
    });
    
    console.log(`🧹 Clearing territory highlight state`);
    state.highlightedTerritoryDistricts = null;
    state.territoryHighlightActive = false;
  }
  
  // Handle single boundary highlights (only if territory highlighting is not active)
  if (state.highlightedBoundary && !state.territoryHighlightActive) {
    const boundaryFillId = `${state.highlightedBoundary.toLowerCase().replace(/\s+/g, '-')}-fill`;
    const boundaryBorderId = `${state.highlightedBoundary.toLowerCase().replace(/\s+/g, '-')}-border`;
    
    if (mapLayers.hasLayer(boundaryFillId) && mapLayers.hasLayer(boundaryBorderId)) {
      // Batch boundary reset operations
      mapLayers.addToBatch(() => {
        const currentColor = document.getElementById('region-color') ? document.getElementById('region-color').value : '#1a1b1e';
        map.setPaintProperty(boundaryFillId, 'fill-color', currentColor);
        map.setPaintProperty(boundaryFillId, 'fill-opacity', 0.15);
        map.setPaintProperty(boundaryBorderId, 'line-color', '#888888');
        map.setPaintProperty(boundaryBorderId, 'line-opacity', 0.8);
      });
    }
    
    state.highlightedBoundary = null;
  }
}

// Toggle filtered elements with immediate DOM updates (no batching for critical UI)
const toggleShowWhenFilteredElements = show => {
  // Don't use cached results for critical filtering elements - always fresh query
  const elements = document.querySelectorAll('[show-when-filtered="true"]');
  if (elements.length === 0) return;
  
  // Apply changes immediately without requestAnimationFrame batching
  elements.forEach(element => {
    element.style.display = show ? 'block' : 'none';
    element.style.visibility = show ? 'visible' : 'hidden';
    element.style.opacity = show ? '1' : '0';
    element.style.pointerEvents = show ? 'auto' : 'none';
  });
};

// Checkbox selection functions with proper settlement unchecking
// Unified checkbox selection function
function selectCheckbox(type, value) {
  // console.log(`🔍 selectCheckbox called with type: "${type}", value: "${value}"`);
  
  const checkboxTypes = ['Governorate', 'Region', 'locality', 'settlement', 'territory'];
  
  requestAnimationFrame(() => {
    // console.log(`🔍 Looking for checkboxes with selector: [checkbox-filter="${type}"] input[fs-list-value]`);
    
    // Get all checkbox groups - using native queries to avoid caching
    const allCheckboxes = checkboxTypes.flatMap(checkboxType => 
      Array.from(document.querySelectorAll(`[checkbox-filter="${checkboxType}"] input[fs-list-value]`))
    );
    
    // console.log(`🔍 Found ${allCheckboxes.length} total checkboxes across all types`);
    
    // Clear all checkboxes first
    allCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        // console.log(`🔍 Unchecking: ${checkbox.getAttribute('fs-list-value')} (${checkbox.parentElement.getAttribute('checkbox-filter')})`);
        checkbox.checked = false;
        utils.triggerEvent(checkbox, ['change', 'input']);
        
        const form = checkbox.closest('form');
        if (form) {
          form.dispatchEvent(new Event('change', {bubbles: true}));
          form.dispatchEvent(new Event('input', {bubbles: true}));
        }
      }
    });
    
    // Find and check the target checkbox
    const targetCheckboxes = Array.from(document.querySelectorAll(`[checkbox-filter="${type}"] input[fs-list-value]`));
    // console.log(`🔍 Found ${targetCheckboxes.length} checkboxes for type "${type}"`);
    
    targetCheckboxes.forEach((cb, index) => {
      // console.log(`🔍 Checkbox ${index}: fs-list-value="${cb.getAttribute('fs-list-value')}", checkbox-filter="${cb.parentElement.getAttribute('checkbox-filter')}"`);
    });
    
    const targetCheckbox = targetCheckboxes.find(checkbox => 
      checkbox.getAttribute('fs-list-value') === value
    );
    
    if (targetCheckbox) {
      // console.log(`✅ Found target checkbox for "${value}", checking it`);
      targetCheckbox.checked = true;
      utils.triggerEvent(targetCheckbox, ['change', 'input']);
      
      const form = targetCheckbox.closest('form');
      if (form) {
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
      }
    } else {
      // console.log(`❌ Could not find checkbox for type "${type}" with value "${value}"`);
      
      // Additional debugging - show all available checkboxes
      // console.log(`🔍 All available checkboxes in DOM:`);
      document.querySelectorAll('[checkbox-filter]').forEach((wrapper, index) => {
        const input = wrapper.querySelector('input[fs-list-value]');
        if (input) {
          // console.log(`  ${index}: checkbox-filter="${wrapper.getAttribute('checkbox-filter')}", fs-list-value="${input.getAttribute('fs-list-value')}"`);
        }
      });
    }
  });
}

// Wrapper functions for backward compatibility
function selectRegionCheckbox(regionName) {
  // console.log(`🔍 selectRegionCheckbox called with: "${regionName}"`);
  selectCheckbox('Governorate', regionName);
}

function selectSubregionCheckbox(subregionName) {
  // console.log(`🔍 selectSubregionCheckbox called with: "${subregionName}"`);
  selectCheckbox('Region', subregionName);
}

function selectLocalityCheckbox(localityName) {
  selectCheckbox('locality', localityName);
}

function selectSettlementCheckbox(settlementName) {
  selectCheckbox('settlement', settlementName);
}

function selectTerritoryCheckbox(territoryName) {
  selectCheckbox('territory', territoryName);
}
// Load localities with conditional caching
async function loadLocalitiesFromGeoJSON() {
  try {
    // Use optimized loader with conditional caching
    const processedData = await loadLocalitiesWithCache();
    
    // Store the data in state (maintaining compatibility)
    state.locationData = { features: processedData.features };
    state.allLocalityFeatures = processedData.features;
      
    // The worker already processed regions and subregions for us
    // Extract unique regions from localities with their coordinates
    const regionMap = new Map();
    // Extract unique subregions from localities with their coordinates
    const subregionMap = new Map();
    
    processedData.features.forEach(feature => {
      const regionName = feature.properties.region;
      const subregionName = feature.properties.subRegion;
        
        // Process regions
        if (regionName && !regionMap.has(regionName)) {
          regionMap.set(regionName, []);
        }
        if (regionName) {
          regionMap.get(regionName).push(feature.geometry.coordinates);
        }
        
        // Process subregions
        if (subregionName && !subregionMap.has(subregionName)) {
          subregionMap.set(subregionName, []);
        }
        if (subregionName) {
          subregionMap.get(subregionName).push(feature.geometry.coordinates);
        }
      });
      
      // Create region features from the extracted data
      state.allRegionFeatures = Array.from(regionMap.entries()).map(([regionName, coordinates]) => {
        // Calculate centroid of all localities in this region
        let totalLat = 0, totalLng = 0;
        coordinates.forEach(coord => {
          totalLng += coord[0];
          totalLat += coord[1];
        });
        
        // Find a locality with this region to get the territory
        const localityInRegion = processedData.features.find(f => f.properties.region === regionName);
        
        return {
          type: "Feature",
          properties: {
            name: regionName,
            type: "region",
            territory: localityInRegion ? localityInRegion.properties.territory : null
          },
          geometry: {
            type: "Point",
            coordinates: [totalLng / coordinates.length, totalLat / coordinates.length]
          }
        };
      });
      
      // Create subregion features from the extracted data
      state.allSubregionFeatures = Array.from(subregionMap.entries()).map(([subregionName, coordinates]) => {
        // Calculate centroid of all localities in this subregion
        let totalLat = 0, totalLng = 0;
        coordinates.forEach(coord => {
          totalLng += coord[0];
          totalLat += coord[1];
        });
        
        return {
          type: "Feature",
          properties: {
            name: subregionName,
            type: "subregion"
          },
          geometry: {
            type: "Point",
            coordinates: [totalLng / coordinates.length, totalLat / coordinates.length]
          }
        };
      });
      
      // Add localities to map
      addNativeMarkers();
      
      // Add region markers to map
      addNativeRegionMarkers();

      // Add subregion markers to map
      addNativeSubregionMarkers();
      
      // Generate checkboxes
      state.setTimer('generateLocalityCheckboxes', generateLocalityCheckboxes, 500);
      state.setTimer('generateRegionCheckboxes', generateRegionCheckboxes, 500);
      
      
      // Settlement loading is now deferred until zoom threshold is reached
      // This improves initial page load performance significantly
      
      // Refresh autocomplete if it exists
      if (window.refreshAutocomplete) {
        state.setTimer('refreshAutocompleteAfterLocalities', window.refreshAutocomplete, 1000);
      }
      
      // Mark data as loaded
      loadingTracker.markComplete('dataLoaded');
  } catch (error) {
    // console.error('Failed to load localities:', error);
    // Mark as loaded even on error to prevent infinite loading
    loadingTracker.markComplete('dataLoaded');
  }
}

// Load settlements with conditional caching  
async function loadSettlementsFromCache() {
  try {
    const processedData = await loadSettlementsWithCache();
    
    // Store settlement features and data (addSettlementMarkers needs both)
    if (!processedData || !processedData.features || !Array.isArray(processedData.features)) {
      // Try to recover if possible
      if (processedData && Array.isArray(processedData)) {
        // Maybe the data itself is the features array
        state.allSettlementFeatures = processedData;
        state.settlementData = {
          type: "FeatureCollection",
          features: processedData
        };
      } else {
        state.allSettlementFeatures = [];
        state.settlementData = {
          type: "FeatureCollection",
          features: []
        };
      }
    } else {
      state.allSettlementFeatures = processedData.features;
      state.settlementData = {
        type: "FeatureCollection",
        features: processedData.features
      };
    }
    
    // Add settlements to map (will be inserted before localities for proper layer order)
    addSettlementMarkers();
    
    // Territory markers are now loaded independently during initial map load
    // No need to initialize territory data here anymore
    
    // Generate settlement checkboxes
    state.setTimer('generateSettlementCheckboxes', generateSettlementCheckboxes, 500);
    
  } catch (error) {
    // console.error('Failed to load settlements:', error);
  }
}

// Load and add settlement markers with new color
function loadSettlements() {
  fetch(getOptimalUrl('settlements'))
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(settlementData => {
      // Store settlement features
      state.settlementData = settlementData;
      state.allSettlementFeatures = settlementData.features;
      
      // Add settlements to map (will be inserted before localities for proper layer order)
      addSettlementMarkers();
      
      // Territory markers are now loaded independently during initial map load
      // No need to initialize territory data here anymore
      
      // Generate settlement checkboxes
      state.setTimer('generateSettlementCheckboxes', generateSettlementCheckboxes, 500);
      
      // Emit event that settlements are loaded
      EventBus.emit('settlements:loaded', processedData.settlements);
      
      // Refresh autocomplete to include settlement and territory data
      if (window.refreshAutocomplete) {
        state.setTimer('refreshAutocompleteAfterSettlements', window.refreshAutocomplete, APP_CONFIG.timeouts.refreshDelay);
      }
      
    })
    .catch(error => {
      // console.error('Failed to load settlements:', error);
    });
}

// Helper function to debug layer order
function logLayerOrder(message) {
  const layers = map.getStyle().layers;
  const relevantLayers = layers.filter(layer => 
    layer.id.includes('locality') || 
    layer.id.includes('region') || 
    layer.id.includes('subregion') || 
    layer.id.includes('settlement')
  ).map(layer => layer.id);
  
}

// Add settlement markers to map with updated color
function addSettlementMarkers() {
  
  if (!state.allSettlementFeatures.length) {
    return;
  }
  
  // Find proper insertion point - before locality layers but after areas
  const getBeforeLayerId = () => {
    const markerLayers = ['locality-clusters', 'locality-points', 'region-points'];
    const existingMarkerLayer = markerLayers.find(layerId => map.getLayer(layerId));
    
    if (existingMarkerLayer) {
      return existingMarkerLayer;
    }
    
    return null;
  };
  
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('settlements-source')) {
      map.getSource('settlements-source').setData(state.settlementData);
    } else {
      // Add source first
      map.addSource('settlements-source', {
        type: 'geojson',
        data: state.settlementData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 40
      });
      
      const beforeId = getBeforeLayerId();
      
      // Add clustered settlements layer with proper positioning
      const layerConfig = {
        id: 'settlement-clusters',
        type: 'symbol',
        source: 'settlements-source',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Regular'],
          'text-size': 16,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'symbol-sort-key': 1,
          'visibility': 'visible' // Always visible, opacity handles fade
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#800000',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7.5, 0,    // Completely transparent below 7.5
            8.5, 0,    // Still transparent at 8.5
            9.5, 1,    // Fade in between 8.5 and 9.5 (mobile threshold)
            10.5, 1    // Fully visible at desktop threshold and beyond
          ]
        }
      };
      
      if (beforeId) {
        map.addLayer(layerConfig, beforeId);
      } else {
        map.addLayer(layerConfig);
      }
      
      // Add individual settlement points layer with proper positioning
      const pointsLayerConfig = {
        id: 'settlement-points',
        type: 'symbol',
        source: 'settlements-source',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 10,
            12, 14,
            16, 16
          ],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 4,
          'text-offset': [0, 0],
          'text-anchor': 'center',
          'symbol-sort-key': 2,
          'visibility': 'visible' // Always visible, opacity handles fade
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#800000',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7.5, 0,    // Completely transparent below 7.5
            8.5, 0,    // Still transparent at 8.5
            9.5, 1,    // Fade in between 8.5 and 9.5 (mobile threshold)
            10.5, 1    // Fully visible at desktop threshold and beyond
          ]
        }
      };
      
      if (beforeId) {
        map.addLayer(pointsLayerConfig, beforeId);
      } else {
        map.addLayer(pointsLayerConfig);
      }
      
      // Hide Mapbox base map settlement layers immediately
      try {
        const baseSettlementLayers = ['settlement-subdivision-label', 'settlement-minor-label', 'settlement-major-label'];
        baseSettlementLayers.forEach(layerId => {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'none');
          }
        });
      } catch (error) {
        // console.error('[DEBUG] Error hiding base layers:', error);
      }
      
      mapLayers.invalidateCache();
    }
  });
  
  setupSettlementMarkerClicks();
}

// Setup settlement marker click handlers
function setupSettlementMarkerClicks() {
  // Settlement point clicks
  const settlementClickHandler = (e) => {
    // Settlement has priority 5
    const myPriority = 5;
    
    // Only handle if no one has claimed priority yet, or if we have higher priority
    if (state.clickPriority === 999 || state.clickPriority > myPriority) {
      state.clickPriority = myPriority;
    } else {
      return; // Someone with equal or higher priority already claimed it
    }
    
    const feature = e.features[0];
    const settlementName = feature.properties.name;
    
    // Generate checkbox for clicked settlement (lazy loading)
    if (APP_CONFIG.features.enableLazyCheckboxes && settlementName) {
      generateSingleCheckbox(settlementName, 'settlement', feature.properties);
    }
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `settlement-${settlementName}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    window.isMarkerClick = true;
    
    removeBoundaryHighlight();
    selectSettlementCheckbox(settlementName);
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    // No flying/reframing when clicking settlement markers - user already sees where it is
    
    state.setTimer('settlementMarkerCleanup', () => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 800);
    
    // Reset priority quickly for next click
    state.setTimer('resetClickPriority', () => {
      state.clickPriority = 999;
    }, 50);
  };
  
  // Cluster clicks
  const settlementClusterClickHandler = (e) => {
    // Settlement cluster has priority 5 (same as settlement points)
    const myPriority = 5;
    
    // Only handle if no one has claimed priority yet, or if we have higher priority
    if (state.clickPriority === 999 || state.clickPriority > myPriority) {
      state.clickPriority = myPriority;
    } else {
      return; // Someone with equal or higher priority already claimed it
    }
    removeBoundaryHighlight();
    
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['settlement-clusters']
    });
    
    // Re-check priority before flying
    if (state.clickPriority < myPriority) return;
    
    map.flyTo({
      center: features[0].geometry.coordinates,
      zoom: map.getZoom() + 2.5,
      duration: 800
    });
    
    // Reset priority quickly for next click
    state.setTimer('resetClickPriority', () => {
      state.clickPriority = 999;
    }, 50);
  };
  
  // Add event listeners
  map.on('click', 'settlement-points', settlementClickHandler);
  map.on('click', 'settlement-clusters', settlementClusterClickHandler);
  
  // Cursor management
  ['settlement-clusters', 'settlement-points'].forEach(layerId => {
    map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
  });
}

// Add territory markers to map
function addNativeTerritoryMarkers() {
  if (!state.allTerritoryFeatures || !state.allTerritoryFeatures.length) {
    return;
  }
  
  const territoryGeoJSON = {
    type: "FeatureCollection",
    features: state.allTerritoryFeatures
  };
  
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('territories-source')) {
      map.getSource('territories-source').setData(territoryGeoJSON);
    } else {
      // Add source
      map.addSource('territories-source', {
        type: 'geojson',
        data: territoryGeoJSON
      });
      
      // Add territory points layer - on top of everything
      map.addLayer({
        id: 'territory-points',
        type: 'symbol',
        source: 'territories-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 14,  // Bigger than regions (12) at low zoom
            10, 18, // Bigger than regions (16) at mid zoom
            14, 20  // Bigger than regions (18) at high zoom
          ],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-offset': [0, 0],
          'text-anchor': 'center',
          'symbol-sort-key': 0, // Highest priority
          'visibility': 'visible'
        },
        paint: {
          'text-color': '#ffffff', // White text inside
          'text-halo-color': '#2d1810', // Dark brown halo outside
          'text-halo-width': 2
        }
      });
      
      mapLayers.invalidateCache();
    }
  });
  
  setupTerritoryMarkerClicks();
}

// Setup territory marker click handlers
function setupTerritoryMarkerClicks() {
  const territoryClickHandler = (e) => {
    // Territory has priority 1 (highest)
    const myPriority = 1;
    
    // Only handle if no one has claimed priority yet, or if we have higher priority
    if (state.clickPriority === 999 || state.clickPriority > myPriority) {
      state.clickPriority = myPriority;
    } else {
      return; // Someone with equal or higher priority already claimed it
    }
    
    const feature = e.features[0];
    const territoryName = feature.properties.name;
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `territory-${territoryName}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    window.isMarkerClick = true;
    
    removeBoundaryHighlight();
    selectTerritoryCheckbox(territoryName);
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    // Highlight and frame territory boundaries
    highlightTerritoryBoundaries(territoryName);
    frameTerritoryBoundaries(territoryName);
    
    state.setTimer('territoryMarkerCleanup', () => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 800);
    
    // Reset priority quickly for next click
    state.setTimer('resetClickPriority', () => {
      state.clickPriority = 999;
    }, 50);
  };
  
  // Add event listeners
  map.on('click', 'territory-points', territoryClickHandler);
  
  // Cursor management
  map.on('mouseenter', 'territory-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'territory-points', () => map.getCanvas().style.cursor = '');
}

// Native markers with batched operations
function addNativeMarkers() {
  if (!state.locationData.features.length) {
    return;
  }
  
  // Batch add source and layers
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('localities-source')) {
      map.getSource('localities-source').setData(state.locationData);
    } else {
      map.addSource('localities-source', {
        type: 'geojson',
        data: state.locationData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });
      
      // Add clustered points layer
      map.addLayer({
        id: 'locality-clusters',
        type: 'symbol',
        source: 'localities-source',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Regular'],
          'text-size': 16,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'visibility': 'visible' // Always visible, opacity handles fade
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#616100',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7.5, 0,    // Completely transparent below 7.5
            8.5, 0,    // Still transparent at 8.5
            9.5, 1,    // Fade in between 8.5 and 9.5 (mobile threshold)
            10.5, 1    // Fully visible at desktop threshold and beyond
          ]
        }
      });
      
      // Add individual locality points layer WITHOUT highlighting (FIX #2)
      map.addLayer({
        id: 'locality-points',
        type: 'symbol',
        source: 'localities-source',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 10,
            12, 14,
            16, 16
          ],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 4,
          'text-offset': [0, 0],
          'text-anchor': 'center',
          'symbol-sort-key': 10, // Higher values render last (on top)
          'visibility': 'visible' // Always visible, opacity handles fade
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#616100', // Always use normal color (no highlighting)
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7.5, 0,    // Completely transparent below 7.5
            8.5, 0,    // Still transparent at 8.5
            9.5, 1,    // Fade in between 8.5 and 9.5 (mobile threshold)
            10.5, 1    // Fully visible at desktop threshold and beyond
          ]
        }
      });
      
      logLayerOrder('After adding locality layers');
      
      mapLayers.invalidateCache(); // Invalidate cache after adding layers
    }
  });
  
  setupNativeMarkerClicks();
  
  // Markers have been added - the map 'idle' event will handle render detection
}

// Region markers with batched operations  
function addNativeRegionMarkers() {
  if (!state.allRegionFeatures.length) {
    return;
  }
  
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('regions-source')) {
      map.getSource('regions-source').setData({
        type: "FeatureCollection",
        features: state.allRegionFeatures
      });
    } else {
      map.addSource('regions-source', {
        type: 'geojson',
        data: {
          type: "FeatureCollection",
          features: state.allRegionFeatures
        }
      });
      
      map.addLayer({
        id: 'region-points',
        type: 'symbol',
        source: 'regions-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 12,
            10, 16,
            14, 18
          ],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 6,
          'text-offset': [0, 0],
          'text-anchor': 'center',
          'symbol-sort-key': 10 // Higher values render last (on top)
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#6e3500',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 0,
            6, 1
          ]
        }
      });
      
      mapLayers.invalidateCache(); // Invalidate cache after adding layers
    }
  });
  
  setupRegionMarkerClicks();
}

// Event setup with proper management and delegation
function setupNativeMarkerClicks() {
  // Remove old listeners if they exist to prevent duplicates
  eventManager.listeners.forEach((listeners, elementId) => {
    if (elementId.includes('locality') || elementId.includes('region')) {
      listeners.forEach(({element, event, handler, options}) => {
        element.removeEventListener(event, handler, options);
      });
      eventManager.listeners.delete(elementId);
    }
  });
  
  // Locality point clicks
  const localityClickHandler = (e) => {
    // Locality has priority 4
    const myPriority = 4;
    
    // Only handle if no one has claimed priority yet, or if we have higher priority
    if (state.clickPriority === 999 || state.clickPriority > myPriority) {
      state.clickPriority = myPriority;
    } else {
      return; // Someone with equal or higher priority already claimed it
    }
    
    const feature = e.features[0];
    const locality = feature.properties.name;
    
    // Generate checkbox for clicked locality (lazy loading)
    if (APP_CONFIG.features.enableLazyCheckboxes && locality) {
      generateSingleCheckbox(locality, 'locality', feature.properties);
    }
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `locality-${locality}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    window.isMarkerClick = true;
    
    removeBoundaryHighlight();
    selectLocalityCheckbox(locality);
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    // No flying/reframing when clicking map markers - user already sees where it is
    
    state.setTimer('markerCleanup', () => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 800);
    
    // Reset priority quickly for next click
    state.setTimer('resetClickPriority', () => {
      state.clickPriority = 999;
    }, 50);
  };
  
  // Cluster clicks
  const clusterClickHandler = (e) => {
    // Locality cluster has priority 4 (same as locality points)
    const myPriority = 4;
    
    // Only handle if no one has claimed priority yet, or if we have higher priority
    if (state.clickPriority === 999 || state.clickPriority > myPriority) {
      state.clickPriority = myPriority;
    } else {
      return; // Someone with equal or higher priority already claimed it
    }
    removeBoundaryHighlight();
    
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['locality-clusters']
    });
    
    // Re-check priority before flying
    if (state.clickPriority < myPriority) return;
    
    map.flyTo({
      center: features[0].geometry.coordinates,
      zoom: map.getZoom() + 2.5,
      duration: 800
    });
    
    // Reset priority quickly for next click
    state.setTimer('resetClickPriority', () => {
      state.clickPriority = 999;
    }, 50);
  };
  
  // Use map event listeners (these are automatically managed by Mapbox)
  map.on('click', 'locality-points', localityClickHandler);
  map.on('click', 'locality-clusters', clusterClickHandler);
  
  // Cursor management
  ['locality-clusters', 'locality-points'].forEach(layerId => {
    map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
  });
}

function setupRegionMarkerClicks() {
  const regionClickHandler = (e) => {
    // Region has priority 2
    const myPriority = 2;
    
    // Only handle if no one has claimed priority yet, or if we have higher priority
    if (state.clickPriority === 999 || state.clickPriority > myPriority) {
      state.clickPriority = myPriority;
    } else {
      return; // Someone with equal or higher priority already claimed it
    }
    
    const feature = e.features[0];
    const regionName = feature.properties.name;
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `region-${regionName}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    window.isMarkerClick = true;
    
    selectRegionCheckbox(regionName);
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    // Check if region has boundary
    const boundarySourceId = `${regionName.toLowerCase().replace(/\s+/g, '-')}-boundary`;
    if (map.getSource(boundarySourceId)) {
      highlightBoundary(regionName);
      
      // Re-check priority before any map movement operations
      if (state.clickPriority < myPriority) return;
      
      // Defer map movement operations to allow all handlers to run first
      state.setTimer('regionMapMovement', () => {
        // Re-check priority before executing deferred operations
        if (state.clickPriority < myPriority) return;
        
        // Use the global function to frame boundaries
        if (!frameRegionBoundary(regionName)) {
          // Fallback if no boundary found
          removeBoundaryHighlight();
          state.setTimer('regionFallback', () => {
            // Re-check priority before fallback operations
            if (state.clickPriority < myPriority) return;
            
            state.flags.forceFilteredReframe = true;
            state.flags.isRefreshButtonAction = true;
            applyFilterToMarkers();
            state.setTimer('regionFallbackCleanup', () => {
              state.flags.forceFilteredReframe = false;
              state.flags.isRefreshButtonAction = false;
            }, 1000);
          }, 200);
        }
      }, 10); // Small delay to let all handlers run first
    } else {
      // Region without boundary - use point location
      removeBoundaryHighlight();
      
      // Defer map movement operations to allow all handlers to run first
      state.setTimer('regionMapMovementFlyTo', () => {
        // Re-check priority before flying
        if (state.clickPriority < myPriority) return;
        
        // Fly to region point
        map.flyTo({
          center: feature.geometry.coordinates,
          zoom: 10,
          duration: 1000,
          essential: true
        });
      }, 10); // Small delay to let all handlers run first
    }
    
    state.setTimer('markerCleanup', () => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 800);
    
    // Reset priority quickly for next click
    state.setTimer('resetClickPriority', () => {
      state.clickPriority = 999;
    }, 50);
  };
  
  map.on('click', 'region-points', regionClickHandler);
  map.on('mouseenter', 'region-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'region-points', () => map.getCanvas().style.cursor = '');
}

// Add this new function to display subregion markers on the map
function addNativeSubregionMarkers() {
  if (!state.allSubregionFeatures || state.allSubregionFeatures.length === 0) return;
  
  mapLayers.addToBatch(() => {
    if (mapLayers.hasSource('subregions-source')) {
      map.getSource('subregions-source').setData({
        type: "FeatureCollection",
        features: state.allSubregionFeatures
      });
    } else {
      map.addSource('subregions-source', {
        type: 'geojson',
        data: {
          type: "FeatureCollection",
          features: state.allSubregionFeatures
        }
      });
      
      map.addLayer({
        id: 'subregion-points',
        type: 'symbol',
        source: 'subregions-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 12,
            10, 16,
            14, 18
          ],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 6,
          'text-offset': [0, 0],
          'text-anchor': 'center'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#6e3500',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 0,
            6, 1
          ]
        }
      });
      
      mapLayers.invalidateCache();
    }
  });
  
  setupSubregionMarkerClicks();
}

// Add click handlers for subregion markers
function setupSubregionMarkerClicks() {
  const subregionClickHandler = (e) => {
    // Subregion has priority 3
    const myPriority = 3;
    
    // Only handle if no one has claimed priority yet, or if we have higher priority
    if (state.clickPriority === 999 || state.clickPriority > myPriority) {
      state.clickPriority = myPriority;
    } else {
      return; // Someone with equal or higher priority already claimed it
    }
    
    const feature = e.features[0];
    const subregionName = feature.properties.name;
    
    // Prevent rapid clicks
    const currentTime = Date.now();
    const markerKey = `subregion-${subregionName}`;
    if (state.lastClickedMarker === markerKey && currentTime - state.lastClickTime < 1000) {
      return;
    }
    
    state.markerInteractionLock = true;
    state.lastClickedMarker = markerKey;
    state.lastClickTime = currentTime;
    window.isMarkerClick = true;
    
    // Use checkbox selection like regions do
    selectSubregionCheckbox(subregionName);
    
    toggleShowWhenFilteredElements(true);
    toggleSidebar('Left', true);
    
    // Get fresh coordinates from the clicked feature
    const coords = [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
    
    // Re-check priority before flying
    if (state.clickPriority < myPriority) return;
    
    // Fly to subregion center using fresh coordinates
    map.flyTo({
      center: coords,
      zoom: 10.5,
      duration: 1000,
      essential: true
    });
    
    state.setTimer('subregionMarkerCleanup', () => {
      window.isMarkerClick = false;
      state.markerInteractionLock = false;
    }, 800);
    
    // Reset priority quickly for next click
    state.setTimer('resetClickPriority', () => {
      state.clickPriority = 999;
    }, 50);
  };
  
  map.on('click', 'subregion-points', subregionClickHandler);
  map.on('mouseenter', 'subregion-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'subregion-points', () => map.getCanvas().style.cursor = '');
}


// SIMPLIFIED: No longer need to check CMS filter lists
function checkMapMarkersFiltering() {
  // Check if search box has content (indicates active search/filtering)
  const searchInput = document.getElementById('map-search');
  if (searchInput && searchInput.value.trim().length > 0) {
    return true;
  }
  
  // Check for active checkboxes
  const anyChecked = $('[checkbox-filter] input[type="checkbox"]:checked').length > 0;
  
  return anyChecked;
}

// SIMPLIFIED: Filter application based on checkboxes only
function applyFilterToMarkers(shouldReframe = true) {
  if (state.flags.isInitialLoad && !checkMapMarkersFiltering()) return;
  
  if (state.flags.skipNextReframe) {
    return;
  }
  
  // Get checked checkboxes - force fresh DOM query
  const checkedRegions = Array.from(document.querySelectorAll('[checkbox-filter="Governorate"] input:checked')).map(cb => cb.getAttribute('fs-list-value'));
  const checkedSubregions = Array.from(document.querySelectorAll('[checkbox-filter="Region"] input:checked')).map(cb => cb.getAttribute('fs-list-value'));
  const checkedLocalities = Array.from(document.querySelectorAll('[checkbox-filter="locality"] input:checked')).map(cb => cb.getAttribute('fs-list-value'));
  const checkedSettlements = Array.from(document.querySelectorAll('[checkbox-filter="settlement"] input:checked')).map(cb => cb.getAttribute('fs-list-value'));
  
  let visibleCoordinates = [];
  
  // Filter localities based on checkboxes
  if (checkedLocalities.length > 0) {
    const filteredLocalities = state.allLocalityFeatures.filter(f => 
      checkedLocalities.includes(f.properties.name)
    );
    
    if (mapLayers.hasSource('localities-source')) {
      sourceUpdater.updateSource('localities-source', {
        type: "FeatureCollection",
        features: filteredLocalities
      });
    }
    
    visibleCoordinates = filteredLocalities.map(f => f.geometry.coordinates);
  } else if (checkedSubregions.length > 0) {
    // Filter by subregion
    const filteredLocalities = state.allLocalityFeatures.filter(f => 
      checkedSubregions.includes(f.properties.subRegion)
    );
    
    if (mapLayers.hasSource('localities-source')) {
      sourceUpdater.updateSource('localities-source', {
        type: "FeatureCollection",
        features: filteredLocalities
      });
    }
    
    // For single subregion selection, use the subregion centroid instead of all localities
    if (checkedSubregions.length === 1 && state.allSubregionFeatures) {
      const selectedSubregion = checkedSubregions[0];
      const subregionFeature = state.allSubregionFeatures.find(f => 
        f.properties.name === selectedSubregion
      );
      
      if (subregionFeature) {
        // Use the subregion centroid for zooming
        visibleCoordinates = [subregionFeature.geometry.coordinates];
      } else {
        // Fallback to locality coordinates
        visibleCoordinates = filteredLocalities.map(f => f.geometry.coordinates);
      }
    } else {
      // Multiple subregions or fallback - use all locality coordinates
      visibleCoordinates = filteredLocalities.map(f => f.geometry.coordinates);
    }
  } else if (checkedRegions.length > 0) {
    // Filter by region
    const filteredLocalities = state.allLocalityFeatures.filter(f => 
      checkedRegions.includes(f.properties.region)
    );
    
    if (mapLayers.hasSource('localities-source')) {
      sourceUpdater.updateSource('localities-source', {
        type: "FeatureCollection",
        features: filteredLocalities
      });
    }
    
    visibleCoordinates = filteredLocalities.map(f => f.geometry.coordinates);
  } else {
    // No filtering - show all
    if (mapLayers.hasSource('localities-source')) {
      sourceUpdater.updateSource('localities-source', {
        type: "FeatureCollection",
        features: state.allLocalityFeatures
      });
    }
    visibleCoordinates = state.allLocalityFeatures.map(f => f.geometry.coordinates);
  }
  
  // Only reframe the map if shouldReframe is true
  if (shouldReframe && visibleCoordinates.length > 0) {
    const animationDuration = state.flags.isInitialLoad ? 600 : 1000;
    
    // Use cached bounds calculation
    const bounds = boundsCalculator.fromCoordinates(visibleCoordinates);
    
    map.fitBounds(bounds, {
      padding: {
        top: window.innerHeight * 0.15, 
        bottom: window.innerHeight * 0.15, 
        left: window.innerWidth * 0.15, 
        right: window.innerWidth * 0.15
      },
      maxZoom: 13,
      duration: animationDuration,
      essential: true
    });
  }
}

// Debounced filter update with smart timing
const handleFilterUpdate = eventManager.debounce(() => {
  if (window.isLinkClick || window.isMarkerClick || state.markerInteractionLock) return;
  if (state.flags.skipNextReframe) return;
  
  state.flags.isRefreshButtonAction = true;
  applyFilterToMarkers();
  state.setTimer('filterCleanup', () => {
    state.flags.isRefreshButtonAction = false;
  }, 1000);
}, 150, 'filterUpdate');

// Back to top button functionality
function setupBackToTopButton() {
  const button = $id('jump-to-top');
  const scrollContainer = $id('scroll-wrap');
  
  if (!button || !scrollContainer) {
    return;
  }
  
  // Initialize button state
  button.style.opacity = '0';
  button.style.display = 'flex';
  button.style.pointerEvents = 'none';
  
  const scrollThreshold = 100;
  let isVisible = false;
  
  // Update button visibility and opacity based on scroll position
  const updateButtonVisibility = () => {
    const scrollTop = scrollContainer.scrollTop;
    const shouldShow = scrollTop > scrollThreshold;
    
    if (shouldShow && !isVisible) {
      // Show button
      isVisible = true;
      button.style.display = 'flex';
      button.style.pointerEvents = 'auto';
      
      // Animate opacity based on scroll distance
      const opacity = Math.min(1, (scrollTop - scrollThreshold) / 100);
      button.style.opacity = opacity.toString();
      
    } else if (!shouldShow && isVisible) {
      // Hide button
      isVisible = false;
      button.style.opacity = '0';
      button.style.pointerEvents = 'none';
      
    } else if (shouldShow && isVisible) {
      // Update opacity while scrolling
      const opacity = Math.min(1, (scrollTop - scrollThreshold) / 100);
      button.style.opacity = opacity.toString();
    }
  };
  
  // Scroll to top instantly
  const scrollToTop = () => {
    scrollContainer.scrollTo({
      top: 0,
      behavior: 'auto' // Instant scroll
    });
  };
  
  // Add scroll event listener
  eventManager.add(scrollContainer, 'scroll', updateButtonVisibility);
  
  // Add click event listener
  eventManager.add(button, 'click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    scrollToTop();
  });
  
  // Watch for changes in #tagparent and auto-scroll to top
  const tagParent = $id('tagparent');
  if (tagParent) {
    const tagObserver = new MutationObserver((mutations) => {
      let hasChanges = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        scrollToTop();
      }
    });
    
    // Observe changes in tagparent
    tagObserver.observe(tagParent, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Store observer for cleanup
    tagParent._tagObserver = tagObserver;
  }
  
  // Initial visibility check
  updateButtonVisibility();
  
  // Back to top setup complete
}

// Consolidated controls with event delegation where possible
function setupControls() {
  const controlMap = {
    'AllEvents': () => $id('ClearAll')?.click(),
    'ToggleLeft': () => {
      const leftSidebar = $id('LeftSidebar');
      if (leftSidebar) toggleSidebar('Left', !leftSidebar.classList.contains('is-show'));
    },
    'ToggleSecondLeft': () => {
      const secondLeftSidebar = $id('SecondLeftSidebar');
      if (secondLeftSidebar) toggleSidebar('SecondLeft', !secondLeftSidebar.classList.contains('is-show'));
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
  
  // Sidebar controls - Fixed Right Sidebar Logic
  const setupSidebarControls = (selector, sidebarSide, eventType = 'click') => {
    const elements = $(selector);
    elements.forEach(element => {
      // Skip if already setup to prevent duplicate handlers
      if (element.dataset.sidebarSetup === 'true') return;
      
      const handler = () => {
        const sidebar = $id(`${sidebarSide}Sidebar`);
        if (!sidebar) return;
        
        const openRightSidebar = element.getAttribute('open-right-sidebar');
        const openSecondLeftSidebar = element.getAttribute('open-second-left-sidebar');
        
        // Handle Right sidebar specifically with working logic from your script
        if (sidebarSide === 'Right') {
          if (openRightSidebar === 'open-only') {
            toggleSidebar('Right', true);
          } else if (openRightSidebar === 'true') {
            const currentlyShowing = sidebar.classList.contains('is-show');
            toggleSidebar('Right', !currentlyShowing);
          }
        }
        // Handle SecondLeft sidebar specifically  
        else if (sidebarSide === 'SecondLeft') {
          if (openSecondLeftSidebar === 'open-only') {
            toggleSidebar('SecondLeft', true);
          } else if (openSecondLeftSidebar === 'true') {
            toggleSidebar('SecondLeft', !sidebar.classList.contains('is-show'));
          }
        }
        // Handle Left sidebar and other cases
        else {
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
  setupSidebarControls('[open-second-left-sidebar="true"], [open-second-left-sidebar="open-only"]', 'SecondLeft');
  setupSidebarControls('.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]', 'Left', 'change');
  setupSidebarControls('.OpenSecondLeftSidebar, [OpenSecondLeftSidebar], [opensecondleftsidebar]', 'SecondLeft', 'change');
  
  // Defer area controls loading
  setupDeferredAreaControls();
  setupBackToTopButton();
}

// Sidebar setup with better performance and cleaner management
function setupSidebars() {
  // Phase 2: Enhanced sidebar functionality (after immediate toggle is already working)
  // Remove any loading indicators since content is ready
  document.querySelectorAll('.sidebar-loading-indicator').forEach(el => el.remove());
  
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = sidebarCache.getSidebar(side);
    const tab = $id(`${side}SideTab`);
    const close = $id(`${side}SidebarClose`);
    
    if (!sidebar || !tab || !close) return false;
    // Skip if already setup OR if immediate handlers are present
    if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
    if (tab.dataset.immediateHandler === 'true') return true; // Skip if immediate handler exists
    
    // Batch style applications
    const cssTransitionProperty = side === 'SecondLeft' ? 'margin-left' : `margin-${side.toLowerCase()}`;
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
      
      // Lower z-index for other sidebars
      const allSides = ['Left', 'SecondLeft', 'Right'];
      allSides.forEach(otherSide => {
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

    // Use the main toggleSidebar function instead of internal logic
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
  
  const attemptSetup = (attempt = 1, maxAttempts = 7) => {  // Slightly increased from 5 to 7 attempts
    const leftReady = setupSidebarElement('Left');
    const secondLeftReady = setupSidebarElement('SecondLeft');
    const rightReady = setupSidebarElement('Right');
    
    if (leftReady && secondLeftReady && rightReady) {
      setupInitialMargins();
      state.setTimer('controlsInit', setupControls, 50);
      
      // Sidebars are ready - the MutationObserver will handle visibility detection
      return;
    }
    
    if (attempt < maxAttempts) {
      // Reasonable delays: [50, 150, 250, 500, 750, 1000, 1500]
      const delays = [50, 150, 250, 500, 750, 1000, 1500];
      const delay = delays[attempt - 1] || 1500;
      state.setTimer(`sidebarSetup-${attempt}`, () => attemptSetup(attempt + 1, maxAttempts), delay);
    } else {
      setupInitialMargins();
      state.setTimer('controlsInit', setupControls, 50);
      
      // Sidebars setup attempted - MutationObserver will handle the rest
    }
  };
  
  const setupInitialMargins = () => {
    if (window.innerWidth <= 478) return;
    
    ['Left', 'SecondLeft', 'Right'].forEach(side => {
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

// ENHANCED: Comprehensive optimization system initialization
function initializeOptimizationSystems() {
  // Enable performance monitoring
  if (window.performanceMonitor) {
    window.performanceMonitor.enable();
    window.performanceMonitor.startFrameRateMonitoring();
    
    // Set up periodic memory monitoring
    setInterval(() => {
      window.performanceMonitor.monitorMemoryUsage();
    }, 30000); // Every 30 seconds
  }
  
  // Initialize progressive loader with defined steps
  if (window.progressiveLoader) {
    const loadingSteps = [
      {
        name: 'map',
        userFacing: true,
        estimatedTime: 2000,
        dependencies: [],
        loader: () => Promise.resolve() // Map already loaded
      },
      {
        name: 'ui',
        userFacing: true,
        estimatedTime: 1000,
        dependencies: ['map'],
        loader: () => Promise.resolve() // UI already set up
      },
      {
        name: 'search',
        userFacing: true,
        estimatedTime: 1500,
        dependencies: ['ui'],
        loader: async () => {
          if (window.searchIndex && window.dataStore.localities.length > 0) {
            await window.searchIndex.buildIndex(window.dataStore.localities);
          }
        }
      },
      {
        name: 'advanced-search',
        userFacing: false,
        estimatedTime: 3000,
        dependencies: ['search'],
        loader: async () => {
          if (window.advancedSearchIndex) {
            // Build advanced search index for all data types
            window.dataStore.localities.forEach(item => {
              window.advancedSearchIndex.addToTrie(item.name, item.id, 'locality');
            });
            window.dataStore.settlements.forEach(item => {
              window.advancedSearchIndex.addToTrie(item.name, item.id, 'settlement');
            });
          }
        }
      },
      {
        name: 'settlements',
        userFacing: false,
        estimatedTime: 4000,
        dependencies: ['map'],
        loader: () => Promise.resolve() // Settlements already loaded
      },
      {
        name: 'analytics',
        userFacing: false,
        estimatedTime: 500,
        dependencies: [],
        loader: () => {
          // Initialize analytics if needed
          return Promise.resolve();
        }
      }
    ];
    
    window.progressiveLoader.defineSteps(loadingSteps);
    window.progressiveLoader.setupLazyLoading();
    
    // Load critical path immediately
    window.progressiveLoader.loadCriticalPath().then(() => {
      
      // Load deferred features in background
      window.progressiveLoader.loadDeferredFeatures();
    });
  }
  
  // Set up enhanced event delegation
  if (window.eventManager) {
    window.eventManager.setupEnhancedFormDelegation();
  }
  
  // Initialize Web Workers for heavy calculations
  if (window.workerManager) {
    // Pre-create workers for common tasks
    window.workerManager.createWorker('enhancedMapWorker', enhancedMapWorker.toString());
  }
  
  // Set up data loader for future requests
  if (window.dataLoader) {
    // Cache commonly requested URLs
    const commonUrls = {
      localities: 'https://example.com/localities.geojson', // Replace with actual URLs
      settlements: 'https://example.com/settlements.geojson'
    };
    
    // Preload critical data if not already loaded
    Object.entries(commonUrls).forEach(([key, url]) => {
      if (!window.dataStore[key] || window.dataStore[key].length === 0) {
        window.dataLoader.preloadData(key, url);
      }
    });
  }
  
  // Global error handling for optimization systems
  window.addEventListener('error', (event) => {
    if (window.performanceMonitor) {
      window.performanceMonitor.trackUserInteraction('error', 0);
    }
    // console.error('Optimization system error:', event.error);
  });
  
  // Periodic performance checks
  setInterval(() => {
    if (window.performanceMonitor && window.performanceMonitor.enabled) {
      const bottlenecks = window.performanceMonitor.detectBottlenecks();
      if (bottlenecks.length > 0) {
        // console.warn('Performance bottlenecks detected:', bottlenecks);
        
        // Auto-optimize if possible
        bottlenecks.forEach(bottleneck => {
          if (bottleneck.type === 'high_memory_usage') {
            window.performanceMonitor.triggerMemoryCleanup();
          }
        });
      }
    }
  }, 60000); // Every 60 seconds
  
}

// Initialize optimization systems when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOptimizationSystems);
} else {
  initializeOptimizationSystems();
}

// ========================
// LOCATION TAB LAZY LOADING
// ========================
(function setupLocationTabLazyLoading() {
  function setupLocationTabListener() {
    // Use event delegation for the Location tab - multiple selectors for reliability
    const locationTabSelectors = [
      '[data-w-tab="Locality/Region"]',  // Primary selector
      '#w-tabs-0-data-w-tab-2',          // ID selector as backup
    ];
    
    // Try immediate setup
    locationTabSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element.dataset.mapboxCheckboxListenerAdded === 'true') return;
        
        element.addEventListener('click', async function(e) {
          // Load settlement data and generate all checkboxes when Location tab is clicked
          if (APP_CONFIG.features.enableLazyCheckboxes) {
            
            // Load settlement data if not already loaded
            await loadSettlementsIfNeeded('tab-click');
            
            // Generate all checkboxes (including settlements now that data is loaded)
            generateAllCheckboxes();
          }
        });
        
        element.dataset.mapboxCheckboxListenerAdded = 'true';
      });
    });
    
    // Also use event delegation for dynamically added tabs
    document.addEventListener('click', async function(e) {
      const locationTab = e.target.closest('[data-w-tab="Locality/Region"]') ||
                         e.target.closest('#w-tabs-0-data-w-tab-2');
      
      if (locationTab && APP_CONFIG.features.enableLazyCheckboxes) {
        
        // Load settlement data if not already loaded
        await loadSettlementsIfNeeded('tab-click');
        
        // Generate all checkboxes (including settlements now that data is loaded)
        generateAllCheckboxes();
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLocationTabListener);
  } else {
    setupLocationTabListener();
  }
})();
