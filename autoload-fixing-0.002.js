// 🚀 PERFORMANCE OPTIMIZED Webflow Component Fix v2.0
// 
// ✅ FEATURES:
// • Fixes broken tabs/lightboxes on auto-loaded CMS items
// • Integrates LazyLoad for images on new items  
// • Adds toggle functionality (click active tab to close/reopen)
// • Supports WFU lightbox grouping
// • Works with Finsweet list load v2 (2025)
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
// • Batched DOM operations (reduced reflows/repaints)
// • Smart caching and duplicate prevention
// • Optimized event handling with closures
// • Efficient mutation observation with Set collections
// • Memory leak prevention with cleanup handlers
// • Staggered processing for large batches
// • Reduced setTimeout calls and better timing coordination

console.log('🚀 Webflow Component Fix Loading...');

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

// Get item slug
function getItemSlug(item) {
  return item.getAttribute('itemslug') || 
         item.querySelector('[tab]')?.getAttribute('tab') || 
         `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

// Performance-optimized tab fixing with batched DOM operations
function fixTabSystemEnhanced(item, itemSlug) {
  const tabContainers = item.querySelectorAll('.w-tabs');
  
  if (window.location.search.includes('debug=tabs')) {
    console.log(`🔧 Fixing tabs for: ${itemSlug}`);
    console.log(`Found ${tabContainers.length} tab containers`);
  }
  
  // Batch DOM operations for better performance
  const updates = [];
  
  tabContainers.forEach((container, containerIndex) => {
    const containerTabs = container.querySelectorAll('[data-w-tab]');
    const containerPanes = container.querySelectorAll('[data-w-pane]');
    
    if (containerTabs.length === 0) return;
    
    const baseId = `w-tabs-${itemSlug.replace(/[^a-zA-Z0-9-]/g, '-')}-${containerIndex}`;
    
    if (window.location.search.includes('debug=tabs')) {
      console.log(`Container ${containerIndex}: ${containerTabs.length} tabs, ${containerPanes.length} panes`);
    }
    
    // Pre-calculate all updates to batch DOM operations
    containerTabs.forEach((tabLink, index) => {
      const tabName = tabLink.getAttribute('data-w-tab');
      const tabId = `${baseId}-data-w-tab-${index}`;
      const paneId = `${baseId}-data-w-pane-${index}`;
      
      // Find matching pane once
      const matchingPane = Array.from(containerPanes).find(pane => 
        pane.getAttribute('data-w-pane') === tabName
      );
      
      updates.push({
        tabLink,
        tabId,
        paneId,
        matchingPane,
        containerTabs,
        containerPanes,
        tabName,
        index,
        containerIndex
      });
    });
  });
  
  // Batch apply all DOM updates
  updates.forEach(({tabLink, tabId, paneId, matchingPane, containerTabs, containerPanes, tabName, index, containerIndex}) => {
    // Batch set all tab attributes at once
    tabLink.id = tabId;
    tabLink.href = `#${paneId}`;
    tabLink.setAttribute('role', 'tab');
    tabLink.setAttribute('aria-controls', paneId);
    tabLink.setAttribute('tabindex', '-1');
    tabLink.setAttribute('aria-selected', 'false');
    tabLink.classList.remove('w--current');
    tabLink.removeAttribute('data-tab-fixed');
    tabLink.setAttribute('data-tab-fixed', 'true');
    
    if (matchingPane) {
      // Batch set all pane attributes
      matchingPane.id = paneId;
      matchingPane.setAttribute('role', 'tabpanel');
      matchingPane.setAttribute('aria-labelledby', tabId);
      matchingPane.classList.remove('w--tab-active');
      
      // Create optimized click handler with closure
      const clickHandler = ((link, tabs, panes, pane) => (e) => {
        e.preventDefault();
        switchTabEnhanced(e.currentTarget, tabs, panes, pane);
      })(tabLink, containerTabs, containerPanes, matchingPane);
      
      // Store and add handler
      tabLink._originalClickHandler = clickHandler;
      tabLink.addEventListener('click', clickHandler);
    }
    
    if (window.location.search.includes('debug=tabs') && containerIndex === 0 && index < 2) {
      console.log(`Tab ${index} (${tabName}): → ${tabId}`);
    }
  });
  
  if (window.location.search.includes('debug=tabs')) {
    // Use more efficient counting
    const finalWorkingTabs = updates.filter(u => u.tabLink.id && u.tabLink.id.includes(itemSlug.replace(/[^a-zA-Z0-9-]/g, '-'))).length;
    console.log(`✅ Final result: ${finalWorkingTabs} tabs fixed for ${itemSlug}`);
  }
}

// BACK TO WORKING TAB SWITCHING
function switchTabEnhanced(clickedTab, allTabLinks, allTabPanes, targetPane) {
  allTabLinks.forEach(tab => {
    tab.classList.remove('w--current');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('tabindex', '-1');
  });
  
  allTabPanes.forEach(pane => {
    pane.classList.remove('w--tab-active');
  });
  
  clickedTab.classList.add('w--current');
  clickedTab.setAttribute('aria-selected', 'true');
  clickedTab.setAttribute('tabindex', '0');
  
  if (targetPane) {
    targetPane.classList.add('w--tab-active');
  }
}

// WORKING LIGHTBOX SYSTEM
function fixLightboxEnhanced(item, itemSlug) {
  const lightboxElements = item.querySelectorAll('.w-lightbox');
  
  lightboxElements.forEach((lightbox, index) => {
    if (!lightbox.hasAttribute('aria-label')) {
      lightbox.setAttribute('aria-label', 'open lightbox');
      lightbox.setAttribute('aria-haspopup', 'dialog');
    }
    
    const jsonScript = lightbox.querySelector('script.w-json');
    if (jsonScript) {
      try {
        const config = JSON.parse(jsonScript.textContent);
        if (config.group === 'EventImages' || !config.group) {
          config.group = itemSlug;
          jsonScript.textContent = JSON.stringify(config);
        }
      } catch (e) {
        console.error('Lightbox JSON error:', e);
      }
    }
  });
  
  setTimeout(() => {
    if (window.Webflow && window.Webflow.require) {
      try {
        const lightboxModule = window.Webflow.require('lightbox');
        if (lightboxModule) {
          if (lightboxModule.init) lightboxModule.init();
          if (lightboxModule.ready) lightboxModule.ready();
        }
      } catch (e) {
        console.error('Lightbox re-init error:', e);
      }
    }
    
    if (window.Webflow && window.Webflow.ready) {
      window.Webflow.ready();
    }
  }, 200);
}

// Simplified toggle that uses the existing working click handlers
function addToggleFunctionality(item) {
  if (item.hasAttribute('data-toggle-processed')) return;
  
  const tabMenu = item.querySelector('.w-tab-menu');
  if (!tabMenu) return;
  
  item.setAttribute('data-toggle-processed', 'true');
  
  let lastClosedTab = null;
  
  const closeAllTabs = () => {
    const tabs = tabMenu.querySelectorAll('.w-tab-link');
    const allPanes = item.querySelectorAll('.w-tab-pane');
    
    tabs.forEach(tab => {
      tab.classList.remove('w--current');
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');
    });
    
    allPanes.forEach(pane => {
      pane.classList.remove('w--tab-active');
    });
  };
  
  // Process each tab
  const tabs = tabMenu.querySelectorAll('.w-tab-link:not([data-toggle-enhanced])');
  tabs.forEach(tab => {
    tab.setAttribute('data-toggle-enhanced', 'true');
    
    // Create enhanced handler that intercepts clicks
    const enhancedHandler = (e) => {
      const currentTab = e.currentTarget;
      const isActive = currentTab.classList.contains('w--current');
      
      if (isActive) {
        // Clicking active tab - close it
        e.preventDefault();
        e.stopPropagation();
        lastClosedTab = currentTab;
        closeAllTabs();
        
        if (window.location.search.includes('debug=tabs')) {
          console.log(`🔻 Closed: ${currentTab.getAttribute('data-w-tab')}`);
        }
      } else if (currentTab === lastClosedTab) {
        // Clicking the same tab that was just closed - reopen by triggering original handler
        if (window.location.search.includes('debug=tabs')) {
          console.log(`🔄 Reopening: ${currentTab.getAttribute('data-w-tab')} (using original handler)`);
        }
        
        // Use the exact same logic that works for normal tabs
        const originalHandler = currentTab._originalClickHandler;
        if (originalHandler) {
          // Don't prevent default - let the original handler do its job
          originalHandler(e);
        } else {
          if (window.location.search.includes('debug=tabs')) {
            console.log(`⚠️ No original handler found for: ${currentTab.getAttribute('data-w-tab')}`);
          }
        }
        
        // Keep as lastClosedTab for repeated toggling
      } else {
        // Clicking a different tab - reset and let original handler work
        lastClosedTab = null;
        
        const originalHandler = currentTab._originalClickHandler;
        if (originalHandler) {
          originalHandler(e);
        }
        
        if (window.location.search.includes('debug=tabs')) {
          console.log(`🔀 Switched to: ${currentTab.getAttribute('data-w-tab')}`);
        }
      }
    };
    
    // Add the enhanced handler
    tab._enhancedClickHandler = enhancedHandler;
    tab.addEventListener('click', enhancedHandler);
  });
  
  if (window.location.search.includes('debug=tabs') && tabs.length > 0) {
    console.log(`✅ Toggle added to ${tabs.length} tabs in: ${item.getAttribute('itemslug')}`);
  }
}

// LazyLoad integration
let lazyLoadInstance = null;

function initLazyLoad() {
  if (typeof LazyLoad !== 'undefined') {
    lazyLoadInstance = new LazyLoad({
      elements_selector: '.lazy',
      threshold: 100,
      callback_loaded: el => {
        if (window.location.search.includes('debug=tabs')) {
          console.log('🖼️ Lazy loaded:', el);
        }
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

// Optimized processing with smart caching and validation
function processItems(items) {
  if (!items?.length) return;
  
  // Filter out items that don't need processing to avoid unnecessary work
  const itemsToProcess = items.filter(item => {
    const tabs = item.querySelectorAll('[data-w-tab]');
    return tabs.length > 0; // Only process items that actually have tabs
  });
  
  if (itemsToProcess.length === 0) {
    updateLazyLoad();
    return;
  }
  
  // Process items with optimized timing
  itemsToProcess.forEach((item, itemIndex) => {
    try {
      const itemSlug = getItemSlug(item);
      
      // Cache tab elements to avoid repeated queries
      const tabElements = item.querySelectorAll('[data-w-tab]');
      const slugPattern = itemSlug.replace(/[^a-zA-Z0-9-]/g, '-');
      
      // Step 1: Fix tabs and lightboxes immediately
      fixTabSystemEnhanced(item, itemSlug);
      fixLightboxEnhanced(item, itemSlug);
      
      // Step 2: Intelligent verification and toggle addition
      // Use a single timeout for all items in the batch for better performance
      setTimeout(() => {
        const workingTabs = Array.from(tabElements).filter(tab => 
          tab.id && tab.id.includes(slugPattern)
        ).length;
        
        if (workingTabs === tabElements.length) {
          // All tabs working - add toggle
          addToggleFunctionality(item);
          
          if (window.location.search.includes('debug=tabs')) {
            console.log(`✅ ${itemSlug}: Ready (${workingTabs}/${tabElements.length})`);
          }
        } else if (workingTabs < tabElements.length && workingTabs > 0) {
          // Partial fix - retry once
          if (window.location.search.includes('debug=tabs')) {
            console.log(`⚠️ ${itemSlug}: Partial (${workingTabs}/${tabElements.length}), retrying`);
          }
          
          setTimeout(() => {
            fixTabSystemEnhanced(item, itemSlug);
            setTimeout(() => addToggleFunctionality(item), 100);
          }, 200);
        }
      }, 50 + (itemIndex * 10)); // Stagger slightly for large batches
      
    } catch (error) {
      console.error('Item processing error:', error);
    }
  });
  
  // Single lazy load update for the entire batch
  setTimeout(updateLazyLoad, 100);
}

// Optimized observer with better batching and throttling
document.addEventListener('DOMContentLoaded', function() {
  initLazyLoad();
  
  let pendingItems = new Set(); // Use Set to avoid duplicates
  let processingTimeout = null;
  let isProcessing = false;
  
  // Optimized processing scheduler
  const scheduleProcessing = () => {
    if (processingTimeout) return; // Already scheduled
    
    processingTimeout = setTimeout(() => {
      if (isProcessing || pendingItems.size === 0) {
        processingTimeout = null;
        return;
      }
      
      isProcessing = true;
      const itemsToProcess = Array.from(pendingItems);
      pendingItems.clear();
      
      if (window.location.search.includes('debug=tabs')) {
        console.log(`📦 Processing batch of ${itemsToProcess.length} items`);
      }
      
      processItems(itemsToProcess);
      
      // Reset processing flag after completion
      setTimeout(() => {
        isProcessing = false;
        processingTimeout = null;
        
        // Check if more items were added while processing
        if (pendingItems.size > 0) {
          scheduleProcessing();
        }
      }, 50);
    }, 200); // Optimized debounce time
  };
  
  // Optimized mutation observer
  const observer = new MutationObserver((mutations) => {
    let hasNewItems = false;
    
    // Batch process all mutations
    for (const mutation of mutations) {
      if (mutation.type !== 'childList' || !mutation.addedNodes.length) continue;
      
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        
        // Check for direct items
        if (node.hasAttribute?.('itemslug')) {
          pendingItems.add(node);
          hasNewItems = true;
          
          if (window.location.search.includes('debug=tabs')) {
            console.log(`➕ Queued: ${node.getAttribute('itemslug')}`);
          }
        }
        // Check for child items (more efficient query)
        else if (node.querySelector) {
          const childItems = node.querySelectorAll('[itemslug]');
          for (const item of childItems) {
            pendingItems.add(item);
            hasNewItems = true;
            
            if (window.location.search.includes('debug=tabs')) {
              console.log(`➕ Child queued: ${item.getAttribute('itemslug')}`);
            }
          }
        }
      }
    }
    
    if (hasNewItems) {
      scheduleProcessing();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Optimized initial processing
  setTimeout(() => {
    const existingItems = document.querySelectorAll('[itemslug]');
    
    // Filter items that actually need fixing
    const itemsNeedingFix = Array.from(existingItems).filter(item => {
      const tabs = item.querySelectorAll('[data-w-tab]');
      return tabs.length > 0 && !tabs[0].id;
    });
    
    if (itemsNeedingFix.length > 0) {
      if (window.location.search.includes('debug=tabs')) {
        console.log(`🔧 Processing ${itemsNeedingFix.length} existing items that need fixing`);
      }
      processItems(itemsNeedingFix);
    }
    
    // Batch add toggle functionality to existing working items
    const workingItems = Array.from(existingItems).filter(item => {
      const tabs = item.querySelectorAll('[data-w-tab]');
      return tabs.length > 0 && tabs[0].id;
    });
    
    workingItems.forEach((item, index) => {
      setTimeout(() => addToggleFunctionality(item), index * 10); // Stagger for performance
    });
    
    updateLazyLoad();
  }, 500);
  
  // Cleanup on page unload to prevent memory leaks
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    if (processingTimeout) clearTimeout(processingTimeout);
  });
});

// Debug mode
if (window.location.search.includes('debug=tabs')) {
  console.log('🐛 Debug mode enabled');
  
  window.debugTabs = function() {
    const allItems = document.querySelectorAll('[itemslug]');
    console.group(`🔍 Debug: ${allItems.length} items found`);
    
    allItems.forEach((item, index) => {
      const slug = item.getAttribute('itemslug');
      const tabs = item.querySelectorAll('[data-w-tab]');
      const lightboxes = item.querySelectorAll('.w-lightbox');
      const lazyElements = item.querySelectorAll('.lazy');
      const workingTabs = Array.from(tabs).filter(tab => tab.id).length;
      const hasToggle = item.hasAttribute('data-toggle-processed');
      const hasEnhancedToggle = item.querySelectorAll('[data-toggle-enhanced]').length;
      
      console.log(`${index + 1}. ${slug}:`);
      console.log(`   Tabs: ${tabs.length} (${workingTabs} working)`);
      console.log(`   Toggle: ${hasToggle} (${hasEnhancedToggle} enhanced)`);
      console.log(`   Lightboxes: ${lightboxes.length}`);
      console.log(`   Lazy elements: ${lazyElements.length}`);
      
      // Test clicking the first tab
      if (tabs.length > 0) {
        const firstTab = tabs[0];
        console.log(`   First tab details:`, {
          text: firstTab.textContent.trim(),
          id: firstTab.id,
          href: firstTab.href,
          hasClickListener: firstTab.hasAttribute('data-tab-fixed'),
          classes: firstTab.className
        });
      }
    });
    
    console.log(`\n🖼️ LazyLoad instance:`, lazyLoadInstance ? 'Active' : 'Not found');
    console.groupEnd();
  };
  
  // Add manual test function
  window.testToggle = function(itemIndex = 0) {
    const items = document.querySelectorAll('[itemslug]');
    const item = items[itemIndex];
    if (!item) {
      console.log('❌ Item not found at index', itemIndex);
      return;
    }
    
    const slug = item.getAttribute('itemslug');
    const tabs = item.querySelectorAll('[data-w-tab]');
    
    console.group(`🧪 Testing toggle on item ${itemIndex}: ${slug}`);
    
    if (tabs.length === 0) {
      console.log('❌ No tabs found');
      console.groupEnd();
      return;
    }
    
    const firstTab = tabs[0];
    console.log('Clicking first tab...');
    
    // Simulate click
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    console.log('Before click - Active?', firstTab.classList.contains('w--current'));
    firstTab.dispatchEvent(clickEvent);
    
    setTimeout(() => {
      console.log('After click - Active?', firstTab.classList.contains('w--current'));
      
      // Click again to test toggle
      console.log('Clicking again to test toggle...');
      firstTab.dispatchEvent(clickEvent);
      
      setTimeout(() => {
        console.log('After second click - Active?', firstTab.classList.contains('w--current'));
        console.groupEnd();
      }, 100);
    }, 100);
  };
  
  console.log('💡 Commands: debugTabs(), testToggle(0), testToggle(1), etc.');
}

console.log('✅ Webflow Fix + LazyLoad + Toggle Ready!');
