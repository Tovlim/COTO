// 🚀 ENHANCED MOBILE-OPTIMIZED Auto Load More + FancyBox 6 Fix + Tabs + Multi-Reporter v9.0
// 
// ✅ FEATURES:
// • Auto-clicks #load-more when visible with smart throttling
// • FancyBox 6 grouping for ALL items (new, filtered, and existing)
// • Integrates LazyLoad for images on new items  
// • Supports CMS lightbox grouping with [wfu-lightbox-group] attributes
// • Parent-scoped tab system with data-tab and data-tab-content attributes
// • Multi-reporter display with modal functionality
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
// 👥 MULTI-REPORTER SYSTEM:
// • Automatically detects number of reporters per report
// • Single reporter: hides multi-reporter UI
// • Two reporters: shows "Name & Name" format
// • Three+ reporters: shows "Name & X others" format
// • Modal opens on multi-reporter click
// • Modal closes on close button click
// • Scoped to report items with proper image handling
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
let processedReporterItems = new WeakSet();
let needsFancyBoxReInit = false;
let reInitTimeout = null;
let lastFilteringState = false;
let activeLoadingProcesses = 0;

// Enhanced state tracking using data attributes
const ProcessingState = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed'
};

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
  const loadingElement = document.getElementById('loading-reports');
  if (loadingElement) {
    loadingElement.style.display = 'block';
  }
}

function hideLoadingIndicator() {
  activeLoadingProcesses--;
  if (activeLoadingProcesses <= 0) {
    activeLoadingProcesses = 0;
    const loadingElement = document.getElementById('loading-reports');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }
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
    return true;
  }
  
  return false;
}

// TAB SYSTEM
function initializeTabs(cmsItem) {
  // Check state attribute first
  if (!needsProcessing(cmsItem, 'tabs')) {
    return;
  }
  
  // Check if we've already processed tabs for this item
  if (processedTabItems.has(cmsItem)) {
    updateProcessingState(cmsItem, 'tabs', ProcessingState.COMPLETED);
    return;
  }
  
  updateProcessingState(cmsItem, 'tabs', ProcessingState.PROCESSING);
  
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
  updateProcessingState(cmsItem, 'tabs', ProcessingState.COMPLETED);
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

// MULTI-REPORTER SYSTEM
function initializeReporters(reportItem) {
  // Check state attribute first
  if (!needsProcessing(reportItem, 'reporters')) {
    return;
  }
  
  // Check if we've already processed reporters for this item
  if (processedReporterItems.has(reportItem)) {
    updateProcessingState(reportItem, 'reporters', ProcessingState.COMPLETED);
    return;
  }
  
  updateProcessingState(reportItem, 'reporters', ProcessingState.PROCESSING);
  
  // Find reporter elements within this report
  const reportersWrap = reportItem.querySelector('[reporters-wrap="true"]');
  if (!reportersWrap) return;
  
  const multiReporterWrap = reportersWrap.querySelector('[multi-reporter-wrap="true"]');
  const reporterListWrap = reportersWrap.querySelector('[reporter-list-wrap="true"]');
  const reporterItems = reportersWrap.querySelectorAll('[reporter-list-item="true"]');
  
  if (!multiReporterWrap || !reporterListWrap || reporterItems.length === 0) return;
  
  const reporterCount = reporterItems.length;
  
  // Single reporter - hide multi-reporter UI and show regular list
  if (reporterCount === 1) {
    multiReporterWrap.style.display = 'none';
    reporterListWrap.style.display = 'flex';
    processedReporterItems.add(reportItem);
    updateProcessingState(reportItem, 'reporters', ProcessingState.COMPLETED);
    return;
  }
  
  // Multiple reporters - set up UI
  multiReporterWrap.style.display = 'flex';
  reporterListWrap.style.display = 'none'; // Hide by default, show only on modal
  
  // Get reporter data
  const reporters = Array.from(reporterItems).map(item => {
    const nameElement = item.querySelector('.multi-reporter-name');
    const imageElement = item.querySelector('[reporter-image="true"]');
    return {
      name: nameElement ? nameElement.textContent : '',
      imageSrc: imageElement ? imageElement.src : ''
    };
  });
  
  // Set up images
  const firstReporterImage = multiReporterWrap.querySelector('[first-reporter-image="true"]');
  const secondReporterImage = multiReporterWrap.querySelector('[second-reporter-image="true"]');
  
  if (firstReporterImage && reporters[0]) {
    firstReporterImage.src = reporters[0].imageSrc;
    firstReporterImage.alt = reporters[0].name;
    firstReporterImage.classList.add('lazy');
  }
  
  if (secondReporterImage && reporters[1]) {
    secondReporterImage.src = reporters[1].imageSrc;
    secondReporterImage.alt = reporters[1].name;
    secondReporterImage.classList.add('lazy');
  }
  
  // Set up names
  const nameElement = multiReporterWrap.querySelector('.multi-reporter-name');
  if (nameElement) {
    if (reporterCount === 2) {
      nameElement.textContent = `${reporters[0].name} & ${reporters[1].name}`;
    } else {
      nameElement.textContent = `${reporters[0].name} & ${reporterCount - 1} others`;
    }
  }
  
  // Set up modal trigger
  multiReporterWrap.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Add modal-click class to the three elements within this report
    const modalPreWrap = reportersWrap.querySelector('.modal-pre-wrap');
    const modalElements = reportersWrap.querySelector('[modal-elements="true"]');
    
    if (reporterListWrap) {
      reporterListWrap.classList.add('modal-click');
      reporterListWrap.style.display = 'flex'; // Show when modal opens
    }
    if (modalPreWrap) modalPreWrap.classList.add('modal-click');
    if (modalElements) modalElements.classList.add('modal-click');
  });
  
  // Set up modal background click to close
  if (reporterListWrap) {
    reporterListWrap.addEventListener('click', function(e) {
      // Only close if clicking directly on the reporterListWrap, not its children
      if (e.target === this) {
        e.preventDefault();
        
        // Remove modal-click class from the three elements
        const modalPreWrap = reportersWrap.querySelector('.modal-pre-wrap');
        const modalElements = reportersWrap.querySelector('[modal-elements="true"]');
        
        this.classList.remove('modal-click');
        this.style.display = 'none'; // Hide when modal closes
        if (modalPreWrap) modalPreWrap.classList.remove('modal-click');
        if (modalElements) modalElements.classList.remove('modal-click');
      }
    });
  }
  
  // Set up modal close button
  const closeBtn = reportersWrap.querySelector('[modal-close-btn="true"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove modal-click class from the three elements
      const modalPreWrap = reportersWrap.querySelector('.modal-pre-wrap');
      const modalElements = reportersWrap.querySelector('[modal-elements="true"]');
      
      if (reporterListWrap) {
        reporterListWrap.classList.remove('modal-click');
        reporterListWrap.style.display = 'none'; // Hide when modal closes
      }
      if (modalPreWrap) modalPreWrap.classList.remove('modal-click');
      if (modalElements) modalElements.classList.remove('modal-click');
    });
  }
  
  // Mark this item as processed for reporters
  processedReporterItems.add(reportItem);
  updateProcessingState(reportItem, 'reporters', ProcessingState.COMPLETED);
  
  // Update LazyLoad for new images
  if (lazyLoadInstance) {
    setTimeout(() => {
      lazyLoadInstance.update();
    }, 100);
  }
}

// Process reporters for newly loaded items
function processReportersForNewItems() {
  // Find all report items with the lightbox group attribute
  const reportItems = document.querySelectorAll('[wfu-lightbox-group]');
  
  reportItems.forEach(item => {
    if (!processedReporterItems.has(item)) {
      // Check if this item contains reporters
      const hasReporters = item.querySelector('[reporters-wrap="true"]');
      if (hasReporters) {
        initializeReporters(item);
      }
    }
  });
}

// Force re-process reporters for filtered items
function reprocessReportersForFilteredItems() {
  // Find all report items
  const reportItems = document.querySelectorAll('[wfu-lightbox-group]');
  const visibleReporterItems = [];
  
  reportItems.forEach(item => {
    // Check if this item contains reporters
    const hasReporters = item.querySelector('[reporters-wrap="true"]');
    if (!hasReporters) return;
    
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
      processedReporterItems.delete(item);
      visibleReporterItems.push(item);
    }
  });
  
  // Re-initialize reporters for all visible items
  visibleReporterItems.forEach(item => {
    initializeReporters(item);
  });
}

// Check if item needs processing based on state attributes
function needsProcessing(item, type) {
  const stateAttr = item.getAttribute(`data-${type}-state`);
  return stateAttr !== ProcessingState.COMPLETED;
}

// Update processing state
function updateProcessingState(item, type, state) {
  item.setAttribute(`data-${type}-state`, state);
  
  // Update main processing state if all subsystems are complete
  if (state === ProcessingState.COMPLETED) {
    const lightboxDone = item.getAttribute('data-lightbox-state') === ProcessingState.COMPLETED;
    const tabsDone = item.getAttribute('data-tabs-state') === ProcessingState.COMPLETED;
    const reportersDone = item.getAttribute('data-reporters-state') === ProcessingState.COMPLETED;
    const lazyDone = item.getAttribute('data-lazy-state') === ProcessingState.COMPLETED;
    
    if (lightboxDone && tabsDone && reportersDone && lazyDone) {
      item.setAttribute('data-processing-state', ProcessingState.COMPLETED);
    }
  } else if (state === ProcessingState.PROCESSING) {
    item.setAttribute('data-processing-state', ProcessingState.PROCESSING);
  }
}

// FancyBox 6 grouping system based on attributes
function processFancyBoxGroups(item) {
  console.log('🎯 Starting processFancyBoxGroups for item:', item);
  
  // First check if already configured
  const alreadyConfigured = item.querySelector('[data-fancybox-configured="true"]');
  if (alreadyConfigured) {
    console.log('⚡ Item already configured, checking existing fancybox items:', {
      existingFancyboxItems: item.querySelectorAll('[data-fancybox]').length,
      allLinks: item.querySelectorAll('a[lightbox-image]')
    });
    
    // Clean up any empty FancyBox images from previous configurations
    const existingFancyboxItems = item.querySelectorAll('[data-fancybox]');
    let removedCount = 0;
    
    existingFancyboxItems.forEach(fancyboxLink => {
      const img = fancyboxLink.querySelector('img');
      if (img) {
        const srcValue = img.getAttribute('src');
        const hrefValue = fancyboxLink.getAttribute('href');
        
        console.log('🔍 Checking existing FancyBox item:', {
          src: srcValue,
          href: hrefValue,
          isEmpty: !srcValue || srcValue.trim() === '' || srcValue === 'about:blank'
        });
        
        // Remove FancyBox attributes from empty images
        if (!srcValue || srcValue.trim() === '' || srcValue === 'about:blank') {
          console.log('🧹 Removing empty image from FancyBox:', fancyboxLink);
          fancyboxLink.removeAttribute('data-fancybox');
          fancyboxLink.removeAttribute('data-caption');
          fancyboxLink.removeAttribute('data-thumb');
          removedCount++;
        }
      }
    });
    
    if (removedCount > 0) {
      console.log(`✨ Cleaned up ${removedCount} empty images from pre-configured item`);
    }
    
    // Still need to set up opener click handlers even if pre-configured
    const openerLinks = item.querySelectorAll('a[lightbox-image="open"], a[lightbox-image="opener"]');
    if (openerLinks.length > 0) {
      
      openerLinks.forEach(openerLink => {
        const triggerGroup = openerLink.getAttribute('data-fancybox-trigger');
        if (triggerGroup && !openerLink.hasAttribute('data-opener-setup')) {
          
          openerLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            const galleryItems = document.querySelectorAll(`[data-fancybox="${triggerGroup}"]`);
            
            if (galleryItems.length > 0) {
              galleryItems[0].click();
            }
          });
          
          openerLink.setAttribute('data-opener-setup', 'true');
          openerLink.style.cursor = 'pointer';
        }
      });
    }
    
    updateProcessingState(item, 'lightbox', ProcessingState.COMPLETED);
    return true; // Already configured, just need FancyBox re-init
  }
  
  // Check if this item has lightbox group attribute
  const groupAttribute = item.getAttribute('wfu-lightbox-group');
  if (!groupAttribute) {
    updateProcessingState(item, 'lightbox', ProcessingState.COMPLETED);
    return false;
  }
  
  // Check if needs processing based on state
  if (!needsProcessing(item, 'lightbox')) {
    return false;
  }
  
  updateProcessingState(item, 'lightbox', ProcessingState.PROCESSING);
  
  let hasProcessedGroups = false;
  let firstImageLink = null;
  
  // First pass: Find and process all lightbox images (including the first one)
  const allLightboxLinks = item.querySelectorAll('a[lightbox-image]');
  
  allLightboxLinks.forEach((linkElement) => {
    const lightboxImageValue = linkElement.getAttribute('lightbox-image');
    
    console.log('🔍 Processing lightbox link:', {
      lightboxImageValue,
      groupAttribute,
      linkElement
    });
    
    // Skip links that are hidden
    const computedStyle = getComputedStyle(linkElement);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      console.log('⚠️ Skipping hidden link');
      return; // Skip this hidden link
    }
    
    // Process links with lightbox-image="true" or lightbox-image="first"
    if (lightboxImageValue === 'true' || lightboxImageValue === 'first') {
      const img = linkElement.querySelector('img');
      if (img) {
        // Get the full-size image URL
        const fullSizeImageUrl = img.getAttribute('src');
        const hrefValue = linkElement.getAttribute('href');
        
        console.log('📸 Found image:', {
          src: fullSizeImageUrl,
          href: hrefValue,
          srcEmpty: fullSizeImageUrl === '',
          srcTrimEmpty: fullSizeImageUrl && fullSizeImageUrl.trim() === '',
          srcNull: fullSizeImageUrl === null,
          srcUndefined: fullSizeImageUrl === undefined
        });
        
        // Only process if there's actually a valid image URL (skip empty images)
        if (fullSizeImageUrl && fullSizeImageUrl.trim() !== '' && fullSizeImageUrl !== 'about:blank') {
          console.log('✅ Adding valid image to FancyBox:', fullSizeImageUrl);
          
          // Set FancyBox data attribute for grouping
          linkElement.setAttribute('data-fancybox', groupAttribute);
          
          // Set href to the full-size image
          linkElement.setAttribute('href', fullSizeImageUrl);
          
          // Add any additional FancyBox attributes if needed
          linkElement.setAttribute('data-caption', img.getAttribute('alt') || '');
          
          // Remember the first image link for the opener
          if (lightboxImageValue === 'first') {
            firstImageLink = linkElement;
          }
          
          hasProcessedGroups = true;
        } else {
          console.log('❌ Skipping empty/invalid image:', {
            src: fullSizeImageUrl,
            reason: !fullSizeImageUrl ? 'src is falsy' : 
                   fullSizeImageUrl.trim() === '' ? 'src is empty string' :
                   fullSizeImageUrl === 'about:blank' ? 'src is about:blank' : 'unknown'
          });
        }
        // If image URL is empty, skip this item completely - don't add to FancyBox
      } else {
        console.log('⚠️ No img element found in lightbox link');
      }
    }
  });
  
  // Second pass: Process opener links
  const openerLinks = item.querySelectorAll('a[lightbox-image="open"], a[lightbox-image="opener"]');
  
  openerLinks.forEach((openerLink) => {
    // Skip hidden opener links
    const computedStyle = getComputedStyle(openerLink);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return;
    }
    
    // Check if opener is already configured to trigger FancyBox directly
    const triggerGroup = openerLink.getAttribute('data-fancybox-trigger');
    
    if (triggerGroup) {
      
      openerLink.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Trigger FancyBox for the group directly
        const galleryItems = document.querySelectorAll(`[data-fancybox="${triggerGroup}"]`);
        
        if (galleryItems.length > 0) {
          // Open FancyBox gallery starting from the first item
          galleryItems[0].click();
        } else if (firstImageLink) {
          // Fallback to clicking first image if no gallery items found
          firstImageLink.click();
        }
      });
      
      openerLink.style.cursor = 'pointer';
      hasProcessedGroups = true;
    } else if (firstImageLink) {
      
      // Original behavior: make the opener trigger the first image
      openerLink.addEventListener('click', (e) => {
        e.preventDefault();
        firstImageLink.click();
      });
      
      openerLink.style.cursor = 'pointer';
      hasProcessedGroups = true;
    }
  });
  
  // Mark as completed
  if (hasProcessedGroups) {
    updateProcessingState(item, 'lightbox', ProcessingState.COMPLETED);
  }
  
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
      
      // Always hide loading for this attempt
      hideLoadingIndicator();
      
      // On mobile, only do ONE additional re-initialization attempt instead of multiple
      if (isMobileDevice && retryAttempt === 0 && needsFancyBoxReInit) {
        setTimeout(() => {
          performFancyBoxReInit(1);
        }, MOBILE_REINIT_DELAYS[0]);
      }
      
      needsFancyBoxReInit = false;
      return true;
    } else {
      hideLoadingIndicator();
    }
  } catch (e) {
    hideLoadingIndicator();
  }
  
  // Only retry once on mobile if the first attempt failed
  if (isMobileDevice && retryAttempt === 0) {
    setTimeout(() => {
      performFancyBoxReInit(1);
    }, MOBILE_REINIT_DELAYS[0]);
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
    processTabsForNewItems();
    processReportersForNewItems();
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
          processReportersForNewItems();
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
  // First check processing state
  const processingState = item.getAttribute('data-processing-state');
  if (processingState === ProcessingState.COMPLETED) {
    return;
  }
  
  // Check if item has lightbox groups or lazy elements that need processing
  const hasLightboxGroup = item.hasAttribute('wfu-lightbox-group');
  const lazyElements = item.querySelectorAll('.lazy');
  
  if (!hasLightboxGroup && lazyElements.length === 0) {
    updateProcessingState(item, 'lazy', ProcessingState.COMPLETED);
    return;
  }
  
  if (itemProcessingObserver && !processedItems.has(item)) {
    itemProcessingObserver.observe(item);
  }
}

function processItemsLazily(items) {
  if (!items?.length) return;
  
  showLoadingIndicator();
  
  const processInChunks = (itemsToProcess, chunkSize = PROCESSING_CHUNK_SIZE) => {
    if (itemsToProcess.length === 0) {
      updateLazyLoad();
      // Schedule FancyBox re-init if needed
      if (needsFancyBoxReInit) {
        scheduleFancyBoxReInit();
      }
      hideLoadingIndicator();
      return;
    }
    
    const chunk = itemsToProcess.splice(0, chunkSize);
    
    chunk.forEach(item => {
      try {
        // Update lazy processing state
        updateProcessingState(item, 'lazy', ProcessingState.PROCESSING);
        
        // Process FancyBox groups
        const processed = processFancyBoxGroups(item);
        if (processed) {
          needsFancyBoxReInit = true;
        }
        
        // Mark lazy as complete
        updateProcessingState(item, 'lazy', ProcessingState.COMPLETED);
        
      } catch (error) {
        // Silently handle error
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
  const loadMoreItems = document.querySelectorAll('[wfu-lightbox-group]');
  const newItems = [];
  
  loadMoreItems.forEach((item) => {
    // Check processing state first
    const processingState = item.getAttribute('data-processing-state');
    const alreadyProcessed = processingState === ProcessingState.COMPLETED || processedItems.has(item);
    
    // Check if item actually has FancyBox attributes (real processing check)
    const hasDataFancybox = item.querySelector('[data-fancybox]');
    const hasConfigured = item.querySelector('[data-fancybox-configured="true"]');
    const needsProcessing = !hasDataFancybox && !hasConfigured && !alreadyProcessed;
    
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
  
  items.forEach((item) => {
    try {
      // Update processing state
      updateProcessingState(item, 'lazy', ProcessingState.PROCESSING);
      
      // Process FancyBox groups
      const processed = processFancyBoxGroups(item);
      if (processed) {
        needsFancyBoxReInit = true;
      }
      
      // Mark as complete
      updateProcessingState(item, 'lazy', ProcessingState.COMPLETED);
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
  // Reset state attributes for filtered items
  const stateItems = document.querySelectorAll('[data-processing-state]');
  stateItems.forEach(item => {
    // Reset states to allow re-processing after filtering
    item.setAttribute('data-tabs-state', ProcessingState.PENDING);
    item.setAttribute('data-reporters-state', ProcessingState.PENDING);
  });
  
  // Clear processed tabs and reporters to re-initialize them after filtering
  processedTabItems = new WeakSet();
  processedReporterItems = new WeakSet();
  
  const filteredItems = document.querySelectorAll('[wfu-lightbox-group]');
  const visibleItems = [];
  const itemsToQueue = [];
  
  filteredItems.forEach(item => {
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
  
  // Process visible items immediately
  if (visibleItems.length > 0) {
    processItemsLazily(visibleItems);
    // Note: processItemsLazily handles its own loading indicator
  }
  
  // Queue non-visible items (desktop only)
  if (!isMobileDevice) {
    itemsToQueue.forEach(item => {
      queueItemForLazyProcessing(item);
    });
  }
  
  // Force re-process tabs and reporters for all visible filtered items
  setTimeout(() => {
    reprocessTabsForFilteredItems();
    reprocessReportersForFilteredItems();
  }, 200);
}

function processInitialVisibleItems() {
  const initialItems = document.querySelectorAll('[wfu-lightbox-group]');
  // Debug: Initial page load found items
  const visibleItems = [];
  const itemsToQueue = [];
  
  initialItems.forEach(item => {
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

// SHARE BUTTON FUNCTIONALITY
let shareButtonTimeouts = new Map(); // Track timeouts for each button

document.addEventListener('click', async function(e) {
  const shareButton = e.target.closest('[share-button]');
  if (shareButton) {
    e.preventDefault();
    const outsideLink = shareButton.getAttribute('outside-link');
    const slug = shareButton.getAttribute('share-button');
    
    let url;
    if (outsideLink && outsideLink.trim() !== '') {
      url = outsideLink;
    } else if (slug) {
      url = window.location.origin + '/report/' + slug;
    }
    
    if (url) {
      // Try native share first (for mobile devices)
      if (navigator.share) {
        try {
          await navigator.share({
            url: url
          });
          return; // Successfully shared, exit
        } catch (err) {
          // User cancelled or share failed, fall through to clipboard
        }
      }
      
      // Fallback to clipboard copy (for desktop or if share fails)
      navigator.clipboard.writeText(url).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      });
      
      // Update button text to show "Copied Link"
      const shareText = shareButton.querySelector('.share-text');
      if (shareText) {
        const originalText = shareText.textContent;
        shareText.textContent = 'Copied Link';
        
        // Clear any existing timeout for this button
        if (shareButtonTimeouts.has(shareButton)) {
          clearTimeout(shareButtonTimeouts.get(shareButton));
        }
        
        // Set new timeout to restore original text
        const timeoutId = setTimeout(() => {
          shareText.textContent = originalText;
          shareButtonTimeouts.delete(shareButton);
        }, 2000);
        
        shareButtonTimeouts.set(shareButton, timeoutId);
      }
    }
  }
});

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
    let pendingReporterItems = new Set();
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
        
        // Process reporter items
        if (pendingReporterItems.size > 0) {
          const itemsToProcess = Array.from(pendingReporterItems);
          pendingReporterItems.clear();
          
          itemsToProcess.forEach(item => {
            if (!processedReporterItems.has(item)) {
              initializeReporters(item);
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
      let hasNewReporters = false;
      
      for (const mutation of mutations) {
        if (mutation.type !== 'childList' || !mutation.addedNodes.length) continue;
        
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          
          // Check for new lightbox group items
          if (node.hasAttribute?.('wfu-lightbox-group')) {
            pendingLightboxItems.add(node);
            hasNewItems = true;
            
            // Also check for reporters in this item
            const hasReporters = node.querySelector('[reporters-wrap="true"]');
            if (hasReporters) {
              pendingReporterItems.add(node);
              hasNewReporters = true;
            }
          } else if (node.querySelector) {
            const lightboxItems = node.querySelectorAll('[wfu-lightbox-group]');
            for (const item of lightboxItems) {
              pendingLightboxItems.add(item);
              hasNewItems = true;
              
              // Also check for reporters in these items
              const hasReporters = item.querySelector('[reporters-wrap="true"]');
              if (hasReporters) {
                pendingReporterItems.add(item);
                hasNewReporters = true;
              }
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
      
      if (hasNewItems || hasNewTabs || hasNewReporters) {
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
      
      processInitialVisibleItems();
      processTabsForNewItems(); // Process tabs on initial load
      processReportersForNewItems(); // Process reporters on initial load
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
