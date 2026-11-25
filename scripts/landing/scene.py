"""The landing's 3D scene: phone, monitor and laptop showing Legato, floating with glossy objects around.

Blender 5.x, headless:
  blender -b -P scripts/landing/scene.py -- --variant dark --tex <dir of PNG shots> --out render.png
      [--samples 64] [--scale 100] [--blend scene.blend]
Textures: library-phone-, library-, player-{dark,light}.png (site/public/shots converted to PNG).
Background stays transparent (film_transparent): the page's colour shows through.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def arg(name, default):
    flag = "--" + name
    return ARGS[ARGS.index(flag) + 1] if flag in ARGS else default


VARIANT = arg("variant", "dark")
TEX = arg("tex", ".")
OUT = arg("out", "")
SAMPLES = int(arg("samples", "32"))
SCALE = int(arg("scale", "50"))
BLEND = arg("blend", "")
DARK = VARIANT == "dark"
R = math.radians

# Clean slate.
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection


# --- Materials -------------------------------------------------------------------------------------------------

def material(name, color, metal=0.0, rough=0.3, coat=0.0, image=None, emit=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = 0.03
    if image:
        t = m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(os.path.join(TEX, image))
        t.interpolation = "Cubic"
        m.node_tree.links.new(t.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = emit
        p.inputs["Specular IOR Level"].default_value = 0.15
    return m


def srgb(h):
    # Hex to linear.
    return tuple(((int(h[i : i + 2], 16) / 255) ** 2.2) for i in (0, 2, 4))


BLUE = srgb("7CB8FF")
M = {
    "frame": material("Frame", (0.09, 0.09, 0.1) if DARK else (0.72, 0.73, 0.75), metal=1, rough=0.26),
    "glass": material("Black glass", (0.004, 0.004, 0.005), rough=0.05, coat=1),
    "keys": material("Keys", (0.012, 0.012, 0.013), rough=0.45),
    "pad": material("Trackpad", (0.06, 0.06, 0.065) if DARK else (0.55, 0.56, 0.58), metal=1, rough=0.35),
    "gold": material("Gold", (1.0, 0.68, 0.26), metal=1, rough=0.16),
    "chrome": material("Chrome", (0.92, 0.92, 0.95), metal=1, rough=0.07),
    "blue": material("Legato blue", BLUE, rough=0.18, coat=1),
    "vinyl": material("Vinyl", (0.006, 0.006, 0.007), rough=0.3, coat=0.3),
    "black": material("Matte black", (0.01, 0.01, 0.01), rough=0.6),
    "cushion": material("Cushion", (0.03, 0.03, 0.035), rough=0.55),
}
# Screens: the shot as emission under a glossy black glass.
for key, shot in (("phone", "library-phone"), ("monitor", "library"), ("laptop", "player")):
    M[key] = material(f"Screen {key}", (0, 0, 0), rough=0.04, coat=0.0, image=f"{shot}-{VARIANT}.png")

# Vinyl grooves: rings bump on the record's top.
_v = M["vinyl"].node_tree
_w = _v.nodes.new("ShaderNodeTexWave")
_w.wave_type = "RINGS"
_w.inputs["Scale"].default_value = 90
_b = _v.nodes.new("ShaderNodeBump")
_b.inputs["Strength"].default_value = 0.03
_v.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.2
_v.links.new(_w.outputs["Fac"], _b.inputs["Height"])
_v.links.new(_b.outputs["Normal"], _v.nodes["Principled BSDF"].inputs["Normal"])


# --- Geometry helpers ------------------------------------------------------------------------------------------

def link(name, bm, mat, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.data.materials.append(mat)
    ob.location, ob.rotation_euler, ob.parent = loc, rot, parent
    return ob


def bevel(ob, width, segments=4):
    b = ob.modifiers.new("Bevel", "BEVEL")
    b.width, b.segments, b.limit_method, b.harden_normals = width, segments, "ANGLE", True
    b.angle_limit = R(50)
    return ob


def rounded(w, h, r, n=10):
    pts = []
    for cx, cz, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        pts += [(cx + r * math.cos(R(a0 + 90 * i / n)), cz + r * math.sin(R(a0 + 90 * i / n))) for i in range(n + 1)]
    return pts


def slab(name, w, h, d, r, mat, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), edge=0.004):
    """Rounded-rectangle slab in XZ, front face at y=0 looking at -Y, depth to +Y."""
    bm = bmesh.new()
    pts = rounded(w, h, r)
    f = [bm.verts.new((x, 0, z)) for x, z in pts]
    b = [bm.verts.new((x, d, z)) for x, z in pts]
    bm.faces.new(f)
    bm.faces.new(b)
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((f[i], f[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bevel(link(name, bm, mat, parent, loc, rot), edge)


def screen(name, w, h, r, mat, parent, loc):
    """One flat rounded face looking at -Y, UVs spanning the shot."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    face = bm.faces.new([bm.verts.new((x, 0, z)) for x, z in rounded(w, h, r)])
    bm.normal_update()
    if face.normal.y > 0:
        face.normal_flip()
    for loop in face.loops:
        loop[uv].uv = (loop.vert.co.x / w + 0.5, loop.vert.co.z / h + 0.5)
    return link(name, bm, mat, parent, loc, smooth=False)


def box(name, size, mat, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), edge=0.003):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    return bevel(link(name, bm, mat, parent, loc, rot), edge, 3)


def disc(name, radius, depth, mat, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), edge=0.002):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=96, radius1=radius, radius2=radius, depth=depth)
    return bevel(link(name, bm, mat, parent, loc, rot), edge, 3)


def ball(name, radius, mat, parent=None, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=radius)
    ob = link(name, bm, mat, parent, loc, rot)
    ob.scale = scale
    return ob


def tube(name, points, radius, mat, parent=None):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution, cu.use_fill_caps = "3D", radius, 8, True
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for p, co in zip(sp.points, points):
        p.co = (*co, 1)
    ob = bpy.data.objects.new(name, cu)
    coll.objects.link(ob)
    ob.data.materials.append(mat)
    ob.parent = parent
    # Round ends.
    for end in (points[0], points[-1]):
        ball(name + " end", radius, mat, parent, end)
    return ob


def group(name, loc, rot, scale=1.0):
    e = bpy.data.objects.new(name, None)
    coll.objects.link(e)
    e.location, e.rotation_euler, e.scale = loc, tuple(R(a) for a in rot), (scale,) * 3
    return e


# --- Devices ---------------------------------------------------------------------------------------------------

def phone(g):
    slab("Phone body", 0.44, 0.92, 0.045, 0.07, M["frame"], g, edge=0.012)
    slab("Phone glass", 0.43, 0.91, 0.004, 0.065, M["glass"], g, loc=(0, -0.002, 0), edge=0.0015)
    screen("Phone screen", 0.405, 0.405 * 1299 / 600, 0.05, M["phone"], g, (0, -0.0025, 0))
    # Side buttons.
    box("Phone button", (0.008, 0.02, 0.1), M["frame"], g, (0.222, 0.022, 0.2))


def monitor(g):
    w, h = 1.56, 1.01
    slab("Monitor body", w, h, 0.05, 0.03, M["frame"], g, edge=0.01)
    slab("Monitor glass", w - 0.01, h - 0.01, 0.004, 0.026, M["glass"], g, loc=(0, -0.002, 0), edge=0.0015)
    screen("Monitor screen", 1.5, 1.5 * 505 / 800, 0.004, M["monitor"], g, (0, -0.0025, 0.0))
    slab("Monitor neck", 0.16, 0.62, 0.035, 0.01, M["frame"], g, loc=(0, 0.06, -0.62), edge=0.008)
    slab("Monitor foot", 0.56, 0.34, 0.025, 0.06, M["frame"], g, loc=(0, 0.06, -0.93), rot=(R(90), 0, 0), edge=0.008)


def laptop(g):
    w, d = 1.1, 0.75
    # Base lies flat: a slab turned face down, top at z=0.035.
    slab("Laptop base", w, d, 0.035, 0.04, M["frame"], g, rot=(R(90), 0, 0), edge=0.01)
    pitch = 0.065 * 1.18
    keys = box("Laptop keys", (0.065, 0.065, 0.01), M["keys"], g, (-6 * pitch, 0.12 - 2 * pitch, 0.037))
    for axis, count in ((0, 13), (1, 5)):
        a = keys.modifiers.new("Rows", "ARRAY")
        a.count = count
        a.relative_offset_displace = [1.18 if i == axis else 0 for i in range(3)]
    keys.modifiers.move(0, len(keys.modifiers) - 1)  # bevel last
    slab("Laptop trackpad", 0.42, 0.25, 0.002, 0.02, M["pad"], g, loc=(0, -0.2, 0.0365), rot=(R(90), 0, 0), edge=0.001)
    # Lid at the back, open at 90 degrees.
    lid = group("Laptop lid", (0, d / 2 - 0.03, 0.035 + 0.37), (0, 0, 0))
    lid.parent = g
    slab("Laptop lid body", w, 0.74, 0.025, 0.035, M["frame"], lid, edge=0.008)
    slab("Laptop lid glass", w - 0.008, 0.732, 0.003, 0.032, M["glass"], lid, loc=(0, -0.002, 0), edge=0.001)
    sw = 1.05
    screen("Laptop screen", sw, sw * 506 / 800, 0.004, M["laptop"], lid, (0, -0.0025, 0.01))


# --- Floating objects ------------------------------------------------------------------------------------------

def note(g):
    ball("Note head", 0.1, M["gold"], g, (0, 0, 0), scale=(1.3, 0.85, 0.9), rot=(0, R(-25), 0))
    stem_x = 0.112
    tube("Note stem", [(stem_x, 0, 0.02), (stem_x, 0, 0.62)], 0.022, M["gold"], g)
    flag = [(stem_x + 0.14 * math.sin(t * 2.4) + 0.06 * t, 0, 0.62 - 0.34 * t) for t in (i / 14 for i in range(15))]
    tube("Note flag", flag, 0.028, M["gold"], g)


def vinyl(g):
    disc("Record", 0.34, 0.012, M["vinyl"], g, edge=0.003)
    disc("Record label", 0.115, 0.014, M["blue"], g, edge=0.001)
    # The L mark from src-tauri/icons/icon.svg (128 units across).
    s = 0.17 / 128
    for x0, x1, y0, y1 in ((42.7, 59.16, 28.75, 97), (53.3, 87.8, 84.34, 97)):
        cx, cy = ((x0 + x1) / 2 - 64) * s, (64 - (y0 + y1) / 2) * s
        box("Record L", ((x1 - x0) * s, (y1 - y0) * s, 0.002), M["black"], g, (cx, cy, 0.0075), edge=0.0004)


def headphones(g):
    arc = [(0.3 * math.cos(R(a)), 0, 0.3 * math.sin(R(a))) for a in range(0, 181, 6)]
    tube("Headband", arc, 0.026, M["chrome"], g)
    for side in (-1, 1):
        x = side * 0.31
        disc("Cup", 0.11, 0.085, M["blue"], g, (x, 0, -0.06), (0, R(90), 0), edge=0.03)
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=64, radius1=0.1, radius2=0.1, depth=0.04)
        bevel(link("Cushion", bm, M["cushion"], g, (x - side * 0.058, 0, -0.06), (0, R(90), 0)), 0.018, 5)
        tube("Yoke", [(x, 0, 0.0), (x * 0.98, 0, 0.06)], 0.014, M["chrome"], g)


def sync(g):
    for r in (0.12, 0.21, 0.3):
        tube("Sync arc", [(r * math.cos(R(a)), 0, r * math.sin(R(a))) for a in range(45, 136, 3)], 0.024, M["chrome"], g)
    ball("Sync dot", 0.04, M["gold"], g, (0, 0, 0.0))


phone(group("Phone", (-1.85, -0.2, 0.0), (12, -20, 26), 1.2))
monitor(group("Monitor", (0.0, 0.35, 0.22), (0, 0, -6)))
laptop(group("Laptop", (1.85, -0.1, -0.5), (22, 6, -32), 1.05))
note(group("Eighth note", (-0.95, -0.9, 0.62), (8, 18, 14), 0.7))
vinyl(group("Vinyl", (1.05, 0.9, 0.85), (74, 16, -16), 0.9))
headphones(group("Headphones", (-0.95, -0.8, -0.72), (-12, 22, -18), 0.75))
sync(group("Sync", (2.15, -0.6, 0.78), (8, -12, -16), 0.85))


# --- Light, world, camera, render ------------------------------------------------------------------------------

def area(name, loc, size, energy, target=(0, 0, 0)):
    li = bpy.data.lights.new(name, "AREA")
    li.size, li.energy = size, energy
    ob = bpy.data.objects.new(name, li)
    coll.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


area("Key", (-3.5, -4.5, 4.5), 4, 900)
area("Rim", (4.5, 3.5, 3.0), 3, 700)
area("Fill", (-2.5, -6, -2.5), 3, 160)
area("Rim left", (-4.5, 3, 2.0), 3, 500)
area("Top", (0, 0.5, 5.5), 6, 350)

# World: a studio gradient (dark floor, soft bright top) for reflections only; the film stays transparent.
world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
nt = world.node_tree
coord = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
ramp = nt.nodes.new("ShaderNodeValToRGB")
nt.links.new(coord.outputs["Generated"], sep.inputs[0])
nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.35, (0.01, 0.01, 0.012, 1)
ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 1.0, (0.9, 0.92, 1.0, 1)
mid = ramp.color_ramp.elements.new(0.55)
mid.color = (0.12, 0.12, 0.13, 1)
nt.links.new(ramp.outputs["Color"], nt.nodes["Background"].inputs["Color"])
nt.nodes["Background"].inputs["Strength"].default_value = 0.8

cam = bpy.data.cameras.new("Camera")
cam.lens = 50
camob = bpy.data.objects.new("Camera", cam)
coll.objects.link(camob)
camob.location = (0, -8.1, 1.0)
camob.rotation_euler = (Vector((0.05, 0, 0.0)) - camob.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camob

for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        pass
scene.eevee.taa_render_samples = SAMPLES
scene.eevee.use_raytracing = True
scene.eevee.use_shadows = True
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 2880, 1200
scene.render.resolution_percentage = SCALE
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"  # the shots keep their own colours

if BLEND:
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))
if OUT:
    scene.render.filepath = os.path.abspath(OUT)
    bpy.ops.render.render(write_still=True)
