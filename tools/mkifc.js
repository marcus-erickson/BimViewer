const fs=require('fs'); require('../src/ifc.js');
const f=(process.env.BIM_SAMPLES||'samples')+'/BIM sample/L1_C106_IFC.ifc';
const r=IFC.readIfc(fs.readFileSync(f,'utf8')); r.fileName='L1_C106_IFC.ifc'; r.fileSize=fs.statSync(f).size;
fs.writeFileSync(__dirname+'/../data/sample_ifc.json',JSON.stringify(r)); console.log(fs.statSync(__dirname+'/../data/sample_ifc.json').size);
