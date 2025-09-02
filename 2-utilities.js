/**
 * MAPBOX INTEGRATED SCRIPT - UTILITIES
 * Utility functions, helpers, and optimization tools
 */

// ========================
// IDLE EXECUTION UTILITY
// ========================
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
    try {
      const canvas = document.createElement('canvas');
      this.hasWebGL = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch(e) {
      this.hasWebGL = false;
    }
    
    this.hasWebWorker = typeof Worker !== 'undefined';
    this.hasFetch = 'fetch' in window;
    this.hasIntersectionObserver = 'IntersectionObserver' in window;
    
    this.isFirefox = typeof InstallTrigger !== 'undefined' || 
                     (navigator.userAgent.includes('Firefox') && !navigator.userAgent.includes('Seamonkey'));
    
    this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
                    (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
    
    this.isMobile = window.innerWidth <= APP_CONFIG.breakpoints.mobile;
    
    return this;
  },
  
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
// EVENT BUS
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

// ========================
// ERROR HANDLER
// ========================
const ErrorHandler = {
  categories: {
    STORAGE: 'storage',
    NETWORK: 'network', 
    DOM: 'dom',
    GENERATION: 'generation',
    UI: 'ui'
  },
  
  handle(error, category, context = {}) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      category,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
    
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
    return { recovered: true, fallback: 'memory' };
  },
  
  handleNetworkError(error, context) {
    return { 
      recovered: false, 
      retry: true,
      fallback: 'cache',
      retryDelay: context.retryDelay || 5000
    };
  },
  
  handleDOMError(error, context) {
    return { 
      recovered: false, 
      retry: true,
      retryDelay: context.retryDelay || 100,
      maxRetries: 3
    };
  },
  
  handleGenerationError(error, context) {
    return { 
      recovered: true, 
      continuePartial: true,
      affectedType: context.type
    };
  },
  
  handleUIError(error, context) {
    return { recovered: true, reducedFunctionality: true };
  },
  
  handleGenericError(error, context) {
    return { recovered: false };
  },
  
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
              setTimeout(attemptOperation, delay);
            }
          });
      };
      
      attemptOperation();
    });
  }
};

// ========================
// LIGHTWEIGHT CACHE
// ========================
class LightweightCache {
  constructor() {
    this.prefix = 'mapCache_';
    this.metaPrefix = 'mapMeta_';
  }

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

  get(storeName) {
    try {
      const key = this.prefix + storeName;
      const cached = JSON.parse(SafeStorage.getItem(key) || 'null');
      return cached;
    } catch (error) {
      return null;
    }
  }

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

  hashUrl(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }
}

// ========================
// LAZY WORKER MANAGER
// ========================
class LazyWorkerManager {
  constructor() {
    this.worker = null;
    this.pendingTasks = new Map();
    this.taskId = 0;
  }

  async processData(type, data) {
    const featureCount = data.features?.length || 0;
    
    if (featureCount < 100) {
      return this.processSync(type, data);
    }

    return this.processInWorker(type, data);
  }

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

  async processInWorker(type, data) {
    if (!this.worker) {
      this.createWorker();
    }

    if (!this.worker) {
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

// ========================
// UTILS OBJECT
// ========================
const utils = {
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
    requestAnimationFrame(() => {
      Object.assign(el.style, styles);
    });
  },
  
  calculateCentroid: (() => {
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
      
      if (cache.size < 100) {
        cache.set(key, result);
      }
      
      return result;
    };
  })()
};

// Global instances
let lightweightCache = null;
let lazyWorker = null;