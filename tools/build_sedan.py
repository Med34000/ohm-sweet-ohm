"""Préparer une Model 3 démontable pour ÉLAN, dans Blender hors ligne.

2026-09-22, Europe/Zurich — Codex, OpenAI GPT-6 (variante exacte non exposée).
Source : Tesla 2018 Model 3, Ameer Studio, CC BY 4.0 ; voir le registre local.
Les surfaces peintes et leurs normales sont conservées sans décimation. Les
pièces restent séparées, avec une sémantique embarquée pour l'exploration Web.
"""
import collections
import json
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source/tesla-model3-ameer.glb'
OUTPUT = ROOT / 'assets/web/elan-sedan.glb'
MANIFEST = ROOT / 'assets/web/elan-sedan-manifest.json'
CREDIT = ('Tesla 2018 Model 3 by Ameer Studio (uchiha.321abc), CC BY 4.0, '
          'https://sketchfab.com/3d-models/5ef9b845aaf44203b6d04e2c677e444f. '
          'Semantic separation, uniform scale, materials and Web optimization '
          'for ÉLAN by Médéric Morin / Codex, 2026-09-22.')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))


def material(name, color, metal=0, rough=.35, coat=0, emit=0, alpha=1):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = (*color, alpha)
    shader = result.node_tree.nodes.get('Principled BSDF')
    for key, value in (
        ('Base Color', (*color, 1)), ('Metallic', metal), ('Roughness', rough),
        ('Coat Weight', coat), ('Coat Roughness', .16),
        ('Emission Color', (*color, 1)), ('Emission Strength', emit),
        ('Alpha', alpha),
    ):
        shader.inputs[key].default_value = value
    return result


PAINT = material('ELAN_Paint_Pearl', (.60, .67, .72), .50, .245, .85)
GLASS = material('ELAN_Glass_Obsidian', (.018, .031, .043), .22, .10, .9, alpha=.78)
BLACK = material('ELAN_Graphite', (.015, .021, .028), .12, .36, .2)
RUBBER = material('ELAN_Rubber', (.009, .012, .016), .02, .64)
CHROME = material('ELAN_Chrome', (.46, .52, .60), .92, .22, .2)
REFLECTOR = material('ELAN_Reflector', (.23, .29, .35), .87, .19)
HEADLIGHT = material('ELAN_Headlights', (.72, .9, 1), .1, .16, .8, 2.5)
TAIL = material('ELAN_Taillights', (.53, .004, .014), .18, .23, .8, .7)
LENS = material('ELAN_LampLens', (.13, .19, .25), .1, .08, .9, alpha=.12)
IVORY = material('ELAN_Cabin_Ivory', (.78, .72, .63), .01, .47, .12)
DARK_LEATHER = material('ELAN_Cabin_Leather', (.025, .031, .038), .03, .48)
CARPET = material('ELAN_Cabin_Carpet', (.025, .03, .035), 0, .92)
ALUMINIUM = material('ELAN_Cabin_Aluminium', (.30, .35, .41), .74, .31)
SCREEN = material('ELAN_Cabin_Display', (.018, .055, .075), .1, .19, .6, .3)

# Exact source wheel landmarks. Scaling remains uniform so the car is never
# stretched to fit the teaching drivetrain. Blender Z-up -> glTF Y-up on export.
FRONT_AXLE, REAR_AXLE = 175.680965, -144.720465
MID = (FRONT_AXLE + REAR_AXLE) / 2
SCALE = 5.410 / (FRONT_AXLE - REAR_AXLE)
Z_CENTER, X_CENTER = -37.17085, .0261
TRANSFORM = Matrix((
    (0, -SCALE, 0, SCALE * MID),
    (SCALE, 0, 0, -SCALE * X_CENTER),
    (0, 0, SCALE, -1.70 - SCALE * Z_CENTER),
    (0, 0, 0, 1),
))

DOOR_LABELS = {
    'door_lf': 'Porte avant gauche', 'door_rf': 'Porte avant droite',
    'door_lr': 'Porte arrière gauche', 'door_rr': 'Porte arrière droite',
}


def semantics(name, source_material):
    """The source object names identify authored automotive assemblies."""
    n, m = name.lower(), source_material.lower()
    door = next((key for key in DOOR_LABELS if n.startswith(key + '_')), None)
    if door:
        # All materials of a door share an assembly, so its trim, window and
        # interior move with the painted panel during an exploded transition.
        return 'doors', DOOR_LABELS[door], door
    if n.startswith('bonnet_') or n.startswith('chrome_bonnet_'):
        return 'body', 'Capot avant', 'hood'
    if n.startswith(('boot_', 'black_boot_', 'tembus_boot_', 'lightrevese_boot_',
                     'light_turn_rr_boot_', 'light_turn_lr_boot_')) or n.startswith('chrome.001_'):
        return 'body', 'Coffre arrière', 'trunk'
    if n.startswith('windscreen_'):
        return 'glass', 'Pare-brise', 'windscreen'
    if n.startswith('glass_'):
        return 'glass', 'Toit panoramique et lunette', 'panorama'
    if n.startswith('front_bumper_'):
        return 'body', 'Bouclier avant', 'front_bumper'
    if n.startswith('rear_bumper_'):
        return 'body', 'Bouclier arrière', 'rear_bumper'
    if m.startswith('primary'):
        return 'body', 'Structure de carrosserie', 'body_shell'
    if n.startswith(('seat leather', 'leather_white')):
        return 'cabin', 'Sièges et sellerie', 'seats'
    if n.startswith('movsteer_'):
        return 'cabin', 'Volant', 'steering'
    if n.startswith(('lcds_', 'paint_black_', 'hitam.005_')):
        return 'cabin', 'Écran central', 'display'
    if n.startswith(('base_', 'plastic_', 'belt_', 'satin_red_', 'texture_',
                     'aluminium_', 'aluminium2_', 'putih', 'whiteleather_',
                     'carpet', 'black.001_', 'black.002_', 'black.003_',
                     'black.005_', 'chromebelt_', 'chrome__', 'mirror_inside_',
                     'interiorlights_', 'hitam.002_', 'frunkplastic_')) or n.startswith('black_black_'):
        return 'cabin', 'Habitacle', 'cabin'
    if any(key in n for key in ('light', 'pantulan', 'tembus', 'indicator', 'breake_int')):
        return 'lights', 'Optiques et éclairage', 'lights'
    return 'trim', 'Joints et finitions', 'trim'


def choose_material(name, old):
    n, m = name.lower(), old.lower()
    if m.startswith('primary'):
        return PAINT
    if 'glass' in m:
        return GLASS
    if 'tembus' in n:
        return LENS
    if any(key in n for key in ('rear_light', 'light_breake', 'breake_int',
                               'light_turn', 'light_pantulan', 'pantulans')):
        return TAIL
    if 'chrome_lights_head' in n or n.startswith('foglights_'):
        return HEADLIGHT
    if 'lcds' in n:
        return SCREEN
    if any(key in m for key in ('seat_leather_white', 'seat leather white', 'putih')):
        return IVORY
    if 'carpet' in m:
        return CARPET
    if 'movsteer_1.0.0' in m or 'leather' in n:
        return DARK_LEATHER
    if 'chrome' in n or 'mirror_inside' in m or 'movsteer_1.0.1' in m:
        return CHROME
    if 'aluminium_light' in n:
        return REFLECTOR
    if 'aluminium' in n or 'aluminium' in m:
        return ALUMINIUM
    if 'belt' in n or 'just_black' in m:
        return RUBBER
    return BLACK


def bounds_gltf(obj):
    points = [obj.matrix_world @ Vector(point) for point in obj.bound_box]
    # glTF export converts Blender (x,y,z) to (x,z,-y).
    points = [(p.x, p.z, -p.y) for p in points]
    return {'min': [min(p[i] for p in points) for i in range(3)],
            'max': [max(p[i] for p in points) for i in range(3)]}


def triangles(obj):
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


parts = []
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    source_name = obj.name
    if source_name.lower().startswith(('wheels', 'hub_', 'suspensi', 'platnomor', 'chassis_')):
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    old = obj.data.materials[0].name if obj.data.materials else ''
    category, label, assembly = semantics(source_name, old)
    mat = choose_material(source_name, old)
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.data.transform(TRANSFORM @ world)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
    # Keep silhouette and custom normals of paint/glass exactly as authored.
    # Complexity reduction is limited to dense interior pieces and ornament.
    if mat not in (PAINT, GLASS, LENS) and triangles(obj) > 2800:
        ratio = .56 if category == 'cabin' else .72
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('Optimisation intérieure Web', 'DECIMATE')
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.name = 'Elan_' + source_name.replace(' ', '_')
    obj['category'] = category
    obj['label'] = label
    obj['assembly'] = assembly
    obj['sourceName'] = source_name
    parts.append(obj)

for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        bpy.data.objects.remove(obj, do_unlink=True)

total_triangles = sum(triangles(obj) for obj in parts)
assert total_triangles < 500_000, total_triangles
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT), export_format='GLB', use_selection=True,
    export_copyright=CREDIT, export_yup=True, export_animations=False,
    export_cameras=False, export_lights=False, export_extras=True,
    export_texcoords=False, export_normals=True,
)
assert OUTPUT.stat().st_size < 14_000_000, OUTPUT.stat().st_size

entries = [{'name': obj.name, 'sourceName': obj['sourceName'],
            'category': obj['category'], 'label': obj['label'],
            'assembly': obj['assembly'], 'triangles': triangles(obj),
            'bounds': bounds_gltf(obj)} for obj in parts]
manifest = {
    'updated': '2026-09-22 — Codex / OpenAI GPT-6',
    'license': 'CC BY 4.0', 'credit': CREDIT, 'scale': SCALE,
    'wheelbase': 5.410, 'bytes': OUTPUT.stat().st_size,
    'meshes': len(parts), 'triangles': total_triangles,
    'categories': dict(collections.Counter(obj['category'] for obj in parts)),
    'bounds': {'min': [min(e['bounds']['min'][i] for e in entries) for i in range(3)],
               'max': [max(e['bounds']['max'][i] for e in entries) for i in range(3)]},
    'parts': entries,
}
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

# Save all editable authored parts; the independent existing wheel GLB is left
# untouched. The web scene attaches its four copies to the animated drivetrain.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/elan-sedan.blend'))
print('ELAN_SEGMENTED_MODEL3_READY', json.dumps({
    key: value for key, value in manifest.items() if key != 'parts'
}, ensure_ascii=False))
