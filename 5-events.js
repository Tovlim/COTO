/**
 * MAPBOX INTEGRATED SCRIPT - EVENT MANAGEMENT
 * Event management system with OptimizedEventManager class
 */

// ========================
// OPTIMIZED EVENT MANAGER CLASS
// ========================
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
      this.debounce(() => {
        if (window.handleFilterUpdate) {
          window.handleFilterUpdate();
        }
      }, 50, 'filterUpdate')();
    }
    
    // Handle sidebar toggles
    if (target.matches('[data-auto-sidebar="true"]') ||
        target.matches('[data-auto-second-left-sidebar="true"]')) {
      if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
        const sidebarType = target.matches('[data-auto-second-left-sidebar="true"]') ? 'SecondLeft' : 'Left';
        this.debounce(() => {
          if (window.toggleSidebar) {
            window.toggleSidebar(sidebarType, true);
          }
        }, 50, 'sidebarUpdate')();
      }
    }
  }
  
  // Global input handler with delegation  
  handleGlobalInput(event) {
    const target = event.target;
    
    // Handle search inputs
    if (target.matches('[searchbox-filter]')) {
      this.debounce(() => {
        // Trigger search functionality
        const searchEvent = new CustomEvent('optimizedSearch', {
          detail: { value: target.value, element: target }
        });
        target.dispatchEvent(searchEvent);
      }, 150, `search-${target.id || 'default'}`)();
    }
    
    // Handle other input types that need sidebar updates
    if (target.matches('[data-auto-sidebar="true"]') && ['text', 'search'].includes(target.type)) {
      if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
        this.debounce(() => {
          if (window.toggleSidebar) {
            window.toggleSidebar('Left', true);
          }
        }, 50, 'sidebarUpdate')();
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
        
        this.debounce(() => {
          if (window.applyFilterToMarkers) {
            window.applyFilterToMarkers();
            this.debounce(() => {
              if (window.checkAndToggleFilteredElements) {
                window.checkAndToggleFilteredElements();
              }
            }, APP_CONFIG.timeouts.debounce, 'applyFilterCleanup')();
          }
        }, 50, 'applyFilter')();
      }
    }
    
    // Handle link clicks
    const link = target.closest('a');
    if (link && !link.classList.contains('filterrefresh') && 
        !link.hasAttribute('fs-cmsfilter-element') && 
        !link.closest('[fs-cmsfilter-element]') && 
        !link.classList.contains('w-pagination-next') && 
        !link.classList.contains('w-pagination-previous')) {
      window.isLinkClick = true;
      state.setTimer('linkCleanup', () => window.isLinkClick = false, 500);
    }
  }
  
  // Touch event handlers for mobile optimization
  handleTouchStart(event) {
    // Mark touch interactions for mobile-specific handling
    event.target.dataset.touchActive = 'true';
  }
  
  handleTouchEnd(event) {
    // Clean up touch markers
    setTimeout(() => {
      if (event.target.dataset.touchActive) {
        delete event.target.dataset.touchActive;
      }
    }, 100);
  }
  
  // Setup intersection observer for performance monitoring
  setupIntersectionObserver() {
    if (!FeatureDetection.hasIntersectionObserver) return;
    
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Element is visible - can perform optimizations
          entry.target.dataset.visible = 'true';
        } else {
          // Element is not visible - can pause expensive operations
          entry.target.dataset.visible = 'false';
        }
      });
    }, { threshold: 0.1 });
  }
  
  // Setup optimized resize handling
  setupOptimizedResize() {
    let resizeTimer;
    const handleResize = () => {
      this.debounce(() => {
        // Update mobile detection
        FeatureDetection.isMobile = window.innerWidth <= APP_CONFIG.breakpoints.mobile;
        
        // Emit resize event for components to handle
        EventBus.emit('window:resize', {
          width: window.innerWidth,
          height: window.innerHeight,
          isMobile: FeatureDetection.isMobile
        });
      }, 250, 'windowResize')();
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
  }
  
  // Add event listener with tracking
  add(element, event, handler, options = {}) {
    if (!element) return;
    
    // Generate unique ID for tracking
    const elementId = element.id || `elem_${Math.random().toString(36).substr(2, 9)}`;
    if (!element.id) element.id = elementId;
    
    // Store listener info
    if (!this.listeners.has(elementId)) {
      this.listeners.set(elementId, []);
    }
    
    this.listeners.get(elementId).push({
      event,
      handler,
      options
    });
    
    // Add the actual listener
    element.addEventListener(event, handler, options);
  }
  
  // Remove specific event listener
  remove(element, event, handler) {
    if (!element || !element.id) return;
    
    const elementId = element.id;
    if (this.listeners.has(elementId)) {
      const listeners = this.listeners.get(elementId);
      const index = listeners.findIndex(l => l.event === event && l.handler === handler);
      if (index > -1) {
        listeners.splice(index, 1);
        element.removeEventListener(event, handler);
        
        // Clean up if no more listeners
        if (listeners.length === 0) {
          this.listeners.delete(elementId);
        }
      }
    }
  }
  
  // Debounce utility
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
  
  // Clean up all listeners for an element
  cleanup(element) {
    if (!element || !element.id) return;
    
    const elementId = element.id;
    if (this.listeners.has(elementId)) {
      const listeners = this.listeners.get(elementId);
      listeners.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.listeners.delete(elementId);
    }
  }
  
  // Clean up all listeners and timers
  destroy() {
    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Clean up intersection observer
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    // Clear all tracked listeners
    this.listeners.clear();
    this.delegatedListeners.clear();
  }
}

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
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        ['change', 'input'].forEach(event => {
          if (event === 'input' && !['text', 'search'].includes(element.type)) return;
          
          eventManager.add(element, event, () => {
            if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
              state.setTimer('sidebarUpdate', () => {
                if (window.toggleSidebar) {
                  window.toggleSidebar(target, true);
                }
              }, APP_CONFIG.timeouts.debounce);
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
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        eventManager.add(element, 'change', () => {
          state.setTimer('filterUpdate', () => {
            if (window.handleFilterUpdate) {
              window.handleFilterUpdate();
            }
          }, APP_CONFIG.timeouts.debounce);
        });
      });
    });
  },
  
  // Setup map filter application events
  setupMapFilterEvents() {
    const filterElements = document.querySelectorAll('[apply-map-filter="true"], .filterrefresh, #filter-button');
    
    filterElements.forEach(element => {
      const events = element.getAttribute('apply-map-filter') === 'true' 
        ? ['click', 'keypress', 'input'] 
        : ['click'];
      
      events.forEach(eventType => {
        eventManager.add(element, eventType, () => {
          state.setTimer('applyFilter', () => {
            if (window.applyFilterToMarkers) {
              window.applyFilterToMarkers();
              state.setTimer('applyFilterCleanup', () => {
                if (window.checkAndToggleFilteredElements) {
                  window.checkAndToggleFilteredElements();
                }
              }, APP_CONFIG.timeouts.debounce);
            }
          }, 50);
        });
      });
    });
  },
  
  // Setup special form handling events
  setupFormEvents() {
    const forms = document.querySelectorAll('[fs-cmsfilter-element="form"]');
    forms.forEach(form => {
      // Form-specific event handling
      if (form.action && form.action.includes('cloneable') && window.location.href.includes('cloneable')) {
        eventManager.add(form, 'submit', (e) => {
          if (window.navigator.userAgent.includes('Firefox')) {
            state.setTimer('firefoxSubmit', () => {
              if (window.applyFilterToMarkers) {
                window.applyFilterToMarkers();
                state.setTimer('firefoxSubmitCleanup', () => {
                  if (window.checkAndToggleFilteredElements) {
                    window.checkAndToggleFilteredElements();
                  }
                }, APP_CONFIG.timeouts.debounce);
              }
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
        IdleExecution.scheduleUI(() => {
          if (window.checkAndToggleFilteredElements) {
            window.checkAndToggleFilteredElements();
          }
        }, { fallbackDelay: 100 });
      });
    });
  }
};

// ========================
// GLOBAL EVENT MANAGER INSTANCE
// ========================
// Global event manager instance
const eventManager = new OptimizedEventManager();

// Make globally available
window.eventManager = eventManager;
window.EventSetup = EventSetup;
