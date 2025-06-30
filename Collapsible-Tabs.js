document.addEventListener('DOMContentLoaded', () => {
    const config = {
        item: '.w-dyn-item',
        menu: '.w-tab-menu',
        link: '.w-tab-link',
        content: '.w-tab-content',
        pane: '.w-tab-pane',
        active: 'w--current',
        activePane: 'w--tab-active'
    };
    
    document.querySelectorAll(config.item).forEach(item => {
        const tabMenu = item.querySelector(config.menu);
        const tabContent = item.querySelector(config.content);
        if (!tabMenu || !tabContent) return;
        
        let lastClosedTab = null;
        
        const closeAllTabs = () => {
            item.querySelectorAll(config.link).forEach(tab => tab.classList.remove(config.active));
            item.querySelectorAll(config.pane).forEach(pane => pane.classList.remove(config.activePane));
        };
        
        const activateTab = tab => {
            if (!tab) return;
            closeAllTabs();
            tab.classList.add(config.active);
            const pane = tabContent.querySelector(`${config.pane}[data-w-tab="${tab.getAttribute('data-w-tab')}"]`);
            pane?.classList.add(config.activePane);
            lastClosedTab = null;
        };
        
        tabMenu.querySelectorAll(config.link).forEach(tab => {
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);
            
            newTab.addEventListener('click', e => {
                const isActive = newTab.classList.contains(config.active);
                if (isActive) {
                    e.preventDefault();
                    e.stopPropagation();
                    lastClosedTab = newTab;
                    closeAllTabs();
                } else if (newTab === lastClosedTab) {
                    e.preventDefault();
                    e.stopPropagation();
                    activateTab(newTab);
                }
            });
        });
    });
});
