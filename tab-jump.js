document.addEventListener('DOMContentLoaded',()=>{
const tabs=document.querySelectorAll('[tab]'),w=document.getElementById('wrapscroll');
if(!w)return console.error('Scroll wrapper not found');
tabs.forEach(t=>t.addEventListener('click',e=>{
const s=t.getAttribute('tab');if(!s)return;
const el=document.querySelector(`[tabtop="${s}"]`);if(!el)return;
const wr=w.getBoundingClientRect(),tr=el.getBoundingClientRect();
if(tr.top>=wr.top)return;
w.scrollTo({top:tr.top-wr.top+w.scrollTop,behavior:'instant'});e.preventDefault()}));
console.log(`Tab jump initialized for ${tabs.length} elements`)});
