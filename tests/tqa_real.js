// Regression test using measurements taken from the real L1_C106 scan.
// Each case is an object that an earlier version flagged wrongly, plus the one real mislabel.
require('../src/scan.js');
const o = (cls, idx, slice, size, p1, p99) => ({ cls, idx, name: cls + '_' + idx, slice, points: 5000, size, p1, p99, mean: [(p1[0] + p99[0]) / 2, (p1[1] + p99[1]) / 2, (p1[2] + p99[2]) / 2], min: p1, max: p99 });
const objs = [
  o('floor', 1, 'S1', [2.98, 0.29, 0.02], [3.06, 3.54, -0.79], [6.04, 3.83, -0.78]),
  o('floor', 2, 'S1', [8, 8, 0.02], [-6, -11.8, -1.1], [6.1, 3.8, -1.08]),
  o('window', 1, 'S1', [0.51, 0.28, 2.96], [3.77, -11.78, -1.11], [4.28, -11.5, 1.86]),   // floor-to-ceiling glass: fine
  o('window', 2, 'S1', [0.58, 0.62, 0.81], [3.67, 2.58, -1.07], [4.25, 3.19, -0.27]),    // really a chair: flag
  o('light', 1, 'S1', [0.15, 4.0, 0.02], [2.96, -7.85, 2.89], [3.12, -3.85, 2.91]),      // 4 m linear light: fine
  o('light', 2, 'S1', [0.21, 4.19, 0.02], [2.97, -2.9, 2.89], [3.17, 1.29, 2.91]),
  o('light', 3, 'S1', [0.16, 4.07, 0.02], [4.78, -7.9, 2.89], [4.95, -3.83, 2.91]),
  o('light', 4, 'S1', [0.18, 4.17, 0.02], [4.8, -2.91, 2.89], [4.98, 1.26, 2.91]),
  o('light', 5, 'S1', [0.2, 0.2, 0.02], [0, 0, 2.89], [0.2, 0.2, 2.91]),
  o('light', 6, 'S1', [0.2, 0.2, 0.02], [1, 0, 2.89], [1.2, 0.2, 2.91]),
  o('light', 7, 'S1', [0.2, 0.2, 0.02], [2, 0, 2.89], [2.2, 0.2, 2.91]),
  o('light', 8, 'S1', [0.2, 0.2, 0.02], [2.5, 0.5, 2.89], [2.7, 0.7, 2.91]),
  o('table', 1, 'S4', [0.69, 1.57, 0.01], [-4.81, -9.05, -0.10], [-4.12, -7.48, -0.09]),   // tabletop only: minor note
  o('table', 5, 'S2', [0.14, 1.49, 0.17], [-0.64, -6.19, -0.56], [-0.5, -4.7, -0.39]),     // cut at slice edge: minor note
  o('chair', 23, 'S2', [0.63, 0.63, 0.79], [-0.35, 0.67, -1.05], [0.28, 1.3, -0.27]),      // good chair
  o('wall', 3, 'S2', [9.79, 0.1, 2.5], [-0.5, -11.5, -1.1], [9.3, -11.4, 1.4]),             // long wall: fine
];
const q = SCAN.qa(objs, { floorZ: -0.9 });
const flagged = q.flagged.map(x => x.name + ': ' + q.flags.get(x).map(y => y.rule).join('; '));
console.log(flagged);
const bad = [];
for (const n of ['window_1', 'light_1', 'light_2', 'light_3', 'light_4', 'chair_23', 'wall_3']) if (q.flags.has(objs.find(x => x.name === n))) bad.push(n + ' should not be flagged');
if (!q.flags.has(objs.find(x => x.name === 'window_2'))) bad.push('window_2 should be flagged');
const hi = q.flagged.filter(x => q.flags.get(x).some(y => y.sev !== 'low')).map(x => x.name);
if (hi.join() !== 'window_2') bad.push('only window_2 should be above Minor, got ' + hi.join());
if (bad.length) { console.error('FAIL', bad); process.exit(1); } else console.log('ok');
