// 🚀 ITEM PAGE - Enhanced FancyBox 6 + Tabs + Multi-Reporter v2.0
// 
// ✅ FEATURES:
// • FancyBox 6 grouping for ALL images on item page
// • Integrates LazyLoad for images  
// • Supports CMS lightbox grouping with [wfu-lightbox-group] attributes
// • Parent-scoped tab system with data-tab and data-tab-content attributes
// • Multi-reporter display with modal functionality
// • Single page load - no auto-loading or filtering needed
// • Enhanced share button functionality with native mobile share API
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
// • Cached DOM selectors for improved performance
// • Enhanced state tracking using data attributes
// • Efficient parent-scoped tab queries
// • Mobile-optimized timing and retry logic
// • Enhanced FancyBox initialization with mobile reliability
//
// 📑 TAB SYSTEM:
// • Parent-scoped tabs using data-tab and data-tab-content attributes
// • No tabs active by default - all content hidden initially
// • Click active tab to close it (toggle behavior)
// • Automatic tab initialization for all CMS items
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
// 📱 MOBILE OPTIMIZATIONS:
// • Enhanced timing for mobile browsers
// • Multiple FancyBox re-initialization attempts
// • Aggressive retry logic for stubborn lightboxes
// • Single initialization pass for all features

// Global state management
let lazyLoadInstance = null;
let processedTabItems = new WeakSet();
let processedReporterItems = new WeakSet();
let needsFancyBoxReInit = false;
let reInitTimeout = null;

// Enhanced state tracking using data attributes
const ProcessingState = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed'
};

// Configuration
const INIT_DELAY = 500; // Base initialization delay
const MOBILE_INIT_DELAY = 800; // Mobile initialization delay
const REINIT_DEBOUNCE_DELAY = 200; // Base delay before re-initializing FancyBox
const MOBILE_REINIT_DELAYS = [300, 600, 1200]; // Mobile retry delays

// Device detection (cached for performance)
let isMobileDevice = null;
function getIsMobileDevice() {
  if (isMobileDevice === null) {
    isMobileDevice = typeof isMobile !== 'undefined' ? isMobile : (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  }
  return isMobileDevice;
}

// Cached DOM selectors for performance
const DOMCache = {
  mainContainer: null,
  
  // Lazy getters
  get container() {
    if (!this.mainContainer) {
      this.mainContainer = document.querySelector('.cms-page-wrap') || document.body;
    }
    return this.mainContainer;
  },
  
  // Clear cache when DOM changes significantly
  clearCache() {
    this.mainContainer = null;
  }
};

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

// Process all tabs on the page
function processAllTabs() {
  // For item pages, look for tabs directly or within specific containers
  const containers = [];
  
  // Check main containers
  const mainContainer = document.querySelector('.cms-page-wrap');
  if (mainContainer) {
    containers.push(mainContainer);
  }
  
  // Also check for any CMS items that might have tabs
  const cmsItems = document.querySelectorAll('.cms-item, [data-item-slug], .w-dyn-item');
  cmsItems.forEach(item => containers.push(item));
  
  // If no specific containers found, use document body
  if (containers.length === 0) {
    containers.push(document.body);
  }
  
  containers.forEach(container => {
    // Check if this container has tabs
    const hasTabs = container.querySelector('[data-tab]');
    if (hasTabs && !processedTabItems.has(container)) {
      initializeTabs(container);
    }
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

// Process all reporters on the page
function processAllReporters() {
  // For item pages, look for reporters-wrap directly
  const reportersWraps = document.querySelectorAll('[reporters-wrap="true"]');
  
  reportersWraps.forEach(reportersWrap => {
    // Find the parent container (could be the cms-page-wrap or report-content-wrap)
    const reportItem = reportersWrap.closest('.cms-page-wrap') || reportersWrap.closest('.report-content-wrap') || reportersWrap.parentElement;
    if (reportItem && !processedReporterItems.has(reportItem)) {
      initializeReporters(reportItem);
    }
  });
}

// FancyBox 6 grouping system based on attributes
function processFancyBoxGroups(item) {
  // First check if already configured
  const alreadyConfigured = item.querySelector('[data-fancybox-configured="true"]');
  if (alreadyConfigured) {
    // Clean up any empty FancyBox images from previous configurations
    const existingFancyboxItems = item.querySelectorAll('[data-fancybox]');
    
    existingFancyboxItems.forEach(fancyboxLink => {
      const img = fancyboxLink.querySelector('img');
      if (img) {
        const srcValue = img.getAttribute('src');
        
        // Remove FancyBox attributes from empty images
        if (!srcValue || srcValue.trim() === '' || srcValue === 'about:blank') {
          fancyboxLink.removeAttribute('data-fancybox');
          fancyboxLink.removeAttribute('data-caption');
          fancyboxLink.removeAttribute('data-thumb');
        }
      }
    });
    
    // Mark opener links as ready (event delegation handles clicks)
    const openerLinks = item.querySelectorAll('a[lightbox-image="open"], a[lightbox-image="opener"]');
    if (openerLinks.length > 0) {
      openerLinks.forEach((openerLink) => {
        const triggerGroup = openerLink.getAttribute('data-fancybox-trigger');
        if (triggerGroup && !openerLink.hasAttribute('data-opener-setup')) {
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
    
    // Skip links that are hidden
    const computedStyle = getComputedStyle(linkElement);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return; // Skip this hidden link
    }
    
    // Process links with lightbox-image="true" or lightbox-image="first"
    if (lightboxImageValue === 'true' || lightboxImageValue === 'first') {
      const img = linkElement.querySelector('img');
      if (img) {
        // Get the full-size image URL
        const fullSizeImageUrl = img.getAttribute('src');
        const hrefValue = linkElement.getAttribute('href');
        
        // Only process if there's actually a valid image URL (skip empty images)
        if (fullSizeImageUrl && fullSizeImageUrl.trim() !== '' && fullSizeImageUrl !== 'about:blank') {
          // Set FancyBox data attribute for grouping
          linkElement.setAttribute('data-fancybox', groupAttribute);
          
          // Set href to the full-size image
          linkElement.setAttribute('href', fullSizeImageUrl);
          
          // Add any additional FancyBox attributes if needed
          linkElement.setAttribute('data-caption', img.getAttribute('alt') || '');
          
          // Set thumbnail for FancyBox gallery view
          linkElement.setAttribute('data-thumb', fullSizeImageUrl);
          
          // Remember the first image link for the opener
          if (lightboxImageValue === 'first') {
            firstImageLink = linkElement;
          }
          
          hasProcessedGroups = true;
        }
        // If image URL is empty, skip this item completely - don't add to FancyBox
      }
    }
  });
  
  // Second pass: Mark opener links as ready (event delegation handles clicks)
  const openerLinks = item.querySelectorAll('a[lightbox-image="open"], a[lightbox-image="opener"]');
  
  openerLinks.forEach((openerLink) => {
    // Skip hidden opener links
    const computedStyle = getComputedStyle(openerLink);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return;
    }
    
    const triggerGroup = openerLink.getAttribute('data-fancybox-trigger');
    
    if (triggerGroup || firstImageLink) {
      // Check if we already set up this opener
      if (!openerLink.hasAttribute('data-opener-setup')) {
        // Store fallback info for event delegation
        if (!triggerGroup && firstImageLink) {
          openerLink.setAttribute('data-fallback-click', 'true');
        }
        
        openerLink.setAttribute('data-opener-setup', 'true');
        openerLink.style.cursor = 'pointer';
        hasProcessedGroups = true;
      }
    }
  });
  
  // Mark as completed
  if (hasProcessedGroups) {
    updateProcessingState(item, 'lightbox', ProcessingState.COMPLETED);
  }
  
  return hasProcessedGroups;
}

// Process all FancyBox groups on the page
function processAllFancyBoxGroups() {
  // For item pages, process the entire document as one group
  const mainContainer = document.querySelector('.cms-page-wrap') || document.body;
  
  // Check if we have lightbox images
  const lightboxImages = mainContainer.querySelectorAll('a[lightbox-image]');
  if (lightboxImages.length === 0) {
    return false;
  }
  
  // Process as a single group
  let needsFancyBoxInit = false;
  let firstImageLink = null;
  
  // Process all lightbox images
  lightboxImages.forEach((linkElement) => {
    const lightboxImageValue = linkElement.getAttribute('lightbox-image');
    
    // Skip links that are hidden
    const computedStyle = getComputedStyle(linkElement);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return;
    }
    
    // Process links with lightbox-image="true" or lightbox-image="first"
    if (lightboxImageValue === 'true' || lightboxImageValue === 'first') {
      const img = linkElement.querySelector('img');
      if (img) {
        // Get the full-size image URL
        const fullSizeImageUrl = img.getAttribute('src');
        const hrefValue = linkElement.getAttribute('href');
        
        // Only process if there's actually a valid image URL (skip empty images)
        if (fullSizeImageUrl && fullSizeImageUrl.trim() !== '' && fullSizeImageUrl !== 'about:blank') {
          // Set FancyBox data attribute for grouping (use a default group name)
          linkElement.setAttribute('data-fancybox', 'item-gallery');
          
          // Set href to the full-size image
          linkElement.setAttribute('href', fullSizeImageUrl);
          
          // Add any additional FancyBox attributes if needed
          linkElement.setAttribute('data-caption', img.getAttribute('alt') || '');
          
          // Set thumbnail for FancyBox gallery view
          linkElement.setAttribute('data-thumb', fullSizeImageUrl);
          
          // Remember the first image link for the opener
          if (lightboxImageValue === 'first') {
            firstImageLink = linkElement;
          }
          
          needsFancyBoxInit = true;
        }
        // If image URL is empty, skip this item completely - don't add to FancyBox
      }
    }
  });
  
  // Process opener links
  const openerLinks = mainContainer.querySelectorAll('a[lightbox-image="open"], a[lightbox-image="opener"]');
  
  openerLinks.forEach((openerLink) => {
    // Skip hidden opener links
    const computedStyle = getComputedStyle(openerLink);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return;
    }
    
    const triggerGroup = openerLink.getAttribute('data-fancybox-trigger');
    
    if (triggerGroup || firstImageLink) {
      // Check if we already set up this opener
      if (!openerLink.hasAttribute('data-opener-setup')) {
        // Store fallback info for event delegation
        if (!triggerGroup && firstImageLink) {
          openerLink.setAttribute('data-fallback-click', 'true');
        }
        
        openerLink.setAttribute('data-opener-setup', 'true');
        openerLink.style.cursor = 'pointer';
        needsFancyBoxInit = true;
      }
    }
  });
  
  return needsFancyBoxInit;
}

// Enhanced FancyBox re-initialization with mobile-aggressive retry logic
function scheduleFancyBoxReInit() {
  if (reInitTimeout) {
    clearTimeout(reInitTimeout);
  }
  
  const baseDelay = getIsMobileDevice() ? REINIT_DEBOUNCE_DELAY * 1.5 : REINIT_DEBOUNCE_DELAY;
  
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
          needsFancyBoxReInit = false;
          return true;
        }
      }
      
      const hasThumbsPlugin = !!window.Fancybox?.Thumbs;
      
      // Build config based on available plugins
      const bindConfig = {
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
            right: hasThumbsPlugin ? ['slideshow', 'thumbs', 'close'] : ['slideshow', 'close']
          }
        }
      };
      
      // Only add Thumbs config if plugin is loaded
      if (hasThumbsPlugin) {
        bindConfig.Thumbs = {
          autoStart: true,
          axis: 'x',
          showOnStart: true
        };
      }
      
      // FancyBox 6 initialization
      Fancybox.bind('[data-fancybox]', bindConfig);
      
      // Mark elements as bound to prevent unnecessary re-binding
      existingFancyboxElements.forEach(el => {
        el.setAttribute('data-fancybox-bound', 'true');
      });
      
      // On mobile, only do ONE additional re-initialization attempt instead of multiple
      if (getIsMobileDevice() && retryAttempt === 0 && needsFancyBoxReInit) {
        setTimeout(() => {
          performFancyBoxReInit(1);
        }, MOBILE_REINIT_DELAYS[0]);
      }
      
      needsFancyBoxReInit = false;
      return true;
    }
  } catch (e) {
    // Handle error silently
  }
  
  // Only retry once on mobile if the first attempt failed
  if (getIsMobileDevice() && retryAttempt === 0) {
    setTimeout(() => {
      performFancyBoxReInit(1);
    }, MOBILE_REINIT_DELAYS[0]);
  }
  
  return false;
}

// Initialize FancyBox
function initializeFancyBox() {
  needsFancyBoxReInit = true;
  return performFancyBoxReInit();
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

// Event delegation for opener links (performance optimization)
function initOpenerEventDelegation() {
  document.addEventListener('click', function(e) {
    const openerLink = e.target.closest('a[lightbox-image="open"], a[lightbox-image="opener"]');
    if (!openerLink) return;
    
    e.preventDefault();
    
    const triggerGroup = openerLink.getAttribute('data-fancybox-trigger');
    const hasFallback = openerLink.hasAttribute('data-fallback-click');
    
    if (triggerGroup) {
      const tryTrigger = (attempt = 0) => {
        const galleryItems = document.querySelectorAll(`[data-fancybox="${triggerGroup}"]`);
        
        if (galleryItems.length > 0) {
          // Method 1: Try to programmatically click the first gallery item
          const firstGalleryItem = galleryItems[0];
          if (firstGalleryItem) {
            firstGalleryItem.click();
            return;
          }
          
          // Method 2: Fallback to Fancybox.show() if direct click doesn't work
          if (window.Fancybox && typeof Fancybox.show === 'function') {
            // Build gallery items array from DOM elements
            const fancyboxItems = Array.from(galleryItems).map(item => {
              const img = item.querySelector('img');
              const thumbUrl = item.getAttribute('data-thumb') || (img ? img.getAttribute('src') : '') || item.getAttribute('href');
              
              return {
                src: item.getAttribute('href'),
                caption: item.getAttribute('data-caption') || (img ? img.getAttribute('alt') : '') || '',
                thumb: thumbUrl,
                type: 'image'
              };
            });
            
            // Use the same configuration as the bound version
            Fancybox.show(fancyboxItems, {
              startIndex: 0,
              Thumbs: {
                autoStart: true,
                axis: 'x',
                showOnStart: true
              },
              touch: {
                vertical: true,
                momentum: true
              },
              preload: 1,
              Toolbar: {
                display: {
                  left: ['infobar'],
                  middle: [],
                  right: ['slideshow', 'thumbs', 'close']
                }
              }
            });
          }
        } else if (attempt < 2) {
          // Retry after a short delay in case FancyBox hasn't finished initializing
          setTimeout(() => tryTrigger(attempt + 1), (attempt + 1) * 100);
        }
      };
      
      tryTrigger();
    } else if (hasFallback) {
      // Fallback: find first image link in the same container
      const container = openerLink.closest('[wfu-lightbox-group]');
      if (container) {
        const firstImageLink = container.querySelector('a[lightbox-image="first"]');
        if (firstImageLink) {
          firstImageLink.click();
        }
      }
    }
  }, { passive: false });
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

// Main initialization function
function initializeItemPage() {
  // Initialize LazyLoad
  initLazyLoad();
  
  // Initialize event delegation
  initOpenerEventDelegation();
  
  // Process all FancyBox groups
  const needsFancyBox = processAllFancyBoxGroups();
  
  // Initialize FancyBox if needed
  if (needsFancyBox) {
    initializeFancyBox();
  }
  
  // Process all tabs
  processAllTabs();
  
  // Process all reporters
  processAllReporters();
  
  // Update LazyLoad for all images
  updateLazyLoad();
}

// MAIN INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
  // Wait for FancyBox to be available
  const initWhenReady = () => {
    if (typeof Fancybox === 'undefined') {
      setTimeout(initWhenReady, 100);
      return;
    }
    
    // Use appropriate delay based on device
    const initDelay = getIsMobileDevice() ? MOBILE_INIT_DELAY : INIT_DELAY;
    
    // Initialize everything after delay
    setTimeout(() => {
      initializeItemPage();
    }, initDelay);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (reInitTimeout) clearTimeout(reInitTimeout);
      // Clear timeouts for share buttons
      shareButtonTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
      shareButtonTimeouts.clear();
    });
  };
  
  initWhenReady();
});
