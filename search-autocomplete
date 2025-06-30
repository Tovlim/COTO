const i=document.getElementById("refresh-on-enter"),s=document.getElementById("search-terms"),w=document.getElementById("searchTermsWrapper"),c=document.getElementById("searchclear");
s.innerHTML=[...new Set([...document.getElementsByClassName('autofill-title')].map(e=>e.innerHTML))].sort().map(t=>`<li><a href="#" class="list-term">${t}</a></li>`).join('');
i.setAttribute("onkeyup","typeSearch()");w.style.display="none";
function typeSearch(){const f=i.value.toUpperCase();w.style.display=f?'block':'none';[...s.getElementsByTagName("li")].forEach(l=>l.style.display=(l.textContent||l.innerText).toUpperCase().includes(f)?"":"none")}
const triggerEvents=()=>['input','change','keyup'].forEach(e=>i.dispatchEvent(new Event(e,{bubbles:true})));
document.addEventListener('click',e=>{e.target.matches('.list-term')?(e.preventDefault(),i.value=e.target.innerHTML,w.style.display='none',triggerEvents()):e.target.id!=='refresh-on-enter'&&!w.contains(e.target)&&(w.style.display='none')});
i.addEventListener('click',()=>{i.value.trim()&&(w.style.display='block',typeSearch())});
c?.addEventListener('click',()=>{w.style.display='none';i.value&&(i.value='',triggerEvents())});
