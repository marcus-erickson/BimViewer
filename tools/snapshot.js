// Turn an .rvt or .ifc file into a snapshot the viewer can open pre-filled.
//   node tools/snapshot.js <file.rvt|file.ifc> [out.json]
// Then: python3 build.py --snapshot out.json --fragment page.html
const fs = require('fs'), path = require('path');
globalThis.pako = require('pako');
require('../src/rvt.js'); require('../src/ifc.js');
(async () => {
  const file = process.argv[2], out = process.argv[3] || 'snapshot.json';
  if (!file) { console.error('usage: node tools/snapshot.js <file.rvt|file.ifc> [out.json]'); process.exit(2); }
  const name = path.basename(file), size = fs.statSync(file).size, ext = path.extname(file).toLowerCase();
  let snap;
  if (ext === '.ifc') {
    const r = IFC.readIfc(fs.readFileSync(file, 'utf8')); r.fileName = name; r.fileSize = size;
    if (r.geom && JSON.stringify(r.geom).length > 4e6) { delete r.geom; delete r.geomBounds; }   // keep the page small; the outline needs a scan anyway
    snap = { kind: 'ifc', name, size, data: r };
  } else if (ext === '.rvt') {
    const b = fs.readFileSync(file);
    const res = await RVT.parseRvt(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), name);
    snap = { kind: 'revit', name, size, data: RVT.viewModel(res, 0) };
  } else { console.error('Only .rvt and .ifc files are supported here.'); process.exit(2); }
  snap.analyzedAt = new Date().toISOString();
  fs.writeFileSync(out, JSON.stringify(snap));
  console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB', snap.kind);
})().catch(e => { console.error('Could not read this file:', e.message); process.exit(1); });
