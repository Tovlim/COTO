// Quill Rich Text Editor Integration
// Integrates with edit-report.js for seamless rich text editing

(function() {
  'use strict';
  
  // Store Quill instances globally
  window.quillEditors = {};
  
  // Configuration
  const QUILL_CONFIG = {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'link'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
      ]
    }
  };
  
  // Initialize Quill editors
  function initializeQuillEditors() {
    // Initialize Quill editor 1
    const editor1Container = document.querySelector('[data-report-richtext-1="input"]');
    const hiddenInput1 = document.querySelector('[quill-1="input"]');
    
    if (editor1Container && hiddenInput1) {
      // Check if already initialized
      if (!window.quillEditors.editor1) {
        window.quillEditors.editor1 = new Quill(editor1Container, QUILL_CONFIG);
        
        // Sync content to hidden textarea on any change
        window.quillEditors.editor1.on('text-change', function() {
          hiddenInput1.value = window.quillEditors.editor1.root.innerHTML;
          // Dispatch events for form validation if needed
          hiddenInput1.dispatchEvent(new Event('input', { bubbles: true }));
          hiddenInput1.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    }
    
    // Initialize Quill editor 2
    const editor2Container = document.querySelector('[data-report-richtext-2="input"]');
    const hiddenInput2 = document.querySelector('[quill-2="input"]');
    
    if (editor2Container && hiddenInput2) {
      // Check if already initialized
      if (!window.quillEditors.editor2) {
        window.quillEditors.editor2 = new Quill(editor2Container, QUILL_CONFIG);
        
        // Sync content to hidden textarea on any change
        window.quillEditors.editor2.on('text-change', function() {
          hiddenInput2.value = window.quillEditors.editor2.root.innerHTML;
          // Dispatch events for form validation if needed
          hiddenInput2.dispatchEvent(new Event('input', { bubbles: true }));
          hiddenInput2.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    }
  }
  
  // Function to set content in Quill editor (used by edit-report.js)
  window.setQuillContent = function(editorNumber, htmlContent) {
    const editorKey = `editor${editorNumber}`;
    const hiddenInputSelector = `[quill-${editorNumber}="input"]`;
    
    if (window.quillEditors[editorKey]) {
      // Use dangerouslyPasteHTML to preserve HTML formatting
      window.quillEditors[editorKey].root.innerHTML = htmlContent;
      
      // Also update the hidden input
      const hiddenInput = document.querySelector(hiddenInputSelector);
      if (hiddenInput) {
        hiddenInput.value = htmlContent;
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  };
  
  // Function to clear Quill editors (used when clearing form)
  window.clearQuillEditors = function() {
    if (window.quillEditors.editor1) {
      window.quillEditors.editor1.setText('');
    }
    if (window.quillEditors.editor2) {
      window.quillEditors.editor2.setText('');
    }
    
    // Clear hidden inputs too
    const hiddenInput1 = document.querySelector('[quill-1="input"]');
    const hiddenInput2 = document.querySelector('[quill-2="input"]');
    
    if (hiddenInput1) {
      hiddenInput1.value = '';
    }
    if (hiddenInput2) {
      hiddenInput2.value = '';
    }
  };
  
  // Wait for DOM to be ready
  function waitForReady() {
    // Check if both editor containers exist
    const editor1Container = document.querySelector('[data-report-richtext-1="input"]');
    const editor2Container = document.querySelector('[data-report-richtext-2="input"]');
    
    if (!editor1Container && !editor2Container) {
      // Try again in 100ms
      setTimeout(waitForReady, 100);
      return;
    }
    
    // Initialize after a small delay to ensure Quill library is loaded
    setTimeout(initializeQuillEditors, 100);
  }
  
  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForReady);
  } else {
    waitForReady();
  }
  
})();