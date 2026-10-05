"""Borne Ohm Sweet Ohm originale — 2026-09-30 ≈19:02, Europe/Zurich — Codex / OpenAI.
Production hors ligne, scène dédiée. Axes Blender Z-up, export glTF Y-up.
Ajouter -- --preview /chemin/image.png pour contrôler la signature après export.
"""
import bpy
import sys
import argparse
from pathlib import Path
from math import radians
from mathutils import Vector
parser = argparse.ArgumentParser()
parser.add_argument('--preview', type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
def material(name, color, metal=0.0, rough=0.35, emission=0):
    mat = bpy.data.materials.new(name); mat.diffuse_color=(*color,1); mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1);bsdf.inputs['Metallic'].default_value=metal;bsdf.inputs['Roughness'].default_value=rough
    bsdf.inputs['Emission Color'].default_value=(*color,1);bsdf.inputs['Emission Strength'].default_value=emission
    return mat
ivory=material('Céramique — ivoire satiné',(0.78,0.83,0.72),0.3,0.25)
dark=material('Verre et graphite',(0.021,0.038,0.031),0.25,0.19)
lime=material('Voyant — vert Ohm Sweet Ohm',(0.58,0.89,0.25),0.1,0.3,1.3)
metal=material('Socle — aluminium',(0.15,0.18,0.16),0.8,0.27)
def box(name, size, location, mat, bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location);obj=bpy.context.object;obj.name=name;obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    mod=obj.modifiers.new('Arêtes douces','BEVEL');mod.width=bevel;mod.segments=5
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    for polygon in obj.data.polygons: polygon.use_smooth=True
    mod=obj.modifiers.new('Normales de surface','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj
box('Borne — corps monobloc',(0.62,0.4,1.5),(0,0,0.75),ivory,0.095)
box('Socle arrondi',(0.82,0.56,0.075),(0,0,0.04),metal,0.035)
box('Face noire',(0.45,0.035,1.16),(0,-0.201,0.86),dark,0.035)
box('Écran lumineux',(0.31,0.018,0.26),(0,-0.224,1.12),lime,0.02)
box('Écran noir intérieur',(0.25,0.012,0.19),(0,-0.235,1.13),dark,0.016)
for i in range(4): box('Indicateur de charge '+str(i),(0.039,0.018,0.067),(-0.078+i*0.052,-0.246,1.13),lime,0.006)
box('Ligne de statut',(0.27,0.018,0.017),(0,-0.235,0.57),lime,0.008)
bpy.ops.object.text_add(location=(0,-0.246,0.80),rotation=(radians(90),0,0))
text=bpy.context.object; text.name='Signature Ohm Sweet Ohm'
text.data.body='Ohm\nSweet Ohm'; text.data.align_x='CENTER'; text.data.align_y='CENTER'
text.data.size=0.072; text.data.space_line=1.18; text.data.extrude=0.001; text.data.materials.append(ivory)
bpy.context.view_layer.update()
if text.dimensions.x > 0.36:
    text.data.size *= 0.36 / text.dimensions.x
text['brand']='Ohm Sweet Ohm'
bpy.ops.object.convert(target='MESH')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/elan-charger.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/web/elan-charger.glb'),export_format='GLB',export_copyright='Ohm Sweet Ohm charger — original model, 2026 Médéric Morin / Codex',export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
print('OHM_SWEET_OHM_CHARGER_READY')

if args.preview:
    # Contrôle du modèle seul : la caméra et l’éclairage ne sont ni sauvegardés ni exportés.
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24
    scene.render.resolution_x=600; scene.render.resolution_y=780; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(args.preview)
    scene.world.color=(0.18,0.18,0.18)
    bpy.ops.object.camera_add(location=(2.0,-4.8,2.8)); camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,0.78))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; camera.data.ortho_scale=2.10; scene.camera=camera
    for location,energy,size in [((1,-3,4),650,4),((-3,-1,2),350,3),((1,3,3),500,3)]:
        bpy.ops.object.light_add(type='AREA',location=location); light=bpy.context.object
        light.data.energy=energy; light.data.shape='DISK'; light.data.size=size
        light.rotation_euler=(Vector((0,0,0.8))-light.location).to_track_quat('-Z','Y').to_euler()
    args.preview.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
