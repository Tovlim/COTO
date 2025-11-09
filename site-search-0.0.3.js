/**
 * SITE-WIDE SEARCH SCRIPT v3.0.0
 *
 * High-performance search across all CMS collections.
 * Searches: Reporters, Perpetrators, Topics, Regions, Localities, Settlements
 *
 * Features: API integration, filtering, sorting, results display.
 *
 * Simplified to work exclusively with Webflow-created HTML structure
 */

// ========================
// CONFIGURATION
// ========================
const SITE_SEARCH_CONFIG = {
  cache: {
    maxRecentSearches: 10,
    storagePrefix: 'siteSearch_',
  },
  timeouts: {
    debounce: 300, // API call debounce
  },
  api: {
    url: 'https://webflow-cms-search.occupation-crimes.workers.dev',
    maxResults: 200
  },
  urlPrefixes: {
    'locality': 'locality',
    'settlement': 'settlement',
    'region': 'region',
    'territory': 'territory',
    'reporter': 'reporter',
    'perpetrator': 'perpetrator',
    'topic': 'topic'
  }
};

// ========================
// SAFE STORAGE WRAPPER
// ========================
const SiteSearchStorage = {
  available: false,

  init() {
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.available = true;
    } catch(e) {
      this.available = false;
    }
    return this.available;
  },

  getItem(key) {
    if (!this.available) return null;
    try {
      return localStorage.getItem(key);
    } catch(e) {
      return null;
    }
  },

  setItem(key, value) {
    if (!this.available) return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch(e) {
      return false;
    }
  },

  removeItem(key) {
    if (!this.available) return;
    try {
      localStorage.removeItem(key);
    } catch(e) {
      // Silently fail
    }
  }
};

// Initialize storage on load
console.log('[Site Search] Initializing storage...');
const storageAvailable = SiteSearchStorage.init();
console.log('[Site Search] Storage available:', storageAvailable);

// ========================
// SITE SEARCH CLASS
// ========================

class SiteSearch {
  constructor(options = {}) {
    // Configuration
    this.config = {
      inputId: options.inputId || "site-search",
      clearId: options.clearId || "searchclear",
      debounceMs: options.debounceMs || SITE_SEARCH_CONFIG.timeouts.debounce,
      apiUrl: options.apiUrl || SITE_SEARCH_CONFIG.api.url,
      maxResults: options.maxResults || SITE_SEARCH_CONFIG.api.maxResults
    };

    // Data storage
    this.data = {
      allResults: [],       // All results from API
      filteredResults: [],  // Results after filtering
      currentFilter: '',    // Current filter type
      currentSort: '',      // Current sort option
      searchTerm: ''        // Current search term
    };

    // API state
    this.apiState = {
      currentRequest: null,
      isLoading: false
    };

    // Initialize recent searches
    this.recentSearches = this.loadRecentSearches();

    // Initialize
    this.init();
  }

  init() {
    console.log('[Site Search] Initializing...');
    console.log('[Site Search] Config:', this.config);

    // Cache DOM elements
    this.elements = {
      input: document.getElementById(this.config.inputId),
      clear: document.getElementById(this.config.clearId),
      indicator: document.querySelector('[map-search="indicator"]'),
      // Webflow elements
      resultsWrap: document.querySelector('[site-search="results-wrap"]'),
      filterDropdown: document.querySelector('[site-search="filter-by-type"]'),
      sortDropdown: document.querySelector('[site-search="sort-by"]'),
      resultTemplate: document.querySelector('[site-search="result-wrap"]'),
      // Sidebar elements
      sidebar: document.querySelector('[site-search="sidebar"]'),
      openSearch: document.querySelector('[site-search="open-search"]'),
      sidebarClose: document.querySelector('[site-search="sidebar-close"]')
    };

    console.log('[Site Search] Elements found:', {
      input: !!this.elements.input,
      clear: !!this.elements.clear,
      indicator: !!this.elements.indicator,
      resultsWrap: !!this.elements.resultsWrap,
      filterDropdown: !!this.elements.filterDropdown,
      sortDropdown: !!this.elements.sortDropdown,
      resultTemplate: !!this.elements.resultTemplate,
      sidebar: !!this.elements.sidebar,
      openSearch: !!this.elements.openSearch,
      sidebarClose: !!this.elements.sidebarClose
    });

    if (!this.elements.input) {
      console.error('Site search: Input element not found');
      return;
    }

    // Clone and hide the result template if it exists
    if (this.elements.resultTemplate) {
      this.resultTemplateClone = this.elements.resultTemplate.cloneNode(true);
      this.elements.resultTemplate.style.display = 'none';
    }

    console.log('[Site Search] Setting up event listeners...');
    this.setupEventListeners();

    console.log('[Site Search] Initialization complete!');
  }

  setupEventListeners() {
    let inputTimeout;

    // Input handling with debounce
    this.elements.input.addEventListener('input', (e) => {
      console.log('[Site Search] Input event:', e.target.value);
      clearTimeout(inputTimeout);
      this.data.searchTerm = e.target.value;

      if (this.data.searchTerm.trim()) {
        inputTimeout = setTimeout(() => this.performSearch(this.data.searchTerm), this.config.debounceMs);
      } else {
        this.clearResults();
      }
    });

    // Clear button
    if (this.elements.clear) {
      this.elements.clear.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleClear();
      });
    }

    // Filter dropdown
    if (this.elements.filterDropdown) {
      this.elements.filterDropdown.addEventListener('change', (e) => {
        console.log('[Site Search] Filter changed:', e.target.value);
        this.handleFilterChange(e.target.value);
      });
    }

    // Sort dropdown
    if (this.elements.sortDropdown) {
      this.elements.sortDropdown.addEventListener('change', (e) => {
        console.log('[Site Search] Sort changed:', e.target.value);
        this.handleSortChange(e.target.value);
      });
    }

    // Open search sidebar
    if (this.elements.openSearch && this.elements.sidebar) {
      this.elements.openSearch.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[Site Search] Opening sidebar');
        this.openSidebar();
      });
    }

    // Close search sidebar
    if (this.elements.sidebarClose && this.elements.sidebar) {
      this.elements.sidebarClose.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[Site Search] Closing sidebar');
        this.closeSidebar();
      });
    }

    // Prevent form submission
    const form = this.elements.input.closest('form');
    if (form) {
      form.addEventListener('submit', (e) => e.preventDefault());
    }

    // Enter key to select first result
    this.elements.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.data.filteredResults.length > 0) {
        e.preventDefault();
        const firstResult = this.data.filteredResults[0];
        this.navigateToResult(firstResult);
      }
      // ESC key to close sidebar
      if (e.key === 'Escape' && this.elements.sidebar) {
        this.closeSidebar();
      }
    });
  }

  async performSearch(searchText) {
    console.log('[Site Search] Performing search for:', searchText);

    // Cancel previous request if still pending
    if (this.apiState.currentRequest) {
      console.log('[Site Search] Aborting previous request');
      this.apiState.currentRequest.abort();
    }

    // Create new AbortController for this request
    const controller = new AbortController();
    this.apiState.currentRequest = controller;
    this.apiState.isLoading = true;

    // Show loading indicator
    if (this.elements.indicator) {
      this.elements.indicator.style.display = 'flex';
    }

    try {
      const url = `${this.config.apiUrl}/search?q=${encodeURIComponent(searchText)}&limit=${this.config.maxResults}`;
      console.log('[Site Search] Fetching:', url);

      const response = await fetch(url, {
        signal: controller.signal
      });

      console.log('[Site Search] Response status:', response.status);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Site Search] API response:', data);
      console.log('[Site Search] Results count:', data.results?.length || 0);

      // Transform API results to match expected format
      this.data.allResults = data.results.map(item => ({
        name: item.name,
        type: item.type,
        slug: item.slug,
        score: parseFloat(item.score) / 100, // Normalize score to 0-1
        collection: item.collection,
        date: item.date || null,
        // Include additional fields for display
        region: item.region,
        subRegion: item.subRegion,
        territory: item.territory,
        photoUrl: item.photoUrl,
        // Report-specific fields
        categoryName: item.categoryName,
        reporterNames: item.reporterNames,
        urgent: item.urgent
      }));

      // Apply filter and sort
      this.applyFilterAndSort();

      // Update results display
      this.updateResultsDisplay();

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[Site Search] Request aborted (normal)');
        return;
      }
      console.error('[Site Search] API error:', error);
      this.data.allResults = [];
      this.data.filteredResults = [];
      this.updateResultsDisplay();
    } finally {
      this.apiState.isLoading = false;
      this.apiState.currentRequest = null;

      // Hide loading indicator
      if (this.elements.indicator) {
        this.elements.indicator.style.display = 'none';
      }
    }
  }

  handleFilterChange(filterValue) {
    this.data.currentFilter = filterValue;
    this.applyFilterAndSort();
    this.updateResultsDisplay();
  }

  handleSortChange(sortValue) {
    this.data.currentSort = sortValue;
    this.applyFilterAndSort();
    this.updateResultsDisplay();
  }

  applyFilterAndSort() {
    // Start with all results
    let results = [...this.data.allResults];

    // Apply filter
    if (this.data.currentFilter) {
      const filterMap = {
        'Reports': ['report'],
        'Localities': ['locality'],
        'Regions': ['region'],
        'Settlements': ['settlement'],
        'Reporters': ['reporter'],
        'Perpetrators': ['perpetrator'],
        'Topics': ['topic']
      };

      const allowedTypes = filterMap[this.data.currentFilter];
      if (allowedTypes) {
        results = results.filter(item => allowedTypes.includes(item.type));
      }
    }

    // Apply sort
    if (this.data.currentSort) {
      if (this.data.currentSort === 'Title') {
        results.sort((a, b) => a.name.localeCompare(b.name));
      } else if (this.data.currentSort === 'Date' && results.some(r => r.date)) {
        results.sort((a, b) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(b.date) - new Date(a.date);
        });
      }
    } else {
      // Default sort by score
      results.sort((a, b) => b.score - a.score);
    }

    this.data.filteredResults = results;
  }

  updateResultsDisplay() {
    if (!this.elements.resultsWrap || !this.resultTemplateClone) {
      console.warn('[Site Search] Results wrap or template not found');
      return;
    }

    // Clear existing results (except the template)
    const existingResults = this.elements.resultsWrap.querySelectorAll('[site-search="result-wrap"]');
    existingResults.forEach(el => {
      if (el !== this.elements.resultTemplate) {
        el.remove();
      }
    });

    // Show/hide results wrap based on whether there are results
    if (this.data.filteredResults.length === 0) {
      this.elements.resultsWrap.style.display = 'none';
      return;
    }

    this.elements.resultsWrap.style.display = 'block';

    // Add filtered results
    this.data.filteredResults.forEach(item => {
      const resultEl = this.resultTemplateClone.cloneNode(true);

      // Update result elements
      const titleEl = resultEl.querySelector('[site-search="result-title"]');
      const typeEls = resultEl.querySelectorAll('[site-search="result-type"]');

      // Get both picture elements
      const regularPictureEl = resultEl.querySelector('[site-search="result-picture"]');
      const reportPictureEl = resultEl.querySelector('[site-search="result-picture-report"]');

      // Determine which picture element to use based on type
      let pictureEl = null;
      if (item.type === 'report') {
        pictureEl = reportPictureEl || regularPictureEl;
        // Hide the unused picture element
        if (regularPictureEl && reportPictureEl) {
          regularPictureEl.style.display = 'none';
        }
      } else {
        pictureEl = regularPictureEl;
        // Hide report picture element if it exists
        if (reportPictureEl) {
          reportPictureEl.style.display = 'none';
        }
      }

      const infoEl = resultEl.querySelector('[site-search="result-info"]');

      if (titleEl) {
        titleEl.textContent = item.name;

        // Add urgent indicator for reports if urgent
        if (item.type === 'report' && item.urgent) {
          titleEl.innerHTML = '🔴 ' + titleEl.textContent;
        }
      }

      // Format type display
      const typeDisplay = this.formatTypeDisplay(item.type);
      typeEls.forEach(el => {
        el.textContent = typeDisplay;
      });

      // Set location info for localities, settlements, regions, and territories
      if (infoEl) {
        const locationInfo = this.getLocationInfo(item);
        if (locationInfo) {
          infoEl.textContent = locationInfo;
          infoEl.style.display = '';
        } else {
          infoEl.style.display = 'none';
        }
      }

      // Set image
      if (pictureEl) {
        if (item.photoUrl) {
          pictureEl.src = item.photoUrl;
          pictureEl.alt = item.name;
          pictureEl.style.display = ''; // Ensure it's visible when we have an image
        } else {
          // Hide the image when there's no URL
          pictureEl.style.display = 'none';
        }
      }

      // Make the entire result clickable
      resultEl.style.cursor = 'pointer';
      resultEl.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateToResult(item);
      });

      // Show the result and append to wrapper
      resultEl.style.display = '';
      this.elements.resultsWrap.appendChild(resultEl);
    });
  }

  formatTypeDisplay(type) {
    const typeMap = {
      'locality': 'Locality',
      'settlement': 'Settlement',
      'region': 'Region',
      'territory': 'Territory',
      'reporter': 'Reporter',
      'perpetrator': 'Perpetrator',
      'topic': 'Topic',
      'report': 'Report'
    };
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  getLocationInfo(item) {
    // For reports, show date, topic, and reporters
    if (item.type === 'report') {
      const infoParts = [];

      // Add date if available
      if (item.date) {
        const date = new Date(item.date);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        infoParts.push(formattedDate);
      }

      // Add topic/category if available
      if (item.categoryName) {
        infoParts.push(item.categoryName);
      }

      // Add reporters (bylines) if available
      if (item.reporterNames && item.reporterNames.length > 0) {
        const byline = item.reporterNames.join(', ');
        infoParts.push(`By: ${byline}`);
      }

      return infoParts.length > 0 ? infoParts.join(' • ') : null;
    }

    // Only show location info for specific types
    if (!['locality', 'settlement', 'region', 'territory'].includes(item.type)) {
      return null;
    }

    // Build location hierarchy
    const locationParts = [];

    // For localities and settlements, show region hierarchy
    if (item.type === 'locality' || item.type === 'settlement') {
      if (item.subRegion) {
        locationParts.push(item.subRegion);
      }
      if (item.region) {
        locationParts.push(item.region);
      }
      if (item.territory) {
        locationParts.push(item.territory);
      }
    }

    // For regions, show parent territory if available
    else if (item.type === 'region') {
      if (item.territory) {
        locationParts.push(item.territory);
      }
    }

    // For territories, typically no parent location
    // but you could add statistics or other info here if available
    else if (item.type === 'territory') {
      // Could add statistics if available in the data
      // For now, return null to hide the info field
      return null;
    }

    // Join parts with dash separator
    return locationParts.length > 0 ? locationParts.join(' - ') : null;
  }

  navigateToResult(item) {
    console.log('[Site Search] Navigating to:', item);

    // Save to recent searches
    this.saveRecentSearch(this.data.searchTerm, item);

    // Navigate to the item's page
    const urlPrefix = SITE_SEARCH_CONFIG.urlPrefixes[item.type] || item.type;
    const slug = item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const targetUrl = `/${urlPrefix}/${slug}`;

    console.log('[Site Search] Navigating to URL:', targetUrl);
    window.location.href = targetUrl;
  }

  handleClear() {
    console.log('[Site Search] Clear clicked');

    // Clear input
    this.elements.input.value = '';
    this.data.searchTerm = '';

    // Clear all data
    this.clearResults();

    // Reset dropdowns
    if (this.elements.filterDropdown) {
      this.elements.filterDropdown.value = '';
    }
    if (this.elements.sortDropdown) {
      this.elements.sortDropdown.value = '';
    }

    // Focus input (except on iOS Safari)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobileSafari = isIOS && /WebKit/.test(navigator.userAgent) && !/CriOS/.test(navigator.userAgent);

    if (!isMobileSafari) {
      this.elements.input.focus();
    }
  }

  openSidebar() {
    if (this.elements.sidebar) {
      this.elements.sidebar.style.display = 'flex';

      // Focus the search input when sidebar opens
      if (this.elements.input) {
        setTimeout(() => {
          this.elements.input.focus();
        }, 100);
      }
    }
  }

  closeSidebar() {
    if (this.elements.sidebar) {
      this.elements.sidebar.style.display = 'none';

      // Clear search when closing sidebar (optional - remove if not desired)
      this.handleClear();
    }
  }

  clearResults() {
    this.data.allResults = [];
    this.data.filteredResults = [];
    this.data.currentFilter = '';
    this.data.currentSort = '';

    // Hide results display
    if (this.elements.resultsWrap) {
      this.elements.resultsWrap.style.display = 'none';
    }
  }

  // Recent searches functionality
  loadRecentSearches() {
    try {
      const searches = SiteSearchStorage.getItem('recentSearches');
      return searches ? JSON.parse(searches) : [];
    } catch (e) {
      return [];
    }
  }

  saveRecentSearch(searchTerm, selectedItem) {
    if (!searchTerm || !searchTerm.trim()) return;

    const search = {
      term: searchTerm.trim(),
      name: selectedItem.name,
      type: selectedItem.type,
      slug: selectedItem.slug,
      photoUrl: selectedItem.photoUrl,
      timestamp: Date.now()
    };

    // Remove if already exists
    this.recentSearches = this.recentSearches.filter(s => s.name !== search.name);

    // Add to beginning
    this.recentSearches.unshift(search);

    // Limit size
    this.recentSearches = this.recentSearches.slice(0, SITE_SEARCH_CONFIG.cache.maxRecentSearches);

    // Save to storage
    SiteSearchStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
  }

  destroy() {
    console.log('[Site Search] Destroying instance');

    // Cancel any pending requests
    if (this.apiState.currentRequest) {
      this.apiState.currentRequest.abort();
    }

    // Clear results display
    this.clearResults();
  }
}

// ========================
// INITIALIZATION
// ========================

(function() {
  console.log('[Site Search] Script loaded, document.readyState:', document.readyState);
  let searchInstance = null;

  function initSiteSearch() {
    console.log('[Site Search] initSiteSearch called');

    // Clean up old instance if exists
    if (searchInstance) {
      console.log('[Site Search] Destroying old instance');
      searchInstance.destroy();
      searchInstance = null;
    }

    // Check if required elements exist
    const searchInput = document.getElementById('site-search');

    console.log('[Site Search] DOM elements check:', {
      searchInput: !!searchInput
    });

    if (!searchInput) {
      console.warn('Site search: #site-search element not found');
      return;
    }

    console.log('[Site Search] Creating new search instance...');

    // Create new instance
    searchInstance = new SiteSearch({
      inputId: "site-search",
      clearId: "searchclear"
    });

    console.log('[Site Search] Instance created successfully');

    // Expose globally for debugging
    window.siteSearch = searchInstance;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    console.log('[Site Search] DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initSiteSearch);
  } else {
    console.log('[Site Search] DOM ready, initializing immediately');
    initSiteSearch();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (searchInstance) {
      console.log('[Site Search] Page unloading, cleaning up');
      searchInstance.destroy();
    }
  });
})();
