(() => {
 const studio=document.querySelector('.studio'), studies=[...document.querySelectorAll('.study')], slider=document.querySelector('#texture');
 const ids=studies.map(s=>s.dataset.id); let current=null, onlyFavorites=false, favorites=new Set();
 try{favorites=new Set(JSON.parse(localStorage.getItem('rm-material-shortlist')||'[]').filter(id=>ids.includes(id)))}catch{}
 const announce=t=>document.querySelector('#announcement').textContent=t;
 const visibleIds=()=>onlyFavorites?ids.filter(id=>favorites.has(id)):ids;
 function fit(){for(const s of studies){if(s.hidden)continue;const v=s.querySelector('.viewport'),site=s.querySelector('.site');if(current){site.style.transform='';v.style.height='';}else{const scale=(v.clientWidth-32)/960;site.style.transform=`scale(${scale})`;v.style.height=`${Math.ceil(site.scrollHeight*scale)+32}px`;}}}
 function sync(){
  studio.classList.toggle('focused',!!current);
  document.querySelector('.focus-controls').hidden=!current;
  document.querySelector('.empty').hidden=!!current||!onlyFavorites||favorites.size>0;
  studies.forEach(s=>{s.hidden=current?s.dataset.id!==current:onlyFavorites&&!favorites.has(s.dataset.id);const b=s.querySelector('.save-study'),saved=favorites.has(s.dataset.id);b.setAttribute('aria-pressed',String(saved));b.textContent=saved?'★':'☆';b.setAttribute('aria-label',`${saved?'Remove':'Shortlist'} ${s.querySelector('strong').textContent}${saved?' from shortlist':''}`)});
  document.querySelector('#count').textContent=String(favorites.size);
  document.querySelector('#all').setAttribute('aria-pressed',String(!onlyFavorites));document.querySelector('#favorites').setAttribute('aria-pressed',String(onlyFavorites));
  if(current){const list=visibleIds();document.querySelector('#position').textContent=`${String(ids.indexOf(current)+1).padStart(2,'0')} / ${ids.length} — ${studies.find(s=>s.dataset.id===current).querySelector('strong').textContent}`;document.querySelector('#previous').disabled=list.length<2;document.querySelector('#next').disabled=list.length<2;}
  requestAnimationFrame(fit);
 }
 const setHash=id=>{try{history.replaceState(null,'',id?'#'+id:location.pathname+location.search)}catch{}};
 function open(id,focus=true){current=id;setHash(id);sync();if(focus){document.querySelector('#back').focus({preventScroll:true});document.querySelector('.focus-controls').scrollIntoView({block:'start'});}}
 function back(){const prev=current;current=null;setHash(null);sync();requestAnimationFrame(()=>{const b=document.querySelector(`[data-open="${prev}"]`);if(b&&!b.closest('.study').hidden)b.focus({preventScroll:true});else document.querySelector('#all').focus({preventScroll:true});});}
 function step(delta){const list=visibleIds();if(list.length>1){const n=(list.indexOf(current)+delta+list.length)%list.length;open(list[n],false);}}
 document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.open)));
 document.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.save;if(favorites.has(id))favorites.delete(id);else favorites.add(id);try{localStorage.setItem('rm-material-shortlist',JSON.stringify([...favorites]))}catch{}announce(`${b.closest('.study').querySelector('strong').textContent} ${favorites.has(id)?'added to':'removed from'} shortlist`);if(onlyFavorites&&current&&!favorites.has(current)){current=visibleIds()[0]||null;setHash(current);}sync();if(b.closest('.study').hidden){if(current)document.querySelector(`[data-save="${current}"]`).focus();else document.querySelector('#favorites').focus();}}));
 document.querySelector('#back').addEventListener('click',back);
 document.querySelector('#previous').addEventListener('click',()=>step(-1));document.querySelector('#next').addEventListener('click',()=>step(1));
 document.querySelector('#all').addEventListener('click',()=>{onlyFavorites=false;current=null;setHash(null);sync()});
 document.querySelector('#favorites').addEventListener('click',()=>{onlyFavorites=true;current=null;setHash(null);sync()});
 slider.addEventListener('input',()=>{document.querySelector('#texture-value').textContent=slider.value+'%';document.querySelectorAll('.site').forEach(s=>s.style.setProperty('--texture',String(Number(slider.value)/100)))});
 document.addEventListener('keydown',e=>{if(!current||e.target instanceof HTMLInputElement||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='Escape'){e.preventDefault();back()}if(e.key==='ArrowRight'){e.preventDefault();step(1)}if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}});
 addEventListener('hashchange',()=>{const id=location.hash.slice(1);current=ids.includes(id)?id:null;if(current&&onlyFavorites&&!favorites.has(current))onlyFavorites=false;sync()});
 addEventListener('resize',fit);
 const observer=new ResizeObserver(fit);observer.observe(document.querySelector('.collection'));
 const source=document.querySelector('#portrait-source');
 function portraits(){
  const c=document.createElement('canvas');c.width=c.height=400;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,400,400);const pixels=ctx.getImageData(0,0,400,400).data;
  const light=(x,y)=>{const i=(Math.min(399,y)*400+Math.min(399,x))*4;return (pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114)/255};
  const matrix=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  document.querySelectorAll('canvas.portrait').forEach(canvas=>{const p=canvas.getContext('2d'),style=getComputedStyle(canvas.closest('.site')),fg=style.getPropertyValue('--ink').trim(),bg=style.getPropertyValue('--stock').trim();p.fillStyle=bg;p.fillRect(0,0,400,400);p.fillStyle=fg;
   const mode=canvas.dataset.process;
   if(mode==='lines'){for(let x=2;x<400;x+=6)for(let y=0;y<400;y+=2){const width=.6+light(x,y)**1.5*5;p.fillRect(x-width/2,y,width,2.2)}}
   else if(mode==='halftone'){for(let y=3;y<400;y+=5)for(let x=3;x<400;x+=5){const r=(1-light(x,y))**.85*3.4;p.beginPath();p.arc(x,y,r,0,Math.PI*2);p.fill()}}
   else {for(let y=0;y<400;y+=2)for(let x=0;x<400;x+=2){const l=light(x,y),threshold=mode==='bayer'?(matrix[((y/2)%4)*4+(x/2)%4]+.5)/16:.52;const on=mode==='bayer'?l>threshold:l<threshold;if(on)p.fillRect(x,y,2,2)}}
  });
 }
 if(source.complete)portraits();else source.addEventListener('load',portraits,{once:true});
 const hash=location.hash.slice(1)||document.body.dataset.initialStudy;if(ids.includes(hash))current=hash;
 sync();document.fonts.ready.then(fit);
})();
