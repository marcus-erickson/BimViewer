/* Scan inventory: streams classified point files (x y z r g b intensity per line) and measures each object. */
(function (root) {
  'use strict';
  const CHUNK = 16 * 1024 * 1024;
  const RES = 1500;
  const tick = () => new Promise(r => setTimeout(r, 0));

  function parseName(path) {
    const parts = path.split('/');
    const file = parts[parts.length - 1], parent = parts[parts.length - 2] || '';
    const m = /^([A-Za-z][A-Za-z_]*?)_(\d+)\.txt$/.exec(file);
    if (!m || !/^S\d+$/i.test(parent)) return null;
    return { cls: m[1].toLowerCase(), idx: +m[2], slice: parent.toUpperCase() };
  }

  /* Read up to 7 numbers from u8[s..e). Returns the count read. */
  function parseLine(u8, s, e, out) {
    let i = s, k = 0, c;
    while (i < e && k < 7) {
      while (i < e && (u8[i] === 32 || u8[i] === 9 || u8[i] === 13)) i++;
      if (i >= e) break;
      let neg = false;
      c = u8[i];
      if (c === 45) { neg = true; i++; } else if (c === 43) i++;
      let v = 0, any = false;
      while (i < e && (c = u8[i]) >= 48 && c <= 57) { v = v * 10 + c - 48; i++; any = true; }
      if (i < e && u8[i] === 46) {
        i++;
        let f = 0.1;
        while (i < e && (c = u8[i]) >= 48 && c <= 57) { v += (c - 48) * f; f /= 10; i++; any = true; }
      }
      if (!any) return k;
      out[k++] = neg ? -v : v;
      while (i < e && u8[i] !== 32 && u8[i] !== 9) i++;
    }
    return k;
  }

  function pct(arr, p) {
    if (!arr.length) return 0;
    const a = Float64Array.from(arr).sort();
    const i = Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))));
    return a[i];
  }

  async function scanFile(file, step, onBytes, collect) {
    const st = {
      points: 0, sampled: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity],
      sum: [0, 0, 0], rgb: [0, 0, 0], inten: 0
    };
    const rx = [], ry = [], rz = [];
    const cap = collect ? Math.max(1500, Math.min(120000, Math.round(file.size / 3000))) : 0;
    const px = new Float32Array(cap * 3), pc = new Uint8Array(cap * 3);
    let pn = 0, keep = 1, kc = 0;
    if (cap) step = Math.max(1, Math.min(step, Math.floor(file.size / 40 / cap)));
    const tmp = new Float64Array(7);
    let carry = null;
    const handle = (u8, s, e) => {
      if (e - s < 5) return;
      st.points++;
      if (step > 1 && st.points % step !== 0) return;
      const k = parseLine(u8, s, e, tmp);
      if (k < 3) return;
      const x = tmp[0], y = tmp[1], z = tmp[2];
      st.sampled++;
      if (x < st.min[0]) st.min[0] = x; if (x > st.max[0]) st.max[0] = x;
      if (y < st.min[1]) st.min[1] = y; if (y > st.max[1]) st.max[1] = y;
      if (z < st.min[2]) st.min[2] = z; if (z > st.max[2]) st.max[2] = z;
      st.sum[0] += x; st.sum[1] += y; st.sum[2] += z;
      if (k >= 6) { st.rgb[0] += tmp[3]; st.rgb[1] += tmp[4]; st.rgb[2] += tmp[5]; }
      if (k >= 7) st.inten += tmp[6];
      if (cap) {
        kc++;
        if (kc % keep === 0) {
          if (pn >= cap) {
            let w = 0;
            for (let r = 0; r < pn; r += 2, w++) { px[w * 3] = px[r * 3]; px[w * 3 + 1] = px[r * 3 + 1]; px[w * 3 + 2] = px[r * 3 + 2]; pc[w * 3] = pc[r * 3]; pc[w * 3 + 1] = pc[r * 3 + 1]; pc[w * 3 + 2] = pc[r * 3 + 2]; }
            pn = w; keep *= 2;
          }
          if (kc % keep === 0) {
            px[pn * 3] = x; px[pn * 3 + 1] = y; px[pn * 3 + 2] = z;
            if (k >= 6) { pc[pn * 3] = tmp[3]; pc[pn * 3 + 1] = tmp[4]; pc[pn * 3 + 2] = tmp[5]; } else { pc[pn * 3] = pc[pn * 3 + 1] = pc[pn * 3 + 2] = 180; }
            pn++;
          }
        }
      }
      if (rx.length < RES) { rx.push(x); ry.push(y); rz.push(z); }
      else { const j = Math.floor(Math.random() * st.sampled); if (j < RES) { rx[j] = x; ry[j] = y; rz[j] = z; } }
    };
    for (let off = 0; off < file.size; off += CHUNK) {
      const u8 = new Uint8Array(await file.slice(off, Math.min(file.size, off + CHUNK)).arrayBuffer());
      let pos = 0;
      if (carry) {
        const nl = u8.indexOf(10);
        if (nl < 0) { const c2 = new Uint8Array(carry.length + u8.length); c2.set(carry); c2.set(u8, carry.length); carry = c2; continue; }
        const line = new Uint8Array(carry.length + nl); line.set(carry); line.set(u8.subarray(0, nl), carry.length);
        handle(line, 0, line.length); pos = nl + 1; carry = null;
      }
      const n = u8.length;
      while (pos < n) {
        const nl = u8.indexOf(10, pos);
        if (nl < 0) { carry = u8.slice(pos); break; }
        handle(u8, pos, nl); pos = nl + 1;
      }
      if (onBytes) onBytes(Math.min(file.size, off + CHUNK));
      await tick();
    }
    if (carry && carry.length) handle(carry, 0, carry.length);
    const m = Math.max(1, st.sampled);
    const p1 = [pct(rx, 0.01), pct(ry, 0.01), pct(rz, 0.01)], p99 = [pct(rx, 0.99), pct(ry, 0.99), pct(rz, 0.99)];
    return {
      points: st.points, sampled: st.sampled, min: st.min.map(v => isFinite(v) ? v : 0), max: st.max.map(v => isFinite(v) ? v : 0),
      mean: st.sum.map(v => v / m), rgb: st.rgb.map(v => v / m), inten: st.inten / m, p1, p99,
      size: [p99[0] - p1[0], p99[1] - p1[1], p99[2] - p1[2]],
      pts: cap ? { n: pn, xyz: px.slice(0, pn * 3), rgb: pc.slice(0, pn * 3) } : null
    };
  }

  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

  function summarize(objs) {
    const byCls = new Map();
    for (const o of objs) {
      let c = byCls.get(o.cls);
      if (!c) byCls.set(o.cls, c = { cls: o.cls, objs: [], slices: {} });
      c.objs.push(o); c.slices[o.slice] = (c.slices[o.slice] || 0) + 1;
    }
    const classes = Array.from(byCls.values()).map(c => ({
      cls: c.cls, segments: c.objs.length, points: c.objs.reduce((a, o) => a + o.points, 0), slices: c.slices,
      medSize: [0, 1, 2].map(i => median(c.objs.map(o => o.size[i]))),
      zMin: Math.min.apply(null, c.objs.map(o => o.p1[2])), zMax: Math.max.apply(null, c.objs.map(o => o.p99[2])),
      rgb: [0, 1, 2].map(i => Math.round(c.objs.reduce((a, o) => a + o.rgb[i] * o.points, 0) / Math.max(1, c.objs.reduce((a, o) => a + o.points, 0))))
    })).sort((a, b) => b.points - a.points);

    const wmean = (list, i) => { const t = list.reduce((a, o) => a + o.points, 0); return t ? list.reduce((a, o) => a + o.mean[i] * o.points, 0) / t : null; };
    const floor = objs.filter(o => o.cls === 'floor'), ceil = objs.filter(o => o.cls === 'ceiling');
    const shell = objs.filter(o => ['floor', 'ceiling', 'wall'].includes(o.cls));
    const ext = list => list.length ? {
      min: [0, 1, 2].map(i => Math.min.apply(null, list.map(o => o.p1[i]))), max: [0, 1, 2].map(i => Math.max.apply(null, list.map(o => o.p99[i])))
    } : null;
    const room = { floorZ: wmean(floor, 2), ceilZ: wmean(ceil, 2), shell: ext(shell) };
    if (room.floorZ != null && room.ceilZ != null) room.height = room.ceilZ - room.floorZ;

    const sl = new Map();
    for (const o of objs) { let s = sl.get(o.slice); if (!s) sl.set(o.slice, s = []); s.push(o); }
    const slices = Array.from(sl.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([k, list]) => ({
      slice: k, objects: list.length, points: list.reduce((a, o) => a + o.points, 0), ext: ext(list), classes: new Set(list.map(o => o.cls)).size
    }));
    return { classes, room, slices };
  }


  /* QA: flag segments whose size or height does not fit their class label. Heights are relative to the floor. */
  const RULES = {
    window: { bottomMin: 0.3, note: 'Windows normally start well above the floor' },
    chair: { hMin: 0.3, hMax: 1.5, dimMax: 1.2, bottomMax: 0.4 },
    table: { hMin: 0.4, hMax: 1.4, bottomMax: 0.4 },
    desk: { hMin: 0.4, hMax: 1.4, bottomMax: 0.4 },
    door: { hMin: 1.5, hMax: 2.8, bottomMax: 0.4, dimMax: 3 },
    light: { bottomMin: 1.4 },
    projector: { bottomMin: 1.4 },
    sign: { bottomMin: 1.2 },
    exit: { bottomMin: 1.2 },
    floor: { topMax: 0.35 },
    ceiling: { bottomMin: 1.8 }
  };
  function qa(objs, room) {
    const fl = objs.filter(o => o.cls === 'floor' && o.points >= 100);
    const floor = fl.length ? Math.min.apply(null, fl.map(o => o.p1[2])) : (room && room.floorZ != null ? room.floorZ : (room && room.shell ? room.shell.min[2] : 0));
    const flags = new Map();
    const add = (o, rule, sev, msg) => { let a = flags.get(o); if (!a) flags.set(o, a = []); a.push({ rule, sev, msg }); };
    const byCls = new Map();
    for (const o of objs) { let a = byCls.get(o.cls); if (!a) byCls.set(o.cls, a = []); a.push(o); }
    const f1 = v => (Math.round(v * 100) / 100).toFixed(2);
    for (const o of objs) {
      const bottom = o.p1[2] - floor, top = o.p99[2] - floor, h = o.size[2], dim = Math.max(o.size[0], o.size[1]);
      const r = RULES[o.cls];
      if (o.points < 100) add(o, 'Very few points', 'low', 'Only ' + o.points + ' points, too few to judge.');
      if (r) {
        if (r.bottomMin != null && bottom < r.bottomMin) add(o, 'Too low for its class', 'high', 'Starts ' + f1(bottom) + ' m above the floor; a ' + o.cls + ' normally starts above ' + f1(r.bottomMin) + ' m.');
        if (r.bottomMax != null && bottom > r.bottomMax) add(o, 'Floating', 'med', 'Starts ' + f1(bottom) + ' m above the floor; a ' + o.cls + ' normally rests near it.');
        if (r.topMax != null && top > r.topMax) add(o, 'Too high for its class', 'high', 'Top is ' + f1(top) + ' m above the floor; a ' + o.cls + ' should be flat near it.');
        if (r.hMin != null && h < r.hMin) add(o, 'Too short for its class', 'med', 'Height is ' + f1(h) + ' m; a ' + o.cls + ' is normally at least ' + f1(r.hMin) + ' m.');
        if (r.hMax != null && h > r.hMax) add(o, 'Too tall for its class', 'med', 'Height is ' + f1(h) + ' m; a ' + o.cls + ' is normally under ' + f1(r.hMax) + ' m.');
        if (r.dimMax != null && dim > r.dimMax) add(o, 'Too wide for its class', 'med', 'Footprint is ' + f1(dim) + ' m across; a ' + o.cls + ' is normally under ' + f1(r.dimMax) + ' m.');
      }
      if (o.cls === 'window' && dim < 0.9 && h < 1.0 && bottom < 0.4) add(o, 'Looks like furniture', 'high', 'Small, low and near the floor (' + f1(dim) + ' m wide, ' + f1(h) + ' m tall). Possibly a chair or table labeled as a window.');
      if (o.cls === 'wall' && h < 0.3 && dim < 1.0) add(o, 'Sliver wall', 'low', 'A wall segment only ' + f1(h) + ' m tall and ' + f1(dim) + ' m wide.');
    }
    for (const [cls, list] of byCls) {
      if (list.length < 4) continue;
      const md = median(list.map(o => Math.max(o.size[0], o.size[1], o.size[2])));
      if (!(md > 0.05)) continue;
      for (const o of list) {
        const d = Math.max(o.size[0], o.size[1], o.size[2]);
        if (d > md * 3 && d > 0.8) add(o, 'Larger than its peers', 'low', 'Longest side ' + f1(d) + ' m is over 3 times the typical ' + cls + ' (' + f1(md) + ' m).');
        else if (d < md / 3 && md > 0.6) add(o, 'Smaller than its peers', 'low', 'Longest side ' + f1(d) + ' m is under a third of the typical ' + cls + ' (' + f1(md) + ' m).');
      }
    }
    const rank = { high: 0, med: 1, low: 2 };
    const sev = o => { const a = flags.get(o); return a ? Math.min.apply(null, a.map(x => rank[x.sev])) : 9; };
    const flagged = Array.from(flags.keys()).sort((a, b) => sev(a) - sev(b) || a.cls.localeCompare(b.cls) || a.idx - b.idx);
    const rules = new Map();
    for (const [o, a] of flags) for (const x of a) { let r = rules.get(x.rule); if (!r) rules.set(x.rule, r = { rule: x.rule, sev: x.sev, n: 0 }); r.n++; }
    return { flags, flagged, rules: Array.from(rules.values()).sort((a, b) => rank[a.sev] - rank[b.sev] || b.n - a.n), floor, total: objs.length };
  }

  async function scanFolder(files, opts, onProgress) {
    const step = opts.step || 1;
    const targets = [], skipped = [];
    for (const f of files) {
      const path = f.webkitRelativePath || f.name;
      const nm = parseName(path);
      if (nm) targets.push({ file: f, path, nm }); else skipped.push({ path, size: f.size });
    }
    targets.sort((a, b) => a.nm.slice.localeCompare(b.nm.slice, undefined, { numeric: true }) || a.nm.cls.localeCompare(b.nm.cls) || a.nm.idx - b.nm.idx);
    const total = targets.reduce((a, t) => a + t.file.size, 0);
    let done = 0;
    const t0 = Date.now();
    const objs = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const base = done;
      const r = await scanFile(t.file, step, b => onProgress && onProgress({ files: i, of: targets.length, bytes: base + b, total, name: t.path, elapsed: (Date.now() - t0) / 1000 }), !!opts.collect);
      done += t.file.size;
      objs.push(Object.assign({ name: t.nm.cls + '_' + t.nm.idx, cls: t.nm.cls, idx: t.nm.idx, slice: t.nm.slice, path: t.path, bytes: t.file.size }, r));
    }
    const big = skipped.filter(s => s.size > 100e6).map(s => s.path);
    const summary = summarize(objs);
    return { objs, summary, qa: qa(objs, summary.room), step, seconds: (Date.now() - t0) / 1000, totalBytes: total, skipped: skipped.length, skippedBig: big };
  }

  root.SCAN = { qa, scanFolder, scanFile, summarize, parseName, parseLine };
})(typeof window !== 'undefined' ? window : globalThis);
