// Synthetic check: a room with a pit. Chairs and a window should be judged against the floor under them.
require('../src/scan.js');
const mk = (cls, idx, xy, z0, z1, size, mean) => ({ cls, idx, name: cls + '_' + idx, slice: 'S1', points: 5000, size, p1: [xy[0] - size[0] / 2, xy[1] - size[1] / 2, z0], p99: [xy[0] + size[0] / 2, xy[1] + size[1] / 2, z1], mean: mean || [xy[0], xy[1], (z0 + z1) / 2], min: [0,0,z0], max: [0,0,z1] });
const objs = [
  mk('floor', 1, [0, 0], 0, 0.02, [10, 4, 0.02]),            // upper floor at z=0
  mk('floor', 2, [0, 6], -0.8, -0.78, [10, 4, 0.02]),        // pit floor at z=-0.8
  mk('chair', 1, [2, 0], 0.0, 0.8, [0.5, 0.5, 0.8]),         // chair on the upper floor
  mk('chair', 2, [2, 6], -0.8, 0.0, [0.5, 0.5, 0.8]),        // chair in the pit
  mk('window', 1, [4, 6], 0.5, 1.6, [1.2, 0.1, 1.1]),        // window 1.3 m above pit floor: fine
  mk('window', 2, [5, 6], -0.8, 0.0, [0.6, 0.6, 0.8]),       // chair-sized window on pit floor: flagged
];
const q = SCAN.qa(objs, { floorZ: -0.4 });
const names = q.flagged.map(o => o.name + ': ' + q.flags.get(o).map(x => x.rule).join('; '));
console.log(names);
const bad = q.flagged.filter(o => o.name !== 'window_2');
if (bad.length || !q.flagged.some(o => o.name === 'window_2')) { console.error('FAIL'); process.exit(1); } else console.log('ok');
