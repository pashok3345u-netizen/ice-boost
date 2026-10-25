# Builds the 3D PC for the "Stand" page and exports it as one GLB.
# Run (no Blender window opens):
#   blender -b --factory-startup -P models/make-pc.py -- <out.glb> [preview.png] [preview2.png]
#
# Units are centimetres. Blender axes: X = depth (front of the case at +X),
# Y = width (glass side at -Y, motherboard tray at +Y), Z = up.
# Every part is a top-level object with custom props (exported as glTF extras):
#   part = case | glass | shroud | mobo | cpu | cooler | ram | gpu | psu | ssd_m2 | ssd_sata | hdd
#   variant = model shape the app can pick (gpu: 1/2/3 fans, cooler: box/tower)
# Fan rotors carry spin=1; the app spins them around their own local axis.
import math
import sys
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = args[0] if args else 'pc.glb'
PREVIEWS = args[1:]

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.meshes):
    bpy.data.meshes.remove(m)

PI = math.pi
SCENE = bpy.context.scene
COLL = SCENE.collection


# ---------- materials ----------

def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


def principled(m):
    if hasattr(m, 'use_nodes') and not m.use_nodes:
        m.use_nodes = True
    nt = m.node_tree
    p = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if p is None:
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        p = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(p.outputs[0], out.inputs[0])
    return p


def mat(name, color, metal=0.0, rough=0.5, emit=None, strength=1.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    p = principled(m)
    p.inputs['Base Color'].default_value = lin(color)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = lin(emit)
        p.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
    return m


M = {
    'metal': mat('metal', '#2a2c31', 0.7, 0.38),
    'metal_in': mat('metal_in', '#1c1d21', 0.5, 0.5),
    'mesh': mat('mesh', '#101113', 0.3, 0.85),
    'rubber': mat('rubber', '#0d0d0f', 0.0, 0.9),
    'glass': mat('glass', '#a9bcc4', 0.0, 0.03, alpha=0.14),
    'glass_border': mat('glass_border', '#050506', 0.0, 0.2),
    'pcb': mat('pcb', '#16181c', 0.1, 0.55),
    'silver': mat('silver', '#c3c7cc', 1.0, 0.28),
    'alu': mat('alu', '#b9bec5', 1.0, 0.34),
    'heatsink': mat('heatsink', '#3a3d44', 0.9, 0.34),
    'shroud': mat('shroud', '#25272d', 0.3, 0.42),
    'black_metal': mat('black_metal', '#1a1b1f', 0.8, 0.3),
    'copper': mat('copper', '#c27a45', 1.0, 0.3),
    'gold': mat('gold', '#d4a53c', 1.0, 0.3),
    'slot_black': mat('slot_black', '#0f1012', 0.0, 0.6),
    'slot_gray': mat('slot_gray', '#6b6f76', 0.0, 0.5),
    'rgb': mat('rgb', '#66d9ff', 0.0, 0.4, emit='#66d9ff', strength=3.0),
    'logo': mat('logo', '#d9e7e8', 0.0, 0.4, emit='#d9e7e8', strength=1.2),
    'label': mat('label', '#528a9a', 0.0, 0.5),
    'sticker': mat('sticker', '#d9e7e8', 0.0, 0.5),
    'blade': mat('blade', '#1e2025', 0.0, 0.38),
    'fan_frame': mat('fan_frame', '#17181c', 0.0, 0.5),
    'psu': mat('psu', '#18191c', 0.4, 0.55),
    'backplate': mat('backplate', '#202227', 0.8, 0.32),
    'spreader': mat('spreader', '#3b3f47', 0.9, 0.3),
    'cpu_sub': mat('cpu_sub', '#2d5a3a', 0.0, 0.6),
    'ihs': mat('ihs', '#c9ccd0', 1.0, 0.22),
}


# ---------- geometry helpers ----------

def T(v):
    return Matrix.Translation(Vector(v))


def S(v):
    return Matrix.Diagonal(Vector((v[0], v[1], v[2], 1.0)))


def R(angle, axis):
    return Matrix.Rotation(angle, 4, axis)


# rotations that turn local +Z into the given direction
AX = {
    '+Z': Matrix.Identity(4), '-Z': R(PI, 'X'),
    '+X': R(PI / 2, 'Y'), '-X': R(-PI / 2, 'Y'),
    '+Y': R(-PI / 2, 'X'), '-Y': R(PI / 2, 'X'),
}


class MB:
    """Collects primitives into one mesh (several materials)."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []
        self.base = Matrix.Identity(4)

    @contextmanager
    def at(self, matrix):
        old = self.base
        self.base = old @ matrix
        yield
        self.base = old

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _tag(self, verts, m, smooth=False):
        mi = self._mi(m)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = mi
            f.smooth = smooth and len(f.verts) == 4 if smooth == 'sides' else smooth

    def box(self, size, c, m, rot=None):
        mx = self.base @ T(c) @ (rot or Matrix.Identity(4)) @ S(size)
        self._tag(bmesh.ops.create_cube(self.bm, size=1.0, matrix=mx)['verts'], m)

    def box_m(self, mx, m):
        self._tag(bmesh.ops.create_cube(self.bm, size=1.0, matrix=self.base @ mx)['verts'], m)

    def cyl(self, r, depth, c, m, axis='+Z', segs=24, r2=None):
        mx = self.base @ T(c) @ AX[axis]
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segs,
                                    radius1=r, radius2=r if r2 is None else r2, depth=depth, matrix=mx)
        self._tag(res['verts'], m, 'sides')

    def _face(self, vs, mi, smooth):
        f = self.bm.faces.new(vs)
        f.material_index = mi
        f.smooth = smooth

    def tube(self, ro, ri, depth, c, m, axis='+Z', segs=40):
        mx = self.base @ T(c) @ AX[axis]
        mi = self._mi(m)
        rings = []
        for z in (-depth / 2, depth / 2):
            for r in (ro, ri):
                rings.append([self.bm.verts.new(mx @ Vector((r * math.cos(2 * PI * i / segs),
                                                             r * math.sin(2 * PI * i / segs), z)))
                              for i in range(segs)])
        ob, ib, ot, it = rings
        for i in range(segs):
            j = (i + 1) % segs
            self._face((ob[i], ob[j], ot[j], ot[i]), mi, True)
            self._face((it[i], it[j], ib[j], ib[i]), mi, True)
            self._face((ot[i], ot[j], it[j], it[i]), mi, False)
            self._face((ib[i], ib[j], ob[j], ob[i]), mi, False)

    def torus(self, big, small, c, m, axis='+Z', segs=48, rsegs=8):
        mx = self.base @ T(c) @ AX[axis]
        mi = self._mi(m)
        grid = []
        for i in range(segs):
            a = 2 * PI * i / segs
            row = []
            for k in range(rsegs):
                b = 2 * PI * k / rsegs
                rr = big + small * math.cos(b)
                row.append(self.bm.verts.new(mx @ Vector((rr * math.cos(a), rr * math.sin(a), small * math.sin(b)))))
            grid.append(row)
        for i in range(segs):
            for k in range(rsegs):
                i2, k2 = (i + 1) % segs, (k + 1) % rsegs
                self._face((grid[i][k], grid[i2][k], grid[i2][k2], grid[i][k2]), mi, True)

    def holed(self, w, h, r, t, c, m, segs=40):
        """Rectangle plate (w x h, thickness t along Z) with a round hole of radius r."""
        mx = self.base @ T(c)
        mi = self._mi(m)
        hw, hh = w / 2, h / 2
        corner = math.atan2(hh, hw)
        angs = sorted({round(2 * PI * i / segs, 9) for i in range(segs)} |
                      {round(a % (2 * PI), 9) for a in (corner, PI - corner, PI + corner, -corner)})
        layers = []
        for z in (-t / 2, t / 2):
            inner, outer = [], []
            for a in angs:
                ca, sa = math.cos(a), math.sin(a)
                k = 1 / max(abs(ca) / hw, abs(sa) / hh)
                outer.append(self.bm.verts.new(mx @ Vector((ca * k, sa * k, z))))
                inner.append(self.bm.verts.new(mx @ Vector((ca * r, sa * r, z))))
            layers.append((inner, outer))
        (ib, ob), (it, ot) = layers
        n = len(angs)
        for i in range(n):
            j = (i + 1) % n
            self._face((ot[i], ot[j], it[j], it[i]), mi, False)
            self._face((ib[i], ib[j], ob[j], ob[i]), mi, False)
            self._face((ob[i], ob[j], ot[j], ot[i]), mi, False)
            self._face((it[i], it[j], ib[j], ib[i]), mi, True)

    def build(self, parent=None, bevel=0.0, loc=None, rot=None):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        COLL.objects.link(ob)
        if bevel:
            mod = ob.modifiers.new('bevel', 'BEVEL')
            mod.width = bevel
            mod.segments = 2
            mod.limit_method = 'ANGLE'
        if loc is not None:
            ob.location = loc
        if rot is not None:
            ob.rotation_euler = rot.to_euler()
        if parent is not None:
            ob.parent = parent
        return ob


def root(name, part, **props):
    e = bpy.data.objects.new(name, None)
    COLL.objects.link(e)
    e['part'] = part
    for k, v in props.items():
        e[k] = v
    return e


def text(name, body, size, m, loc, rot, parent, extrude=0.03):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    tmp = bpy.data.objects.new(name + '_tmp', cu)
    COLL.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp, do_unlink=True)
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    COLL.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot.to_euler()
    ob.parent = parent
    return ob


# text facing the glass (-Y), reading along +X
FACE_GLASS = R(PI / 2, 'X')


# ---------- fans ----------

def rotor(name, parent, c, axis, radius, depth, blades=9, pitch=32):
    mb = MB(name)
    hub = radius * 0.36
    mb.cyl(hub, depth * 0.8, (0, 0, 0), M['fan_frame'], segs=28)
    mb.cyl(hub * 0.78, 0.04, (0, 0, depth * 0.4 + 0.02), M['sticker'], segs=28)
    length = radius - hub * 0.9
    chord = 2 * PI * radius * 0.62 / blades
    for i in range(blades):
        a = 2 * PI * i / blades
        mx = R(a, 'Z') @ T((hub * 0.9 + length / 2, 0, 0)) @ R(math.radians(pitch), 'X') @ \
            R(math.radians(-10), 'Z') @ S((length, chord, 0.08))
        mb.box_m(mx, M['blade'])
    ob = mb.build(parent, loc=c, rot=AX[axis])
    ob['spin'] = 1
    return ob


def case_fan(mb, name, parent, c, axis, size=12.0, depth=2.5, ring=True):
    """Square 120 mm style fan: frame goes into mb, rotor is its own object."""
    r = size * 0.48
    with mb.at(T(c) @ AX[axis]):
        mb.holed(size, size, r, depth, (0, 0, 0), M['fan_frame'])
        # motor mount and struts on the back side
        mb.cyl(r * 0.36, 0.35, (0, 0, -depth / 2 + 0.18), M['fan_frame'], segs=24)
        for i in range(4):
            a = PI / 4 + i * PI / 2
            mb.box_m(R(a, 'Z') @ T((r * 0.68, 0, -depth / 2 + 0.18)) @ S((r * 0.66, 0.28, 0.3)), M['fan_frame'])
        if ring:
            mb.torus(r + 0.08, 0.13, (0, 0, depth / 2 - 0.02), M['rgb'])
            mb.torus(r + 0.08, 0.13, (0, 0, -depth / 2 + 0.02), M['rgb'])
    return rotor(name + '_rotor', parent, c, axis, r - 0.15, depth * 0.62)


# ---------- the case ----------

def build_case():
    r = root('case', 'case')
    mb = MB('case_body')
    k = M['metal']
    mb.box((44, 22, 0.4), (0, 0, 1.4), k)            # bottom
    mb.box((44, 22, 0.4), (0, 0, 46.8), k)           # top
    mb.box((44, 0.4, 45.8), (0, 10.8, 24.1), k)      # right side (behind the board)
    mb.box((0.4, 22, 45.8), (-21.8, 0, 24.1), k)     # rear
    mb.box((0.5, 22, 45.8), (21.85, 0, 24.1), k)     # front frame
    # rails the glass sits on
    mb.box((44, 1.0, 0.8), (0, -10.4, 46.2), k)
    mb.box((44, 1.0, 0.8), (0, -10.4, 2.0), k)
    mb.box((0.8, 1.0, 45), (21.4, -10.4, 24.1), k)
    mb.box((0.8, 1.0, 45), (-21.4, -10.4, 24.1), k)
    # motherboard tray with cable holes
    mb.box((42.8, 0.2, 34), (0, 9.7, 29.6), M['metal_in'])
    for z in (18, 27, 36):
        mb.box((1.4, 0.1, 6), (6.6, 9.55, z), M['rubber'])
    # vents: top mesh, front mesh
    mb.box((30, 15, 0.04), (-3, 0, 47.02), M['mesh'])
    mb.box((0.04, 19, 42), (22.12, 0, 24.5), M['mesh'])
    # rear: I/O hole and expansion slot covers
    mb.box((0.1, 4.6, 16.4), (-21.55, 6.9, 37.8), M['mesh'])
    for i in range(7):
        mb.box((0.08, 12.0, 1.8), (-21.55, 2.6, 28.6 - i * 2.03), M['alu'])
    case = mb.build(r, bevel=0.08)

    feet = MB('case_feet')
    for x in (-18, 18):
        for y in (-8, 8):
            feet.cyl(1.4, 1.2, (x, y, 0.6), M['rubber'], segs=20)
    feet.build(r)

    fans = MB('case_fans')
    for i, z in enumerate((11.0, 23.0, 35.0)):
        case_fan(fans, f'case_front{i + 1}', r, (20.25, -0.6, z), '+X')
    case_fan(fans, 'case_rear', r, (-20.25, -0.5, 37.5), '+X')
    fans.build(r)
    return r


def build_glass():
    r = root('glass', 'glass')
    mb = MB('glass_pane')
    mb.box((43.6, 0.4, 45.6), (0, -10.8, 24.1), M['glass'])
    mb.build(r)
    edge = MB('glass_edge')
    for c, s in (((0, -10.58, 46.35), (43.6, 0.04, 0.9)), ((0, -10.58, 1.85), (43.6, 0.04, 0.9)),
                 ((21.35, -10.58, 24.1), (0.9, 0.04, 45.6)), ((-21.35, -10.58, 24.1), (0.9, 0.04, 45.6))):
        edge.box(s, c, M['glass_border'])
    edge.build(r)
    return r


def build_shroud():
    r = root('shroud', 'shroud')
    mb = MB('shroud_body')
    mb.box((40, 20, 0.3), (-1.6, -0.4, 12.45), M['metal'])        # top
    mb.box((40, 0.3, 11), (-1.6, -10.25, 7.1), M['metal'])         # side to the glass
    mb.box((0.3, 20, 11), (18.25, -0.4, 7.1), M['metal'])          # front end
    mb.box((10, 1.8, 0.06), (-1, 8.3, 12.62), M['rubber'])         # cable hole
    mb.box((30, 0.04, 0.12), (-1.6, -10.42, 2.6), M['rgb'])        # light line
    mb.build(r, bevel=0.06)
    text('shroud_logo', 'ICEBOOST', 2.4, M['logo'], (-1.6, -10.41, 7.2), FACE_GLASS, r)
    return r


# ---------- motherboard + cpu ----------

RAM_X = (-3.6, -2.6, -1.6, -0.6)
RAM_Z = 36.95
SOCKET = (-10.5, 36.5)


def build_mobo():
    r = root('mobo', 'mobo')
    mb = MB('mobo_body')
    mb.box((24.4, 0.16, 30.5), (-7.8, 8.68, 29.75), M['pcb'])
    for x in (-19.4, -8, 3.8):
        for z in (44.4, 29, 15.1):
            mb.cyl(0.32, 0.06, (x, 8.58, z), M['silver'], '-Y', segs=12)
    sx, sz = SOCKET
    mb.box((4.6, 0.3, 4.6), (sx, 8.45, sz), M['silver'])
    mb.box((3.9, 0.05, 3.9), (sx, 8.28, sz), M['slot_black'])
    mb.box((0.15, 0.15, 4.6), (sx - 2.55, 8.4, sz), M['silver'])
    for i in range(8):
        mb.cyl(0.25, 0.7, (-15 + i * 1.2, 8.25, 40.6), M['silver'], '-Y', segs=12)
    # memory slots
    for i, x in enumerate(RAM_X):
        col = M['slot_gray'] if i % 2 == 0 else M['slot_black']
        mb.box((0.6, 0.8, 13.9), (x, 8.2, RAM_Z), col)
        mb.box((0.64, 1.0, 0.5), (x, 8.1, RAM_Z + 7.0), col)
        mb.box((0.64, 1.0, 0.5), (x, 8.1, RAM_Z - 7.0), col)
    # power connectors
    mb.box((0.9, 1.4, 5.2), (3.8, 7.9, 35), M['slot_black'])
    mb.box((1.6, 1.2, 0.8), (-17.0, 8.0, 44.5), M['slot_black'])
    # PCIe slots: main x16 with metal armour, second x16, one x1
    for z, length, armour in ((28.0, 8.9, True), (18.5, 8.9, False), (22.4, 2.5, False)):
        mb.box((length, 1.1, 0.75), (-16.6 + length / 2, 8.05, z), M['slot_black'])
        if armour:
            for dz in (-0.39, 0.39):
                mb.box((length + 0.1, 1.12, 0.06), (-16.6 + length / 2, 8.04, z + dz), M['silver'])
    mb.box((0.5, 0.4, 2.2), (-14.0, 8.4, 30.5), M['slot_black'])     # M.2 connector
    mb.cyl(1.0, 0.3, (-3.0, 8.45, 24.0), M['silver'], '-Y', segs=24)  # BIOS battery
    for i in range(4):
        mb.box((0.8, 0.8, 1.1), (3.9, 8.2, 17 + i * 1.3), M['slot_black'])  # SATA ports
    body = mb.build(r, bevel=0.03)

    hs = MB('mobo_heatsinks')
    hs.box((11, 2.2, 2.6), (-10.5, 7.5, 42.6), M['heatsink'])
    for i in range(7):
        hs.box((11.02, 0.3, 0.16), (-10.5, 6.3, 41.55 + i * 0.35), M['black_metal'])
    hs.box((2.3, 2.2, 11), (-16.9, 7.5, 35.8), M['heatsink'])
    hs.box((2.2, 2.8, 13), (-19.0, 7.2, 38.5), M['shroud'])          # I/O cover
    hs.box((0.08, 0.04, 11), (-18.2, 5.78, 38.5), M['rgb'])
    hs.box((6, 1.0, 5.5), (0, 8.1, 18.0), M['heatsink'])             # chipset
    hs.box((6.02, 0.05, 0.3), (0, 7.58, 18.8), M['silver'])
    hs.box((5, 0.5, 6), (-17.5, 8.35, 17.5), M['shroud'])            # audio cover
    hs.build(r, bevel=0.05)
    return r


def build_cpu():
    r = root('cpu', 'cpu')
    mb = MB('cpu_chip')
    sx, sz = SOCKET
    mb.box((3.75, 0.12, 3.75), (sx, 8.24, sz), M['cpu_sub'])
    mb.box((3.0, 0.35, 3.0), (sx, 8.0, sz), M['ihs'])
    mb.build(r, bevel=0.05)
    return r


# ---------- coolers ----------

def build_cooler_tower():
    r = root('cooler_tower', 'cooler', variant='tower')
    sx, sz = SOCKET
    mb = MB('cooler_tower_base')
    mb.box((4.0, 0.6, 4.0), (sx, 7.53, sz), M['copper'])
    mb.box((4.2, 0.7, 4.4), (sx, 6.88, sz), M['black_metal'])
    mb.box((0.8, 0.25, 8.5), (sx, 7.1, sz), M['black_metal'])
    for x, z in ((-11.9, 34.6), (-9.1, 35.9), (-11.9, 37.1), (-9.1, 38.4)):
        mb.cyl(0.3, 13.9, (x, -0.3, z), M['copper'], '+Y', segs=12)
    mb.box((5.3, 0.45, 12.7), (sx, -7.15, sz), M['black_metal'])     # top cap
    mb.box((0.25, 0.04, 12.0), (sx + 2.0, -7.39, sz), M['rgb'])
    mb.build(r, bevel=0.04)
    fins = MB('cooler_tower_fins')
    n = 55
    for i in range(n):
        fins.box((5.0, 0.05, 12.4), (sx, 4.6 - i * 11.5 / (n - 1), sz), M['alu'])
    fins.build(r)
    fan = MB('cooler_tower_fan')
    case_fan(fan, 'cooler_tower_fan', r, (-6.75, -1.15, sz), '+X', ring=False)
    fan.build(r)
    return r


def build_cooler_box():
    r = root('cooler_box', 'cooler', variant='box')
    sx, sz = SOCKET
    mb = MB('cooler_box_body')
    mb.cyl(1.3, 2.6, (sx, 6.53, sz), M['copper'], '+Y', segs=24)
    for i in range(36):
        a = 2 * PI * i / 36
        mb.box((3.0, 2.6, 0.12), (sx + 2.9 * math.cos(a), 6.53, sz + 2.9 * math.sin(a)), M['alu'], R(-a, 'Y'))
    mb.tube(4.7, 4.35, 1.4, (sx, 4.6, sz), M['fan_frame'], '-Y')
    for dx in (-3.7, 3.7):
        for dz in (-3.7, 3.7):
            mb.cyl(0.4, 3.2, (sx + dx, 6.3, sz + dz), M['slot_black'], '+Y', segs=12)
    mb.build(r, bevel=0.02)
    rotor('cooler_box_rotor', r, (sx, 4.6, sz), '-Y', 4.2, 1.0, blades=7)
    return r


# ---------- memory ----------

def build_ram():
    mb = MB('ram_stick')
    mb.box((0.12, 3.1, 13.3), (0, 6.25, 0), M['pcb'])
    for dx in (-0.18, 0.18):
        mb.box((0.22, 2.9, 13.4), (dx, 6.05, 0), M['spreader'])
        mb.box((0.03, 0.35, 12.0), (dx * 1.66, 6.9, 0), M['silver'])
    mb.box((0.62, 0.45, 13.3), (0, 4.45, 0), M['rgb'])
    mb.box((0.13, 0.4, 12.8), (0, 7.9, 0), M['gold'])
    first = None
    for i, x in enumerate(RAM_X):
        if first is None:
            first = mb.build(bevel=0.03, loc=(x, 0, RAM_Z))
            first.name = 'ram_1'
            ob = first
        else:
            ob = bpy.data.objects.new(f'ram_{i + 1}', first.data)
            COLL.objects.link(ob)
            ob.location = (x, 0, RAM_Z)
            mod = ob.modifiers.new('bevel', 'BEVEL')
            mod.width = 0.03
            mod.segments = 2
            mod.limit_method = 'ANGLE'
        ob['part'] = 'ram'
        ob['slot'] = i + 1


# ---------- video cards ----------

def build_gpu(fans, length, slots):
    name = f'gpu_{fans}'
    r = root(name, 'gpu', variant=f'{fans}fan')
    x0 = -20.0
    x1 = x0 + length
    yb, yt = 8.3, -2.9          # PCB spans from the board (yb) to the edge facing the glass (yt)
    ym = (yb + yt) / 2
    hgt = yb - yt
    zc = 28.0                   # PCB plane, right at the slot
    thick = 2.0 * slots
    zt = zc - 0.1
    zb = zc - thick + 0.9       # bottom of the heatsink, the shroud starts here

    mb = MB(name + '_body')
    mb.box((length - 1.0, hgt, 0.16), (x0 + (length - 1) / 2, ym, zc), M['pcb'])
    mb.box((8.5, 0.6, 0.16), (-12.15, 8.45, zc), M['gold'])
    mb.box((length - 0.4, hgt + 0.2, 0.25), (x0 + (length - 0.4) / 2, ym - 0.1, zc + 0.25), M['backplate'])
    for i in range(3):
        mb.box((length * 0.5, 0.06, 0.02), (x0 + length * 0.55, yt + 1.5 + i * 0.5, zc + 0.39), M['silver'])
    # shroud: one holed cell per fan + an edge lip with the logo and lights
    cell = length / fans
    rad = min(cell, hgt + 0.4) / 2 - 0.55
    for i in range(fans):
        mb.holed(cell, hgt + 0.4, rad + 0.2, 0.5, (x0 + (i + 0.5) * cell, ym - 0.2, zb - 0.25), M['shroud'])
        mb.torus(rad + 0.2, 0.09, (x0 + (i + 0.5) * cell, ym - 0.2, zb - 0.52), M['rgb'])
    mb.box((length, 0.35, 1.9), (x0 + length / 2, yt - 0.22, zb + 0.45), M['shroud'])
    mb.box((length * 0.55, 0.05, 0.22), (x0 + length * 0.62, yt - 0.42, zb + 0.05), M['rgb'])
    mb.box((0.4, hgt + 0.4, thick - 0.4), (x1 - 0.2, ym - 0.2, zc - thick / 2 + 0.3), M['shroud'])
    # power plug on the top edge
    pins = 2.1 if fans > 1 else 1.6
    mb.box((pins, 0.8, 0.9), (x1 - 5.5, yt - 0.3, zc - 0.55), M['slot_black'])
    # bracket in the back of the case
    mb.box((0.15, 12.3, 2.03 * math.ceil(slots) - 0.2), (-21.3, 2.75, zc + 0.6 - 1.015 * math.ceil(slots)), M['alu'])
    mb.box((1.2, 0.8, thick - 0.6), (-20.7, 7.7, zc - thick / 2 + 0.3), M['black_metal'])
    mb.build(r, bevel=0.04)

    hs = MB(name + '_heatsink')
    nf = int((length - 3) / 0.22)
    for i in range(nf):
        hs.box((0.05, hgt - 0.4, zt - zb), (x0 + 1.2 + i * 0.22, ym, (zt + zb) / 2), M['alu'])
    for y in (5.0, 2.0, -1.0):
        hs.cyl(0.3, length - 4, (x0 + 2 + (length - 4) / 2, y, zb + 0.4), M['copper'], '+X', segs=10)
    hs.build(r)
    text(name + '_logo', 'ICEBOOST', 0.75, M['logo'], (x0 + length * 0.26, yt - 0.41, zb + 0.75), FACE_GLASS, r, 0.02)
    for i in range(fans):
        rotor(f'{name}_fan{i + 1}', r, (x0 + (i + 0.5) * cell, ym - 0.2, zb - 0.25), '-Z', rad, 0.8, blades=11, pitch=28)
    return r


# ---------- power supply and drives ----------

def build_psu():
    r = root('psu', 'psu')
    x0, x1, y0, y1, z0, z1 = -21.5, -7.5, -6.0, 9.0, 1.8, 10.4
    cx, cy, cz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
    w, d, h = x1 - x0, y1 - y0, z1 - z0
    mb = MB('psu_body')
    mb.box((w, d, 0.15), (cx, cy, z1 - 0.075), M['psu'])
    mb.box((w, 0.15, h), (cx, y0 + 0.075, cz), M['psu'])
    mb.box((w, 0.15, h), (cx, y1 - 0.075, cz), M['psu'])
    mb.box((0.15, d, h), (x0 + 0.075, cy, cz), M['psu'])
    mb.box((0.15, d, h), (x1 - 0.075, cy, cz), M['psu'])
    mb.holed(w, d, 6.3, 0.15, (cx, cy, z0 + 0.075), M['psu'])
    mb.box((8, 0.03, 4.6), (cx, y0 - 0.01, cz), M['label'])
    for i in range(3):
        for j in range(2):
            mb.box((0.1, 1.6, 0.9), (x1 + 0.03, y0 + 2.6 + i * 3.2, z0 + 3 + j * 2.4), M['slot_black'])
    mb.build(r, bevel=0.05)
    grill = MB('psu_grill')
    for rr in (1.6, 3.0, 4.4, 5.8):
        grill.torus(rr, 0.07, (cx, cy, z0 - 0.02), M['alu'], segs=40, rsegs=6)
    for i in range(4):
        grill.box_m(T((cx, cy, z0 - 0.02)) @ R(i * PI / 4, 'Z') @ S((12.2, 0.12, 0.12)), M['alu'])
    grill.build(r)
    text('psu_logo', 'ICE POWER', 0.9, M['logo'], (cx, y0 - 0.04, cz), FACE_GLASS, r, 0.02)
    rotor('psu_fan', r, (cx, cy, z0 + 0.9), '-Z', 6.0, 1.0, blades=9)
    return r


def build_m2():
    r = root('ssd_m2', 'ssd_m2')
    mb = MB('ssd_m2_body')
    mb.box((8.0, 0.08, 2.2), (-9.75, 8.35, 30.5), M['pcb'])
    mb.box((0.4, 0.09, 2.0), (-13.55, 8.35, 30.5), M['gold'])
    mb.box((6.6, 0.03, 2.0), (-9.4, 8.29, 30.5), M['label'])
    mb.build(r)
    return r


def build_sata_ssd():
    r = root('ssd_sata', 'ssd_sata')
    mb = MB('ssd_sata_body')
    mb.box((10, 7, 0.7), (11, -3.2, 12.95), M['black_metal'])
    mb.box((7.4, 5.2, 0.03), (11, -3.2, 13.31), M['label'])
    mb.build(r, bevel=0.08)
    text('ssd_sata_logo', 'ICE SSD', 0.9, M['logo'], (11, -3.2, 13.33), Matrix.Identity(4), r, 0.02)
    return r


def build_hdd():
    r = root('hdd', 'hdd')
    mb = MB('hdd_body')
    mb.box((14.7, 10.2, 2.6), (10.8, -2.4, 3.4), M['alu'])
    mb.box((9, 7, 0.03), (10, -2.4, 4.71), M['label'])
    mb.build(r, bevel=0.1)
    return r


# ---------- build everything ----------

build_case()
build_glass()
build_shroud()
build_mobo()
build_cpu()
build_cooler_tower()
build_cooler_box()
build_ram()
build_gpu(1, 17.0, 2.0)
build_gpu(2, 24.0, 2.0)
build_gpu(3, 30.0, 2.7)
build_psu()
build_m2()
build_sata_ssd()
build_hdd()

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_extras=True,
                          export_yup=True, export_cameras=False, export_lights=False)
print('@@EXPORTED', OUT)


# ---------- optional preview renders (for checking the look) ----------

def hide_tree(ob, hide):
    ob.hide_render = hide
    for c in ob.children_recursive:
        c.hide_render = hide


if PREVIEWS:
    for name in ('glass', 'gpu_1', 'gpu_3', 'cooler_box', 'ssd_m2', 'hdd', 'ram_1', 'ram_3'):
        hide_tree(bpy.data.objects[name], True)
    world = bpy.data.worlds.new('w') if SCENE.world is None else SCENE.world
    SCENE.world = world
    try:
        world.color = lin('#202027')[:3]
        if hasattr(world, 'use_nodes'):
            world.use_nodes = True
        bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
        bg.inputs[0].default_value = lin('#25252b')
        bg.inputs[1].default_value = 0.6
    except Exception as e:  # noqa
        print('world setup:', e)

    def light(name, kind, loc, energy, size=20, color='#ffffff'):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = energy
        ld.color = lin(color)[:3]
        if kind == 'AREA':
            ld.size = size
        ob = bpy.data.objects.new(name, ld)
        COLL.objects.link(ob)
        ob.location = loc
        d = Vector((0, 0, 22)) - Vector(loc)
        ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

    light('key', 'AREA', (30, -70, 70), 120000, 40)
    light('fill', 'AREA', (-60, -50, 30), 40000, 40, '#bcd6ff')
    light('rim', 'AREA', (0, 60, 60), 30000, 30)
    light('inside', 'POINT', (0, -2, 30), 3000, color='#cfe8ff')

    cam_d = bpy.data.cameras.new('cam')
    cam_d.lens = 42
    cam_d.clip_end = 2000
    cam = bpy.data.objects.new('cam', cam_d)
    COLL.objects.link(cam)
    SCENE.camera = cam
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            SCENE.render.engine = eng
            break
        except TypeError:
            pass
    SCENE.render.resolution_x = 1280
    SCENE.render.resolution_y = 800
    try:
        SCENE.eevee.taa_render_samples = 32
    except Exception:  # noqa
        pass
    views = [((22, -88, 44), (0, 0, 24)), ((45, -50, 55), (-6, 4, 30)), ((-10, -40, 5), (-6, 4, 26))]
    for path, (loc, target) in zip(PREVIEWS, views):
        cam.location = loc
        cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        SCENE.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print('@@RENDERED', path)
