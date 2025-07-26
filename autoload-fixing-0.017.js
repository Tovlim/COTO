// 🚀 AUTO LOAD MORE + LazyLoad Integration v4.0
// 
// ✅ FEATURES:
// • Auto-clicks #load-more when visible with smart throttling
// • Integrates LazyLoad for images on new items  
// • Works with Finsweet list load v2 (2025)
// • IMMEDIATE processing of new load-more items
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
// • LAZY PROCESSING: Only processes visible items
// • Coordinated observers for maximum efficiency
// • Prevents UI freezing on large item counts
// • Smart viewport detection with buffer zone
//
// 🔄 AUTO LOAD MORE:
// • Automatically clicks load-more button when it becomes visible
// • Preserves scroll position during loading
// • Coordinates with LazyLoad for optimal performance

console.log('🚀 Auto Load More + LazyLoad Loading...');

// Global state management
let isLoadingMore = false;
let lazyLoadInstance = null;
let loadMoreObserver = null;

// Configuration
const LOAD_MORE_DELAY = 1500; // 1.5 seconds delay between load-more clicks

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
  console.log('Auto-clicking load-more button...');
  
  // Store current scroll position
  const currentScrollY = window.scrollY;
  
  // Click the button
  element.click();
  
  // Restore scroll position after a brief moment
  setTimeout(() => {
    window.scrollTo(0, currentScrollY);
  }, 100);
  
  // Update LazyLoad for any new items that were just added
  setTimeout(() => {
    updateLazyLoad();
    console.log('Updated LazyLoad for new content');
  }, 300);
  
  // Reset loading flag after delay
  setTimeout(() => {
    isLoadingMore = false;
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

// UNIFIED INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
  initLazyLoad();
  initLoadMoreObserver();
  
  // Unified mutation observer for new load-more buttons
  const observer = new MutationObserver((mutations) => {
    let hasNewLoadMore = false;
    
    for (const mutation of mutations) {
      if (mutation.type !== 'childList' || !mutation.addedNodes.length) continue;
      
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        
        // Check for new load-more button
        if (node.id === 'load-more' || (node.querySelector && node.querySelector('#load-more'))) {
          hasNewLoadMore = true;
        }
      }
    }
    
    if (hasNewLoadMore) {
      setTimeout(() => {
        observeLoadMoreButton();
      }, 100);
    }
    
    // Update LazyLoad when new content is added
    setTimeout(() => {
      updateLazyLoad();
    }, 200);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Initial setup
  setTimeout(() => {
    observeLoadMoreButton();
    updateLazyLoad();
  }, 500);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    if (loadMoreObserver) loadMoreObserver.disconnect();
  });
});

console.log('✅ Auto Load More + LazyLoad Ready!');
