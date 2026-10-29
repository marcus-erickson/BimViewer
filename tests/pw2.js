const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako_inflate.min.js')) return r.fulfill({path:require.resolve('pako/dist/pako_inflate.min.js'),contentType:'application/javascript'});
  if(u.startsWith('file:')) return r.continue(); return r.abort();});
 await pg.goto('file://'+__dirname+'/../dist/index.html');
 await pg.waitForSelector('#qtable table',{state:'attached'});
 await pg.click('[data-go=ifc]'); await pg.waitForSelector('#etable table',{state:'attached'});
 await pg.click('#nav >> text=Elements'); await pg.click('#etable tr.row');
 console.log('sample ifc rows',await pg.textContent('#ecount'));
 await pg.screenshot({path:'shot_ifc_sample.png',fullPage:true});
 // live load
 await pg.setInputFiles('#file',(process.env.BIM_SAMPLES||'samples')+'/BIM sample/L1_C106_IFC.ifc');
 await pg.waitForFunction(()=>document.getElementById('loadedline').textContent.includes('L1_C106_IFC.ifc')||document.getElementById('status').className.includes('err'));
 console.log(await pg.textContent('#status'), await pg.textContent('#ecount'));
 await pg.fill('#eq','fire'); console.log('fire filter',await pg.textContent('#ecount'));
 await pg.setInputFiles('#file',(process.env.BIM_SAMPLES||'samples')+'/Revit Sample projects/rstbasicsampleproject.rvt');
 await pg.waitForFunction(()=>document.getElementById('loadedline').textContent.includes('rstbasicsampleproject.rvt'));
 console.log('rvt ok', await pg.textContent('#status'));
 await pg.setViewportSize({width:390,height:800});
 console.log('overflow390', await pg.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth));
 console.log('errors',errs); await b.close();
})();
