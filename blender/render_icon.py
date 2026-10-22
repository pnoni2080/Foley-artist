"""폴리 아티스트 3D 앱 아이콘 렌더 (Blender bpy, 화면 없이 실행)
사용법:  python -c "import bpy" 가 되는 환경에서
         python blender/render_icon.py [출력폴더] [샘플수]
결과:    icon3d.png (파란 둥근 배경 포함, 1024px), logo3d.png (배경 투명, 1024px)
"""
import math
import sys
import bpy
from mathutils import Vector

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else 'blender/out'
SAMPLES = int(sys.argv[2]) if len(sys.argv) > 2 else 96
SIZE = 1024

# ---------- 초기화 ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'   # 색을 선명하게(필름 느낌 끔)


def material(name, color, rough=0.45, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emit
    return m


def srgb(hexstr):
    """#RRGGBB → 선형 RGB"""
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True


def place(o, loc, rot=(0, 0, 0), parent=None):
    """부모를 먼저 정하고 위치를 '부모 기준'으로 둔다 (ops 없이 안전하게)"""
    if parent:
        o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    return o


def box(name, size, loc, mat, bevel=0.06, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    for v in o.data.vertices:              # 정점을 직접 늘려서 크기를 굽는다
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    mod = o.modifiers.new('bevel', 'BEVEL')
    mod.width = min(bevel, min(size) * 0.45)
    mod.segments = 6
    mod.limit_method = 'NONE'
    o.data.materials.append(mat)
    smooth(o)
    return place(o, loc, rot, parent)


# ---------- 재질 ----------
BLUE = material('blue', srgb('#3b82f6'), rough=0.35)
NAVY = material('navy', srgb('#1e3a8a'), rough=0.4)
YELLOW = material('yellow', srgb('#ffcf4a'), rough=0.4)
WHITE = material('white', srgb('#f8fafc'), rough=0.3)
RED = material('red', srgb('#ff5a5f'), rough=0.3, emit=0.15)
SILVER = material('silver', srgb('#d7dde6'), rough=0.3, metal=0.85)
DARK = material('dark', srgb('#334155'), rough=0.5)

# ---------- 배경 판 (둥근 사각 타일) ----------
plate = box('plate', (4.6, 4.6, 0.5), (0, 0, -0.25), BLUE, bevel=0.5)

# ---------- 클래퍼보드 ----------
root = bpy.data.objects.new('clapper', None)
scene.collection.objects.link(root)
root.location = (-0.55, 0.15, 0.0)
root.rotation_euler = (0, 0, math.radians(-12))
body = box('body', (2.0, 0.28, 1.25), (0, 0, 0.625), NAVY, bevel=0.07, parent=root)
# 본체 가운데 파형 막대(흰색)
for i, h in enumerate([0.35, 0.7, 0.5, 0.95, 0.6, 0.8, 0.4]):
    x = -0.72 + i * 0.24
    box(f'bar{i}', (0.11, 0.08, h), (x, -0.17, 0.62), WHITE, bevel=0.05, parent=root)
# 위쪽 슬레이트: 왼쪽 경첩을 축으로 살짝 열림
hinge = bpy.data.objects.new('hinge', None)
scene.collection.objects.link(hinge)
hinge.parent = root
hinge.location = (-1.0, 0, 1.25)
hinge.rotation_euler = (0, math.radians(-18), 0)
slate = box('slate', (2.0, 0.26, 0.34), (1.0, 0, 0.17), YELLOW, bevel=0.06, parent=hinge)
for i in range(4):
    box(f'stripe{i}', (0.22, 0.30, 0.36), (0.25 + i * 0.5, 0, 0.17), NAVY, bevel=0.03,
        rot=(0, 0, math.radians(22)), parent=hinge)

# ---------- 마이크 ----------
mic = bpy.data.objects.new('mic', None)
scene.collection.objects.link(mic)
mic.location = (1.0, -0.45, 0.0)
mic.rotation_euler = (0, math.radians(22), math.radians(8))
mic.scale = (0.85, 0.85, 0.85)
bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=1.15, vertices=48)
handle = bpy.context.active_object
handle.name = 'handle'
handle.data.materials.append(DARK)
smooth(handle)
place(handle, (0, 0, 0.575), parent=mic)
bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.05)
ring = bpy.context.active_object
ring.name = 'ring'
ring.data.materials.append(RED)
smooth(ring)
place(ring, (0, 0, 1.17), parent=mic)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.36, segments=64, ring_count=32)
head = bpy.context.active_object
head.name = 'head'
head.data.materials.append(SILVER)
smooth(head)
place(head, (0, 0, 1.48), parent=mic)
# 그물 느낌: 와이어프레임 변형 복제
mesh = head.copy()
mesh.data = head.data.copy()
scene.collection.objects.link(mesh)
mesh.name = 'mesh'
wire = mesh.modifiers.new('wire', 'WIREFRAME')
wire.thickness = 0.012
mesh.data.materials.clear()
mesh.data.materials.append(DARK)
place(mesh, (0, 0, 1.48), parent=mic)
mesh.scale = (1.02, 1.02, 1.02)

# ---------- 조명 ----------
def area(name, loc, energy, size, color=(1, 1, 1)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.active_object
    l.name = name
    l.data.energy = energy
    l.data.size = size
    l.data.color = color
    direction = Vector((0, 0, 0.6)) - Vector(loc)
    l.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return l

area('key', (3, -4, 5), 900, 4)
area('fill', (-4, -3, 3), 350, 5, (0.9, 0.95, 1.0))
area('rim', (0, 4, 4), 500, 3)
world = bpy.data.worlds.new('world')
scene.world = world
world.use_nodes = True
nt = world.node_tree
bg_light = nt.nodes['Background']                       # 조명용 하늘빛
bg_light.inputs['Color'].default_value = (0.85, 0.9, 1.0, 1)
bg_light.inputs['Strength'].default_value = 0.6
bg_cam = nt.nodes.new('ShaderNodeBackground')           # 카메라에만 보이는 배경색(앱 바탕색)
bg_cam.inputs['Color'].default_value = (*srgb('#e3ecfa'), 1)
bg_cam.inputs['Strength'].default_value = 1.0
mix = nt.nodes.new('ShaderNodeMixShader')
lp = nt.nodes.new('ShaderNodeLightPath')
out = nt.nodes['World Output']
nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
nt.links.new(bg_light.outputs['Background'], mix.inputs[1])
nt.links.new(bg_cam.outputs['Background'], mix.inputs[2])
nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])

# ---------- 카메라 ----------
bpy.ops.object.camera_add(location=(0.3, -6.6, 6.6))
cam = bpy.context.active_object
cam.data.lens = 64
cam.rotation_euler = (Vector((0, 0, 0.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

import os
os.makedirs(OUT, exist_ok=True)

bpy.context.view_layer.update()
for n in ['body', 'slate', 'stripe0', 'bar0', 'handle', 'head', 'plate']:
    o = bpy.data.objects[n]
    print('POS', n, [round(v, 2) for v in o.matrix_world.translation], 'dims', [round(v, 2) for v in o.dimensions])
if os.environ.get('NO_RENDER'):
    sys.exit(0)

# 1) 홈 화면용 아이콘: 바탕색이 끝까지 채워짐(둥글게/동그랗게 잘려도 안전)
scene.render.film_transparent = False
scene.render.filepath = os.path.join(OUT, 'icon3d.png')
bpy.ops.render.render(write_still=True)
print('rendered', scene.render.filepath)

# 2) 타일 포함, 바깥은 투명 (앱 안의 빈 화면 그림용)
scene.render.film_transparent = True
scene.render.filepath = os.path.join(OUT, 'tile3d.png')
bpy.ops.render.render(write_still=True)
print('rendered', scene.render.filepath)

# 3) 타일 없이 투명 (상단 로고용)
plate.hide_render = True
scene.render.filepath = os.path.join(OUT, 'logo3d.png')
bpy.ops.render.render(write_still=True)
print('rendered', scene.render.filepath)
