// 🚀 COMBINED Webflow Component Fix + Auto Load More v4.0
// 
// ✅ FEATURES:
// • Auto-clicks #load-more when visible with smart throttling
// • Fixes broken tabs/lightboxes ONLY when items come into view
// • Integrates LazyLoad for images on new items  
// • Adds PERFECT toggle functionality with single dummy tab reset 🎯
// • Supports WFU lightbox grouping
// • Works with Finsweet list load v2 (2025)
// • IMMEDIATE processing of new load-more items
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
// • LAZY PROCESSING: Only processes visible items
// • Coordinated observers for maximum efficiency
// • Dramatically reduces initial page load work
// • Prevents UI freezing on large item counts
// • Smart viewport detection with buffer zone
// • Single mutation observer handles both systems
//
// 🎯 TOGGLE FIX:
// • Creates ONE hidden dummy tab for the entire page to reset Webflow's internal state
// • Enables perfect toggle behavior: click → open, click → close, click → open
// • No more need to click other tabs to reset state
//
// 🔄 AUTO LOAD MORE:
// • Automatically clicks load-more button when it becomes visible
// • Preserves scroll position during loading
// • Coordinates with tab processing for optimal performance

console.log('🚀 Combined Webflow Fix + Auto Load More Loading...');

// Global state management
let globalDummyTab = null;
let isLoadingMore = false;
let lazyLoadInstance = null;
let itemProcessingObserver = null;
let loadMoreObserver = null;
let processedItems = new WeakSet();

// Configuration
const LOAD_MORE_DELAY = 1500; // 1.5 seconds delay between load-more clicks
const PROCESSING_CHUNK_SIZE = 1;

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
  updates.forEach(({tabLink, tabId, paneId, matchingPane, containerTabs, containerPanes}) => {
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

// Enhanced tab switching
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

// Enhanced lightbox system
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

// Optimized toggle with global dummy tab reset
function addToggleFunctionality(item) {
  if (item.hasAttribute('data-toggle-processed')) return;
  
  const tabMenu = item.querySelector('.w-tab-menu');
  const tabContent = item.querySelector('.w-tab-content');
  if (!tabMenu || !tabContent) return;
  
  item.setAttribute('data-toggle-processed', 'true');
  
  // Close function using global dummy tab
  const closeAllTabs = () => {
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
  
  // Enhanced toggle handler
  const createToggleHandler = () => {
    return (tab) => (e) => {
      const currentTab = e.currentTarget;
      const isActive = currentTab.classList.contains('w--current');
      
      if (isActive) {
        // Clicking active tab - close it and reset state
        e.preventDefault();
        e.stopPropagation();
        closeAllTabs();
      } else {
        // Normal tab click - let original handler work
        const originalHandler = currentTab._originalClickHandler;
        if (originalHandler) {
          originalHandler(e);
        }
      }
    };
  };
  
  // Apply enhanced toggle to all tabs
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

// Create single hidden dummy tab for the entire page
function ensureGlobalDummyTab() {
  if (globalDummyTab) return;
  
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
  dummyTab.style.display = 'none';
  dummyTab.style.position = 'absolute';
  dummyTab.style.left = '-9999px';
  
  // Create dummy tab pane (hidden)
  const dummyPane = document.createElement('div');
  dummyPane.setAttribute('data-w-pane', 'GlobalDummyReset');
  dummyPane.className = 'dummy-tab-reset w-tab-pane';
  dummyPane.id = `${dummyId}-pane`;
  dummyPane.setAttribute('role', 'tabpanel');
  dummyPane.setAttribute('aria-labelledby', `${dummyId}-tab`);
  dummyPane.style.display = 'none';
  dummyPane.style.position = 'absolute';
  dummyPane.style.left = '-9999px';
  
  // Add to DOM
  firstTabMenu.appendChild(dummyTab);
  firstTabContent.appendChild(dummyPane);
  
  // Store global reference
  globalDummyTab = dummyTab;
  
  // Add click handler to dummy tab
  dummyTab.addEventListener('click', (e) => {
    e.preventDefault();
    const allTabs = document.querySelectorAll('.w-tab-link');
    const allPanes = document.querySelectorAll('.w-tab-pane');
    
    allTabs.forEach(tab => {
      tab.classList.remove('w--current');
      tab.setAttribute('aria-selected', 'false');
    });
    
    allPanes.forEach(pane => {
      pane.classList.remove('w--tab-active');
    });
  });
}

// AUTO LOAD MORE FUNCTIONALITY
function clickLoadMore(element) {
  if (isLoadingMore) return;
  
  isLoadingMore = true;
  console.log('Auto-clicking load-more button...');
  
  // Store current scroll position
  const currentScrollY = window.scrollY;
  
  // Click the button
  element.click();
  
  // Restore scroll position after a brief moment
  setTimeout(() => {
    window.scrollTo(0, currentScrollY);
  }, 100);
  
  // Process any new items that were just added
  setTimeout(() => {
    processNewlyAddedItems();
  }, 300);
  
  // Reset loading flag after delay
  setTimeout(() => {
    isLoadingMore = false;
    console.log('Ready for next load-more click');
  }, LOAD_MORE_DELAY);
}

function initLoadMoreObserver() {
  loadMoreObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isLoadingMore) {
        clickLoadMore(entry.target);
      }
    });
  }, {
    threshold: 0.01,
    rootMargin: '150px'
  });
}

function observeLoadMoreButton() {
  const loadMoreButton = document.querySelector('#load-more');
  if (loadMoreButton && loadMoreObserver) {
    loadMoreObserver.observe(loadMoreButton);
    console.log('Started observing #load-more button');
    return true;
  }
  return false;
}

// ITEM PROCESSING SYSTEM
function initItemProcessingObserver() {
  itemProcessingObserver = new IntersectionObserver((entries) => {
    const itemsToProcess = [];
    
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const item = entry.target;
        
        if (!processedItems.has(item)) {
          itemsToProcess.push(item);
          processedItems.add(item);
          itemProcessingObserver.unobserve(item);
        }
      }
    });
    
    if (itemsToProcess.length > 0) {
      requestIdleCallback(() => {
        processItemsLazily(itemsToProcess);
      }, { timeout: 1000 });
    }
  }, {
    rootMargin: '200px 0px 200px 0px',
    threshold: 0.1
  });
}

function queueItemForLazyProcessing(item) {
  const tabs = item.querySelectorAll('[data-w-tab]');
  if (tabs.length === 0) return;
  
  if (itemProcessingObserver && !processedItems.has(item)) {
    itemProcessingObserver.observe(item);
  }
}

function processItemsLazily(items) {
  if (!items?.length) return;
  
  const processInChunks = (itemsToProcess, chunkSize = PROCESSING_CHUNK_SIZE) => {
    if (itemsToProcess.length === 0) {
      updateLazyLoad();
      return;
    }
    
    const chunk = itemsToProcess.splice(0, chunkSize);
    
    chunk.forEach(item => {
      try {
        const itemSlug = getItemSlug(item);
        
        // Ensure global dummy tab exists
        ensureGlobalDummyTab();
        
        // Fix tabs and lightboxes
        fixTabSystemEnhanced(item, itemSlug);
        fixLightboxEnhanced(item, itemSlug);
        
        // Add toggle functionality
        setTimeout(() => {
          addToggleFunctionality(item);
        }, 50);
        
      } catch (error) {
        console.error('Processing error:', error);
      }
    });
    
    // Process next chunk
    if (itemsToProcess.length > 0) {
      requestAnimationFrame(() => processInChunks(itemsToProcess, chunkSize));
    } else {
      setTimeout(updateLazyLoad, 100);
    }
  };
  
  processInChunks([...items]);
}

// Process items that were just added by load-more
function processNewlyAddedItems() {
  const allItems = document.querySelectorAll('[itemslug]');
  const newItems = [];
  
  allItems.forEach(item => {
    if (!processedItems.has(item)) {
      const rect = item.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight + 400; // Slightly larger buffer
      
      if (isVisible) {
        newItems.push(item);
        processedItems.add(item);
      } else {
        // Queue non-visible items for lazy processing
        queueItemForLazyProcessing(item);
      }
    }
  });
  
  if (newItems.length > 0) {
    console.log(`Processing ${newItems.length} newly loaded items`);
    processItemsLazily(newItems);
  }
}

function processInitialVisibleItems() {
  const allItems = document.querySelectorAll('[itemslug]');
  const visibleItems = [];
  const itemsToQueue = [];
  
  allItems.forEach(item => {
    const rect = item.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
    
    if (isVisible) {
      visibleItems.push(item);
      processedItems.add(item);
    } else {
      itemsToQueue.push(item);
    }
  });
  
  // Process visible items immediately
  if (visibleItems.length > 0) {
    processItemsLazily(visibleItems);
  }
  
  // Queue non-visible items
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

// UNIFIED INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
  initLazyLoad();
  initItemProcessingObserver();
  initLoadMoreObserver();
  
  let pendingItems = new Set();
  let queueTimeout = null;
  
  // Unified item queuing
  const scheduleItemQueuing = () => {
    if (queueTimeout) return;
    
    queueTimeout = setTimeout(() => {
      if (pendingItems.size > 0) {
        const itemsToQueue = Array.from(pendingItems);
        pendingItems.clear();
        
        itemsToQueue.forEach(item => {
          queueItemForLazyProcessing(item);
        });
      }
      queueTimeout = null;
    }, 100);
  };
  
  // Unified mutation observer
  const observer = new MutationObserver((mutations) => {
    let hasNewItems = false;
    let hasNewLoadMore = false;
    
    for (const mutation of mutations) {
      if (mutation.type !== 'childList' || !mutation.addedNodes.length) continue;
      
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        
        // Check for new items
        if (node.hasAttribute?.('itemslug')) {
          pendingItems.add(node);
          hasNewItems = true;
        } else if (node.querySelector) {
          const childItems = node.querySelectorAll('[itemslug]');
          for (const item of childItems) {
            pendingItems.add(item);
            hasNewItems = true;
          }
          
          // Check for new load-more button
          if (node.id === 'load-more' || node.querySelector('#load-more')) {
            hasNewLoadMore = true;
          }
        }
      }
    }
    
    if (hasNewItems) {
      scheduleItemQueuing();
    }
    
    if (hasNewLoadMore) {
      setTimeout(() => {
        observeLoadMoreButton();
      }, 100);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Initial setup
  setTimeout(() => {
    processInitialVisibleItems();
    observeLoadMoreButton();
    updateLazyLoad();
  }, 500);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    if (itemProcessingObserver) itemProcessingObserver.disconnect();
    if (loadMoreObserver) loadMoreObserver.disconnect();
    if (queueTimeout) clearTimeout(queueTimeout);
  });
});

console.log('✅ Combined Webflow Fix + Auto Load More Ready!');
