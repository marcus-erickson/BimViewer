/* RVT reader: OLE container, metadata, preview, compressed streams, name inventory. Needs pako (inflate). */
(function (root) {
  'use strict';
  const SIG = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  const END = 0xFFFFFFFA;

  function openOle(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    for (let i = 0; i < 8; i++) if (u8[i] !== SIG[i]) throw new Error('Not a Revit file: the OLE header is missing.');
    const ssz = 1 << dv.getUint16(30, true), mss = 1 << dv.getUint16(32, true);
    const nfat = dv.getUint32(44, true), dirStart = dv.getUint32(48, true);
    const cutoff = dv.getUint32(56, true), miniStart = dv.getUint32(60, true);
    let difat = dv.getUint32(68, true), ndifat = dv.getUint32(72, true);
    const off = i => (i + 1) * ssz;
    const dl = [];
    for (let i = 0; i < 109; i++) dl.push(dv.getUint32(76 + i * 4, true));
    while (difat < END && ndifat > 0) {
      const o = off(difat), n = ssz / 4;
      for (let i = 0; i < n - 1; i++) dl.push(dv.getUint32(o + i * 4, true));
      difat = dv.getUint32(o + (n - 1) * 4, true); ndifat--;
    }
    const fat = [];
    for (const s of dl) {
      if (s >= END) continue;
      const o = off(s);
      for (let i = 0; i < ssz / 4; i++) fat.push(dv.getUint32(o + i * 4, true));
    }
    function chainBytes(start, size) {
      const secs = [];
      let st = start, guard = 0;
      while (st < END && guard++ < 5e6) { secs.push(st); st = fat[st]; }
      const total = size == null ? secs.length * ssz : size;
      const out = new Uint8Array(total);
      let p = 0;
      for (const s of secs) {
        if (p >= total) break;
        const n = Math.min(ssz, total - p);
        out.set(u8.subarray(off(s), off(s) + n), p); p += n;
      }
      return out;
    }
    const dirBytes = chainBytes(dirStart, null);
    const ddv = new DataView(dirBytes.buffer);
    const ents = [];
    for (let i = 0; i < dirBytes.length / 128; i++) {
      const o = i * 128;
      const nl = ddv.getUint16(o + 64, true);
      let name = '';
      for (let k = 0; k < Math.max(nl - 2, 0); k += 2) name += String.fromCharCode(ddv.getUint16(o + k, true));
      ents.push({
        name, typ: dirBytes[o + 66], l: ddv.getUint32(o + 68, true), r: ddv.getUint32(o + 72, true),
        c: ddv.getUint32(o + 76, true), st: ddv.getUint32(o + 116, true),
        sz: ddv.getUint32(o + 120, true) + ddv.getUint32(o + 124, true) * 4294967296
      });
    }
    let mini = null, minifat = [];
    if (miniStart < END && ents[0]) {
      const mf = chainBytes(miniStart, null), mdv = new DataView(mf.buffer);
      for (let i = 0; i < mf.length / 4; i++) minifat.push(mdv.getUint32(i * 4, true));
      mini = chainBytes(ents[0].st, ents[0].sz);
    }
    const streams = {};
    (function walk(i, path) {
      if (i === 0xFFFFFFFF || i >= ents.length) return;
      const e = ents[i];
      walk(e.l, path);
      const p = path + '/' + e.name;
      if (e.typ === 2) streams[p] = e;
      if (e.typ === 1) walk(e.c, p);
      walk(e.r, path);
    })(ents[0].c, '');
    function read(path) {
      const e = streams[path];
      if (!e) return null;
      if (e.sz < cutoff && mini) {
        const out = new Uint8Array(e.sz);
        let st = e.st, p = 0, guard = 0;
        while (st < END && p < e.sz && guard++ < 1e6) {
          const n = Math.min(mss, e.sz - p);
          out.set(mini.subarray(st * mss, st * mss + n), p); p += n; st = minifat[st];
        }
        return out;
      }
      return chainBytes(e.st, e.sz);
    }
    return { streams, read, sectorSize: ssz, version: dv.getUint16(26, true) };
  }

  function findGzip(b, from, limit) {
    const end = Math.min(b.length - 10, limit == null ? b.length : limit);
    for (let i = from; i < end; i++) {
      if (b[i] === 0x1f && b[i + 1] === 0x8b && b[i + 2] === 8) return i;
    }
    return -1;
  }

  /* Inflate one raw-deflate run that starts at b[pos]; returns {data, next} where next is the byte after the run. */
  function inflateAt(b, pos) {
    const inf = new root.pako.Inflate({ raw: true });
    inf.push(b.subarray(pos), true);
    if (inf.err) throw new Error(inf.msg || 'inflate error');
    const left = inf.strm ? inf.strm.avail_in : 0;
    return { data: inf.result, next: b.length - left };
  }

  function inflateFirst(b) {
    const g = findGzip(b, 0, 64);
    if (g < 0) return null;
    try { return inflateAt(b, g + 10).data; } catch (e) { return null; }
  }

  async function* chunks(b) {
    let pos = 0;
    while (true) {
      const g = findGzip(b, pos);
      if (g < 0) return;
      try {
        const r = inflateAt(b, g + 10);
        pos = Math.max(r.next, g + 11);
        yield { data: r.data, at: g };
      } catch (e) { pos = g + 3; }
    }
  }

  function u16text(b, align) {
    const s = b.subarray(align, align + ((b.length - align) & ~1));
    return new TextDecoder('utf-16le').decode(s);
  }

  const clean = v => (v == null ? '' : v.replace(/[\u0000-\u001f]+$/g, '').trim());
  const isAscii = v => /^[\x20-\x7e]*$/.test(v);

  function parseBasicInfo(b) {
    const t0 = u16text(b, 0), t1 = u16text(b, 1);
    const labels = ['Worksharing', 'Username', 'Central Model Path', 'Format', 'Build', 'Last Save Path', 'Open Workset Default',
      'Project Spark File', 'Central Model Identity', 'Locale when saved', 'All Local Changes Saved To Central',
      "Central model's version number corresponding to the last reload latest",
      "Central model's episode GUID corresponding to the last reload latest",
      'Unique Document GUID', 'Unique Document Increments', 'Model Identity', 'IsSingleUserCloudModel', 'Author', 'ClientAppName'];
    const out = {};
    for (const L of labels) {
      const rx = new RegExp(L.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':[ \\t]*([^\\r\\n\\u0000]*)');
      for (const t of [t0, t1]) {
        const m = rx.exec(t);
        if (m && isAscii(clean(m[1]))) { out[L] = clean(m[1]); break; }
      }
    }
    const v = /^[^\d]{0,24}(20\d\d)/.exec(t0.replace(/[\u0000-\u001f]/g, ' '));
    out.__version = v ? v[1] : null;
    const bm = /(\d{8}_\d{4}\(x\d+\))/.exec(t0);
    out.__build = bm ? bm[1] : out.Build || null;
    const pm = /[A-Za-z]:\\[^\u0000-\u001f]*?\.rv[tf]/.exec(t0);
    out.__path = pm ? pm[0] : out['Last Save Path'] || null;
    return out;
  }

  function readZipFirst(b) {
    if (!b || b[0] !== 0x50 || b[1] !== 0x4b) return null;
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const method = dv.getUint16(8, true), csize = dv.getUint32(18, true);
    const nlen = dv.getUint16(26, true), elen = dv.getUint16(28, true);
    let name = '';
    for (let i = 0; i < nlen; i++) name += String.fromCharCode(b[30 + i]);
    const start = 30 + nlen + elen;
    const raw = csize ? b.subarray(start, start + csize) : b.subarray(start);
    const data = method === 8 ? root.pako.inflateRaw(raw) : raw;
    return { name, data };
  }

  function findPng(b) {
    for (let i = 0; i < b.length - 8; i++) {
      if (b[i] === 0x89 && b[i + 1] === 0x50 && b[i + 2] === 0x4e && b[i + 3] === 0x47) return i;
    }
    return -1;
  }

  function toBase64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function scanStrings(u8, map, cap) {
    const n = u8.length - 1;
    let i = 0;
    while (i < n) {
      const c = u8[i];
      if (c >= 0x20 && c < 0x7f && u8[i + 1] === 0) {
        let j = i, s = '', letters = 0;
        while (j < n && u8[j] >= 0x20 && u8[j] < 0x7f && u8[j + 1] === 0) {
          const ch = u8[j];
          if ((ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122)) letters++;
          s += String.fromCharCode(ch); j += 2;
          if (s.length > 200) break;
        }
        if (s.length >= 4 && letters >= 3) {
          const cur = map.get(s);
          if (cur !== undefined) map.set(s, cur + 1);
          else if (map.size < cap) map.set(s, 1);
        }
        i = j;
      } else i++;
    }
  }

  const tick = () => new Promise(r => setTimeout(r, 0));

  async function parseRvt(buf, name, onProgress) {
    const say = (m, f) => { if (onProgress) onProgress(m, f); };
    say('Opening container', 0.02); await tick();
    const ole = openOle(buf);
    const res = { fileName: name || 'model.rvt', fileSize: buf.byteLength, container: [], info: {}, thumb: null, projectInfo: null, projectInfoName: null, external: null };

    const bi = ole.read('/BasicFileInfo');
    if (bi) res.info = parseBasicInfo(bi);

    const pv = ole.read('/RevitPreview4.0');
    if (pv) {
      const k = findPng(pv);
      if (k >= 0) {
        const png = pv.subarray(k);
        const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
        res.thumb = { w: dv.getUint32(16), h: dv.getUint32(20), bytes: png.length, data: 'data:image/png;base64,' + toBase64(png) };
      }
    }

    try {
      const z = readZipFirst(ole.read('/ProjectInformation'));
      if (z) { res.projectInfoName = z.name; res.projectInfo = new TextDecoder('utf-8').decode(z.data); }
    } catch (e) { res.projectInfoError = String(e.message || e); }

    const td = ole.read('/TransmissionData');
    if (td && td.length > 8) {
      const t = u16text(td.subarray(4), 0);
      res.external = t;
    }

    const map = new Map();
    const paths = Object.keys(ole.streams);
    let done = 0;
    for (const p of paths) {
      const size = ole.streams[p].sz;
      const row = { path: p, bytes: size, inflated: null, parts: null };
      const isPart = p.startsWith('/Partitions/');
      const big = isPart || p.startsWith('/Global/') || p.startsWith('/Formats/') || p === '/Contents';
      if (big) {
        const b = ole.read(p);
        say('Reading ' + p, 0.08 + 0.9 * (done / paths.length)); await tick();
        if (isPart) {
          let total = 0, n = 0;
          for await (const c of chunks(b)) {
            total += c.data.length; n++;
            scanStrings(c.data, map, 600000);
            if (n % 40 === 0) { say('Reading ' + p + ' (' + n + ' blocks)', 0.08 + 0.9 * ((done + Math.min(0.95, c.at / b.length)) / paths.length)); await tick(); }
          }
          row.inflated = total; row.parts = n;
        } else {
          const d = inflateFirst(b);
          if (d) { row.inflated = d.length; scanStrings(d, map, 600000); }
        }
      }
      res.container.push(row);
      done++;
    }
    res.strings = map;
    say('Done', 1);
    return res;
  }

  /* ---- Name inventory ---- */
  const CATEGORIES = ['Walls', 'Floors', 'Roofs', 'Ceilings', 'Doors', 'Windows', 'Curtain Panels', 'Curtain Wall Mullions', 'Stairs', 'Railings', 'Ramps',
    'Columns', 'Structural Columns', 'Structural Framing', 'Structural Foundations', 'Structural Rebar', 'Structural Connections', 'Casework', 'Furniture', 'Furniture Systems',
    'Plumbing Fixtures', 'Mechanical Equipment', 'Electrical Equipment', 'Electrical Fixtures', 'Lighting Fixtures', 'Air Terminals', 'Ducts', 'Duct Fittings',
    'Duct Accessories', 'Flex Ducts', 'Pipes', 'Pipe Fittings', 'Pipe Accessories', 'Flex Pipes', 'Cable Tray', 'Conduit', 'Sprinklers', 'Fire Alarm Devices',
    'Communication Devices', 'Data Devices', 'Security Devices', 'Telephone Devices', 'Nurse Call Devices', 'Lighting Devices', 'Specialty Equipment', 'Generic Models',
    'Site', 'Topography', 'Planting', 'Parking', 'Entourage', 'Rooms', 'Areas', 'Spaces', 'Grids', 'Levels', 'Mass', 'Parts', 'Assemblies', 'Detail Items', 'Piping Systems', 'Duct Systems'];
  const VIEW_KINDS = [
    ['Floor Plan', /^Floor Plans?$/], ['Ceiling Plan', /^Ceiling Plans?$/], ['Structural Plan', /^Structural Plans?$/], ['3D View', /^3D Views?$/],
    ['Elevation', /^Elevations?( \d+)?$/], ['Section', /^Sections?( \d+)?$/], ['Detail View', /^Detail Views?( \d+)?$/], ['Drafting View', /^Drafting Views?( \d+)?$/],
    ['Legend', /^Legends?$/], ['Schedule', /^Schedules?$/], ['Sheet', /^Sheets?$/], ['Area Plan', /^Area Plans?$/], ['Walkthrough', /^Walkthroughs?( \d+)?$/]];

  function analyze(map) {
    const get = k => map.get(k) || 0;
    const out = { categories: [], viewKinds: [], levels: [], families: [], units: [], specs: [], groups: [], total: map.size };
    for (const c of CATEGORIES) { const n = get(c); if (n) out.categories.push({ name: c, mentions: n }); }
    for (const [label, rx] of VIEW_KINDS) {
      let n = 0, ex = [];
      for (const [k, v] of map) if (rx.test(k)) { n += v; if (ex.length < 3 && k !== label) ex.push(k); }
      if (n) out.viewKinds.push({ name: label, mentions: n, examples: ex.join(', ') });
    }
    const lvl = /^(Level \d{1,2}|Ground [Ff]loor|Lower Ref\.? Level|Upper Ref\.? Level|Roof Level|Basement|Mezzanine)$/;
    const fam = /^M_[A-Za-z0-9][\w\-\.\(\) ]{2,60}$/;
    for (const [k, v] of map) {
      if (lvl.test(k)) out.levels.push({ name: k, mentions: v });
      else if (fam.test(k)) out.families.push({ name: k, mentions: v });
      let m;
      if ((m = /^autodesk\.unit\.unit:([A-Za-z0-9]+)-/.exec(k))) out.units.push({ name: m[1], mentions: v });
      else if ((m = /^autodesk\.spec\.([\w.]+):([A-Za-z0-9]+)-/.exec(k))) out.specs.push({ name: m[2], mentions: v, area: m[1] });
      else if ((m = /^autodesk\.parameter\.group:([A-Za-z0-9]+)-/.exec(k))) out.groups.push({ name: m[1], mentions: v });
    }
    const byM = (a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name);
    for (const key of ['categories', 'viewKinds', 'levels', 'families', 'units', 'specs', 'groups']) out[key].sort(byM);
    return out;
  }

  const xdec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

  function parseProjectXml(xml) {
    if (!xml) return { meta: {}, fields: [] };
    const first = (rx) => { const m = rx.exec(xml); return m ? xdec(m[1]) : ''; };
    const meta = {
      title: first(/<title>([^<]*)<\/title>/),
      updated: first(/<updated>([^<]*)<\/updated>/),
      product: first(/<A:product>([^<]*)<\/A:product>/),
      version: first(/<A:product-version>([^<]*)<\/A:product-version>/)
    };
    const fields = [];
    const rx = /<([A-Za-z_][\w\-]*)\s[^>]*?displayName="([^"]*)"[^>]*>([^<]*)</g;
    let m;
    while ((m = rx.exec(xml))) fields.push({ name: xdec(m[2]), value: xdec(m[3]) });
    return { meta, fields };
  }

  function parseExternal(xml) {
    if (!xml) return [];
    const out = [];
    const rx = /<ExternalFileReference>([\s\S]*?)<\/ExternalFileReference>/g;
    let m;
    const tag = (s, t) => { const r = new RegExp('<' + t + '>([^<]*)</' + t + '>').exec(s); return r ? xdec(r[1]) : ''; };
    while ((m = rx.exec(xml))) {
      out.push({
        type: tag(m[1], 'ExternalFileReferenceType'), path: tag(m[1], 'LastSavedPath'),
        absolute: tag(m[1], 'LastSavedAbsolutePath'), state: tag(m[1], 'LastSavedLoadState'), pathType: tag(m[1], 'LastSavedPathType')
      });
    }
    return out;
  }

  /* Plain object the page renders (JSON-safe). maxStrings caps the text list kept. */
  /* Submittal-readiness signals. Names are matched allowing one stray trailing character, since stored labels carry length bytes. */
  const READY = [
    ['Manufacturer', /^Manufacturer.?$/, 'Names the maker of a product. The core field of a submittal.'],
    ['Model', /^Model.?$/, 'The product model number, which pins down the exact item.'],
    ['Type Mark', /^Type Mark.?$/, 'Short code that ties a type to schedules and drawings.'],
    ['Mark', /^Mark.?$/, 'Tag on a single placed element.'],
    ['Keynote', /^Keynote( Number| Text)?.?$/, 'Links an element to a numbered note, often a spec section.'],
    ['Assembly Code', /^Assembly (Code|Description).?$/, 'Uniformat code that groups elements by building system.'],
    ['OmniClass', /^OmniClass (Number|Title|Table \d+ (Number|Title)).?$/, 'Classification numbers and titles used to organize products.'],
    ['Fire Rating', /^Fire Rating.?$/, 'Rating for walls and doors, which usually needs submittals.'],
    ['URL', /^URL.?$/, 'Link to product data.'],
    ['Cost', /^Cost.?$/, 'Unit cost of a type.'],
    ['Type Comments', /^Type Comments.?$/, 'Notes at the type level, often holding product notes.'],
    ['Description', /^Description.?$/, 'Free-text product description.']
  ];
  function readiness(map, ext) {
    const items = READY.map(([name, rx, why]) => {
      let n = 0, seen = [];
      for (const [k, v] of map) if (k.length < 40 && rx.test(k)) { n += v; if (seen.length < 3 && !seen.includes(k)) seen.push(k); }
      return { name, why, mentions: n, seen: n > 0, examples: seen.join(', ') };
    });
    const find = t => (ext || []).find(e => e.type === t);
    const kt = find('Keynote Table'), at = find('Assembly Code Table');
    const tables = [
      { name: 'Keynote table', file: kt ? kt.path : '', state: kt ? kt.state : '' },
      { name: 'Assembly code (Uniformat) table', file: at ? at.path : '', state: at ? at.state : '' }
    ];
    return { items, tables, found: items.filter(i => i.seen).length, total: items.length };
  }

  function viewModel(res, maxStrings) {
    const a = analyze(res.strings);
    const all = Array.from(res.strings.entries()).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
    const proj = parseProjectXml(res.projectInfo);
    const ext = parseExternal(res.external);
    return {
      fileName: res.fileName, fileSize: res.fileSize, info: res.info, thumb: res.thumb,
      project: proj, external: ext, container: res.container,
      analysis: a, readiness: readiness(res.strings, ext),
      totalStrings: all.length, strings: maxStrings ? all.slice(0, maxStrings) : all
    };
  }

  root.RVT = { parseRvt, analyze, openOle, scanStrings, viewModel, parseProjectXml, parseExternal };
})(typeof window !== 'undefined' ? window : globalThis);
