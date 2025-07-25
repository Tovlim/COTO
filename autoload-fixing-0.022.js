// 🚀 ENHANCED MOBILE-OPTIMIZED Auto Load More + Lightbox Fix v6.0
// 
// ✅ FEATURES:
// • Auto-clicks #load-more when visible with smart throttling
// • Fixes lightbox grouping for ALL items (new, filtered, and existing)
// • Integrates LazyLoad for images on new items  
// • Supports WFU lightbox grouping with [wfu-lightbox-group] attributes
// • Works with Finsweet list load v2 (2025) + Finsweet Filter v2 (2025)
// • IMMEDIATE processing of new load-more items
// • COMPLETE re-processing when filtering changes
// • Mobile-optimized timing and retry logic
// • Enhanced Webflow re-initialization for mobile reliability
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
// • SMART PROCESSING: Processes visible items + detects filtering changes
// • Finsweet-coordinated event handling
// • Attribute-based targeting for precision
// • Mobile-aggressive Webflow re-initialization
// • Dramatically reduces initial page load work
// • Prevents UI freezing on large item counts
// • Smart viewport detection with buffer zone
// • Multiple re-initialization attempts for mobile
//
// 🔄 AUTO LOAD MORE:
// • Automatically clicks load-more button when it becomes visible
// • Preserves scroll position during loading
// • Coordinates with lightbox processing for optimal performance
//
// 📱 MOBILE OPTIMIZATIONS:
// • Enhanced timing for mobile browsers
// • Multiple Webflow re-initialization attempts
// • Aggressive retry logic for stubborn lightboxes
// • Coordinated with Finsweet filtering events

console.log('🚀 Enhanced Mobile-Optimized Auto Load More + Lightbox Fix Loading...');

// Global state management
let isLoadingMore = false;
let lazyLoadInstance = null;
let itemProcessingObserver = null;
let loadMoreObserver = null;
let filteringObserver = null;
let processedItems = new WeakSet();
let needsLightboxReInit = false;
let reInitTimeout = null;
let isCurrentlyFiltering = false;
let lastFilteringState = false;
let mobileRetryCount = 0;

// Configuration
const LOAD_MORE_DELAY = 1500; // 1.5 seconds delay between load-more clicks
const PROCESSING_CHUNK_SIZE = 1;
const REINIT_DEBOUNCE_DELAY = 200; // Base delay before re-initializing Webflow
const MOBILE_REINIT_DELAYS = [300, 600, 1200]; // Mobile retry delays
const FILTERING_DEBOUNCE_DELAY = 100; // Delay for filtering detection

// Device detection (reuse existing isMobile if available, otherwise create it)
const isMobileDevice = typeof isMobile !== 'undefined' ? isMobile : (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

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

// Enhanced filtering detection using proven methods from mapbox script
function detectFiltering() {
  // Primary method: Check for Finsweet's official filtering indicator
  const hiddenTagParent = document.getElementById('hiddentagparent');
  return !!hiddenTagParent;
}

// Check if filtering state has changed
function checkFilteringStateChange() {
  const currentlyFiltering = detectFiltering();
  const hasChanged = currentlyFiltering !== lastFilteringState;
  
  if (hasChanged) {
    console.log(`Filtering state changed: ${lastFilteringState} → ${currentlyFiltering}`);
    lastFilteringState = currentlyFiltering;
    isCurrentlyFiltering = currentlyFiltering;
    return true;
  }
  
  return false;
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

// Enhanced Webflow re-initialization with mobile-aggressive retry logic
function scheduleWebflowReInit() {
  if (reInitTimeout) {
    clearTimeout(reInitTimeout);
  }
  
  const baseDelay = isMobileDevice ? REINIT_DEBOUNCE_DELAY * 1.5 : REINIT_DEBOUNCE_DELAY;
  
  reInitTimeout = setTimeout(() => {
    if (needsLightboxReInit) {
      performWebflowReInit();
    }
    reInitTimeout = null;
  }, baseDelay);
}

function performWebflowReInit(retryAttempt = 0) {
  try {
    if (window.Webflow && window.Webflow.require) {
      const lightboxModule = window.Webflow.require('lightbox');
      if (lightboxModule && lightboxModule.ready) {
        lightboxModule.ready();
        console.log(`✅ Webflow lightbox re-initialized (attempt ${retryAttempt + 1})`);
        
        // On mobile, perform additional re-initialization attempts
        if (isMobileDevice && retryAttempt < MOBILE_REINIT_DELAYS.length - 1) {
          setTimeout(() => {
            console.log(`📱 Mobile: Additional Webflow re-init attempt ${retryAttempt + 2}`);
            performWebflowReInit(retryAttempt + 1);
          }, MOBILE_REINIT_DELAYS[retryAttempt]);
        }
        
        needsLightboxReInit = false;
        mobileRetryCount = 0;
        return true;
      }
    }
  } catch (e) {
    console.error('Webflow re-init error:', e);
  }
  
  // Mobile retry logic for failed attempts
  if (isMobileDevice && retryAttempt < MOBILE_REINIT_DELAYS.length - 1) {
    setTimeout(() => {
      console.log(`📱 Mobile: Retrying Webflow re-init attempt ${retryAttempt + 2}`);
      performWebflowReInit(retryAttempt + 1);
    }, MOBILE_REINIT_DELAYS[retryAttempt]);
  }
  
  return false;
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
  
  // Process any new items that were just added (mobile-optimized timing)
  const processDelay = isMobileDevice ? 500 : 300;
  setTimeout(() => {
    processNewlyAddedItems();
  }, processDelay);
  
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

// Enhanced: Re-scan ALL items when filtering changes (this is the key fix!)
function processFilteredItems() {
  console.log('🔄 Processing items after filtering change...');
  
  const allItems = document.querySelectorAll('[wfu-lightbox-group]');
  const visibleItems = [];
  const itemsToQueue = [];
  
  allItems.forEach(item => {
    // Check if item is actually visible (not hidden by filtering)
    let currentElement = item;
    let isVisible = true;
    
    while (currentElement && currentElement !== document.body) {
      const style = getComputedStyle(currentElement);
      if (style.display === 'none' || style.visibility === 'hidden') {
        isVisible = false;
        break;
      }
      currentElement = currentElement.parentElement;
    }
    
    if (isVisible) {
      const rect = item.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight + 400;
      
      if (isInViewport) {
        // Remove from processed items so it gets re-processed
        processedItems.delete(item);
        visibleItems.push(item);
        processedItems.add(item);
      } else {
        // Queue for lazy processing
        processedItems.delete(item);
        itemsToQueue.push(item);
      }
    } else {
      // Item is hidden by filtering - remove from processed items
      processedItems.delete(item);
    }
  });
  
  console.log(`Found ${visibleItems.length} visible filtered items, ${itemsToQueue.length} queued`);
  
  // Process visible items immediately
  if (visibleItems.length > 0) {
    processItemsLazily(visibleItems);
  }
  
  // Queue non-visible items
  itemsToQueue.forEach(item => {
    queueItemForLazyProcessing(item);
  });
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

// Enhanced filtering detection with proven methods
function initFilteringDetection() {
  // Method 1: Watch for hiddentagparent changes using MutationObserver
  const tagParent = document.getElementById('tagparent');
  if (tagParent) {
    filteringObserver = new MutationObserver(() => {
      if (checkFilteringStateChange()) {
        // Debounce filtering response for mobile
        const delay = isMobileDevice ? FILTERING_DEBOUNCE_DELAY * 2 : FILTERING_DEBOUNCE_DELAY;
        setTimeout(() => {
          processFilteredItems();
        }, delay);
      }
    });
    
    filteringObserver.observe(tagParent, {
      childList: true,
      subtree: true
    });
    
    console.log('✅ Filtering detection initialized with MutationObserver');
  } else {
    console.log('⚠️ tagparent not found, using event-only detection');
  }
  
  // Method 2: Listen to all Finsweet filtering events
  const finsweetEvents = [
    'fs-cmsfilter-filtered',
    'fs-cmsfilter-change', 
    'fs-cmsfilter-search',
    'fs-cmsfilter-reset',
    'fs-cmsfilter-pagination-page-changed'
  ];
  
  finsweetEvents.forEach(eventType => {
    document.addEventListener(eventType, () => {
      console.log(`📡 Finsweet event detected: ${eventType}`);
      
      // Mobile-optimized timing for Finsweet events
      const delay = isMobileDevice ? 150 : 100;
      setTimeout(() => {
        if (checkFilteringStateChange()) {
          processFilteredItems();
        }
      }, delay);
    });
  });
  
  console.log('✅ Finsweet event listeners initialized');
  
  // Method 3: Periodic filtering state check (fallback)
  setInterval(() => {
    if (checkFilteringStateChange()) {
      console.log('🕐 Periodic check detected filtering change');
      processFilteredItems();
    }
  }, 2000);
}

// UNIFIED INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
  initLazyLoad();
  initItemProcessingObserver();
  initLoadMoreObserver();
  initFilteringDetection(); // New: Initialize filtering detection
  
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
  
  // Initial setup with mobile-optimized timing
  const initialDelay = isMobileDevice ? 800 : 500;
  setTimeout(() => {
    // Check initial filtering state
    lastFilteringState = detectFiltering();
    isCurrentlyFiltering = lastFilteringState;
    console.log(`Initial filtering state: ${lastFilteringState}`);
    
    processInitialVisibleItems();
    processLazyOnlyItems();
    observeLoadMoreButton();
    updateLazyLoad();
  }, initialDelay);
  
  // Additional mobile initialization delay
  if (isMobileDevice) {
    setTimeout(() => {
      // Re-check filtering state and process if needed
      if (checkFilteringStateChange()) {
        console.log('📱 Mobile: Additional filtering check triggered');
        processFilteredItems();
      }
    }, 1500);
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    if (itemProcessingObserver) itemProcessingObserver.disconnect();
    if (loadMoreObserver) loadMoreObserver.disconnect();
    if (filteringObserver) filteringObserver.disconnect();
    if (queueTimeout) clearTimeout(queueTimeout);
    if (reInitTimeout) clearTimeout(reInitTimeout);
  });
});

console.log('✅ Enhanced Mobile-Optimized Auto Load More + Lightbox Fix Ready!');
