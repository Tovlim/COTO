// 🚀 OPTIMIZED Auto Load More + Lightbox Fix v5.0
// 
// ✅ FEATURES:
// • Auto-clicks #load-more when visible with smart throttling
// • Fixes lightbox grouping ONLY when items come into view
// • Integrates LazyLoad for images on new items  
// • Supports WFU lightbox grouping with [wfu-lightbox-group] attributes
// • Works with Finsweet list load v2 (2025)
// • IMMEDIATE processing of new load-more items
// • Batch-level Webflow re-initialization for optimal performance
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
// • LAZY PROCESSING: Only processes visible items
// • Attribute-based targeting for precision
// • Single Webflow re-initialization per batch
// • Dramatically reduces initial page load work
// • Prevents UI freezing on large item counts
// • Smart viewport detection with buffer zone
// • Debounced re-initialization for dynamic content
//
// 🔄 AUTO LOAD MORE:
// • Automatically clicks load-more button when it becomes visible
// • Preserves scroll position during loading
// • Coordinates with lightbox processing for optimal performance

console.log('🚀 Optimized Auto Load More + Lightbox Fix Loading...');

// Global state management
let isLoadingMore = false;
let lazyLoadInstance = null;
let itemProcessingObserver = null;
let loadMoreObserver = null;
let processedItems = new WeakSet();
let needsLightboxReInit = false;
let reInitTimeout = null;

// Configuration
const LOAD_MORE_DELAY = 1500; // 1.5 seconds delay between load-more clicks
const PROCESSING_CHUNK_SIZE = 1;
const REINIT_DEBOUNCE_DELAY = 200; // Delay before re-initializing Webflow

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

// Optimized lightbox grouping system based on attributes
function processLightboxGroups(item) {
  // Check if this item has lightbox group attribute
  const groupAttribute = item.getAttribute('wfu-lightbox-group');
  if (!groupAttribute) return false;
  
  let hasProcessedGroups = false;
  
  // Find all script elements within this item
  const scripts = item.querySelectorAll('script.w-json');
  scripts.forEach((script) => {
    try {
      let json = JSON.parse(script.textContent);
      json.group = groupAttribute;
      script.textContent = JSON.stringify(json);
      hasProcessedGroups = true;
    } catch (e) {
      console.error('Lightbox JSON error:', e);
    }
  });
  
  return hasProcessedGroups;
}

// Debounced Webflow re-initialization
function scheduleWebflowReInit() {
  if (reInitTimeout) {
    clearTimeout(reInitTimeout);
  }
  
  reInitTimeout = setTimeout(() => {
    if (needsLightboxReInit) {
      try {
        if (window.Webflow && window.Webflow.require) {
          const lightboxModule = window.Webflow.require('lightbox');
          if (lightboxModule && lightboxModule.ready) {
            lightboxModule.ready();
            console.log('✅ Webflow lightbox re-initialized');
          }
        }
      } catch (e) {
        console.error('Webflow re-init error:', e);
      }
      
      needsLightboxReInit = false;
    }
    reInitTimeout = null;
  }, REINIT_DEBOUNCE_DELAY);
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
  // Check if item has lightbox groups or lazy elements that need processing
  const hasLightboxGroup = item.hasAttribute('wfu-lightbox-group');
  const lazyElements = item.querySelectorAll('.lazy');
  
  if (!hasLightboxGroup && lazyElements.length === 0) return;
  
  if (itemProcessingObserver && !processedItems.has(item)) {
    itemProcessingObserver.observe(item);
  }
}

function processItemsLazily(items) {
  if (!items?.length) return;
  
  const processInChunks = (itemsToProcess, chunkSize = PROCESSING_CHUNK_SIZE) => {
    if (itemsToProcess.length === 0) {
      updateLazyLoad();
      // Schedule Webflow re-init if needed
      if (needsLightboxReInit) {
        scheduleWebflowReInit();
      }
      return;
    }
    
    const chunk = itemsToProcess.splice(0, chunkSize);
    
    chunk.forEach(item => {
      try {
        // Process lightbox groups
        const processed = processLightboxGroups(item);
        if (processed) {
          needsLightboxReInit = true;
        }
        
      } catch (error) {
        console.error('Processing error:', error);
      }
    });
    
    // Process next chunk
    if (itemsToProcess.length > 0) {
      requestAnimationFrame(() => processInChunks(itemsToProcess, chunkSize));
    } else {
      setTimeout(() => {
        updateLazyLoad();
        // Schedule Webflow re-init if needed
        if (needsLightboxReInit) {
          scheduleWebflowReInit();
        }
      }, 100);
    }
  };
  
  processInChunks([...items]);
}

// Process items that were just added by load-more
function processNewlyAddedItems() {
  const allItems = document.querySelectorAll('[wfu-lightbox-group]');
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
    console.log(`Processing ${newItems.length} newly loaded lightbox items`);
    processItemsLazily(newItems);
  }
}

function processInitialVisibleItems() {
  const allItems = document.querySelectorAll('[wfu-lightbox-group]');
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
}

// Process any items with lazy images that don't have lightbox groups
function processLazyOnlyItems() {
  const lazyItems = document.querySelectorAll('[itemslug]');
  const itemsNeedingLazy = [];
  
  lazyItems.forEach(item => {
    if (!processedItems.has(item)) {
      const lazyElements = item.querySelectorAll('.lazy');
      if (lazyElements.length > 0) {
        const rect = item.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isVisible) {
          itemsNeedingLazy.push(item);
          processedItems.add(item);
        } else {
          queueItemForLazyProcessing(item);
        }
      }
    }
  });
  
  // Just update LazyLoad for these items (no lightbox processing needed)
  if (itemsNeedingLazy.length > 0) {
    setTimeout(updateLazyLoad, 100);
  }
}

// UNIFIED INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
  initLazyLoad();
  initItemProcessingObserver();
  initLoadMoreObserver();
  
  let pendingLightboxItems = new Set();
  let pendingLazyItems = new Set();
  let queueTimeout = null;
  
  // Unified item queuing
  const scheduleItemQueuing = () => {
    if (queueTimeout) return;
    
    queueTimeout = setTimeout(() => {
      // Process lightbox items
      if (pendingLightboxItems.size > 0) {
        const itemsToQueue = Array.from(pendingLightboxItems);
        pendingLightboxItems.clear();
        
        itemsToQueue.forEach(item => {
          queueItemForLazyProcessing(item);
        });
      }
      
      // Process lazy-only items
      if (pendingLazyItems.size > 0) {
        const itemsToQueue = Array.from(pendingLazyItems);
        pendingLazyItems.clear();
        
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
        
        // Check for new lightbox group items
        if (node.hasAttribute?.('wfu-lightbox-group')) {
          pendingLightboxItems.add(node);
          hasNewItems = true;
        } else if (node.querySelector) {
          const lightboxItems = node.querySelectorAll('[wfu-lightbox-group]');
          for (const item of lightboxItems) {
            pendingLightboxItems.add(item);
            hasNewItems = true;
          }
          
          // Check for lazy-only items
          const lazyItems = node.querySelectorAll('[itemslug]');
          for (const item of lazyItems) {
            if (!item.hasAttribute('wfu-lightbox-group')) {
              const lazyElements = item.querySelectorAll('.lazy');
              if (lazyElements.length > 0) {
                pendingLazyItems.add(item);
                hasNewItems = true;
              }
            }
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
    processLazyOnlyItems();
    observeLoadMoreButton();
    updateLazyLoad();
  }, 500);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    if (itemProcessingObserver) itemProcessingObserver.disconnect();
    if (loadMoreObserver) loadMoreObserver.disconnect();
    if (queueTimeout) clearTimeout(queueTimeout);
    if (reInitTimeout) clearTimeout(reInitTimeout);
  });
});

console.log('✅ Optimized Auto Load More + Lightbox Fix Ready!');
