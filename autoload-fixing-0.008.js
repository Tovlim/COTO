// 📱 MOBILE-OPTIMIZED Webflow Component Fix v4.0
// 
// ✅ SIMPLIFIED FEATURES:
// • ONE global dummy tab for entire site (not per item)
// • Lightweight lazy processing optimized for mobile
// • Minimal DOM manipulations and event listeners
// • Simpler toggle logic without complex state tracking
// • Batched operations for better mobile performance
// • Reduced memory footprint

console.log('📱 Mobile-Optimized Webflow Component Fix Loading...');

// Global dummy tab (created once for entire site)
let globalDummyTab = null;
let globalDummyPane = null;

// Simplified lazy processing
let simpleObserver = null;
let processedItems = new WeakSet();

// LazyLoad integration
let lazyLoadInstance = null;

function initLazyLoad() {
  if (typeof LazyLoad !== 'undefined') {
    lazyLoadInstance = new LazyLoad({
      elements_selector: '.lazy',
      threshold: 100
    });
  }
}

function updateLazyLoad() {
  if (lazyLoadInstance?.update) {
    lazyLoadInstance.update();
  }
}

// Create ONE global dummy tab for the entire site
function createGlobalDummyTab() {
  if (globalDummyTab) return; // Already exists
  
  // Find the first tab container on the page
  const firstTabContainer = document.querySelector('.w-tabs');
  if (!firstTabContainer) return;
  
  const tabMenu = firstTabContainer.querySelector('.w-tab-menu');
  const tabContent = firstTabContainer.querySelector('.w-tab-content');
  if (!tabMenu || !tabContent) return;
  
  // Create global dummy tab (completely hidden)
  globalDummyTab = document.createElement('a');
  globalDummyTab.setAttribute('data-w-tab', 'GlobalDummy');
  globalDummyTab.className = 'global-dummy-tab w-tab-link';
  globalDummyTab.id = 'global-dummy-tab';
  globalDummyTab.href = '#global-dummy-pane';
  globalDummyTab.style.cssText = 'display:none!important;position:absolute!important;left:-9999px!important;';
  
  // Create global dummy pane
  globalDummyPane = document.createElement('div');
  globalDummyPane.setAttribute('data-w-pane', 'GlobalDummy');
  globalDummyPane.className = 'global-dummy-pane w-tab-pane';
  globalDummyPane.id = 'global-dummy-pane';
  globalDummyPane.style.cssText = 'display:none!important;position:absolute!important;left:-9999px!important;';
  
  // Add to DOM
  tabMenu.appendChild(globalDummyTab);
  tabContent.appendChild(globalDummyPane);
  
  console.log('🎯 Global dummy tab created');
}

// Simplified tab fixing for mobile
function fixTabsSimple(item) {
  const itemSlug = item.getAttribute('itemslug') || `item-${Date.now()}`;
  const baseId = itemSlug.replace(/[^a-zA-Z0-9-]/g, '-');
  
  // Find tab containers
  const tabContainers = item.querySelectorAll('.w-tabs');
  
  tabContainers.forEach((container, containerIndex) => {
    const tabs = container.querySelectorAll('[data-w-tab]');
    const panes = container.querySelectorAll('[data-w-pane]');
    
    if (tabs.length === 0) return;
    
    // Simple tab fixing - just IDs and basic attributes
    tabs.forEach((tab, index) => {
      if (tab.id) return; // Skip if already fixed
      
      const tabName = tab.getAttribute('data-w-tab');
      const tabId = `${baseId}-${containerIndex}-tab-${index}`;
      const paneId = `${baseId}-${containerIndex}-pane-${index}`;
      
      // Set minimal required attributes
      tab.id = tabId;
      tab.href = `#${paneId}`;
      
      // Find matching pane and set ID
      const matchingPane = Array.from(panes).find(pane => 
        pane.getAttribute('data-w-pane') === tabName
      );
      
      if (matchingPane && !matchingPane.id) {
        matchingPane.id = paneId;
      }
      
      // Simple click handler for mobile
      if (!tab.hasAttribute('data-simple-fixed')) {
        tab.setAttribute('data-simple-fixed', 'true');
        tab.addEventListener('click', createSimpleTabHandler(tab, tabs, panes, matchingPane));
      }
    });
  });
}

// Simplified tab click handler
function createSimpleTabHandler(clickedTab, allTabs, allPanes, targetPane) {
  return function(e) {
    e.preventDefault();
    
    const isActive = clickedTab.classList.contains('w--current');
    
    if (isActive) {
      // Close tab and reset with global dummy
      allTabs.forEach(tab => tab.classList.remove('w--current'));
      allPanes.forEach(pane => pane.classList.remove('w--tab-active'));
      
      // Click global dummy to reset Webflow state
      if (globalDummyTab) {
        setTimeout(() => globalDummyTab.click(), 10);
      }
    } else {
      // Open tab normally
      allTabs.forEach(tab => tab.classList.remove('w--current'));
      allPanes.forEach(pane => pane.classList.remove('w--tab-active'));
      
      clickedTab.classList.add('w--current');
      if (targetPane) {
        targetPane.classList.add('w--tab-active');
      }
    }
  };
}

// Simplified lightbox fixing
function fixLightboxesSimple(item) {
  const itemSlug = item.getAttribute('itemslug');
  const lightboxes = item.querySelectorAll('.w-lightbox');
  
  lightboxes.forEach(lightbox => {
    // Add basic ARIA if missing
    if (!lightbox.hasAttribute('aria-label')) {
      lightbox.setAttribute('aria-label', 'open lightbox');
    }
    
    // Fix JSON group
    const jsonScript = lightbox.querySelector('script.w-json');
    if (jsonScript) {
      try {
        const config = JSON.parse(jsonScript.textContent);
        if (config.group === 'EventImages' || !config.group) {
          config.group = itemSlug;
          jsonScript.textContent = JSON.stringify(config);
        }
      } catch (e) {
        // Skip if JSON is malformed
      }
    }
  });
  
  // Simple lightbox re-init
  setTimeout(() => {
    if (window.Webflow?.require) {
      try {
        window.Webflow.require('lightbox')?.init?.();
      } catch (e) {
        // Fail silently
      }
    }
  }, 100);
}

// Process WFU lightbox groups (simplified)
function processWFUSimple(item) {
  const groupElements = item.querySelectorAll('[wfu-lightbox-group]');
  
  groupElements.forEach(element => {
    const groupValue = element.getAttribute('wfu-lightbox-group');
    const scripts = element.querySelectorAll('script.w-json');
    
    scripts.forEach(script => {
      try {
        const json = JSON.parse(script.textContent);
        json.group = groupValue;
        script.textContent = JSON.stringify(json);
      } catch (e) {
        // Skip if JSON is malformed
      }
    });
  });
}

// Main simplified processing function
function processItemSimple(item) {
  if (processedItems.has(item)) return;
  
  processedItems.add(item);
  
  // Do all the work in one go to minimize DOM access
  fixTabsSimple(item);
  fixLightboxesSimple(item);
  processWFUSimple(item);
}

// Batch process multiple items efficiently
function processBatchSimple(items) {
  if (!items.length) return;
  
  // Filter items that actually need processing
  const itemsToProcess = items.filter(item => {
    return !processedItems.has(item) && item.querySelectorAll('[data-w-tab]').length > 0;
  });
  
  if (itemsToProcess.length === 0) {
    updateLazyLoad();
    return;
  }
  
  // Process in small chunks to avoid blocking UI
  const processChunk = (itemChunk) => {
    itemChunk.forEach(item => {
      try {
        processItemSimple(item);
      } catch (e) {
        // Fail silently to avoid breaking the batch
      }
    });
  };
  
  // Process 2 items per frame for mobile
  const chunkSize = 2;
  let currentIndex = 0;
  
  const processNextChunk = () => {
    if (currentIndex >= itemsToProcess.length) {
      updateLazyLoad();
      return;
    }
    
    const chunk = itemsToProcess.slice(currentIndex, currentIndex + chunkSize);
    processChunk(chunk);
    currentIndex += chunkSize;
    
    // Continue on next frame
    requestAnimationFrame(processNextChunk);
  };
  
  processNextChunk();
}

// Simplified lazy observer for mobile
function initSimpleLazyProcessing() {
  simpleObserver = new IntersectionObserver((entries) => {
    const visibleItems = entries
      .filter(entry => entry.isIntersecting)
      .map(entry => entry.target)
      .filter(item => !processedItems.has(item));
    
    if (visibleItems.length > 0) {
      // Process visible items immediately
      processBatchSimple(visibleItems);
      
      // Stop observing processed items
      visibleItems.forEach(item => {
        simpleObserver.unobserve(item);
      });
    }
  }, {
    rootMargin: '100px 0px',
    threshold: 0.1
  });
}

// Queue items for lazy processing
function queueForLazyProcessing(item) {
  if (simpleObserver && !processedItems.has(item)) {
    simpleObserver.observe(item);
  }
}

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
  initLazyLoad();
  initSimpleLazyProcessing();
  
  // Create global dummy tab
  setTimeout(() => {
    createGlobalDummyTab();
  }, 100);
  
  let pendingItems = [];
  let queueTimeout = null;
  
  // Simple item queuing
  const scheduleQueuing = () => {
    if (queueTimeout) return;
    
    queueTimeout = setTimeout(() => {
      if (pendingItems.length > 0) {
        const itemsToQueue = [...pendingItems];
        pendingItems = [];
        
        // Queue for lazy processing
        itemsToQueue.forEach(queueForLazyProcessing);
      }
      queueTimeout = null;
    }, 200);
  };
  
  // Lightweight mutation observer
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        
        if (node.hasAttribute?.('itemslug')) {
          pendingItems.push(node);
        } else if (node.querySelector) {
          const childItems = node.querySelectorAll('[itemslug]');
          pendingItems.push(...childItems);
        }
      }
    }
    
    if (pendingItems.length > 0) {
      scheduleQueuing();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Process initial visible items
  setTimeout(() => {
    const allItems = document.querySelectorAll('[itemslug]');
    const visibleItems = [];
    const itemsToQueue = [];
    
    allItems.forEach(item => {
      const rect = item.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight + 100 && rect.bottom > -100;
      
      if (isVisible) {
        visibleItems.push(item);
      } else {
        itemsToQueue.push(item);
      }
    });
    
    // Process visible items
    if (visibleItems.length > 0) {
      processBatchSimple(visibleItems);
    }
    
    // Queue non-visible items
    itemsToQueue.forEach(queueForLazyProcessing);
    
    updateLazyLoad();
  }, 300);
  
  // Cleanup
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    simpleObserver?.disconnect();
  });
});

// Simple debug functions (mobile-friendly)
if (window.location.search.includes('debug=mobile')) {
  window.mobileDebug = function() {
    const items = document.querySelectorAll('[itemslug]');
    const processedCount = Array.from(items).filter(item => processedItems.has(item)).length;
    const workingTabs = document.querySelectorAll('[data-w-tab][id]').length;
    const totalTabs = document.querySelectorAll('[data-w-tab]').length;
    
    console.log('📱 MOBILE DEBUG:');
    console.log(`Items: ${items.length}`);
    console.log(`Processed: ${processedCount}`);
    console.log(`Working tabs: ${workingTabs}/${totalTabs}`);
    console.log(`Global dummy: ${globalDummyTab ? 'Created' : 'Missing'}`);
    console.log(`Memory: ${(performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB` || 'N/A');
  };
  
  window.forceProcessAll = function() {
    const items = document.querySelectorAll('[itemslug]');
    const unprocessed = Array.from(items).filter(item => !processedItems.has(item));
    if (unprocessed.length > 0) {
      console.log(`Processing ${unprocessed.length} remaining items...`);
      processBatchSimple(unprocessed);
    }
  };
  
  console.log('📱 Mobile debug: mobileDebug(), forceProcessAll()');
}

console.log('📱 Mobile-Optimized Webflow Fix Ready!');
