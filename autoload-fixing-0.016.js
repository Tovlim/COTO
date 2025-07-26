// 🚀 COMBINED Webflow Component Fix + Auto Load More v4.1 (Mobile Optimized)
// 
// ✅ FEATURES:
// • Auto-clicks #load-more when visible with smart throttling
// • Fixes broken tabs/lightboxes ONLY when items come into view
// • Integrates LazyLoad for images on new items  
// • Adds PERFECT toggle functionality with single dummy tab reset 🎯
// • Supports WFU lightbox grouping
// • Works with Finsweet list load v2 (2025)
// • IMMEDIATE processing of new load-more items
// • MOBILE OPTIMIZED: Adaptive performance for mobile devices
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
// • LAZY PROCESSING: Only processes visible items
// • Mobile-specific lightweight processing paths
// • Coordinated observers for maximum efficiency
// • Dramatically reduces initial page load work
// • Prevents UI freezing on large item counts
// • Smart viewport detection with buffer zone
// • Fallback processing when observers fail on mobile
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
//
// 📱 MOBILE OPTIMIZATIONS:
// • Detects mobile devices and uses lighter processing
// • Increased timeouts and reduced complexity for mobile
// • Fallback processing systems for mobile browsers
// • Touch-friendly event handling

console.log('🚀 Combined Webflow Fix + Auto Load More (Mobile Optimized) Loading...');

// Mobile detection
const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                 window.innerWidth <= 768 || 
                 ('ontouchstart' in window);

console.log(isMobile ? '📱 Mobile device detected - using optimized processing' : '🖥️ Desktop device detected - using full processing');

// Global state management
let globalDummyTab = null;
let isLoadingMore = false;
let lazyLoadInstance = null;
let itemProcessingObserver = null;
let loadMoreObserver = null;
let processedItems = new WeakSet();
let fallbackProcessingActive = false;

// Mobile-adaptive configuration
const CONFIG = {
  LOAD_MORE_DELAY: isMobile ? 2500 : 1500, // Longer delay on mobile
  PROCESSING_CHUNK_SIZE: 1,
  PROCESSING_DELAY: isMobile ? 200 : 50, // Much longer delays on mobile
  MUTATION_DEBOUNCE: isMobile ? 300 : 100, // More aggressive debouncing on mobile
  INTERSECTION_THRESHOLD: isMobile ? 0.2 : 0.1, // Higher threshold on mobile
  INTERSECTION_MARGIN: isMobile ? '100px' : '200px', // Smaller margin on mobile
  FALLBACK_INTERVAL: isMobile ? 2000 : null, // Fallback processing only on mobile
  USE_IDLE_CALLBACK: !isMobile, // Disable requestIdleCallback on mobile
  LIGHTBOX_DELAY: isMobile ? 400 : 200,
  TOGGLE_DELAY: isMobile ? 100 : 50
};

// Debounce function with mobile-adaptive timing
function debounce(func, wait) {
  let timeout;
  const actualWait = wait || CONFIG.MUTATION_DEBOUNCE;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, actualWait);
  };
}

// Get item slug
function getItemSlug(item) {
  return item.getAttribute('itemslug') || 
         item.querySelector('[tab]')?.getAttribute('tab') || 
         `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

// Mobile-optimized tab fixing with reduced DOM operations
function fixTabSystemEnhanced(item, itemSlug) {
  const tabContainers = item.querySelectorAll('.w-tabs');
  if (tabContainers.length === 0) return;
  
  // On mobile, process one container at a time to reduce memory pressure
  const processContainer = (container, containerIndex) => {
    const containerTabs = container.querySelectorAll('[data-w-tab]');
    const containerPanes = container.querySelectorAll('[data-w-pane]');
    
    if (containerTabs.length === 0) return;
    
    const baseId = `w-tabs-${itemSlug.replace(/[^a-zA-Z0-9-]/g, '-')}-${containerIndex}`;
    
    // Process tabs individually on mobile to prevent memory spikes
    containerTabs.forEach((tabLink, index) => {
      const tabName = tabLink.getAttribute('data-w-tab');
      const tabId = `${baseId}-data-w-tab-${index}`;
      const paneId = `${baseId}-data-w-pane-${index}`;
      
      // Find matching pane
      const matchingPane = Array.from(containerPanes).find(pane => 
        pane.getAttribute('data-w-pane') === tabName
      );
      
      // Apply attributes immediately - no batching on mobile to avoid complexity
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
        matchingPane.id = paneId;
        matchingPane.setAttribute('role', 'tabpanel');
        matchingPane.setAttribute('aria-labelledby', tabId);
        matchingPane.classList.remove('w--tab-active');
        
        // Simplified click handler for mobile
        const clickHandler = (e) => {
          e.preventDefault();
          switchTabEnhanced(e.currentTarget, containerTabs, containerPanes, matchingPane);
        };
        
        tabLink._originalClickHandler = clickHandler;
        tabLink.addEventListener('click', clickHandler, { passive: false });
        
        // Add touch handling for mobile
        if (isMobile) {
          tabLink.addEventListener('touchend', clickHandler, { passive: false });
        }
      }
    });
  };
  
  // Process containers sequentially on mobile
  if (isMobile) {
    tabContainers.forEach((container, index) => {
      setTimeout(() => {
        processContainer(container, index);
      }, index * 10); // Small delay between containers on mobile
    });
  } else {
    tabContainers.forEach(processContainer);
  }
}

// Enhanced tab switching with proper attribute management
function switchTabEnhanced(clickedTab, allTabLinks, allTabPanes, targetPane) {
  // Deactivate all tabs in this container
  allTabLinks.forEach(tab => {
    tab.classList.remove('w--current');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('tabindex', '-1');
  });
  
  // Hide all panes in this container
  allTabPanes.forEach(pane => {
    pane.classList.remove('w--tab-active');
  });
  
  // Activate clicked tab
  clickedTab.classList.add('w--current');
  clickedTab.setAttribute('aria-selected', 'true');
  clickedTab.setAttribute('tabindex', '0');
  
  // Show target pane
  if (targetPane) {
    targetPane.classList.add('w--tab-active');
  }
}

// Mobile-optimized lightbox system
function fixLightboxEnhanced(item, itemSlug) {
  const lightboxElements = item.querySelectorAll('.w-lightbox');
  if (lightboxElements.length === 0) return;
  
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
  
  // Longer delay on mobile for Webflow re-initialization
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
  }, CONFIG.LIGHTBOX_DELAY);
}

// Optimized toggle with isolated item-level reset
function addToggleFunctionality(item) {
  if (item.hasAttribute('data-toggle-processed')) return;
  
  const tabMenu = item.querySelector('.w-tab-menu');
  const tabContent = item.querySelector('.w-tab-content');
  if (!tabMenu || !tabContent) return;
  
  item.setAttribute('data-toggle-processed', 'true');
  
  // Close function that only affects THIS item's tabs
  const closeAllTabsInItem = () => {
    const tabs = tabMenu.querySelectorAll('.w-tab-link:not(.dummy-tab-reset)');
    const panes = tabContent.querySelectorAll('.w-tab-pane:not(.dummy-tab-reset)');
    
    tabs.forEach(tab => {
      tab.classList.remove('w--current');
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');
    });
    
    panes.forEach(pane => {
      pane.classList.remove('w--tab-active');
    });
    
    // Reset Webflow's internal state by clicking dummy tab (but don't let it affect other items)
    if (globalDummyTab) {
      setTimeout(() => {
        // Temporarily disable the dummy tab's global reset to prevent affecting other items
        const originalHandler = globalDummyTab.onclick;
        globalDummyTab.onclick = null;
        
        // Click dummy to reset Webflow state
        globalDummyTab.click();
        
        // Restore original handler after a moment
        setTimeout(() => {
          globalDummyTab.onclick = originalHandler;
        }, 50);
      }, 10);
    }
  };
  
  // Enhanced toggle handler that works per item
  const createToggleHandler = () => {
    return (tab) => (e) => {
      const currentTab = e.currentTarget;
      const isActive = currentTab.classList.contains('w--current');
      
      if (isActive) {
        // Clicking active tab - close it and reset state for this item only
        e.preventDefault();
        e.stopPropagation();
        closeAllTabsInItem();
      } else {
        // Normal tab click - let original handler work
        const originalHandler = currentTab._originalClickHandler;
        if (originalHandler) {
          originalHandler(e);
        }
      }
    };
  };
  
  // Apply enhanced toggle to all tabs in this item
  const tabs = tabMenu.querySelectorAll('.w-tab-link:not([data-toggle-enhanced]):not(.dummy-tab-reset)');
  const toggleHandler = createToggleHandler();
  
  tabs.forEach(tab => {
    tab.setAttribute('data-toggle-enhanced', 'true');
    const enhancedHandler = toggleHandler(tab);
    tab._enhancedClickHandler = enhancedHandler;
    tab.addEventListener('click', enhancedHandler, { passive: false });
    
    // Add touch support for mobile
    if (isMobile) {
      tab.addEventListener('touchend', enhancedHandler, { passive: false });
    }
  });
}

// LazyLoad integration
function initLazyLoad() {
  if (typeof LazyLoad !== 'undefined') {
    lazyLoadInstance = new LazyLoad({
      elements_selector: '.lazy',
      threshold: isMobile ? 200 : 100, // Higher threshold on mobile
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
  
  // Add minimal click handler to dummy tab - just for Webflow state reset
  dummyTab.addEventListener('click', (e) => {
    e.preventDefault();
    // Only activate the dummy tab itself to reset Webflow's internal state
    // Don't touch any other tabs - let individual items handle their own tab states
    dummyTab.classList.add('w--current');
    dummyTab.setAttribute('aria-selected', 'true');
    dummyPane.classList.add('w--tab-active');
    
    // Immediately deactivate the dummy tab since it's just for state reset
    setTimeout(() => {
      dummyTab.classList.remove('w--current');
      dummyTab.setAttribute('aria-selected', 'false');
      dummyPane.classList.remove('w--tab-active');
    }, 1);
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
  
  // Restore scroll position after a brief moment (longer delay on mobile)
  setTimeout(() => {
    window.scrollTo(0, currentScrollY);
  }, isMobile ? 200 : 100);
  
  // Process any new items that were just added (longer delay on mobile)
  setTimeout(() => {
    processNewlyAddedItems();
  }, isMobile ? 500 : 300);
  
  // Reset loading flag after delay
  setTimeout(() => {
    isLoadingMore = false;
    console.log('Ready for next load-more click');
  }, CONFIG.LOAD_MORE_DELAY);
}

function initLoadMoreObserver() {
  loadMoreObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isLoadingMore) {
        clickLoadMore(entry.target);
      }
    });
  }, {
    threshold: CONFIG.INTERSECTION_THRESHOLD,
    rootMargin: CONFIG.INTERSECTION_MARGIN
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

// MOBILE-OPTIMIZED ITEM PROCESSING SYSTEM
function initItemProcessingObserver() {
  if (!itemProcessingObserver) {
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
        // Use setTimeout instead of requestIdleCallback on mobile
        if (CONFIG.USE_IDLE_CALLBACK) {
          requestIdleCallback(() => {
            processItemsLazily(itemsToProcess);
          }, { timeout: 1000 });
        } else {
          setTimeout(() => {
            processItemsLazily(itemsToProcess);
          }, CONFIG.PROCESSING_DELAY);
        }
      }
    }, {
      rootMargin: `${CONFIG.INTERSECTION_MARGIN} 0px ${CONFIG.INTERSECTION_MARGIN} 0px`,
      threshold: CONFIG.INTERSECTION_THRESHOLD
    });
  }
}

function queueItemForLazyProcessing(item) {
  const tabs = item.querySelectorAll('[data-w-tab]');
  if (tabs.length === 0) return;
  
  if (itemProcessingObserver && !processedItems.has(item)) {
    itemProcessingObserver.observe(item);
  }
}

// Mobile-optimized processing with reduced complexity
function processItemsLazily(items) {
  if (!items?.length) return;
  
  const processInChunks = (itemsToProcess, chunkSize = CONFIG.PROCESSING_CHUNK_SIZE) => {
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
        
        // Add toggle functionality with mobile-optimized delay
        setTimeout(() => {
          addToggleFunctionality(item);
        }, CONFIG.TOGGLE_DELAY);
        
      } catch (error) {
        console.error('Processing error:', error);
      }
    });
    
    // Process next chunk with appropriate timing
    if (itemsToProcess.length > 0) {
      if (isMobile) {
        setTimeout(() => processInChunks(itemsToProcess, chunkSize), CONFIG.PROCESSING_DELAY);
      } else {
        requestAnimationFrame(() => processInChunks(itemsToProcess, chunkSize));
      }
    } else {
      setTimeout(updateLazyLoad, isMobile ? 200 : 100);
    }
  };
  
  processInChunks([...items]);
}

// Enhanced mobile processing for newly added items
function processNewlyAddedItems() {
  const allItems = document.querySelectorAll('[itemslug]');
  const newItems = [];
  
  allItems.forEach(item => {
    if (!processedItems.has(item)) {
      const rect = item.getBoundingClientRect();
      // Larger buffer zone on mobile
      const bufferZone = isMobile ? 600 : 400;
      const isVisible = rect.top < window.innerHeight + bufferZone;
      
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
  
  // Add toggle to items that already work (longer delay on mobile)
  setTimeout(() => {
    allItems.forEach(item => {
      const tabs = item.querySelectorAll('[data-w-tab]');
      const workingTabs = Array.from(tabs).filter(tab => tab.id).length;
      
      if (tabs.length > 0 && workingTabs === tabs.length && !item.hasAttribute('data-toggle-processed')) {
        addToggleFunctionality(item);
      }
    });
  }, isMobile ? 1000 : 500);
}

// Mobile fallback processing system
function initMobileFallback() {
  if (!isMobile || !CONFIG.FALLBACK_INTERVAL) return;
  
  setInterval(() => {
    if (fallbackProcessingActive) return;
    
    fallbackProcessingActive = true;
    
    // Find unprocessed items that should be processed
    const allItems = document.querySelectorAll('[itemslug]');
    const unprocessedItems = [];
    
    allItems.forEach(item => {
      if (!processedItems.has(item)) {
        const rect = item.getBoundingClientRect();
        // Check if item is near viewport
        if (rect.top < window.innerHeight + 300 && rect.bottom > -300) {
          unprocessedItems.push(item);
        }
      }
    });
    
    if (unprocessedItems.length > 0) {
      console.log(`📱 Fallback processing ${unprocessedItems.length} items`);
      processItemsLazily(unprocessedItems);
    }
    
    setTimeout(() => {
      fallbackProcessingActive = false;
    }, 1000);
  }, CONFIG.FALLBACK_INTERVAL);
  
  console.log('📱 Mobile fallback processing initialized');
}

// UNIFIED INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
  initLazyLoad();
  initItemProcessingObserver();
  initLoadMoreObserver();
  
  // Initialize mobile fallback if needed
  if (isMobile) {
    initMobileFallback();
  }
  
  let pendingItems = new Set();
  let queueTimeout = null;
  
  // Mobile-optimized item queuing with aggressive debouncing
  const scheduleItemQueuing = debounce(() => {
    if (pendingItems.size > 0) {
      const itemsToQueue = Array.from(pendingItems);
      pendingItems.clear();
      
      itemsToQueue.forEach(item => {
        queueItemForLazyProcessing(item);
      });
    }
  }, CONFIG.MUTATION_DEBOUNCE);
  
  // Unified mutation observer with mobile optimizations
  const observer = new MutationObserver(debounce((mutations) => {
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
      }, isMobile ? 200 : 100);
    }
  }, CONFIG.MUTATION_DEBOUNCE));
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Initial setup with mobile-optimized timing
  setTimeout(() => {
    processInitialVisibleItems();
    observeLoadMoreButton();
    updateLazyLoad();
  }, isMobile ? 1000 : 500);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    if (itemProcessingObserver) itemProcessingObserver.disconnect();
    if (loadMoreObserver) loadMoreObserver.disconnect();
    if (queueTimeout) clearTimeout(queueTimeout);
  });
});

console.log('✅ Combined Webflow Fix + Auto Load More (Mobile Optimized) Ready!');
