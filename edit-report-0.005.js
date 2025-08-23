// Edit Report Script - Maps CMS report data to form fields
// Version: 1.0.0
// Handles dynamic report loading and form population

(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    EDIT_BUTTON_SELECTOR: '[edit-report="true"]',
    REPORT_ITEM_SELECTOR: '.report-item, .w-dyn-item, [wfu-lightbox-group]',
    FORM_SELECTOR: 'form[test-attribute="test"]',
    DEBUG: true // Set to true for console logging
  };
  
  // State management
  let isInitialized = false;
  let currentEditingReport = null;
  
  // Utility functions
  const log = (...args) => {
    if (CONFIG.DEBUG) console.log('[Edit Report]', ...args);
  };
  
  // Get the closest parent report item from an element
  function getReportItem(element) {
    return element.closest(CONFIG.REPORT_ITEM_SELECTOR);
  }
  
  // Extract all data-report-* attributes from an element
  function extractReportData(reportItem) {
    const reportData = {};
    
    // Get all attributes
    const attributes = reportItem.attributes;
    
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      // Check if attribute starts with 'data-report-'
      if (attr.name.startsWith('data-report-')) {
        // Remove 'data-report-' prefix to get the field name
        const fieldName = attr.name.replace('data-report-', '');
        reportData[fieldName] = attr.value;
      }
    }
    
    // Extract image URLs from lightbox images
    const imageUrls = extractImageUrls(reportItem);
    if (imageUrls.length > 0) {
      reportData.images = imageUrls;
    }
    
    // Extract video URLs from iframes
    const videoUrls = extractVideoUrls(reportItem);
    if (videoUrls.length > 0) {
      reportData.videos = videoUrls;
    }
    
    // Extract numbered rich text content
    const richTextContents = extractNumberedRichTexts(reportItem);
    if (richTextContents && Object.keys(richTextContents).length > 0) {
      reportData.richtexts = richTextContents;
    }
    
    log('Extracted report data:', reportData);
    return reportData;
  }
  
  // Extract image URLs from report item
  function extractImageUrls(reportItem) {
    const imageUrls = [];
    
    // Look for lightbox images (excluding placeholders and opener links)
    const lightboxImages = reportItem.querySelectorAll('a[lightbox-image] img');
    
    lightboxImages.forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      // Skip placeholder images
      if (src && !src.includes('placeholder') && !src.includes('w-dyn-bind-empty')) {
        // Get the parent anchor element
        const parentLink = img.closest('a[lightbox-image]');
        
        // Skip images that have lightbox-image="open" (these are opener links, not actual images)
        if (parentLink && parentLink.getAttribute('lightbox-image') === 'open') {
          log('Skipping opener image:', src);
          return;
        }
        
        // Get the full-size image from the parent anchor's href if available
        const fullSizeUrl = parentLink ? parentLink.getAttribute('href') : src;
        
        if (fullSizeUrl && fullSizeUrl !== '#' && !imageUrls.includes(fullSizeUrl)) {
          imageUrls.push(fullSizeUrl);
        }
      }
    });
    
    log('Extracted image URLs:', imageUrls);
    return imageUrls;
  }
  
  // Extract video URLs from iframes
  function extractVideoUrls(reportItem) {
    const videoUrls = [];
    
    // Look for video iframes
    const iframes = reportItem.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[data-src*="youtube"], iframe[data-src*="vimeo"]');
    
    iframes.forEach(iframe => {
      const src = iframe.src || iframe.getAttribute('data-src');
      if (src && src !== '' && !videoUrls.includes(src)) {
        videoUrls.push(src);
      }
    });
    
    // Also check for video wrapper elements with specific attributes if needed
    const videoWrappers = reportItem.querySelectorAll('[data-video-url]');
    videoWrappers.forEach(wrapper => {
      const url = wrapper.getAttribute('data-video-url');
      if (url && !videoUrls.includes(url)) {
        videoUrls.push(url);
      }
    });
    
    log('Extracted video URLs:', videoUrls);
    return videoUrls;
  }
  
  // Extract numbered rich text content
  function extractNumberedRichTexts(reportItem) {
    const richTexts = {};
    
    // More flexible selector - look for any element with data-report-richtext-N attribute
    const allElements = reportItem.querySelectorAll('*');
    
    allElements.forEach(element => {
      // Check each element's attributes
      const attributes = element.attributes;
      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];
        // Check if this is a richtext source attribute
        if (attr.name.startsWith('data-report-richtext-') && attr.value === 'source') {
          const match = attr.name.match(/data-report-richtext-(\d+)/);
          if (match) {
            const number = match[1];
            // Store raw HTML instead of plain text for Quill
            richTexts[number] = element.innerHTML;
            log(`Extracted rich text ${number} (HTML):`, element.innerHTML.substring(0, 100) + '...');
          }
        }
      }
    });
    
    log('All extracted rich texts:', richTexts);
    return richTexts;
  }
  
  // Convert HTML to plain text suitable for textarea
  function htmlToPlainText(html) {
    // Create a temporary element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Replace <br> tags with newlines
    temp.querySelectorAll('br').forEach(br => {
      br.replaceWith('\n');
    });
    
    // Replace </p> tags with double newlines (except the last one)
    const paragraphs = temp.querySelectorAll('p');
    paragraphs.forEach((p, index) => {
      const text = p.textContent || p.innerText || '';
      if (index < paragraphs.length - 1) {
        p.replaceWith(text + '\n\n');
      } else {
        p.replaceWith(text);
      }
    });
    
    // Replace list items with bullet points
    temp.querySelectorAll('li').forEach(li => {
      const text = li.textContent || li.innerText || '';
      li.replaceWith('• ' + text + '\n');
    });
    
    // Get the text content
    let text = temp.textContent || temp.innerText || '';
    
    // Clean up extra whitespace
    text = text.replace(/\n{3,}/g, '\n\n'); // Replace 3+ newlines with 2
    text = text.replace(/^\s+|\s+$/g, ''); // Trim start and end
    
    return text;
  }
  
  // Find form field with matching data-report-* attribute
  function findFormField(fieldName) {
    // Look for elements with data-report-[fieldName]="input"
    const selector = `[data-report-${fieldName}="input"]`;
    const fields = document.querySelectorAll(selector);
    
    if (fields.length > 0) {
      log(`Found ${fields.length} field(s) for ${fieldName}`);
      return fields;
    }
    
    // Fallback: try to find by id or name
    const fallbackSelectors = [
      `#${fieldName}`,
      `[name="${fieldName}"]`,
      `[id-input="${fieldName}"]`
    ];
    
    for (const fallback of fallbackSelectors) {
      const field = document.querySelector(fallback);
      if (field) {
        log(`Found field for ${fieldName} using fallback selector: ${fallback}`);
        return [field];
      }
    }
    
    log(`No field found for ${fieldName}`);
    return [];
  }
  
  // Detect field type and populate accordingly
  function populateField(field, value) {
    if (!field || value === undefined || value === null) return;
    
    const tagName = field.tagName.toLowerCase();
    const type = field.type ? field.type.toLowerCase() : '';
    
    log(`Populating field: ${tagName}, type: ${type}, value: ${value}`);
    
    // Check if this field has a Flatpickr instance
    if (field._flatpickr) {
      log('Field has Flatpickr instance, using setDate method');
      field._flatpickr.setDate(value, true); // true = trigger onChange events
      return;
    }
    
    // Handle different field types
    if (tagName === 'input') {
      if (type === 'checkbox') {
        // For checkboxes, check if value is truthy
        field.checked = value === 'true' || value === '1' || value === 'checked';
        // Trigger change event for any listeners
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (type === 'radio') {
        // For radio buttons, check if value matches
        if (field.value === value) {
          field.checked = true;
          field.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        // Text, email, number, etc.
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Special handling for date inputs with Flatpickr
        if (field.hasAttribute('data-flatpickr')) {
          // If Flatpickr hasn't been initialized yet, wait and try again
          setTimeout(() => {
            if (field._flatpickr) {
              log('Flatpickr instance found after delay, setting date');
              field._flatpickr.setDate(value, true);
            }
          }, 500);
        }
      }
    } else if (tagName === 'textarea') {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (tagName === 'select') {
      // For select dropdowns
      field.value = value;
      // If value doesn't exist in options, try to match by text
      if (field.value !== value) {
        for (let option of field.options) {
          if (option.text === value) {
            field.value = option.value;
            break;
          }
        }
      }
      field.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (field.hasAttribute('contenteditable')) {
      // For contenteditable elements
      field.textContent = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Default: try setting value property
      if ('value' in field) {
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        // Last resort: set text content
        field.textContent = value;
      }
    }
  }
  
  // Handle special multi-select fields (localities, settlements, etc.)
  function handleMultiSelectField(fieldName, value) {
    if (!value) return;
    
    // Split comma-separated values
    const values = value.split(',').map(v => v.trim().replace(/"/g, ''));
    
    // Look for checkboxes with matching cms-id-group
    const checkboxes = document.querySelectorAll(`input[cms-id-group="${fieldName}"]`);
    
    if (checkboxes.length > 0) {
      // First, uncheck all
      checkboxes.forEach(cb => {
        cb.checked = false;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      // Then check matching ones
      values.forEach(val => {
        checkboxes.forEach(cb => {
          const choiceId = cb.getAttribute('choice-id');
          const choiceName = cb.getAttribute('choice-name');
          
          if (choiceId === val || choiceName === val) {
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      });
    }
  }
  
  // Select a radio button by choice-id attribute
  function selectRadioByChoiceId(groupName, choiceId) {
    if (!choiceId) return;
    
    log(`Selecting radio for ${groupName} with choice-id: ${choiceId}`);
    
    // Find the radio button with matching cms-id-group and choice-id
    const radio = document.querySelector(`input[cms-id-group="${groupName}"][choice-id="${choiceId}"]`);
    
    if (radio) {
      // Simulate a real click to trigger the Combined Firebase Auth script's handlers
      // This will properly handle cascading triggers
      radio.click();
      
      log(`Selected radio button for ${groupName}: ${choiceId}`);
    } else {
      log(`No radio found for ${groupName} with choice-id: ${choiceId}`);
    }
  }
  
  // Select a radio button by choice-name attribute
  function selectRadioByChoiceName(groupName, choiceName) {
    if (!choiceName) return;
    
    log(`Selecting radio for ${groupName} with choice-name: ${choiceName}`);
    
    // Find the radio button with matching cms-id-group and choice-name
    const radio = document.querySelector(`input[cms-id-group="${groupName}"][choice-name="${choiceName}"]`);
    
    if (radio) {
      // Simulate a real click to trigger the Combined Firebase Auth script's handlers
      // This will properly handle cascading triggers
      radio.click();
      
      log(`Selected radio button for ${groupName}: ${choiceName}`);
    } else {
      log(`No radio found for ${groupName} with choice-name: ${choiceName}`);
    }
  }
  
  // Handle the reporter field specially
  function handleReporterField(value) {
    // The reporter field needs special handling to preserve user's cms-item-id
    // This field is managed by add report.js
    
    if (!value) return;
    
    // Extract reporter IDs (removing the user's cms-item-id if present)
    const reporterIds = value.split(',').map(id => id.trim().replace(/"/g, ''));
    
    // Find reporter checkboxes/radios
    const reporterInputs = document.querySelectorAll('input[cms-id-group="reporter"]');
    
    if (reporterInputs.length > 0) {
      // Clear all selections first
      reporterInputs.forEach(input => {
        input.checked = false;
      });
      
      // Check matching reporters (skip the first ID as it's likely the user's cms-item-id)
      reporterIds.forEach((id, index) => {
        // Skip first ID if it looks like a user ID (you might need to adjust this logic)
        if (index === 0 && !document.querySelector(`input[cms-id-group="reporter"][choice-id="${id}"]`)) {
          return; // Skip user's cms-item-id
        }
        
        reporterInputs.forEach(input => {
          if (input.getAttribute('choice-id') === id) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      });
    }
  }
  
  // Clear the form
  function clearForm() {
    const form = document.querySelector(CONFIG.FORM_SELECTOR);
    if (!form) return;
    
    // Find and click all clear buttons
    const clearButtons = document.querySelectorAll('[clear-choices]');
    clearButtons.forEach(btn => btn.click());
    
    // Clear regular form fields (excluding submit, reset, button inputs, and Firebase auth fields)
    const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not(#user-email-field):not(#auth-token-field):not(#firebase-key-field):not(#Reporter-ID), textarea, select');
    inputs.forEach(field => {
      if (field.type === 'checkbox' || field.type === 'radio') {
        field.checked = false;
      } else if (field.tagName.toLowerCase() === 'select') {
        field.selectedIndex = 0;
      } else {
        field.value = '';
      }
    });
    
    // Clear Quill editors if available
    if (window.clearQuillEditors && typeof window.clearQuillEditors === 'function') {
      window.clearQuillEditors();
      log('Cleared Quill editors');
    }
  }
  
  // Populate image URL fields in the form
  function populateImageFields(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) return;
    
    // Map numbered image fields (data-report-image-1, data-report-image-2, etc.)
    imageUrls.forEach((url, index) => {
      const imageNumber = index + 1;
      const selector = `[data-report-image-${imageNumber}="input"]`;
      const field = document.querySelector(selector);
      
      if (field) {
        field.value = url;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        log(`Populated image ${imageNumber} field with: ${url}`);
      } else {
        log(`No field found for image ${imageNumber}`);
      }
    });
  }
  
  // Populate video URL fields in the form
  function populateVideoFields(videoUrls) {
    if (!videoUrls || videoUrls.length === 0) return;
    
    // Map numbered video fields (data-report-video-1, data-report-video-2, etc.)
    videoUrls.forEach((url, index) => {
      const videoNumber = index + 1;
      const selector = `[data-report-video-${videoNumber}="input"]`;
      const field = document.querySelector(selector);
      
      if (field) {
        field.value = url;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        log(`Populated video ${videoNumber} field with: ${url}`);
      } else {
        log(`No field found for video ${videoNumber}`);
      }
    });
  }
  
  // Populate numbered rich text fields in the form
  function populateRichTextFields(richTexts) {
    if (!richTexts || Object.keys(richTexts).length === 0) {
      log('No rich texts to populate');
      return;
    }
    
    log('Populating rich text fields with:', richTexts);
    
    // Populate each numbered rich text field
    Object.keys(richTexts).forEach(number => {
      const htmlContent = richTexts[number];
      
      // Check if Quill is available and use it
      if (window.setQuillContent && typeof window.setQuillContent === 'function') {
        // Use Quill to set content
        window.setQuillContent(number, htmlContent);
        log(`Populated Quill editor ${number} with HTML content`);
      } else {
        // Fallback to regular field population
        const selector = `[data-report-richtext-${number}="input"]`;
        const field = document.querySelector(selector);
        
        log(`Looking for field with selector: ${selector}`);
        
        if (field) {
          log(`Found field for rich text ${number}, tag: ${field.tagName}`);
          // For fallback, convert HTML to plain text
          const plainText = htmlToPlainText(htmlContent);
          
          // Check field type and populate accordingly
          if (field.tagName.toLowerCase() === 'textarea') {
            field.value = plainText;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            log(`Populated textarea for rich text ${number}`);
          } else if (field.hasAttribute('contenteditable')) {
            // For contenteditable, set plain text
            field.textContent = plainText;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            log(`Populated contenteditable for rich text ${number}`);
          } else if ('value' in field) {
            field.value = plainText;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            log(`Populated input for rich text ${number}`);
          }
        } else {
          log(`No field found for rich text ${number} with selector: ${selector}`);
        }
      }
    });
  }
  
  // Main function to populate form with report data
  function populateFormWithReportData(reportData) {
    log('Populating form with report data');
    
    // Clear form first
    clearForm();
    
    // Give a small delay for clear to complete
    setTimeout(() => {
      // Process each field
      Object.keys(reportData).forEach(fieldName => {
        const value = reportData[fieldName];
        
        // Skip empty values (check for different types)
        if (value === null || value === undefined || value === '') return;
        // For arrays, skip if empty
        if (Array.isArray(value) && value.length === 0) return;
        // For objects (like richtexts), skip if no keys
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return;
        
        // Special handling for specific fields
        if (fieldName === 'reporter' || fieldName === '') {
          // Note: fieldName might be empty for the reporter field based on your HTML
          handleReporterField(value);
        } else if (fieldName === 'locality') {
          // Handle locality radio button selection
          selectRadioByChoiceId('locality', value);
        } else if (fieldName === 'region') {
          // Handle region radio button selection
          selectRadioByChoiceId('region', value);
        } else if (fieldName === 'sub-region' || fieldName === 'subregion') {
          // Handle sub-region radio button selection
          selectRadioByChoiceId('sub-region', value);
        } else if (fieldName === 'territory') {
          // Handle territory radio button selection by name
          selectRadioByChoiceName('territory', value);
        } else if (fieldName === 'perp-origin') {
          // Handle settlement radio button selection
          selectRadioByChoiceId('settlement', value);
        } else if (fieldName === 'settlement') {
          // Alternative handling for settlement
          handleMultiSelectField(fieldName, value);
        } else if (fieldName === 'images') {
          populateImageFields(value);
        } else if (fieldName === 'videos') {
          populateVideoFields(value);
        } else if (fieldName === 'richtexts') {
          populateRichTextFields(value);
        } else {
          // Regular field population
          const fields = findFormField(fieldName);
          fields.forEach(field => populateField(field, value));
        }
      });
      
      // Scroll to form
      const form = document.querySelector(CONFIG.FORM_SELECTOR);
      if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }
  
  // Handle edit button click
  function handleEditClick(event) {
    // Only process if this is actually an edit button click
    const editButton = event.target.closest(CONFIG.EDIT_BUTTON_SELECTOR);
    
    if (!editButton) {
      // Not an edit button, don't interfere with other handlers
      return;
    }
    
    log('Edit button clicked - processing');
    
    // Only prevent default for the edit button, not all clicks
    event.preventDefault();
    
    // Find parent report item
    const reportItem = getReportItem(editButton);
    log('Parent report item:', reportItem);
    
    if (!reportItem) {
      console.error('Could not find parent report item for button:', editButton);
      console.error('Looking for parent with selector:', CONFIG.REPORT_ITEM_SELECTOR);
      return;
    }
    
    // Extract report data
    log('Extracting report data from item:', reportItem);
    const reportData = extractReportData(reportItem);
    log('Extracted report data:', reportData);
    
    // Store current editing report
    currentEditingReport = reportData;
    
    // Populate form
    log('Populating form with report data');
    populateFormWithReportData(reportData);
  }
  
  // Initialize the script
  function initialize() {
    if (isInitialized) {
      log('Script already initialized, skipping');
      return;
    }
    
    log('Initializing Edit Report script');
    
    // Check for edit buttons
    const editButtons = document.querySelectorAll(CONFIG.EDIT_BUTTON_SELECTOR);
    log(`Found ${editButtons.length} edit button(s) with selector: ${CONFIG.EDIT_BUTTON_SELECTOR}`);
    editButtons.forEach((btn, index) => {
      log(`Edit button ${index + 1}:`, btn);
      log(`- Parent element:`, btn.parentElement);
      log(`- Has report item parent:`, !!getReportItem(btn));
    });
    
    // Set up event delegation on document body in bubbling phase (not capture)
    log('Setting up click event listener on document.body in bubbling phase');
    document.body.addEventListener('click', handleEditClick, false);
    
    isInitialized = true;
    log('Edit Report script initialized successfully');
  }
  
  // Wait for DOM and other scripts to be ready
  function waitForReady() {
    log('Checking if ready to initialize...');
    
    // Check if form exists
    const form = document.querySelector(CONFIG.FORM_SELECTOR);
    log(`Form with selector '${CONFIG.FORM_SELECTOR}' found:`, !!form);
    
    if (!form) {
      log('Form not found, retrying in 100ms');
      // Try again in 100ms
      setTimeout(waitForReady, 100);
      return;
    }
    
    log('Form found, initializing in 500ms to ensure other scripts are loaded');
    // Initialize after a small delay to ensure other scripts are loaded
    setTimeout(initialize, 500);
  }
  
  // Start initialization when DOM is ready
  log('Edit Report Script loaded, document.readyState:', document.readyState);
  
  if (document.readyState === 'loading') {
    log('Document still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', waitForReady);
  } else {
    log('Document already loaded, starting initialization check');
    waitForReady();
  }
  
  // Expose API for debugging
  window.EditReportScript = {
    getCurrentReport: () => currentEditingReport,
    extractReportData,
    populateFormWithReportData,
    clearForm,
    setDebug: (enabled) => { CONFIG.DEBUG = enabled; }
  };
  
})();
