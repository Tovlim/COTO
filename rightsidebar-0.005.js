// Right Sidebar & Show-When-Filtered Script - Optimized 2025
// Extracted from comprehensive Mapbox script for focused functionality

// OPTIMIZED: Comprehensive DOM Element Cache
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
  
  // Multiple element getters with caching
  $(selector) {
    if (!this.listCache.has(selector)) {
      this.listCache.set(selector, Array.from(document.querySelectorAll(selector)));
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
  
  markStale() {
    this._isStale = true;
  }
}

// OPTIMIZED: Event Listener Management System
class OptimizedEventManager {
  constructor() {
    this.listeners = new Map(); // elementId -> [{event, handler, options}]
    this.debounceTimers = new Map();
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
    this.listeners.forEach((listeners, elementId) => {
      listeners.forEach(({ element, event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
    });
    
    // Clean up timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    
    // Clear all maps
    this.listeners.clear();
    this.debounceTimers.clear();
    
    console.log('Event manager cleaned up');
  }
  
  // Get stats for debugging
  getStats() {
    return {
      trackedListeners: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
      activeTimers: this.debounceTimers.size
    };
  }
}

// OPTIMIZED: Global DOM cache instance
const domCache = new OptimizedDOMCache();
const $ = (selector) => domCache.$(selector);
const $1 = (selector) => domCache.$1(selector);  
const $id = (id) => domCache.$id(id);

// OPTIMIZED: Global event manager
const eventManager = new OptimizedEventManager();

// OPTIMIZED: High-performance utilities
const utils = {
  // Cached utility functions
  _eventCache: new Map(),
  
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
  }
};

// State management for timers and flags
const state = {
  timers: new Map(),
  flags: {
    dropdownListenersSetup: false
  },
  
  setTimer(id, callback, delay) {
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
    }
    this.timers.set(id, setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, delay));
  },
  
  clearTimer(id) {
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    }
  },
  
  cleanup() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
};

// Toggle right sidebar function (simplified for single sidebar)
const toggleSidebar = (show = null) => {
  const sidebar = $id('RightSidebar');
  if (!sidebar) return;
  
  const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
  sidebar.classList.toggle('is-show', isShowing);
  
  const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
  
  if (window.innerWidth > 478) {
    sidebar.style.marginRight = isShowing ? '0' : `-${currentWidth + 1}px`;
  } else {
    sidebar.style.marginRight = isShowing ? '0' : '';
  }
  
  utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
  const arrowIcon = $1('[arrow-icon="right"]');
  if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
};

// Toggle filtered elements with immediate DOM updates
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
  
  console.log(`Filtered elements ${show ? 'shown' : 'hidden'}: ${elements.length} elements`);
};

// Check for filtering state using hiddentagparent method
const checkAndToggleFilteredElements = () => {
  // Check for hiddentagparent (Finsweet official filtering indicator)
  const hiddenTagParent = document.getElementById('hiddentagparent');
  const shouldShow = !!hiddenTagParent;
  
  toggleShowWhenFilteredElements(shouldShow);
  return shouldShow;
};

// OPTIMIZED: Smart filter list discovery with caching
const getAvailableFilterLists = (() => {
  let cachedLists = null;
  let lastCacheTime = 0;
  const cacheTimeout = 5000; // Cache for 5 seconds
  
  return () => {
    const now = Date.now();
    if (cachedLists && (now - lastCacheTime) < cacheTimeout) {
      return cachedLists;
    }
    
    const lists = [];
    let consecutiveGaps = 0;
    
    // More efficient scanning with early termination
    for (let i = 1; i <= 20; i++) {
      const listId = `cms-filter-list-${i}`;
      if ($id(listId)) {
        lists.push(listId);
        consecutiveGaps = 0;
      } else {
        consecutiveGaps++;
        if (consecutiveGaps >= 3 && lists.length === 0) {
          // Early termination if no lists found
          break;
        }
        if (consecutiveGaps >= 5) {
          // Stop after 5 consecutive gaps
          break;
        }
      }
    }
    
    cachedLists = lists;
    lastCacheTime = now;
    console.log(`Found ${lists.length} cms-filter-list elements:`, lists);
    return lists;
  };
})();

// Setup events for checkboxes with enhanced functionality
function setupCheckboxEvents(checkboxContainer) {
  // Handle data-auto-right-sidebar="true" (for right sidebar)
  const autoRightSidebarElements = checkboxContainer.querySelectorAll('[data-auto-right-sidebar="true"]');
  autoRightSidebarElements.forEach(element => {
    if (element.dataset.autoRightSidebarSetup === 'true') return;
    
    ['change', 'input'].forEach(eventType => {
      eventManager.add(element, eventType, () => {
        if (window.innerWidth > 478) {
          state.setTimer('checkboxAutoRightSidebar', () => toggleSidebar(true), 50);
        }
      });
    });
    element.dataset.autoRightSidebarSetup = 'true';
  });
  
  // Handle fs-cmsfilter-element filters
  const filterElements = checkboxContainer.querySelectorAll('[fs-cmsfilter-element="filters"] input, [fs-cmsfilter-element="filters"] select');
  filterElements.forEach(element => {
    if (element.dataset.filterElementSetup === 'true') return;
    
    eventManager.add(element, 'change', () => {
      state.setTimer('checkboxFilter', () => {
        // Trigger filtered elements check when filters change
        setTimeout(checkAndToggleFilteredElements, 50);
      }, 50);
    });
    element.dataset.filterElementSetup = 'true';
  });
  
  // Handle activate-filter-indicator functionality
  const indicatorActivators = checkboxContainer.querySelectorAll('[activate-filter-indicator]');
  indicatorActivators.forEach(activator => {
    if (activator.dataset.indicatorSetup === 'true') return;
    
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
    
    activator.dataset.indicatorSetup = 'true';
  });
}

// Setup checkbox functionality for all discovered lists
function setupCheckboxFunctionality() {
  console.log('Setting up checkbox functionality...');
  
  const lists = getAvailableFilterLists();
  
  if (lists.length === 0) {
    console.warn('No cms-filter-list elements found');
    return;
  }
  
  lists.forEach(listId => {
    const listContainer = $id(listId);
    if (!listContainer) {
      console.warn(`List container ${listId} not found`);
      return;
    }
    
    console.log(`Setting up checkboxes for ${listId}`);
    
    // Setup events for existing checkboxes in this list
    setupCheckboxEvents(listContainer);
    
    // Setup general checkbox and form event handlers
    const checkboxes = listContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    checkboxes.forEach(checkbox => {
      if (checkbox.dataset.generalCheckboxSetup === 'true') return;
      
      eventManager.add(checkbox, 'change', () => {
        // Check for filtered elements when any checkbox changes
        setTimeout(checkAndToggleFilteredElements, 50);
      });
      
      checkbox.dataset.generalCheckboxSetup = 'true';
    });
    
    // Setup form event handlers
    const forms = listContainer.querySelectorAll('form');
    forms.forEach(form => {
      if (form.dataset.formSetup === 'true') return;
      
      eventManager.add(form, 'change', () => {
        setTimeout(checkAndToggleFilteredElements, 100);
      });
      
      eventManager.add(form, 'input', () => {
        setTimeout(checkAndToggleFilteredElements, 100);
      });
      
      form.dataset.formSetup = 'true';
    });
  });
  
  console.log(`Checkbox functionality setup completed for ${lists.length} lists`);
}
const monitorTags = (() => {
  let isSetup = false; // Flag to prevent multiple setups
  let pollingTimer = null; // Store polling timer for cleanup
  
  return () => {
    // Prevent multiple setups
    if (isSetup) {
      console.log('Enhanced tag monitoring: Already setup, skipping');
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
        console.log('Enhanced tag monitoring: Cleaned up existing observer');
      }
      
      const observer = new MutationObserver(() => {
        // Immediate check when DOM changes
        checkAndToggleFilteredElements();
      });
      observer.observe(tagParent, {childList: true, subtree: true});
      
      // Store observer for cleanup
      tagParent._mutationObserver = observer;
      console.log('Enhanced tag monitoring: MutationObserver setup on tagparent');
    } else {
      console.log('Enhanced tag monitoring: tagparent not found, using polling fallback');
    }
    
    // Additional monitoring: Watch for checkbox changes
    const allCheckboxes = document.querySelectorAll('[checkbox-filter] input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
      if (!checkbox.dataset.filteredElementListener) {
        eventManager.add(checkbox, 'change', () => {
          setTimeout(checkAndToggleFilteredElements, 50);
        });
        checkbox.dataset.filteredElementListener = 'true';
      }
    });
    
    // Additional monitoring: Watch for form changes that might indicate filtering
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      if (!form.dataset.filteredElementListener) {
        eventManager.add(form, 'change', () => {
          setTimeout(checkAndToggleFilteredElements, 100);
        });
        eventManager.add(form, 'input', () => {
          setTimeout(checkAndToggleFilteredElements, 100);
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
    console.log('Enhanced tag monitoring: Setup completed');
    
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
      console.log('Enhanced tag monitoring: Cleanup completed');
    };
    
    // Store cleanup function for external access
    window.cleanupTagMonitoring = cleanup;
  };
})();

// Custom tab switcher
function setupTabSwitcher() {
  const tabTriggers = $('[open-tab]');
  
  tabTriggers.forEach(trigger => {
    if (trigger.dataset.tabSwitcherSetup === 'true') return;
    
    eventManager.add(trigger, 'click', function(e) {
      if (!this.hasAttribute('open-right-sidebar')) {
        e.preventDefault();
      }
      
      const groupName = this.getAttribute('open-tab');
      
      if (this.hasAttribute('open-right-sidebar')) {
        return;
      }
      
      const targetTab = $1(`[opened-tab="${groupName}"]`);
      if (targetTab) targetTab.click();
    });
    
    trigger.dataset.tabSwitcherSetup = 'true';
  });
}

// Setup right sidebar controls
function setupControls() {
  // #AllEvents functionality - triggers #ClearAll click
  const allEventsBtn = $id('AllEvents');
  if (allEventsBtn && !allEventsBtn.dataset.allEventsSetup) {
    eventManager.add(allEventsBtn, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const clearAllBtn = $id('ClearAll');
      if (clearAllBtn) {
        console.log('AllEvents clicked - triggering ClearAll');
        clearAllBtn.click();
      } else {
        console.warn('ClearAll element not found');
      }
    });
    allEventsBtn.dataset.allEventsSetup = 'true';
  }
  
  // Right sidebar controls with event delegation
  const setupSidebarControls = (selector, eventType = 'click') => {
    const elements = $(selector);
    console.log(`Found ${elements.length} elements with selector: ${selector}`);
    
    elements.forEach(element => {
      // Skip if already setup to prevent duplicate handlers
      if (element.dataset.rightSidebarSetup === 'true') return;
      
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const sidebar = $id('RightSidebar');
        if (!sidebar) {
          console.warn('RightSidebar element not found');
          return;
        }
        
        const openRightSidebar = element.getAttribute('open-right-sidebar');
        console.log(`Clicked element with open-right-sidebar="${openRightSidebar}"`);
        
        if (openRightSidebar === 'open-only') {
          console.log('Opening sidebar (open-only)');
          toggleSidebar(true);
        } else if (openRightSidebar === 'true') {
          console.log('Toggling sidebar (true)');
          const currentlyShowing = sidebar.classList.contains('is-show');
          console.log(`Current state: ${currentlyShowing ? 'open' : 'closed'}`);
          toggleSidebar(!currentlyShowing);
        }
        
        // Handle tab switching
        const groupName = element.getAttribute('open-tab');
        if (groupName) {
          state.setTimer(`openTab-${groupName}`, () => {
            const tab = $1(`[opened-tab="${groupName}"]`);
            if (tab) tab.click();
          }, 50);
        }
      };
      
      eventManager.add(element, eventType, handler);
      element.dataset.rightSidebarSetup = 'true';
    });
  };
  
  setupSidebarControls('[open-right-sidebar="true"], [open-right-sidebar="open-only"]');
  
  setupTabSwitcher();
}

// Right sidebar setup with performance optimization
function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = () => {
    const sidebar = $id('RightSidebar');
    const tab = $id('RightSideTab');
    const close = $id('RightSidebarClose');
    
    if (!sidebar || !tab || !close) return false;
    if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
    
    // Batch style applications
    utils.setStyles(sidebar, {
      transition: 'margin-right 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
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
    };

    const toggle = show => {
      if (show) bringToFront();
      sidebar.classList.toggle('is-show', show);
      
      const arrowIcon = $1('[arrow-icon="right"]');
      if (arrowIcon) arrowIcon.style.transform = show ? 'rotateY(180deg)' : 'rotateY(0deg)';
      
      if (window.innerWidth > 478) {
        const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
        sidebar.style.marginRight = show ? '0' : `-${currentWidth + 1}px`;
      } else {
        sidebar.style.marginRight = show ? '0' : '';
      }
      
      sidebar.style.pointerEvents = show ? 'auto' : '';
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
        toggle(!sidebar.classList.contains('is-show'));
      });
      tab.dataset.setupComplete = 'true';
    }
    
    if (close.dataset.setupComplete !== 'true') {
      eventManager.add(close, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(false);
      });
      close.dataset.setupComplete = 'true';
    }
    
    zIndex++;
    return true;
  };
  
  const attemptSetup = (attempt = 1, maxAttempts = 5) => {
    const rightReady = setupSidebarElement();
    
    if (rightReady) {
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
    
    const sidebar = $id('RightSidebar');
    if (sidebar && !sidebar.classList.contains('is-show')) {
      const currentWidth = parseInt(getComputedStyle(sidebar).width) || 300;
      sidebar.style.marginRight = `-${currentWidth + 1}px`;
    }
  };
  
  attemptSetup();
}

// Setup additional Finsweet event listeners for filtered elements
function setupFilteredElementsEvents() {
  ['fs-cmsfilter-filtered', 'fs-cmsfilter-pagination-page-changed', 'fs-cmsfilter-change', 'fs-cmsfilter-search', 'fs-cmsfilter-reset'].forEach(event => {
    eventManager.add(document, event, () => {
      setTimeout(checkAndToggleFilteredElements, 50);
    });
  });
}

// Initialize the script
function init() {
  console.log('Initializing Right Sidebar & Show-When-Filtered Script...');
  
  // Setup filtered elements monitoring
  checkAndToggleFilteredElements();
  setupFilteredElementsEvents();
  
  // Setup checkbox functionality for cms-filter-lists
  setupCheckboxFunctionality();
  
  // Setup tab switcher
  setupTabSwitcher();
  
  console.log('Right Sidebar Script initialization completed');
}

// DOM ready handlers
document.addEventListener('DOMContentLoaded', () => {
  setupSidebars();
  setupTabSwitcher();
});

window.addEventListener('load', () => {
  setupSidebars();
  setupTabSwitcher();
  init();
  
  // Check filtered elements after page is fully loaded
  state.setTimer('loadCheckFiltered', checkAndToggleFilteredElements, 200);
  
  // Retry checkbox setup with smart timing (in case cms-filter-lists load later)
  [500, 1000, 2000].forEach(delay => {
    state.setTimer(`checkboxRetry-${delay}`, () => {
      const lists = getAvailableFilterLists();
      if (lists.length > 0) {
        setupCheckboxFunctionality();
      }
    }, delay);
  });
});

// Enhanced tag monitoring initialization
state.setTimer('initMonitorTags', monitorTags, 100);

// Shared utilities for other scripts
window.rightSidebarUtilities = {
  domCache,
  eventManager,
  state,
  utils,
  checkAndToggleFilteredElements,
  toggleShowWhenFilteredElements,
  toggleSidebar,
  getAvailableFilterLists,
  setupCheckboxFunctionality,
  setupCheckboxEvents
};

// Performance monitoring
window.getRightSidebarPerformanceStats = () => {
  return {
    domCache: {
      cached: domCache.cache.size,
      selectors: domCache.selectorCache.size,
      lists: domCache.listCache.size
    },
    events: eventManager.getStats(),
    activeTimers: state.timers.size
  };
};

// Cleanup on page unload (prevent memory leaks)
window.addEventListener('beforeunload', () => {
  console.log('Cleaning up right sidebar resources...');
  
  // Clean up all managed resources
  eventManager.cleanup();
  state.cleanup();
  
  // Clean up mutation observers
  const tagParent = $id('tagparent');
  if (tagParent && tagParent._mutationObserver) {
    tagParent._mutationObserver.disconnect();
  }
  
  // Clean up custom cleanup functions
  if (window.cleanupTagMonitoring) {
    window.cleanupTagMonitoring();
  }
  
  console.log('Right sidebar cleanup completed');
});

// Performance-focused console logging
console.log('🚀 Right Sidebar & Show-When-Filtered Script Loaded');
console.log('Performance monitoring available via window.getRightSidebarPerformanceStats()');
console.log('Utilities available via window.rightSidebarUtilities');
