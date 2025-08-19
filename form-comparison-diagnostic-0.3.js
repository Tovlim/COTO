// Dual Form Comparison Tool
// Compares two forms on the same page - one with data-name="report" and one without

(function() {
  'use strict';
  
  window.DualFormComparison = {
    formWithAttr: null,
    formWithoutAttr: null,
    submissions: {
      withAttr: [],
      withoutAttr: []
    },
    networkLog: [],
    
    init() {
      console.log('[Dual Form Comparison] Initializing...');
      
      // Find both forms
      this.formWithAttr = document.querySelector('form[data-name="report"]');
      const allForms = document.querySelectorAll('form');
      
      // Find form without data-name="report"
      for (let form of allForms) {
        if (!form.hasAttribute('data-name') || form.getAttribute('data-name') !== 'report') {
          this.formWithoutAttr = form;
          break;
        }
      }
      
      if (!this.formWithAttr) {
        console.error('[Dual Form Comparison] No form with data-name="report" found!');
      }
      if (!this.formWithoutAttr) {
        console.error('[Dual Form Comparison] No form without data-name="report" found!');
      }
      
      console.log('[Dual Form Comparison] Forms found:');
      console.log('  WITH data-name="report":', this.formWithAttr);
      console.log('  WITHOUT data-name:', this.formWithoutAttr);
      
      // Set up monitoring for both forms
      if (this.formWithAttr) {
        this.setupFormMonitoring(this.formWithAttr, 'withAttr');
      }
      if (this.formWithoutAttr) {
        this.setupFormMonitoring(this.formWithoutAttr, 'withoutAttr');
      }
      
      // Monitor network requests globally
      this.setupNetworkMonitoring();
      
      console.log('[Dual Form Comparison] Ready! Submit each form to capture data.');
      console.log('[Dual Form Comparison] Then run: DualFormComparison.compare()');
    },
    
    setupFormMonitoring(form, type) {
      const label = type === 'withAttr' ? 'WITH data-name' : 'WITHOUT data-name';
      
      // Capture form state function
      const captureFormState = (form) => {
        const state = {
          timestamp: new Date().toISOString(),
          formType: type,
          attributes: {},
          formData: {},
          hiddenFields: [],
          computedStyles: {},
          parentElements: [],
          eventHandling: {}
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
          pointerEvents: computedStyle.pointerEvents
        };
        
        // Capture parent hierarchy (limited)
        let parent = form.parentElement;
        let depth = 0;
        while (parent && parent !== document.body && depth < 3) {
          state.parentElements.push({
            tagName: parent.tagName,
            id: parent.id,
            className: parent.className.substring(0, 100),
            dataAttributes: Array.from(parent.attributes)
              .filter(attr => attr.name.startsWith('data-'))
              .map(attr => ({ name: attr.name, value: attr.value.substring(0, 50) }))
          });
          parent = parent.parentElement;
          depth++;
        }
        
        return state;
      };
      
      // Clear network log before submission
      form.addEventListener('submit', (e) => {
        console.log(`[Dual Form Comparison] CAPTURE PHASE - ${label}`);
        this.networkLog = []; // Clear for this submission
        
        const state = captureFormState(form);
        state.eventHandling.capturePhase = {
          defaultPrevented: e.defaultPrevented,
          propagationStopped: e.cancelBubble,
          isTrusted: e.isTrusted
        };
        
        // Store initial state
        this.submissions[type].push(state);
        
        console.log(`[Dual Form Comparison] ${label} - Capture phase:`, {
          prevented: e.defaultPrevented,
          stopped: e.cancelBubble
        });
      }, true);
      
      // Bubble phase
      form.addEventListener('submit', (e) => {
        console.log(`[Dual Form Comparison] BUBBLE PHASE - ${label}`);
        
        // Update the last submission with bubble phase info
        if (this.submissions[type].length > 0) {
          const lastSubmission = this.submissions[type][this.submissions[type].length - 1];
          lastSubmission.eventHandling.bubblePhase = {
            defaultPrevented: e.defaultPrevented,
            propagationStopped: e.cancelBubble
          };
          
          // Capture network requests after a delay
          setTimeout(() => {
            lastSubmission.networkRequests = [...this.networkLog];
            console.log(`[Dual Form Comparison] ${label} - Network requests captured:`, this.networkLog.length);
          }, 1000);
        }
        
        if (e.defaultPrevented) {
          console.warn(`[Dual Form Comparison] ⚠️ ${label} - SUBMISSION PREVENTED!`);
        }
      }, false);
    },
    
    setupNetworkMonitoring() {
      // Override XMLHttpRequest
      const originalXHR = window.XMLHttpRequest.prototype.send;
      const originalOpen = window.XMLHttpRequest.prototype.open;
      
      window.XMLHttpRequest.prototype.open = function(method, url) {
        this._method = method;
        this._url = url;
        return originalOpen.apply(this, arguments);
      };
      
      window.XMLHttpRequest.prototype.send = function(data) {
        const url = this._url || '';
        if (url && !url.includes('raw.githubusercontent')) { // Exclude GeoJSON requests
          DualFormComparison.networkLog.push({
            type: 'XHR',
            url: url,
            method: this._method,
            timestamp: new Date().toISOString()
          });
        }
        return originalXHR.apply(this, arguments);
      };
      
      // Override fetch
      const originalFetch = window.fetch;
      window.fetch = function(url, options = {}) {
        if (typeof url === 'string' && !url.includes('raw.githubusercontent')) {
          DualFormComparison.networkLog.push({
            type: 'Fetch',
            url: url,
            method: options.method || 'GET',
            timestamp: new Date().toISOString()
          });
        }
        return originalFetch.apply(this, arguments);
      };
    },
    
    compare() {
      const withAttr = this.submissions.withAttr[this.submissions.withAttr.length - 1];
      const withoutAttr = this.submissions.withoutAttr[this.submissions.withoutAttr.length - 1];
      
      if (!withAttr || !withoutAttr) {
        console.error('[Dual Form Comparison] Need to submit both forms first!');
        console.log('  Forms submitted:', {
          'WITH data-name': this.submissions.withAttr.length,
          'WITHOUT data-name': this.submissions.withoutAttr.length
        });
        return;
      }
      
      console.log('\n🔍 ========== FORM COMPARISON RESULTS ==========\n');
      
      // Compare attributes
      console.log('📋 FORM ATTRIBUTES:');
      const allAttrKeys = new Set([...Object.keys(withAttr.attributes), ...Object.keys(withoutAttr.attributes)]);
      let attrDiffs = 0;
      allAttrKeys.forEach(key => {
        if (withAttr.attributes[key] !== withoutAttr.attributes[key]) {
          console.log(`  ${key}:`);
          console.log(`    WITH data-name: ${withAttr.attributes[key] || 'NOT SET'}`);
          console.log(`    WITHOUT: ${withoutAttr.attributes[key] || 'NOT SET'}`);
          attrDiffs++;
        }
      });
      if (attrDiffs === 0) console.log('  ✅ No differences');
      
      // Compare event handling
      console.log('\n⚡ EVENT HANDLING:');
      console.log('  WITH data-name="report":');
      console.log('    Capture - prevented:', withAttr.eventHandling.capturePhase?.defaultPrevented);
      console.log('    Bubble - prevented:', withAttr.eventHandling.bubblePhase?.defaultPrevented);
      console.log('  WITHOUT data-name:');
      console.log('    Capture - prevented:', withoutAttr.eventHandling.capturePhase?.defaultPrevented);
      console.log('    Bubble - prevented:', withoutAttr.eventHandling.bubblePhase?.defaultPrevented);
      
      // Compare network requests
      console.log('\n🌐 NETWORK REQUESTS:');
      console.log('  WITH data-name:', withAttr.networkRequests?.length || 0, 'requests');
      console.log('  WITHOUT:', withoutAttr.networkRequests?.length || 0, 'requests');
      
      if (withAttr.networkRequests?.length > 0) {
        console.log('  WITH data-name URLs:');
        withAttr.networkRequests.forEach(req => {
          console.log(`    - ${req.method} ${req.url}`);
        });
      }
      
      if (withoutAttr.networkRequests?.length > 0) {
        console.log('  WITHOUT URLs:');
        withoutAttr.networkRequests.forEach(req => {
          console.log(`    - ${req.method} ${req.url}`);
        });
      }
      
      // Compare hidden fields
      console.log('\n🔒 HIDDEN FIELDS:');
      console.log('  WITH data-name:', withAttr.hiddenFields.length, 'fields');
      console.log('  WITHOUT:', withoutAttr.hiddenFields.length, 'fields');
      
      // Find unique hidden fields
      const withAttrFieldNames = new Set(withAttr.hiddenFields.map(f => f.name));
      const withoutAttrFieldNames = new Set(withoutAttr.hiddenFields.map(f => f.name));
      
      const onlyInWith = [...withAttrFieldNames].filter(name => !withoutAttrFieldNames.has(name));
      const onlyInWithout = [...withoutAttrFieldNames].filter(name => !withAttrFieldNames.has(name));
      
      if (onlyInWith.length > 0) {
        console.log('  Fields ONLY in WITH data-name:', onlyInWith);
      }
      if (onlyInWithout.length > 0) {
        console.log('  Fields ONLY in WITHOUT:', onlyInWithout);
      }
      
      // Check for Webflow fields
      console.log('\n🔧 WEBFLOW HANDLING:');
      const webflowWith = withAttr.hiddenFields.filter(f => f.name.startsWith('_') || f.name.startsWith('w-'));
      const webflowWithout = withoutAttr.hiddenFields.filter(f => f.name.startsWith('_') || f.name.startsWith('w-'));
      
      console.log('  WITH data-name Webflow fields:', webflowWith.map(f => `${f.name}=${f.value}`));
      console.log('  WITHOUT Webflow fields:', webflowWithout.map(f => `${f.name}=${f.value}`));
      
      // Parent element comparison
      console.log('\n🏗️ PARENT ELEMENTS:');
      if (withAttr.parentElements[0]?.id !== withoutAttr.parentElements[0]?.id ||
          withAttr.parentElements[0]?.className !== withoutAttr.parentElements[0]?.className) {
        console.log('  Different parent structures detected!');
        console.log('  WITH data-name parent:', withAttr.parentElements[0]);
        console.log('  WITHOUT parent:', withoutAttr.parentElements[0]);
      } else {
        console.log('  ✅ Same parent structure');
      }
      
      // Key differences summary
      console.log('\n⭐ KEY DIFFERENCES SUMMARY:');
      if (withAttr.eventHandling.bubblePhase?.defaultPrevented && !withoutAttr.eventHandling.bubblePhase?.defaultPrevented) {
        console.log('  ❌ Form WITH data-name is being PREVENTED from submitting!');
      }
      if (withAttr.networkRequests?.length !== withoutAttr.networkRequests?.length) {
        console.log('  ❌ Different number of network requests!');
      }
      if (onlyInWith.length > 0 || onlyInWithout.length > 0) {
        console.log('  ❌ Different hidden fields between forms!');
      }
      
      console.log('\n========================================\n');
      
      // Store for inspection
      window.lastComparison = { withAttr, withoutAttr };
      console.log('Full data stored in window.lastComparison');
    },
    
    reset() {
      this.submissions = { withAttr: [], withoutAttr: [] };
      this.networkLog = [];
      console.log('[Dual Form Comparison] Data cleared');
    }
  };
  
  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DualFormComparison.init());
  } else {
    setTimeout(() => DualFormComparison.init(), 100);
  }
  
})();
