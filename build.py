"""Build dist/index.html (a complete page) from src/ and data/.

  python3 build.py                  writes dist/index.html
  python3 build.py --fragment OUT   writes the same page without the <html> wrapper, for hosts that add their own
  python3 build.py --snapshot SNAP.json --fragment OUT
                                    embeds a snapshot made by tools/snapshot.js, so the page opens with that file's results
"""
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
rd = lambda *p: open(os.path.join(here, *p), encoding='utf-8').read()
safe = lambda js: js.replace('</script', '<\\/script')
t = rd('src', 'template.html')
parts = {
    '/*RVTJS*/': safe(rd('src', 'rvt.js')), '/*IFCJS*/': safe(rd('src', 'ifc.js')),
    '/*SCANJS*/': safe(rd('src', 'scan.js')), '/*VIEWERJS*/': safe(rd('src', 'viewer.js')),
    '/*SAMPLE*/null': rd('data', 'sample.json').replace('</', '<\\/'),
    '/*SAMPLEIFC*/null': rd('data', 'sample_ifc.json').replace('</', '<\\/'),
}
args = sys.argv[1:]
snap = args[args.index('--snapshot') + 1] if '--snapshot' in args else None
parts['/*SNAPSHOT*/null'] = open(snap, encoding='utf-8').read().replace('</', '<\\/') if snap else 'null'
for k, v in parts.items():
    assert k in t, 'missing placeholder ' + k
    t = t.replace(k, v)
if '--fragment' in args:
    out = args[args.index('--fragment') + 1]
else:
    out = os.path.join(here, 'dist', 'index.html')
    t = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
         '<meta name="viewport" content="width=device-width, initial-scale=1">\n' + t + '\n</body>\n</html>\n')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(t)
print('wrote', out, len(t), 'bytes')
if out.endswith('index.html'):
    frag = os.path.join(here, 'dist', 'claude-artifact.html')
    open(frag, 'w', encoding='utf-8').write(t[t.index('<title>'):t.rindex('\n</body>')])
    print('wrote', frag)
