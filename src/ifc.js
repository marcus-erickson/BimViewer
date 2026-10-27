/* IFC (STEP) reader and audit. Plain text parser, no dependencies. */
(function (root) {
  'use strict';

  function decodeStr(s) {
    return s.replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g, (_, h) => {
      let o = '';
      for (let i = 0; i + 3 < h.length + 1; i += 4) o += String.fromCharCode(parseInt(h.substr(i, 4), 16));
      return o;
    }).replace(/\\X\\([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }

  /* Parse one argument list starting at text[i] === '('; returns [array, nextIndex]. */
  function parseList(t, i) {
    const out = [];
    i++; // skip '('
    const n = t.length;
    while (i < n) {
      const c = t.charCodeAt(i);
      if (c === 41) return [out, i + 1];           // )
      if (c === 44 || c === 32 || c === 10 || c === 13 || c === 9) { i++; continue; } // , space
      if (c === 40) { const r = parseList(t, i); out.push(r[0]); i = r[1]; continue; }
      if (c === 39) {                               // string
        let j = i + 1, s = '';
        while (j < n) {
          if (t.charCodeAt(j) === 39) { if (t.charCodeAt(j + 1) === 39) { s += "'"; j += 2; continue; } break; }
          s += t[j]; j++;
        }
        out.push(decodeStr(s)); i = j + 1; continue;
      }
      if (c === 35) {                               // #ref
        let j = i + 1;
        while (j < n && t.charCodeAt(j) >= 48 && t.charCodeAt(j) <= 57) j++;
        out.push({ r: +t.slice(i + 1, j) }); i = j; continue;
      }
      if (c === 36) { out.push(null); i++; continue; }          // $
      if (c === 42) { out.push({ star: 1 }); i++; continue; }    // *
      if (c === 46) {                               // .ENUM.
        let j = i + 1;
        while (j < n && t.charCodeAt(j) !== 46) j++;
        out.push({ e: t.slice(i + 1, j) }); i = j + 1; continue;
      }
      if ((c >= 48 && c <= 57) || c === 45 || c === 43) { // number
        let j = i + 1;
        while (j < n && /[0-9eE+\-.]/.test(t[j])) j++;
        out.push(parseFloat(t.slice(i, j))); i = j; continue;
      }
      if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) { // TYPED(value)
        let j = i;
        while (j < n && t[j] !== '(') j++;
        const name = t.slice(i, j).toUpperCase();
        const r = parseList(t, j);
        out.push({ t: name, v: r[0] }); i = r[1]; continue;
      }
      i++;
    }
    return [out, i];
  }

  function parseStep(text) {
    const ds = text.indexOf('DATA;');
    const head = ds > 0 ? text.slice(0, ds) : '';
    const ents = new Map();
    let i = ds < 0 ? 0 : ds + 5;
    const n = text.length;
    while (i < n) {
      const h = text.indexOf('#', i);
      if (h < 0) break;
      let j = h + 1;
      while (j < n && text.charCodeAt(j) >= 48 && text.charCodeAt(j) <= 57) j++;
      const id = +text.slice(h + 1, j);
      while (j < n && (text[j] === ' ' || text[j] === '=' )) j++;
      let k = j;
      while (k < n && text[k] !== '(' && text[k] !== ';') k++;
      const type = text.slice(j, k).trim().toUpperCase();
      if (text[k] !== '(') { i = k + 1; continue; }
      const r = parseList(text, k);
      ents.set(id, { id, type, a: r[0] });
      let e = r[1];
      while (e < n && text[e] !== ';') e++;
      i = e + 1;
    }
    return { head, ents };
  }

  function headerInfo(head) {
    const g = (name) => { const m = new RegExp(name + '\\s*\\(([\\s\\S]*?)\\)\\s*;').exec(head); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
    return { description: g('FILE_DESCRIPTION'), name: g('FILE_NAME'), schema: g('FILE_SCHEMA').replace(/[()' ]/g, '') };
  }

  const PRETTY = {
    IFCWALLSTANDARDCASE: 'IfcWallStandardCase', IFCWALL: 'IfcWall', IFCSLAB: 'IfcSlab', IFCCOLUMN: 'IfcColumn', IFCBEAM: 'IfcBeam', IFCDOOR: 'IfcDoor',
    IFCWINDOW: 'IfcWindow', IFCRAILING: 'IfcRailing', IFCSTAIR: 'IfcStair', IFCSTAIRFLIGHT: 'IfcStairFlight', IFCROOF: 'IfcRoof', IFCCOVERING: 'IfcCovering',
    IFCFURNISHINGELEMENT: 'IfcFurnishingElement', IFCBUILDINGELEMENTPROXY: 'IfcBuildingElementProxy', IFCMEMBER: 'IfcMember', IFCPLATE: 'IfcPlate',
    IFCCURTAINWALL: 'IfcCurtainWall', IFCOPENINGELEMENT: 'IfcOpeningElement', IFCSPACE: 'IfcSpace', IFCFLOWTERMINAL: 'IfcFlowTerminal',
    IFCFLOWSEGMENT: 'IfcFlowSegment', IFCFLOWFITTING: 'IfcFlowFitting', IFCLIGHTFIXTURE: 'IfcLightFixture', IFCFOOTING: 'IfcFooting', IFCRAMP: 'IfcRamp',
    IFCSITE: 'IfcSite', IFCBUILDING: 'IfcBuilding', IFCBUILDINGSTOREY: 'IfcBuildingStorey', IFCPROJECT: 'IfcProject', IFCCARTESIANPOINT: 'IfcCartesianPoint',
    IFCPROPERTYSET: 'IfcPropertySet', IFCPROPERTYSINGLEVALUE: 'IfcPropertySingleValue', IFCRELDEFINESBYPROPERTIES: 'IfcRelDefinesByProperties',
    IFCPOLYLOOP: 'IfcPolyLoop', IFCFACE: 'IfcFace', IFCFACEOUTERBOUND: 'IfcFaceOuterBound', IFCAXIS2PLACEMENT3D: 'IfcAxis2Placement3D',
    IFCEXTRUDEDAREASOLID: 'IfcExtrudedAreaSolid', IFCSHAPEREPRESENTATION: 'IfcShapeRepresentation', IFCSTYLEDITEM: 'IfcStyledItem',
    IFCLOCALPLACEMENT: 'IfcLocalPlacement', IFCPRODUCTDEFINITIONSHAPE: 'IfcProductDefinitionShape', IFCPOLYLINE: 'IfcPolyline',
    IFCRELDEFINESBYTYPE: 'IfcRelDefinesByType', IFCRELASSOCIATESMATERIAL: 'IfcRelAssociatesMaterial', IFCMATERIAL: 'IfcMaterial',
    IFCMATERIALLAYER: 'IfcMaterialLayer', IFCMATERIALLAYERSETUSAGE: 'IfcMaterialLayerSetUsage', IFCRECTANGLEPROFILEDEF: 'IfcRectangleProfileDef',
    IFCWALLTYPE: 'IfcWallType', IFCSLABTYPE: 'IfcSlabType', IFCCOLUMNTYPE: 'IfcColumnType', IFCRAILINGTYPE: 'IfcRailingType',
    IFCDOORSTYLE: 'IfcDoorStyle', IFCWINDOWSTYLE: 'IfcWindowStyle', IFCBUILDINGELEMENTPROXYTYPE: 'IfcBuildingElementProxyType'
  };
  const pretty = t => PRETTY[t] || t;

  const SPATIAL = new Set(['IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY']);
  const PLACEMENTS = new Set(['IFCLOCALPLACEMENT', 'IFCGRIDPLACEMENT']);

  /* An IFC product has a GlobalId first and a placement in slot 5. Spatial containers other than spaces are listed separately. */
  function isProduct(e, ents) {
    if (/TYPE$|STYLE$|^IFCREL/.test(e.type) || SPATIAL.has(e.type)) return false;
    if (typeof e.a[0] !== 'string' || e.a[0].length !== 22) return false;
    const p = e.a[5];
    if (!p || !p.r) return false;
    const t = ents.get(p.r);
    return !!t && PLACEMENTS.has(t.type);
  }

  const val = v => {
    if (v == null) return null;
    if (typeof v === 'object' && v.t) return val(v.v && v.v[0]);
    if (typeof v === 'object' && v.e !== undefined) return v.e === 'T' ? true : v.e === 'F' ? false : v.e;
    if (Array.isArray(v)) return v.map(val);
    return v;
  };
  const refs = v => (Array.isArray(v) ? v.filter(x => x && x.r).map(x => x.r) : (v && v.r ? [v.r] : []));
  const str = v => (v == null ? '' : String(v));

  function analyze(parsed) {
    const { ents, head } = parsed;
    const get = id => ents.get(id);
    const res = { header: headerInfo(head), app: '', units: [], project: null, hierarchy: [], census: [], classes: [], types: [], elements: [], materials: [], psets: [], readiness: [], totals: {} };

    const census = new Map();
    for (const e of ents.values()) census.set(e.type, (census.get(e.type) || 0) + 1);
    res.census = Array.from(census.entries()).sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ type: t, label: pretty(t), count: n }));
    res.totals = { entities: ents.size };

    for (const e of ents.values()) if (e.type === 'IFCAPPLICATION') res.app = [e.a[2], e.a[1]].filter(Boolean).join(' ') + (e.a[3] ? ' (' + e.a[3] + ')' : '');

    // units
    for (const e of ents.values()) {
      if (e.type !== 'IFCUNITASSIGNMENT') continue;
      for (const id of refs(e.a[0])) {
        const u = get(id); if (!u) continue;
        if (u.type === 'IFCSIUNIT') {
          const prefix = u.a[2] && u.a[2].e ? u.a[2].e.toLowerCase() + ' ' : '';
          res.units.push({ kind: str(u.a[1] && u.a[1].e).replace('UNIT', '').toLowerCase(), unit: prefix + str(u.a[3] && u.a[3].e).toLowerCase().replace('_', ' ') });
        } else if (u.type === 'IFCCONVERSIONBASEDUNIT') {
          let f = ''; const m = get(u.a[3] && u.a[3].r);
          if (m && m.a[0] != null) f = ' (x ' + val(m.a[0]) + ' of the SI unit)';
          res.units.push({ kind: str(u.a[1] && u.a[1].e).replace('UNIT', '').toLowerCase(), unit: str(u.a[2]).toLowerCase() + f });
        }
      }
      break;
    }
    const lenUnit = (res.units.find(u => u.kind === 'length') || {}).unit || '';
    res.lengthScale = 1;
    for (const e of ents.values()) {
      if (e.type === 'IFCSIUNIT' && e.a[1] && e.a[1].e === 'LENGTHUNIT') {
        const pre = { MILLI: 0.001, CENTI: 0.01, DECI: 0.1, KILO: 1000 }[e.a[2] && e.a[2].e];
        if (pre) res.lengthScale = pre;
      }
      if (e.type === 'IFCCONVERSIONBASEDUNIT' && e.a[1] && e.a[1].e === 'LENGTHUNIT') {
        const m = get(e.a[3] && e.a[3].r);
        if (m && typeof val(m.a[0]) === 'number') res.lengthScale = val(m.a[0]);
      }
    }

    // relationships
    const propDefs = new Map(), typeOf = new Map(), container = new Map(), matOf = new Map(), classOf = new Map(), aggParent = new Map();
    const push = (m, k, v) => { let a = m.get(k); if (!a) m.set(k, a = []); a.push(v); };
    for (const e of ents.values()) {
      switch (e.type) {
        case 'IFCRELDEFINESBYPROPERTIES': { const d = e.a[5] && e.a[5].r; for (const o of refs(e.a[4])) push(propDefs, o, d); break; }
        case 'IFCRELDEFINESBYTYPE': { const t = e.a[5] && e.a[5].r; for (const o of refs(e.a[4])) typeOf.set(o, t); break; }
        case 'IFCRELCONTAINEDINSPATIALSTRUCTURE': { const s = e.a[5] && e.a[5].r; for (const o of refs(e.a[4])) container.set(o, s); break; }
        case 'IFCRELASSOCIATESMATERIAL': { const m = e.a[5] && e.a[5].r; for (const o of refs(e.a[4])) matOf.set(o, m); break; }
        case 'IFCRELASSOCIATESCLASSIFICATION': { const c = e.a[5] && e.a[5].r; for (const o of refs(e.a[4])) push(classOf, o, c); break; }
        case 'IFCRELAGGREGATES': { const p = e.a[4] && e.a[4].r; for (const o of refs(e.a[5])) aggParent.set(o, p); break; }
        default:
      }
    }

    function materialNames(id, depth) {
      const m = get(id); if (!m || (depth || 0) > 4) return [];
      switch (m.type) {
        case 'IFCMATERIAL': return [str(m.a[0])];
        case 'IFCMATERIALLAYER': return materialNames(m.a[0] && m.a[0].r, (depth || 0) + 1);
        case 'IFCMATERIALLAYERSET': return [].concat.apply([], refs(m.a[0]).map(r => materialNames(r, (depth || 0) + 1)));
        case 'IFCMATERIALLAYERSETUSAGE': return materialNames(m.a[0] && m.a[0].r, (depth || 0) + 1);
        case 'IFCMATERIALLIST': return [].concat.apply([], refs(m.a[0]).map(r => materialNames(r, (depth || 0) + 1)));
        case 'IFCMATERIALCONSTITUENTSET': case 'IFCMATERIALPROFILESET': return [].concat.apply([], refs(m.a[2] || m.a[1]).map(r => materialNames(r, (depth || 0) + 1)));
        default: return [];
      }
    }

    function readPset(id) {
      const p = get(id); if (!p) return null;
      if (p.type === 'IFCPROPERTYSET') {
        const props = [];
        for (const r of refs(p.a[4])) {
          const q = get(r); if (!q) continue;
          if (q.type === 'IFCPROPERTYSINGLEVALUE') props.push({ name: str(q.a[0]), value: val(q.a[2]) });
          else if (q.type === 'IFCPROPERTYENUMERATEDVALUE') props.push({ name: str(q.a[0]), value: val(q.a[2]) });
          else props.push({ name: str(q.a[0]), value: '(' + q.type.replace('IFCPROPERTY', '').toLowerCase() + ')' });
        }
        return { name: str(p.a[2]), props, quantity: false };
      }
      if (p.type === 'IFCELEMENTQUANTITY') {
        const props = [];
        for (const r of refs(p.a[5])) {
          const q = get(r); if (!q) continue;
          const kind = q.type.replace('IFCQUANTITY', '').toLowerCase();
          props.push({ name: str(q.a[0]), value: val(q.a[3]), kind });
        }
        return { name: str(p.a[2]), props, quantity: true };
      }
      return null;
    }

    // spatial
    const spatial = [];
    for (const e of ents.values()) {
      if (e.type === 'IFCPROJECT') res.project = { name: str(e.a[2]), longName: str(e.a[5]), phase: str(e.a[6]) };
      if (SPATIAL.has(e.type) || e.type === 'IFCSPACE') spatial.push(e);
    }
    const storeyCount = new Map();

    // types
    const typeById = new Map();
    const instCount = new Map();
    for (const t of typeOf.values()) instCount.set(t, (instCount.get(t) || 0) + 1);
    for (const e of ents.values()) {
      if (/^IFC.*(TYPE|STYLE)$/.test(e.type) && typeof e.a[0] === 'string' && e.a[0].length === 22 && !/^IFCREL|^IFCPROPERTY|^IFCSURFACE|^IFCCURVE|^IFCTEXT|^IFCFILL|^IFCDRAUGHTING/.test(e.type)) {
        typeById.set(e.id, e);
        res.types.push({ id: e.id, cls: pretty(e.type), name: str(e.a[2]), count: instCount.get(e.id) || 0 });
      }
    }

    // elements
    const elements = [];
    for (const e of ents.values()) {
      if (!isProduct(e, ents)) continue;
      const psets = [];
      const defs = (propDefs.get(e.id) || []).slice();
      const t = typeOf.get(e.id) ? get(typeOf.get(e.id)) : null;
      for (const d of defs) { const ps = readPset(d); if (ps) { ps.source = 'instance'; psets.push(ps); } }
      if (t && Array.isArray(t.a[5])) for (const r of refs(t.a[5])) { const ps = readPset(r); if (ps) { ps.source = 'type'; psets.push(ps); } }
      const mats = matOf.has(e.id) ? materialNames(matOf.get(e.id)) : (t && matOf.has(t.id) ? materialNames(matOf.get(t.id)) : []);
      const uniqMats = Array.from(new Set(mats.filter(Boolean)));
      const st = container.get(e.id) || (aggParent.get(e.id) ? container.get(aggParent.get(e.id)) : null);
      const stor = st ? get(st) : null;
      const allProps = [].concat.apply([], psets.map(p => p.props.map(x => Object.assign({ pset: p.name }, x))));
      const hasVal = rx => allProps.some(p => rx.test(p.name) && p.value != null && p.value !== '' && p.value !== false && p.value !== 0);
      const el = {
        id: e.id, cls: pretty(e.type), clsRaw: e.type, guid: e.a[0], name: str(e.a[2]), tag: str(e.a[7]), objType: str(e.a[4]),
        typeName: t ? str(t.a[2]) : '', level: stor ? str(stor.a[2]) : '', psets, materials: uniqMats,
        classifications: (classOf.get(e.id) || (t && classOf.get(t.id)) || []).length,
        checks: {
          type: !!t, material: uniqMats.length > 0, classification: (classOf.get(e.id) || (t && classOf.get(t.id)) || []).length > 0,
          fire: hasVal(/fire\s*rating|FireRating/i), maker: hasVal(/manufacturer|model\s*label|model|article\s*number|product/i),
          quantities: psets.some(p => p.quantity) || allProps.some(p => typeof p.value === 'number' && /area|volume|length|width|height|depth|thickness/i.test(p.name)), anyPset: psets.length > 0
        }
      };
      elements.push(el);
      if (stor) storeyCount.set(stor.id, (storeyCount.get(stor.id) || 0) + 1);
    }
    elements.sort((a, b) => a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name));
    res.elements = elements;
    res.totals.elements = elements.length;

    // hierarchy
    const order = { IFCSITE: 0, IFCBUILDING: 1, IFCBUILDINGSTOREY: 2, IFCSPACE: 3 };
    for (const e of spatial.sort((a, b) => order[a.type] - order[b.type])) {
      let extra = '';
      if (e.type === 'IFCBUILDINGSTOREY' && typeof e.a[9] === 'number') extra = 'elevation ' + (Math.round(e.a[9] * 100) / 100) + (lenUnit ? ' ' + lenUnit.split(' ')[0] : '');
      res.hierarchy.push({ cls: pretty(e.type), name: str(e.a[2]) || '(unnamed)', extra, count: e.type === 'IFCBUILDINGSTOREY' ? storeyCount.get(e.id) || 0 : null });
    }

    // classes
    const byCls = new Map();
    for (const el of elements) { let c = byCls.get(el.cls); if (!c) byCls.set(el.cls, c = { cls: el.cls, count: 0, types: new Set(), levels: new Set() }); c.count++; if (el.typeName) c.types.add(el.typeName); if (el.level) c.levels.add(el.level); }
    res.classes = Array.from(byCls.values()).sort((a, b) => b.count - a.count).map(c => ({ cls: c.cls, count: c.count, types: c.types.size, levels: Array.from(c.levels).join(', ') }));

    // readiness
    const keys = ['type', 'material', 'classification', 'fire', 'maker', 'quantities', 'anyPset'];
    const rd = new Map();
    for (const el of elements) {
      if (el.clsRaw === 'IFCOPENINGELEMENT') continue;
      let r = rd.get(el.cls); if (!r) rd.set(el.cls, r = { cls: el.cls, n: 0, c: {} });
      r.n++; for (const k of keys) r.c[k] = (r.c[k] || 0) + (el.checks[k] ? 1 : 0);
    }
    const rows = Array.from(rd.values()).sort((a, b) => b.n - a.n);
    const tot = { cls: 'All elements', n: 0, c: {} };
    for (const r of rows) { tot.n += r.n; for (const k of keys) tot.c[k] = (tot.c[k] || 0) + (r.c[k] || 0); }
    res.readiness = rows.concat(tot.n ? [tot] : []).map(r => ({ cls: r.cls, n: r.n, pct: Object.fromEntries(keys.map(k => [k, r.n ? Math.round(100 * (r.c[k] || 0) / r.n) : 0])) }));

    // materials
    const mUse = new Map();
    for (const el of elements) for (const m of el.materials) mUse.set(m, (mUse.get(m) || 0) + 1);
    res.materials = Array.from(mUse.entries()).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, elements: n }));

    // property set catalog
    const pc = new Map();
    for (const el of elements) for (const p of el.psets) {
      let c = pc.get(p.name); if (!c) pc.set(p.name, c = { name: p.name, elements: new Set(), props: new Set(), quantity: p.quantity });
      c.elements.add(el.id); for (const q of p.props) c.props.add(q.name);
    }
    res.psets = Array.from(pc.values()).sort((a, b) => b.elements.size - a.elements.size).map(c => ({ name: c.name, elements: c.elements.size, props: Array.from(c.props), quantity: c.quantity }));

    res.lenUnit = lenUnit;
    return res;
  }


  /* ---- Geometry: wireframe edges for each product, in meters ---- */
  function buildGeometry(parsed, res) {
    const ents = parsed.ents, get = id => ents.get(id);
    const sc = res.lengthScale || 1;
    const id4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const mmul = (a, b) => {
      const o = new Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let t = 0; for (let k = 0; k < 4; k++) t += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = t; }
      return o;
    };
    const app = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
    const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const pad3 = v => [v[0] || 0, v[1] || 0, v[2] || 0];
    const ptOf = r => { const e = get(r); return e && Array.isArray(e.a[0]) ? pad3(e.a[0]) : [0, 0, 0]; };
    const dirOf = r => { const e = get(r); return e && Array.isArray(e.a[0]) ? pad3(e.a[0]) : [1, 0, 0]; };
    const fromAxes = (x, y, z, o) => [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, o[0], o[1], o[2], 1];
    function axis3(r) {
      const e = get(r); if (!e) return id4();
      const loc = e.a[0] && e.a[0].r ? ptOf(e.a[0].r) : [0, 0, 0];
      const z = e.a[1] && e.a[1].r ? nrm(dirOf(e.a[1].r)) : [0, 0, 1];
      let xr = e.a[2] && e.a[2].r ? dirOf(e.a[2].r) : (Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
      const d = dot(xr, z); const x = nrm([xr[0] - z[0] * d, xr[1] - z[1] * d, xr[2] - z[2] * d]);
      return fromAxes(x, cross(z, x), z, loc);
    }
    function axis2(r) {
      const e = get(r); if (!e) return id4();
      const loc = e.a[0] && e.a[0].r ? ptOf(e.a[0].r) : [0, 0, 0];
      const x = e.a[1] && e.a[1].r ? nrm(dirOf(e.a[1].r)) : [1, 0, 0];
      return fromAxes(x, [-x[1], x[0], 0], [0, 0, 1], loc);
    }
    const pmemo = new Map();
    function placement(r) {
      if (pmemo.has(r)) return pmemo.get(r);
      const e = get(r); let m = id4();
      if (e && e.type === 'IFCLOCALPLACEMENT') {
        const rel = e.a[1] && e.a[1].r ? axis3(e.a[1].r) : id4();
        m = e.a[0] && e.a[0].r ? mmul(placement(e.a[0].r), rel) : rel;
      }
      pmemo.set(r, m); return m;
    }
    function op3(r) {
      const e = get(r); if (!e) return id4();
      const x = e.a[0] && e.a[0].r ? nrm(dirOf(e.a[0].r)) : [1, 0, 0], y = e.a[1] && e.a[1].r ? nrm(dirOf(e.a[1].r)) : [0, 1, 0];
      const z = e.a[4] && e.a[4].r ? nrm(dirOf(e.a[4].r)) : cross(x, y);
      const s = typeof e.a[3] === 'number' ? e.a[3] : 1, o = e.a[2] && e.a[2].r ? ptOf(e.a[2].r) : [0, 0, 0];
      return fromAxes([x[0] * s, x[1] * s, x[2] * s], [y[0] * s, y[1] * s, y[2] * s], [z[0] * s, z[1] * s, z[2] * s], o);
    }
    const rigidInv = m => {
      const r = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
      const t = [-(r[0] * m[12] + r[4] * m[13] + r[8] * m[14]), -(r[1] * m[12] + r[5] * m[13] + r[9] * m[14]), -(r[2] * m[12] + r[6] * m[13] + r[10] * m[14])];
      r[12] = t[0]; r[13] = t[1]; r[14] = t[2]; return r;
    };

    function profilePts(r) {
      const p = get(r); if (!p) return null;
      if (p.type === 'IFCRECTANGLEPROFILEDEF') {
        const m = p.a[2] && p.a[2].r ? axis2(p.a[2].r) : id4(), hx = (p.a[3] || 0) / 2, hy = (p.a[4] || 0) / 2;
        return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(q => { const w = app(m, [q[0], q[1], 0]); return [w[0], w[1]]; });
      }
      if (p.type === 'IFCCIRCLEPROFILEDEF') {
        const m = p.a[2] && p.a[2].r ? axis2(p.a[2].r) : id4(), rad = p.a[3] || 0, out = [];
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const w = app(m, [rad * Math.cos(a), rad * Math.sin(a), 0]); out.push([w[0], w[1]]); }
        return out;
      }
      if (p.type === 'IFCARBITRARYCLOSEDPROFILEDEF' || p.type === 'IFCARBITRARYPROFILEDEFWITHVOIDS') {
        const c = get(p.a[2] && p.a[2].r);
        if (c && c.type === 'IFCPOLYLINE') {
          let pts = (c.a[0] || []).map(x => ptOf(x.r)).map(q => [q[0], q[1]]);
          if (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-9) pts.pop();
          return pts;
        }
      }
      return null;
    }

    function itemEdges(r, M, out, depth) {
      const it = get(r); if (!it || depth > 4) return;
      switch (it.type) {
        case 'IFCEXTRUDEDAREASOLID': {
          const prof = profilePts(it.a[0] && it.a[0].r); if (!prof || prof.length < 2) return;
          const P = mmul(M, it.a[1] && it.a[1].r ? axis3(it.a[1].r) : id4());
          const dv = it.a[2] && it.a[2].r ? nrm(dirOf(it.a[2].r)) : [0, 0, 1], d = it.a[3] || 0;
          const b = prof.map(q => app(P, [q[0], q[1], 0])), t = prof.map(q => app(P, [q[0] + dv[0] * d, q[1] + dv[1] * d, dv[2] * d]));
          const n = b.length;
          for (let i = 0; i < n; i++) { const j = (i + 1) % n; out.push(b[i], b[j], t[i], t[j]); if (n <= 48) out.push(b[i], t[i]); }
          return;
        }
        case 'IFCFACETEDBREP': {
          const sh = get(it.a[0] && it.a[0].r); if (!sh) return;
          const seen = new Set();
          for (const fr of (sh.a[0] || [])) {
            const f = get(fr.r); if (!f) continue;
            for (const br of (f.a[0] || [])) {
              const bd = get(br.r); const lp = bd && get(bd.a[0] && bd.a[0].r); if (!lp || !lp.a[0]) continue;
              const pts = lp.a[0].map(x => app(M, ptOf(x.r)));
              for (let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length];
                const ka = a.map(v => Math.round(v * 1e4)).join(','), kb = b.map(v => Math.round(v * 1e4)).join(',');
                const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
                if (seen.has(key)) continue; seen.add(key); out.push(a, b);
              }
            }
          }
          return;
        }
        case 'IFCMAPPEDITEM': {
          const src = get(it.a[0] && it.a[0].r); if (!src) return;
          const Mm = mmul(mmul(M, it.a[1] && it.a[1].r ? op3(it.a[1].r) : id4()), src.a[0] && src.a[0].r ? rigidInv(axis3(src.a[0].r)) : id4());
          const rep = get(src.a[1] && src.a[1].r); if (!rep) return;
          for (const x of (rep.a[3] || [])) itemEdges(x.r, Mm, out, depth + 1);
          return;
        }
        case 'IFCBOOLEANCLIPPINGRESULT': case 'IFCBOOLEANRESULT':
          itemEdges(it.a[1] && it.a[1].r, M, out, depth + 1); return;
        default:
      }
    }

    const geom = [];
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    let floats = 0;
    for (const e of ents.values()) {
      if (!isProduct(e, ents) || e.type === 'IFCOPENINGELEMENT' || floats > 3e6) continue;
      const pds = get(e.a[6] && e.a[6].r); if (!pds || !Array.isArray(pds.a[2])) continue;
      const M = placement(e.a[5].r), pts = [];
      for (const rr of pds.a[2]) {
        const sr = get(rr.r); if (!sr || !Array.isArray(sr.a[3])) continue;
        const idn = String(sr.a[1] || '');
        if (idn && idn !== 'Body') continue;
        for (const x of sr.a[3]) itemEdges(x.r, M, pts, 0);
      }
      if (!pts.length) continue;
      const flat = [];
      for (const p of pts) {
        const q = [p[0] * sc, p[1] * sc, p[2] * sc];
        for (let k = 0; k < 3; k++) { if (q[k] < lo[k]) lo[k] = q[k]; if (q[k] > hi[k]) hi[k] = q[k]; flat.push(Math.round(q[k] * 1000) / 1000); }
      }
      floats += flat.length;
      geom.push({ id: e.id, cls: pretty(e.type), name: str(e.a[2]), edges: flat });
    }
    res.geomBounds = geom.length ? { min: lo, max: hi } : null;
    return geom;
  }

  function readIfc(text) {
    const parsed = parseStep(text);
    if (!parsed.ents.size) throw new Error('No IFC data found. Is this an IFC file in STEP text format (.ifc)?');
    const res = analyze(parsed);
    try { res.geom = buildGeometry(parsed, res); } catch (e) { res.geom = []; res.geomError = String(e.message || e); }
    return res;
  }

  root.IFC = { readIfc, parseStep, analyze };
})(typeof window !== 'undefined' ? window : globalThis);
