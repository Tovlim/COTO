// ====================================================================
// SIDEBAR CORE MODULE - Streamlined Version
// Contains: DOM cache, Event manager, Sidebars (Right filter + Vertical navbar)
// Version: 0.070 - Stripped down for webflow-cms-client-mini-reports-with-filters.js
//
// Changes from v0.065:
// - Removed all Finsweet CMS Filter integration
// - Removed GeoJSON caching (localities/settlements)
// - Removed field-item auto-checking functionality
// - Removed SecondLeft sidebar
// - Replaced Left sidebar with .vertical-navbar (.is--open class)
// - Simplified event handling
// ====================================================================

(function(window) {
  'use strict';

  // Skip initialization if already loaded
  if (window.SidebarCore) return;

  // ====================================================================
  // CONFIGURATION
  // ====================================================================
  const CONFIG = {
    NAVBAR_SELECTOR: '.vertical-navbar',
    NAVBAR_OPEN_CLASS: 'is--open',
    RIGHT_SIDEBAR_ID: 'RightSidebar'
  };

  // Track whether CMS reports have finished initial loading
  let cmsReportsLoaded = false;

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
        this.fallback.set(key, value);
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
  }

  // ====================================================================
  // OPTIMIZED DOM CACHE
  // ====================================================================
  class OptimizedDOMCache {
    constructor() {
      this.cache = new Map();
      this.selectorCache = new Map();
      this.listCache = new Map();
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
    }

    invalidateElement(id) {
      this.cache.delete(id);
    }
  }

  // ====================================================================
  // EVENT MANAGER
  // ====================================================================
  class OptimizedEventManager {
    constructor() {
      this.listeners = new Map();
      this.debounceTimers = new Map();
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
      this.listeners.forEach((listeners) => {
        listeners.forEach(({ element, event, handler, options }) => {
          if (element) element.removeEventListener(event, handler, options);
        });
      });

      this.debounceTimers.forEach(timer => clearTimeout(timer));

      this.listeners.clear();
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
  // GLOBAL INSTANCES
  // ====================================================================
  const safeStorage = new SafeStorage();
  const domCache = new OptimizedDOMCache();
  const eventManager = new OptimizedEventManager();
  const state = new SimpleState();

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
  // RIGHT SIDEBAR MANAGEMENT
  // ====================================================================
  const rightSidebarCache = {
    element: null,
    arrow: null,
    width: null,

    getSidebar() {
      if (!this.element) {
        this.element = $id(CONFIG.RIGHT_SIDEBAR_ID);
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

  const closeRightSidebar = () => {
    const sidebar = rightSidebarCache.getSidebar();
    if (!sidebar || !sidebar.classList.contains('is-show')) return;

    sidebar.classList.remove('is-show');

    const arrowIcon = rightSidebarCache.getArrow();
    if (arrowIcon) arrowIcon.style.transform = 'rotateY(0deg)';

    if (window.innerWidth > 478) {
      const width = rightSidebarCache.getWidth();
      sidebar.style.marginRight = `-${width + 1}px`;
    } else {
      sidebar.style.marginRight = '';
    }

    sidebar.style.pointerEvents = '';
  };

  const toggleRightSidebar = (show = null) => {
    const sidebar = rightSidebarCache.getSidebar();
    if (!sidebar) return;

    // Prevent opening until CMS reports have loaded
    const wouldOpen = show !== null ? show : !sidebar.classList.contains('is-show');
    if (wouldOpen && !cmsReportsLoaded) return;

    const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
    sidebar.classList.toggle('is-show', isShowing);

    // Dispatch event when Right sidebar opens
    if (isShowing) {
      document.dispatchEvent(new CustomEvent('rightSidebarOpened'));
      // Close navbar when right sidebar opens
      closeNavbar();
    }

    const arrowIcon = rightSidebarCache.getArrow();

    if (window.innerWidth > 478) {
      const width = rightSidebarCache.getWidth();
      sidebar.style.marginRight = isShowing ? '0' : `-${width + 1}px`;
    } else {
      sidebar.style.marginRight = isShowing ? '0' : '';
    }

    utils.setStyles(sidebar, { pointerEvents: isShowing ? 'auto' : '' });
    if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
  };

  // ====================================================================
  // VERTICAL NAVBAR MANAGEMENT
  // ====================================================================
  const navbarCache = {
    element: null,
    width: null,

    getNavbar() {
      if (!this.element) {
        this.element = $1(CONFIG.NAVBAR_SELECTOR);
      }
      return this.element;
    },

    getWidth() {
      if (!this.width) {
        const navbar = this.getNavbar();
        if (navbar) {
          this.width = parseInt(getComputedStyle(navbar).width) || 300;
        }
      }
      return this.width || 300;
    },

    invalidate() {
      this.element = null;
      this.width = null;
    }
  };

  const closeNavbar = () => {
    // Only operate on mobile/tablet (991px and below)
    if (window.innerWidth > 991) return;

    const navbar = navbarCache.getNavbar();
    if (!navbar || !navbar.classList.contains(CONFIG.NAVBAR_OPEN_CLASS)) return;

    navbar.classList.remove(CONFIG.NAVBAR_OPEN_CLASS);

    if (window.innerWidth > 478) {
      const width = navbarCache.getWidth();
      navbar.style.marginLeft = `-${width + 1}px`;
    } else {
      navbar.style.marginLeft = '';
    }

    navbar.style.pointerEvents = '';
  };

  const openNavbar = () => {
    // Only operate on mobile/tablet (991px and below)
    if (window.innerWidth > 991) return;

    const navbar = navbarCache.getNavbar();
    if (!navbar) return;

    // Prevent opening until CMS reports have loaded
    if (!cmsReportsLoaded) return;

    navbar.classList.add(CONFIG.NAVBAR_OPEN_CLASS);

    // Close right sidebar when navbar opens
    closeRightSidebar();

    if (window.innerWidth > 478) {
      navbar.style.marginLeft = '0';
    } else {
      navbar.style.marginLeft = '0';
    }

    navbar.style.pointerEvents = 'auto';
  };

  const toggleNavbar = (show = null) => {
    // Only operate on mobile/tablet (991px and below)
    if (window.innerWidth > 991) return;

    const navbar = navbarCache.getNavbar();
    if (!navbar) return;

    const isCurrentlyOpen = navbar.classList.contains(CONFIG.NAVBAR_OPEN_CLASS);
    const shouldOpen = show !== null ? show : !isCurrentlyOpen;

    if (shouldOpen) {
      openNavbar();
    } else {
      closeNavbar();
    }
  };

  // ====================================================================
  // CLICK OUTSIDE HANDLER
  // ====================================================================
  const setupClickOutsideHandler = () => {
    document.addEventListener('click', (e) => {
      const navbar = navbarCache.getNavbar();
      const rightSidebar = rightSidebarCache.getSidebar();

      // Check if click is outside navbar
      if (navbar && navbar.classList.contains(CONFIG.NAVBAR_OPEN_CLASS)) {
        const isInsideNavbar = navbar.contains(e.target);
        const isOpenTrigger = e.target.closest('[open-nav-sidebar="true"]');

        if (!isInsideNavbar && !isOpenTrigger) {
          closeNavbar();
        }
      }

      // Check if click is outside right sidebar (optional - remove if not needed)
      // Uncomment below if you want right sidebar to close on outside click too
      /*
      if (rightSidebar && rightSidebar.classList.contains('is-show')) {
        const isInsideSidebar = rightSidebar.contains(e.target);
        const isOpenTrigger = e.target.closest('[open-right-sidebar="true"]') ||
                              e.target.closest('[open-right-sidebar="open-only"]');

        if (!isInsideSidebar && !isOpenTrigger) {
          closeRightSidebar();
        }
      }
      */
    });
  };


  // ====================================================================
  // SETUP CONTROLS
  // ====================================================================
  function setupControls() {
    // Setup navbar open triggers
    const openNavTriggers = $('[open-nav-sidebar="true"]');
    openNavTriggers.forEach(trigger => {
      if (trigger.dataset.navSetup === 'true') return;

      eventManager.add(trigger, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleNavbar();
      });

      trigger.dataset.navSetup = 'true';
    });

    // Setup navbar close triggers
    const closeNavTriggers = $('[close-nav-sidebar="true"]');
    closeNavTriggers.forEach(trigger => {
      if (trigger.dataset.navCloseSetup === 'true') return;

      eventManager.add(trigger, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeNavbar();
      });

      trigger.dataset.navCloseSetup = 'true';
    });

    // Setup right sidebar triggers
    const rightSidebarTriggers = $('[open-right-sidebar="true"], [open-right-sidebar="open-only"]');
    rightSidebarTriggers.forEach(trigger => {
      if (trigger.dataset.sidebarSetup === 'true') return;

      eventManager.add(trigger, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const openType = trigger.getAttribute('open-right-sidebar');
        if (openType === 'open-only') {
          toggleRightSidebar(true);
        } else {
          toggleRightSidebar();
        }
      });

      trigger.dataset.sidebarSetup = 'true';
    });

    // Setup right sidebar tab and close button
    const rightTab = $id('RightSideTab');
    const rightClose = $id('RightSidebarClose');

    if (rightTab && rightTab.dataset.setupComplete !== 'true') {
      eventManager.add(rightTab, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleRightSidebar();
      });
      rightTab.dataset.setupComplete = 'true';
    }

    if (rightClose && rightClose.dataset.setupComplete !== 'true') {
      eventManager.add(rightClose, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleRightSidebar(false);
      });
      rightClose.dataset.setupComplete = 'true';
    }

  }

  // ====================================================================
  // SETUP SIDEBARS
  // ====================================================================
  function setupSidebars() {
    const setupRightSidebar = () => {
      const sidebar = rightSidebarCache.getSidebar();
      if (!sidebar) return false;

      utils.setStyles(sidebar, {
        transition: 'margin-right 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative'
      });

      return true;
    };

    const setupNavbar = () => {
      const navbar = navbarCache.getNavbar();
      if (!navbar) return false;

      utils.setStyles(navbar, {
        transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      });

      return true;
    };

    const setupInitialMargins = () => {
      if (window.innerWidth > 478) {
        // Right sidebar initial margin
        const rightSidebar = rightSidebarCache.getSidebar();
        if (rightSidebar && !rightSidebar.classList.contains('is-show')) {
          const width = rightSidebarCache.getWidth();
          rightSidebar.style.marginRight = `-${width + 1}px`;
        }

        // Navbar initial margin (only on 991px and below)
        if (window.innerWidth <= 991) {
          const navbar = navbarCache.getNavbar();
          if (navbar && !navbar.classList.contains(CONFIG.NAVBAR_OPEN_CLASS)) {
            const width = navbarCache.getWidth();
            navbar.style.marginLeft = `-${width + 1}px`;
          }
        }
      }
    };

    const attemptSetup = (attempt = 1, maxAttempts = 3) => {
      const rightReady = setupRightSidebar();
      const navbarReady = setupNavbar();

      if (rightReady || navbarReady) {
        setupInitialMargins();
        setupControls();
        setupClickOutsideHandler();
        return;
      }

      if (attempt < maxAttempts) {
        const delay = [50, 100, 200][attempt - 1] || 200;
        state.setTimer(`sidebarSetup-${attempt}`, () => attemptSetup(attempt + 1, maxAttempts), delay);
      } else {
        // Final attempt - setup with whatever elements are available
        setupInitialMargins();
        setupControls();
        setupClickOutsideHandler();
      }
    };

    attemptSetup();
  }

  function hideSidebarLoadingIndicators() {
    const loadingIndicators = document.querySelectorAll('[sidebar-loading="indicator"]');
    if (loadingIndicators.length === 0) return;

    loadingIndicators.forEach(indicator => {
      indicator.style.display = 'none';
    });
  }

  // ====================================================================
  // INITIALIZATION
  // ====================================================================
  function initializeCore() {
    setupSidebars();
  }

  // ====================================================================
  // PUBLIC API
  // ====================================================================
  window.SidebarCore = {
    // Core utilities
    domCache,
    eventManager,
    state,
    safeStorage,
    utils,

    // Shortcuts
    $,
    $1,
    $id,

    // Right sidebar functions
    toggleRightSidebar,
    closeRightSidebar,
    rightSidebarCache,

    // Navbar functions
    toggleNavbar,
    openNavbar,
    closeNavbar,
    navbarCache,

    // Initialization
    init: initializeCore
  };

  // ====================================================================
  // CMS DATA LOADED LISTENER
  // ====================================================================
  window.addEventListener('cmsDataLoaded', function() {
    cmsReportsLoaded = true;
    hideSidebarLoadingIndicators();
  }, { once: true });

  // ====================================================================
  // AUTO-INITIALIZATION
  // ====================================================================
  // Listen for site search sidebar opening to close other sidebars
  document.addEventListener('siteSearchSidebarOpened', () => {
    closeRightSidebar();
    closeNavbar();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCore);
  } else {
    initializeCore();
  }

  window.addEventListener('beforeunload', () => {
    eventManager.cleanup();
    state.cleanup();
    rightSidebarCache.invalidate();
    navbarCache.invalidate();
  });

})(window);
