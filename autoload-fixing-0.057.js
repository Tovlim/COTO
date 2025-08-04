// 🚀 ENHANCED MOBILE-OPTIMIZED Auto Load More + FancyBox 6 Fix + Tabs v8.3 (DEBUG)
// 
// ✅ FEATURES:
// • Auto-clicks #load-more when visible with smart throttling
// • FancyBox 6 grouping for ALL items (new, filtered, and existing)
// • Integrates LazyLoad for images on new items  
// • Supports CMS lightbox grouping with [wfu-lightbox-group] attributes
// • Parent-scoped tab system with data-tab and data-tab-content attributes
// • Shows #loading-reports during any loading/processing operations
// • Works with Finsweet list load v2 (2025) + Finsweet Filter v2 (2025)
// • IMMEDIATE processing of new load-more items
// • COMPLETE re-processing when filtering changes
// • Mobile-optimized timing and retry logic
// • Enhanced FancyBox re-initialization for mobile reliability
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
// • SMART PROCESSING: Processes visible items + detects filtering changes
// • Finsweet-coordinated event handling
// • Attribute-based targeting for precision
// • Mobile-aggressive FancyBox re-initialization
// • Efficient parent-scoped tab queries
// • Dramatically reduces initial page load work
// • Prevents UI freezing on large item counts
// • Smart viewport detection with buffer zone
// • Multiple re-initialization attempts for mobile
//
// 🔄 AUTO LOAD MORE:
// • Automatically clicks load-more button when it becomes visible
// • Preserves scroll position during loading
// • Coordinates with lightbox processing for optimal performance
// • Shows loading indicator during processing
//
// 📑 TAB SYSTEM:
// • Parent-scoped tabs using data-tab and data-tab-content attributes
// • No tabs active by default - all content hidden initially
// • Click active tab to close it (toggle behavior)
// • Automatic tab initialization for all CMS items
// • Handles dynamically loaded content
// • Mobile-optimized tab switching
// • Re-initializes tabs after filtering (same as FancyBox)
//
// 📊 LOADING INDICATOR:
// • Shows #loading-reports element during any processing
// • Tracks multiple concurrent loading operations
// • Automatically hides when all processing is complete
// • Works with auto-load, manual load, filtering, and initial load
//
// 📱 MOBILE OPTIMIZATIONS:
// • Enhanced timing for mobile browsers
// • Multiple FancyBox re-initialization attempts
// • Aggressive retry logic for stubborn lightboxes
// • Coordinated with Finsweet filtering events

// Global state management
let isLoadingMore = false;
let lazyLoadInstance = null;
let itemProcessingObserver = null;
let loadMoreObserver = null;
let filteringObserver = null;
let processedItems = new WeakSet();
let processedTabItems = new WeakSet();
let needsFancyBoxReInit = false;
let reInitTimeout = null;
let isCurrentlyFiltering = false;
let lastFilteringState = false;
let mobileRetryCount = 0;
let activeLoadingProcesses = 0;

// Configuration
const LOAD_MORE_DELAY = 1500; // 1.5 seconds delay between load-more clicks
const PROCESSING_CHUNK_SIZE = 1;
const REINIT_DEBOUNCE_DELAY = 200; // Base delay before re-initializing FancyBox
const MOBILE_REINIT_DELAYS = [300, 600, 1200]; // Mobile retry delays
const FILTERING_DEBOUNCE_DELAY = 100; // Delay for filtering detection

// Device detection (reuse existing isMobile if available, otherwise create it)
const isMobileDevice = typeof isMobile !== 'undefined' ? isMobile : (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

// Loading indicator management
function showLoadingIndicator() {
  activeLoadingProcesses++;
  console.log(`[LOADING] Show called. Active processes: ${activeLoadingProcesses}`);
  const loadingElement = document.getElementById('loading-reports');
  if (loadingElement) {
    loadingElement.style.display = 'block';
  }
}

function hideLoadingIndicator() {
  activeLoadingProcesses--;
  console.log(`[LOADING] Hide called. Active processes: ${activeLoadingProcesses}`);
  if (activeLoadingProcesses <= 0) {
    activeLoadingProcesses = 0;
    const loadingElement = document.getElementById('loading-reports');
    if (loadingElement) {
      loadingElement.style.display = 'none';
      console.log(`[LOADING] Hidden. Reset to 0`);
    }
  }
}

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
    lastFilteringState = currentlyFiltering;
    isCurrentlyFiltering = currentlyFiltering;
    return true;
  }
  
  return false;
}

// TAB SYSTEM
function initializeTabs(cmsItem) {
  // Check if we've already processed tabs for this item
  if (processedTabItems.has(cmsItem)) {
    return;
  }
  
  // Find all tabs within this CMS item
  const tabs = cmsItem.querySelectorAll('[data-tab]');
  const tabContents = cmsItem.querySelectorAll('[data-tab-content]');
  
  if (tabs.length === 0 || tabContents.length === 0) {
    return; // No tabs in this item
  }
  
  // Remove any existing event listeners before re-initializing
  tabs.forEach((tab) => {
    const newTab = tab.cloneNode(true);
    tab.parentNode.replaceChild(newTab, tab);
  });
  
  // Re-query tabs after cloning
  const freshTabs = cmsItem.querySelectorAll('[data-tab]');
  
  // Hide all tab contents by default (no active tab)
  tabContents.forEach((content) => {
    content.style.display = 'none';
    content.classList.remove('active-tab-content');
  });
  
  // Remove active class from all tabs
  freshTabs.forEach((tab) => {
    tab.classList.remove('active-tab');
    
    // Add click handler with toggle functionality
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      
      const tabIndex = this.getAttribute('data-tab');
      const isCurrentlyActive = this.classList.contains('active-tab');
      
      // If clicking the active tab, close it
      if (isCurrentlyActive) {
        // Remove active state from tab
        this.classList.remove('active-tab');
        
        // Hide the corresponding content
        tabContents.forEach(content => {
          const contentIndex = content.getAttribute('data-tab-content');
          if (contentIndex === tabIndex) {
            content.style.display = 'none';
            content.classList.remove('active-tab-content');
          }
        });
      } else {
        // Otherwise, switch to the clicked tab
        // Update active tab
        freshTabs.forEach(t => t.classList.remove('active-tab'));
        this.classList.add('active-tab');
        
        // Show corresponding content
        tabContents.forEach(content => {
          const contentIndex = content.getAttribute('data-tab-content');
          if (contentIndex === tabIndex) {
            content.style.display = 'block';
            content.classList.add('active-tab-content');
            
            // Trigger LazyLoad update for any lazy images in the newly shown tab
            if (lazyLoadInstance) {
              const lazyImages = content.querySelectorAll('.lazy');
              if (lazyImages.length > 0) {
                setTimeout(() => {
                  lazyLoadInstance.update();
                }, 100);
              }
            }
          } else {
            content.style.display = 'none';
            content.classList.remove('active-tab-content');
          }
        });
      }
    });
  });
  
  // Mark this item as processed for tabs
  processedTabItems.add(cmsItem);
}

// Process tabs for newly loaded items
function processTabsForNewItems() {
  // Find all CMS items that might have tabs
  const cmsItems = document.querySelectorAll('.cms-item, [data-item-slug], .w-dyn-item');
  
  cmsItems.forEach(item => {
    if (!processedTabItems.has(item)) {
      // Check if this item contains tabs
      const hasTabs = item.querySelector('[data-tab]');
      if (hasTabs) {
        initializeTabs(item);
      }
    }
  });
}

// Force re-process tabs for filtered items
function reprocessTabsForFilteredItems() {
  // Find all CMS items that might have tabs
  const cmsItems = document.querySelectorAll('.cms-item, [data-item-slug], .w-dyn-item');
  const visibleTabItems = [];
  
  cmsItems.forEach(item => {
    // Check if this item contains tabs
    const hasTabs = item.querySelector('[data-tab]');
    if (!hasTabs) return;
    
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
      // Remove from processed items to force re-initialization
      processedTabItems.delete(item);
      visibleTabItems.push(item);
    }
  });
  
  // Re-initialize tabs for all visible items
  visibleTabItems.forEach(item => {
    initializeTabs(item);
  });
}

// FancyBox 6 grouping system based on attributes
function processFancyBoxGroups(item) {
  // Check if this item has lightbox group attribute
  const groupAttribute = item.getAttribute('wfu-lightbox-group');
  if (!groupAttribute) {
    return false;
  }
  
  let hasProcessedGroups = false;
  let firstImageLink = null;
  
  // First pass: Find and process all lightbox images (including the first one)
  const allLightboxLinks = item.querySelectorAll('a[lightbox-image]');
  
  allLightboxLinks.forEach((linkElement, linkIndex) => {
    const lightboxImageValue = linkElement.getAttribute('lightbox-image');
    
    // Skip links that are hidden
    const computedStyle = getComputedStyle(linkElement);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return; // Skip this hidden link
    }
    
    // Process links with lightbox-image="true" or lightbox-image="first"
    if (lightboxImageValue === 'true' || lightboxImageValue === 'first') {
      const img = linkElement.querySelector('img');
      if (img) {
        // Set FancyBox data attribute for grouping
        linkElement.setAttribute('data-fancybox', groupAttribute);
        
        // Set href to the full-size image (from img src)
        const fullSizeImageUrl = img.getAttribute('src');
        if (fullSizeImageUrl) {
          linkElement.setAttribute('href', fullSizeImageUrl);
        }
        
        // Add any additional FancyBox attributes if needed
        linkElement.setAttribute('data-caption', img.getAttribute('alt') || '');
        
        // Remember the first image link for the opener
        if (lightboxImageValue === 'first') {
          firstImageLink = linkElement;
        }
        
        hasProcessedGroups = true;
      }
    }
  });
  
  // Second pass: Process opener links
  const openerLinks = item.querySelectorAll('a[lightbox-image="open"]');
  
  openerLinks.forEach((openerLink, openerIndex) => {
    // Skip hidden opener links
    const computedStyle = getComputedStyle(openerLink);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return;
    }
    
    // If we found a first image, make the opener trigger it
    if (firstImageLink) {
      openerLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Trigger click on the first image to open the gallery
        firstImageLink.click();
      });
      
      // Optional: Add visual indication that this is clickable
      openerLink.style.cursor = 'pointer';
      
      hasProcessedGroups = true;
    }
  });
  
  return hasProcessedGroups;
}

// Enhanced FancyBox re-initialization with mobile-aggressive retry logic
function scheduleFancyBoxReInit() {
  if (reInitTimeout) {
    clearTimeout(reInitTimeout);
  }
  
  const baseDelay = isMobileDevice ? REINIT_DEBOUNCE_DELAY * 1.5 : REINIT_DEBOUNCE_DELAY;
  
  reInitTimeout = setTimeout(() => {
    if (needsFancyBoxReInit) {
      performFancyBoxReInit();
    }
    reInitTimeout = null;
  }, baseDelay);
}

function performFancyBoxReInit(retryAttempt = 0) {
  try {
    if (window.Fancybox) {
      console.log(`[FANCYBOX] Re-init started (attempt ${retryAttempt + 1})`);
      showLoadingIndicator();
      
      // Check if FancyBox is already working before re-initializing
      const existingFancyboxElements = document.querySelectorAll('[data-fancybox]');
      if (existingFancyboxElements.length > 0 && retryAttempt > 0) {
        // On mobile retries, only re-init if there are actually new elements that need binding
        const unboundElements = Array.from(existingFancyboxElements).filter(el => {
          // Check if this element already has FancyBox events bound
          return !el.hasAttribute('data-fancybox-bound');
        });
        
        if (unboundElements.length === 0) {
          console.log(`[FANCYBOX] No unbound elements, skipping re-init`);
          needsFancyBoxReInit = false;
          hideLoadingIndicator();
          return true;
        }
      }
      
      // FancyBox 6 initialization with thumbnails
      Fancybox.bind('[data-fancybox]', {
        // Enable thumbnails
        Thumbs: {
          autoStart: true,
          axis: 'x'
        },
        // Mobile optimizations
        touch: {
          vertical: true,
          momentum: true
        },
        // Performance settings
        preload: 1,
        // UI customizations
        Toolbar: {
          display: {
            left: ['infobar'],
            middle: [],
            right: ['slideshow', 'thumbs', 'close']
          }
        }
      });
      
      // Mark elements as bound to prevent unnecessary re-binding
      existingFancyboxElements.forEach(el => {
        el.setAttribute('data-fancybox-bound', 'true');
      });
      
      console.log(`[FANCYBOX] Re-init complete`);
      
      // On mobile, only do ONE additional re-initialization attempt instead of multiple
      if (isMobileDevice && retryAttempt === 0 && needsFancyBoxReInit) {
        setTimeout(() => {
          performFancyBoxReInit(1);
        }, MOBILE_REINIT_DELAYS[0]);
      } else {
        hideLoadingIndicator();
      }
      
      needsFancyBoxReInit = false;
      mobileRetryCount = 0;
      return true;
    }
  } catch (e) {
    console.error(`[FANCYBOX] Re-init error:`, e);
    hideLoadingIndicator();
  }
  
  // Only retry once on mobile if the first attempt failed
  if (isMobileDevice && retryAttempt === 0) {
    setTimeout(() => {
      performFancyBoxReInit(1);
    }, MOBILE_REINIT_DELAYS[0]);
  } else {
    hideLoadingIndicator();
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
    processTabsForNewItems(); // Process tabs for new items
  }, processDelay);
  
  // Reset loading flag after delay
  setTimeout(() => {
    isLoadingMore = false;
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
    
    // Add click listener for manual clicks
    if (!loadMoreButton.hasAttribute('data-manual-click-listener')) {
      loadMoreButton.setAttribute('data-manual-click-listener', 'true');
      
      loadMoreButton.addEventListener('click', function() {
        // Process any new items after a delay (same as auto-click)
        const processDelay = isMobileDevice ? 500 : 300;
        setTimeout(() => {
          processNewlyAddedItems();
          processTabsForNewItems();
        }, processDelay);
      });
    }
    
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
  
  console.log(`[PROCESS] processItemsLazily started with ${items.length} items`);
  showLoadingIndicator();
  
  const processInChunks = (itemsToProcess, chunkSize = PROCESSING_CHUNK_SIZE) => {
    if (itemsToProcess.length === 0) {
      console.log(`[PROCESS] All chunks processed, updating LazyLoad`);
      updateLazyLoad();
      // Schedule FancyBox re-init if needed
      if (needsFancyBoxReInit) {
        scheduleFancyBoxReInit();
      }
      hideLoadingIndicator();
      return;
    }
    
    const chunk = itemsToProcess.splice(0, chunkSize);
    console.log(`[PROCESS] Processing chunk of ${chunk.length} items, ${itemsToProcess.length} remaining`);
    
    chunk.forEach(item => {
      try {
        // Process FancyBox groups
        const processed = processFancyBoxGroups(item);
        if (processed) {
          needsFancyBoxReInit = true;
        }
        
      } catch (error) {
        console.error(`[PROCESS] Error processing item:`, error);
      }
    });
    
    // Process next chunk
    if (itemsToProcess.length > 0) {
      requestAnimationFrame(() => processInChunks(itemsToProcess, chunkSize));
    } else {
      setTimeout(() => {
        console.log(`[PROCESS] Final cleanup`);
        updateLazyLoad();
        // Schedule FancyBox re-init if needed
        if (needsFancyBoxReInit) {
          scheduleFancyBoxReInit();
        }
        hideLoadingIndicator();
      }, 100);
    }
  };
  
  processInChunks([...items]);
}

// Process items that were just added by load-more
function processNewlyAddedItems() {
  const allItems = document.querySelectorAll('[wfu-lightbox-group]');
  const newItems = [];
  
  allItems.forEach((item, index) => {
    // FORCE PROCESSING: Skip the WeakSet check for debugging
    const alreadyProcessed = processedItems.has(item);
    
    // Check if item actually has FancyBox attributes (real processing check)
    const hasDataFancybox = item.querySelector('[data-fancybox]');
    const needsProcessing = !hasDataFancybox;
    
    if (needsProcessing) {
      // On mobile, process all new items immediately to avoid viewport detection issues
      if (isMobileDevice) {
        newItems.push(item);
        processedItems.add(item);
      } else {
        // On desktop, use viewport detection as before
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
    }
  });
  
  if (newItems.length > 0) {
    // Process all items in one batch instead of chunked processing
    processItemsBatch(newItems);
  }
}

// Simplified batch processing for debugging
function processItemsBatch(items) {
  if (!items?.length) return;
  
  showLoadingIndicator();
  
  items.forEach((item, index) => {
    try {
      // Process FancyBox groups
      const processed = processFancyBoxGroups(item);
      if (processed) {
        needsFancyBoxReInit = true;
      }
    } catch (error) {
      // Silently handle error
    }
  });
  
  // Update LazyLoad and schedule FancyBox re-init
  setTimeout(() => {
    updateLazyLoad();
    if (needsFancyBoxReInit) {
      scheduleFancyBoxReInit();
    }
    hideLoadingIndicator();
  }, 100);
}

// Enhanced: Re-scan ALL items when filtering changes (this is the key fix!)
function processFilteredItems() {
  console.log(`[FILTERING] processFilteredItems started`);
  showLoadingIndicator();
  
  // Clear processed tabs to re-initialize them after filtering
  processedTabItems = new WeakSet();
  
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
      // On mobile, process all visible filtered items immediately
      if (isMobileDevice) {
        // Remove from processed items so it gets re-processed
        processedItems.delete(item);
        visibleItems.push(item);
        processedItems.add(item);
      } else {
        // On desktop, use viewport detection as before
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
      }
    } else {
      // Item is hidden by filtering - remove from processed items
      processedItems.delete(item);
    }
  });
  
  console.log(`[FILTERING] Found ${visibleItems.length} visible items to process`);
  
  // Process visible items immediately
  if (visibleItems.length > 0) {
    processItemsLazily(visibleItems);
    // Note: processItemsLazily will handle its own hideLoadingIndicator
  } else {
    // If no visible items to process, hide loading immediately
    console.log(`[FILTERING] No visible items, hiding loading`);
    hideLoadingIndicator();
  }
  
  // Queue non-visible items (desktop only)
  if (!isMobileDevice) {
    itemsToQueue.forEach(item => {
      queueItemForLazyProcessing(item);
    });
  }
  
  // Force re-process tabs for all visible filtered items
  setTimeout(() => {
    console.log(`[FILTERING] Starting tab reprocessing`);
    reprocessTabsForFilteredItems();
  }, 200);
}

function processInitialVisibleItems() {
  const allItems = document.querySelectorAll('[wfu-lightbox-group]');
  const visibleItems = [];
  const itemsToQueue = [];
  
  allItems.forEach(item => {
    // On mobile, process all items immediately to avoid viewport detection issues
    if (isMobileDevice) {
      visibleItems.push(item);
      processedItems.add(item);
    } else {
      // On desktop, use viewport detection as before
      const rect = item.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      
      if (isVisible) {
        visibleItems.push(item);
        processedItems.add(item);
      } else {
        itemsToQueue.push(item);
      }
    }
  });
  
  // Process visible items immediately
  if (visibleItems.length > 0) {
    processItemsLazily(visibleItems);
  }
  
  // Queue non-visible items (desktop only)
  if (!isMobileDevice) {
    itemsToQueue.forEach(item => {
      queueItemForLazyProcessing(item);
    });
  }
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
      // Mobile-optimized timing for Finsweet events
      const delay = isMobileDevice ? 150 : 100;
      setTimeout(() => {
        if (checkFilteringStateChange()) {
          processFilteredItems();
        }
      }, delay);
    });
  });
  
  // Method 3: Periodic filtering state check (fallback)
  setInterval(() => {
    if (checkFilteringStateChange()) {
      processFilteredItems();
    }
  }, 2000);
}

// UNIFIED INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
  // Hide loading indicator initially
  const loadingElement = document.getElementById('loading-reports');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
  
  // Wait for FancyBox to be available
  const initWhenReady = () => {
    if (typeof Fancybox === 'undefined') {
      setTimeout(initWhenReady, 100);
      return;
    }
    
    initLazyLoad();
    initItemProcessingObserver();
    initLoadMoreObserver();
    initFilteringDetection();
    
    let pendingLightboxItems = new Set();
    let pendingLazyItems = new Set();
    let pendingTabItems = new Set();
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
        
        // Process tab items
        if (pendingTabItems.size > 0) {
          const itemsToProcess = Array.from(pendingTabItems);
          pendingTabItems.clear();
          
          itemsToProcess.forEach(item => {
            if (!processedTabItems.has(item)) {
              initializeTabs(item);
            }
          });
        }
        
        queueTimeout = null;
      }, 100);
    };
    
    // Unified mutation observer
    const observer = new MutationObserver((mutations) => {
      let hasNewItems = false;
      let hasNewLoadMore = false;
      let hasNewTabs = false;
      
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
            
            // Check for new tab items
            const cmsItems = node.querySelectorAll('.cms-item, [data-item-slug], .w-dyn-item');
            for (const item of cmsItems) {
              const hasTabs = item.querySelector('[data-tab]');
              if (hasTabs) {
                pendingTabItems.add(item);
                hasNewTabs = true;
              }
            }
            
            // Also check if the node itself is a CMS item with tabs
            if (node.matches && (node.matches('.cms-item') || node.matches('[data-item-slug]') || node.matches('.w-dyn-item'))) {
              const hasTabs = node.querySelector('[data-tab]');
              if (hasTabs) {
                pendingTabItems.add(node);
                hasNewTabs = true;
              }
            }
            
            // Check for new load-more button
            if (node.id === 'load-more' || node.querySelector('#load-more')) {
              hasNewLoadMore = true;
            }
          }
        }
      }
      
      if (hasNewItems || hasNewTabs) {
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
      
      processInitialVisibleItems();
      processLazyOnlyItems();
      processTabsForNewItems(); // Process tabs on initial load
      observeLoadMoreButton();
      updateLazyLoad();
    }, initialDelay);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
      if (itemProcessingObserver) itemProcessingObserver.disconnect();
      if (loadMoreObserver) loadMoreObserver.disconnect();
      if (filteringObserver) filteringObserver.disconnect();
      if (queueTimeout) clearTimeout(queueTimeout);
      if (reInitTimeout) clearTimeout(reInitTimeout);
    });
  };
  
  initWhenReady();
});
