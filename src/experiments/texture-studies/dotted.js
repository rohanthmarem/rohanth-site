// An independent three-ink study, informed by Trillium's dotted-style branch.
// Print once per size/control change; no background animation loop.
(() => {
 const root=document.querySelector('.site.dotted');
 if(!root)return;
 const inks=['#f0b90f','#1f7fbd','#e8481f'];
 const typeface='"Avenir Next", Futura, "Century Gothic", "Helvetica Neue", Arial, sans-serif';
 const word=root.querySelector('[data-dot-art="word"]'),map=root.querySelector('[data-dot-art="branches"]');
 const scratch=document.createElement('canvas');scratch.width=800;scratch.height=200;
 const mask=scratch.getContext('2d',{willReadFrequently:true});
 let points=[],pitch=3;
 function sampleWord(){
  pitch=Math.max(3,Math.round(800/Math.max(240,word.clientWidth||800)*2.2));
  mask.clearRect(0,0,800,200);mask.font=`600 180px ${typeface}`;
  const size=Math.min(180,180*748/mask.measureText('rohanth').width);
  mask.font=`600 ${size}px ${typeface}`;mask.textAlign='center';mask.fillText('rohanth',400,157);
  const pix=mask.getImageData(0,0,800,200).data;points=[];
  for(let y=0;y<200;y+=pitch)for(let x=0;x<800;x+=pitch)if(pix[(y*800+x)*4+3]>150)points.push([x,y]);
 }
 function mark(ctx,x,y,r){ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();}
 function paper(canvas,w,h){const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);return ctx;}
 function drawWord(){
  const ctx=paper(word,800,200),amount=Number(document.querySelector('#texture').value)/100;
  ctx.globalCompositeOperation='multiply';
  const offsets=[[0,-2.6],[-3.5,.6],[3.5,2.2]];
  inks.forEach((ink,k)=>{ctx.fillStyle=ink;ctx.beginPath();for(const [x,y] of points){const dx=offsets[k][0]*(.5+amount)*pitch/3,dy=offsets[k][1]*(.5+amount)*pitch/3;mark(ctx,x+dx,y+dy,pitch*.41);}ctx.fill()});
  ctx.globalCompositeOperation='source-over';word.closest('h1').classList.add('dot-ready');
 }
 function branch(ctx,d,color,thickness=4){
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);const length=path.getTotalLength();ctx.fillStyle=color;ctx.beginPath();
  for(let t=0;t<length;t+=4){const a=path.getPointAtLength(t),b=path.getPointAtLength(Math.min(length,t+1));const angle=Math.atan2(b.y-a.y,b.x-a.x);for(let j=-thickness;j<=thickness;j+=3.5)mark(ctx,a.x-Math.sin(angle)*j,a.y+Math.cos(angle)*j,1.15)}ctx.fill();
 }
 function node(ctx,x,y,color){ctx.fillStyle=color;ctx.beginPath();for(let j=-10;j<=10;j+=3.5)for(let i=-10;i<=10;i+=3.5)if(i*i+j*j<95)mark(ctx,x+i,y+j,1.25);ctx.fill();}
 function drawMap(){
  // A readable compact composition on phones, independent of the gallery scale.
  const compact=root.clientWidth<600,ctx=paper(map,800,compact?320:240);
  ctx.globalCompositeOperation='multiply';
  const scale=compact?1.25:1;ctx.scale(1,scale);
  branch(ctx,'M65 165C220 165 255 130 360 115S540 65 655 65',inks[1],5);
  branch(ctx,'M360 115C350 75 300 62 280 28',inks[0]);
  branch(ctx,'M360 115C440 125 465 182 610 190',inks[2]);
  branch(ctx,'M190 159C180 126 160 106 140 94',inks[1],2);
  node(ctx,360,115,inks[0]);node(ctx,655,65,inks[1]);node(ctx,610,190,inks[2]);node(ctx,280,28,inks[0]);
  ctx.globalCompositeOperation='source-over';ctx.scale(1,1/scale);
  const fontSize=compact?30:16;ctx.font=`500 ${fontSize}px ${typeface}`;
  ctx.fillStyle='#5e574d';ctx.fillText('curiosity',52,200*scale);
  ctx.fillStyle=inks[1];ctx.fillText('projects',675,71*scale);
  ctx.fillStyle=inks[2];ctx.fillText('writing',630,197*scale);
  ctx.fillStyle='#8a6500';ctx.fillText('sidequests',300,33*scale);
 }
 const tabs=[...root.querySelectorAll('[data-dot-tab]')];
 function select(tab){tabs.forEach(b=>{const on=b===tab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;root.querySelector('#'+b.getAttribute('aria-controls')).hidden=!on});requestAnimationFrame(()=>dispatchEvent(new Event('resize')))}
 tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;select(tabs[n]);tabs[n].focus()})});
 sampleWord();drawWord();drawMap();
 document.querySelector('#texture').addEventListener('input',drawWord);
 let lastWidth=0;new ResizeObserver(()=>{if(root.clientWidth&&root.clientWidth!==lastWidth){lastWidth=root.clientWidth;sampleWord();drawWord();drawMap()}}).observe(root);
 document.fonts.ready.then(()=>{sampleWord();drawWord()});
})();
