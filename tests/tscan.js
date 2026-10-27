const fs=require('fs'),path=require('path'); require('../src/scan.js');
const root=(process.env.BIM_SAMPLES||'samples')+'/BIM sample/L1_C106_Slices';
const files=[];
(function walk(d,rel){for(const n of fs.readdirSync(d)){const p=path.join(d,n);const r=rel+'/'+n;if(fs.statSync(p).isDirectory())walk(p,r);else{const buf=fs.readFileSync(p);const f=new File([buf],n);Object.defineProperty(f,'webkitRelativePath',{value:'L1_C106_Slices'+r});files.push(f);}}})(root,'');
(async()=>{
 const t=Date.now();
 const res=await SCAN.scanFolder(files,{step:+process.argv[2]||1});
 console.log('files',res.objs.length,'sec',(Date.now()-t)/1000);
 const f=n=>n.toFixed(2);
 for(const o of res.objs) console.log(o.slice,o.name.padEnd(12),String(o.points).padStart(7),'size',o.size.map(f).join(' x '),'z',f(o.min[2]),'..',f(o.max[2]),'rgb',o.rgb.map(Math.round).join(','));
 console.log(JSON.stringify(res.summary.room), JSON.stringify(res.summary.slices.map(s=>[s.slice,s.objects,s.points,s.ext&&s.ext.min.map(f),s.ext&&s.ext.max.map(f)])));
 console.log(res.summary.classes.map(c=>c.cls+':'+c.segments+' med '+c.medSize.map(f).join('x')).join('\n'));
})();
