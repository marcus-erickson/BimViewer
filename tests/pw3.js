const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako_inflate.min.js')) return r.fulfill({path:require.resolve('pako/dist/pako_inflate.min.js'),contentType:'application/javascript'});
  if(u.startsWith('file:')) return r.continue(); return r.abort();});
 await pg.goto('file://'+__dirname+'/../dist/index.html');
 await pg.waitForSelector('#qtable table',{state:'attached'});
 await pg.setInputFiles('#dir',(process.env.BIM_SAMPLES||'samples')+'/BIM sample/L1_C106_Slices');
 await pg.waitForSelector('#otable table',{state:'attached',timeout:60000});
 console.log(await pg.textContent('#sstatus'));
 console.log(await pg.textContent('#ocount'));
 await pg.click('#nav >> text=All objects'); await pg.fill('#oq','chair'); console.log('chair',await pg.textContent('#ocount'));
 await pg.click('#otable tr.row'); 
 await pg.screenshot({path:'shot_scan.png',fullPage:true});
 // wrong folder
 await pg.setInputFiles('#dir',(process.env.BIM_SAMPLES||'samples')+'/BIM sample/L1_C106_pano');
 await pg.waitForTimeout(500); console.log(await pg.textContent('#sstatus'));
 console.log('errors',errs); await b.close();
})();
