// 🚀 ITEM PAGE - Simplified FancyBox 6 + Tabs + Multi-Reporter v3.0
// 
// ✅ FEATURES:
// • FancyBox 6 grouping for ALL images on item page
// • Integrates LazyLoad for images  
// • Supports CMS lightbox grouping with [wfu-lightbox-group] attributes
// • Parent-scoped tab system with data-tab and data-tab-content attributes
// • Multi-reporter display with modal functionality
// • Enhanced share button functionality with native mobile share API
//
// ⚡ SIMPLIFIED FOR SINGLE PAGES:
// • Removed auto-loading and filtering complexity
// • Simplified state management
// • Direct DOM manipulation without complex caching
// • Single initialization pass
// • Mobile-optimized but simplified

// Simple state management
let lazyLoadInstance = null;
let processedTabs = new Set();
let processedReporters = new Set();

// Configuration
const INIT_DELAY = 500;
const MOBILE_INIT_DELAY = 800;

// Simple device detection
const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// TAB SYSTEM
function initializeTabs(container) {
  // Prevent double processing
  if (processedTabs.has(container)) return;
  processedTabs.add(container);
  
  const tabs = container.querySelectorAll('[data-tab]');
  const tabContents = container.querySelectorAll('[data-tab-content]');
  
  if (tabs.length === 0 || tabContents.length === 0) return;
  
  // Hide all tab contents by default
  tabContents.forEach(content => {
    content.style.display = 'none';
    content.classList.remove('active-tab-content');
  });
  
  // Remove active class from all tabs
  tabs.forEach(tab => {
    tab.classList.remove('active-tab');
    
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      
      const tabIndex = this.getAttribute('data-tab');
      const isCurrentlyActive = this.classList.contains('active-tab');
      
      if (isCurrentlyActive) {
        // Close active tab
        this.classList.remove('active-tab');
        tabContents.forEach(content => {
          if (content.getAttribute('data-tab-content') === tabIndex) {
            content.style.display = 'none';
            content.classList.remove('active-tab-content');
          }
        });
      } else {
        // Switch to clicked tab
        tabs.forEach(t => t.classList.remove('active-tab'));
        this.classList.add('active-tab');
        
        tabContents.forEach(content => {
          const contentIndex = content.getAttribute('data-tab-content');
          if (contentIndex === tabIndex) {
            content.style.display = 'block';
            content.classList.add('active-tab-content');
            
            // Update LazyLoad for newly shown content
            if (lazyLoadInstance) {
              setTimeout(() => lazyLoadInstance.update(), 100);
            }
          } else {
            content.style.display = 'none';
            content.classList.remove('active-tab-content');
          }
        });
      }
    });
  });
}

// MULTI-REPORTER SYSTEM
function initializeReporters(container) {
  // Prevent double processing
  if (processedReporters.has(container)) return;
  processedReporters.add(container);
  
  const reportersWrap = container.querySelector('[reporters-wrap="true"]');
  if (!reportersWrap) return;
  
  const multiReporterWrap = reportersWrap.querySelector('[multi-reporter-wrap="true"]');
  const reporterListWrap = reportersWrap.querySelector('[reporter-list-wrap="true"]');
  const reporterItems = reportersWrap.querySelectorAll('[reporter-list-item="true"]');
  
  if (!multiReporterWrap || !reporterListWrap || reporterItems.length === 0) return;
  
  const reporterCount = reporterItems.length;
  
  // Single reporter - show regular list
  if (reporterCount === 1) {
    multiReporterWrap.style.display = 'none';
    reporterListWrap.style.display = 'flex';
    return;
  }
  
  // Multiple reporters - set up modal system
  multiReporterWrap.style.display = 'flex';
  reporterListWrap.style.display = 'none';
  
  // Get reporter data
  const reporters = Array.from(reporterItems).map(item => ({
    name: item.querySelector('.multi-reporter-name')?.textContent || '',
    imageSrc: item.querySelector('[reporter-image="true"]')?.src || ''
  }));
  
  // Set up reporter images
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
  
  // Modal functionality
  multiReporterWrap.addEventListener('click', function(e) {
    e.preventDefault();
    
    const modalPreWrap = reportersWrap.querySelector('.modal-pre-wrap');
    const modalElements = reportersWrap.querySelector('[modal-elements="true"]');
    
    if (reporterListWrap) {
      reporterListWrap.classList.add('modal-click');
      reporterListWrap.style.display = 'flex';
    }
    if (modalPreWrap) modalPreWrap.classList.add('modal-click');
    if (modalElements) modalElements.classList.add('modal-click');
  });
  
  // Close modal functionality
  const closeModal = () => {
    const modalPreWrap = reportersWrap.querySelector('.modal-pre-wrap');
    const modalElements = reportersWrap.querySelector('[modal-elements="true"]');
    
    if (reporterListWrap) {
      reporterListWrap.classList.remove('modal-click');
      reporterListWrap.style.display = 'none';
    }
    if (modalPreWrap) modalPreWrap.classList.remove('modal-click');
    if (modalElements) modalElements.classList.remove('modal-click');
  };
  
  // Close on background click
  if (reporterListWrap) {
    reporterListWrap.addEventListener('click', function(e) {
      if (e.target === this) {
        e.preventDefault();
        closeModal();
      }
    });
  }
  
  // Close button
  const closeBtn = reportersWrap.querySelector('[modal-close-btn="true"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      closeModal();
    });
  }
  
  // Update LazyLoad
  if (lazyLoadInstance) {
    setTimeout(() => lazyLoadInstance.update(), 100);
  }
}

// FANCYBOX PROCESSING
function processFancyBoxGroups() {
  const itemsWithGroups = document.querySelectorAll('[wfu-lightbox-group]');
  let needsFancyBoxInit = false;
  
  itemsWithGroups.forEach(item => {
    const groupName = item.getAttribute('wfu-lightbox-group');
    if (!groupName) return;
    
    let firstImageLink = null;
    
    // Process lightbox images
    const lightboxLinks = item.querySelectorAll('a[lightbox-image]');
    
    lightboxLinks.forEach(linkElement => {
      const lightboxValue = linkElement.getAttribute('lightbox-image');
      
      // Skip hidden links
      if (getComputedStyle(linkElement).display === 'none') return;
      
      // Process gallery images
      if (lightboxValue === 'true' || lightboxValue === 'first') {
        const img = linkElement.querySelector('img');
        if (img) {
          const imageUrl = img.getAttribute('src');
          
          // Skip empty images
          if (imageUrl && imageUrl.trim() !== '' && imageUrl !== 'about:blank') {
            linkElement.setAttribute('data-fancybox', groupName);
            linkElement.setAttribute('href', imageUrl);
            linkElement.setAttribute('data-caption', img.getAttribute('alt') || '');
            linkElement.setAttribute('data-thumb', imageUrl);
            
            if (lightboxValue === 'first') {
              firstImageLink = linkElement;
            }
            
            needsFancyBoxInit = true;
          }
        }
      }
    });
    
    // Process opener links
    const openerLinks = item.querySelectorAll('a[lightbox-image="open"], a[lightbox-image="opener"]');
    
    openerLinks.forEach(openerLink => {
      if (getComputedStyle(openerLink).display === 'none') return;
      
      const triggerGroup = openerLink.getAttribute('data-fancybox-trigger');
      
      if (triggerGroup === groupName) {
        // Direct trigger group match - use event delegation
        openerLink.setAttribute('data-opener-setup', 'true');
        openerLink.style.cursor = 'pointer';
        needsFancyBoxInit = true;
      } else if (firstImageLink) {
        // Fallback to first image
        openerLink.addEventListener('click', function(e) {
          e.preventDefault();
          firstImageLink.click();
        });
        openerLink.style.cursor = 'pointer';
        needsFancyBoxInit = true;
      }
    });
  });
  
  return needsFancyBoxInit;
}

// FANCYBOX INITIALIZATION
function initializeFancyBox() {
  if (!window.Fancybox) return false;
  
  const hasThumbsPlugin = !!window.Fancybox.Thumbs;
  
  const config = {
    touch: {
      vertical: true,
      momentum: true
    },
    preload: 1,
    Toolbar: {
      display: {
        left: ['infobar'],
        middle: [],
        right: hasThumbsPlugin ? ['slideshow', 'thumbs', 'close'] : ['slideshow', 'close']
      }
    }
  };
  
  if (hasThumbsPlugin) {
    config.Thumbs = {
      autoStart: true,
      axis: 'x',
      showOnStart: true
    };
  }
  
  Fancybox.bind('[data-fancybox]', config);
  return true;
}

// OPENER EVENT DELEGATION
function initOpenerEventDelegation() {
  document.addEventListener('click', function(e) {
    const openerLink = e.target.closest('a[data-opener-setup="true"]');
    if (!openerLink) return;
    
    e.preventDefault();
    
    const triggerGroup = openerLink.getAttribute('data-fancybox-trigger');
    if (!triggerGroup) return;
    
    const galleryItems = document.querySelectorAll(`[data-fancybox="${triggerGroup}"]`);
    if (galleryItems.length > 0) {
      galleryItems[0].click();
    }
  });
}

// LAZYLOAD
function initLazyLoad() {
  if (typeof LazyLoad !== 'undefined') {
    lazyLoadInstance = new LazyLoad({
      elements_selector: '.lazy',
      threshold: 100
    });
  }
}

// SHARE BUTTON
let shareButtonTimeouts = new Map();

document.addEventListener('click', async function(e) {
  const shareButton = e.target.closest('[share-button]');
  if (!shareButton) return;
  
  e.preventDefault();
  
  const outsideLink = shareButton.getAttribute('outside-link');
  const slug = shareButton.getAttribute('share-button');
  
  let url;
  if (outsideLink && outsideLink.trim() !== '') {
    url = outsideLink;
  } else if (slug) {
    url = window.location.origin + '/report/' + slug;
  }
  
  if (!url) return;
  
  // Try native share first (mobile)
  if (navigator.share) {
    try {
      await navigator.share({ url: url });
      return;
    } catch (err) {
      // Fall through to clipboard
    }
  }
  
  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(url);
  } catch (err) {
    // Legacy fallback
    const textArea = document.createElement('textarea');
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
  
  // Show feedback
  const shareText = shareButton.querySelector('.share-text');
  if (shareText) {
    const originalText = shareText.textContent;
    shareText.textContent = 'Copied Link';
    
    // Clear existing timeout
    if (shareButtonTimeouts.has(shareButton)) {
      clearTimeout(shareButtonTimeouts.get(shareButton));
    }
    
    // Restore original text
    const timeoutId = setTimeout(() => {
      shareText.textContent = originalText;
      shareButtonTimeouts.delete(shareButton);
    }, 2000);
    
    shareButtonTimeouts.set(shareButton, timeoutId);
  }
});

// MAIN INITIALIZATION
function initializeItemPage() {
  // Initialize LazyLoad
  initLazyLoad();
  
  // Initialize event delegation
  initOpenerEventDelegation();
  
  // Process FancyBox groups
  const needsFancyBox = processFancyBoxGroups();
  if (needsFancyBox) {
    initializeFancyBox();
  }
  
  // Process tabs - check multiple container types
  const tabContainers = [
    ...document.querySelectorAll('.cms-page-wrap'),
    ...document.querySelectorAll('.cms-item, [data-item-slug], .w-dyn-item'),
    ...document.querySelectorAll('[wfu-lightbox-group]')
  ];
  
  // Remove duplicates and process
  const uniqueContainers = [...new Set(tabContainers)];
  uniqueContainers.forEach(container => {
    if (container.querySelector('[data-tab]')) {
      initializeTabs(container);
    }
  });
  
  // Process reporters
  const reporterContainers = [
    ...document.querySelectorAll('[wfu-lightbox-group]'),
    ...document.querySelectorAll('.cms-page-wrap'),
    document.body
  ];
  
  reporterContainers.forEach(container => {
    if (container && container.querySelector('[reporters-wrap="true"]')) {
      initializeReporters(container);
    }
  });
  
  // Update LazyLoad
  if (lazyLoadInstance) {
    lazyLoadInstance.update();
  }
}

// STARTUP
document.addEventListener('DOMContentLoaded', function() {
  const initWhenReady = () => {
    if (typeof Fancybox === 'undefined') {
      setTimeout(initWhenReady, 100);
      return;
    }
    
    const delay = isMobile ? MOBILE_INIT_DELAY : INIT_DELAY;
    
    setTimeout(() => {
      initializeItemPage();
    }, delay);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      shareButtonTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
      shareButtonTimeouts.clear();
    });
  };
  
  initWhenReady();
});
