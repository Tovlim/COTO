// ====================================================================
// SIMPLIFIED LEFT SIDEBAR MODULE
// Contains: DOM cache, Event manager, Left Sidebar only
// ====================================================================

(function(window) {
  'use strict';
  
  // Skip initialization if already loaded
  if (window.LeftSidebarModule) return;
  
  // ====================================================================
  // OPTIMIZED DOM CACHE
  // ====================================================================
  class OptimizedDOMCache {
    constructor() {
      this.cache = new Map();
      this.selectorCache = new Map();
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
    
    invalidate() {
      this.cache.clear();
      this.selectorCache.clear();
    }
  }
  
  // ====================================================================
  // EVENT MANAGER
  // ====================================================================
  class OptimizedEventManager {
    constructor() {
      this.listeners = new Map();
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
    
    cleanup() {
      this.listeners.forEach((listeners, elementId) => {
        listeners.forEach(({ element, event, handler, options }) => {
          if (element) element.removeEventListener(event, handler, options);
        });
      });
      
      this.listeners.clear();
    }
  }
  
  // ====================================================================
  // GLOBAL INSTANCES
  // ====================================================================
  const domCache = new OptimizedDOMCache();
  const eventManager = new OptimizedEventManager();
  
  // ====================================================================
  // UTILITIES
  // ====================================================================
  const utils = {
    setStyles: (el, styles) => {
      if (!el) return;
      requestAnimationFrame(() => {
        Object.assign(el.style, styles);
      });
    }
  };
  
  // ====================================================================
  // LEFT SIDEBAR MANAGEMENT
  // ====================================================================
  const leftSidebarCache = {
    sidebar: null,
    arrow: null,
    width: null,
    
    getSidebar() {
      if (!this.sidebar) {
        this.sidebar = domCache.$id('LeftSidebar');
      }
      return this.sidebar;
    },
    
    getArrow() {
      if (!this.arrow) {
        this.arrow = domCache.$1('[arrow-icon="left"]');
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
      this.sidebar = null;
      this.arrow = null;
      this.width = null;
    }
  };
  
  const closeLeftSidebar = () => {
    const sidebar = leftSidebarCache.getSidebar();
    if (!sidebar || !sidebar.classList.contains('is-show')) return;
    
    sidebar.classList.remove('is-show');
    
    const arrowIcon = leftSidebarCache.getArrow();
    if (arrowIcon) arrowIcon.style.transform = 'rotateY(0deg)';
    
    if (window.innerWidth > 478) {
      const width = leftSidebarCache.getWidth();
      sidebar.style.marginLeft = `-${width + 1}px`;
    } else {
      sidebar.style.marginLeft = '';
    }
    
    sidebar.style.pointerEvents = '';
  };
  
  const toggleLeftSidebar = (show = null) => {
    const sidebar = leftSidebarCache.getSidebar();
    if (!sidebar) return;
    
    const isShowing = show !== null ? show : !sidebar.classList.contains('is-show');
    sidebar.classList.toggle('is-show', isShowing);
    
    const arrowIcon = leftSidebarCache.getArrow();
    
    if (window.innerWidth > 478) {
      const width = leftSidebarCache.getWidth();
      sidebar.style.marginLeft = isShowing ? '0' : `-${width + 1}px`;
    } else {
      sidebar.style.marginLeft = isShowing ? '0' : '';
    }
    
    utils.setStyles(sidebar, {pointerEvents: isShowing ? 'auto' : ''});
    if (arrowIcon) arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
  };
  
  // ====================================================================
  // BACK TO TOP BUTTON
  // ====================================================================
  function setupBackToTopButton() {
    const button = domCache.$id('jump-to-top');
    const scrollContainer = domCache.$id('scroll-wrap');
    
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
    
    updateButtonVisibility();
  }

  // ====================================================================
  // SETUP FUNCTIONS
  // ====================================================================
  function setupLeftSidebar() {
    const sidebar = leftSidebarCache.getSidebar();
    const tab = domCache.$id('LeftSideTab');
    const close = domCache.$id('LeftSidebarClose');
    
    if (!sidebar || !tab || !close) {
      console.warn('Left sidebar elements not found');
      return false;
    }
    
    if (tab.dataset.setupComplete === 'true' && close.dataset.setupComplete === 'true') {
      return true;
    }
    
    // Setup sidebar styles
    utils.setStyles(sidebar, {
      transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative'
    });
    
    utils.setStyles(tab, {
      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
    });
    
    // Setup tab click handler
    if (tab.dataset.setupComplete !== 'true') {
      eventManager.add(tab, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLeftSidebar(!sidebar.classList.contains('is-show'));
      });
      tab.dataset.setupComplete = 'true';
    }
    
    // Setup close button handler
    if (close.dataset.setupComplete !== 'true') {
      eventManager.add(close, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLeftSidebar(false);
      });
      close.dataset.setupComplete = 'true';
    }
    
    // Setup initial margin if not showing
    if (window.innerWidth > 478 && !sidebar.classList.contains('is-show')) {
      const width = leftSidebarCache.getWidth();
      sidebar.style.marginLeft = `-${width + 1}px`;
    }
    
    return true;
  }
  
  function setupControls() {
    // Setup toggle control if exists
    const toggleBtn = domCache.$id('ToggleLeft');
    if (toggleBtn) {
      eventManager.add(toggleBtn, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const leftSidebar = domCache.$id('LeftSidebar');
        if (leftSidebar) {
          toggleLeftSidebar(!leftSidebar.classList.contains('is-show'));
        }
      });
    }
    
    // Setup elements that should open left sidebar
    const openLeftElements = document.querySelectorAll('.OpenLeftSidebar, [OpenLeftSidebar], [openleftsidebar]');
    openLeftElements.forEach(element => {
      if (element.dataset.sidebarSetup === 'true') return;
      
      const handler = () => {
        toggleLeftSidebar(!domCache.$id('LeftSidebar')?.classList.contains('is-show'));
      };
      
      if (element.type === 'radio' || element.type === 'checkbox') {
        eventManager.add(element, 'change', () => element.checked && handler());
      } else {
        eventManager.add(element, 'click', (e) => {
          e.stopPropagation();
          handler();
        });
      }
      
      element.dataset.sidebarSetup = 'true';
    });
    
    // Setup back to top button
    setupBackToTopButton();
  }
  
  // ====================================================================
  // INITIALIZATION
  // ====================================================================
  function initializeLeftSidebar() {
    const attemptSetup = (attempt = 1, maxAttempts = 5) => {
      const setupSuccess = setupLeftSidebar();
      
      if (setupSuccess) {
        setupControls();
        console.log('Left sidebar initialized successfully');
        return;
      }
      
      if (attempt < maxAttempts) {
        const delay = [50, 150, 250, 500][attempt - 1] || 500;
        setTimeout(() => attemptSetup(attempt + 1, maxAttempts), delay);
      } else {
        console.warn('Failed to initialize left sidebar after', maxAttempts, 'attempts');
      }
    };
    
    attemptSetup();
  }
  
  // ====================================================================
  // PUBLIC API
  // ====================================================================
  window.LeftSidebarModule = {
    // Core utilities
    domCache,
    eventManager,
    utils,
    
    // Sidebar functions
    toggleLeftSidebar,
    closeLeftSidebar,
    leftSidebarCache,
    
    // Initialization
    init: initializeLeftSidebar
  };
  
  // ====================================================================
  // AUTO-INITIALIZATION
  // ====================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLeftSidebar);
  } else {
    initializeLeftSidebar();
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    eventManager.cleanup();
    leftSidebarCache.invalidate();
  });
  
})(window);