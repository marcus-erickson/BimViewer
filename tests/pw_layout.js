// Layout test: sidebar navigation for Revit, IFC and scan results at desktop and phone width.
const { chromium } = require('playwright');
const path = require('path');
const SAMPLES = process.env.BIM_SAMPLES || 'samples';
const shots = process.env.SHOTS || '.';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('pako_inflate.min.js')) return r.fulfill({ path: require.resolve('pako/dist/pako_inflate.min.js'), contentType: 'application/javascript' });
    if (u.startsWith('file:')) return r.continue();
    return r.abort();
  });
  await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await pg.waitForSelector('#nav .navbtn');
  const names = async () => pg.$$eval('#nav .navbtn', b => b.map(x => x.textContent));
  const visible = async () => pg.$$eval('#out .screen', s => s.filter(x => !x.hidden).map(x => x.dataset.name));
  const fail = [];
  const expect = (c, m) => { if (!c) fail.push(m); };

  console.log('revit nav', await names(), 'visible', await visible());
  expect((await visible()).length === 1, 'revit: exactly one screen visible');
  await pg.click('#nav >> text=Readiness'); expect((await visible())[0] === 'Readiness', 'revit: Readiness opens');
  await pg.click('#nav >> text=Text and links'); expect(await pg.isVisible('#qtable table'), 'revit: text table visible');
  await pg.screenshot({ path: path.join(shots, 'layout_revit.png') });

  await pg.click('#out [data-go=ifc]').catch(() => {});
  await pg.waitForSelector('#nav >> text=Model contents');
  console.log('ifc nav', await names());
  await pg.click('#nav >> text=Elements'); expect(await pg.isVisible('#etable table'), 'ifc: elements visible');
  await pg.screenshot({ path: path.join(shots, 'layout_ifc.png') });

  await pg.setInputFiles('#dir', path.join(SAMPLES, 'BIM sample/L1_C106_Slices'));
  await pg.waitForSelector('#nav >> text=Sanity checks', { timeout: 90000 });
  console.log('scan nav', await names(), 'visible', await visible());
  expect(await pg.isVisible('#vcanvas') || (await visible())[0] !== '3D view', 'scan: canvas visible when 3D view is open');
  await pg.click('#nav >> text=3D view');
  await pg.waitForTimeout(500);
  const box = await pg.locator('#vcanvas').boundingBox();
  console.log('canvas', box && [Math.round(box.width), Math.round(box.height)]);
  expect(box && box.width > 500 && box.height > 350, 'scan: canvas has real size');
  const lit = async () => pg.evaluate(() => { const c = document.getElementById('vcanvas'); const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const x = t.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, t.width, t.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 40 || d[i + 1] > 40 || d[i + 2] > 40) n++; return n; });
  const n1 = await lit(); expect(n1 > 500, 'scan: 3D view draws points (' + n1 + ')');
  // pick an object, then check the selection panel sits beside the canvas
  let picked = false;
  for (let y = 0.2; y < 0.9 && !picked; y += 0.05) for (let x = 0.2; x < 0.85 && !picked; x += 0.05) {
    await pg.mouse.click(box.x + box.width * x, box.y + box.height * y); await pg.waitForTimeout(40);
    picked = (await pg.locator('#vclear').count()) > 0;
  }
  expect(picked, 'scan: click selects an object');
  await pg.screenshot({ path: path.join(shots, 'layout_scan3d.png') });
  // leave and return to the 3D view: still drawn
  await pg.click('#nav >> text=All objects'); expect(await pg.isVisible('#otable table'), 'scan: objects table visible');
  await pg.click('#nav >> text=3D view'); await pg.waitForTimeout(400);
  const n2 = await lit(); expect(n2 > 500, 'scan: 3D view still draws after switching back (' + n2 + ')');
  await pg.click('#nav >> text=Sanity checks');
  await pg.locator('[data-show]').first().click(); await pg.waitForTimeout(300);
  expect((await visible())[0] === '3D view', 'scan: Show in 3D switches to the 3D screen');
  expect((await pg.locator('#vsel').innerText()).includes('window'), 'scan: Show in 3D selects the flagged object');
  await pg.click('#nav >> text=Summary'); await pg.screenshot({ path: path.join(shots, 'layout_scansummary.png') });

  // phone width
  await pg.setViewportSize({ width: 390, height: 800 });
  await pg.waitForTimeout(300);
  const ow = await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  console.log('phone overflow check', ow);
  expect(ow[0] <= ow[1] + 1, 'phone: no horizontal page scroll');
  await pg.click('#nav >> text=3D view'); await pg.waitForTimeout(400);
  expect(await pg.isVisible('#vcanvas'), 'phone: canvas visible');
  await pg.screenshot({ path: path.join(shots, 'layout_phone.png') });
  console.log('errors', errs);
  if (errs.length) fail.push('page errors');
  await b.close();
  if (fail.length) { console.error('FAIL', fail); process.exit(1); } else console.log('ok');
})();
