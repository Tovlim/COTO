// 🚀 COMBINED Auto Load More + Lightbox Fix v4.0
// 
// ✅ FEATURES:
// • Auto-clicks #load-more when visible with smart throttling
// • Fixes broken lightboxes ONLY when items come into view
// • Integrates LazyLoad for images on new items  
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
// 🔄 AUTO LOAD MORE:
// • Automatically clicks load-more button when it becomes visible
// • Preserves scroll position during loading
// • Coordinates with lightbox processing for optimal performance

console.log('🚀 Combined Auto Load More + Lightbox Fix Loading...');

// Global state management
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
  // Check if item has lightboxes or any content that needs processing
  const lightboxes = item.querySelectorAll('.w-lightbox');
  const lazyElements = item.querySelectorAll('.lazy');
  
  if (lightboxes.length === 0 && lazyElements.length === 0) return;
  
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
        
        // Fix lightboxes
        fixLightboxEnhanced(item, itemSlug);
        
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

console.log('✅ Combined Auto Load More + Lightbox Fix Ready!');
