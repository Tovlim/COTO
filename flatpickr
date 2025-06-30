document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Flatpickr Debug: DOM loaded, starting initialization...');
    
    // Find ALL elements with any data-flatpickr attribute
    const dateInputs = document.querySelectorAll('[data-flatpickr]');
    console.log('🔍 Found', dateInputs.length, 'elements with data-flatpickr attribute');
    
    dateInputs.forEach(function(input, index) {
        const pickerType = input.getAttribute('data-flatpickr');
        console.log('🔍 Initializing date picker', index + 1, 'with type:', pickerType, 'on element:', input);
        
        try {
            const fp = flatpickr(input, {
                // This is the format stored in the actual input (for CMS filter)
                dateFormat: "Y-m-d", // This gives you format like: 2025-06-26
                
                // Enable alternative input for user display
                altInput: true,
                altFormat: "d-m-Y", // This shows user format like: 26-6-2025
                
                allowInput: true,
                clickOpens: true,
                
                // Past dates allowed
                
                // Fix positioning issues
                position: "auto",
                static: false,
                
                onReady: function(selectedDates, dateStr, instance) {
                    console.log('✅ Flatpickr ready for', pickerType, '(element', index + 1, ')');
                    console.log('📝 Stored value:', dateStr, '(format: Y-m-d)');
                    console.log('👁️ Display value:', instance.altInput.value, '(format: d-m-Y)');
                    
                    // Fix positioning after initialization
                    const calendar = instance.calendarContainer;
                    if (calendar) {
                        calendar.style.zIndex = '9999';
                        calendar.style.position = 'absolute';
                    }
                },
                
                onOpen: function(selectedDates, dateStr, instance) {
                    console.log('📅 Flatpickr opened for', pickerType, '(element', index + 1, ')');
                    
                    // Ensure proper positioning when opened
                    const calendar = instance.calendarContainer;
                    if (calendar) {
                        instance._positionCalendar();
                    }
                },
                
                onChange: function(selectedDates, dateStr, instance) {
                    console.log('📝 Date changed for', pickerType, '!');
                    console.log('  - Stored value (for CMS):', dateStr, '(format: Y-m-d)');
                    console.log('  - Display value (for user):', instance.altInput.value, '(format: d-m-Y)');
                }
            });
            
            console.log('✅ Successfully initialized flatpickr for', pickerType, '(element', index + 1, ')');
            
        } catch (error) {
            console.error('❌ Error initializing flatpickr for', pickerType, '(element', index + 1, '):', error);
        }
    });
});
