const fs=require('fs');
globalThis.pako=require('pako');
require('../src/rvt.js');
const D=(process.env.BIM_SAMPLES||'samples')+'/Revit Sample projects/';
(async()=>{
 for(const f of (process.argv[2]?[process.argv[2]]:fs.readdirSync(D))){
  const b=fs.readFileSync(D+f); const ab=b.buffer.slice(b.byteOffset,b.byteOffset+b.length);
  const t=Date.now();
  const r=await RVT.parseRvt(ab,f);
  const a=RVT.analyze(r.strings);
  console.log('=====',f,((Date.now()-t)/1000).toFixed(1)+'s','strings',r.strings.size);
  console.log(JSON.stringify(r.info,null,0).slice(0,900));
  console.log('thumb',r.thumb&&[r.thumb.w,r.thumb.h,r.thumb.bytes]);
  console.log('projinfo',r.projectInfoName,(r.projectInfo||'').length, r.projectInfoError);
  console.log((r.projectInfo||'').slice(0,1500));
  console.log('external',(r.external||'').slice(0,700));
  console.log(r.container.map(c=>c.path+' '+c.bytes+' -> '+c.inflated+(c.parts?(' ('+c.parts+' blocks)'):'')).join('\n'));
  console.log('cats',a.categories.map(x=>x.name+':'+x.mentions).join(', '));
  console.log('views',a.viewKinds.map(x=>x.name+':'+x.mentions).join(', '));
  console.log('levels',a.levels.map(x=>x.name+':'+x.mentions).join(', '));
  console.log('fams',a.families.length,a.families.slice(0,8).map(x=>x.name).join(' | '));
  console.log('units',a.units.slice(0,6).map(x=>x.name).join(','),'groups',a.groups.length,'specs',a.specs.length);
 }
})().catch(e=>{console.error(e);process.exit(1)});
