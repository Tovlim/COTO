/**
 * MAPBOX INTEGRATED SCRIPT - DOM FACTORY
 * DOM creation utilities, CheckboxFactory, and loading tracker
 */

// ========================
// LOADING TRACKER
// ========================
const loadingTracker = {
  requirements: {
    mapReady: false,
    dataLoaded: false,
    markersRendered: false,
    sidebarsReady: false,
    initialRenderComplete: false
  },
  
  promises: {
    mapReady: null,
    dataLoaded: null,
    markersRendered: null,
    sidebarsReady: null,
    initialRenderComplete: null
  },
  
  resolvers: {},
  observers: {},
  
  init() {
    // Create promises for each requirement
    Object.keys(this.requirements).forEach(key => {
      this.promises[key] = new Promise(resolve => {
        this.resolvers[key] = resolve;
      });
    });
    
    // Setup completion listener
    this.waitForAllRequirements().then(() => {
      this.onFullyLoaded();
    });
  },
  
  markComplete(requirement) {
    if (this.requirements.hasOwnProperty(requirement) && !this.requirements[requirement]) {
      this.requirements[requirement] = true;
      if (this.resolvers[requirement]) {
        this.resolvers[requirement]();
      }
      this.checkProgress();
    }
  },
  
  waitForAllRequirements() {
    return Promise.all(Object.values(this.promises));
  },
  
  checkProgress() {
    const completed = Object.values(this.requirements).filter(Boolean).length;
    const total = Object.keys(this.requirements).length;
    
    if (completed === total) {
      this.onFullyLoaded();
    }
  },
  
  onFullyLoaded() {
    // Hide loading screen
    const loadingScreen = document.getElementById('loading-map-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
    
    // Trigger completion events
    EventBus.emit('loading:complete');
    
    // Cleanup
    Object.keys(this.observers).forEach(key => {
      if (this.observers[key] && typeof this.observers[key].disconnect === 'function') {
        this.observers[key].disconnect();
      }
    });
  }
};

// Initialize the loading tracker
loadingTracker.init();

// ========================
// DOM FACTORY PATTERNS (Standardized Element Creation)
// ========================
const DOMFactory = {
  // Standardized external link with SVG icon
  createExternalLink(href, slug, urlPrefix) {
    const link = document.createElement('a');
    link.setAttribute('open', '');
    link.href = `/${urlPrefix}/${slug}`;
    link.target = '_blank';
    link.className = 'open-in-new-tab w-inline-block';
    link.innerHTML = this.getSVGIcon('external');
    return link;
  },

  // Standardized SVG icons
  getSVGIcon(type) {
    const icons = {
      external: '<svg xmlns="http://www.w3.org/2000/svg" id="Layer_1" viewBox="0 0 151.49 151.49" width="100%" fill="currentColor" class="svg-3"><polygon class="cls-1" points="151.49 0 151.49 151.49 120.32 151.49 120.32 53.21 22.04 151.49 0 129.45 98.27 31.17 0 31.17 0 0 151.49 0"></polygon></svg>'
    };
    return icons[type] || '';
  },

  // Standardized loading states
  createLoadingState(message = 'Loading...') {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 10px; opacity: 0.6;';
    div.textContent = message;
    return div;
  },

  // Standardized container clearing
  clearContainer(container) {
    if (container) {
      container.innerHTML = '';
    }
  },

  // Standardized count elements
  createCountElement(initialValue = '0') {
    const countWrapper = document.createElement('div');
    countWrapper.className = 'div-block-31834';
    const countElement = document.createElement('div');
    countElement.setAttribute('fs-list-element', 'facet-count');
    countElement.className = 'test33';
    countElement.textContent = initialValue;
    countWrapper.appendChild(countElement);
    return countWrapper;
  },

  // Standardized checkbox input creation
  createCheckboxInput(config) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = config.name;
    checkbox.setAttribute('data-name', config.name);
    checkbox.setAttribute('fs-list-value', config.value);
    checkbox.setAttribute('fs-list-field', config.fieldName);
    checkbox.id = config.id;
    checkbox.style.cssText = 'opacity: 0; position: absolute; z-index: -1;';
    
    // Add optional attributes
    if (config.autoSidebar) checkbox.setAttribute('data-auto-sidebar', 'true');
    if (config.filterIndicator) checkbox.setAttribute('activate-filter-indicator', config.filterIndicator);
    
    return checkbox;
  }
};

// ========================
// CHECKBOX FACTORY (Deduplication)
// ========================
const CheckboxFactory = {
  // Create standardized checkbox HTML structure
  createCheckboxElement(name, type, properties) {
    const pluralType = type === 'locality' ? 'localities' : 'settlements';
    const urlPrefix = type === 'settlement' ? 'settlement' : 'locality';
    const fieldName = type.charAt(0).toUpperCase() + type.slice(1);
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '-');
    const slug = properties.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Create wrapper
    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.setAttribute('checkbox-filter', type);
    checkboxWrapper.className = 'checbox-item';
    
    const label = document.createElement('label');
    label.className = 'w-checkbox reporterwrap-copy';
    
    // Create external link using DOMFactory
    const link = DOMFactory.createExternalLink(null, slug, urlPrefix);
    
    // Create checkbox input wrapper
    const checkboxInputWrapper = document.createElement('div');
    checkboxInputWrapper.className = 'w-checkbox-input w-checkbox-input--inputType-custom toggleable';
    
    // Create checkbox input using DOMFactory
    const checkbox = DOMFactory.createCheckboxInput({
      name: type,
      value: name,
      fieldName: fieldName,
      id: `${pluralType}-${cleanName}`,
      autoSidebar: true,
      filterIndicator: 'place'
    });
    
    // Create label text
    const labelText = document.createElement('span');
    labelText.className = 'test3 w-form-label';
    labelText.setAttribute('for', checkbox.id);
    labelText.textContent = name;
    
    // Create count wrapper using DOMFactory
    const countWrapper = DOMFactory.createCountElement();
    
    // Assemble structure
    label.appendChild(link);
    label.appendChild(checkboxInputWrapper);
    label.appendChild(checkbox);
    label.appendChild(labelText);
    label.appendChild(countWrapper);
    checkboxWrapper.appendChild(label);
    
    return checkboxWrapper;
  },
  
  // Generic bulk generation function
  generateBulkCheckboxes(containerId, features, type, stateName) {
    if (LazyCheckboxState.isFullyGenerated(type)) {
      return Promise.resolve();
    }
    
    const container = document.getElementById(containerId);
    if (!container) return Promise.resolve();
    
    return new Promise((resolve) => {
      const generate = () => {
        try {
          // Clear and reset using DOMFactory
          DOMFactory.clearContainer(container);
          LazyCheckboxState.clearType(type);
          
          // Extract unique features
          const uniqueFeatures = [];
          const seenNames = new Set();
          
          features.forEach(feature => {
            if (feature?.properties?.name) {
              const name = feature.properties.name.trim();
              if (name && !seenNames.has(name)) {
                seenNames.add(name);
                uniqueFeatures.push(feature);
              }
            }
          });
          
          // Sort alphabetically
          uniqueFeatures.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
          
          // Generate using document fragment
          const fragment = document.createDocumentFragment();
          
          uniqueFeatures.forEach(feature => {
            const name = feature.properties.name;
            const checkboxElement = this.createCheckboxElement(name, type, feature.properties);
            fragment.appendChild(checkboxElement);
            LazyCheckboxState.addCheckbox(name, type);
          });
          
          // Single DOM insertion
          container.appendChild(fragment);
          
          LazyCheckboxState.markFullyGenerated(type);
          resolve();
        } catch (error) {
          const recovery = ErrorHandler.handle(error, ErrorHandler.categories.GENERATION, {
            operation: `generateAll${type.charAt(0).toUpperCase() + type.slice(1)}Checkboxes`,
            type: type,
            container: container?.id
          });
          
          if (recovery.recovered) {
            // Continue with partial generation
          }
          resolve();
        }
      };
      
      // Generate during idle time for non-blocking performance
      IdleExecution.scheduleHeavy(generate, { timeout: 2000, fallbackDelay: 100 });
    });
  }
};

// Make factories globally available
window.DOMFactory = DOMFactory;
window.CheckboxFactory = CheckboxFactory;
window.loadingTracker = loadingTracker;