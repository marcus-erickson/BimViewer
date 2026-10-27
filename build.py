"""Build dist/index.html: one self-contained page from src/ and data/."""
import os
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
os.makedirs(os.path.join(here, 'dist'), exist_ok=True)
open(os.path.join(here, 'dist', 'index.html'), 'w', encoding='utf-8').write(t)
print('wrote dist/index.html', len(t), 'bytes')
