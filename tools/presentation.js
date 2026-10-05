import * as THREE from 'three';
import { createVehicleScene } from '../js/scene.js';

// 2026-09-22 — Codex / OpenAI pour Médéric Morin.
// Film des modèles réels de l'application, cadré indépendamment de son interface.
const canvas = document.querySelector('#preview'), ctx = canvas.getContext('2d');
const host = document.querySelector('#studio'), status = document.querySelector('#status');
const playButton = document.querySelector('#play'), exportButton = document.querySelector('#export');
const format = document.querySelector('#format'), seek = document.querySelector('#seek');
const FPS = 30, DURATION = 36;
const ink = '#172b25', muted = '#667b6b', paper = '#f3f5ed', accent = '#cdf78b';
const clamp = THREE.MathUtils.clamp;
const smooth = x => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const mix = THREE.MathUtils.lerp;
const v3 = a => new THREE.Vector3(...a);
const shots = [
  { start:0, end:4, id:'hero', chapter:'VOIR AUTREMENT', lines:['Tu vois','une voiture.'], copy:'Et si tu regardais à l’intérieur ?', component:null, angle:-.86, elev:.32, zoom:1.02 },
  { start:4, end:8, id:'reveal', chapter:'PASSER SOUS LA SURFACE', lines:['Découvre ce qui','la fait avancer.'], copy:'Une voiture électrique. Enfin limpide.', component:null, angle:-.70, elev:.48, zoom:1.03 },
  { start:8, end:12, id:'explode', chapter:'EXPLORER EN 3D', lines:['Ouvre.','Tout devient clair.'], copy:'Les pièces se séparent. Les liens apparaissent.', component:null, angle:-.67, elev:.38, zoom:1.10 },
  { start:12, end:16.5, id:'battery', chapter:'01 / STOCKER', lines:['Des cellules.','De l’énergie.'], copy:'La réserve de la voiture, de l’intérieur.', component:'battery', focus:'cells', angle:-.54, elev:.83, zoom:1.05 },
  { start:16.5, end:22, id:'motor', chapter:'02 / CRÉER LE MOUVEMENT', lines:['Un champ invisible.','Un mouvement réel.'], copy:'Entre dans le moteur et regarde-le tourner.', component:'motor', focus:'stator', angle:-.93, elev:.37, zoom:1.03 },
  { start:22, end:25.5, id:'bms', chapter:'03 / SURVEILLER', lines:['Chaque cellule','compte.'], copy:'Découvre le BMS et les protections.', component:'bms', focus:'bms', angle:-.63, elev:.82, zoom:1.09 },
  { start:25.5, end:29, id:'drive', chapter:'EXPÉRIMENTER', lines:['Accélère.','Suis l’énergie.'], copy:'De la batterie au moteur, puis aux roues.', component:null, angle:-.65, elev:.62, zoom:1.07 },
  { start:29, end:32, id:'regen', chapter:'COMPRENDRE EN JOUANT', lines:['Freine.','Récupère.'], copy:'Une partie de l’énergie revient à la batterie.', component:null, angle:-.57, elev:.61, zoom:1.07 },
  { start:32, end:36, id:'outro', chapter:'L’ÉLECTRIQUE, DE L’INTÉRIEUR', lines:['À toi','d’explorer.'], copy:'Tourne. Ouvre. Comprends.', component:null, angle:-.72, elev:.32, zoom:1.04 },
];
let vertical = false, exporting = false, playing = false, current = -1, currentTime = 0;
let region, shotBounds, previousExplosion = -1, animationHandle;
const stage = await createVehicleScene(host, { reducedMotion: true });
await stage.ready;
stage.renderer.setPixelRatio(1);
stage.renderer.toneMappingExposure = 1.03;
stage.controls.enabled = false;
stage.controls.enableDamping = false;
stage.setPaint(0x75827e);

function setFormat() {
  vertical = format.value === 'vertical';
  canvas.width = vertical ? 1080 : 1920;
  canvas.height = vertical ? 1920 : 1080;
  region = vertical ? {x:0,y:340,w:1080,h:1160} : {x:590,y:66,w:1320,h:932};
  host.style.width = region.w + 'px'; host.style.height = region.h + 'px';
  stage.renderer.setSize(region.w, region.h);
  stage.camera.aspect = region.w / region.h;
  stage.camera.fov = 33;
  stage.camera.updateProjectionMatrix();
  current = -1;
}
function frameState(t, shot) {
  const drive = ['drive', 'regen'].includes(shot.id), regen = shot.id === 'regen';
  return {time:t, running:true, phase:regen?'brake':'accelerate', power:drive?.68:.48,
    rotorAngle:t * (drive?3:0), motion:drive, connected:false, charging:false,
    tractionActive:drive&&!regen, recovering:regen, soc:.67, demoAngle:t*.84, demoRunning:true};
}
function setExplosion(value) {
  if (Math.abs(value - previousExplosion) < 1e-7) return;
  stage.setExplosion(value); previousExplosion = value;
}
function sourceBounds(shot) {
  const points = [], box = new THREE.Box3();
  stage.scene.updateMatrixWorld(true);
  const components = shot.component ? (shot.component === 'bms' ? ['battery'] : [shot.component])
    : ['hero','outro'].includes(shot.id) ? ['vehicle-shell','wheel'] : ['battery','motor','hv','wheel','reduction','differential'];
  for (const root of stage.drivetrain.group.children) {
    if (!components.includes(root.userData.component) || !root.visible || root.userData.semanticHitTarget) continue;
    root.traverseVisible(node => {
      if (!node.isMesh || node.userData.semanticHitTarget || node.material?.opacity === 0) return;
      const b = new THREE.Box3().setFromObject(node);
      if (b.isEmpty()) return;
      box.union(b);
      for (const x of [b.min.x,b.max.x]) for (const y of [b.min.y,b.max.y]) for (const z of [b.min.z,b.max.z]) points.push(new THREE.Vector3(x,y,z));
    });
  }
  return {box, points, center:box.getCenter(new THREE.Vector3())};
}
function enterShot(index) {
  const shot = shots[index]; current = index;
  stage.setView({component:null,opened:false,xray:false,frame:false});
  previousExplosion = -1;
  const explosion = ['explode'].includes(shot.id) ? 1 : ['drive','regen','reveal'].includes(shot.id) ? .45 : 0;
  setExplosion(explosion);
  stage.setView({component:shot.component,opened:Boolean(shot.component),xray:false,frame:false});
  stage.setStudy({focus:shot.focus||'overview',progress:1});
  stage.render(1/FPS,frameState(shot.start,shot));
  shotBounds = sourceBounds(shot);
}
function cameraFor(shot, p) {
  const angle = shot.angle + (p - .5) * (shot.id === 'motor' ? .24 : .18);
  const elev = shot.elev + Math.sin(p*Math.PI)*.015;
  const direction = new THREE.Vector3(Math.sin(angle)*Math.cos(elev),Math.sin(elev),Math.cos(angle)*Math.cos(elev)).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction,right).normalize();
  const tangent = Math.tan(THREE.MathUtils.degToRad(stage.camera.fov/2));
  let distance=0;
  for (const point of shotBounds.points) {
    const relative=point.clone().sub(shotBounds.center);
    distance=Math.max(distance,relative.dot(direction)+Math.max(Math.abs(relative.dot(up))/tangent,
      Math.abs(relative.dot(right))/(tangent*stage.camera.aspect)));
  }
  distance *= shot.zoom * mix(1.055,1,p);
  stage.controls.target.copy(shotBounds.center);
  stage.camera.position.copy(shotBounds.center).addScaledVector(direction,distance);
  stage.camera.lookAt(shotBounds.center);
}
function rounded(x,y,w,h,r=16) {ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function text(value,x,y,size=30,weight=500,color=ink) {
  ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Avenir Next", Arial, sans-serif`;ctx.fillText(value,x,y);
}
function fitText(value,x,y,maxWidth,size,weight=700,color=ink) {
  ctx.font=`${weight} ${size}px "Avenir Next", Arial, sans-serif`;
  while(ctx.measureText(value).width>maxWidth&&size>32){size-=1;ctx.font=`${weight} ${size}px "Avenir Next", Arial, sans-serif`;}
  ctx.fillStyle=color;ctx.fillText(value,x,y);
}
function drawBrand() {
  const x=vertical?64:80,y=vertical?98:88;
  ctx.save();ctx.translate(x,y-42);ctx.rotate(-.07);ctx.fillStyle=accent;rounded(0,0,52,57,14);ctx.fill();
  ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(30,8);ctx.lineTo(16,30);ctx.lineTo(27,30);ctx.lineTo(23,49);ctx.lineTo(40,23);ctx.lineTo(29,23);ctx.closePath();ctx.fill();ctx.restore();
  text('ohm sweet ohm.',x+69,y+3,50,700);
  if (!vertical) {text('EXPLORATION ÉLECTRIQUE',1540,83,17,600,muted);ctx.fillStyle=accent;ctx.beginPath();ctx.arc(1518,77,5,0,Math.PI*2);ctx.fill();}
}
function pill(label,x,y,w=252) {
  ctx.fillStyle=accent;rounded(x,y,w,vertical?78:62,vertical?39:31);ctx.fill();text(label,x+26,y+(vertical?51:40),vertical?30:22,600);
}
function annotations(shot, t) {
  if (!['drive','regen'].includes(shot.id)) return;
  const labels = shot.id==='regen'?['ROUES','MOTEUR','BATTERIE']:['BATTERIE','MOTEUR','ROUES'];
  const x=vertical?66:84, y=vertical?1600:902, spacing=vertical?285:167;
  for(let i=0;i<3;i++) {
    const active=(t*1.35)%3;
    ctx.fillStyle=Math.abs(active-i)<.9?accent:'#e5eadf';rounded(x+i*spacing,y,spacing-20,52,10);ctx.fill();
    text(labels[i],x+i*spacing+16,y+33,vertical?24:18,650);
    if(i<2)text('→',x+(i+1)*spacing-18,y+32,22,500,muted);
  }
}
function overlay(shot,t,p) {
  const W=canvas.width,H=canvas.height;
  drawBrand();
  const x=vertical?64:82, top=vertical?250:330;
  const alpha=smooth((t-shot.start)/.36), lift=(1-alpha)*25;
  ctx.save();ctx.globalAlpha=alpha;
  text(shot.chapter,x,top-(vertical?102:90)+lift,vertical?22:18,650,muted);
  const size=vertical?86:76,lineHeight=vertical?102:94,maxW=vertical?950:565;
  shot.lines.forEach((line,i)=>fitText(line,x,top+i*lineHeight+lift,maxW,size,750));
  const copyY=top+lineHeight+68+lift;
  fitText(shot.copy,x,copyY,maxW,vertical?36:24,450,muted);
  if(shot.id==='outro')pill('Essaie l’expérience  ↗',x,vertical?1620:680,vertical?430:320);
  ctx.restore();
  annotations(shot,t);
  const gap=10,startX=vertical?64:80, width=W-startX*2;
  for(let i=0;i<shots.length;i++) {
    const segment=(width-gap*(shots.length-1))/shots.length;
    ctx.fillStyle='#dce3d7';ctx.fillRect(startX+i*(segment+gap),H-55,segment,3);
    if(i<=current){ctx.fillStyle=ink;ctx.fillRect(startX+i*(segment+gap),H-55,segment*(i===current?p:1),3);}
  }
  text('Ohm Sweet Ohm · UNE EXPÉRIENCE 3D INTERACTIVE',startX,H-25,vertical?17:14,500,muted);
  if(shot.id==='outro') {
    const credit='Modèle automobile : Ameer Studio · CC BY 4.0';
    text(credit,vertical?64:1190,vertical?1840:H-25,vertical?19:15,400,muted);
  } else if(!vertical) text('Modèles de l’application · simulation pédagogique',1330,H-25,15,400,muted);
  // Short dip to the studio colour masks the camera cuts without a long fade.
  if(current>0 && t-shot.start<.15){ctx.fillStyle=`rgba(243,245,237,${1-(t-shot.start)/.15})`;ctx.fillRect(0,0,W,H);}
}
function draw(time) {
  const t=clamp(time,0,DURATION-1/FPS),index=shots.findIndex(s=>t>=s.start&&t<s.end);
  if(index!==current)enterShot(index);
  const shot=shots[index],p=(t-shot.start)/(shot.end-shot.start);
  if(shot.id==='reveal')setExplosion(.45*smooth((p-.06)/.80));
  else if(shot.id==='explode')setExplosion(mix(.48,1,smooth(p/.70)));
  else if(shot.id==='outro')setExplosion(0);
  if(shot.component)stage.setStudy({focus:shot.id==='motor'&&p>.6?'rotor':shot.focus,
    progress:shot.id==='motor'?mix(.13,1,smooth(p/.53)):shot.id==='battery'?mix(.28,1,smooth(p/.65)):1});
  cameraFor(shot,p);
  stage.render(1/FPS,frameState(t,shot));
  const W=canvas.width,H=canvas.height;
  ctx.fillStyle=paper;ctx.fillRect(0,0,W,H);
  const glow=ctx.createRadialGradient(W*.73,H*.46,10,W*.73,H*.46,W*.50);
  glow.addColorStop(0,'#ffffff');glow.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
  ctx.drawImage(stage.renderer.domElement,region.x,region.y,region.w,region.h);
  overlay(shot,t,p);
  currentTime=t;seek.value=t;
}
function stopPlayback(){playing=false;cancelAnimationFrame(animationHandle);playButton.textContent='Lire la présentation';}
playButton.onclick=()=>{
  if(playing){stopPlayback();return;}
  playing=true;playButton.textContent='Mettre en pause';
  const from=currentTime>DURATION-.1?0:currentTime,start=performance.now();
  const tick=now=>{const t=from+(now-start)/1000;draw(Math.min(t,DURATION-1/FPS));
    status.textContent=`Aperçu · ${t.toFixed(1)} / ${DURATION} secondes`;
    if(t<DURATION&&playing)animationHandle=requestAnimationFrame(tick);else stopPlayback();};
  animationHandle=requestAnimationFrame(tick);
};
seek.oninput=()=>{if(exporting)return;stopPlayback();draw(Number(seek.value));};
format.onchange=()=>{stopPlayback();setFormat();requestAnimationFrame(()=>draw(currentTime));};
async function post(path,body,type='application/json'){
  const r=await fetch('/film-api/'+path,{method:'POST',headers:{'Content-Type':type},body});
  if(!r.ok)throw new Error(await r.text());return r.json();
}
exportButton.onclick=async()=>{
  stopPlayback();exporting=true;exportButton.disabled=playButton.disabled=format.disabled=seek.disabled=true;
  try{
    const started=await post('start',JSON.stringify({vertical}));
    for(let frame=0;frame<DURATION*FPS;frame++){
      await new Promise(resolve=>requestAnimationFrame(resolve));
      draw(frame/FPS);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.96));
      await post('frame',blob,'image/jpeg');
      status.textContent=`Export ${Math.round((frame+1)/(DURATION*FPS)*100)} % · image ${frame+1} / ${DURATION*FPS}`;
    }
    const done=await post('finish','{}');
    if(!done.ok)throw new Error('Encodage incomplet');
    status.textContent=`Export terminé · ${done.frames} images · ${started.path}`;
  }catch(error){status.textContent='Export interrompu : '+error.message;console.error(error);}
  finally{exporting=false;exportButton.disabled=playButton.disabled=format.disabled=seek.disabled=false;}
};
setFormat();
await new Promise(resolve=>requestAnimationFrame(resolve));draw(0);
for(const [index, shot] of shots.entries()) {
  const button=document.createElement('button');button.textContent=`${index+1}. ${shot.id}`;
  button.style.cssText='font-size:11px;padding:5px 10px;background:#2b3730;color:#dce9d6';
  button.onclick=()=>{if(exporting)return;stopPlayback();draw(shot.start+(shot.end-shot.start)*.55);};
  document.querySelector('#chapters').append(button);
}
playButton.disabled=exportButton.disabled=false;
status.textContent='Prêt · 36 secondes · 30 images/s · modèles réels de l’application';
