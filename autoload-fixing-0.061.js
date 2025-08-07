// 🚀 ENHANCED MOBILE-OPTIMIZED Auto Load More + FancyBox 6 Fix v7.0
// 
// ✅ FEATURES:
// • Auto-clicks #load-more when visible with smart throttling
// • FancyBox 6 grouping for ALL items (new, filtered, and existing)
// • Integrates LazyLoad for images on new items  
// • Supports CMS lightbox grouping with [wfu-lightbox-group] attributes
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
// • Multiple FancyBox re-initialization attempts
// • Aggressive retry logic for stubborn lightboxes
// • Coordinated with Finsweet filtering events

console.log('🚀 Enhanced Mobile-Optimized Auto Load More + FancyBox 6 Fix Loading...');

// Global state management
let isLoadingMore = false;
let lazyLoadInstance = null;
let itemProcessingObserver = null;
let loadMoreObserver = null;
let filteringObserver = null;
let processedItems = new WeakSet();
let needsFancyBoxReInit = false;
let reInitTimeout = null;
let isCurrentlyFiltering = false;
let lastFilteringState = false;
let mobileRetryCount = 0;

// Loading state management
let activeProcesses = new Set();
let loadingHideTimeout = null;

// Loading indicator functions
function showLoading(processName) {
  activeProcesses.add(processName);
  const loadingElement = document.getElementById('loading-reports');
  if (loadingElement) {
    loadingElement.style.display = 'block';
    console.log(`📊 Loading ON (${processName}) - Active: ${Array.from(activeProcesses).join(', ')}`);
  }
  
  // Clear any pending hide timeout
  if (loadingHideTimeout) {
    clearTimeout(loadingHideTimeout);
    loadingHideTimeout = null;
  }
}

function hideLoading(processName) {
  activeProcesses.delete(processName);
  
  // Only hide if no other processes are active
  if (activeProcesses.size === 0) {
    // Add small delay to prevent flickering
    if (loadingHideTimeout) {
      clearTimeout(loadingHideTimeout);
    }
    
    loadingHideTimeout = setTimeout(() => {
      const loadingElement = document.getElementById('loading-reports');
      if (loadingElement && activeProcesses.size === 0) {
        loadingElement.style.display = 'none';
        console.log(`📊 Loading OFF (${processName}) - All processes complete`);
      }
      loadingHideTimeout = null;
    }, 300); // 300ms delay to prevent flickering
  } else {
    console.log(`📊 Loading continues (${processName} done) - Still active: ${Array.from(activeProcesses).join(', ')}`);
  }
}

// Configuration
const LOAD_MORE_DELAY = 1500; // 1.5 seconds delay between load-more clicks
const PROCESSING_CHUNK_SIZE = 1;
const REINIT_DEBOUNCE_DELAY = 200; // Base delay before re-initializing FancyBox
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

// FancyBox 6 grouping system + Multi-reporter system
function processFancyBoxGroups(item) {
  // Check if this item has lightbox group attribute
  const groupAttribute = item.getAttribute('wfu-lightbox-group');
  if (!groupAttribute) {
    console.log(`❌ No wfu-lightbox-group found on item`);
    return false;
  }
  
  console.log(`🔧 Processing FancyBox group: ${groupAttribute}`);
  
  let hasProcessedGroups = false;
  let firstImageLink = null;
  
  // First pass: Find and process all lightbox images (including the first one)
  const allLightboxLinks = item.querySelectorAll('a[lightbox-image]');
  console.log(`🔍 Found ${allLightboxLinks.length} lightbox links in group ${groupAttribute}`);
  
  allLightboxLinks.forEach((linkElement, linkIndex) => {
    const lightboxImageValue = linkElement.getAttribute('lightbox-image');
    console.log(`🔗 Processing link ${linkIndex + 1} with lightbox-image="${lightboxImageValue}"`);
    
    // Skip links that are hidden
    const computedStyle = getComputedStyle(linkElement);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      console.log(`⏭️ Skipping hidden link ${linkIndex + 1}`);
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
          console.log(`✅ Set href for link ${linkIndex + 1}: ${fullSizeImageUrl.substring(0, 50)}...`);
        } else {
          console.log(`❌ No src found for img in link ${linkIndex + 1}`);
        }
        
        // Add any additional FancyBox attributes if needed
        linkElement.setAttribute('data-caption', img.getAttribute('alt') || '');
        
        // Remember the first image link for the opener
        if (lightboxImageValue === 'first') {
          firstImageLink = linkElement;
          console.log(`🎯 Marked as first image link`);
        }
        
        hasProcessedGroups = true;
        console.log(`✅ Successfully processed link ${linkIndex + 1} for FancyBox`);
      } else {
        console.log(`❌ No img found in link ${linkIndex + 1}`);
      }
    } else {
      console.log(`⏭️ Skipping link ${linkIndex + 1} - not marked for lightbox`);
    }
  });
  
  // Second pass: Process opener links
  const openerLinks = item.querySelectorAll('a[lightbox-image="open"]');
  console.log(`🔍 Found ${openerLinks.length} opener links in group ${groupAttribute}`);
  
  openerLinks.forEach((openerLink, openerIndex) => {
    // Skip hidden opener links
    const computedStyle = getComputedStyle(openerLink);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      console.log(`⏭️ Skipping hidden opener ${openerIndex + 1}`);
      return;
    }
    
    // If we found a first image, make the opener trigger it
    if (firstImageLink) {
      openerLink.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`🎬 Opener clicked, triggering first image`);
        // Trigger click on the first image to open the gallery
        firstImageLink.click();
      });
      
      // Optional: Add visual indication that this is clickable
      openerLink.style.cursor = 'pointer';
      
      hasProcessedGroups = true;
      console.log(`✅ Successfully set up opener ${openerIndex + 1}`);
    } else {
      console.log(`❌ No first image found for opener ${openerIndex + 1}`);
    }
  });
  
  // Third pass: Process multi-reporter system
  const processedReporter = processMultiReporter(item);
  if (processedReporter) {
    hasProcessedGroups = true;
  }
  
  console.log(`📊 Group ${groupAttribute} processing complete. Success: ${hasProcessedGroups}`);
  return hasProcessedGroups;
}

// Multi-reporter processing system
function processMultiReporter(item) {
  const reportersWrap = item.querySelector('[reporters-wrap="true"]');
  if (!reportersWrap) return false;
  
  const reporterListItems = reportersWrap.querySelectorAll('[reporter-list-item="true"]');
  const reporterCount = reporterListItems.length;
  
  const multiReporterWrap = reportersWrap.querySelector('[multi-reporter-wrap="true"]');
  const reporterListWrap = reportersWrap.querySelector('[reporter-list-wrap="true"]');
  
  if (!multiReporterWrap || !reporterListWrap) return false;
  
  console.log(`👥 Processing ${reporterCount} reporters`);
  
  if (reporterCount === 0) {
    // No reporters - hide everything
    multiReporterWrap.style.display = 'none';
    reporterListWrap.style.display = 'none';
    return true;
  }
  
  if (reporterCount === 1) {
    // Single reporter - hide multi-reporter display
    multiReporterWrap.style.display = 'none';
    reporterListWrap.style.display = 'block';
    return true;
  }
  
  // Multiple reporters (2+) - show multi-reporter display
  multiReporterWrap.style.display = 'block';
  reporterListWrap.style.display = 'none';
  
  // Get reporter data
  const reporters = Array.from(reporterListItems).map(item => {
    const link = item.querySelector('[reporter-image="true"]');
    const nameElement = item.querySelector('.multi-reporter-name');
    return {
      image: link ? link.getAttribute('src') : null,
      name: nameElement ? nameElement.textContent.trim() : 'Unknown Reporter',
      element: item
    };
  }).filter(reporter => reporter.image && reporter.name !== 'Unknown Reporter');
  
  if (reporters.length === 0) {
    multiReporterWrap.style.display = 'none';
    return true;
  }
  
  // Update multi-reporter display
  const firstReporterImage = multiReporterWrap.querySelector('[first-reporter-image="true"]');
  const secondReporterImage = multiReporterWrap.querySelector('[second-reporter-image="true"]');
  const multiReporterName = multiReporterWrap.querySelector('[reporter=""], .multi-reporter-name');
  
  if (firstReporterImage && reporters[0]) {
    firstReporterImage.src = reporters[0].image;
    firstReporterImage.alt = reporters[0].name;
  }
  
  if (reporters.length === 2) {
    // Two reporters
    if (secondReporterImage && reporters[1]) {
      secondReporterImage.src = reporters[1].image;
      secondReporterImage.alt = reporters[1].name;
      secondReporterImage.style.display = 'block';
    }
    
    if (multiReporterName) {
      multiReporterName.textContent = `${reporters[0].name} & ${reporters[1].name}`;
    }
  } else {
    // Three or more reporters
    if (secondReporterImage) {
      secondReporterImage.style.display = 'none';
    }
    
    if (multiReporterName) {
      const othersCount = reporters.length - 1;
      multiReporterName.textContent = `${reporters[0].name} & ${othersCount} others`;
    }
  }
  
  // Set up modal functionality
  setupReporterModal(multiReporterWrap, reporterListWrap, reporters);
  
  console.log(`✅ Multi-reporter setup complete for ${reporters.length} reporters`);
  return true;
}

// Reporter modal system
function setupReporterModal(trigger, modal, reporters) {
  // Ensure modal is properly hidden initially
  modal.style.display = 'none';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  modal.style.zIndex = '9999';
  modal.style.padding = '20px';
  modal.style.boxSizing = 'border-box';
  modal.style.overflowY = 'auto';
  
  // Center the content
  const existingContent = modal.querySelector('.collection-list-wrapper-26');
  if (existingContent) {
    existingContent.style.maxWidth = '600px';
    existingContent.style.margin = '50px auto';
    existingContent.style.backgroundColor = '#fff';
    existingContent.style.padding = '20px';
    existingContent.style.borderRadius = '8px';
    existingContent.style.position = 'relative';
  }
  
  // Add close button if not exists
  let closeButton = modal.querySelector('.modal-close-btn');
  if (!closeButton && existingContent) {
    closeButton = document.createElement('button');
    closeButton.className = 'modal-close-btn';
    closeButton.innerHTML = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '15px';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.zIndex = '10000';
    existingContent.insertBefore(closeButton, existingContent.firstChild);
  }
  
  // Click handlers
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    console.log('📱 Reporter modal opened');
  });
  
  if (closeButton) {
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.style.display = 'none';
      document.body.style.overflow = '';
      console.log('📱 Reporter modal closed');
    });
  }
  
  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      console.log('📱 Reporter modal closed (outside click)');
    }
  });
  
  // Prevent clicks inside content from closing modal
  if (existingContent) {
    existingContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      console.log('📱 Reporter modal closed (ESC key)');
    }
  });
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
      // Check if FancyBox is already working before re-initializing
      const existingFancyboxElements = document.querySelectorAll('[data-fancybox]');
      if (existingFancyboxElements.length > 0 && retryAttempt > 0) {
        // On mobile retries, only re-init if there are actually new elements that need binding
        const unboundElements = Array.from(existingFancyboxElements).filter(el => {
          // Check if this element already has FancyBox events bound
          return !el.hasAttribute('data-fancybox-bound');
        });
        
        if (unboundElements.length === 0) {
          console.log(`📱 Mobile: Skipping re-init attempt ${retryAttempt + 1} - no new elements`);
          needsFancyBoxReInit = false;
          hideLoading('fancybox-init');
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
      
      console.log(`✅ FancyBox 6 re-initialized with thumbnails (attempt ${retryAttempt + 1})`);
      
      // On mobile, only do ONE additional re-initialization attempt instead of multiple
      if (isMobileDevice && retryAttempt === 0 && needsFancyBoxReInit) {
        setTimeout(() => {
          console.log(`📱 Mobile: Final FancyBox re-init attempt`);
          performFancyBoxReInit(1);
        }, MOBILE_REINIT_DELAYS[0]);
      } else {
        // Hide loading only if this is the final attempt
        hideLoading('fancybox-init');
      }
      
      needsFancyBoxReInit = false;
      mobileRetryCount = 0;
      return true;
    }
  } catch (e) {
    console.error('FancyBox re-init error:', e);
  }
  
  // Only retry once on mobile if the first attempt failed
  if (isMobileDevice && retryAttempt === 0) {
    setTimeout(() => {
      console.log(`📱 Mobile: Retrying FancyBox re-init due to error`);
      performFancyBoxReInit(1);
    }, MOBILE_REINIT_DELAYS[0]);
  } else {
    hideLoading('fancybox-init');
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
  showLoading('auto-load-more');
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
    hideLoading('auto-load-more');
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

function processItemsLazily(items, loadingProcessName = 'lazy-processing') {
  if (!items?.length) {
    hideLoading(loadingProcessName);
    return;
  }
  
  const processInChunks = (itemsToProcess, chunkSize = PROCESSING_CHUNK_SIZE) => {
    if (itemsToProcess.length === 0) {
      updateLazyLoad();
      // Schedule FancyBox re-init if needed
      if (needsFancyBoxReInit) {
        showLoading('fancybox-init');
        scheduleFancyBoxReInit();
      }
      hideLoading(loadingProcessName);
      return;
    }
    
    const chunk = itemsToProcess.splice(0, chunkSize);
    
    chunk.forEach(item => {
      try {
        // Process FancyBox groups
        const processed = processFancyBoxGroups(item);
        if (processed) {
          needsFancyBoxReInit = true;
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
        // Schedule FancyBox re-init if needed
        if (needsFancyBoxReInit) {
          showLoading('fancybox-init');
          scheduleFancyBoxReInit();
        }
        hideLoading(loadingProcessName);
      }, 100);
    }
  };
  
  processInChunks([...items]);
}

// Process items that were just added by load-more
function processNewlyAddedItems() {
  showLoading('load-more-processing');
  
  const allItems = document.querySelectorAll('[wfu-lightbox-group]');
  const newItems = [];
  
  console.log(`🔍 Found ${allItems.length} total items with wfu-lightbox-group`);
  
  allItems.forEach((item, index) => {
    // FORCE PROCESSING: Skip the WeakSet check for debugging
    const alreadyProcessed = processedItems.has(item);
    
    // Check if item actually has FancyBox attributes (real processing check)
    const hasDataFancybox = item.querySelector('[data-fancybox]');
    const needsProcessing = !hasDataFancybox;
    
    console.log(`🔍 Item ${index + 1} (${item.getAttribute('wfu-lightbox-group')}): processed=${alreadyProcessed}, hasDataFancybox=${!!hasDataFancybox}, needsProcessing=${needsProcessing}`);
    
    if (needsProcessing) {
      console.log(`🔧 FORCE PROCESSING item ${index + 1}: ${item.getAttribute('wfu-lightbox-group')}`);
      
      // On mobile, process all new items immediately to avoid viewport detection issues
      if (isMobileDevice) {
        newItems.push(item);
        processedItems.add(item);
        console.log(`✅ Added item ${index + 1} to processing queue`);
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
    } else {
      console.log(`⏭️ Skipping item ${index + 1}: already has FancyBox attributes`);
    }
  });
  
  if (newItems.length > 0) {
    console.log(`🚀 Processing ${newItems.length} newly loaded FancyBox items (mobile: all new items, desktop: visible only)`);
    // Process all items in one batch instead of chunked processing
    processItemsBatch(newItems, 'load-more-processing');
  } else {
    hideLoading('load-more-processing');
  }
}

// Simplified batch processing for debugging
function processItemsBatch(items, loadingProcessName = 'batch-processing') {
  if (!items?.length) {
    hideLoading(loadingProcessName);
    return;
  }
  
  console.log(`📦 Batch processing ${items.length} items`);
  
  items.forEach((item, index) => {
    try {
      console.log(`🔧 Processing item ${index + 1}: ${item.getAttribute('wfu-lightbox-group')}`);
      
      // Process FancyBox groups
      const processed = processFancyBoxGroups(item);
      if (processed) {
        console.log(`✅ Successfully processed item ${index + 1}`);
        needsFancyBoxReInit = true;
      } else {
        console.log(`❌ Failed to process item ${index + 1}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing item ${index + 1}:`, error);
    }
  });
  
  // Update LazyLoad and schedule FancyBox re-init
  setTimeout(() => {
    updateLazyLoad();
    if (needsFancyBoxReInit) {
      showLoading('fancybox-init');
      scheduleFancyBoxReInit();
    }
    hideLoading(loadingProcessName);
  }, 100);
}

// Enhanced: Re-scan ALL items when filtering changes (this is the key fix!)
function processFilteredItems() {
  showLoading('filter-processing');
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
  
  console.log(`Found ${visibleItems.length} visible filtered items, ${itemsToQueue.length} queued (mobile: all visible, desktop: viewport-based)`);
  
  // Process visible items immediately
  if (visibleItems.length > 0) {
    processItemsLazily(visibleItems, 'filter-processing');
  } else {
    hideLoading('filter-processing');
  }
  
  // Queue non-visible items (desktop only)
  if (!isMobileDevice) {
    itemsToQueue.forEach(item => {
      queueItemForLazyProcessing(item);
    });
  }
}

function processInitialVisibleItems() {
  showLoading('initial-processing');
  
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
    console.log(`Processing ${visibleItems.length} initial items (mobile: all items, desktop: visible only)`);
    processItemsLazily(visibleItems, 'initial-processing');
  } else {
    hideLoading('initial-processing');
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
  // Wait for FancyBox to be available
  const initWhenReady = () => {
    if (typeof Fancybox === 'undefined') {
      setTimeout(initWhenReady, 100);
      return;
    }
    
    console.log('✅ FancyBox 6 detected, initializing...');
    
    initLazyLoad();
    initItemProcessingObserver();
    initLoadMoreObserver();
    initFilteringDetection();
    
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
    
    // Additional mobile initialization delay - DISABLED for debugging
    // if (isMobileDevice) {
    //   setTimeout(() => {
    //     // Re-check filtering state and process if needed
    //     if (checkFilteringStateChange()) {
    //       console.log('📱 Mobile: Additional filtering check triggered');
    //       processFilteredItems();
    //     }
    //   }, 1500);
    // }
    
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

console.log('✅ Enhanced Mobile-Optimized Auto Load More + FancyBox 6 Fix Ready!');
