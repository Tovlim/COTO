// SIDEBAR & UI MANAGEMENT SCRIPT - No Map Version
// Includes: Sidebar functionality, Back-to-top button, Filtered element toggling, Checkbox consolidation

// ========================
// OPTIMIZED DOM CACHE
// ========================

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
  
  // Smart cache refresh
  refresh() {
    if (this._isStale) {
      this.invalidate();
    }
  }
  
  markStale() {
    this._isStale = true;
  }
}

// Global DOM cache instance
const domCache = new OptimizedDOMCache();
const $ = (selector) => domCache.$(selector);
const $1 = (selector) => domCache.$1(selector);  
const $id = (id) => domCache.$id(id);

// ========================
// EVENT MANAGER
// ========================

class OptimizedEventManager {
  constructor() {
    this.listeners = new Map();
    this.delegatedListeners = new Map();
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
  
  // Clean up all listeners
  cleanup() {
    // Clean up regular listeners
    this.listeners.forEach((listeners, elementId) => {
      listeners.forEach(({ element, event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
    });
    
    // Clean up timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    
    // Clear all maps
    this.listeners.clear();
    this.delegatedListeners.clear();
    this.debounceTimers.clear();
  }
}

// Global event manager
const eventManager = new OptimizedEventManager();

// ========================
// STATE MANAGEMENT
// ========================

class SimpleState {
  constructor() {
    this.timers = new Map();
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

// Global state
const state = new SimpleState();

// ========================
// UTILITIES
// ========================

const utils = {
  setStyles: (el, styles) => {
    requestAnimationFrame(() => {
      Object.assign(el.style, styles);
    });
  }
};

// ========================
// CHECKBOX CONSOLIDATION
// ========================

function consolidateLocalityCheckboxes() {
  const targetContainer = $id('locality-check-list');
  if (!targetContainer) {
    console.warn('Target container #locality-check-list not found');
    return;
  }
  
  // Find all locality checkboxes from various source lists
  const checkboxes = [];
  let sourceIndex = 1;
  
  // Keep looking for source lists until we don't find any
  while (true) {
    const sourceList = $id(`locality-check-source-${sourceIndex}`);
    if (!sourceList) break;
    
    // Find all .locality-checkbox elements within this source
    const sourceCheckboxes = sourceList.querySelectorAll('.locality-checkbox');
    checkboxes.push(...Array.from(sourceCheckboxes));
    
    sourceIndex++;
  }
  
  if (checkboxes.length === 0) {
    console.log('No locality checkboxes found to consolidate');
    return;
  }
  
  console.log(`Found ${checkboxes.length} locality checkboxes to consolidate`);
  
  // Sort checkboxes alphabetically by locality name
  checkboxes.sort((a, b) => {
    const nameA = a.querySelector('.test3.w-form-label')?.textContent.trim() || '';
    const nameB = b.querySelector('.test3.w-form-label')?.textContent.trim() || '';
    return nameA.localeCompare(nameB);
  });
  
  // Clear the target container
  targetContainer.innerHTML = '';
  
  // Move all checkboxes to the target container
  const fragment = document.createDocumentFragment();
  checkboxes.forEach((checkbox, index) => {
    // Get the parent collection item
    const collectionItem = checkbox.closest('.collection-item');
    if (collectionItem) {
      // Clone the entire collection item to preserve structure
      const clonedItem = collectionItem.cloneNode(true);
      
      // Remove any duplicate IDs to avoid conflicts
      const labelElement = clonedItem.querySelector('#locality-checkbox');
      if (labelElement) {
        labelElement.removeAttribute('id');
      }
      
      fragment.appendChild(clonedItem);
      
      // Setup events for the checkbox
      setupCheckboxEvents(clonedItem);
    }
  });
  
  targetContainer.appendChild(fragment);
  
  // Invalidate DOM cache since we modified the DOM
  domCache.markStale();
  
  console.log('Locality checkboxes consolidated successfully');
}

// Setup events for consolidated checkboxes
function setupCheckboxEvents(checkboxContainer) {
  // Handle data-auto-sidebar="true"
  const autoSidebarElements = checkboxContainer.querySelectorAll('[data-auto-sidebar="true"]');
  autoSidebarElements.forEach(element => {
    ['change', 'input'].forEach(eventType => {
      eventManager.add(element, eventType, () => {
        if (window.innerWidth > 991) {
          state.setTimer('checkboxAutoSidebar', () => toggleSidebar('Left', true), 50);
        }
      });
    });
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
    
    // Add change event listener
    if (activator.type === 'checkbox' || activator.type === 'radio') {
      eventManager.add(activator, 'change', () => {
        const shouldShow = hasActiveFilters();
        toggleIndicators(shouldShow);
      });
    }
  });
}

// ========================
// SIDEBAR MANAGEMENT
// ========================

// Sidebar element and arrow icon caching
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

// Helper function to close a sidebar
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
  if (window.innerWidth > 478) {
    const width = sidebarCache.getWidth(side);
    sidebar.style[jsMarginProperty] = `-${width + 1}px`;
  } else {
    sidebar.style[jsMarginProperty] = '';
  }
  
  // Reset pointer events
  sidebar.style.pointerEvents = '';
};

// Toggle sidebar with improved caching and helper functions
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
    
    // Close other sidebars based on screen size
    if (isShowing) {
      if (window.innerWidth <= 991) {
        // Close ALL other sidebars on devices 991px and down
        ['Left', 'Right'].forEach(otherSide => {
          if (otherSide !== side) closeSidebar(otherSide);
        });
      }
    }
  } else {
    // Mobile (478px and down): use margin behavior and close all other sidebars
    sidebar.style[jsMarginProperty] = isShowing ? '0' : '';
    if (isShowing) {
      ['Left', 'Right'].forEach(otherSide => {
        if (otherSide !== side) closeSidebar(otherSide);
      });
    }
  }
  
  // Set pointer events and arrow icon for the current sidebar
  utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
  if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
};

// ========================
// FILTERED ELEMENTS
// ========================

// Toggle filtered elements with immediate DOM updates
const toggleShowWhenFilteredElements = show => {
  const elements = document.querySelectorAll('[show-when-filtered="true"]');
  if (elements.length === 0) return;
  
  elements.forEach(element => {
    element.style.display = show ? 'block' : 'none';
    element.style.visibility = show ? 'visible' : 'hidden';
    element.style.opacity = show ? '1' : '0';
    element.style.pointerEvents = show ? 'auto' : 'none';
  });
};

// Check and toggle filtered elements
const checkAndToggleFilteredElements = () => {
  // Check for hiddentagparent (Finsweet official filtering indicator)
  const hiddenTagParent = document.getElementById('hiddentagparent');
  const shouldShow = !!hiddenTagParent;
  
  toggleShowWhenFilteredElements(shouldShow);
  return shouldShow;
};

// Monitor tags for changes
const monitorTags = (() => {
  let isSetup = false;
  let pollingTimer = null;
  
  return () => {
    if (isSetup) return;
    
    // Initial check
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
    
    // Watch for checkbox changes
    const allCheckboxes = document.querySelectorAll('[checkbox-filter] input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
      if (!checkbox.dataset.filteredElementListener) {
        eventManager.add(checkbox, 'change', () => {
          setTimeout(checkAndToggleFilteredElements, 50);
        });
        checkbox.dataset.filteredElementListener = 'true';
      }
    });
    
    // Watch for form changes
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
    
    // Fallback polling
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

// ========================
// BACK TO TOP BUTTON
// ========================

function setupBackToTopButton() {
  const button = $id('jump-to-top');
  const scrollContainer = $id('scroll-wrap');
  
  if (!button || !scrollContainer) return;
  
  // Initialize button state
  button.style.opacity = '0';
  button.style.display = 'flex';
  button.style.pointerEvents = 'none';
  
  const scrollThreshold = 100;
  let isVisible = false;
  
  // Update button visibility
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
  
  // Scroll to top instantly
  const scrollToTop = () => {
    scrollContainer.scrollTo({
      top: 0,
      behavior: 'auto'
    });
  };
  
  // Add event listeners
  eventManager.add(scrollContainer, 'scroll', updateButtonVisibility);
  eventManager.add(button, 'click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    scrollToTop();
  });
  
  // Watch for changes in #tagparent
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
  
  // Initial visibility check
  updateButtonVisibility();
}

// ========================
// SIDEBAR CONTROLS
// ========================

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
  
  // Sidebar controls
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
  
  setupBackToTopButton();
}

// ========================
// SIDEBAR SETUP
// ========================

function setupSidebars() {
  let zIndex = 1000;
  
  const setupSidebarElement = (side) => {
    const sidebar = sidebarCache.getSidebar(side);
    const tab = $id(`${side}SideTab`);
    const close = $id(`${side}SidebarClose`);
    
    if (!sidebar || !tab || !close) return false;
    if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') return true;
    
    // Batch style applications
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
      
      // Lower z-index for other sidebars
      ['Left', 'Right'].forEach(otherSide => {
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
    
    ['Left', 'Right'].forEach(side => {
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

// ========================
// EVENT SETUP
// ========================

function setupEvents() {
  // Auto-sidebar functionality
  const eventHandlers = [
    {selector: '[data-auto-sidebar="true"]', events: ['change', 'input'], handler: () => {
      if (window.innerWidth > 991) {
        state.setTimer('autoSidebar', () => toggleSidebar('Left', true), 50);
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
  
  // Finsweet event listeners for filtered elements
  ['fs-cmsfilter-change', 'fs-cmsfilter-search', 'fs-cmsfilter-reset', 'fs-cmsfilter-filtered'].forEach(event => {
    eventManager.add(document, event, () => {
      setTimeout(checkAndToggleFilteredElements, 100);
    });
  });
  
  // Firefox form handling
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

// ========================
// INITIALIZATION
// ========================

document.addEventListener('DOMContentLoaded', () => {
  // Consolidate checkboxes first
  consolidateLocalityCheckboxes();
  
  setupSidebars();
  setupEvents();
  
  // Start monitoring tags
  state.setTimer('initMonitorTags', () => {
    monitorTags();
  }, 100);
});

window.addEventListener('load', () => {
  // Try consolidating checkboxes again in case some loaded late
  if (!$id('locality-check-list')?.hasChildNodes()) {
    consolidateLocalityCheckboxes();
  }
  
  setupSidebars();
  state.setTimer('loadCheckFiltered', checkAndToggleFilteredElements, 200);
});

// ========================
// CLEANUP
// ========================

window.addEventListener('beforeunload', () => {
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
