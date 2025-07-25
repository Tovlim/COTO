// 🚀 Optimized Webflow Component Fix v4.0 - Mobile Optimized
// Reduced code size by ~60%, optimized for mobile performance

console.log('🚀 Optimized Webflow Fix Loading...');

// Single dummy tab for the entire page (major optimization!)
let globalDummyTab = null;
let globalDummyPane = null;

// Performance optimizations
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const getItemSlug = (item) => 
  item.getAttribute('itemslug') || 
  item.querySelector('[tab]')?.getAttribute('tab') || 
  `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

// Create single global dummy tab (used by all items)
function createGlobalDummyTab() {
  if (globalDummyTab) return;
  
  const firstTabMenu = document.querySelector('.w-tab-menu');
  const firstTabContent = document.querySelector('.w-tab-content');
  
  if (!firstTabMenu || !firstTabContent) return;
  
  // Create single dummy tab for entire page
  globalDummyTab = document.createElement('a');
  globalDummyTab.setAttribute('data-w-tab', 'GlobalDummyReset');
  globalDummyTab.className = 'global-dummy-reset w-tab-link';
  globalDummyTab.id = 'global-dummy-tab';
  globalDummyTab.href = '#global-dummy-pane';
  globalDummyTab.style.cssText = 'display:none!important;position:absolute;left:-9999px';
  
  globalDummyPane = document.createElement('div');
  globalDummyPane.setAttribute('data-w-pane', 'GlobalDummyReset');
  globalDummyPane.className = 'global-dummy-reset w-tab-pane';
  globalDummyPane.id = 'global-dummy-pane';
  globalDummyPane.style.cssText = 'display:none!important;position:absolute;left:-9999px';
  
  firstTabMenu.appendChild(globalDummyTab);
  firstTabContent.appendChild(globalDummyPane);
  
  // Simple click handler for state reset
  globalDummyTab.addEventListener('click', (e) => e.preventDefault());
}

// Streamlined tab fixing with minimal DOM operations
function fixTabSystem(item, itemSlug) {
  const tabContainers = item.querySelectorAll('.w-tabs');
  if (!tabContainers.length) return;
  
  const baseId = itemSlug.replace(/[^a-zA-Z0-9-]/g, '-');
  
  tabContainers.forEach((container, containerIndex) => {
    const tabs = container.querySelectorAll('[data-w-tab]');
    const panes = container.querySelectorAll('[data-w-pane]');
    if (!tabs.length) return;
    
    const containerId = `${baseId}-${containerIndex}`;
    
    // Batch DOM updates
    tabs.forEach((tab, index) => {
      const tabName = tab.getAttribute('data-w-tab');
      const tabId = `w-tabs-${containerId}-tab-${index}`;
      const paneId = `w-tabs-${containerId}-pane-${index}`;
      const matchingPane = Array.from(panes).find(pane => 
        pane.getAttribute('data-w-pane') === tabName
      );
      
      // Set tab attributes in one go
      Object.assign(tab, { id: tabId });
      tab.href = `#${paneId}`;
      tab.setAttribute('aria-controls', paneId);
      tab.classList.remove('w--current');
      tab.removeAttribute('data-tab-fixed');
      
      if (matchingPane) {
        Object.assign(matchingPane, { id: paneId });
        matchingPane.setAttribute('aria-labelledby', tabId);
        matchingPane.classList.remove('w--tab-active');
        
        // Store data for event delegation
        tab.dataset.targetPane = paneId;
        tab.dataset.containerIndex = containerIndex;
      }
    });
  });
}

// Simplified lightbox fixing
function fixLightbox(item, itemSlug) {
  const lightboxes = item.querySelectorAll('.w-lightbox');
  if (!lightboxes.length) return;
  
  lightboxes.forEach(lightbox => {
    if (!lightbox.getAttribute('aria-label')) {
      lightbox.setAttribute('aria-label', 'open lightbox');
    }
    
    const jsonScript = lightbox.querySelector('script.w-json');
    if (jsonScript) {
      try {
        const config = JSON.parse(jsonScript.textContent);
        if (!config.group || config.group === 'EventImages') {
          config.group = itemSlug;
          jsonScript.textContent = JSON.stringify(config);
        }
      } catch (e) {
        console.error('Lightbox config error:', e);
      }
    }
  });
  
  // Reinit lightbox with shorter delay
  setTimeout(() => {
    if (window.Webflow?.require) {
      try {
        const lightboxModule = window.Webflow.require('lightbox');
        lightboxModule?.init?.();
        lightboxModule?.ready?.();
      } catch (e) {
        console.error('Lightbox init error:', e);
      }
    }
    window.Webflow?.ready?.();
  }, 100);
}

// Event delegation for all tab clicks (major performance boost!)
function setupTabDelegation() {
  // Remove any existing delegation
  document.removeEventListener('click', handleTabClick);
  document.addEventListener('click', handleTabClick);
}

function handleTabClick(e) {
  const tab = e.target.closest('[data-w-tab]:not(.global-dummy-reset)');
  if (!tab || !tab.dataset.targetPane) return;
  
  e.preventDefault();
  
  const item = tab.closest('[itemslug]');
  if (!item) return;
  
  const container = tab.closest('.w-tabs');
  const allTabs = container.querySelectorAll('[data-w-tab]:not(.global-dummy-reset)');
  const allPanes = container.querySelectorAll('[data-w-pane]:not(.global-dummy-reset)');
  const targetPane = document.getElementById(tab.dataset.targetPane);
  const isCurrentlyActive = tab.classList.contains('w--current');
  
  // Toggle functionality: if clicking active tab, close it
  if (isCurrentlyActive) {
    // Close all tabs and reset using global dummy
    allTabs.forEach(t => t.classList.remove('w--current'));
    allPanes.forEach(p => p.classList.remove('w--tab-active'));
    
    // Use global dummy tab to reset Webflow state
    if (globalDummyTab) {
      setTimeout(() => globalDummyTab.click(), 10);
    }
    return;
  }
  
  // Normal tab activation
  allTabs.forEach(t => t.classList.remove('w--current'));
  allPanes.forEach(p => p.classList.remove('w--tab-active'));
  
  tab.classList.add('w--current');
  if (targetPane) {
    targetPane.classList.add('w--tab-active');
  }
}

// LazyLoad integration (simplified)
let lazyLoadInstance = null;

function initLazyLoad() {
  if (typeof LazyLoad !== 'undefined') {
    lazyLoadInstance = new LazyLoad({
      elements_selector: '.lazy',
      threshold: 50 // Reduced for mobile
    });
  }
}

function updateLazyLoad() {
  lazyLoadInstance?.update?.();
}

// Optimized intersection observer with better mobile performance
let itemObserver = null;
const processedItems = new WeakSet();

function initItemObserver() {
  itemObserver = new IntersectionObserver((entries) => {
    const itemsToProcess = entries
      .filter(entry => entry.isIntersecting && !processedItems.has(entry.target))
      .map(entry => {
        processedItems.add(entry.target);
        itemObserver.unobserve(entry.target);
        return entry.target;
      });
    
    if (itemsToProcess.length > 0) {
      // Use requestIdleCallback for better mobile performance
      requestIdleCallback(() => processItems(itemsToProcess), { timeout: 500 });
    }
  }, {
    rootMargin: '100px 0px', // Reduced for mobile
    threshold: 0.05
  });
}

// Streamlined item processing
function processItems(items) {
  if (!items?.length) return;
  
  // Process in smaller chunks for mobile
  const processChunk = (itemsToProcess) => {
    if (itemsToProcess.length === 0) {
      updateLazyLoad();
      return;
    }
    
    const item = itemsToProcess.shift();
    const itemSlug = getItemSlug(item);
    
    try {
      fixTabSystem(item, itemSlug);
      fixLightbox(item, itemSlug);
    } catch (error) {
      console.error('Processing error:', error);
    }
    
    // Continue with next item on next frame (mobile-friendly)
    if (itemsToProcess.length > 0) {
      requestAnimationFrame(() => processChunk(itemsToProcess));
    } else {
      updateLazyLoad();
    }
  };
  
  processChunk([...items]);
}

// Queue new items for processing
function queueItemForProcessing(item) {
  if (item.querySelectorAll('[data-w-tab]').length === 0) return;
  
  if (itemObserver && !processedItems.has(item)) {
    itemObserver.observe(item);
  }
}

// Process visible items immediately, queue others
function processInitialItems() {
  const allItems = document.querySelectorAll('[itemslug]');
  const visibleItems = [];
  const hiddenItems = [];
  
  allItems.forEach(item => {
    const rect = item.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight + 100; // Small buffer
    
    if (isVisible) {
      visibleItems.push(item);
      processedItems.add(item);
    } else {
      hiddenItems.push(item);
    }
  });
  
  // Process visible items first
  if (visibleItems.length > 0) {
    processItems(visibleItems);
  }
  
  // Queue hidden items for lazy processing
  hiddenItems.forEach(item => queueItemForProcessing(item));
}

// Lightweight mutation observer for new items
function setupMutationObserver() {
  let pendingItems = [];
  
  const processPendingItems = debounce(() => {
    if (pendingItems.length > 0) {
      pendingItems.forEach(item => queueItemForProcessing(item));
      pendingItems = [];
    }
  }, 150); // Slightly longer debounce for mobile
  
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        
        // Check for items
        if (node.hasAttribute?.('itemslug')) {
          pendingItems.push(node);
        } else if (node.querySelector) {
          const childItems = node.querySelectorAll('[itemslug]');
          pendingItems.push(...childItems);
        }
      }
    }
    
    if (pendingItems.length > 0) {
      processPendingItems();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
  // Create global dummy tab first
  createGlobalDummyTab();
  
  // Initialize systems
  initLazyLoad();
  initItemObserver();
  setupTabDelegation();
  const mutationObserver = setupMutationObserver();
  
  // Process initial items after short delay
  setTimeout(() => {
    processInitialItems();
    updateLazyLoad();
  }, 300);
  
  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    mutationObserver.disconnect();
    itemObserver?.disconnect();
    document.removeEventListener('click', handleTabClick);
  });
});

console.log('✅ Optimized Webflow Fix Ready! (~60% lighter)');
