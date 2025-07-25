// 🚀 SIMPLIFIED Webflow Component Fix v4.0 - Mobile Optimized
// 
// ✅ FEATURES:
// • ONE global dummy tab for the entire site
// • Event delegation (no individual listeners)
// • Basic tab fixing with minimal attributes
// • Simple toggle functionality
// • Lazy processing for performance
// • Mobile-friendly and lightweight
//
// ⚡ SIMPLIFICATIONS:
// • Single dummy tab shared by all items
// • Event delegation instead of individual listeners
// • Minimal DOM manipulation
// • No complex state tracking
// • Removed heavy WFU processing
// • Simplified ID generation

console.log('🚀 Simplified Webflow Component Fix Loading...');

// Global variables
let lazyLoadInstance = null;
let itemProcessingObserver = null;
let processedItems = new WeakSet();
let globalDummyTab = null;
let itemCounter = 0; // Simple counter for IDs

// Debounce function (simplified)
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Create ONE global dummy tab for the entire site
function createGlobalDummyTab() {
  if (globalDummyTab) return; // Already exists
  
  // Create hidden dummy tab
  globalDummyTab = document.createElement('div');
  globalDummyTab.id = 'global-dummy-tab';
  globalDummyTab.className = 'w-tab-link';
  globalDummyTab.setAttribute('data-w-tab', 'GlobalDummy');
  globalDummyTab.style.cssText = 'display:none!important;position:absolute!important;left:-9999px!important;';
  
  // Create hidden dummy pane
  const globalDummyPane = document.createElement('div');
  globalDummyPane.id = 'global-dummy-pane';
  globalDummyPane.className = 'w-tab-pane';
  globalDummyPane.setAttribute('data-w-pane', 'GlobalDummy');
  globalDummyPane.style.cssText = 'display:none!important;position:absolute!important;left:-9999px!important;';
  
  // Add to page (append to body)
  document.body.appendChild(globalDummyTab);
  document.body.appendChild(globalDummyPane);
  
  console.log('🎯 Global dummy tab created');
}

// Simple tab system fixing (minimal attributes only)
function fixTabSystemSimple(item) {
  const tabContainers = item.querySelectorAll('.w-tabs');
  
  tabContainers.forEach((container, containerIndex) => {
    const tabs = container.querySelectorAll('[data-w-tab]');
    const panes = container.querySelectorAll('[data-w-pane]');
    
    if (tabs.length === 0) return;
    
    tabs.forEach((tab, index) => {
      // Skip if already fixed
      if (tab.id && tab.id.startsWith('tab-')) return;
      
      const tabName = tab.getAttribute('data-w-tab');
      const tabId = `tab-${++itemCounter}`;
      const paneId = `pane-${itemCounter}`;
      
      // Set minimal required attributes
      tab.id = tabId;
      tab.href = `#${paneId}`;
      tab.setAttribute('role', 'tab');
      tab.classList.remove('w--current');
      
      // Find matching pane
      const matchingPane = Array.from(panes).find(pane => 
        pane.getAttribute('data-w-pane') === tabName
      );
      
      if (matchingPane && !matchingPane.id) {
        matchingPane.id = paneId;
        matchingPane.setAttribute('role', 'tabpanel');
        matchingPane.classList.remove('w--tab-active');
      }
    });
  });
}

// Simple lightbox fixing (minimal only)
function fixLightboxSimple(item) {
  const lightboxes = item.querySelectorAll('.w-lightbox');
  const itemSlug = item.getAttribute('itemslug');
  
  lightboxes.forEach(lightbox => {
    // Add basic ARIA
    if (!lightbox.hasAttribute('aria-label')) {
      lightbox.setAttribute('aria-label', 'open lightbox');
    }
    
    // Fix JSON group name
    const jsonScript = lightbox.querySelector('script.w-json');
    if (jsonScript && itemSlug) {
      try {
        const config = JSON.parse(jsonScript.textContent);
        if (config.group === 'EventImages' || !config.group) {
          config.group = itemSlug;
          jsonScript.textContent = JSON.stringify(config);
        }
      } catch (e) {
        // Ignore JSON errors
      }
    }
  });
  
  // Re-initialize Webflow lightbox
  setTimeout(() => {
    if (window.Webflow?.require) {
      try {
        const lightboxModule = window.Webflow.require('lightbox');
        lightboxModule?.init?.();
      } catch (e) {
        // Ignore errors
      }
    }
  }, 100);
}

// LazyLoad integration (simplified)
function initLazyLoad() {
  if (typeof LazyLoad !== 'undefined') {
    lazyLoadInstance = new LazyLoad({
      elements_selector: '.lazy',
      threshold: 100
    });
    console.log('✅ LazyLoad initialized');
  }
}

function updateLazyLoad() {
  lazyLoadInstance?.update?.();
}

// Simplified lazy processing
function initLazyProcessing() {
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
      processItemsSimple(itemsToProcess);
    }
  }, {
    rootMargin: '300px 0px 300px 0px', // Larger margin for mobile
    threshold: 0.1
  });
}

function processItemsSimple(items) {
  if (!items?.length) return;
  
  // Process in small chunks for smooth performance
  const processChunk = (itemsToProcess) => {
    if (itemsToProcess.length === 0) {
      updateLazyLoad();
      return;
    }
    
    const chunk = itemsToProcess.splice(0, 1); // One item at a time
    
    chunk.forEach(item => {
      try {
        fixTabSystemSimple(item);
        fixLightboxSimple(item);
        
        // Mark as processed for toggle functionality
        item.setAttribute('data-tabs-fixed', 'true');
        
      } catch (error) {
        console.error('Processing error:', error);
      }
    });
    
    // Continue with next chunk
    if (itemsToProcess.length > 0) {
      requestAnimationFrame(() => processChunk(itemsToProcess));
    } else {
      updateLazyLoad();
    }
  };
  
  processChunk([...items]);
}

// Global event delegation for all tab clicks
function initEventDelegation() {
  document.addEventListener('click', (e) => {
    const clickedElement = e.target.closest('.w-tab-link');
    
    // Ignore if not a tab or is the global dummy tab
    if (!clickedElement || clickedElement === globalDummyTab) return;
    
    // Find the item container
    const item = clickedElement.closest('[itemslug]');
    if (!item || !item.hasAttribute('data-tabs-fixed')) return;
    
    const isActive = clickedElement.classList.contains('w--current');
    
    if (isActive) {
      // Clicking active tab - close it using global dummy tab
      e.preventDefault();
      e.stopPropagation();
      
      // Close all tabs in this item
      const allTabs = item.querySelectorAll('.w-tab-link');
      const allPanes = item.querySelectorAll('.w-tab-pane');
      
      allTabs.forEach(tab => tab.classList.remove('w--current'));
      allPanes.forEach(pane => pane.classList.remove('w--tab-active'));
      
      // Click global dummy tab to reset Webflow state
      if (globalDummyTab) {
        setTimeout(() => globalDummyTab.click(), 10);
      }
      
      console.log('🔄 Tab closed using global dummy');
    }
    // For non-active tabs, let Webflow handle normally
  }, { passive: false });
  
  console.log('✅ Global event delegation initialized');
}

// Queue items for lazy processing
function queueItemForProcessing(item) {
  const tabs = item.querySelectorAll('[data-w-tab]');
  if (tabs.length === 0 || processedItems.has(item)) return;
  
  if (itemProcessingObserver) {
    itemProcessingObserver.observe(item);
  }
}

// Process initial visible items
function processInitialItems() {
  const allItems = document.querySelectorAll('[itemslug]');
  const visibleItems = [];
  const itemsToQueue = [];
  
  allItems.forEach(item => {
    const rect = item.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight + 200; // Extra buffer
    
    if (isVisible) {
      visibleItems.push(item);
      processedItems.add(item);
    } else {
      itemsToQueue.push(item);
    }
  });
  
  // Process visible items immediately
  if (visibleItems.length > 0) {
    processItemsSimple(visibleItems);
  }
  
  // Queue others for lazy processing
  itemsToQueue.forEach(item => queueItemForProcessing(item));
  
  console.log(`👁️ Processed ${visibleItems.length} visible items, queued ${itemsToQueue.length} for lazy loading`);
}

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Initializing simplified Webflow fix...');
  
  // Initialize components
  initLazyLoad();
  initLazyProcessing();
  createGlobalDummyTab();
  initEventDelegation();
  
  // Set up new item detection
  let pendingItems = new Set();
  let queueTimeout = null;
  
  const scheduleQueuing = debounce(() => {
    if (pendingItems.size > 0) {
      const items = Array.from(pendingItems);
      pendingItems.clear();
      
      items.forEach(item => queueItemForProcessing(item));
      console.log(`📋 Queued ${items.length} new items`);
    }
  }, 100);
  
  // Lightweight mutation observer
  const observer = new MutationObserver((mutations) => {
    let hasNewItems = false;
    
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        
        if (node.hasAttribute?.('itemslug')) {
          pendingItems.add(node);
          hasNewItems = true;
        } else if (node.querySelector) {
          const childItems = node.querySelectorAll('[itemslug]');
          childItems.forEach(item => {
            pendingItems.add(item);
            hasNewItems = true;
          });
        }
      }
    }
    
    if (hasNewItems) {
      scheduleQueuing();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Process initial items
  setTimeout(processInitialItems, 300);
  
  // Cleanup
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    itemProcessingObserver?.disconnect();
  });
});

// Debug functions (simplified)
if (window.location.search.includes('debug=tabs')) {
  console.log('🐛 Debug mode enabled');
  
  window.debugTabs = function() {
    const items = document.querySelectorAll('[itemslug]');
    const processedCount = Array.from(items).filter(item => processedItems.has(item)).length;
    const fixedCount = Array.from(items).filter(item => item.hasAttribute('data-tabs-fixed')).length;
    
    console.log('🔍 SIMPLIFIED DEBUG:');
    console.log(`   Total items: ${items.length}`);
    console.log(`   Processed: ${processedCount}`);
    console.log(`   Fixed: ${fixedCount}`);
    console.log(`   Global dummy tab: ${globalDummyTab ? 'Created' : 'Missing'}`);
    console.log(`   LazyLoad: ${lazyLoadInstance ? 'Active' : 'Missing'}`);
  };
  
  window.testGlobalDummy = function() {
    if (globalDummyTab) {
      console.log('🎯 Testing global dummy tab...');
      globalDummyTab.click();
      console.log('✅ Global dummy tab clicked');
    } else {
      console.log('❌ Global dummy tab not found');
    }
  };
  
  console.log('💡 Commands: debugTabs(), testGlobalDummy()');
}

console.log('✅ Simplified Webflow Component Fix Ready!');
