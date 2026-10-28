/* Minimal WebGL point-cloud viewer. Z is up. groups: [{cls, n, xyz:Float32Array, rgb:Uint8Array, color:[r,g,b] 0-255}] */
(function (root) {
  'use strict';
  const VS = `
    attribute vec3 aPos; attribute vec3 aCol;
    uniform mat4 uMVP; uniform float uSize; uniform float uMode; uniform vec3 uClass; uniform vec3 uCenter;
    uniform float uZmin; uniform float uZmax; uniform vec3 uOff; uniform vec2 uRot; uniform float uPersp; uniform float uK; varying vec3 vCol;
    void main() {
      vec3 q = vec3(uRot.x * aPos.x - uRot.y * aPos.y, uRot.y * aPos.x + uRot.x * aPos.y, aPos.z) + uOff;
      vec4 p = uMVP * vec4(q, 1.0);
      gl_Position = p;
      gl_PointSize = uPersp > 0.5 ? clamp(uSize * uK / max(p.w, 0.01), 1.5, 48.0) : uSize;
      if (uMode < 0.5) vCol = aCol;
      else if (uMode < 1.5) vCol = uClass;
      else {
        float t = clamp((aPos.z + uCenter.z - uZmin) / max(0.001, uZmax - uZmin), 0.0, 1.0);
        vec3 a = vec3(0.10, 0.18, 0.45), b = vec3(0.16, 0.65, 0.62), c = vec3(0.96, 0.82, 0.38);
        vCol = t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
      }
    }`;
  const FS = `
    precision mediump float; varying vec3 vCol; uniform float uRound; uniform float uShade;
    void main() {
      vec3 col = vCol;
      if (uRound > 0.5) {
        vec2 d = gl_PointCoord - vec2(0.5);
        if (dot(d, d) > 0.25) discard;
        if (uShade > 0.5) {
          vec2 q = d * 2.0; float z = sqrt(max(0.0, 1.0 - dot(q, q)));
          vec3 n = normalize(vec3(q.x, -q.y, z));
          col *= 0.45 + 0.55 * max(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0);
        }
      }
      gl_FragColor = vec4(col, 1.0);
    }`;

  function mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  function persp(fov, asp, n, f) {
    const t = 1 / Math.tan(fov / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
    return o;
  }
  function look(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const o = new Float32Array(16);
    o[0] = xx; o[1] = yx; o[2] = zx; o[4] = xy; o[5] = yy; o[6] = zy; o[8] = xz; o[9] = yz; o[10] = zz;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1;
    return o;
  }

  function Viewer3D(canvas, groups, opts) {
    opts = opts || {};
    const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL is not available in this browser.');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const loc = { pos: gl.getAttribLocation(prog, 'aPos'), col: gl.getAttribLocation(prog, 'aCol') };
    const U = n => gl.getUniformLocation(prog, n);
    const un = { mvp: U('uMVP'), size: U('uSize'), mode: U('uMode'), cls: U('uClass'), center: U('uCenter'), zmin: U('uZmin'), zmax: U('uZmax'), off: U('uOff'), rot: U('uRot'), round: U('uRound'), persp: U('uPersp'), k: U('uK'), shade: U('uShade') };

    // Reorder each object's points so that any prefix is an even spread (used by the Detail slider)
    const gcd = (a, b) => { while (b) { const t = a % b; a = b; b = t; } return a; };
    for (const g of groups) {
      if (!g.ranges) continue;
      const nx = new Float32Array(g.xyz.length), nc = new Uint8Array(g.rgb.length);
      nx.set(g.xyz); nc.set(g.rgb);
      for (const r of g.ranges) {
        const n = r.count; if (n < 3) continue;
        let P = Math.floor(n * 0.6180339887) | 1; while (gcd(P, n) !== 1) P += 2;
        for (let i = 0; i < n; i++) {
          const j = r.start + (i * P) % n, d = r.start + i;
          nx[d * 3] = g.xyz[j * 3]; nx[d * 3 + 1] = g.xyz[j * 3 + 1]; nx[d * 3 + 2] = g.xyz[j * 3 + 2];
          nc[d * 3] = g.rgb[j * 3]; nc[d * 3 + 1] = g.rgb[j * 3 + 1]; nc[d * 3 + 2] = g.rgb[j * 3 + 2];
        }
      }
      g.xyz = nx; g.rgb = nc;
    }
    // bounds
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const g of groups) for (let i = 0; i < g.n; i++) for (let k = 0; k < 3; k++) { const v = g.xyz[i * 3 + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
    if (opts.bounds) { for (let k = 0; k < 3; k++) { lo[k] = opts.bounds.min[k]; hi[k] = opts.bounds.max[k]; } }
    const center = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2);
    const ext = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1);

    const bufs = groups.map(g => {
      const rel = new Float32Array(g.n * 3);
      for (let i = 0; i < g.n; i++) { rel[i * 3] = g.xyz[i * 3] - center[0]; rel[i * 3 + 1] = g.xyz[i * 3 + 1] - center[1]; rel[i * 3 + 2] = g.xyz[i * 3 + 2] - center[2]; }
      const p = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, p); gl.bufferData(gl.ARRAY_BUFFER, rel, gl.STATIC_DRAW);
      const c = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, c); gl.bufferData(gl.ARRAY_BUFFER, g.rgb, gl.STATIC_DRAW);
      return { p, c, n: g.n, rel, ranges: g.ranges || [], color: g.color.map(v => v / 255), visible: true, cls: g.cls };
    });

    const last = { m: null, w: 1, h: 1, dpr: 1 };
    const ov = { on: false, items: [], pose: { cx: center[0], cy: center[1], cz: center[2], rot: 0 }, center: null, lo: null, hi: null };
    let sel = null, selBox = null;
    const view = { az: -1.05, el: 0.6, dist: ext * 1.3, tx: 0, ty: 0, tz: 0 };
    const state = { mode: 0, size: 2, dirty: true, detail: 1, fill: false, shade: false };
    const home = Object.assign({}, view);
    let raf = 0;


    function boxBuf(lo3, hi3) {
      const c = (x, y, z) => [x - center[0], y - center[1], z - center[2]];
      const P = [c(lo3[0], lo3[1], lo3[2]), c(hi3[0], lo3[1], lo3[2]), c(hi3[0], hi3[1], lo3[2]), c(lo3[0], hi3[1], lo3[2]), c(lo3[0], lo3[1], hi3[2]), c(hi3[0], lo3[1], hi3[2]), c(hi3[0], hi3[1], hi3[2]), c(lo3[0], hi3[1], hi3[2])];
      const E = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7], arr = new Float32Array(E.length * 3);
      E.forEach((v, i) => { arr[i * 3] = P[v][0]; arr[i * 3 + 1] = P[v][1]; arr[i * 3 + 2] = P[v][2]; });
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      return { buf, n: E.length };
    }
    function rangeAt(b, i) {
      let a = 0, z = b.ranges.length - 1;
      while (a < z) { const mid = (a + z + 1) >> 1; if (b.ranges[mid].start <= i) a = mid; else z = mid - 1; }
      return b.ranges.length ? a : -1;
    }
    function select(gi, ri) {
      if (selBox) { gl.deleteBuffer(selBox.buf); selBox = null; }
      if (gi < 0) { sel = null; redraw(); return; }
      const range = bufs[gi].ranges[ri];
      sel = { gi, ri, range };
      if (range.box) selBox = boxBuf(range.box.min, range.box.max);
      redraw();
    }
    function doPick(cx, cy) {
      draw();
      const m = last.m; if (!m) return;
      const W = last.w, H = last.h, px = cx * last.dpr, py = cy * last.dpr, R = 9 * last.dpr, R2 = R * R;
      let best = null, bw = Infinity;
      bufs.forEach((b, gi) => {
        if (!b.visible) return;
        const a = b.rel;
        for (let i = 0; i < b.n; i++) {
          const x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
          const w = m[3] * x + m[7] * y + m[11] * z + m[15]; if (w <= 0) continue;
          const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * W;
          const sy = (1 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5 + 0.5)) * H;
          const dx = sx - px, dy = sy - py;
          if (dx * dx + dy * dy <= R2 && w < bw) { bw = w; best = [gi, i]; }
        }
      });
      if (!best) { select(-1); if (opts.onPick) opts.onPick(null); return; }
      const ri = rangeAt(bufs[best[0]], best[1]);
      if (ri < 0) { select(-1); if (opts.onPick) opts.onPick(null); return; }
      select(best[0], ri);
      if (opts.onPick) opts.onPick({ cls: bufs[best[0]].cls, range: bufs[best[0]].ranges[ri] });
    }
    function setOverlay(items) {
      for (const it of ov.items) gl.deleteBuffer(it.buf);
      ov.items = []; ov.center = null;
      const lo3 = [Infinity, Infinity, Infinity], hi3 = [-Infinity, -Infinity, -Infinity];
      for (const it of items) for (let i = 0; i < it.pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = it.pos[i + k]; if (v < lo3[k]) lo3[k] = v; if (v > hi3[k]) hi3[k] = v; }
      if (!isFinite(lo3[0])) { redraw(); return null; }
      const c = [0, 1, 2].map(k => (lo3[k] + hi3[k]) / 2);
      for (const it of items) {
        const rel = new Float32Array(it.pos.length);
        for (let i = 0; i < rel.length; i += 3) { rel[i] = it.pos[i] - c[0]; rel[i + 1] = it.pos[i + 1] - c[1]; rel[i + 2] = it.pos[i + 2] - c[2]; }
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, rel, gl.STATIC_DRAW);
        ov.items.push({ cls: it.cls, buf, n: rel.length / 3, color: it.color.map(v => v / 255), visible: true });
      }
      ov.center = c; ov.lo = lo3; ov.hi = hi3;
      ov.pose = { cx: center[0], cy: center[1], cz: center[2], rot: 0 };
      redraw();
      return { center: c, lo: lo3, hi: hi3 };
    }

    function draw() {
      raf = 0;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0.05, 0.08, 0.1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      const ce = Math.cos(view.el), se = Math.sin(view.el);
      const eye = [view.tx + view.dist * ce * Math.cos(view.az), view.ty + view.dist * ce * Math.sin(view.az), view.tz + view.dist * se];
      const m = mul(persp(0.8, w / h, Math.max(0.01, view.dist * 0.02), view.dist * 40 + ext * 4), look(eye, [view.tx, view.ty, view.tz], [0, 0, 1]));
      gl.uniformMatrix4fv(un.mvp, false, m);
      last.m = m; last.w = w; last.h = h; last.dpr = dpr;
      gl.uniform3f(un.off, 0, 0, 0); gl.uniform2f(un.rot, 1, 0); gl.uniform1f(un.round, 1);
      gl.uniform1f(un.size, state.fill ? state.size : state.size * dpr);
      gl.uniform1f(un.persp, state.fill ? 1 : 0); gl.uniform1f(un.shade, state.shade ? 1 : 0);
      gl.uniform1f(un.k, h / (2 * Math.tan(0.4)) * 0.02);
      gl.uniform1f(un.mode, state.mode);
      gl.uniform3f(un.center, center[0], center[1], center[2]);
      gl.uniform1f(un.zmin, lo[2]); gl.uniform1f(un.zmax, hi[2]);
      gl.enableVertexAttribArray(loc.pos); gl.enableVertexAttribArray(loc.col);
      for (const b of bufs) {
        if (!b.visible || !b.n) continue;
        gl.uniform3f(un.cls, b.color[0], b.color[1], b.color[2]);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.c); gl.vertexAttribPointer(loc.col, 3, gl.UNSIGNED_BYTE, true, 0, 0);
        if (state.detail >= 0.999 || !b.ranges.length) gl.drawArrays(gl.POINTS, 0, b.n);
        else for (const r of b.ranges) { const c = Math.max(1, Math.floor(r.count * state.detail)); gl.drawArrays(gl.POINTS, r.start, c); }
      }
      gl.uniform1f(un.persp, 0); gl.uniform1f(un.shade, 0); gl.uniform1f(un.size, state.size * dpr);
      if (sel) {
        const b = bufs[sel.gi];
        if (b && b.visible) {
          gl.disable(gl.DEPTH_TEST);
          gl.uniform1f(un.mode, 1); gl.uniform3f(un.cls, 1, 1, 1); gl.uniform1f(un.size, Math.max(4, state.size + 3) * dpr);
          gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, b.c); gl.vertexAttribPointer(loc.col, 3, gl.UNSIGNED_BYTE, true, 0, 0);
          gl.drawArrays(gl.POINTS, sel.range.start, sel.range.count);
          if (selBox) { drawLines(selBox, [1, 0.92, 0.2]); }
          gl.enable(gl.DEPTH_TEST);
        }
      }
      if (ov.on && ov.items.length) {
        gl.disable(gl.DEPTH_TEST);
        gl.disableVertexAttribArray(loc.col); gl.vertexAttrib3f(loc.col, 0, 0, 0);
        gl.uniform1f(un.mode, 1); gl.uniform1f(un.round, 0);
        gl.uniform3f(un.off, ov.pose.cx - center[0], ov.pose.cy - center[1], ov.pose.cz - center[2]);
        gl.uniform2f(un.rot, Math.cos(ov.pose.rot), Math.sin(ov.pose.rot));
        for (const it of ov.items) {
          if (!it.visible || !it.n) continue;
          gl.uniform3f(un.cls, it.color[0], it.color[1], it.color[2]);
          gl.bindBuffer(gl.ARRAY_BUFFER, it.buf); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.LINES, 0, it.n);
        }
        gl.enableVertexAttribArray(loc.col);
        gl.enable(gl.DEPTH_TEST);
      }
    }
    function drawLines(buf, col) {
      gl.disableVertexAttribArray(loc.col); gl.vertexAttrib3f(loc.col, 0, 0, 0);
      gl.uniform1f(un.round, 0); gl.uniform3f(un.cls, col[0], col[1], col[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.buf); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, buf.n);
      gl.enableVertexAttribArray(loc.col); gl.uniform1f(un.round, 1);
    }
    const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); };

    // interaction
    const ptrs = new Map();
    let lastPinch = 0;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    let down = null;
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }); lastPinch = 0; down = ptrs.size === 1 && e.button === 0 ? { x: e.clientX, y: e.clientY, t: Date.now() } : null; });
    const up = e => {
      if (e.type === 'pointerup' && down && ptrs.size === 1 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && Date.now() - down.t < 600) {
        const r = canvas.getBoundingClientRect(); doPick(e.clientX - r.left, e.clientY - r.top);
      }
      down = null; ptrs.delete(e.pointerId); lastPinch = 0;
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 5) down = null;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) {
        const a = Array.from(ptrs.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (lastPinch) view.dist = Math.max(ext * 0.05, Math.min(ext * 8, view.dist * lastPinch / d));
        lastPinch = d; redraw(); return;
      }
      if (p.b === 2 || p.b === 1 || p.shift || e.shiftKey) {
        const s = view.dist * 0.0016;
        const rx = -Math.sin(view.az), ry = Math.cos(view.az);
        view.tx -= (rx * dx) * s; view.ty -= (ry * dx) * s; view.tz += dy * s;
      } else {
        view.az -= dx * 0.006; view.el = Math.max(-1.5, Math.min(1.5, view.el + dy * 0.006));
      }
      redraw();
    });
    canvas.addEventListener('wheel', e => { e.preventDefault(); view.dist = Math.max(ext * 0.05, Math.min(ext * 8, view.dist * Math.exp(e.deltaY * 0.0012))); redraw(); }, { passive: false });
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(canvas);

    redraw();
    return {
      groups: bufs,
      setMode(m) { state.mode = m; redraw(); },
      setSize(s) { state.size = s; redraw(); },
      setDetail(f) { state.detail = f; redraw(); },
      setFill(v) { state.fill = v; redraw(); },
      setShade(v) { state.shade = v; redraw(); },
      setVisible(cls, v) { for (const b of bufs) if (b.cls === cls) b.visible = v; redraw(); },
      reset() { Object.assign(view, home); redraw(); },
      render: draw,
      pick: doPick, select,
      setOverlay,
      setOverlayPose(p) { Object.assign(ov.pose, p); redraw(); },
      setOverlayOn(v) { ov.on = v; redraw(); },
      setOverlayVisible(cls, v) { for (const it of ov.items) if (it.cls === cls) it.visible = v; redraw(); },
      overlay: ov,
      info: { center, ext, lo, hi }
    };
  }

  root.Viewer3D = Viewer3D;
})(typeof window !== 'undefined' ? window : globalThis);
