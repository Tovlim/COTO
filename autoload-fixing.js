// Webflow Component Fix - Back to Working Version + Simple Toggle Addition

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

// BACK TO WORKING TAB SYSTEM - NO CHANGES
function fixTabSystemEnhanced(item, itemSlug) {
  const tabContainers = item.querySelectorAll('.w-tabs');
  
  if (window.location.search.includes('debug=tabs')) {
    console.log(`🔧 Fixing tabs for: ${itemSlug}`);
    console.log(`Found ${tabContainers.length} tab containers`);
  }
  
  tabContainers.forEach((container, containerIndex) => {
    const containerTabs = container.querySelectorAll('[data-w-tab]');
    const containerPanes = container.querySelectorAll('[data-w-pane]');
    
    if (containerTabs.length === 0) return;
    
    const baseId = `w-tabs-${itemSlug.replace(/[^a-zA-Z0-9-]/g, '-')}-${containerIndex}`;
    
    if (window.location.search.includes('debug=tabs')) {
      console.log(`Container ${containerIndex}: ${containerTabs.length} tabs, ${containerPanes.length} panes`);
      console.log(`Base ID: ${baseId}`);
    }
    
    containerTabs.forEach((tabLink, index) => {
      const tabName = tabLink.getAttribute('data-w-tab');
      const tabId = `${baseId}-data-w-tab-${index}`;
      const paneId = `${baseId}-data-w-pane-${index}`;
      
      // MORE AGGRESSIVE FIXING - Always set IDs even if they exist
      const hadId = !!tabLink.id;
      
      tabLink.id = tabId;
      tabLink.href = `#${paneId}`;
      tabLink.setAttribute('role', 'tab');
      tabLink.setAttribute('aria-controls', paneId);
      tabLink.setAttribute('tabindex', '-1');
      tabLink.setAttribute('aria-selected', 'false');
      tabLink.classList.remove('w--current');
      
      if (window.location.search.includes('debug=tabs') && containerIndex === 0 && index < 3) {
        console.log(`Tab ${index} (${tabName}): ${hadId ? 'had ID' : 'no ID'} → ${tabId}`);
      }
      
      const matchingPanes = Array.from(containerPanes).filter(pane => 
        pane.getAttribute('data-w-pane') === tabName
      );
      
      if (matchingPanes.length > 0) {
        const correspondingPane = matchingPanes[0];
        
        correspondingPane.id = paneId;
        correspondingPane.setAttribute('role', 'tabpanel');
        correspondingPane.setAttribute('aria-labelledby', tabId);
        correspondingPane.classList.remove('w--tab-active');
        
        // ALWAYS ADD CLICK HANDLER - Remove existing attribute check
        tabLink.removeAttribute('data-tab-fixed'); // Remove old marker
        tabLink.setAttribute('data-tab-fixed', 'true');
        
        // Create click handler with proper reference
        const clickHandler = (e) => {
          e.preventDefault();
          switchTabEnhanced(e.currentTarget, containerTabs, containerPanes, correspondingPane);
        };
        
        // Store handler reference and add it
        tabLink._originalClickHandler = clickHandler;
        tabLink.addEventListener('click', clickHandler);
        
        if (window.location.search.includes('debug=tabs') && containerIndex === 0 && index < 3) {
          console.log(`Added click handler to tab ${index}`);
        }
      }
    });
  });
  
  if (window.location.search.includes('debug=tabs')) {
    const finalWorkingTabs = item.querySelectorAll('[data-w-tab][id*="' + itemSlug.replace(/[^a-zA-Z0-9-]/g, '-') + '"]').length;
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

// IMPROVED TOGGLE FUNCTIONALITY - Less disruptive, faster setup
function addToggleFunctionality(item) {
  const tabMenu = item.querySelector('.w-tab-menu');
  const tabContent = item.querySelector('.w-tab-content');
  if (!tabMenu || !tabContent) return;
  
  // Skip if already processed
  if (item.hasAttribute('data-toggle-processed')) return;
  item.setAttribute('data-toggle-processed', 'true');
  
  let lastClosedTab = null;
  
  const closeAllTabs = () => {
    item.querySelectorAll('.w-tab-link').forEach(tab => tab.classList.remove('w--current'));
    item.querySelectorAll('.w-tab-pane').forEach(pane => pane.classList.remove('w--tab-active'));
  };
  
  const activateTab = tab => {
    if (!tab) return;
    closeAllTabs();
    tab.classList.add('w--current');
    const pane = tabContent.querySelector(`.w-tab-pane[data-w-tab="${tab.getAttribute('data-w-tab')}"]`);
    pane?.classList.add('w--tab-active');
    lastClosedTab = null;
  };
  
  // IMPROVED: Add toggle to existing elements without cloning
  tabMenu.querySelectorAll('.w-tab-link').forEach(tab => {
    if (tab.hasAttribute('data-toggle-enhanced')) return;
    tab.setAttribute('data-toggle-enhanced', 'true');
    
    // Add enhanced click handler that includes toggle logic
    const enhancedHandler = (e) => {
      const currentTab = e.currentTarget;
      const isActive = currentTab.classList.contains('w--current');
      
      if (isActive) {
        // Clicking active tab - close it
        e.preventDefault();
        e.stopPropagation();
        lastClosedTab = currentTab;
        closeAllTabs();
      } else if (currentTab === lastClosedTab) {
        // Clicking the same tab that was just closed - reopen it
        e.preventDefault();
        e.stopPropagation();
        activateTab(currentTab);
      } else {
        // Normal tab click - let our original handler manage it, then clear lastClosed
        const originalHandler = currentTab._originalClickHandler;
        if (originalHandler) {
          originalHandler(e);
        }
        setTimeout(() => { lastClosedTab = null; }, 50);
      }
    };
    
    // Store the enhanced handler and add it
    tab._enhancedClickHandler = enhancedHandler;
    tab.addEventListener('click', enhancedHandler);
    
    if (window.location.search.includes('debug=tabs')) {
      console.log(`🔗 Enhanced toggle added to tab: ${tab.getAttribute('data-w-tab')}`);
    }
  });
  
  if (window.location.search.includes('debug=tabs')) {
    console.log(`✅ Toggle functionality added to: ${item.getAttribute('itemslug')}`);
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

// Enhanced processing with better timing and verification
function processItems(items) {
  if (!items?.length) return;
  
  items.forEach(item => {
    try {
      const itemSlug = getItemSlug(item);
      
      // Step 1: Fix tabs and lightboxes immediately
      fixTabSystemEnhanced(item, itemSlug);
      fixLightboxEnhanced(item, itemSlug);
      
      // Step 2: Verify tabs are working before adding toggle
      setTimeout(() => {
        const tabs = item.querySelectorAll('[data-w-tab]');
        const workingTabs = Array.from(tabs).filter(tab => tab.id && tab.id.includes(itemSlug.replace(/[^a-zA-Z0-9-]/g, '-'))).length;
        
        if (tabs.length > 0 && workingTabs === tabs.length) {
          // All tabs working - add toggle functionality
          addToggleFunctionality(item);
          
          if (window.location.search.includes('debug=tabs')) {
            console.log(`✅ ${itemSlug}: Tabs ready, toggle added`);
          }
        } else if (tabs.length > 0) {
          // Some tabs still broken - retry once more
          if (window.location.search.includes('debug=tabs')) {
            console.log(`⚠️ ${itemSlug}: ${workingTabs}/${tabs.length} tabs working, retrying...`);
          }
          
          setTimeout(() => {
            fixTabSystemEnhanced(item, itemSlug);
            setTimeout(() => addToggleFunctionality(item), 200);
          }, 500);
        }
      }, 100); // Short delay to ensure DOM is stable
      
    } catch (error) {
      console.error('Item processing error:', error);
    }
  });
  
  updateLazyLoad();
}

// Set up observer
document.addEventListener('DOMContentLoaded', function() {
  initLazyLoad();
  
  let pendingItems = [];
  let processingTimeout = null;
  
  // Fixed debouncing - process ALL collected items
  const scheduleProcessing = () => {
    if (processingTimeout) clearTimeout(processingTimeout);
    
    processingTimeout = setTimeout(() => {
      if (pendingItems.length > 0) {
        const itemsToProcess = [...pendingItems];
        pendingItems = []; // Clear array
        
        if (window.location.search.includes('debug=tabs')) {
          console.log(`📦 Processing batch of ${itemsToProcess.length} items`);
          itemsToProcess.forEach((item, i) => {
            console.log(`  ${i+1}. ${item.getAttribute('itemslug')}`);
          });
        }
        
        processItems(itemsToProcess);
      }
      processingTimeout = null;
    }, 300); // Reduced debounce time
  };
  
  const observer = new MutationObserver((mutations) => {
    let newItemsFound = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.hasAttribute && node.hasAttribute('itemslug')) {
              pendingItems.push(node);
              newItemsFound = true;
              if (window.location.search.includes('debug=tabs')) {
                console.log(`➕ Queued: ${node.getAttribute('itemslug')}`);
              }
            } else if (node.querySelector) {
              const childItems = node.querySelectorAll('[itemslug]');
              childItems.forEach(item => {
                pendingItems.push(item);
                newItemsFound = true;
                if (window.location.search.includes('debug=tabs')) {
                  console.log(`➕ Child queued: ${item.getAttribute('itemslug')}`);
                }
              });
            }
          }
        });
      }
    });
    
    // Only schedule processing if we found new items
    if (newItemsFound) {
      scheduleProcessing();
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Process existing items
  setTimeout(() => {
    const existingItems = document.querySelectorAll('[itemslug]');
    const itemsNeedingFix = [];
    
    existingItems.forEach(item => {
      const tabs = item.querySelectorAll('[data-w-tab]');
      const needsFix = tabs.length > 0 && !tabs[0].id;
      if (needsFix) {
        itemsNeedingFix.push(item);
      }
    });
    
    if (itemsNeedingFix.length > 0) {
      if (window.location.search.includes('debug=tabs')) {
        console.log(`🔧 Processing ${itemsNeedingFix.length} existing items that need fixing`);
      }
      processItems(itemsNeedingFix);
    }
    
    // Add toggle to ALL existing items (even working ones)
    existingItems.forEach(item => {
      setTimeout(() => addToggleFunctionality(item), 100);
    });
    
    updateLazyLoad();
  }, 1000);
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
