document.addEventListener('DOMContentLoaded',()=>{
const c={item:'.w-dyn-item',menu:'.w-tab-menu',link:'.w-tab-link',content:'.w-tab-content',pane:'.w-tab-pane',active:'w--current',activePane:'w--tab-active'};
document.querySelectorAll(c.item).forEach(item=>{
const m=item.querySelector(c.menu),cont=item.querySelector(c.content);
if(!m||!cont)return;
let last=null;
const close=()=>{item.querySelectorAll(c.link).forEach(t=>t.classList.remove(c.active));item.querySelectorAll(c.pane).forEach(p=>p.classList.remove(c.activePane))};
const activate=t=>{if(!t)return;close();t.classList.add(c.active);const p=cont.querySelector(`${c.pane}[data-w-tab="${t.getAttribute('data-w-tab')}"]`);p?.classList.add(c.activePane);last=null};
m.querySelectorAll(c.link).forEach(tab=>{
const n=tab.cloneNode(true);tab.parentNode.replaceChild(n,tab);
n.addEventListener('click',e=>{
const active=n.classList.contains(c.active);
if(active){e.preventDefault();e.stopPropagation();last=n;close()}else if(n===last){e.preventDefault();e.stopPropagation();activate(n)}})})})});
