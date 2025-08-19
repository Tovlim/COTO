// Form Submission Comparison Tool
// Compares form behavior with and without data-name="report" attribute

(function() {
  'use strict';
  
  window.FormComparison = {
    submissions: [],
    
    init() {
      console.log('[Form Comparison] Initializing comparison tool...');
      
      // Find the form (with or without data-name attribute)
      const form = document.querySelector('form[data-name="report"]') || 
                   document.querySelector('form');
      
      if (!form) {
        console.error('[Form Comparison] No form found!');
        return;
      }
      
      const hasDataName = form.hasAttribute('data-name');
      const dataNameValue = form.getAttribute('data-name');
      
      console.log('[Form Comparison] Form state:', {
        hasDataName,
        dataNameValue,
        action: form.action,
        method: form.method,
        id: form.id,
        className: form.className
      });
      
      // Capture form state before submission
      const captureFormState = () => {
        const state = {
          timestamp: new Date().toISOString(),
          hasDataName,
          dataNameValue,
          attributes: {},
          eventListeners: [],
          formData: {},
          hiddenFields: [],
          computedStyles: {},
          parentElements: [],
          networkRequests: []
        };
        
        // Capture all attributes
        Array.from(form.attributes).forEach(attr => {
          state.attributes[attr.name] = attr.value;
        });
        
        // Capture form data
        const formData = new FormData(form);
        formData.forEach((value, key) => {
          if (!state.formData[key]) {
            state.formData[key] = [];
          }
          state.formData[key].push(value);
        });
        
        // Capture hidden fields
        form.querySelectorAll('input[type="hidden"]').forEach(input => {
          state.hiddenFields.push({
            name: input.name,
            value: input.value,
            id: input.id,
            className: input.className
          });
        });
        
        // Capture computed styles
        const computedStyle = window.getComputedStyle(form);
        state.computedStyles = {
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          pointerEvents: computedStyle.pointerEvents,
          position: computedStyle.position
        };
        
        // Capture parent hierarchy
        let parent = form.parentElement;
        while (parent && parent !== document.body) {
          state.parentElements.push({
            tagName: parent.tagName,
            id: parent.id,
            className: parent.className,
            attributes: Array.from(parent.attributes).map(attr => ({
              name: attr.name,
              value: attr.value.substring(0, 100) // Truncate long values
            }))
          });
          parent = parent.parentElement;
        }
        
        return state;
      };
      
      // Monitor network requests
      const networkLog = [];
      
      // Override XMLHttpRequest
      const originalXHR = window.XMLHttpRequest.prototype.send;
      window.XMLHttpRequest.prototype.send = function(data) {
        const url = this._url || '';
        if (url.includes('submit') || url.includes('zapier') || url.includes('webflow')) {
          networkLog.push({
            type: 'XHR',
            url: url,
            method: this._method,
            timestamp: new Date().toISOString(),
            data: data
          });
        }
        return originalXHR.apply(this, arguments);
      };
      
      const originalOpen = window.XMLHttpRequest.prototype.open;
      window.XMLHttpRequest.prototype.open = function(method, url) {
        this._method = method;
        this._url = url;
        return originalOpen.apply(this, arguments);
      };
      
      // Override fetch
      const originalFetch = window.fetch;
      window.fetch = function(url, options = {}) {
        if (typeof url === 'string' && (url.includes('submit') || url.includes('zapier') || url.includes('webflow'))) {
          networkLog.push({
            type: 'Fetch',
            url: url,
            method: options.method || 'GET',
            timestamp: new Date().toISOString(),
            body: options.body
          });
        }
        return originalFetch.apply(this, arguments);
      };
      
      // Capture phase listener
      form.addEventListener('submit', (e) => {
        console.log('[Form Comparison] CAPTURE PHASE - Submit detected');
        const state = captureFormState();
        state.phase = 'capture';
        state.defaultPrevented = e.defaultPrevented;
        state.propagationStopped = e.cancelBubble;
        state.networkRequests = [...networkLog];
        
        // Store for comparison
        this.submissions.push(state);
        
        console.log('[Form Comparison] Captured state:', state);
      }, true);
      
      // Bubble phase listener
      form.addEventListener('submit', (e) => {
        console.log('[Form Comparison] BUBBLE PHASE - Submit detected');
        
        // Update the last submission with bubble phase info
        if (this.submissions.length > 0) {
          const lastSubmission = this.submissions[this.submissions.length - 1];
          lastSubmission.bubblePhase = {
            defaultPrevented: e.defaultPrevented,
            propagationStopped: e.cancelBubble
          };
        }
        
        // After a delay, capture any network requests that happened
        setTimeout(() => {
          if (this.submissions.length > 0) {
            const lastSubmission = this.submissions[this.submissions.length - 1];
            lastSubmission.networkRequests = [...networkLog];
          }
        }, 1000);
      }, false);
      
      console.log('[Form Comparison] Ready to capture submissions');
      console.log('[Form Comparison] Submit the form twice (with and without data-name)');
      console.log('[Form Comparison] Then run: FormComparison.compare()');
    },
    
    compare() {
      if (this.submissions.length < 2) {
        console.error('[Form Comparison] Need at least 2 submissions to compare');
        console.log(`[Form Comparison] Current submissions: ${this.submissions.length}`);
        return;
      }
      
      const sub1 = this.submissions[this.submissions.length - 2];
      const sub2 = this.submissions[this.submissions.length - 1];
      
      console.log('\n========== FORM SUBMISSION COMPARISON ==========\n');
      
      // Compare basic properties
      console.log('📋 BASIC PROPERTIES:');
      console.log('Submission 1 - data-name:', sub1.dataNameValue || 'NOT SET');
      console.log('Submission 2 - data-name:', sub2.dataNameValue || 'NOT SET');
      
      // Compare attributes
      console.log('\n📌 ATTRIBUTE DIFFERENCES:');
      const allAttrKeys = new Set([...Object.keys(sub1.attributes), ...Object.keys(sub2.attributes)]);
      allAttrKeys.forEach(key => {
        if (sub1.attributes[key] !== sub2.attributes[key]) {
          console.log(`  ${key}:`);
          console.log(`    Sub1: ${sub1.attributes[key]}`);
          console.log(`    Sub2: ${sub2.attributes[key]}`);
        }
      });
      
      // Compare form data
      console.log('\n📝 FORM DATA DIFFERENCES:');
      const allDataKeys = new Set([...Object.keys(sub1.formData), ...Object.keys(sub2.formData)]);
      let dataDifferences = 0;
      allDataKeys.forEach(key => {
        const val1 = JSON.stringify(sub1.formData[key]);
        const val2 = JSON.stringify(sub2.formData[key]);
        if (val1 !== val2) {
          console.log(`  ${key}:`);
          console.log(`    Sub1: ${val1}`);
          console.log(`    Sub2: ${val2}`);
          dataDifferences++;
        }
      });
      if (dataDifferences === 0) {
        console.log('  No differences in form data');
      }
      
      // Compare hidden fields
      console.log('\n🔒 HIDDEN FIELDS:');
      console.log('Submission 1:', sub1.hiddenFields.length, 'hidden fields');
      console.log('Submission 2:', sub2.hiddenFields.length, 'hidden fields');
      if (sub1.hiddenFields.length !== sub2.hiddenFields.length) {
        console.log('  Different number of hidden fields!');
      }
      
      // Compare network requests
      console.log('\n🌐 NETWORK REQUESTS:');
      console.log('Submission 1:', sub1.networkRequests.length, 'requests');
      console.log('Submission 2:', sub2.networkRequests.length, 'requests');
      if (sub1.networkRequests.length > 0 || sub2.networkRequests.length > 0) {
        console.log('  Sub1 requests:', sub1.networkRequests);
        console.log('  Sub2 requests:', sub2.networkRequests);
      }
      
      // Compare event handling
      console.log('\n⚡ EVENT HANDLING:');
      console.log('Submission 1:');
      console.log('  Capture - prevented:', sub1.defaultPrevented, 'stopped:', sub1.propagationStopped);
      console.log('  Bubble - prevented:', sub1.bubblePhase?.defaultPrevented, 'stopped:', sub1.bubblePhase?.propagationStopped);
      console.log('Submission 2:');
      console.log('  Capture - prevented:', sub2.defaultPrevented, 'stopped:', sub2.propagationStopped);
      console.log('  Bubble - prevented:', sub2.bubblePhase?.defaultPrevented, 'stopped:', sub2.bubblePhase?.propagationStopped);
      
      // Check for Webflow handling
      console.log('\n🔧 WEBFLOW INDICATORS:');
      const webflowFields1 = sub1.hiddenFields.filter(f => f.name.startsWith('_') || f.name.startsWith('w-'));
      const webflowFields2 = sub2.hiddenFields.filter(f => f.name.startsWith('_') || f.name.startsWith('w-'));
      console.log('Submission 1 Webflow fields:', webflowFields1.map(f => f.name));
      console.log('Submission 2 Webflow fields:', webflowFields2.map(f => f.name));
      
      console.log('\n========== END COMPARISON ==========\n');
      
      // Store full comparison for inspection
      window.lastComparison = { sub1, sub2 };
      console.log('Full data stored in window.lastComparison');
    },
    
    reset() {
      this.submissions = [];
      console.log('[Form Comparison] Submissions cleared');
    },
    
    showSubmissions() {
      console.log('[Form Comparison] All submissions:', this.submissions);
    }
  };
  
  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FormComparison.init());
  } else {
    setTimeout(() => FormComparison.init(), 100);
  }
  
})();
