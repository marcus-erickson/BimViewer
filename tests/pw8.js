const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERR '+e.message)); pg.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED/.test(m.text()))errs.push(m.text())});
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako_inflate.min.js')) return r.fulfill({path:require.resolve('pako/dist/pako_inflate.min.js'),contentType:'application/javascript'});
  if(u.startsWith('file:')) return r.continue(); return r.abort();});
 await pg.goto('file://'+__dirname+'/../dist/index.html');
 await pg.waitForSelector('#qtable table',{state:'attached'});
 await pg.setInputFiles('#dir',(process.env.BIM_SAMPLES||'samples')+'/BIM sample/L1_C106_Slices');
 await pg.waitForSelector('#otable table',{state:'attached',timeout:60000});
 await pg.click('#nav >> text=Sanity checks'); console.log(await pg.locator('#qaflags').innerText());
 await pg.locator('[data-show]').first().click(); await pg.waitForTimeout(500);
 console.log((await pg.textContent('#vsel')).slice(0,200));
 await pg.click('#nav >> text=All objects'); await pg.check('#oflag'); console.log(await pg.textContent('#ocount'));
 await pg.setViewportSize({width:390,height:800}); console.log(await pg.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]));
 console.log('errors',errs); await b.close();
})();
