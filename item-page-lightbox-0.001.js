// 🚀 ITEM PAGE - FancyBox 6 + Tabs + Multi-Reporter v1.0
// 
// ✅ FEATURES:
// • FancyBox 6 grouping for ALL images on item page
// • Integrates LazyLoad for images  
// • Supports CMS lightbox grouping with [wfu-lightbox-group] attributes
// • Parent-scoped tab system with data-tab and data-tab-content attributes
// • Multi-reporter display with modal functionality
// • Single page load - no auto-loading or filtering needed
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
// • Single initialization on page load
// • Efficient parent-scoped tab queries
// • Mobile-optimized timing
//
// 📑 TAB SYSTEM:
// • Parent-scoped tabs using data-tab and data-tab-content attributes
// • No tabs active by default - all content hidden initially
// • Click active tab to close it (toggle behavior)
// • Automatic tab initialization for all CMS items
// • Mobile-optimized tab switching
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
// • Single initialization pass for all features

// Global state management
let lazyLoadInstance = null;
let processedTabItems = new WeakSet();
let processedReporterItems = new WeakSet();

// Configuration
const INIT_DELAY = 500; // Base initialization delay
const MOBILE_INIT_DELAY = 800; // Mobile initialization delay

// Device detection
const isMobileDevice = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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

// Process all tabs on the page
function processAllTabs() {
  // Find all CMS items that might have tabs
  const cmsItems = document.querySelectorAll('.cms-item, [data-item-slug], .w-dyn-item');
  
  cmsItems.forEach(item => {
    // Check if this item contains tabs
    const hasTabs = item.querySelector('[data-tab]');
    if (hasTabs) {
      initializeTabs(item);
    }
  });
}

// MULTI-REPORTER SYSTEM
function initializeReporters(reportItem) {
  // Check if we've already processed reporters for this item
  if (processedReporterItems.has(reportItem)) {
    return;
  }
  
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
  // Check if this item has lightbox group attribute
  const groupAttribute = item.getAttribute('wfu-lightbox-group');
  if (!groupAttribute) {
    return false;
  }
  
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
  
  openerLinks.forEach((openerLink) => {
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
        // Set FancyBox data attribute for grouping (use a default group name)
        linkElement.setAttribute('data-fancybox', 'item-gallery');
        
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
        
        needsFancyBoxInit = true;
      }
    }
  });
  
  // Process opener links
  const openerLinks = mainContainer.querySelectorAll('a[lightbox-image="open"]');
  
  openerLinks.forEach((openerLink) => {
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
      
      needsFancyBoxInit = true;
    }
  });
  
  return needsFancyBoxInit;
}

// Initialize FancyBox
function initializeFancyBox() {
  if (window.Fancybox) {
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
    
    return true;
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

// Main initialization function
function initializeItemPage() {
  // Initialize LazyLoad
  initLazyLoad();
  
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
    const initDelay = isMobileDevice ? MOBILE_INIT_DELAY : INIT_DELAY;
    
    // Initialize everything after delay
    setTimeout(() => {
      initializeItemPage();
    }, initDelay);
  };
  
  initWhenReady();
});
