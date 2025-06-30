<script>
// Custom tab switcher for Webflow
document.addEventListener('DOMContentLoaded', function() {
    
    // Find all elements with open-tab attribute
    const tabTriggers = document.querySelectorAll('[open-tab]');
    
    tabTriggers.forEach(trigger => {
        trigger.addEventListener('click', function(e) {
            // Only prevent default if element doesn't have sidebar functionality
            if (!this.hasAttribute('open-right-sidebar')) {
                e.preventDefault();
            }
            
            // Get the group name from the clicked element
            const groupName = this.getAttribute('open-tab');
            
            // If element has sidebar attribute, let the sidebar script handle the tab switching
            if (this.hasAttribute('open-right-sidebar')) {
                console.log('Element has sidebar attribute, letting sidebar script handle tab switching');
                return;
            }
            
            // Find the corresponding tab with opened-tab attribute
            const targetTab = document.querySelector(`[opened-tab="${groupName}"]`);
            
            if (targetTab) {
                // Trigger click on the target tab to activate Webflow's built-in functionality
                targetTab.click();
            } else {
                console.warn(`No tab found with opened-tab="${groupName}"`);
            }
        });
    });
    
});
</script>
