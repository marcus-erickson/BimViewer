const fs=require('fs');
globalThis.pako=require('pako');
require('../src/rvt.js');
const D=(process.env.BIM_SAMPLES||'samples')+'/Revit Sample projects/';
(async()=>{
  const f='racbasicsampleproject.rvt';
  const b=fs.readFileSync(D+f);
  const r=await RVT.parseRvt(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),f);
  const vm=RVT.viewModel(r,1200); vm.sample=true;
  fs.writeFileSync(__dirname+'/../data/sample.json',JSON.stringify(vm));
  console.log(fs.statSync(__dirname+'/../data/sample.json').size, vm.project.fields.length, vm.external.length, vm.analysis.families.length);
  console.log(vm.project.meta, vm.external.map(e=>e.type+': '+e.path+' ['+e.state+']'));
})();
