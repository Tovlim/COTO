/**
 * MAPBOX INTEGRATED SCRIPT - CHECKBOXES
 * Checkbox generation functions (all generate*Checkboxes functions)
 */

// ========================
// SETTLEMENT CHECKBOX GENERATION
// ========================
// Generate settlement checkboxes from loaded settlement data (modified for lazy loading) 
function generateSettlementCheckboxes() {
  if (APP_CONFIG.features.enableLazyCheckboxes) {
    return;
  }
  
  const container = document.getElementById('settlement-check-list');
  if (!container) {
    return;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Extract unique settlement names from settlement features
  const settlementNames = state.allSettlementFeatures
    .map(feature => feature.properties.name)
    .sort();
  
  if (settlementNames.length === 0) {
    return;
  }
  
  // Batch generate checkboxes using document fragment
  const fragment = document.createDocumentFragment();
  
  settlementNames.forEach(settlementName => {
    // Create the wrapper div
    const checkboxItem = document.createElement('div');
    checkboxItem.setAttribute('checkbox-filter', 'settlement');
    checkboxItem.className = 'checbox-item';
    
    // Create the label
    const label = document.createElement('label');
    label.className = 'w-checkbox reporterwrap-copy';
    
    // Create settlement slug for URL
    const settlementSlug = settlementName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Create the link element using DOMFactory
    const link = DOMFactory.createExternalLink(null, settlementSlug, 'settlement');
    
    // Create the custom checkbox div
    const customCheckbox = document.createElement('div');
    customCheckbox.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
    
    // Create the actual input
    const input = document.createElement('input');
    input.setAttribute('data-auto-sidebar', 'true');
    input.setAttribute('fs-list-value', settlementName);
    input.setAttribute('fs-list-field', 'Settlement');
    input.type = 'checkbox';
    input.name = 'settlement';
    input.setAttribute('data-name', 'settlement');
    input.setAttribute('activate-filter-indicator', 'place');
    input.id = `settlement-${settlementName.replace(/[^a-zA-Z0-9]/g, '-')}`;
    input.style.cssText = 'opacity: 0; position: absolute; z-index: -1;';
    
    // Create the label text
    const labelText = document.createElement('span');
    labelText.className = 'test3 w-form-label';
    labelText.setAttribute('for', input.id);
    labelText.textContent = settlementName;
    
    // Create count wrapper using DOMFactory
    const countWrapper = DOMFactory.createCountElement();
    
    // Assemble the structure
    label.appendChild(link);
    label.appendChild(customCheckbox);
    label.appendChild(input);
    label.appendChild(labelText);
    label.appendChild(countWrapper);
    checkboxItem.appendChild(label);
    fragment.appendChild(checkboxItem);
  });
  
  // Single DOM operation
  container.appendChild(fragment);
}

// ========================
// LOCALITY CHECKBOX GENERATION
// ========================
function generateLocalityCheckboxes() {
  if (APP_CONFIG.features.enableLazyCheckboxes) {
    return;
  }
  
  const container = document.getElementById('locality-check-list');
  if (!container) {
    return;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Extract unique locality names from map data
  const localityNames = [...new Set(state.allLocalityFeatures.map(feature => feature.properties.name))].sort();
  
  if (localityNames.length === 0) {
    return;
  }
  
  // Batch generate checkboxes using document fragment
  const fragment = document.createDocumentFragment();
  
  localityNames.forEach(localityName => {
    // Create the wrapper div
    const checkboxItem = document.createElement('div');
    checkboxItem.setAttribute('checkbox-filter', 'locality');
    checkboxItem.className = 'checbox-item';
    
    // Create the label
    const label = document.createElement('label');
    label.className = 'w-checkbox reporterwrap-copy';
    
    // Create locality slug for URL
    const localitySlug = localityName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Create the link element
    const link = document.createElement('a');
    link.setAttribute('open', '');
    link.href = `/locality/${localitySlug}`;
    link.target = '_blank';
    link.className = 'open-in-new-tab w-inline-block';
    link.innerHTML = DOMFactory.getSVGIcon('external');
    
    // Create the custom checkbox div
    const customCheckbox = document.createElement('div');
    customCheckbox.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
    
    // Create the actual input
    const input = document.createElement('input');
    input.setAttribute('data-auto-sidebar', 'true');
    input.setAttribute('fs-list-value', localityName);
    input.setAttribute('fs-list-field', 'Locality');
    input.type = 'checkbox';
    input.name = 'locality';
    input.setAttribute('data-name', 'locality');
    input.setAttribute('activate-filter-indicator', 'place');
    input.id = `locality-${localityName.replace(/[^a-zA-Z0-9]/g, '-')}`;
    input.style.cssText = 'opacity: 0; position: absolute; z-index: -1;';
    
    // Create the label text
    const labelText = document.createElement('span');
    labelText.className = 'test3 w-form-label';
    labelText.setAttribute('for', input.id);
    labelText.textContent = localityName;
    
    // Create count wrapper using DOMFactory
    const countWrapper = DOMFactory.createCountElement();
    
    // Assemble the structure
    label.appendChild(link);
    label.appendChild(customCheckbox);
    label.appendChild(input);
    label.appendChild(labelText);
    label.appendChild(countWrapper);
    checkboxItem.appendChild(label);
    fragment.appendChild(checkboxItem);
  });
  
  // Single DOM operation
  container.appendChild(fragment);
}

// ========================
// REGION CHECKBOX GENERATION
// ========================
function generateRegionCheckboxes() {
  const container = document.getElementById('region-check-list');
  if (!container) {
    return;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Extract unique region names
  const regionNames = [...new Set(state.allRegionFeatures.map(feature => feature.properties.name))].sort();
  
  // Extract unique subregion names
  const subregionNames = state.allSubregionFeatures ? 
    [...new Set(state.allSubregionFeatures.map(feature => feature.properties.name))].sort() : [];
  
  if (regionNames.length === 0 && subregionNames.length === 0) {
    return;
  }
  
  // Combine both lists for alphabetical display
  const allNames = [...regionNames, ...subregionNames].sort();
  
  // Batch generate checkboxes using document fragment
  const fragment = document.createDocumentFragment();
  
  allNames.forEach(name => {
    const isRegion = regionNames.includes(name);
    const type = isRegion ? 'region' : 'subregion';
    const fieldName = isRegion ? 'Region' : 'Subregion';
    
    // Create the wrapper div
    const checkboxItem = document.createElement('div');
    checkboxItem.setAttribute('checkbox-filter', type);
    checkboxItem.className = 'checbox-item';
    
    // Create the label
    const label = document.createElement('label');
    label.className = 'w-checkbox reporterwrap-copy';
    
    // Create slug for URL
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Create the link element
    const link = document.createElement('a');
    link.setAttribute('open', '');
    link.href = `/region/${slug}`;
    link.target = '_blank';
    link.className = 'open-in-new-tab w-inline-block';
    link.innerHTML = DOMFactory.getSVGIcon('external');
    
    // Create the custom checkbox div
    const customCheckbox = document.createElement('div');
    customCheckbox.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
    
    // Create the actual input
    const input = document.createElement('input');
    input.setAttribute('data-auto-sidebar', 'true');
    input.setAttribute('fs-list-value', name);
    input.setAttribute('fs-list-field', fieldName);
    input.type = 'checkbox';
    input.name = type;
    input.setAttribute('data-name', type);
    input.setAttribute('activate-filter-indicator', 'place');
    input.id = `${type}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;
    input.style.cssText = 'opacity: 0; position: absolute; z-index: -1;';
    
    // Create the label text
    const labelText = document.createElement('span');
    labelText.className = 'test3 w-form-label';
    labelText.setAttribute('for', input.id);
    labelText.textContent = name;
    
    // Create count wrapper using DOMFactory
    const countWrapper = DOMFactory.createCountElement();
    
    // Assemble the structure
    label.appendChild(link);
    label.appendChild(customCheckbox);
    label.appendChild(input);
    label.appendChild(labelText);
    label.appendChild(countWrapper);
    checkboxItem.appendChild(label);
    fragment.appendChild(checkboxItem);
  });
  
  // Single DOM operation
  container.appendChild(fragment);
}

// ========================
// SINGLE CHECKBOX GENERATION
// ========================
function generateSingleCheckbox(name, type, properties = {}) {
  if (!APP_CONFIG.features.enableLazyCheckboxes) {
    return false;
  }
  
  // Check if already generated
  if (LazyCheckboxState.hasCheckbox(name, type)) {
    return true;
  }
  
  const containerId = type === 'locality' ? 'locality-check-list' : 'settlement-check-list';
  const container = document.getElementById(containerId);
  if (!container) {
    return false;
  }
  
  // Create the checkbox using CheckboxFactory
  const checkboxWrapper = CheckboxFactory.createCheckboxElement(name, type, properties);
  
  // Find insertion point to maintain alphabetical order
  let insertBefore = null;
  const existingCheckboxes = container.querySelectorAll('[checkbox-filter] .test3');
  
  for (let i = 0; i < existingCheckboxes.length; i++) {
    const existingName = existingCheckboxes[i].textContent;
    if (name.localeCompare(existingName) < 0) {
      insertBefore = existingCheckboxes[i].closest('[checkbox-filter]');
      break;
    }
  }
  
  // Insert the checkbox
  if (insertBefore) {
    container.insertBefore(checkboxWrapper, insertBefore);
  } else {
    container.appendChild(checkboxWrapper);
  }
  
  // Mark as generated
  LazyCheckboxState.addCheckbox(name, type);
  
  return true;
}

// ========================
// BULK GENERATION FUNCTIONS
// ========================
// Bulk generate all locality checkboxes (for Location tab click)
function generateAllLocalityCheckboxes() {
  return CheckboxFactory.generateBulkCheckboxes(
    'locality-check-list',
    state.allLocalityFeatures || [],
    'locality',
    'allLocalityFeatures'
  );
}

// Bulk generate all settlement checkboxes (for Location tab click)
function generateAllSettlementCheckboxes() {
  return CheckboxFactory.generateBulkCheckboxes(
    'settlement-check-list',
    state.allSettlementFeatures || [],
    'settlement',
    'allSettlementFeatures'
  );
}

// Generate all checkboxes when Location tab is clicked
function generateAllCheckboxes() {
  if (LazyCheckboxState.isGeneratingBulk) {
    return Promise.resolve();
  }
  
  LazyCheckboxState.isGeneratingBulk = true;
  
  // Show loading state
  const localityContainer = document.getElementById('locality-check-list');
  const settlementContainer = document.getElementById('settlement-check-list');
  
  if (localityContainer && !LazyCheckboxState.isFullyGenerated('locality')) {
    DOMFactory.clearContainer(localityContainer);
    localityContainer.appendChild(DOMFactory.createLoadingState('Loading localities...'));
  }
  if (settlementContainer && !LazyCheckboxState.isFullyGenerated('settlement')) {
    DOMFactory.clearContainer(settlementContainer);
    settlementContainer.appendChild(DOMFactory.createLoadingState('Loading settlements...'));
  }
  
  return Promise.all([
    generateAllLocalityCheckboxes(),
    generateAllSettlementCheckboxes()
  ]).then(() => {
    LazyCheckboxState.isGeneratingBulk = false;
    
    // Setup event listeners for all new checkboxes
    if (window.setupGeneratedCheckboxEvents) {
      window.setupGeneratedCheckboxEvents();
    }
    
    // Recache after bulk generation
    if (window.checkboxFilterScript) {
      setTimeout(() => {
        if (window.checkboxFilterScript.recacheElements) {
          window.checkboxFilterScript.recacheElements();
        }
      }, 100);
    }
  });
}

// ========================
// UTILITY FUNCTIONS
// ========================
// Quick DOM selector helper
function $id(id) {
  return document.getElementById(id);
}

// Setup events for generated checkboxes
function setupGeneratedCheckboxEvents() {
  const newCheckboxes = document.querySelectorAll('[checkbox-filter] input[type="checkbox"]:not([data-event-listener-added])');
  let newListenersCount = 0;
  
  newCheckboxes.forEach(element => {
    const changeHandler = () => {
      if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
        state.setTimer('autoSidebar', () => {
          if (window.toggleSidebar) {
            window.toggleSidebar('Left', true);
          }
        }, 50);
      }
      
      // Trigger filter update
      state.setTimer('filterUpdate', () => {
        if (window.handleFilterUpdate) {
          window.handleFilterUpdate();
        }
      }, APP_CONFIG.timeouts.debounce);
    };
    
    eventManager.add(element, 'change', changeHandler);
    
    if (['text', 'search'].includes(element.type)) {
      const inputHandler = () => {
        if (window.innerWidth > APP_CONFIG.breakpoints.tablet) {
          state.setTimer('autoSidebar', () => {
            if (window.toggleSidebar) {
              window.toggleSidebar('Left', true);
            }
          }, 50);
        }
      };
      eventManager.add(element, 'input', inputHandler);
    }
    
    element.dataset.eventListenerAdded = 'true';
    newListenersCount++;
  });
}

// ========================
// GLOBAL AVAILABILITY
// ========================
// Make functions globally available
window.generateSettlementCheckboxes = generateSettlementCheckboxes;
window.generateLocalityCheckboxes = generateLocalityCheckboxes;
window.generateRegionCheckboxes = generateRegionCheckboxes;
window.generateSingleCheckbox = generateSingleCheckbox;
window.generateAllLocalityCheckboxes = generateAllLocalityCheckboxes;
window.generateAllSettlementCheckboxes = generateAllSettlementCheckboxes;
window.generateAllCheckboxes = generateAllCheckboxes;
window.setupGeneratedCheckboxEvents = setupGeneratedCheckboxEvents;