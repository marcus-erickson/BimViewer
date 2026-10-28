// Synthetic check for shape matching. A chair labeled as a window should be flagged; correct windows and chairs should not.
require('../src/scan.js');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const j = (v, pct) => v * (1 + (rnd() - 0.5) * pct);
const mk = (cls, idx, size, z0) => ({ cls, idx, name: cls + '_' + idx, slice: 'S1', points: 5000, size, p1: [idx, idx, z0], p99: [idx + size[0], idx + size[1], z0 + size[2]], mean: [idx + size[0] / 2, idx + size[1] / 2, z0 + size[2] / 2], min: [0, 0, z0], max: [0, 0, z0 + size[2]] });
const objs = [{ ...mk('floor', 0, [30, 30, 0.02], 0), p1: [-1, -1, 0], p99: [40, 40, 0.02], mean: [20, 20, 0.01] }];
for (let i = 1; i <= 12; i++) objs.push(mk('chair', i, [j(0.5, 0.3), j(0.5, 0.3), j(0.8, 0.2)], 0));
for (let i = 1; i <= 8; i++) objs.push(mk('table', i, [j(1.2, 0.3), j(0.7, 0.3), j(0.75, 0.1)], 0));
for (let i = 1; i <= 8; i++) objs.push(mk('window', i, [j(1.4, 0.4), j(0.12, 0.3), j(1.2, 0.3)], 0.9));
const bad = mk('window', 99, [0.52, 0.55, 0.8], 0);      // chair labeled as window
const odd = mk('chair', 98, [0.55, 0.5, 0.85], 0);       // fine chair
objs.push(bad, odd);
const q = SCAN.qa(objs, { floorZ: 0 });
const hit = q.flagged.filter(o => q.flags.get(o).some(x => x.rule === 'Shape fits another class')).map(o => o.name);
console.log('shape flags:', hit);
console.log(q.flags.get(bad).filter(x => x.rule === 'Shape fits another class').map(x => x.msg));
if (hit.length !== 1 || hit[0] !== 'window_99') { console.error('FAIL'); process.exit(1); } else console.log('ok');
