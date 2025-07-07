// Checkbox Group Filter for Finsweet List Filter 2025
// Add this script before the closing </body> tag

(function() {
  'use strict';
  
  // Wait for DOM to be fully loaded
  document.addEventListener('DOMContentLoaded', function() {
    initializeCheckboxFilters();
  });
  
  function initializeCheckboxFilters() {
    // Get all search input elements with searchbox-filter attribute
    const searchBoxes = document.querySelectorAll('[searchbox-filter]');
    
    if (searchBoxes.length === 0) {
      console.warn('No search boxes found with searchbox-filter attribute');
      return;
    }
    
    // Add event listeners to each search box
    searchBoxes.forEach(function(searchBox) {
      const groupName = searchBox.getAttribute('searchbox-filter');
      
      if (!groupName) {
        console.warn('Search box found without group name:', searchBox);
        return;
      }
      
      // Add input event listener with debounce
      let debounceTimer;
      searchBox.addEventListener('input', function(e) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          filterCheckboxGroup(groupName, e.target.value);
        }, 200); // 200ms debounce
      });
      
      // Initialize - show all checkboxes for this group (if any exist)
      filterCheckboxGroup(groupName, '');
    });
    
    // Initialize clear buttons
    initializeClearButtons();
  }
  
  function initializeClearButtons() {
    // Get all clear button elements with clear-text-input attribute
    const clearButtons = document.querySelectorAll('[clear-text-input]');
    
    if (clearButtons.length === 0) {
      console.log('No clear buttons found with clear-text-input attribute');
      return;
    }
    
    // Add event listeners to each clear button
    clearButtons.forEach(function(clearButton) {
      const groupName = clearButton.getAttribute('clear-text-input');
      
      if (!groupName) {
        console.warn('Clear button found without group name:', clearButton);
        return;
      }
      
      // Add click event listener
      clearButton.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent default link behavior
        clearTextInput(groupName);
      });
    });
  }
  
  function clearTextInput(groupName) {
    // Find the search input for this group
    const searchInput = document.querySelector('[searchbox-filter="' + groupName + '"]');
    
    if (!searchInput) {
      console.warn('No search input found for group:', groupName);
      return;
    }
    
    // Clear the input value
    searchInput.value = '';
    
    // Check if there are checkboxes for this group
    const checkboxElements = document.querySelectorAll('[checkbox-filter="' + groupName + '"]');
    
    // If checkboxes exist for this group, use the checkbox filtering
    if (checkboxElements.length > 0) {
      filterCheckboxGroup(groupName, '');
    } else {
      // If no checkboxes, trigger Finsweet List Filter to update
      // by dispatching an input event on the search input
      const inputEvent = new Event('input', {
        bubbles: true,
        cancelable: true
      });
      searchInput.dispatchEvent(inputEvent);
    }
    
    // Optional: Focus back on the search input for better UX
    searchInput.focus();
  }
  
  function filterCheckboxGroup(groupName, searchTerm) {
    // Get all checkbox containers for this group
    const checkboxElements = document.querySelectorAll('[checkbox-filter="' + groupName + '"]');
    
    if (checkboxElements.length === 0) {
      // Don't warn if no checkboxes - this is now an acceptable use case
      return;
    }
    
    // Normalize search term
    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    
    checkboxElements.forEach(function(checkboxElement) {
      // Find the label text within this checkbox element
      const labelText = getCheckboxLabelText(checkboxElement);
      
      if (!labelText) {
        console.warn('Could not find label text for checkbox:', checkboxElement);
        return;
      }
      
      // Check if label text matches search term
      const normalizedLabelText = labelText.toLowerCase();
      const isMatch = normalizedLabelText.includes(normalizedSearchTerm);
      
      // Show/hide the checkbox element
      if (isMatch || normalizedSearchTerm === '') {
        showElement(checkboxElement);
      } else {
        hideElement(checkboxElement);
      }
    });
  }
  
  function getCheckboxLabelText(checkboxElement) {
    // Try different selectors to find the label text
    let labelText = '';
    
    // Method 1: Look for .w-form-label within the container
    const formLabel = checkboxElement.querySelector('.w-form-label');
    if (formLabel) {
      labelText = formLabel.textContent || formLabel.innerText;
    }
    
    // Method 2: Look for any label element within the container
    if (!labelText) {
      const label = checkboxElement.querySelector('label');
      if (label) {
        labelText = label.textContent || label.innerText;
      }
    }
    
    // Method 3: Look for checkbox input and its associated label
    if (!labelText) {
      const checkboxInput = checkboxElement.querySelector('input[type="checkbox"]');
      if (checkboxInput) {
        // Look for sibling label
        const siblingLabel = checkboxInput.nextElementSibling;
        if (siblingLabel && siblingLabel.tagName === 'LABEL') {
          labelText = siblingLabel.textContent || siblingLabel.innerText;
        }
        // Or look for label that references this input
        if (!labelText && checkboxInput.id) {
          const associatedLabel = document.querySelector('label[for="' + checkboxInput.id + '"]');
          if (associatedLabel) {
            labelText = associatedLabel.textContent || associatedLabel.innerText;
          }
        }
      }
    }
    
    // Method 4: Get all text content as fallback, but exclude hidden content
    if (!labelText) {
      const textContent = checkboxElement.textContent || checkboxElement.innerText;
      labelText = textContent.replace(/\s+/g, ' '); // Clean up whitespace
    }
    
    return labelText ? labelText.trim() : '';
  }
  
  function hideElement(element) {
    element.style.display = 'none';
    element.setAttribute('data-filtered', 'hidden');
  }
  
  function showElement(element) {
    element.style.display = '';
    element.removeAttribute('data-filtered');
  }
  
})();
