// Dynamic Locality and Settlement Checkbox Loader
// Fetches CSV data from GitHub via jsDelivr and creates searchable checkboxes
// Integrates with search-checkbox-0.38.js and Combined Firebase Auth script

(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    LOCALITIES_CSV_URL: 'https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/localities-cms-Id.csv',
    SETTLEMENTS_CSV_URL: 'https://cdn.jsdelivr.net/gh/Tovlim/COTO@main/settlements-cms-Id.csv',
    DEBUG: true // Set to false in production
  };
  
  // State
  let localitiesData = [];
  let settlementsData = [];
  let isInitialized = false;
  
  // Utility functions
  const log = (...args) => {
    if (CONFIG.DEBUG) console.log('[Locality/Settlement Loader]', ...args);
  };
  
  // Parse CSV data
  function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    // Get headers
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Find relevant column indices
    const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name');
    const itemIdIndex = headers.findIndex(h => h.toLowerCase() === 'item id');
    const regionIndex = headers.findIndex(h => h.toLowerCase() === 'region');
    const subRegionIndex = headers.findIndex(h => h.toLowerCase() === 'sub-region' || h.toLowerCase() === 'subregion');
    
    log('CSV Headers:', headers);
    log('Column indices - Name:', nameIndex, 'ItemID:', itemIdIndex, 'Region:', regionIndex, 'SubRegion:', subRegionIndex);
    
    const data = [];
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (values.length >= headers.length) {
        const entry = {
          name: values[nameIndex] || '',
          itemId: values[itemIdIndex] || '',
          region: values[regionIndex] || '',
          subRegion: values[subRegionIndex] || ''
        };
        
        // Only add if we have at least name and itemId
        if (entry.name && entry.itemId) {
          data.push(entry);
        }
      }
    }
    
    return data;
  }
  
  // Parse a single CSV line handling quoted values
  function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Don't forget the last value
    values.push(current.trim());
    
    return values;
  }
  
  // Create a single checkbox element
  function createCheckbox(data, groupType, index) {
    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.setAttribute('checkbox-filter', groupType);
    
    // Create label
    const label = document.createElement('label');
    label.className = 'reporterwrap-copy w-radio';
    
    // Create visual radio element
    const visualRadio = document.createElement('div');
    visualRadio.className = 'w-form-formradioinput w-form-formradioinput--inputType-custom toggleable w-radio-input';
    
    // Create input element
    const input = document.createElement('input');
    input.setAttribute('choice-id', data.itemId);
    input.setAttribute('choice-name', data.name);
    input.setAttribute('trigger-region', data.region || '');
    input.setAttribute('trigger-subregion', data.subRegion || '');
    input.setAttribute('name', groupType === 'locality' ? 'Locality' : 'Settlement');
    input.setAttribute('data-name', groupType === 'locality' ? 'Locality' : 'Settlement');
    input.setAttribute('cms-id-group', groupType);
    input.setAttribute('type', 'radio');
    input.setAttribute('id', `${groupType}-${index}`);
    input.style.opacity = '0';
    input.style.position = 'absolute';
    input.style.zIndex = '-1';
    input.value = data.itemId;
    
    // Create span for text
    const span = document.createElement('span');
    span.className = 'checkbox-text w-form-label';
    span.setAttribute('for', `${groupType}-${index}`);
    span.textContent = data.name;
    
    // Assemble the structure
    label.appendChild(visualRadio);
    label.appendChild(input);
    label.appendChild(span);
    wrapper.appendChild(label);
    
    return wrapper;
  }
  
  // Populate checkboxes for a group
  function populateCheckboxGroup(groupType, data) {
    log(`Populating ${groupType} with ${data.length} items`);
    
    // Find the container
    const container = document.querySelector(`[checkbox-list="${groupType}"]`);
    
    if (!container) {
      console.error(`Container not found for ${groupType}`);
      return;
    }
    
    // Clear existing content (except the first template if it exists)
    const existingCheckboxes = container.querySelectorAll('[checkbox-filter]');
    existingCheckboxes.forEach(el => {
      // Skip if this is a template element
      if (!el.querySelector('input').hasAttribute('choice-id') || 
          el.querySelector('input').getAttribute('choice-id') === '') {
        return; // Keep the template
      }
      el.remove();
    });
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Sort data alphabetically by name
    const sortedData = [...data].sort((a, b) => a.name.localeCompare(b.name));
    
    // Create checkboxes
    sortedData.forEach((item, index) => {
      const checkbox = createCheckbox(item, groupType, index);
      fragment.appendChild(checkbox);
    });
    
    // Append all at once
    container.appendChild(fragment);
    
    log(`Created ${sortedData.length} checkboxes for ${groupType}`);
  }
  
  // Fetch CSV data
  async function fetchCSVData(url, groupType) {
    try {
      log(`Fetching ${groupType} data from:`, url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const csvText = await response.text();
      const data = parseCSV(csvText);
      
      log(`Parsed ${data.length} ${groupType} entries`);
      
      // Store the data
      if (groupType === 'locality') {
        localitiesData = data;
      } else {
        settlementsData = data;
      }
      
      return data;
      
    } catch (error) {
      console.error(`Error fetching ${groupType} data:`, error);
      return [];
    }
  }
  
  // Initialize choice management for new checkboxes
  function initializeChoiceHandlers(groupType) {
    // This will be handled by the Combined Firebase Auth script
    // We just need to ensure the elements have the right attributes
    
    // The Firebase Auth script will handle these when it runs its initialization
    // But we need to check if it's already initialized and trigger a re-init if needed
    
    if (typeof window.initializeChoiceManagement === 'function') {
      // If the choice management is available as a global function, call it
      window.initializeChoiceManagement();
    }
  }
  
  // Main initialization function
  async function initialize() {
    if (isInitialized) {
      log('Already initialized, skipping');
      return;
    }
    
    log('Starting initialization...');
    
    // Check if containers exist
    const localityContainer = document.querySelector('[checkbox-list="locality"]');
    const settlementContainer = document.querySelector('[checkbox-list="settlement"]');
    
    if (!localityContainer && !settlementContainer) {
      log('No containers found, will retry in 500ms');
      setTimeout(initialize, 500);
      return;
    }
    
    isInitialized = true;
    
    try {
      // Fetch both CSV files in parallel
      const [localityData, settlementData] = await Promise.all([
        localityContainer ? fetchCSVData(CONFIG.LOCALITIES_CSV_URL, 'locality') : Promise.resolve([]),
        settlementContainer ? fetchCSVData(CONFIG.SETTLEMENTS_CSV_URL, 'settlement') : Promise.resolve([])
      ]);
      
      // Populate the checkboxes
      if (localityContainer && localityData.length > 0) {
        populateCheckboxGroup('locality', localityData);
      }
      
      if (settlementContainer && settlementData.length > 0) {
        populateCheckboxGroup('settlement', settlementData);
      }
      
      // Wait a bit for DOM to settle, then recache for search functionality
      setTimeout(() => {
        // Recache elements for the search script
        if (window.CheckboxFilter && typeof window.CheckboxFilter.recacheElements === 'function') {
          log('Recaching elements for search functionality');
          window.CheckboxFilter.recacheElements();
          log('Search functionality updated');
        } else {
          log('CheckboxFilter not found, search may not work');
        }
        
        // Re-initialize choice handlers if needed
        initializeChoiceHandlers('locality');
        initializeChoiceHandlers('settlement');
        
      }, 100);
      
      log('Initialization complete');
      
    } catch (error) {
      console.error('Error during initialization:', error);
      isInitialized = false; // Allow retry
    }
  }
  
  // Wait for dependencies and initialize
  function waitForDependencies() {
    let checkCount = 0;
    const maxChecks = 100; // 10 seconds maximum wait
    
    const checkDependencies = () => {
      checkCount++;
      
      // Check if we have what we need
      const hasContainers = document.querySelector('[checkbox-list="locality"]') || 
                           document.querySelector('[checkbox-list="settlement"]');
      
      if (hasContainers) {
        log('Containers found, initializing...');
        initialize();
      } else if (checkCount < maxChecks) {
        setTimeout(checkDependencies, 100);
      } else {
        console.error('Timeout waiting for containers');
      }
    };
    
    checkDependencies();
  }
  
  // Expose functions for external use
  window.LocalitySettlementLoader = {
    initialize,
    recache: () => {
      if (window.CheckboxFilter && typeof window.CheckboxFilter.recacheElements === 'function') {
        window.CheckboxFilter.recacheElements();
      }
    },
    getLocalitiesData: () => localitiesData,
    getSettlementsData: () => settlementsData,
    reload: async () => {
      isInitialized = false;
      await initialize();
    }
  };
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForDependencies);
  } else {
    waitForDependencies();
  }
  
})();