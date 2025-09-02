/**
 * MAPBOX INTEGRATED SCRIPT - SIDEBARS
 * Sidebar management functions (toggleSidebar, setupSidebars, etc.)
 */

// ========================
// HELPER FUNCTIONS
// ========================
// Quick DOM selector helpers
function $id(id) {
  return document.getElementById(id);
}

function $1(selector) {
  return document.querySelector(selector);
}

// ========================
// SIDEBAR CACHE
// ========================
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

// ========================
// CORE SIDEBAR FUNCTIONS
// ========================
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

// Toggle sidebar with improved caching and helper functions
const toggleSidebar = (side, show = null) => {
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
      // Desktop behavior - close conflicting sidebars
      if (side === 'Left') {
        // Close SecondLeft when Left opens
        const otherLeftSide = 'SecondLeft';
        if (otherLeftSide !== side) closeSidebar(otherLeftSide);
      } else if (side === 'SecondLeft') {
        // Close Left when SecondLeft opens
        const otherLeftSide = 'Left';
        closeSidebar(otherLeftSide);
      } else {
        // For Right sidebar, close other sidebars if needed
        const otherSides = ['Left', 'SecondLeft'];
        if (otherSides.some(otherSide => otherSide !== side)) {
          // Only close if there's potential conflict
        }
      }
    }
  } else {
    // Mobile behavior - reset margins
    sidebar.style[jsMarginProperty] = '';
    sidebar.style.pointerEvents = isShowing ? '' : 'none';
  }
  
  // Handle arrow rotation
  if (arrowIcon) {
    arrowIcon.style.transform = isShowing ? 'rotateY(180deg)' : 'rotateY(0deg)';
  }
};

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
    
    return true;
  };
  
  // Setup all sidebars
  const sides = ['Left', 'SecondLeft', 'Right'];
  const successfulSetups = sides.filter(setupSidebarElement);
  
  if (successfulSetups.length > 0) {
    // Setup keyboard shortcuts for desktop
    if (window.innerWidth > APP_CONFIG.breakpoints.mobile) {
      setupSidebarKeyboardShortcuts();
    }
    
    // Setup responsive behavior
    setupSidebarResponsiveBehavior();
  }
  
  return successfulSetups.length;
}

// ========================
// KEYBOARD SHORTCUTS
// ========================
function setupSidebarKeyboardShortcuts() {
  // Only setup once
  if (document.body.dataset.sidebarShortcuts === 'true') return;
  
  eventManager.add(document, 'keydown', (e) => {
    // Only handle shortcuts when not in input fields
    if (e.target.matches('input, textarea, select, [contenteditable]')) return;
    
    const leftSidebar = sidebarCache.getSidebar('Left');
    const secondLeftSidebar = sidebarCache.getSidebar('SecondLeft');
    
    switch (e.key) {
      case 'q':
      case 'Q':
        e.preventDefault();
        if (leftSidebar) toggleSidebar('Left', !leftSidebar.classList.contains('is-show'));
        break;
      case 'w':
      case 'W':
        e.preventDefault();
        if (secondLeftSidebar) toggleSidebar('SecondLeft', !secondLeftSidebar.classList.contains('is-show'));
        break;
      case 'Escape':
        // Close all sidebars on escape
        ['Left', 'SecondLeft', 'Right'].forEach(side => {
          const sidebar = sidebarCache.getSidebar(side);
          if (sidebar && sidebar.classList.contains('is-show')) {
            closeSidebar(side);
          }
        });
        break;
    }
  });
  
  document.body.dataset.sidebarShortcuts = 'true';
}

// ========================
// RESPONSIVE BEHAVIOR
// ========================
function setupSidebarResponsiveBehavior() {
  // Handle resize events
  const handleResize = () => {
    // Invalidate cache on resize
    sidebarCache.invalidate();
    
    // Update mobile detection
    const isMobile = window.innerWidth <= APP_CONFIG.breakpoints.mobile;
    
    // Reset sidebar positions based on screen size
    ['Left', 'SecondLeft', 'Right'].forEach(side => {
      const sidebar = sidebarCache.getSidebar(side);
      if (!sidebar) return;
      
      const jsMarginProperty = sidebarCache.getMarginProperty(side);
      
      if (isMobile) {
        // Mobile: reset margins
        sidebar.style[jsMarginProperty] = '';
        sidebar.style.pointerEvents = sidebar.classList.contains('is-show') ? '' : 'none';
      } else {
        // Desktop: apply proper margins
        const width = sidebarCache.getWidth(side);
        const isShowing = sidebar.classList.contains('is-show');
        sidebar.style[jsMarginProperty] = isShowing ? '0' : `-${width + 1}px`;
        sidebar.style.pointerEvents = '';
      }
    });
  };
  
  // Debounced resize handler
  let resizeTimer;
  const debouncedResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleResize, 250);
  };
  
  window.addEventListener('resize', debouncedResize);
  window.addEventListener('orientationchange', debouncedResize);
}

// ========================
// SPECIAL SIDEBAR BEHAVIORS
// ========================
// Setup tab-specific behaviors
function setupSidebarTabBehaviors() {
  // Location tab - generate all checkboxes when clicked
  const locationTab = document.querySelector('[data-w-tab="Location"]');
  if (locationTab && !locationTab.dataset.locationTabSetup) {
    eventManager.add(locationTab, 'click', () => {
      // Delay to ensure tab content is visible
      setTimeout(() => {
        if (window.generateAllCheckboxes) {
          window.generateAllCheckboxes();
        }
      }, 100);
    });
    
    locationTab.dataset.locationTabSetup = 'true';
  }
  
  // Other tab-specific setups can be added here
}

// ========================
// SIDEBAR CONTENT MANAGEMENT
// ========================
// Auto-open sidebar based on data attributes
function setupAutoSidebarEvents() {
  // Setup sidebar auto-opening events for elements with data attributes
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
            state.setTimer('sidebarUpdate', () => toggleSidebar(target, true), APP_CONFIG.timeouts.debounce);
          }
        });
      });
    });
  });
}

// ========================
// INITIALIZATION
// ========================
// Main sidebar initialization function
function initializeSidebars() {
  // Setup core sidebar functionality
  const setupCount = setupSidebars();
  
  if (setupCount > 0) {
    // Setup additional behaviors
    setupSidebarTabBehaviors();
    setupAutoSidebarEvents();
    
    // Mark as initialized
    document.body.dataset.sidebarInitialized = 'true';
    
    return true;
  }
  
  return false;
}

// ========================
// GLOBAL AVAILABILITY
// ========================
// Make functions globally available
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.setupSidebars = setupSidebars;
window.sidebarCache = sidebarCache;
window.initializeSidebars = initializeSidebars;
window.setupSidebarKeyboardShortcuts = setupSidebarKeyboardShortcuts;
window.setupSidebarResponsiveBehavior = setupSidebarResponsiveBehavior;
window.setupAutoSidebarEvents = setupAutoSidebarEvents;