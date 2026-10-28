const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const pg=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text())}); pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako_inflate.min.js')) return r.fulfill({path:require.resolve('pako/dist/pako_inflate.min.js'),contentType:'application/javascript'});
  if(u.startsWith('file:')) return r.continue(); return r.abort();});
 await pg.goto('file://'+__dirname+'/../dist/index.html');
 await pg.waitForSelector('#qtable table',{state:'attached'});
 await pg.setInputFiles('#dir',(process.env.BIM_SAMPLES||'samples')+'/BIM sample/L1_C106_Slices');
 await pg.waitForSelector('#otable table',{state:'attached',timeout:60000});
 await pg.locator('#vcanvas').scrollIntoViewIfNeeded(); const box=await pg.locator('#vcanvas').boundingBox();
 let found=false;
 for(let y=0.2;y<0.9&&!found;y+=0.05)for(let x=0.2;x<0.85&&!found;x+=0.05){
   await pg.mouse.click(box.x+box.width*x,box.y+box.height*y); await pg.waitForTimeout(60);
   if(await pg.locator('#vclear').count()){found=true;console.log('picked at',x.toFixed(2),y.toFixed(2));}
 }
 console.log((await pg.textContent('#vsel')).slice(0,400));
 await pg.locator('#vcanvas').screenshot({path:'shot_pick.png'});
 await pg.check('#ovon'); await pg.waitForFunction(()=>/Auto-align put/.test(document.getElementById('ovstatus').textContent),{timeout:20000});
 console.log(await pg.textContent('#ovstatus'));
 await pg.waitForTimeout(300); await pg.locator('#vcanvas').screenshot({path:'shot_overlay.png'});
 await pg.fill('#ovx','1.5'); await pg.waitForTimeout(200);
 await pg.click('#ovrot'); await pg.waitForTimeout(200);
 await pg.locator('#vcanvas').screenshot({path:'shot_overlay2.png'});
 const ov=await pg.evaluate(()=>document.getElementById('ovrv').textContent+' '+document.getElementById('ovxv').textContent);
 console.log(ov,'errors',errs.slice(0,6)); await b.close();
})();
