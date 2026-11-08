import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { build } from 'esbuild';
const dist=resolve('dist');
let html=readFileSync(resolve(dist,'iterations/left/index.html'),'utf8');
const fixedHeight=css=>css.replace(/(\d+(?:\.\d+)?)s?vh\b/g,(_,n)=>`${Number(n)*8}px`);
html=html.replace(/<style>([\s\S]*?)<\/style>/g,(_,css)=>`<style>${fixedHeight(css)}</style>`);
const mime={'.woff2':'font/woff2','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const embed=path=>`data:${mime[extname(path)]};base64,${readFileSync(resolve(dist,'.'+path)).toString('base64')}`;
// The export uses the same optimized project art at 480 px; the Astro route
// retains all responsive sources, original interactions and exact copy.
html=html.replace(/<img\b[^>]*>/g,tag=>{
 const src=tag.match(/\bsrc="([^"]+)"/)?.[1];
 const choices=tag.match(/\bsrcset="([^"]+)"/)?.[1];
 const chosen=choices?.split(',').map(s=>s.trim().split(/\s+/)).find(([,w])=>w==='480w')?.[0]||src;
 return tag.replace(/\bsrc="[^"]+"/,`src="${embed(chosen)}"`).replace(/\s(?:srcset|sizes|loading)="[^"]*"/g,'');
});
html=html.replace(/<link\b[^>]*>/g,tag=>{
 if(!tag.includes('rel="stylesheet"'))return '';
 const href=tag.match(/href="([^"]+)"/)[1];return `<style>${fixedHeight(readFileSync(resolve(dist,'.'+href),'utf8'))}</style>`;
});
html=html.replace(/url\(["']?(\/fonts\/[^)"']+)["']?\)/g,(_,p)=>`url(${embed(p)})`);
const modules=[];
html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g,(full,attrs,code)=>{
 if(!attrs.includes('type="module"'))return full;
 const src=attrs.match(/src="([^"]+)"/)?.[1];modules.push(src?`import '${src}';`:code);return '';
});
const result=await build({stdin:{contents:modules.map((_,i)=>`import 'study-inline:${i}';`).join('\n'),resolveDir:dist},bundle:true,write:false,format:'iife',minify:true,plugins:[{name:'embedded-modules',setup(b){
 b.onResolve({filter:/^study-inline:/},a=>({path:a.path,namespace:'inline'}));
 b.onLoad({filter:/.*/,namespace:'inline'},a=>({contents:modules[Number(a.path.split(':')[1])],loader:'js',resolveDir:dist}));
 b.onResolve({filter:/^\/_astro\//},a=>({path:resolve(dist,'.'+a.path)}));
}}]});
html=html.replace('</body>',`<script>${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body>`);
html=html.replace(/href="\/(?!\/)([^"]*)"/g,(_,p)=>`href="https://rohanth.com/${p}"`);
// Keep exact text visible immediately in the exported review.
html=html.replace(/\sdata-scramble-(?:in|hover)(?:="[^"]*")?/g,'');
// Contain the visual for an inline review, preserving the site's wave artwork.
// The surrounding thread retains its own theme and background.
html=html.replace(/<body\b[^>]*>/,tag=>tag+'<div class="review-root"><div class="review-page">').replace('</body>','</div></div></body>');

html=html.replace('</head>',`<style>
:root{--background:#f6f7f9;--foreground:#11141c;--radius:8px;--font-sans:Arial,sans-serif;--font-mono:'Geist Mono',monospace}
html,body{background:transparent;height:auto;min-height:0;scrollbar-gutter:auto}
.review-root{background:none;max-width:1500px;margin:0 auto}
.review-page{position:relative;isolation:isolate;overflow:hidden;padding:16px;border-radius:var(--radius);background:var(--paper)}
.wave-background{position:absolute!important}
[data-enter]{animation:none!important}
</style></head>`);
writeFileSync('public/iterations/left.html',html);
console.log(`Exported left-aligned study (${Math.round(Buffer.byteLength(html)/1024)} KB).`);
