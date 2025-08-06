document.addEventListener('DOMContentLoaded', function() {
    // Find all unique group names
    const allInputs = document.querySelectorAll('input[cms-id-group]');
    const groups = new Set();
    allInputs.forEach(input => groups.add(input.getAttribute('cms-id-group')));
    
    // Track checkbox selection order for each group
    const checkboxOrders = {};
    // Track previously selected radio buttons for unchecking
    const previousRadioSelections = {};
    // Track which radios were triggered by others (to prevent infinite loops)
    const triggeredRadios = new WeakSet();
    
    // Function to handle cascading triggers
    function handleCascadingTriggers(radio, isChecking) {
        // Get all trigger attributes from the radio
        const attributes = radio.attributes;
        const triggers = [];
        
        for (let i = 0; i < attributes.length; i++) {
            const attr = attributes[i];
            if (attr.name.startsWith('trigger-')) {
                const triggerType = attr.name.replace('trigger-', '');
                const triggerValue = attr.value;
                if (triggerValue) { // Only process non-empty trigger values
                    triggers.push({ type: triggerType, value: triggerValue });
                }
            }
        }
        
        // Process each trigger
        triggers.forEach(trigger => {
            // Find radios with matching choice-type and choice-name
            const targetRadios = document.querySelectorAll(
                `input[choice-type="${trigger.type}"][choice-name="${trigger.value}"]`
            );
            
            targetRadios.forEach(targetRadio => {
                // Skip if this radio is already in the desired state
                if (targetRadio.checked === isChecking) return;
                
                // Temporarily mark as triggered to prevent infinite loops
                const wasTriggered = triggeredRadios.has(targetRadio);
                if (!wasTriggered) {
                    triggeredRadios.add(targetRadio);
                }
                
                if (isChecking) {
                    const targetGroup = targetRadio.getAttribute('cms-id-group');
                    
                    // First, uncheck any other radio in the same group and remove visual state
                    const otherRadiosInGroup = document.querySelectorAll(`input[cms-id-group="${targetGroup}"]:checked`);
                    otherRadiosInGroup.forEach(otherRadio => {
                        if (otherRadio !== targetRadio) {
                            otherRadio.checked = false;
                            // Remove visual state from the other radio
                            const otherVisual = otherRadio.parentElement.querySelector('.w-radio-input');
                            if (otherVisual) {
                                otherVisual.classList.remove('w--redirected-checked');
                            }
                        }
                    });
                    
                    // Also remove visual state from any unchecked radios that still have it
                    const allRadiosInGroup = document.querySelectorAll(`input[cms-id-group="${targetGroup}"]`);
                    allRadiosInGroup.forEach(radio => {
                        if (radio !== targetRadio && !radio.checked) {
                            const visual = radio.parentElement.querySelector('.w-radio-input');
                            if (visual) {
                                visual.classList.remove('w--redirected-checked');
                            }
                        }
                    });
                    
                    // Check the target radio
                    targetRadio.checked = true;
                    // Update the tracking for unchecking
                    previousRadioSelections[targetGroup] = targetRadio;
                    
                    // Update Webflow's visual checked class
                    const visualElement = targetRadio.parentElement.querySelector('.w-radio-input');
                    if (visualElement) {
                        visualElement.classList.add('w--redirected-checked');
                    }
                } else {
                    // Uncheck the target radio
                    targetRadio.checked = false;
                    const targetGroup = targetRadio.getAttribute('cms-id-group');
                    if (previousRadioSelections[targetGroup] === targetRadio) {
                        previousRadioSelections[targetGroup] = null;
                    }
                    
                    // Remove Webflow's visual checked class
                    const visualElement = targetRadio.parentElement.querySelector('.w-radio-input, .w--redirected-checked');
                    if (visualElement) {
                        visualElement.classList.remove('w--redirected-checked');
                    }
                }
                
                // Update the group's hidden fields
                const targetGroup = targetRadio.getAttribute('cms-id-group');
                updateRadioGroupFields(targetGroup);
                
                // Recursively handle triggers from this radio (if not already triggered)
                if (!wasTriggered) {
                    handleCascadingTriggers(targetRadio, isChecking);
                    triggeredRadios.delete(targetRadio);
                }
            });
        });
    }
    
    // Function to update radio group hidden fields
    function updateRadioGroupFields(groupName) {
        const selected = document.querySelector(`input[cms-id-group="${groupName}"]:checked`);
        const idField = document.querySelector(`input[id-input="${groupName}"]`);
        const nameField = document.querySelector(`[name-input="${groupName}"]`);
        
        if (idField) idField.value = selected ? selected.getAttribute('choice-id') : '';
        if (nameField) {
            const nameValue = selected ? selected.getAttribute('choice-name') : '';
            if (nameField.tagName === 'INPUT') {
                nameField.value = nameValue;
            } else {
                nameField.textContent = nameValue;
            }
        }
    }
    
    // Set up each group
    groups.forEach(groupName => {
        const groupInputs = document.querySelectorAll(`input[cms-id-group="${groupName}"]`);
        const idField = document.querySelector(`input[id-input="${groupName}"]`);
        const nameField = document.querySelector(`[name-input="${groupName}"]`);
        
        if (!groupInputs.length) return;
        
        const isCheckbox = groupInputs[0].type === 'checkbox';
        
        if (isCheckbox) {
            // Initialize selection order for this checkbox group
            checkboxOrders[groupName] = [];
            
            function updateCheckboxGroup() {
                const selectedIds = [];
                const selectedNames = [];
                
                checkboxOrders[groupName].forEach(input => {
                    if (input.checked) {
                        selectedIds.push(input.getAttribute('choice-id'));
                        selectedNames.push(input.getAttribute('choice-name'));
                    }
                });
                
                if (idField) {
                    if (selectedIds.length === 1) {
                        idField.value = selectedIds[0];
                    } else {
                        idField.value = selectedIds.map(id => `"${id}"`).join(',');
                    }
                }
                if (nameField) {
                    if (nameField.tagName === 'INPUT') {
                        nameField.value = selectedNames.join(' & ');
                    } else {
                        nameField.textContent = selectedNames.join(' & ');
                    }
                }
            }
            
            groupInputs.forEach(input => {
                input.addEventListener('change', function() {
                    if (this.checked) {
                        checkboxOrders[groupName].push(this);
                    } else {
                        checkboxOrders[groupName] = checkboxOrders[groupName].filter(cb => cb !== this);
                    }
                    updateCheckboxGroup();
                });
            });
            
        } else {
            // Radio button group - allow unchecking
            function updateRadioGroup() {
                const selected = document.querySelector(`input[cms-id-group="${groupName}"]:checked`);
                if (idField) idField.value = selected ? selected.getAttribute('choice-id') : '';
                if (nameField) {
                    const nameValue = selected ? selected.getAttribute('choice-name') : '';
                    if (nameField.tagName === 'INPUT') {
                        nameField.value = nameValue;
                    } else {
                        nameField.textContent = nameValue;
                    }
                }
            }
            
            groupInputs.forEach(input => {
                input.addEventListener('click', function() {
                    const wasChecked = previousRadioSelections[groupName] === this;
                    
                    // If this radio was already selected, uncheck it
                    if (wasChecked) {
                        this.checked = false;
                        previousRadioSelections[groupName] = null;
                        
                        // Remove Webflow's visual checked class
                        const visualElement = this.parentElement.querySelector('.w-radio-input, .w--redirected-checked');
                        if (visualElement) {
                            visualElement.classList.remove('w--redirected-checked');
                        }
                        
                        // Handle cascading unchecks
                        handleCascadingTriggers(this, false);
                    } else {
                        // If there was a different radio selected in this group, cascade uncheck it first
                        if (previousRadioSelections[groupName] && previousRadioSelections[groupName] !== this) {
                            const previousRadio = previousRadioSelections[groupName];
                            // Trigger cascade uncheck for the previously selected radio
                            handleCascadingTriggers(previousRadio, false);
                        }
                        
                        // New selection - update tracking
                        previousRadioSelections[groupName] = this;
                        
                        // Handle cascading checks
                        handleCascadingTriggers(this, true);
                    }
                    
                    updateRadioGroup();
                });
            });
        }
    });
    
    // Set up clear buttons
    const clearButtons = document.querySelectorAll('[clear-choices]');
    clearButtons.forEach(clearButton => {
        clearButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            const groupToClear = this.getAttribute('clear-choices');
            const groupInputs = document.querySelectorAll(`input[cms-id-group="${groupToClear}"]`);
            
            if (!groupInputs.length) return;
            
            const isCheckbox = groupInputs[0].type === 'checkbox';
            
            if (isCheckbox) {
                // Clear all checkboxes in the group
                groupInputs.forEach(input => {
                    if (input.checked) {
                        input.checked = false;
                        // Remove from checkbox order tracking
                        checkboxOrders[groupToClear] = checkboxOrders[groupToClear].filter(cb => cb !== input);
                    }
                    
                    // Remove visual state for all checkboxes
                    const visualElement = input.parentElement.querySelector('.w-checkbox-input');
                    if (visualElement) {
                        visualElement.classList.remove('w--redirected-checked');
                    }
                });
                
                // Update the hidden fields
                const idField = document.querySelector(`input[id-input="${groupToClear}"]`);
                const nameField = document.querySelector(`[name-input="${groupToClear}"]`);
                if (idField) idField.value = '';
                if (nameField) {
                    if (nameField.tagName === 'INPUT') {
                        nameField.value = '';
                    } else {
                        nameField.textContent = '';
                    }
                }
            } else {
                // Clear radio group
                const selectedRadio = document.querySelector(`input[cms-id-group="${groupToClear}"]:checked`);
                
                if (selectedRadio) {
                    // Handle cascading unchecks first
                    handleCascadingTriggers(selectedRadio, false);
                    
                    // Uncheck the radio
                    selectedRadio.checked = false;
                    previousRadioSelections[groupToClear] = null;
                    
                    // Remove visual state
                    const visualElement = selectedRadio.parentElement.querySelector('.w-radio-input, .w--redirected-checked');
                    if (visualElement) {
                        visualElement.classList.remove('w--redirected-checked');
                    }
                    
                    // Clean up any stray visual states in the group
                    groupInputs.forEach(input => {
                        const visual = input.parentElement.querySelector('.w-radio-input');
                        if (visual) {
                            visual.classList.remove('w--redirected-checked');
                        }
                    });
                    
                    // Update the hidden fields
                    updateRadioGroupFields(groupToClear);
                }
            }
        });
    });
    
    // Handle form submission
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function(e) {
            // Update all groups to ensure data is current
            groups.forEach(groupName => {
                const groupInputs = document.querySelectorAll(`input[cms-id-group="${groupName}"]`);
                const idField = document.querySelector(`input[id-input="${groupName}"]`);
                const nameField = document.querySelector(`[name-input="${groupName}"]`);
                
                if (!groupInputs.length) return;
                
                if (groupInputs[0].type === 'checkbox') {
                    const selectedIds = [];
                    const selectedNames = [];
                    
                    checkboxOrders[groupName].forEach(input => {
                        if (input.checked) {
                            selectedIds.push(input.getAttribute('choice-id'));
                            selectedNames.push(input.getAttribute('choice-name'));
                        }
                    });
                    
                    if (idField) {
                        if (selectedIds.length === 1) {
                            idField.value = selectedIds[0];
                        } else {
                            idField.value = selectedIds.map(id => `"${id}"`).join(',');
                        }
                    }
                    if (nameField) {
                        const nameValue = selectedNames.join(' & ');
                        if (nameField.tagName === 'INPUT') {
                            nameField.value = nameValue;
                        } else {
                            nameField.textContent = nameValue;
                        }
                    }
                } else {
                    const selected = document.querySelector(`input[cms-id-group="${groupName}"]:checked`);
                    if (idField) idField.value = selected ? selected.getAttribute('choice-id') : '';
                    if (nameField) {
                        const nameValue = selected ? selected.getAttribute('choice-name') : '';
                        if (nameField.tagName === 'INPUT') {
                            nameField.value = nameValue;
                        } else {
                            nameField.textContent = nameValue;
                        }
                    }
                }
            });
        });
    }
});
