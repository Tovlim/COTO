const inputField = document.getElementById("refresh-on-enter");
const searchList = document.getElementById("search-terms");
const searchTermsWrapper = document.getElementById("searchTermsWrapper");
const searchClearButton = document.getElementById("searchclear");

// Collect unique terms and populate dropdown
const terms = [...new Set([...document.getElementsByClassName('autofill-title')].map(el => el.innerHTML))];
searchList.innerHTML = terms.sort().map(term => `<li><a href="#" class="list-term">${term}</a></li>`).join('');

inputField.setAttribute("onkeyup", "typeSearch()");
searchTermsWrapper.style.display = "none";

// Filter search results
function typeSearch() {
    const filter = inputField.value.toUpperCase();
    searchTermsWrapper.style.display = filter ? 'block' : 'none';
    
    [...searchList.getElementsByTagName("li")].forEach(li => {
        li.style.display = (li.textContent || li.innerText).toUpperCase().includes(filter) ? "" : "none";
    });
}

// Trigger Finsweet events
const triggerEvents = () => {
    ['input', 'change', 'keyup'].forEach(eventType => {
        inputField.dispatchEvent(new Event(eventType, { bubbles: true }));
    });
};

// Event listeners
document.addEventListener('click', e => {
    if (e.target.matches('.list-term')) {
        e.preventDefault();
        inputField.value = e.target.innerHTML;
        searchTermsWrapper.style.display = 'none';
        triggerEvents();
    } else if (e.target.id !== 'refresh-on-enter' && !searchTermsWrapper.contains(e.target)) {
        searchTermsWrapper.style.display = 'none';
    }
});

inputField.addEventListener('click', () => {
    if (inputField.value.trim()) {
        searchTermsWrapper.style.display = 'block';
        typeSearch();
    }
});

searchClearButton?.addEventListener('click', () => {
    searchTermsWrapper.style.display = 'none';
    if (inputField.value) {
        inputField.value = '';
        triggerEvents();
    }
});
