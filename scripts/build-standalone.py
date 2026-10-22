#!/usr/bin/env python3
"""index.html + css + js 를 한 파일로 합쳐 foley-artist.html 을 만든다.
   사용법: python3 scripts/build-standalone.py
   (파일 하나만 내려받아 더블클릭해도 열리게 하기 위한 용도)"""
import base64, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")

def inline_css(m):
    css = (root / m.group(1)).read_text(encoding="utf-8")
    css = css.replace('url("../assets/', 'url("assets/')   # CSS가 HTML 안으로 들어오므로 경로 보정
    return "<style>\n" + css + "\n</style>"

def sound_data_uri(path):
    data = (root / path).read_bytes()
    return "data:audio/ogg;base64," + base64.b64encode(data).decode()

def inline_js(m):
    js = (root / m.group(1)).read_text(encoding="utf-8")
    # 효과음은 파일 하나로도 울리도록 data URI로 묶음
    js = re.sub(r"'(assets/sounds/[^']+\.ogg)'", lambda mm: "'" + sound_data_uri(mm.group(1)) + "'", js)
    if "</script" in js:
        sys.exit(f"{m.group(1)} 안에 </script> 문자열이 있어 인라인할 수 없어요")
    return "<script>\n" + js + "\n</script>"

html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', inline_css, html)
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_js, html)

# 매니페스트·아이콘 링크는 단독 파일에서 쓸 수 없으니 정리
html = re.sub(r'\s*<link rel="manifest"[^>]*>', "", html)
html = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>', "", html)
svg = (root / "icons/icon.svg").read_bytes()
data = "data:image/svg+xml;base64," + base64.b64encode(svg).decode()
html = re.sub(r'<link rel="icon" href="[^"]+" type="image/svg\+xml">', f'<link rel="icon" href="{data}">', html)

html = html.replace("<head>", "<head>\n  <!-- 이 파일은 scripts/build-standalone.py 로 만들어진 단독 실행용입니다. 수정은 index.html / css / js 에서 하세요. -->", 1)
out = root / "foley-artist.html"
out.write_text(html, encoding="utf-8")
print(f"made {out.name} ({out.stat().st_size // 1024} KB)")
