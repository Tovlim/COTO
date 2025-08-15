<script>
// Combined Firebase Auth Display + Choice Management Script
// Add this to Webflow Project Settings → Custom Code → Before </body> tag

(function() {
  'use strict';
  
  // Configuration
  const FIREBASE_PROJECT_ID = "occupation-crimes";
  const FIREBASE_API_KEY = "AIzaSyCUPNp42xFtCQFjx3lP_jPLjUqjsH1Frw0";
  
  // Shared state
  const state = {
    userCmsItemId: null,
    userCmsItemIdReady: false,
    choicesInitialized: false
  };
  
  // Cache DOM queries for performance
  let userImageEls, fullNameEls, userEmailEls, userElements, guestElements, logoutEls;
  let elementsReady = false;
  let cmsItemIdFetched = false;
  
  // Choice management state
  const checkboxOrders = {};
  const previousRadioSelections = {};
  const triggeredRadios = new WeakSet();
  
  function cacheElements() {
    if (elementsReady) return;
    
    userImageEls = document.querySelectorAll('[data-display="userimage"]');
    fullNameEls = document.querySelectorAll('[data-display="fullname"]');
    userEmailEls = document.querySelectorAll('[data-display="email"]');
    logoutEls = document.querySelectorAll('[user-action="logout"]');
    userElements = document.querySelectorAll('[display-to="users"]');
    guestElements = document.querySelectorAll('[display-to="guests"]');
    
    elementsReady = true;
  }
  
  function setupLogout() {
    for (let i = 0; i < logoutEls.length; i++) {
      if (!logoutEls[i].hasAttribute('data-logout-setup')) {
        logoutEls[i].addEventListener('click', function(e) {
          e.preventDefault();
          firebase.auth().signOut().then(function() {
            const loggedOutEl = document.getElementById('logged-out');
            if (loggedOutEl) {
              loggedOutEl.style.display = 'flex';
              setTimeout(function() {
                loggedOutEl.style.display = 'none';
              }, 4000);
            }
            
            setTimeout(function() {
              window.location.reload();
            }, 4000);
          });
        });
        logoutEls[i].setAttribute('data-logout-setup', 'true');
      }
    }
  }
  
  function fetchAndPopulateCmsItemId(user) {
    if (cmsItemIdFetched) return;
    
    const reporterIdField = document.querySelector('input[id-input="reporter"]');
    if (!reporterIdField) return;
    
    cmsItemIdFetched = true;
    
    user.getIdToken().then(function(idToken) {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${user.uid}`;
      
      fetch(firestoreUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        const cmsItemId = data.fields?.cmsItemId?.stringValue;
        if (cmsItemId) {
          state.userCmsItemId = cmsItemId;
          reporterIdField.value = cmsItemId;
        }
        state.userCmsItemIdReady = true;
        
        // Initialize choices now that we have the user's cms-item-id
        initializeChoiceManagement();
      })
      .catch(function(error) {
        console.log('Firestore fetch failed silently:', error);
        state.userCmsItemIdReady = true;
        initializeChoiceManagement();
      });
    }).catch(function(error) {
      console.log('ID token retrieval failed silently:', error);
      state.userCmsItemIdReady = true;
      initializeChoiceManagement();
    });
  }
  
  // Enhanced function to update reporter group with user ID preservation
  function updateReporterGroupFields(groupName) {
    if (groupName !== 'reporter') {
      // Handle non-reporter groups normally
      updateRegularGroupFields(groupName);
      return;
    }
    
    // Special handling for reporter group
    const selectedInputs = document.querySelectorAll(`input[cms-id-group="${groupName}"]:checked`);
    const idField = document.querySelector(`input[id-input="${groupName}"]`);
    const nameField = document.querySelector(`[name-input="${groupName}"]`);
    
    if (!idField) return;
    
    // Collect selected choice IDs (excluding user's cms-item-id logic)
    const selectedIds = [];
    const selectedNames = [];
    
    if (selectedInputs[0] && selectedInputs[0].type === 'checkbox') {
      // For checkboxes, use the order tracking
      if (checkboxOrders[groupName]) {
        checkboxOrders[groupName].forEach(input => {
          if (input.checked) {
            selectedIds.push(input.getAttribute('choice-id'));
            selectedNames.push(input.getAttribute('choice-name'));
          }
        });
      }
    } else {
      // For radio buttons
      selectedInputs.forEach(input => {
        selectedIds.push(input.getAttribute('choice-id'));
        selectedNames.push(input.getAttribute('choice-name'));
      });
    }
    
    // Format the ID field value
    let finalValue = '';
    if (state.userCmsItemId) {
      if (selectedIds.length === 0) {
        // Just user ID, no quotes
        finalValue = state.userCmsItemId;
      } else {
        // User ID + selections, all quoted
        const allIds = [state.userCmsItemId, ...selectedIds];
        finalValue = allIds.map(id => `"${id}"`).join(',');
      }
    } else if (selectedIds.length > 0) {
      // No user ID available, just use selected IDs
      finalValue = selectedIds.map(id => `"${id}"`).join(',');
    }
    
    idField.value = finalValue;
    
    // Update name field (only selected choice names, not user name)
    if (nameField) {
      const nameValue = selectedNames.join(' & ');
      if (nameField.tagName === 'INPUT') {
        nameField.value = nameValue;
      } else {
        nameField.textContent = nameValue;
      }
    }
  }
  
  // Regular group update function (unchanged)
  function updateRegularGroupFields(groupName) {
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
  
  function handleCascadingTriggers(radio, isChecking) {
    const attributes = radio.attributes;
    const triggers = [];
    
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      if (attr.name.startsWith('trigger-')) {
        const triggerType = attr.name.replace('trigger-', '');
        const triggerValue = attr.value;
        if (triggerValue) {
          triggers.push({ type: triggerType, value: triggerValue });
        }
      }
    }
    
    triggers.forEach(trigger => {
      const targetRadios = document.querySelectorAll(
        `input[choice-type="${trigger.type}"][choice-name="${trigger.value}"]`
      );
      
      targetRadios.forEach(targetRadio => {
        if (targetRadio.checked === isChecking) return;
        
        const wasTriggered = triggeredRadios.has(targetRadio);
        if (!wasTriggered) {
          triggeredRadios.add(targetRadio);
        }
        
        if (isChecking) {
          const targetGroup = targetRadio.getAttribute('cms-id-group');
          
          const otherRadiosInGroup = document.querySelectorAll(`input[cms-id-group="${targetGroup}"]:checked`);
          otherRadiosInGroup.forEach(otherRadio => {
            if (otherRadio !== targetRadio) {
              otherRadio.checked = false;
              const otherVisual = otherRadio.parentElement.querySelector('.w-radio-input');
              if (otherVisual) {
                otherVisual.classList.remove('w--redirected-checked');
              }
            }
          });
          
          const allRadiosInGroup = document.querySelectorAll(`input[cms-id-group="${targetGroup}"]`);
          allRadiosInGroup.forEach(radio => {
            if (radio !== targetRadio && !radio.checked) {
              const visual = radio.parentElement.querySelector('.w-radio-input');
              if (visual) {
                visual.classList.remove('w--redirected-checked');
              }
            }
          });
          
          targetRadio.checked = true;
          previousRadioSelections[targetGroup] = targetRadio;
          
          const visualElement = targetRadio.parentElement.querySelector('.w-radio-input');
          if (visualElement) {
            visualElement.classList.add('w--redirected-checked');
          }
        } else {
          targetRadio.checked = false;
          const targetGroup = targetRadio.getAttribute('cms-id-group');
          if (previousRadioSelections[targetGroup] === targetRadio) {
            previousRadioSelections[targetGroup] = null;
          }
          
          const visualElement = targetRadio.parentElement.querySelector('.w-radio-input, .w--redirected-checked');
          if (visualElement) {
            visualElement.classList.remove('w--redirected-checked');
          }
        }
        
        const targetGroup = targetRadio.getAttribute('cms-id-group');
        if (targetGroup === 'reporter') {
          updateReporterGroupFields(targetGroup);
        } else {
          updateRegularGroupFields(targetGroup);
        }
        
        if (!wasTriggered) {
          handleCascadingTriggers(targetRadio, isChecking);
          triggeredRadios.delete(targetRadio);
        }
      });
    });
  }
  
  function initializeChoiceManagement() {
    if (state.choicesInitialized || !state.userCmsItemIdReady) return;
    
    const allInputs = document.querySelectorAll('input[cms-id-group]');
    if (allInputs.length === 0) return;
    
    state.choicesInitialized = true;
    
    const groups = new Set();
    allInputs.forEach(input => groups.add(input.getAttribute('cms-id-group')));
    
    groups.forEach(groupName => {
      const groupInputs = document.querySelectorAll(`input[cms-id-group="${groupName}"]`);
      const idField = document.querySelector(`input[id-input="${groupName}"]`);
      const nameField = document.querySelector(`[name-input="${groupName}"]`);
      
      if (!groupInputs.length) return;
      
      const isCheckbox = groupInputs[0].type === 'checkbox';
      const isReporterGroup = groupName === 'reporter';
      
      if (isCheckbox) {
        checkboxOrders[groupName] = [];
        
        function updateCheckboxGroup() {
          if (isReporterGroup) {
            updateReporterGroupFields(groupName);
          } else {
            const selectedIds = [];
            const selectedNames = [];
            
            checkboxOrders[groupName].forEach(input => {
              if (input.checked) {
                selectedIds.push(input.getAttribute('choice-id'));
                selectedNames.push(input.getAttribute('choice-name'));
              }
            });
            
            if (idField) idField.value = selectedIds.map(id => `"${id}"`).join(',');
            if (nameField) {
              if (nameField.tagName === 'INPUT') {
                nameField.value = selectedNames.join(' & ');
              } else {
                nameField.textContent = selectedNames.join(' & ');
              }
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
        // Radio button group
        function updateRadioGroup() {
          if (isReporterGroup) {
            updateReporterGroupFields(groupName);
          } else {
            updateRegularGroupFields(groupName);
          }
        }
        
        groupInputs.forEach(input => {
          input.addEventListener('click', function() {
            const wasChecked = previousRadioSelections[groupName] === this;
            
            if (wasChecked) {
              this.checked = false;
              previousRadioSelections[groupName] = null;
              
              const visualElement = this.parentElement.querySelector('.w-radio-input, .w--redirected-checked');
              if (visualElement) {
                visualElement.classList.remove('w--redirected-checked');
              }
              
              handleCascadingTriggers(this, false);
            } else {
              if (previousRadioSelections[groupName] && previousRadioSelections[groupName] !== this) {
                const previousRadio = previousRadioSelections[groupName];
                handleCascadingTriggers(previousRadio, false);
              }
              
              previousRadioSelections[groupName] = this;
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
        const isReporterGroup = groupToClear === 'reporter';
        
        if (isCheckbox) {
          groupInputs.forEach(input => {
            if (input.checked) {
              input.checked = false;
              checkboxOrders[groupToClear] = checkboxOrders[groupToClear].filter(cb => cb !== input);
            }
            
            const visualElement = input.parentElement.querySelector('.w-checkbox-input');
            if (visualElement) {
              visualElement.classList.remove('w--redirected-checked');
            }
          });
          
          if (isReporterGroup) {
            // Reset to user's cms-item-id
            const idField = document.querySelector(`input[id-input="${groupToClear}"]`);
            if (idField && state.userCmsItemId) {
              idField.value = state.userCmsItemId;
            }
            const nameField = document.querySelector(`[name-input="${groupToClear}"]`);
            if (nameField) {
              if (nameField.tagName === 'INPUT') {
                nameField.value = '';
              } else {
                nameField.textContent = '';
              }
            }
          } else {
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
          }
        } else {
          const selectedRadio = document.querySelector(`input[cms-id-group="${groupToClear}"]:checked`);
          
          if (selectedRadio) {
            handleCascadingTriggers(selectedRadio, false);
            selectedRadio.checked = false;
            previousRadioSelections[groupToClear] = null;
            
            const visualElement = selectedRadio.parentElement.querySelector('.w-radio-input, .w--redirected-checked');
            if (visualElement) {
              visualElement.classList.remove('w--redirected-checked');
            }
            
            groupInputs.forEach(input => {
              const visual = input.parentElement.querySelector('.w-radio-input');
              if (visual) {
                visual.classList.remove('w--redirected-checked');
              }
            });
            
            if (isReporterGroup) {
              // Reset to user's cms-item-id
              const idField = document.querySelector(`input[id-input="${groupToClear}"]`);
              if (idField && state.userCmsItemId) {
                idField.value = state.userCmsItemId;
              }
              const nameField = document.querySelector(`[name-input="${groupToClear}"]`);
              if (nameField) {
                if (nameField.tagName === 'INPUT') {
                  nameField.value = '';
                } else {
                  nameField.textContent = '';
                }
              }
            } else {
              updateRegularGroupFields(groupToClear);
            }
          }
        }
      });
    });
    
    // Handle form submission
    const form = document.querySelector('form');
    if (form) {
      form.addEventListener('submit', function(e) {
        groups.forEach(groupName => {
          const groupInputs = document.querySelectorAll(`input[cms-id-group="${groupName}"]`);
          const idField = document.querySelector(`input[id-input="${groupName}"]`);
          const nameField = document.querySelector(`[name-input="${groupName}"]`);
          
          if (!groupInputs.length) return;
          
          if (groupName === 'reporter') {
            updateReporterGroupFields(groupName);
          } else if (groupInputs[0].type === 'checkbox') {
            const selectedIds = [];
            const selectedNames = [];
            
            checkboxOrders[groupName].forEach(input => {
              if (input.checked) {
                selectedIds.push(input.getAttribute('choice-id'));
                selectedNames.push(input.getAttribute('choice-name'));
              }
            });
            
            if (idField) idField.value = selectedIds.map(id => `"${id}"`).join(',');
            if (nameField) {
              const nameValue = selectedNames.join(' & ');
              if (nameField.tagName === 'INPUT') {
                nameField.value = nameValue;
              } else {
                nameField.textContent = nameValue;
              }
            }
          } else {
            updateRegularGroupFields(groupName);
          }
        });
      });
    }
  }
  
  function setupFormAuthentication(user) {
    const form = document.querySelector('form[data-name="report"]');
    
    if (form) {
      user.getIdToken().then(function(idToken) {
        const tokenField = document.getElementById('auth-token-field');
        if (tokenField) {
          tokenField.value = idToken;
          console.log('Auth token set');
        }
        
        const emailField = document.getElementById('user-email-field');
        if (emailField) {
          emailField.value = user.email;
          console.log('User email set:', user.email);
        }
        
        const keyField = document.getElementById('firebase-key-field');
        if (keyField) {
          keyField.value = FIREBASE_API_KEY;
          console.log('Firebase API key set');
        }
        
      }).catch(function(error) {
        console.error('Error getting ID token:', error);
      });
    }
  }
  
  function updateUI(user) {
    cacheElements();
    
    if (user) {
      setupLogout();
      fetchAndPopulateCmsItemId(user);
      setupFormAuthentication(user);
      
      // Set user image
      for (let i = 0; i < userImageEls.length; i++) {
        userImageEls[i].removeAttribute('srcset');
        userImageEls[i].removeAttribute('sizes');
        
        if (user.photoURL) {
          userImageEls[i].src = user.photoURL;
        } else {
          const initials = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
          userImageEls[i].src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="#4285f4" width="40" height="40"/><text fill="white" font-family="Arial" font-size="16" text-anchor="middle" x="20" y="26">${initials}</text></svg>`)}`;
        }
      }
      
      // Set full name
      for (let i = 0; i < fullNameEls.length; i++) {
        fullNameEls[i].textContent = user.displayName || '';
      }
      
      // Set email
      for (let i = 0; i < userEmailEls.length; i++) {
        userEmailEls[i].textContent = user.email || '';
      }
      
      // Show user elements
      for (let i = 0; i < userElements.length; i++) {
        userElements[i].style.display = 'flex';
      }
      
      // Hide guest elements
      for (let i = 0; i < guestElements.length; i++) {
        guestElements[i].style.display = 'none';
      }
      
    } else {
      // User not logged in - redirect to login
      if (document.querySelector('form[data-name="report"]')) {
        window.location.href = '/login';
        return;
      }
      
      // Hide user elements
      for (let i = 0; i < userElements.length; i++) {
        userElements[i].style.display = 'none';
      }
      
      // Show guest elements
      for (let i = 0; i < guestElements.length; i++) {
        guestElements[i].style.display = 'flex';
      }
    }
  }
  
  // Initialize when DOM is ready
  function initialize() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged(updateUI);
    } else {
      let checkCount = 0;
      const checkFirebase = function() {
        if (typeof firebase !== 'undefined' && firebase.auth) {
          firebase.auth().onAuthStateChanged(updateUI);
        } else if (checkCount < 50) {
          checkCount++;
          setTimeout(checkFirebase, 100);
        }
      };
      checkFirebase();
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
})();
</script>

<script>
// Optional: Add form submission logging to debug
document.addEventListener('DOMContentLoaded', function() {
  const form = document.querySelector('form[data-name="Report Form"]');
  if (form) {
    form.addEventListener('submit', function(e) {
      console.log('Form submitting...');
      
      // Log all form data being sent
      const formData = new FormData(form);
      console.log('Form data:');
      for (let [key, value] of formData.entries()) {
        console.log(key + ': ' + value);
      }
    });
  }
});
</script>
