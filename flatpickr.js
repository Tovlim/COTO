document.addEventListener('DOMContentLoaded', function() {
    const dateInputs = document.querySelectorAll('[data-flatpickr]');
    
    dateInputs.forEach(function(input) {
        const fp = flatpickr(input, {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d-m-Y",
            allowInput: true,
            clickOpens: true,
            position: "auto",
            static: false,
            onReady: function(selectedDates, dateStr, instance) {
                const calendar = instance.calendarContainer;
                if (calendar) {
                    calendar.style.zIndex = '9999';
                    calendar.style.position = 'absolute';
                }
            },
            onOpen: function(selectedDates, dateStr, instance) {
                instance._positionCalendar();
            },
            onChange: function(selectedDates, dateStr, instance) {
                // Clear alt input if main input is empty
                if (!dateStr || dateStr === '') {
                    instance.altInput.value = '';
                }
            }
        });
        
        // Watch for changes to the original input (Y-m-d format)
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                    if (!input.value || input.value === '') {
                        fp.altInput.value = '';
                    }
                }
            });
        });
        
        // Also listen for direct value changes
        input.addEventListener('input', function() {
            if (!input.value || input.value === '') {
                fp.altInput.value = '';
            }
        });
        
        // Watch for programmatic value changes
        observer.observe(input, {
            attributes: true,
            attributeFilter: ['value']
        });
    });
});
