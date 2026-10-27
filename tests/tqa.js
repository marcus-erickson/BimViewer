const fs=require('fs'),path=require('path'); require('../src/scan.js');
const root=(process.env.BIM_SAMPLES||'samples')+'/BIM sample/L1_C106_Slices';
const files=[];
(function walk(d,rel){for(const n of fs.readdirSync(d)){const p=path.join(d,n);const r=rel+'/'+n;if(fs.statSync(p).isDirectory())walk(p,r);else{const buf=fs.readFileSync(p);const f=new File([buf],n);Object.defineProperty(f,'webkitRelativePath',{value:'L1_C106_Slices'+r});files.push(f);}}})(root,'');
(async()=>{
 const res=await SCAN.scanFolder(files,{step:1}); const q=res.qa;
 console.log('floor',q.floor.toFixed(2),'objs',q.total,'flagged',q.flagged.length);
 console.log(q.rules.map(r=>r.sev+' '+r.rule+' '+r.n).join('\n'));
 for(const o of q.flagged) console.log(o.slice+'/'+o.name, q.flags.get(o).map(x=>x.rule).join('; '));
})();
