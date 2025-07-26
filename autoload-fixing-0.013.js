// 🚀 LAZY PROCESSING Webflow Component Fix v3.0
// 
// ✅ FEATURES:
// • Fixes broken tabs/lightboxes ONLY when items come into view
// • Integrates LazyLoad for images on new items  
// • Adds PERFECT toggle functionality with single dummy tab reset 🎯
// • Supports WFU lightbox grouping
// • Works with Finsweet list load v2 (2025)
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
// • LAZY PROCESSING: Only processes visible items
// • Intersection Observer triggers processing on scroll
// • Dramatically reduces initial page load work
// • Prevents UI freezing on large item counts
// • Smart viewport detection with buffer zone
//
// 🎯 TOGGLE FIX:
// • Creates ONE hidden dummy tab for the entire page to reset Webflow's internal state
// • Enables perfect toggle behavior: click → open, click → close, click → open
// • No more need to click other tabs to reset state

console.log('🚀 Webflow Component Fix with Lazy Processing Loading...');

// Global dummy tab reference
let globalDummyTab = null;

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Get item slug
function getItemSlug(item) {
  return item.getAttribute('itemslug') || 
         item.querySelector('[tab]')?.getAttribute('tab') || 
         `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

// Performance-optimized tab fixing with batched DOM operations
function fixTabSystemEnhanced(item, itemSlug) {
  const tabContainers = item.querySelectorAll('.w-tabs');
  
  // Batch DOM operations for better performance
  const updates = [];
  
  tabContainers.forEach((container, containerIndex) => {
    const containerTabs = container.querySelectorAll('[data-w-tab]');
    const containerPanes = container.querySelectorAll('[data-w-pane]');
    
    if (containerTabs.length === 0) return;
    
    const baseId = `w-tabs-${itemSlug.replace(/[^a-zA-Z0-9-]/g, '-')}-${containerIndex}`;
    
    // Pre-calculate all updates to batch DOM operations
    containerTabs.forEach((tabLink, index) => {
      const tabName = tabLink.getAttribute('data-w-tab');
      const tabId = `${baseId}-data-w-tab-${index}`;
      const paneId = `${baseId}-data-w-pane-${index}`;
      
      // Find matching pane once
      const matchingPane = Array.from(containerPanes).find(pane => 
        pane.getAttribute('data-w-pane') === tabName
      );
      
      updates.push({
        tabLink,
        tabId,
        paneId,
        matchingPane,
        containerTabs,
        containerPanes,
        tabName,
        index,
        containerIndex
      });
    });
  });
  
  // Batch apply all DOM updates
  updates.forEach(({tabLink, tabId, paneId, matchingPane, containerTabs, containerPanes, tabName, index, containerIndex}) => {
    // Batch set all tab attributes at once
    tabLink.id = tabId;
    tabLink.href = `#${paneId}`;
    tabLink.setAttribute('role', 'tab');
    tabLink.setAttribute('aria-controls', paneId);
    tabLink.setAttribute('tabindex', '-1');
    tabLink.setAttribute('aria-selected', 'false');
    tabLink.classList.remove('w--current');
    tabLink.removeAttribute('data-tab-fixed');
    tabLink.setAttribute('data-tab-fixed', 'true');
    
    if (matchingPane) {
      // Batch set all pane attributes
      matchingPane.id = paneId;
      matchingPane.setAttribute('role', 'tabpanel');
      matchingPane.setAttribute('aria-labelledby', tabId);
      matchingPane.classList.remove('w--tab-active');
      
      // Create optimized click handler with closure
      const clickHandler = ((link, tabs, panes, pane) => (e) => {
        e.preventDefault();
        switchTabEnhanced(e.currentTarget, tabs, panes, pane);
      })(tabLink, containerTabs, containerPanes, matchingPane);
      
      // Store and add handler
      tabLink._originalClickHandler = clickHandler;
      tabLink.addEventListener('click', clickHandler);
    }
  });
}

// BACK TO WORKING TAB SWITCHING
function switchTabEnhanced(clickedTab, allTabLinks, allTabPanes, targetPane) {
  allTabLinks.forEach(tab => {
    tab.classList.remove('w--current');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('tabindex', '-1');
  });
  
  allTabPanes.forEach(pane => {
    pane.classList.remove('w--tab-active');
  });
  
  clickedTab.classList.add('w--current');
  clickedTab.setAttribute('aria-selected', 'true');
  clickedTab.setAttribute('tabindex', '0');
  
  if (targetPane) {
    targetPane.classList.add('w--tab-active');
  }
}

// WORKING LIGHTBOX SYSTEM
function fixLightboxEnhanced(item, itemSlug) {
  const lightboxElements = item.querySelectorAll('.w-lightbox');
  
  lightboxElements.forEach((lightbox, index) => {
    if (!lightbox.hasAttribute('aria-label')) {
      lightbox.setAttribute('aria-label', 'open lightbox');
      lightbox.setAttribute('aria-haspopup', 'dialog');
    }
    
    const jsonScript = lightbox.querySelector('script.w-json');
    if (jsonScript) {
      try {
        const config = JSON.parse(jsonScript.textContent);
        if (config.group === 'EventImages' || !config.group) {
          config.group = itemSlug;
          jsonScript.textContent = JSON.stringify(config);
        }
      } catch (e) {
        console.error('Lightbox JSON error:', e);
      }
    }
  });
  
  setTimeout(() => {
    if (window.Webflow && window.Webflow.require) {
      try {
        const lightboxModule = window.Webflow.require('lightbox');
        if (lightboxModule) {
          if (lightboxModule.init) lightboxModule.init();
          if (lightboxModule.ready) lightboxModule.ready();
        }
      } catch (e) {
        console.error('Lightbox re-init error:', e);
      }
    }
    
    if (window.Webflow && window.Webflow.ready) {
      window.Webflow.ready();
    }
  }, 200);
}

// Optimized toggle with global dummy tab reset for perfect toggle behavior
function addToggleFunctionality(item) {
  if (item.hasAttribute('data-toggle-processed')) return;
  
  const tabMenu = item.querySelector('.w-tab-menu');
  const tabContent = item.querySelector('.w-tab-content');
  if (!tabMenu || !tabContent) return;
  
  item.setAttribute('data-toggle-processed', 'true');
  
  // Optimized close function that resets Webflow state using global dummy tab
  const closeAllTabs = () => {
    // Close all visible tabs
    const tabs = tabMenu.querySelectorAll('.w-tab-link:not(.dummy-tab-reset)');
    const panes = tabContent.querySelectorAll('.w-tab-pane:not(.dummy-tab-reset)');
    
    tabs.forEach(tab => tab.classList.remove('w--current'));
    panes.forEach(pane => pane.classList.remove('w--tab-active'));
    
    // Click global dummy tab to reset Webflow's internal state
    if (globalDummyTab) {
      setTimeout(() => {
        globalDummyTab.click();
      }, 10);
    }
  };
  
  const activateTab = (tab) => {
    if (!tab) return;
    
    // Use the original click handler to properly activate tab
    const originalHandler = tab._originalClickHandler;
    if (originalHandler) {
      // Create a synthetic click event
      const syntheticEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      // Let Webflow handle the tab activation properly
      setTimeout(() => {
        originalHandler.call(tab, syntheticEvent);
      }, 50);
    }
  };
  
  // Enhanced toggle handler with global dummy tab reset
  const createToggleHandler = () => {
    return (tab) => (e) => {
      const currentTab = e.currentTarget;
      const isActive = currentTab.classList.contains('w--current');
      
      if (isActive) {
        // Clicking active tab - close it and reset state
        e.preventDefault();
        e.stopPropagation();
        
        closeAllTabs(); // This will click the global dummy tab to reset state
      } else {
        // Normal tab click - let original handler work
        const originalHandler = currentTab._originalClickHandler;
        if (originalHandler) {
          originalHandler(e);
        }
      }
    };
  };
  
  // Apply enhanced toggle to all tabs (excluding dummy)
  const tabs = tabMenu.querySelectorAll('.w-tab-link:not([data-toggle-enhanced]):not(.dummy-tab-reset)');
  const toggleHandler = createToggleHandler();
  
  tabs.forEach(tab => {
    tab.setAttribute('data-toggle-enhanced', 'true');
    const enhancedHandler = toggleHandler(tab);
    tab._enhancedClickHandler = enhancedHandler;
    tab.addEventListener('click', enhancedHandler);
  });
}

// LazyLoad integration
let lazyLoadInstance = null;

function initLazyLoad() {
  if (typeof LazyLoad !== 'undefined') {
    lazyLoadInstance = new LazyLoad({
      elements_selector: '.lazy',
      threshold: 100,
      callback_loaded: el => {
        // Lazy image loaded
      }
    });
    console.log('✅ LazyLoad initialized');
  } else {
    console.warn('⚠️ LazyLoad not found');
  }
}

function updateLazyLoad() {
  if (lazyLoadInstance && lazyLoadInstance.update) {
    lazyLoadInstance.update();
  }
}

// Lazy Intersection Observer for processing items only when visible
let itemProcessingObserver = null;
let processedItems = new WeakSet(); // Track which items have been processed

function initLazyProcessing() {
  // Create intersection observer with buffer zone
  itemProcessingObserver = new IntersectionObserver((entries) => {
    const itemsToProcess = [];
    
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const item = entry.target;
        
        // Only process if not already processed
        if (!processedItems.has(item)) {
          itemsToProcess.push(item);
          processedItems.add(item);
          
          // Stop observing this item since it's now processed
          itemProcessingObserver.unobserve(item);
        }
      }
    });
    
    if (itemsToProcess.length > 0) {
      // Process items that just became visible
      requestIdleCallback(() => {
        processItemsLazily(itemsToProcess);
      }, { timeout: 1000 });
    }
  }, {
    // Process items when they're 200px from entering viewport
    rootMargin: '200px 0px 200px 0px',
    threshold: 0.1
  });
}

// Queue new items for lazy processing instead of immediate processing
function queueItemForLazyProcessing(item) {
  // Quick check - does this item actually need processing?
  const tabs = item.querySelectorAll('[data-w-tab]');
  if (tabs.length === 0) {
    return; // No tabs, no processing needed
  }
  
  // Mark item for observation
  if (itemProcessingObserver && !processedItems.has(item)) {
    itemProcessingObserver.observe(item);
  }
}

// Lightweight immediate processing for above-the-fold items
function processItemsLazily(items) {
  if (!items?.length) return;
  
  // Use requestAnimationFrame to avoid blocking the main thread
  const processInChunks = (itemsToProcess, chunkSize = 1) => {
    if (itemsToProcess.length === 0) {
      updateLazyLoad();
      return;
    }
    
    const chunk = itemsToProcess.splice(0, chunkSize);
    
    chunk.forEach(item => {
      try {
        const itemSlug = getItemSlug(item);
        
        // Step 1: Ensure global dummy tab exists (only creates once)
        ensureGlobalDummyTab();
        
        // Step 2: Fix tabs and lightboxes
        fixTabSystemEnhanced(item, itemSlug);
        fixLightboxEnhanced(item, itemSlug);
        
        // Step 3: Add toggle functionality after a brief delay
        setTimeout(() => {
          addToggleFunctionality(item);
        }, 50);
        
      } catch (error) {
        console.error('Lazy processing error:', error);
      }
    });
    
    // Process next chunk on next animation frame
    if (itemsToProcess.length > 0) {
      requestAnimationFrame(() => processInChunks(itemsToProcess, chunkSize));
    } else {
      // All items processed, update lazy load
      setTimeout(updateLazyLoad, 100);
    }
  };
  
  // Start processing in small chunks
  processInChunks([...items]);
}

// Process initial above-the-fold items immediately (but still efficiently)
function processInitialVisibleItems() {
  const allItems = document.querySelectorAll('[itemslug]');
  const visibleItems = [];
  const itemsToQueue = [];
  
  allItems.forEach(item => {
    const rect = item.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
    
    if (isVisible) {
      // Process immediately if visible
      visibleItems.push(item);
      processedItems.add(item);
    } else {
      // Queue for lazy processing
      itemsToQueue.push(item);
    }
  });
  
  // Process visible items immediately (but efficiently)
  if (visibleItems.length > 0) {
    processItemsLazily(visibleItems);
  }
  
  // Queue non-visible items for lazy processing
  itemsToQueue.forEach(item => {
    queueItemForLazyProcessing(item);
  });
  
  // Add toggle to items that already work
  setTimeout(() => {
    allItems.forEach(item => {
      const tabs = item.querySelectorAll('[data-w-tab]');
      const workingTabs = Array.from(tabs).filter(tab => tab.id).length;
      
      if (tabs.length > 0 && workingTabs === tabs.length && !item.hasAttribute('data-toggle-processed')) {
        addToggleFunctionality(item);
      }
    });
  }, 500);
}

// Create single hidden dummy tab for the entire page to reset Webflow state
function ensureGlobalDummyTab() {
  // Skip if global dummy tab already exists
  if (globalDummyTab) return;
  
  // Find the first tab container on the page
  const firstTabMenu = document.querySelector('.w-tab-menu');
  const firstTabContent = document.querySelector('.w-tab-content');
  
  if (!firstTabMenu || !firstTabContent) return;
  
  const dummyId = 'global-dummy-reset';
  
  // Create dummy tab link (hidden)
  const dummyTab = document.createElement('a');
  dummyTab.setAttribute('data-w-tab', 'GlobalDummyReset');
  dummyTab.className = 'dummy-tab-reset w-tab-link';
  dummyTab.id = `${dummyId}-tab`;
  dummyTab.href = `#${dummyId}-pane`;
  dummyTab.setAttribute('role', 'tab');
  dummyTab.setAttribute('aria-controls', `${dummyId}-pane`);
  dummyTab.setAttribute('tabindex', '-1');
  dummyTab.setAttribute('aria-selected', 'false');
  dummyTab.style.display = 'none'; // Hidden
  dummyTab.style.position = 'absolute';
  dummyTab.style.left = '-9999px';
  
  // Create dummy tab pane (hidden)
  const dummyPane = document.createElement('div');
  dummyPane.setAttribute('data-w-pane', 'GlobalDummyReset');
  dummyPane.className = 'dummy-tab-reset w-tab-pane';
  dummyPane.id = `${dummyId}-pane`;
  dummyPane.setAttribute('role', 'tabpanel');
  dummyPane.setAttribute('aria-labelledby', `${dummyId}-tab`);
  dummyPane.style.display = 'none'; // Hidden
  dummyPane.style.position = 'absolute';
  dummyPane.style.left = '-9999px';
  
  // Add to DOM
  firstTabMenu.appendChild(dummyTab);
  firstTabContent.appendChild(dummyPane);
  
  // Store global reference
  globalDummyTab = dummyTab;
  
  // Add basic click handler to dummy tab
  dummyTab.addEventListener('click', (e) => {
    e.preventDefault();
    // Just activate the dummy tab (Webflow will handle the rest)
    const allTabs = document.querySelectorAll('.w-tab-link');
    const allPanes = document.querySelectorAll('.w-tab-pane');
    
    allTabs.forEach(tab => {
      tab.classList.remove('w--current');
      tab.setAttribute('aria-selected', 'false');
    });
    
    allPanes.forEach(pane => {
      pane.classList.remove('w--tab-active');
    });
    
    // Don't actually show the dummy tab - just use it to reset state
  });
}

// Optimized observer with lazy processing queue
document.addEventListener('DOMContentLoaded', function() {
  initLazyLoad();
  initLazyProcessing();
  
  let pendingItems = new Set();
  let queueTimeout = null;
  
  // Lightweight queuing for new items
  const scheduleItemQueuing = () => {
    if (queueTimeout) return;
    
    queueTimeout = setTimeout(() => {
      if (pendingItems.size > 0) {
        const itemsToQueue = Array.from(pendingItems);
        pendingItems.clear();
        
        // Queue items for lazy processing instead of immediate processing
        itemsToQueue.forEach(item => {
          queueItemForLazyProcessing(item);
        });
      }
      queueTimeout = null;
    }, 100); // Very short delay just to batch multiple rapid additions
  };
  
  // Lightweight mutation observer
  const observer = new MutationObserver((mutations) => {
    let hasNewItems = false;
    
    for (const mutation of mutations) {
      if (mutation.type !== 'childList' || !mutation.addedNodes.length) continue;
      
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        
        // Check for direct items
        if (node.hasAttribute?.('itemslug')) {
          pendingItems.add(node);
          hasNewItems = true;
        }
        // Check for child items
        else if (node.querySelector) {
          const childItems = node.querySelectorAll('[itemslug]');
          for (const item of childItems) {
            pendingItems.add(item);
            hasNewItems = true;
          }
        }
      }
    }
    
    if (hasNewItems) {
      scheduleItemQueuing();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Process initial items with lazy approach
  setTimeout(() => {
    processInitialVisibleItems();
    updateLazyLoad();
  }, 500);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    if (itemProcessingObserver) {
      itemProcessingObserver.disconnect();
    }
    if (queueTimeout) clearTimeout(queueTimeout);
  });
});

console.log('✅ Webflow Fix + LazyLoad + Toggle Ready!');
