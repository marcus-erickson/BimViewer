// Browser test for the Ask Claude screen with a fake `claude.use('sample')`.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await pg.route('**/*', r => { const u = r.request().url();
    if (u.includes('pako_inflate.min.js')) return r.fulfill({ path: require.resolve('pako/dist/pako_inflate.min.js'), contentType: 'application/javascript' });
    if (u.startsWith('file:')) return r.continue(); return r.abort(); });
  await pg.addInitScript(() => {
    window.__calls = [];
    const sample = async (input, opts) => {
      const rec = { turns: input.length, chars: input.reduce((a, t) => a + t.content.length, 0), tools: (opts.tools || []).map(t => t.name) };
      if (opts.tools && opts.tools.length) rec.toolResult = JSON.stringify(await opts.tools[0].execute(opts.tools[0].name === 'find_objects' ? { cls: 'chair' } : { cls: 'IfcDoor', missing: 'fire_rating' }, { signal: new AbortController().signal })).slice(0, 300);
      window.__calls.push(rec); opts.onText({ text: 'fake answer', delta: 'fake answer' }); return { text: 'fake answer', truncated: false };
    };
    sample.limits = async () => ({ maxPromptBytes: 262144, tools: { maxCount: 8 } });
    window.claude = { use: async n => (n === 'sample' ? sample : null) };
  });
  await pg.goto('file://' + __dirname + '/../dist/index.html');
  const fails = [];
  const expect = (c, m) => { if (!c) fails.push(m); };
  async function trySend(label, q) {
    await pg.click('#nav >> text=Ask Claude');
    await pg.waitForFunction(() => document.getElementById('chatin') && !document.getElementById('chatin').disabled);
    const digest = await pg.textContent('#chatdigest');
    console.log(label, 'digest chars', digest.length, '~tokens', Math.round(digest.length / 4));
    await pg.fill('#chatin', q); await pg.click('#chatsend');
    await pg.waitForFunction(() => document.querySelectorAll('.cb.ai').length && document.querySelector('.cb.ai:last-child').textContent === 'fake answer');
    const last = await pg.evaluate(() => window.__calls[window.__calls.length - 1]);
    console.log(label, JSON.stringify(last));
    return { digest, last };
  }
  let r = await trySend('revit', 'ready?');
  expect(/PROJECT INFORMATION/.test(r.digest) && !/GUID/i.test(r.digest), 'revit digest');
  await pg.click('[data-go=ifc]'); await pg.waitForSelector('#chatcard', { state: 'attached' });
  r = await trySend('ifc', 'doors without fire rating');
  expect(/CLASSES/.test(r.digest) && r.last.tools[0] === 'find_elements' && /total/.test(r.last.toolResult), 'ifc tool');
  await pg.setInputFiles('#dir', (process.env.BIM_SAMPLES || 'samples') + '/BIM sample/L1_C106_Slices');
  await pg.waitForSelector('#nav >> text=Sanity checks', { timeout: 90000 });
  r = await trySend('scan', 'chairs?');
  expect(/SANITY CHECK FLAGS/.test(r.digest) && r.last.tools[0] === 'find_objects' && /"total"/.test(r.last.toolResult), 'scan tool');
  expect(r.digest.length < 16000, 'scan digest size');
  await pg.setViewportSize({ width: 390, height: 800 });
  expect(await pg.evaluate(() => document.documentElement.scrollWidth <= 390), 'phone overflow');
  console.log('errors', errs, 'fails', fails);
  await b.close(); if (errs.length || fails.length) process.exit(1);
})();
