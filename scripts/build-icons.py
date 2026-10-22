#!/usr/bin/env python3
"""iconify JSON(@iconify-json/ph, @iconify-json/fluent-emoji-flat)에서 필요한 아이콘만 뽑아 js/icons.js 를 만든다.
   사용법: npm pack @iconify-json/ph @iconify-json/fluent-emoji-flat 로 받은 패키지 폴더를 인자로 넘김
   python3 scripts/build-icons.py <ph package dir> <fluent-emoji-flat package dir>"""
import json, sys, pathlib
if len(sys.argv) < 3:
    sys.exit(__doc__)
ph = json.load(open(pathlib.Path(sys.argv[1]) / 'icons.json'))
fe = json.load(open(pathlib.Path(sys.argv[2]) / 'icons.json'))
chars = json.load(open(pathlib.Path(sys.argv[2]) / 'chars.json'))
src = pathlib.Path(__file__).resolve().parent.parent / 'js' / 'icons.js'
cur = src.read_text(encoding='utf-8')
start = cur.index('window.FOLEY_ICONS = ') + len('window.FOLEY_ICONS = ')
end = cur.index(';\n', start)
data = json.loads(cur[start:end])
for n in data['ph']:
    data['ph'][n] = ph['icons'][n]['body']
for e in data['emoji']:
    k = '-'.join(f"{ord(c):x}" for c in e if ord(c) != 0xfe0f)
    n = chars.get(k) or chars.get(k + '-fe0f')
    data['emoji'][e] = fe['icons'][n]['body']
src.write_text(cur[:start] + json.dumps(data, ensure_ascii=False) + cur[end:], encoding='utf-8')
print('updated', src)
