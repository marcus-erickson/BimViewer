const fs=require('fs'); require('../src/ifc.js');
const r=IFC.readIfc(fs.readFileSync((process.env.BIM_SAMPLES||'samples')+'/BIM sample/L1_C106_IFC.ifc','utf8'));
console.log('scale',r.lengthScale,'geom',r.geom.length,r.geomError,'bounds',JSON.stringify(r.geomBounds));
const by={}; for(const g of r.geom) by[g.cls]=(by[g.cls]||0)+g.edges.length/6; console.log(by);
console.log('json bytes',JSON.stringify(r.geom).length);
for(const g of r.geom.filter(g=>g.cls==='IfcWallStandardCase').slice(0,4)){const e=g.edges;let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<e.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],e[i+k]);hi[k]=Math.max(hi[k],e[i+k]);}console.log(g.name.slice(0,40),lo.map(v=>v.toFixed(2)),hi.map(v=>v.toFixed(2)))}
