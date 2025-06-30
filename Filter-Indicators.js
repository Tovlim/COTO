(()=>{
const a=document.querySelectorAll('[activate-filter-indicator]'),fp=[];
a.forEach(el=>{if(el.hasAttribute('data-flatpickr')||el.classList.contains('flatpickr-input')){const alt=el.parentElement.querySelector('input[type="text"]:not([activate-filter-indicator])');alt&&fp.push({original:el,altInput:alt,groupName:el.getAttribute('activate-filter-indicator')})}});
const toggle=(g,show)=>document.querySelectorAll(`[filter-indicator="${g}"]`).forEach(i=>i.style.display=show?'flex':'none');
const hasActive=g=>Array.from(document.querySelectorAll(`[activate-filter-indicator="${g}"]`)).some(el=>{
const tag=el.tagName.toLowerCase(),type=el.type?.toLowerCase();
if(el.hasAttribute('data-flatpickr')||el.classList.contains('flatpickr-input'))return el.value.trim()!=='';
if(tag==='input'){if(type==='checkbox'||type==='radio')return el.checked;if(type==='text'||type==='search'||type==='email'||!type)return el.value.trim()!==''}else if(tag==='select')return el.selectedIndex>0;else if(tag==='textarea')return el.value.trim()!=='';
return false});
const handle=e=>{const g=e.target.getAttribute('activate-filter-indicator');if(g)toggle(g,hasActive(g))};
a.forEach(el=>{
const tag=el.tagName.toLowerCase(),type=el.type?.toLowerCase();
if(el.hasAttribute('data-flatpickr')||el.classList.contains('flatpickr-input')){el.addEventListener('change',handle);return}
if(tag==='input'){if(type==='checkbox'||type==='radio')el.addEventListener('change',handle);else if(type==='text'||type==='search'||type==='email'||!type){el.addEventListener('input',handle);el.addEventListener('blur',handle)}}else if(tag==='select')el.addEventListener('change',handle);else if(tag==='textarea'){el.addEventListener('input',handle);el.addEventListener('blur',handle)}});
fp.forEach(({original,altInput})=>{['input','blur'].forEach(e=>altInput.addEventListener(e,()=>handle({target:original})))});
[...new Set(Array.from(a).map(el=>el.getAttribute('activate-filter-indicator')))].forEach(g=>g&&toggle(g,hasActive(g)))})();
