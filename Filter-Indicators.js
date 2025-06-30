// Filter Indicator System for Finsweet List Filter
// This script manages showing/hiding filter indicators based on form interactions

function initFilterIndicators() {
  // Find all elements with activate-filter-indicator attribute
  const activators = document.querySelectorAll('[activate-filter-indicator]');
  
  // Find Flatpickr altInputs that correspond to activators
  const flatpickrAltInputs = [];
  activators.forEach(activator => {
    // Check if this is a Flatpickr input (has data-flatpickr or is hidden with flatpickr-input class)
    if (activator.hasAttribute('data-flatpickr') || activator.classList.contains('flatpickr-input')) {
      // Find the corresponding altInput (visible text input without activate-filter-indicator)
      const altInput = activator.parentElement.querySelector('input[type="text"]:not([activate-filter-indicator])');
      if (altInput) {
        // Store reference to both inputs
        flatpickrAltInputs.push({
          original: activator,
          altInput: altInput,
          groupName: activator.getAttribute('activate-filter-indicator')
        });
      }
    }
  });
  
  // Function to toggle indicators for a specific group
  function toggleIndicators(groupName, shouldShow) {
    const indicators = document.querySelectorAll(`[filter-indicator="${groupName}"]`);
    
    indicators.forEach(indicator => {
      if (shouldShow) {
        indicator.style.display = 'flex';
      } else {
        indicator.style.display = 'none';
      }
    });
  }
  
  // Function to check if any activator in a group has changed from default
  function hasActiveFilters(groupName) {
    const groupActivators = document.querySelectorAll(`[activate-filter-indicator="${groupName}"]`);
    
    return Array.from(groupActivators).some(activator => {
      const tagName = activator.tagName.toLowerCase();
      const type = activator.type ? activator.type.toLowerCase() : '';
      
      // Special handling for Flatpickr inputs
      if (activator.hasAttribute('data-flatpickr') || activator.classList.contains('flatpickr-input')) {
        // For Flatpickr, check the hidden input's value (which contains the actual date)
        return activator.value.trim() !== '';
      }
      
      // Check different input types for changes from default
      if (tagName === 'input') {
        if (type === 'checkbox' || type === 'radio') {
          // For checkboxes/radio: checked = active (default is unchecked)
          return activator.checked;
        } else if (type === 'text' || type === 'search' || type === 'email' || !type) {
          // For text inputs: any content = active (default is empty)
          return activator.value.trim() !== '';
        }
      } else if (tagName === 'select') {
        // For selects: any option other than first = active
        return activator.selectedIndex > 0;
      } else if (tagName === 'textarea') {
        // For textareas: any content = active (default is empty)
        return activator.value.trim() !== '';
      }
      
      return false;
    });
  }
  
  // Function to handle form element changes
  function handleActivatorChange(event) {
    const activator = event.target;
    const groupName = activator.getAttribute('activate-filter-indicator');
    
    if (!groupName) return;
    
    // Check if any activator in this group is active
    const shouldShow = hasActiveFilters(groupName);
    
    // Toggle indicators for this group
    toggleIndicators(groupName, shouldShow);
  }
  
  // Add event listeners to all activators
  activators.forEach(activator => {
    const tagName = activator.tagName.toLowerCase();
    const type = activator.type ? activator.type.toLowerCase() : '';
    
    // Special handling for Flatpickr inputs
    if (activator.hasAttribute('data-flatpickr') || activator.classList.contains('flatpickr-input')) {
      // For Flatpickr, we need to listen to the hidden input's change event
      // Flatpickr triggers change events on the original input when dates are selected
      activator.addEventListener('change', handleActivatorChange);
      return; // Skip regular input handling
    }
    
    // Add specific event listeners based on element type
    if (tagName === 'input') {
      if (type === 'checkbox' || type === 'radio') {
        // For checkboxes/radio: trigger on check/uncheck
        activator.addEventListener('change', handleActivatorChange);
      } else if (type === 'text' || type === 'search' || type === 'email' || !type) {
        // For text inputs: trigger on typing and blur
        activator.addEventListener('input', handleActivatorChange);
        activator.addEventListener('blur', handleActivatorChange);
      }
    } else if (tagName === 'select') {
      // For selects: trigger on selection change
      activator.addEventListener('change', handleActivatorChange);
    } else if (tagName === 'textarea') {
      // For textareas: trigger on typing and blur
      activator.addEventListener('input', handleActivatorChange);
      activator.addEventListener('blur', handleActivatorChange);
    }
  });
  
  // Add event listeners to Flatpickr altInputs for immediate feedback
  flatpickrAltInputs.forEach(({original, altInput, groupName}) => {
    // Listen to the altInput for immediate visual feedback
    altInput.addEventListener('input', () => {
      // Trigger the same handler but pass the original input
      handleActivatorChange({target: original});
    });
    
    // Also listen for blur events on altInput
    altInput.addEventListener('blur', () => {
      handleActivatorChange({target: original});
    });
  });
  
  // Initial setup - ensure all indicators start hidden since no filters are active by default
  const allGroups = new Set(
    Array.from(activators).map(el => el.getAttribute('activate-filter-indicator'))
  );
  
  allGroups.forEach(groupName => {
    if (groupName) {
      // Check if any activators in this group are already active (e.g., pre-filled forms)
      const shouldShow = hasActiveFilters(groupName);
      toggleIndicators(groupName, shouldShow);
    }
  });
}

// Run immediately when page loads - no waiting for DOMContentLoaded
initFilterIndicators();

// Optional: Re-initialize if Finsweet List Filter resets the form
// Uncomment if you need this functionality
/*
window.addEventListener('listFilterReset', function() {
  // Small delay to ensure form is reset
  setTimeout(initFilterIndicators, 100);
});
*/
