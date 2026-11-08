(()=>{
 const specimen=document.querySelector('.specimen'),frame=document.querySelector('.design-frame');
 const picker=[...document.querySelectorAll('[data-pick]')],rail=document.querySelector('.rail');
 const [prev,next]=document.querySelectorAll('[data-step]');
 const menu=document.querySelector('details');
 function sync(){prev.disabled=rail.scrollLeft<4;next.disabled=rail.scrollLeft+rail.clientWidth>rail.scrollWidth-4}
 function choose(id){if(!['paper','cloth','ink'].includes(id))return;specimen.dataset.design=id;picker.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pick===id)));frame.style.background=getComputedStyle(specimen).getPropertyValue('--page');rail.scrollLeft=0;document.querySelector('#direction-status').textContent=id+' direction selected.';try{history.replaceState(null,'','#'+id)}catch{}requestAnimationFrame(sync)}
 picker.forEach(b=>b.addEventListener('click',()=>choose(b.dataset.pick)));
 [prev,next].forEach(b=>b.addEventListener('click',()=>{const card=rail.firstElementChild;const gap=parseFloat(getComputedStyle(rail).columnGap)||0;rail.scrollBy({left:Number(b.dataset.step)*(card.offsetWidth+gap),behavior:'instant'});sync()}));
 rail.addEventListener('scroll',sync,{passive:true});new ResizeObserver(sync).observe(rail);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus()}});
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))menu.open=false});
 addEventListener('hashchange',()=>choose(location.hash.slice(1)));
 choose(['paper','cloth','ink'].includes(location.hash.slice(1))?location.hash.slice(1):'paper');
})();
