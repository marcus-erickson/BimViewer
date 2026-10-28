"""Build dist/index.html (a complete page) from src/ and data/.

  python3 build.py                  writes dist/index.html
  python3 build.py --fragment OUT   writes the same page without the <html> wrapper, for hosts that add their own
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
for k, v in parts.items():
    assert k in t, 'missing placeholder ' + k
    t = t.replace(k, v)
if len(sys.argv) > 2 and sys.argv[1] == '--fragment':
    out = sys.argv[2]
else:
    out = os.path.join(here, 'dist', 'index.html')
    t = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
         '<meta name="viewport" content="width=device-width, initial-scale=1">\n' + t + '\n</body>\n</html>\n')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(t)
print('wrote', out, len(t), 'bytes')
