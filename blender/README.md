# Blender로 만든 3D 아이콘

`render_icon.py`가 클래퍼보드 + 마이크 장면을 코드로 만들고 Cycles(CPU)로 렌더합니다.

```bash
python3 -m venv bpyenv && ./bpyenv/bin/pip install bpy   # Blender 파이썬 모듈 (약 400MB)
./bpyenv/bin/python blender/render_icon.py blender/out 128   # 샘플 128, 약 2분
```

결과 (`blender/out/`): `icon3d.png`(홈 화면 아이콘, 바탕색 포함), `tile3d.png`(타일 포함·바깥 투명), `logo3d.png`(투명 로고)
→ ffmpeg로 줄여 `icons/icon3d-*.png`, `icons/logo3d-256.png`, `icons/tile3d-512.png`로 넣었습니다.

라이선스: Blender는 GPL이지만 렌더 결과물은 만든 사람의 것이라 앱에 자유롭게 쓸 수 있습니다.

되돌리기: 이 아이콘을 넣은 커밋 하나만 `git revert` 하면 이전 SVG 아이콘으로 돌아갑니다.
