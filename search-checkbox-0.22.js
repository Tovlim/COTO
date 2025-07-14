// Real-time Checkbox Group Filter for Finsweet List Filter 2025
// Add this script before the closing </body> tag

(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    SELECTORS: {
      SEARCH_BOX: '[searchbox-filter]',
      CLEAR_BUTTON: '[clear-text-input]',
      CHECKBOX: '[checkbox-filter]',
      FORM_LABEL: '.w-form-label',
      LABEL: 'label',
      CHECKBOX_INPUT: 'input[type="checkbox"]'
    }
  };
  
  // Cache for DOM elements
  const cache = {
    searchBoxes: new Map(),
    clearButtons: new Map(),
    checkboxGroups: new Map()
  };
  
  // Utility functions
  const utils = {
    normalizeText(text) {
      return text.toLowerCase().trim();
    },
    
    createInputEvent() {
      return new Event('input', { bubbles: true, cancelable: true });
    }
  };
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', initializeFilters);
  
  function initializeFilters() {
    cacheElements();
    bindEventListeners();
    initializeGroups();
  }
  
  function cacheElements() {
    // Cache search boxes
    document.querySelectorAll(CONFIG.SELECTORS.SEARCH_BOX).forEach(element => {
      const groupName = element.getAttribute('searchbox-filter');
      if (groupName) {
        cache.searchBoxes.set(groupName, element);
      }
    });
    
    // Cache clear buttons
    document.querySelectorAll(CONFIG.SELECTORS.CLEAR_BUTTON).forEach(element => {
      const groupName = element.getAttribute('clear-text-input');
      if (groupName) {
        cache.clearButtons.set(groupName, element);
      }
    });
    
    // Cache checkbox groups
    const groupedCheckboxes = {};
    document.querySelectorAll(CONFIG.SELECTORS.CHECKBOX).forEach(element => {
      const groupName = element.getAttribute('checkbox-filter');
      if (groupName) {
        if (!groupedCheckboxes[groupName]) {
          groupedCheckboxes[groupName] = [];
        }
        groupedCheckboxes[groupName].push(element);
      }
    });
    
    // Convert to Map for better performance
    Object.entries(groupedCheckboxes).forEach(([groupName, elements]) => {
      cache.checkboxGroups.set(groupName, elements);
    });
  }
  
  function bindEventListeners() {
    // Bind search box events - now with immediate filtering
    cache.searchBoxes.forEach((searchBox, groupName) => {
      searchBox.addEventListener('input', (e) => {
        filterCheckboxGroup(groupName, e.target.value);
      });
    });
    
    // Bind clear button events
    cache.clearButtons.forEach((clearButton, groupName) => {
      clearButton.addEventListener('click', (e) => {
        e.preventDefault();
        clearTextInput(groupName);
      });
    });
  }
  
  function initializeGroups() {
    // Initialize all groups to show all checkboxes
    cache.checkboxGroups.forEach((_, groupName) => {
      filterCheckboxGroup(groupName, '');
    });
  }
  
  function clearTextInput(groupName) {
    const searchInput = cache.searchBoxes.get(groupName);
    
    if (!searchInput) {
      return;
    }
    
    // Clear the input value
    searchInput.value = '';
    
    // Check if this group has checkboxes
    const hasCheckboxes = cache.checkboxGroups.has(groupName);
    
    if (hasCheckboxes) {
      // Use checkbox filtering for groups with checkboxes
      filterCheckboxGroup(groupName, '');
    } else {
      // Trigger Finsweet List Filter for standalone inputs
      searchInput.dispatchEvent(utils.createInputEvent());
    }
    
    // Focus back on input for better UX
    searchInput.focus();
  }
  
  function filterCheckboxGroup(groupName, searchTerm) {
    const checkboxElements = cache.checkboxGroups.get(groupName);
    
    if (!checkboxElements) {
      return; // No checkboxes for this group (acceptable for standalone inputs)
    }
    
    const normalizedSearchTerm = utils.normalizeText(searchTerm);
    const showAll = normalizedSearchTerm === '';
    
    // Use requestAnimationFrame for better performance with many elements
    requestAnimationFrame(() => {
      checkboxElements.forEach(element => {
        if (showAll) {
          showElement(element);
        } else {
          const labelText = getCheckboxLabelText(element);
          const isMatch = labelText && utils.normalizeText(labelText).includes(normalizedSearchTerm);
          
          if (isMatch) {
            showElement(element);
          } else {
            hideElement(element);
          }
        }
      });
    });
  }
  
  function getCheckboxLabelText(checkboxElement) {
    // Try multiple methods to find label text, prioritizing most common cases
    const methods = [
      () => checkboxElement.querySelector(CONFIG.SELECTORS.FORM_LABEL)?.textContent,
      () => checkboxElement.querySelector(CONFIG.SELECTORS.LABEL)?.textContent,
      () => {
        const input = checkboxElement.querySelector(CONFIG.SELECTORS.CHECKBOX_INPUT);
        if (!input) return null;
        
        // Try sibling label
        const sibling = input.nextElementSibling;
        if (sibling?.tagName === 'LABEL') {
          return sibling.textContent;
        }
        
        // Try associated label by ID
        if (input.id) {
          return document.querySelector(`label[for="${input.id}"]`)?.textContent;
        }
        
        return null;
      },
      () => checkboxElement.textContent?.replace(/\s+/g, ' ') // Fallback to all text content
    ];
    
    for (const method of methods) {
      const text = method();
      if (text?.trim()) {
        return text.trim();
      }
    }
    
    return '';
  }
  
  function hideElement(element) {
    if (element.style.display !== 'none') {
      element.style.display = 'none';
      element.setAttribute('data-filtered', 'hidden');
    }
  }
  
  function showElement(element) {
    if (element.style.display === 'none') {
      element.style.display = '';
      element.removeAttribute('data-filtered');
    }
  }
  
})();
