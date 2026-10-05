"""ÉLAN — groupe moteur original, inspiré des architectures Model 3.
2026-09-22 — Codex, OpenAI GPT-6 (variante exacte non exposée).
Reconstruction visuelle illustrative ; aucune CAO constructeur n'est utilisée.
Les axes sont ceux de l'application : Y vertical, arbre Z. Export sans conversion.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0

def material(name, color, metal, rough):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = rough
    return mat

cast = material('Aluminium moulé — grain satiné', (.41, .445, .47), .84, .39)
machined = material('Aluminium usiné — plans de joint', (.64, .68, .70), .90, .25)
steel = material('Acier zingué — visserie', (.26, .29, .31), .91, .29)
dark = material('Élastomère — joints et raccords', (.028, .035, .04), .05, .59)
label = material('Plaque aluminium gravée', (.12, .14, .15), .72, .45)

groups = {}
for key in ['casing', 'cover', 'capFront', 'capRear']:
    obj = bpy.data.objects.new(key, None)
    bpy.context.collection.objects.link(obj)
    obj['motorPart'] = 'housing' if key in ['casing', 'cover'] else 'bearing'
    obj['component'] = 'motor'
    groups[key] = obj

def finish(obj, mat, parent, name, bevel=0):
    obj.name = name
    obj.parent = groups[parent]
    obj.data.materials.append(mat)
    obj['component'] = 'motor'
    obj['motorPart'] = groups[parent]['motorPart']
    obj['label'] = name
    if bevel:
        mod = obj.modifiers.new('Congés de fonderie', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in obj.data.polygons:
        face.use_smooth = True
    mod = obj.modifiers.new('Normales pondérées', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def mesh_object(name, vertices, faces, mat, parent, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, mat, parent, name, bevel)

def ring(name, inner, outer, depth, z, mat, parent, start=0, arc=math.tau, count=96, bevel=.002):
    n = max(8, round(count * arc / math.tau))
    vertices = []
    for zz, rr in [(z-depth/2, outer), (z+depth/2, outer), (z-depth/2, inner), (z+depth/2, inner)]:
        for i in range(n+1):
            a = start + arc*i/n
            vertices.append((rr*math.cos(a), rr*math.sin(a), zz))
    faces = []
    N = n+1
    for i in range(n):
        faces += [(i,i+1,N+i+1,N+i), (2*N+i,3*N+i,3*N+i+1,2*N+i+1),
                  (i,2*N+i,2*N+i+1,i+1), (N+i,N+i+1,3*N+i+1,3*N+i)]
    if arc < math.tau-.001:
        faces += [(0,N,3*N,2*N), (n,2*N+n,3*N+n,N+n)]
    return mesh_object(name, vertices, faces, mat, parent, bevel)

def box(name, size, location, mat, parent, bevel=.005, angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = size
    obj.rotation_euler[2] = angle
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, parent, name, bevel)

def cylinder(name, radius, depth, location, mat, parent, vertices=32, bevel=.003, direction=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    if direction:
        obj.rotation_euler = Vector(direction).to_track_quat('Z','Y').to_euler()
    return finish(obj, mat, parent, name, bevel)

def bolt(name, x,y,z,parent, direction=1):
    cylinder(name+' — rondelle', .024, .005, (x,y,z), machined, parent, 16, .001)
    cylinder(name+' — tête hexagonale', .0165, .018, (x,y,z+direction*.009), steel, parent, 6, .0015)
    cylinder(name+' — empreinte', .007, .001, (x,y,z+direction*.019), dark, parent, 6, 0)

# Carter à refroidissement liquide : couronne pleine, nervures longitudinales et
# surfaces moulées. La section supérieure est uniquement une coupe pédagogique.
lower_start, lower_arc = math.pi*5/6, math.pi*4/3
upper_start, upper_arc = math.pi/6, math.pi*2/3
for parent, start, arc in [('casing',lower_start,lower_arc),('cover',upper_start,upper_arc)]:
    ring('Enveloppe en aluminium moulé', .401,.439,.86,0,cast,parent,start,arc,96,.006)
    for z in [-.419,.419]:
        ring('Lèvre usinée de fermeture',.398,.451,.026,z,machined,parent,start,arc,96,.002)
    for i in range(8 if parent=='casing' else 4):
        a = start + arc*(i+.5)/(8 if parent=='casing' else 4)
        r=.442
        box('Nervure longitudinale de rigidification',(.025,.025,.72),(r*math.cos(a),r*math.sin(a),0),cast,parent,.007,a)
    for z in [-.30,.28]:
        ring('Nervure périphérique de fonderie',.438,.452,.017,z,cast,parent,start,arc,96,.003)

# Oreilles de suspension asymétriques avec alésages visibles, liées au carter.
for i,(x,y,z) in enumerate([(-.34,-.36,-.24),(-.35,.20,-.22),(.38,-.30,.21)]):
    box('Patte moulée du support',(.13,.11,.22),(x,y,z),cast,'casing',.027,-.24)
    obj = ring('Bossage et alésage du support',.027,.065,.10,0,cast,'casing',count=32,bevel=.004)
    obj.location=(x-.035,y-.035,z)

# Extension du carter vers le réducteur/différentiel. Un profil ovoïde raccorde
# les volumes ; les nervures suivent la transmission des efforts vers les axes.
outline = [(.22,.24),(.49,.21),(.78,.06),(1.015,-.18),(1.055,-.39),(.99,-.58),(.81,-.69),(.57,-.70),(.32,-.55),(.18,-.27)]
verts=[]
cx,cy=.66,-.26
for z,scale in [(-.37,.88),(-.35,1),(.12,1),(.14,.88)]:
    verts.extend((cx+(x-cx)*scale,cy+(y-cy)*scale,z) for x,y in outline)
faces=[]
N=len(outline)
for layer in range(3):
    for i in range(N): faces.append((layer*N+i,layer*N+(i+1)%N,(layer+1)*N+(i+1)%N,(layer+1)*N+i))
faces += [tuple(reversed(range(N))),tuple(3*N+i for i in range(N))]
mesh_object('Carter réducteur — enveloppe moulée asymétrique',verts,faces,cast,'casing',.055)
for i,(x,y) in enumerate(outline):
    if i not in [0,9]: bolt('Fixation périphérique réducteur',cx+(x-cx)*.85,cy+(y-cy)*.85,.154,'casing')
for angle in [-2.4,-1.2,-.25,.65,1.5,2.55]:
    x=.725+math.cos(angle)*.16
    y=-.35+math.sin(angle)*.16
    box('Raidisseur du palier de différentiel',(.34,.024,.029),(x,y,.165),cast,'casing',.007,angle)
hub=ring('Palier de sortie différentiel',.135,.202,.14,.17,machined,'casing',count=48,bevel=.005)
hub.location.x=.725;hub.location.y=-.35
seal=ring('Joint de sortie différentiel',.135,.159,.015,.247,dark,'casing',count=48,bevel=.001)
seal.location.x=.725;seal.location.y=-.35

# Raccords à double bourrelet pour le circuit liquide. Leur teinte est sobre :
# le bleu du circuit est un repère d'explication, pas un matériau du moteur.
for z in [-.24,.24]:
    for radius,depth,x in [(.049,.072,-.438),(.030,.13,-.493),(.038,.018,-.548),(.036,.014,-.57)]:
        cylinder('Raccord de refroidissement',radius,depth,(x,.115,z),cast if radius>.04 else dark,'casing',24,.002,(1,0,0))

# Flasques désassemblables : brides, nervures rayonnantes, bossages de palier,
# plan de joint sombre et visserie hexagonale. Origines locales sur leur centre.
for parent,sign in [('capFront',1),('capRear',-1)]:
    ring('Flasque moulé',.116,.434,.056,0,cast,parent,count=96,bevel=.006)
    ring('Plan de joint périphérique',.411,.454,.019,-sign*.021,dark,parent,count=96,bevel=.001)
    ring('Bride périphérique usinée',.418,.459,.033,sign*.012,machined,parent,count=96,bevel=.003)
    ring('Bossage central de roulement',.114,.176,.092,sign*.02,cast,parent,count=64,bevel=.009)
    ring('Portée de roulement usinée',.093,.123,.065,sign*.045,machined,parent,count=48,bevel=.002)
    for i in range(9):
        a = i/9*math.tau+.11
        box('Nervure rayonnante du flasque',(.23,.023,.035),(.285*math.cos(a),.285*math.sin(a),sign*.041),cast,parent,.007,a)
    for i in range(12):
        a=i/12*math.tau+.1
        x,y=.425*math.cos(a),.425*math.sin(a)
        cylinder('Bossage de vis',.032,.029,(x,y,sign*.026),cast,parent,20,.006)
        bolt('Vis de fermeture du flasque',x,y,sign*.045,parent,sign)
    ring('Lèvre de joint radial',.071,.095,.011,sign*.080,dark,parent,count=48,bevel=.001)

box('Plaque d’identification',(.19,.072,.006),(-.20,-.24,.15),label,'casing',.008,-.23)
for i in range(4):
    box('Trait gravé de la plaque',(.125-i*.013,.002,.001),(-.205,-.220-i*.01,.155),machined,'casing',.0002,-.23)

# Un maillage par matériau et par groupe articulé limite les appels de dessin.
for key,parent in groups.items():
    for mat in [cast,machined,steel,dark,label]:
        objects=[o for o in list(parent.children) if o.type=='MESH' and o.data.materials[0]==mat]
        if not objects: continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        obj=bpy.context.object
        obj.name=key+' — '+mat.name
        obj['label']=mat.name
        obj['component']='motor'
        obj['motorPart']=parent['motorPart']

scene=bpy.context.scene
scene.world.color=(.3,.3,.3)
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene['description']='Carter de groupe moteur inspiré Model 3, reconstruction pédagogique originale, non CAO constructeur.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/elan-drive-unit.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/web/elan-drive-unit.glb'),export_format='GLB',export_yup=False,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_copyright='Original educational reconstruction — 2026 Médéric Morin / Codex')
triangles=sum(len(p.vertices)-2 for o in bpy.data.objects if o.type=='MESH' for p in o.data.polygons)
print('ELAN_DRIVE_UNIT_READY',{'triangles':triangles,'meshes':sum(o.type=='MESH' for o in bpy.data.objects)})
