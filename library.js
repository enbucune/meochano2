// AI Motion Studio library: poses, motion clips, timeline ops, notes, prompt, agent API.
// Pure data functions on the project JSON. Used by the UI (engine.js), the CLI and AI agents alike.
import {SEG,segDist,attachAt,propTransform,propLowest,isAttachTrack,objectName,characterName,ANKLE_HEIGHT as ANK,evalPose,solveTwoBone,solveHinge,jointLimit,cameraChannel,checkMotion,limbHit,Q as QT,APP_VERSION,SCHEMA_VERSION,JOINTS,BODY_JOINTS,HAND_PRESETS,presetAngles,fingerJoints,isPresetTrack,isContactTrack,sample,migrate,validate,optimize,fullReport,stringifyProject,evalLocal,fk,lowestPoint,contactAt,DEFAULT_CAMERA} from './core.js?v=0.20';

const R=Math.PI/180;
const snap=(p,t)=>Math.round(t*p.fps)/p.fps;
const frameOf=(p,t)=>Math.round(t*p.fps);
const clone=o=>JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------- static poses
// Degrees, rig convention: hip/shoulder forward = −X, knee flex = +X, elbow flex = −X, spine forward = +X,
// chest Y+ = turn left, L shoulder Z+ / R shoulder Z− = raise sideways. Unlisted body joints = 0.
const guardArms={L_shoulder:[-45,0,12],R_shoulder:[-45,0,-12],L_elbow:[-110,0,0],R_elbow:[-110,0,0]};
const guardLegs={L_hip:[-12,0,4],R_hip:[10,0,-4],L_knee:[18,0,0],R_knee:[18,0,0],L_ankle:[-6,0,0],R_ankle:[-28,0,0]};
export const POSES={
 stand:{label:'Đứng thẳng',joints:{L_shoulder:[0,0,6],R_shoulder:[0,0,-6],L_elbow:[-8,0,0],R_elbow:[-8,0,0]},hands:{L:'relaxed',R:'relaxed'}},
 guard:{label:'Thủ thế',joints:{chest:[8,0,0],head:[-6,0,0],...guardArms,...guardLegs},hands:{L:'fist',R:'fist'}},
 punch:{label:'Đấm thẳng (tay phải)',joints:{hips:[0,12,0],chest:[6,22,0],head:[-6,-18,0],R_shoulder:[-88,0,0],R_elbow:[-4,0,0],L_shoulder:[-50,0,14],L_elbow:[-120,0,0],L_hip:[-18,0,4],R_hip:[14,0,-4],L_knee:[28,0,0],R_knee:[10,0,0],L_ankle:[-10,0,0],R_ankle:[-24,0,0]},hands:{L:'fist',R:'fist'}},
 kick:{label:'Đá ngang (chân phải)',joints:{chest:[0,0,-28],spine:[0,0,-10],head:[0,0,22],R_hip:[-12,0,-78],R_knee:[6,0,0],R_ankle:[25,0,0],L_knee:[12,0,0],L_ankle:[-6,0,0],...guardArms},hands:{L:'fist',R:'fist'}},
 block:{label:'Đỡ đòn',joints:{chest:[12,0,0],head:[12,0,0],L_shoulder:[-75,0,-8],R_shoulder:[-75,0,8],L_elbow:[-135,0,0],R_elbow:[-135,0,0],...guardLegs,L_knee:[25,0,0],R_knee:[25,0,0]},hands:{L:'fist',R:'fist'}},
 dodge:{label:'Né sang trái',joints:{spine:[0,0,-12],chest:[10,0,-24],head:[0,0,14],L_hip:[-10,0,14],R_hip:[-4,0,-4],L_knee:[38,0,0],R_knee:[22,0,0],L_ankle:[-26,0,-10],R_ankle:[-16,0,0],...guardArms},hands:{L:'fist',R:'fist'}},
 crouch:{label:'Ngồi xổm',joints:{chest:[32,0,0],spine:[10,0,0],head:[-30,0,0],L_hip:[-100,0,8],R_hip:[-100,0,-8],L_knee:[130,0,0],R_knee:[130,0,0],L_ankle:[-30,0,0],R_ankle:[-30,0,0],L_shoulder:[-45,0,10],R_shoulder:[-45,0,-10],L_elbow:[-50,0,0],R_elbow:[-50,0,0]},hands:{L:'relaxed',R:'relaxed'}},
 sit:{label:'Ngồi ghế',joints:{chest:[6,0,0],L_hip:[-88,0,4],R_hip:[-88,0,-4],L_knee:[88,0,0],R_knee:[88,0,0],L_shoulder:[-25,0,6],R_shoulder:[-25,0,-6],L_elbow:[-55,0,0],R_elbow:[-55,0,0]},hands:{L:'relaxed',R:'relaxed'}},
 fallen:{label:'Nằm ngửa (ngã)',joints:{hips:[-88,0,0],head:[-10,0,0],L_shoulder:[-20,0,40],R_shoulder:[-20,0,-40],L_elbow:[-30,0,0],R_elbow:[-30,0,0],L_hip:[-10,0,8],R_hip:[-25,0,-6],L_knee:[20,0,0],R_knee:[45,0,0],L_ankle:[20,0,0],R_ankle:[10,0,0]},hands:{L:'relaxed',R:'relaxed'}},
 jump:{label:'Bật nhảy (trên không)',joints:{chest:[10,0,0],L_hip:[-45,0,4],R_hip:[-30,0,-4],L_knee:[80,0,0],R_knee:[70,0,0],L_ankle:[20,0,0],R_ankle:[20,0,0],L_shoulder:[-150,0,15],R_shoulder:[-150,0,-15],L_elbow:[-20,0,0],R_elbow:[-20,0,0]},hands:{L:'open',R:'open'}},
 run:{label:'Chạy (sải chân)',joints:{chest:[14,0,0],head:[-8,0,0],L_hip:[-55,0,0],L_knee:[70,0,0],R_hip:[25,0,0],R_knee:[95,0,0],R_ankle:[30,0,0],L_ankle:[-10,0,0],L_shoulder:[40,0,8],R_shoulder:[-55,0,-8],L_elbow:[-85,0,0],R_elbow:[-95,0,0]},hands:{L:'relaxed',R:'relaxed'}},
 walk:{label:'Bước đi',joints:{L_hip:[-20,0,0],L_knee:[4,0,0],L_ankle:[-12,0,0],R_hip:[18,0,0],R_knee:[10,0,0],R_ankle:[12,0,0],L_shoulder:[18,0,5],R_shoulder:[-18,0,-5],L_elbow:[-12,0,0],R_elbow:[-22,0,0]},hands:{L:'relaxed',R:'relaxed'}},
 sword_ready:{label:'Thủ kiếm',joints:{chest:[8,-15,0],head:[-6,15,0],R_shoulder:[-55,0,12],R_elbow:[-70,0,0],R_wrist:[-30,0,0],L_shoulder:[-50,0,-18],L_elbow:[-80,0,0],...guardLegs},hands:{L:'sword',R:'sword'}},
 sword_raise:{label:'Giơ kiếm',joints:{chest:[-6,0,0],R_shoulder:[-165,0,8],R_elbow:[-45,0,0],L_shoulder:[-160,0,-14],L_elbow:[-55,0,0],...guardLegs},hands:{L:'sword',R:'sword'}},
 point:{label:'Chỉ tay',joints:{R_shoulder:[-85,0,-8],R_elbow:[-4,0,0],L_shoulder:[0,0,6],L_elbow:[-10,0,0]},hands:{L:'relaxed',R:'point'}},
 wave:{label:'Vẫy tay',joints:{R_shoulder:[-20,0,-150],R_elbow:[-35,0,0],L_shoulder:[0,0,6],L_elbow:[-10,0,0],head:[0,-8,0]},hands:{L:'relaxed',R:'open'}},
 victory:{label:'Giơ tay chiến thắng',joints:{chest:[-8,0,0],head:[-15,0,0],L_shoulder:[-170,0,12],R_shoulder:[-170,0,-12],L_elbow:[-10,0,0],R_elbow:[-10,0,0]},hands:{L:'fist',R:'fist'}},
};

// Standing poses: the higher foot is brought down to the lower one's height, flat on the floor (IK, knee forward).
function plantFeet(pose){let l={pos:[0,0,0],yaw:0,rot:{}};for(let [j,v] of Object.entries(pose.joints))l.rot[j]=v.slice();let w=fk(l),hi=w.pos.L_ankle[1]>w.pos.R_ankle[1]?'L':'R',lo=hi==='L'?'R':'L',a=w.pos[hi+'_ankle'],dy=a[1]-w.pos[lo+'_ankle'][1];if(dy<1e-4||dy>.15)return;
 let r=solveHinge(w,l,hi+'_hip',hi+'_knee',hi+'_ankle',[a[0],w.pos[lo+'_ankle'][1],a[2]],QT.euler(0,0,0),QT.rot(w.q.hips,[0,0,1]),1);if(r)for(let j in r)pose.joints[j]=r[j].map(v=>+v.toFixed(2))}
for(let n of ['stand','guard','punch','block','dodge','sit','sword_ready','sword_raise','point','wave','victory','crouch'])plantFeet(POSES[n]);

// ---------------------------------------------------------------- keys / tracks primitives
export function findTrack(p,actor,joint,axis){return p.tracks.find(t=>t.actor===actor&&t.joint===joint&&t.axis===axis)}
function restOf(p,actor,joint,axis){let c=p.characters.find(c=>c.id===actor);if(joint==='$root')return axis==='yaw'?(c?.yaw||0):(c?.position['xyz'.indexOf(axis)]??0);if(axis==='preset')return 'open';if(axis==='contact')return 0;return 0}
export function sceneKeyTimes(p){return [...new Set([...p.tracks.flatMap(t=>t.keys.map(k=>k[0])),...(p.cameraKeys||[]).map(k=>k[0])])].sort((a,b)=>a-b)}
// Set one key; a new track created after t=0 holds the rest value until the previous scene key (same rule as the K button).
export function setKey(p,actor,joint,axis,t,v,ease='smooth'){t=Math.min(Math.max(0,snap(p,t)),600);let tr=findTrack(p,actor,joint,axis);
 if(!tr){tr={actor,joint,axis,keys:[]};p.tracks.push(tr);if(frameOf(p,t)>0&&axis!=='attach'){let base=restOf(p,actor,joint,axis),prior=sceneKeyTimes(p).filter(k=>frameOf(p,k)<frameOf(p,t)).at(-1)||0;tr.keys.push([0,base,'hold']);if(frameOf(p,prior)>0)tr.keys.push([prior,base,'hold'])}}
 tr.keys=tr.keys.filter(k=>frameOf(p,k[0])!==frameOf(p,t));let key=[t,v];if(ease&&axis!=='contact'&&axis!=='attach')key.push(ease);tr.keys.push(key);tr.keys.sort((a,b)=>a[0]-b[0]);if(t>p.duration)p.duration=Math.min(600,Math.ceil(t));return tr}
const stepAt=(keys,t,dflt)=>{if(!keys?.length)return dflt;let v=keys[0][1];for(let k of keys){if(k[0]>t)break;v=k[1]}return v};
export function presetAt(p,actor,side,t){let tr=findTrack(p,actor,side+'_hand','preset');return tr?stepAt(tr.keys,t,'open'):null}
export function contactValueAt(p,actor,side,t){let tr=findTrack(p,actor,side+'_foot','contact');return tr?stepAt(tr.keys,t,0):0}
// Hand preset: preset track, or explicit finger keys when the hand already has finger tracks.
export function applyHand(p,actor,side,name,t,ease='smooth'){if(!HAND_PRESETS[name])throw Error('Preset tay không có: '+name);let joints=fingerJoints(side),explicit=p.tracks.some(tr=>tr.actor===actor&&joints.includes(tr.joint));
 if(explicit){let ang=presetAngles(name,side);for(let j of joints)for(let ax of ['x','y','z'])setKey(p,actor,j,ax,t,ang[j][ax],ease)}else setKey(p,actor,side+'_hand','preset',t,name,ease);return explicit?'fingers':'preset'}
// Write a joint map {joint:[x,y,z]} at time t. Unlisted body joints get 0 when full=true.
export function applyJoints(p,actor,t,joints,{ease='smooth',full=false,ground=true,hands}={}){let cur=evalLocal(p,actor,t);if(!cur)throw Error('Không có nhân vật: '+actor);let target={};
 for(let j of BODY_JOINTS){let v=joints[j]??(full?[0,0,0]:null);if(v)target[j]=Array.isArray(v)?[v[0]||0,v[1]||0,v[2]||0]:[v.x||0,v.y||0,v.z||0]}
 for(let j in joints)if(!target[j]&&JOINTS.includes(j)){let v=joints[j];target[j]=Array.isArray(v)?[v[0]||0,v[1]||0,v[2]||0]:[v.x||0,v.y||0,v.z||0]}
 for(let j in target)for(let k=0;k<3;k++){let ax='xyz'[k],v=+target[j][k].toFixed(3),has=!!findTrack(p,actor,j,ax),now=(cur.rot[j]||[0,0,0])[k];if(has||Math.abs(v-now)>1e-6)setKey(p,actor,j,ax,t,v,ease)}
 if(hands)for(let s in hands)if(hands[s])applyHand(p,actor,s,hands[s],t,ease);
 if(ground){let l=evalLocal(p,actor,t),y=+(l.pos[1]-lowestPoint(fk(l))).toFixed(4);if(Math.abs(y-l.pos[1])>1e-4||findTrack(p,actor,'$root','y'))setKey(p,actor,'$root','y',t,y,ease)}}
export function applyPose(p,actor,name,t,opts={}){let pose=typeof name==='string'?(POSES[name]||p.library?.poses?.[name]):name;if(!pose)throw Error('Tư thế không có: '+name);applyJoints(p,actor,t,pose.joints,{full:true,hands:opts.hands===false?null:pose.hands,...opts})}
// Mirror a joint map left<->right (exact for the symmetric rig: x kept, y/z negated).
export function mirrorJoints(rot){let out={};for(let j in rot){let m=j.startsWith('L_')?'R_'+j.slice(2):j.startsWith('R_')?'L_'+j.slice(2):j,v=rot[j];out[m]=[v[0],-v[1],-v[2]]}return out}
export function mirrorPose(p,actor,t,opts={}){let l=opts.rot?{rot:opts.rot}:evalLocal(p,actor,t),rot={};for(let j of JOINTS)rot[j]=l.rot[j]||[0,0,0];let m=mirrorJoints(rot),hands=null;let pl=presetAt(p,actor,'L',t),pr=presetAt(p,actor,'R',t);if(pl||pr)hands={L:pr||'open',R:pl||'open'};
 let body={},fingers={};for(let j in m)(/_finger/.test(j)?fingers:body)[j]=m[j];applyJoints(p,actor,t,body,{full:true,ground:false,hands,ease:opts.ease});
 for(let s of ['L','R'])if(!hands||p.tracks.some(tr=>tr.actor===actor&&fingerJoints(s).includes(tr.joint)))for(let j of fingerJoints(s))for(let k=0;k<3;k++){let has=findTrack(p,actor,j,'xyz'[k]);if(has||Math.abs(fingers[j][k])>1e-6)setKey(p,actor,j,'xyz'[k],t,fingers[j][k],opts.ease)}}

// ---------------------------------------------------------------- motion clips
// Clip = {duration, channels}. Channel names: "<joint>.x|y|z" (deg, absolute), "$root.fwd|side|up" (m, relative to start,
// in the character's facing frame: fwd = facing, side = character's left), "$root.turn" (deg relative), "L_hand.preset",
// "L_foot.contact" (0/1). Keys: [dt, value, ease?]. Phases make authoring easy: [{t, pose, root, hands, contact, ease}].
export function compileClip(phases,{label}={}){let ch={},push=(k,key)=>(ch[k]||(ch[k]=[])).push(key);
 for(let ph of phases){let t=+ph.t.toFixed(4),e=ph.ease||'smooth';
  for(let j in ph.pose||{}){let v=ph.pose[j];for(let k=0;k<3;k++)push(j+'.'+'xyz'[k],[t,v[k]||0,e])}
  for(let r in ph.root||{})push('$root.'+r,[t,ph.root[r],ph.rootEase||e]);
  for(let s in ph.hands||{})push(s+'_hand.preset',[t,ph.hands[s],e]);
  for(let s in ph.contact||{})push(s+'_foot.contact',[t,ph.contact[s]]);}
 for(let k in ch){ch[k].sort((a,b)=>a[0]-b[0]);ch[k]=ch[k].filter((x,i,a)=>!i||x[0]>a[i-1][0])}
 return {label,duration:Math.max(...phases.map(p=>p.t)),channels:ch}}
const P=n=>POSES[n].joints, merge=(...a)=>Object.assign({},...a);
const STAND=merge(Object.fromEntries(BODY_JOINTS.map(j=>[j,[0,0,0]])),P('stand'));
const full=j=>merge(Object.fromEntries(BODY_JOINTS.map(j=>[j,[0,0,0]])),j);
const legsSwing=(front,back,frontAng,backAng,frontKnee,backKnee)=>({[front+'_hip']:[-frontAng,0,0],[front+'_knee']:[frontKnee,0,0],[front+'_ankle']:[frontAng*.6-frontKnee,0,0],[back+'_hip']:[backAng,0,0],[back+'_knee']:[backKnee,0,0],[back+'_ankle']:[-backAng+backKnee*.2,0,0]});
// Locomotion: steps with foot contacts so planted feet never slide.
// Locomotion: feet placed geometrically (stride, clearance arc), hips height from reach, legs solved with 2-bone IK.
function legAngles(hipFwd,H,footFwd,footY,pitch=0){let l1=.44,l2=.44,dx=footFwd-hipFwd,dy=H-footY,D=Math.min(Math.hypot(dx,dy),l1+l2-1e-4),a1=Math.atan2(dx,dy),al=Math.acos(Math.min(1,(l1*l1+D*D-l2*l2)/(2*l1*D))),kb=Math.PI-Math.acos(Math.max(-1,Math.min(1,(l1*l1+l2*l2-D*D)/(2*l1*l2))));let hip=-(a1+al)/R,knee=kb/R;return {hip:[+hip.toFixed(2),0,0],knee:[+knee.toFixed(2),0,0],ankle:[+(-(hip+knee)+pitch).toFixed(2),0,0]}}
function locomotion({distance=2,run=false,speed},ctx={}){let dirSign=distance<0?-1:1,stepLen=run?1.0:.62,v=speed||(run?3.2:1.25);distance=Math.max(.2,Math.abs(distance));if(dirSign<0){stepLen=.45;v=speed||.9}
 let n=Math.max(2,Math.round(distance/stepLen)),s=dirSign*distance/n,T=Math.abs(s)/v,clear=run?.13:.075,Lr=.88*.985,Hmax=.94-.012,ph=[],feet={L:ctx.feet?.L??0,R:ctx.feet?.R??0},lat={L:ctx.lat?.L??0,R:ctx.lat?.R??0},side=(dirSign>0?feet.L<=feet.R:feet.L>=feet.R)?['L','R']:['R','L'];
 let arms=(f,amp)=>({[f+'_shoulder']:[amp,0,f==='L'?6:-6],[(f==='L'?'R':'L')+'_shoulder']:[-amp,0,f==='L'?-6:6],L_elbow:[run?-90:-18,0,0],R_elbow:[run?-90:-18,0,0]});
 let addStep=(t0,dur,f,from,to,rootFrom,rootTo,armAmp,last)=>{let b=f==='L'?'R':'L';ph.push({t:t0+.01,contact:{[f]:0}});
  for(let u of [.25,.5,.75,1]){let e=u*u*(3-2*u),fx=from+(to-from)*e,fy=ANK+(u<1?clear*Math.sin(Math.PI*u):0),r=rootFrom+(rootTo-rootFrom)*u,
    reach=(x,lt=0)=>Math.sqrt(Math.max(0,Lr*Lr-lt*lt-(x-r)*(x-r))),H=Math.min(Hmax,ANK+reach(feet[b],lat[b]),fy+reach(fx,lat[f]*(1-u))),Lf=legAngles(r,H,fx,fy,u<1?(u<.5?12:-4):0),Lb=legAngles(r,H,feet[b],ANK,0);
   ph.push({t:+(t0+dur*u).toFixed(4),pose:merge({chest:[run?12:3,0,0]},{[f+'_hip']:Lf.hip,[f+'_knee']:Lf.knee,[f+'_ankle']:Lf.ankle,[b+'_hip']:Lb.hip,[b+'_knee']:Lb.knee,[b+'_ankle']:Lb.ankle},arms(u<.5?b:f,armAmp*Math.abs(Math.cos(Math.PI*u)))),root:{fwd:+r.toFixed(4),up:+(H-.94).toFixed(4)},rootEase:'linear',ease:'smooth'})}
  ph.push({t:t0+dur,contact:{[f]:1}});feet[f]=to;lat[f]=0};
 ph.push({t:0,contact:{L:1,R:1}});let t=0,root=0;
 for(let i=0;i<n;i++){let f=side[i%2],b=side[1-i%2],to=(i+1)*s,newRoot=(to+feet[b])/2;addStep(t,T,f,feet[f],to,root,newRoot,run?45:20);t+=T;root=newRoot}
 let f=side[n%2];addStep(t,T*.8,f,feet[f],n*s,root,(n*s+feet[side[1-n%2]])/2,0,true);t+=T*.8;
 ph.push({t:t+.15,pose:full(STAND),root:{fwd:dirSign*distance,up:0},ease:'easeOut'});ph.push({t:t+.17,contact:{L:0,R:0},hands:{L:'relaxed',R:'relaxed'}});
 return compileClip(ph)}
const GUARD=()=>full(P('guard'));
export const MOTIONS={
 walk:{label:'Đi bộ',params:['distance','direction'],make:(o,ctx)=>locomotion({...o,run:false},ctx)},
 run:{label:'Chạy',params:['distance','direction'],make:(o,ctx)=>locomotion({...o,run:true},ctx)},
 jump:{label:'Nhảy',params:['height','distance'],make:({height=.4,distance=0})=>{let air=Math.sqrt(2*Math.max(.05,height)/9.8),t1=.35,t2=t1+.12,t3=t2+air,t4=t3+air,t5=t4+.22,t6=t5+.5;
  let crouch=full({chest:[28,0,0],head:[-20,0,0],L_hip:[-65,0,4],R_hip:[-65,0,-4],L_knee:[105,0,0],R_knee:[105,0,0],L_ankle:[-40,0,0],R_ankle:[-40,0,0],L_shoulder:[35,0,8],R_shoulder:[35,0,-8],L_elbow:[-20,0,0],R_elbow:[-20,0,0]});
  return compileClip([{t:0,contact:{L:1,R:1}},{t:t1,pose:crouch,root:{up:-.28},ease:'easeOut'},{t:t2,pose:full({chest:[-4,0,0],L_ankle:[35,0,0],R_ankle:[35,0,0],L_shoulder:[-100,0,10],R_shoulder:[-100,0,-10]}),root:{up:.06,fwd:0},contact:{L:0,R:0},ease:'linear'},
   {t:t3,pose:full(P('jump')),root:{up:height,fwd:distance/2},rootEase:'easeOut',ease:'easeOut'},{t:t4,pose:full({chest:[10,0,0],L_hip:[-25,0,4],R_hip:[-25,0,-4],L_knee:[30,0,0],R_knee:[30,0,0],L_ankle:[5,0,0],R_ankle:[5,0,0],L_shoulder:[-80,0,25],R_shoulder:[-80,0,-25]}),root:{up:-.03,fwd:distance},rootEase:'easeIn',ease:'easeIn',contact:{L:1,R:1}},
   {t:t5,pose:crouch,root:{up:-.25},ease:'easeOut'},{t:t6,pose:full(STAND),root:{up:0},ease:'easeInOut'},{t:t6+.02,contact:{L:0,R:0}}])}},
 land:{label:'Tiếp đất',params:[],make:()=>{let crouch=full({chest:[30,0,0],head:[-20,0,0],L_hip:[-70,0,6],R_hip:[-70,0,-6],L_knee:[110,0,0],R_knee:[110,0,0],L_ankle:[-40,0,0],R_ankle:[-40,0,0],L_shoulder:[-60,0,30],R_shoulder:[-60,0,-30]});
  return compileClip([{t:0,contact:{L:1,R:1}},{t:.18,pose:crouch,root:{up:-.3},ease:'easeOut'},{t:.3,pose:crouch,root:{up:-.3}},{t:.8,pose:full(STAND),root:{up:0},ease:'easeInOut'},{t:.82,contact:{L:0,R:0}}])}},
 punch:{label:'Đấm thẳng',params:['side'],make:()=>{let g=GUARD(),anti=merge(g,{chest:[8,-12,0],hips:[0,-6,0],R_shoulder:[-35,0,-14],R_elbow:[-125,0,0],R_hip:[14,0,-4],R_knee:[24,0,0]});
  return compileClip([{t:0,contact:{L:1,R:1}},{t:.14,pose:g,hands:{L:'fist',R:'fist'},ease:'easeInOut'},{t:.26,pose:anti,ease:'easeOut',contact:{L:0}},{t:.32,pose:{L_hip:[-30,0,4],L_knee:[45,0,0]}},{t:.38,pose:full(P('punch')),root:{fwd:.07},ease:'strike',contact:{L:1}},{t:.48,pose:full(P('punch')),root:{fwd:.07}},{t:.82,pose:g,root:{fwd:.03},ease:'easeOut'},{t:.84,contact:{L:0,R:0}}])}},
 kick:{label:'Đá ngang',params:['side'],make:()=>{let g=GUARD(),chamber=merge(g,{chest:[5,0,-12],R_hip:[-75,0,-30],R_knee:[115,0,0],R_ankle:[20,0,0],L_knee:[14,0,0],L_ankle:[-8,0,0]});
  return compileClip([{t:0,contact:{L:1,R:1}},{t:.12,pose:g,ease:'easeInOut',hands:{L:'fist',R:'fist'}},{t:.15,contact:{R:0}},{t:.36,pose:chamber,ease:'easeOut'},{t:.5,pose:full(P('kick')),ease:'strike'},{t:.62,pose:full(P('kick'))},{t:.8,pose:chamber,ease:'easeOut'},{t:1.05,pose:g,ease:'easeIn'},{t:1.06,contact:{R:1}},{t:1.08,contact:{L:0,R:0}}])}},
 spin:{label:'Xoay người 360°',params:['side'],make:()=>{let out=full({L_shoulder:[-10,0,70],R_shoulder:[-10,0,-70],L_elbow:[-20,0,0],R_elbow:[-20,0,0],L_knee:[15,0,0],R_knee:[15,0,0]});
  let lift=merge(out,{R_hip:[-25,0,0],R_knee:[75,0,0],R_ankle:[20,0,0],L_knee:[18,0,0]}),orbit=[];for(let i=1;i<=20;i++){let u=i/20,th=360*(u<.5?4*u*u*u:1-Math.pow(2-2*u,3)/2),r=th*R;orbit.push({t:+(.95*u).toFixed(4),root:{turn:+th.toFixed(3),side:+(.11*(1-Math.cos(r))).toFixed(4),fwd:+(.11*Math.sin(r)).toFixed(4)},rootEase:'linear'})}return compileClip([{t:0,contact:{L:2,R:1}},{t:.1,contact:{R:0}},{t:.2,pose:lift,ease:'easeOut'},...orbit,{t:.85,pose:lift},{t:1.05,pose:full(STAND),ease:'easeIn',contact:{R:1}},{t:1.15,contact:{L:0,R:0}}])}},
 dodge:{label:'Né đòn (sang trái)',params:['side','distance'],make:({distance=.32}={})=>{let g=GUARD(),sd=Math.min(.4,Math.max(.1,distance));return compileClip([{t:0,contact:{L:1,R:1}},{t:.08,contact:{L:0}},{t:.16,pose:{L_hip:[-18,0,10],L_knee:[45,0,0]}},{t:.26,pose:full(P('dodge')),root:{side:sd,up:-.06},ease:'easeOut'},{t:.27,contact:{L:1}},{t:.45,pose:full(P('dodge'))},{t:.3,contact:{R:0}},{t:.42,pose:{R_hip:[-15,0,-6],R_knee:[40,0,0]}},{t:.55,contact:{R:1}},{t:.8,pose:g,root:{side:sd,up:0},ease:'easeInOut'},{t:.83,contact:{L:0,R:0}}])}},
 block:{label:'Đỡ đòn',params:[],make:()=>{let g=GUARD();return compileClip([{t:0,contact:{L:1,R:1}},{t:.14,pose:full(P('block')),root:{fwd:-.05,up:-.03},ease:'strike',hands:{L:'fist',R:'fist'}},{t:.5,pose:full(P('block')),root:{fwd:-.05,up:-.03}},{t:.8,pose:g,root:{fwd:-.05,up:0},ease:'easeOut'},{t:.82,contact:{L:0,R:0}}])}},
 counter:{label:'Né rồi phản công',params:['side','distance'],make:o=>concatClips([MOTIONS.dodge.make(o||{}),MOTIONS.punch.make({})],-.15)},
 draw_sword:{label:'Rút kiếm',params:[],make:()=>{let reach=full({chest:[10,25,0],head:[0,-15,0],R_shoulder:[-30,0,25],R_elbow:[-105,0,0],L_shoulder:[-10,0,10],L_elbow:[-40,0,0],...guardLegs});
  return compileClip([{t:0,contact:{L:1,R:1}},{t:.35,pose:reach,hands:{R:'open'},ease:'easeInOut'},{t:.45,pose:reach,hands:{R:'sword'}},{t:.75,pose:full({chest:[0,-15,0],R_shoulder:[-120,0,0],R_elbow:[-20,0,0],L_shoulder:[-10,0,25],L_elbow:[-20,0,0],...guardLegs}),ease:'strike'},{t:1.15,pose:full(P('sword_ready')),hands:{L:'sword',R:'sword'},ease:'easeOut'},{t:1.17,contact:{L:0,R:0}}])}},
 swing_sword:{label:'Vung kiếm',params:[],make:()=>{let ready=full(P('sword_ready')),raise=full(P('sword_raise'));
  return compileClip([{t:0,contact:{L:1,R:1},hands:{L:'sword',R:'sword'}},{t:.1,pose:ready,ease:'easeInOut'},{t:.4,pose:raise,root:{up:.02},ease:'easeOut',contact:{L:0}},{t:.48,pose:{L_hip:[-45,0,4],L_knee:[55,0,0]}},{t:.55,pose:full({chest:[28,0,0],head:[-15,0,0],R_shoulder:[-35,0,6],R_elbow:[-8,0,0],L_shoulder:[-40,0,-14],L_elbow:[-15,0,0],L_hip:[-25,0,4],R_hip:[14,0,-4],L_knee:[35,0,0],R_knee:[14,0,0],L_ankle:[-10,0,0],R_ankle:[-26,0,0]}),root:{fwd:.12,up:-.05},ease:'strike',contact:{L:1}},{t:.7,pose:full({chest:[34,0,0],R_shoulder:[-15,0,6],R_elbow:[-8,0,0],L_shoulder:[-20,0,-14],L_elbow:[-10,0,0],L_hip:[-25,0,4],R_hip:[14,0,-4],L_knee:[38,0,0],R_knee:[14,0,0],L_ankle:[-12,0,0],R_ankle:[-26,0,0]}),root:{fwd:.13,up:-.06},ease:'easeOut'},{t:1.15,pose:ready,root:{fwd:.13,up:0},ease:'easeInOut'},{t:1.17,contact:{L:0,R:0}}])}},
 sheathe_sword:{label:'Tra kiếm',params:[],make:()=>{let reach=full({chest:[10,25,0],head:[0,-15,0],R_shoulder:[-30,0,25],R_elbow:[-105,0,0],L_shoulder:[-10,0,10],L_elbow:[-40,0,0],...guardLegs});
  return compileClip([{t:0,contact:{L:1,R:1}},{t:.1,pose:full(P('sword_ready')),ease:'easeInOut',hands:{L:'sword',R:'sword'}},{t:.55,pose:reach,hands:{L:'relaxed'},ease:'easeInOut'},{t:.7,pose:reach,hands:{R:'open'}},{t:1.1,pose:full(STAND),hands:{L:'relaxed',R:'relaxed'},ease:'easeInOut'},{t:1.12,contact:{L:0,R:0}}])}},
 sit_down:{label:'Ngồi xuống ghế',params:[],make:(o,ctx)=>{let up=ctx.groundUp(full(P('sit')));return compileClip([{t:0,contact:{L:1,R:1}},{t:.45,pose:full({chest:[30,0,0],L_hip:[-50,0,4],R_hip:[-50,0,-4],L_knee:[50,0,0],R_knee:[50,0,0],L_shoulder:[-40,0,6],R_shoulder:[-40,0,-6]}),root:{up:up*.45},ease:'easeIn'},{t:1,pose:full(P('sit')),root:{up},ease:'easeOut'},{t:1.02,contact:{L:0,R:0}}])}},
 stand_up:{label:'Đứng dậy',params:[],make:()=>compileClip([{t:0,contact:{L:1,R:1}},{t:.35,pose:full({chest:[40,0,0],head:[-20,0,0],L_hip:[-90,0,4],R_hip:[-90,0,-4],L_knee:[95,0,0],R_knee:[95,0,0],L_ankle:[-5,0,0],R_ankle:[-5,0,0],L_shoulder:[-30,0,6],R_shoulder:[-30,0,-6]}),ease:'easeInOut'},{t:1.05,pose:full(STAND),root:{up:0},rootEase:'easeInOut',ease:'easeOut'},{t:1.07,contact:{L:0,R:0}}])},
 fall:{label:'Ngã ngửa',params:[],make:(o,ctx)=>{let lie=full(P('fallen')),up=ctx.groundUp(lie);return compileClip([{t:0,contact:{L:1,R:1}},{t:.3,pose:full({chest:[-25,0,0],head:[20,0,0],L_shoulder:[-60,0,45],R_shoulder:[-60,0,-45],L_knee:[30,0,0],R_knee:[25,0,0],L_hip:[-10,0,0],R_hip:[-5,0,0]}),root:{fwd:-.15},ease:'easeOut'},{t:.32,contact:{L:0,R:0}},{t:.52,pose:{L_hip:[-55,0,6],L_knee:[55,0,0],R_hip:[-62,0,-6],R_knee:[65,0,0]}},{t:.75,pose:full({hips:[-35,0,0],chest:[-10,0,0],L_hip:[-60,0,6],R_hip:[-70,0,-6],L_knee:[70,0,0],R_knee:[80,0,0],L_shoulder:[-50,0,40],R_shoulder:[-50,0,-40]}),root:{fwd:-.35,up:up*.5},ease:'easeIn'},{t:1.1,pose:lie,root:{fwd:-.55,up},ease:'easeIn'},{t:1.3,pose:merge(lie,{head:[-20,0,0]}),root:{fwd:-.55,up:up+.02},ease:'easeOut'},{t:1.5,pose:lie,root:{fwd:-.55,up},ease:'easeIn'}])}},
};
export function concatClips(clips,overlap=0){let out={},t=0,root={fwd:0,side:0,up:0,turn:0};for(let c of clips){let base=t,last={};for(let k in c.channels){let rk=k.startsWith('$root.')?k.slice(6):null;for(let key of c.channels[k]){let v=key[1];if(rk){v=rk==='up'?v:v+root[rk];last[rk]=v}(out[k]||(out[k]=[])).push([+(base+key[0]).toFixed(4),v,...key.slice(2)])}}
  for(let r of ['fwd','side','turn'])if(last[r]!==undefined)root[r]=last[r];t=base+c.duration+overlap}
 for(let k in out){out[k].sort((a,b)=>a[0]-b[0]);out[k]=out[k].filter((x,i,a)=>!i||x[0]>a[i-1][0])}return {duration:Math.max(...Object.values(out).flat().map(k=>k[0])),channels:out}}
export function mirrorClip(c){let ch={};for(let k in c.channels){let [j,ax]=k.split('.'),m=j.startsWith('L_')?'R_'+j.slice(2):j.startsWith('R_')?'L_'+j.slice(2):j,neg=(j!=='$root'&&(ax==='y'||ax==='z'))||(j==='$root'&&(ax==='side'||ax==='turn'));ch[m+'.'+ax]=c.channels[k].map(key=>neg?[key[0],-key[1],...key.slice(2)]:key.slice())}return {...c,channels:ch}}
export function listMotions(p){return {...Object.fromEntries(Object.entries(MOTIONS).map(([k,m])=>[k,{label:m.label,params:m.params,builtIn:true}])),...Object.fromEntries(Object.entries(p?.library?.motions||{}).map(([k,m])=>[k,{label:m.label||k,params:['direction','side'],builtIn:false}]))}}
// Insert a clip for one actor at t0. opts: speed (time ×), duration (s, overrides speed), direction (deg), side ('L'|'R' mirrors
// a right-handed motion), distance/height (generators), note (string|false). Same JSON result as manual editing.
export function applyMotion(p,actor,name,t0,opts={}){if(!p.characters.some(c=>c.id===actor))throw Error(`Không có nhân vật "${actor}" (có: ${p.characters.map(c=>c.id).join(', ')||'chưa có ai'})`);let ctx={groundUp:pose=>{let l=evalLocal(p,actor,t0);let w=fk({pos:[0,0,0],yaw:0,rot:pose});return -lowestPoint(w)-l.pos[1]}};
 {let l=evalPose(p,actor,snap(p,t0)),w=fk(l),dy=(l.yaw+(opts.direction||0))*R,d=[Math.sin(dy),Math.cos(dy)];ctx.feet={L:(w.pos.L_ankle[0]-l.pos[0])*d[0]+(w.pos.L_ankle[2]-l.pos[2])*d[1],R:(w.pos.R_ankle[0]-l.pos[0])*d[0]+(w.pos.R_ankle[2]-l.pos[2])*d[1]};let rt=[d[1],-d[0]];ctx.lat={L:(w.pos.L_ankle[0]-w.pos.L_hip[0])*rt[0]+(w.pos.L_ankle[2]-w.pos.L_hip[2])*rt[1],R:(w.pos.R_ankle[0]-w.pos.R_hip[0])*rt[0]+(w.pos.R_ankle[2]-w.pos.R_hip[2])*rt[1]}}
 let clip=MOTIONS[name]?MOTIONS[name].make(opts,ctx):p.library?.motions?.[name]?clone(p.library.motions[name]):null;if(!clip)throw Error('Chuyển động không có: '+name);
 let defaultSide=name==='dodge'?'L':'R',sided=!MOTIONS[name]||MOTIONS[name].params.includes('side');if(opts.mirror||(sided&&opts.side&&opts.side!==defaultSide))clip=mirrorClip(clip);
 let speed=opts.duration?clip.duration/opts.duration:(opts.speed||1),label=MOTIONS[name]?.label||clip.label||name;
 let loco=['walk','run'].includes(name),turnFirst=loco&&Math.abs(opts.direction||0)>1;
 if(turnFirst){// turn in place on the balls of both feet, then walk straight ahead
  t0=snap(p,t0);let l0=evalLocal(p,actor,t0);for(let s of ['L','R'])setKey(p,actor,s+'_foot','contact',t0,2);setKey(p,actor,'$root','yaw',t0,+l0.yaw.toFixed(3),'smooth');setKey(p,actor,'$root','yaw',t0+.35,+(l0.yaw+opts.direction).toFixed(3),'easeInOut');
  let r=applyMotion(p,actor,name,t0+.35,{...opts,direction:0,note:false});if(opts.note!==false)addNote(p,{t:t0,until:r.end,actor,text:opts.note||`${actor}: quay ${Math.round(opts.direction)}° rồi ${label}${opts.distance?` ${opts.distance}m`:''}`,motion:name});return {start:t0,end:r.end}}
 let r=applyClip(p,actor,t0,clip,{speed,direction:opts.direction||0,face:loco});
 if(opts.note!==false)addNote(p,{t:r.start,until:r.end,actor,text:opts.note||`${actor}: ${label}${opts.distance?` ${opts.distance}m`:''}${opts.direction?` hướng ${opts.direction}°`:''}`,motion:name});return r}
export function applyClip(p,actor,t0,clip,{speed=1,direction=0,face=false}={}){t0=snap(p,Math.max(0,t0));let st=evalLocal(p,actor,t0);if(!st)throw Error('Không có nhân vật: '+actor);let T=dt=>snap(p,t0+dt/speed),end=T(clip.duration),ch=clip.channels,dirYaw=st.yaw+direction;
 let writes=new Map(),W=(joint,axis,keys,anchor)=>writes.set(joint+'|'+axis,{joint,axis,keys,anchor});
 for(let k in ch){let [j,ax]=k.split('.');if(j==='$root'||!ch[k].length)continue;if(ax==='preset'){let side=j[0],cur=presetAt(p,actor,side,t0);if(p.tracks.some(tr=>tr.actor===actor&&fingerJoints(side).includes(tr.joint))){let names=ch[k];for(let fj of fingerJoints(side))for(let a of 'xyz')W(fj,a,names.map(n=>[n[0],presetAngles(n[1],side)[fj][a],n[2]||'smooth']),(st.rot[fj]||[0,0,0])['xyz'.indexOf(a)])}else{let first=ch[k].filter(x=>frameOf(p,T(x[0]))<=frameOf(p,t0)).at(-1);W(j,'preset',ch[k],first?first[1]:(cur||'open'))}continue}
  if(ax==='contact'){let first=ch[k].filter(x=>frameOf(p,T(x[0]))<=frameOf(p,t0)).at(-1);W(j,'contact',ch[k],first?first[1]:contactValueAt(p,actor,j[0],t0));continue}W(j,ax,ch[k],(st.rot[j]||[0,0,0])['xyz'.indexOf(ax)])}
 // root: facing-frame → world
 let rk=n=>ch['$root.'+n]||[],times=[...new Set([...rk('fwd'),...rk('side')].map(k=>k[0]))].sort((a,b)=>a-b),fs=Math.sin(dirYaw*R),fc=Math.cos(dirYaw*R);
 if(times.length){let fk_=rk('fwd'),sk=rk('side'),ease=t=>(fk_.find(k=>k[0]===t)||sk.find(k=>k[0]===t))?.[2]||'smooth';let f=t=>fk_.length?sample(fk_,t):0,s=t=>sk.length?sample(sk,t):0;
  W('$root','x',times.map(t=>[t,+(st.pos[0]+fs*f(t)+fc*s(t)).toFixed(4),ease(t)]),st.pos[0]);W('$root','z',times.map(t=>[t,+(st.pos[2]+fc*f(t)-fs*s(t)).toFixed(4),ease(t)]),st.pos[2])}
 if(rk('up').length)W('$root','y',rk('up').map(k=>[k[0],+(st.pos[1]+k[1]).toFixed(4),k[2]||'smooth']),st.pos[1]);
 let turn=rk('turn').map(k=>[k[0],st.yaw+direction*(face?1:0)+k[1],k[2]||'smooth']);if(face&&direction){if(!turn.length)turn=[[Math.min(.25,clip.duration),st.yaw+direction,'easeInOut']];else turn.unshift([Math.min(.25,turn[0][0]/2),st.yaw+direction,'easeInOut'])}
 if(turn.length)W('$root','yaw',turn,st.yaw);
 for(let {joint,axis,keys,anchor} of writes.values()){let tr=findTrack(p,actor,joint,axis);if(!tr){tr={actor,joint,axis,keys:[]};p.tracks.push(tr)}
  let f0=frameOf(p,t0),fe=frameOf(p,end);let had=tr.keys.some(k=>frameOf(p,k[0])===f0);tr.keys=tr.keys.filter(k=>{let f=frameOf(p,k[0]);return f<=f0||f>fe});
  if(!had)tr.keys.push(axis==='contact'?[t0,anchor]:[t0,anchor,'smooth']);
  for(let k of keys){let t=T(k[0]);if(frameOf(p,t)<=f0)continue;tr.keys=tr.keys.filter(x=>frameOf(p,x[0])!==frameOf(p,t));tr.keys.push(axis==='contact'?[t,k[1]]:[t,k[1],k[2]||'smooth'])}
  tr.keys.sort((a,b)=>a[0]-b[0])}
 if(end>p.duration)p.duration=Math.min(600,Math.ceil(end));return {start:t0,end}}
// Save a timeline range of one actor as a reusable clip (stored in project.library.motions → shared with AI).
export function extractClip(p,actor,t1,t2,{name,label}={}){let st=evalLocal(p,actor,t1);if(!st)throw Error('Không có nhân vật: '+actor);let ch={},yaw=st.yaw*R,fs=Math.sin(yaw),fc=Math.cos(yaw),inR=k=>k[0]>t1+1e-9&&k[0]<=t2+1e-9;
 for(let tr of p.tracks){if(tr.actor!==actor)continue;let keys=tr.keys.filter(inR);if(!keys.length)continue;let rel=k=>+(k[0]-t1).toFixed(4);
  if(tr.joint==='$root'){if(tr.axis==='yaw')ch['$root.turn']=keys.map(k=>[rel(k),+(k[1]-st.yaw).toFixed(3),k[2]||'smooth']);else if(tr.axis==='y')ch['$root.up']=keys.map(k=>[rel(k),+(k[1]-st.pos[1]).toFixed(4),k[2]||'smooth']);continue}
  let [j,ax]=[tr.joint,tr.axis];ch[j+'.'+ax]=keys.map(k=>ax==='contact'?[rel(k),k[1]]:[rel(k),k[1],k[2]||'smooth'])}
 let xs=findTrack(p,actor,'$root','x'),zs=findTrack(p,actor,'$root','z');if(xs||zs){let times=[...new Set([...(xs?.keys||[]),...(zs?.keys||[])].filter(inR).map(k=>k[0]))].sort((a,b)=>a-b),ease=t=>([...(xs?.keys||[]),...(zs?.keys||[])].find(k=>k[0]===t)?.[2])||'smooth';
  if(times.length){ch['$root.fwd']=[];ch['$root.side']=[];for(let t of times){let l=evalLocal(p,actor,t),dx=l.pos[0]-st.pos[0],dz=l.pos[2]-st.pos[2];ch['$root.fwd'].push([+(t-t1).toFixed(4),+(fs*dx+fc*dz).toFixed(4),ease(t)]);ch['$root.side'].push([+(t-t1).toFixed(4),+(fc*dx-fs*dz).toFixed(4),ease(t)])}}}
 let clip={label:label||name,duration:+(t2-t1).toFixed(4),channels:ch};if(name){p.library=p.library||{};p.library.motions=p.library.motions||{};p.library.motions[name]=clip}return clip}

// ---------------------------------------------------------------- timeline range ops (whole scene: all tracks + camera)
function eachKeyList(p,fn){for(let tr of p.tracks)tr.keys=fn(tr.keys,tr);if(p.cameraKeys)p.cameraKeys=fn(p.cameraKeys,null)}
// Move (or copy) every key whose frame is in `frames` by deltaSeconds. Collisions at the destination are overwritten.
export function moveKeys(p,frames,delta,{copy=false}={}){let F=new Set(frames),df=Math.round(delta*p.fps);if(!df)return 0;let n=0;
 eachKeyList(p,keys=>{let sel=keys.filter(k=>F.has(frameOf(p,k[0])));if(!sel.length)return keys;n+=sel.length;let moved=sel.map(k=>{let c=k.slice();c[0]=Math.max(0,(frameOf(p,k[0])+df)/p.fps);return c}),dest=new Set(moved.map(k=>frameOf(p,k[0])));let rest=(copy?keys:keys.filter(k=>!F.has(frameOf(p,k[0])))).filter(k=>!dest.has(frameOf(p,k[0])));let out=[...rest,...moved].sort((a,b)=>a[0]-b[0]);return out.filter((k,i)=>i===out.length-1||frameOf(p,k[0])!==frameOf(p,out[i+1][0]))});
 let mx=Math.max(0,...sceneKeyTimes(p));if(mx>p.duration)p.duration=Math.min(600,Math.ceil(mx));return n}
// Stretch keys in [t1,t2] by factor around t1; later keys ripple so the rest keeps its timing.
export function scaleRange(p,t1,t2,factor){if(!(factor>0))throw Error('Hệ số phải > 0');let f1=frameOf(p,t1),f2=frameOf(p,t2),shift=Math.round((f2-f1)*(factor-1));
 let map=f=>f<f1?f:f<=f2?f1+Math.round((f-f1)*factor):f+shift;
 eachKeyList(p,keys=>{let out=keys.map(k=>{let c=k.slice();c[0]=map(frameOf(p,k[0]))/p.fps;return c});return out.filter((k,i)=>i===out.length-1||frameOf(p,k[0])!==frameOf(p,out[i+1][0]))});
 for(let n of p.notes||[]){n.t=map(frameOf(p,n.t))/p.fps;if(n.until!==undefined)n.until=map(frameOf(p,n.until))/p.fps}
 let mx=Math.max(0,...sceneKeyTimes(p));if(mx>p.duration)p.duration=Math.min(600,Math.ceil(mx));return {shift:shift/p.fps}}
export function deleteFrames(p,frames){let F=new Set(frames);eachKeyList(p,keys=>keys.filter(k=>!F.has(frameOf(p,k[0]))));p.tracks=p.tracks.filter(t=>t.keys.length)}

// ---------------------------------------------------------------- notes & camera helpers
const PROP_COLORS=['#64748b','#82916e','#776b58','#8b6f5a','#5f7d8c','#7a6a8f'];
// Unique prop name ("Vật thể 5", or "Ghế gỗ 2" when duplicating)
export function uniqueObjectName(p,base){let used=new Set((p.objects||[]).map((o,i)=>objectName(o,i).toLowerCase()));if(!used.has(base.toLowerCase()))return base;let m=/^(.*?)(?:\s+(\d+))?$/.exec(base),root=m[1],n=m[2]?+m[2]+1:2;while(used.has(`${root} ${n}`.toLowerCase()))n++;return `${root} ${n}`}
export function addObject(p,{name,desc,position=[0,.25,0],size=[.5,.5,.5],color}={}){p.objects=p.objects||[];let i=p.objects.length,o={name:uniqueObjectName(p,(name||'').trim()||`Vật thể ${i+1}`),...(desc?{desc}:{}),position:position.map(Number),size:size.map(Number),color:color||PROP_COLORS[i%PROP_COLORS.length]};p.objects.push(o);return i}
// Remove prop i; tracks of later props are renumbered so their animation stays attached to the right box.
export function removeObject(p,i){if(!p.objects?.[i])throw Error('Không có vật thể '+i);p.objects.splice(i,1);p.tracks=p.tracks.filter(t=>t.actor!=='@object:'+i).map(t=>{let m=/^@object:(\d+)$/.exec(t.actor);return m&&+m[1]>i?{...t,actor:'@object:'+(+m[1]-1)}:t});return p.objects.length}
// Duplicate prop i as a static copy at its pose at time t, shifted by `offset`.
export function duplicateObject(p,i,t=0,offset=[.6,0,0]){let o=p.objects?.[i];if(!o)throw Error('Không có vật thể '+i);let tr=ax=>p.tracks.find(x=>x.actor==='@object:'+i&&x.axis===ax),val=(ax,d)=>{let k=tr(ax);return k?sample(k.keys,t):d};
 let pos=[0,1,2].map(k=>val('p'+'xyz'[k],o.position[k])+offset[k]),size=[0,1,2].map(k=>val('s'+'xyz'[k],o.size[k]));let j=addObject(p,{name:uniqueObjectName(p,objectName(o,i)),desc:o.desc,position:pos,size,color:o.color});
 for(let k=0;k<3;k++){let r=val('r'+'xyz'[k],0);if(Math.abs(r)>1e-6)p.tracks.push({actor:'@object:'+j,joint:'$root',axis:'r'+'xyz'[k],keys:[[0,+r.toFixed(3)]]})}return j}
export function addNote(p,{t,until,text,actor,motion}){p.notes=p.notes||[];let n={t:snap(p,t),text};if(until!==undefined)n.until=snap(p,until);if(actor)n.actor=actor;if(motion)n.motion=motion;p.notes.push(n);p.notes.sort((a,b)=>a.t-b.t);return n}
export function setCamera(p,{at=0,azimuth=0,elevation=15,distance=5,target=[0,1,0],ease='smooth'}){p.cameraKeys=p.cameraKeys||[];let t=snap(p,at);p.cameraKeys=p.cameraKeys.filter(k=>frameOf(p,k[0])!==frameOf(p,t));p.cameraKeys.push([t,azimuth,elevation,distance,ease,...target]);p.cameraKeys.sort((a,b)=>a[0]-b[0])}
// Frame a set of characters at time t (auto target + distance).
export function frameCamera(p,{at=0,actors,azimuth=0,elevation=12,ease='smooth',padding=1.3}){let ids=actors||p.characters.map(c=>c.id),pts=[];for(let id of ids){let w=fk(evalLocal(p,id,at));pts.push(w.pos.head,w.pos.L_ankle,w.pos.R_ankle,w.pos.L_wrist,w.pos.R_wrist)}if(!pts.length)return;let mn=[0,1,2].map(i=>Math.min(...pts.map(q=>q[i]))),mx=[0,1,2].map(i=>Math.max(...pts.map(q=>q[i]))),c=mn.map((v,i)=>(v+mx[i])/2),size=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2],1),d=size*padding/(2*Math.tan(21*R));setCamera(p,{at,azimuth,elevation,distance:+d.toFixed(3),target:c.map(v=>+v.toFixed(3)),ease})}

// ---------------------------------------------------------------- prompt for video models
const shot=d=>d<1.6?'close-up':d<3.2?'medium shot':d<6.5?'wide shot':'extreme wide shot';
const angle=e=>e>35?'high angle, looking down':e>8?'slightly high angle':e<-8?'low angle, looking up':'eye level';
const side=a=>{a=((a%360)+360)%360;return a<22.5||a>=337.5?'from the front (+Z)':a<67.5?'from front-right':a<112.5?'from the right side (+X)':a<157.5?'from back-right':a<202.5?'from behind (−Z)':a<247.5?'from back-left':a<292.5?'from the left side (−X)':'from front-left'};
export function makePrompt(p,{aspect='16:9',style=''}={}){let L=[],cam=p.cameraKeys?.length?p.cameraKeys:[[0,...DEFAULT_CAMERA.slice(0,3),'smooth',...DEFAULT_CAMERA.slice(3)]];
 L.push(`Reference motion clip: ${p.duration}s, ${p.fps} fps, aspect ${aspect}. Colored mannequins = characters, boxes = props/set (listed by name below). Follow the reference EXACTLY for blocking, body motion, timing and camera.`);
 L.push('','CHARACTERS:');for(let c of p.characters){let l=evalLocal(p,c.id,0);let nm=typeof c.name==='string'&&c.name.trim()?` = "${c.name.trim()}"`:'';L.push(`- ${c.id}${nm}${c.desc?`: ${c.desc}`:''} (${c.color||''} mannequin): starts at x=${l.pos[0].toFixed(2)}, z=${l.pos[2].toFixed(2)}, facing ${Math.round(l.yaw)}°.`)}
 if(p.objects?.length){L.push('','PROPS / SET (each box in the reference is one of these objects):');p.objects.forEach((o,i)=>{let tr=p.tracks.filter(t=>t.actor==='@object:'+i&&t.keys.length>1&&!isAttachTrack(t)&&varies(t)),mv='';if(tr.length){let ts=tr.flatMap(t=>t.keys.map(k=>k[0])),what=[...new Set(tr.map(t=>({p:'moves',r:'rotates',s:'changes size'})[t.axis[0]]))].join(', ');mv=` — ${what} between ${Math.min(...ts).toFixed(1)}s and ${Math.max(...ts).toFixed(1)}s`}
  let hs=propHolds(p,i).map(h=>{let after=propTransform(p,i,Math.min(p.duration,h.to+.6)),end=propTransform(p,i,p.duration);return `held in ${h.by}'s ${({R_wrist:'right hand',L_wrist:'left hand',chest:'back',hips:'hip',head:'head'})[h.joint]||h.joint} ${h.from.toFixed(1)}–${h.to.toFixed(1)}s`+(h.to<p.duration-1e-6&&!attachAt(p,i,h.to+1e-3)?`, then released and ends at x=${end.pos[0].toFixed(2)}, z=${end.pos[2].toFixed(2)}${propLowest(end)<.05?' on the floor':''}`:'')}).join('; ');
  let t0=propTransform(p,i,0);L.push(`- "${objectName(o,i)}"${o.desc?`: ${o.desc}`:''} (box ${t0.size.map(v=>+(+v).toFixed(2)).join('×')} m, starts at x=${t0.pos[0].toFixed(2)}, y=${t0.pos[1].toFixed(2)}, z=${t0.pos[2].toFixed(2)})${mv}${hs?' — '+hs:''}`)})}
 L.push('','CAMERA:');cam.forEach((k,i)=>{let prev=cam[i-1],move='';if(prev){let da=k[1]-prev[1],dd=k[3]-prev[3];move=[Math.abs(da)>5?`orbit ${da>0?'left':'right'} ${Math.abs(Math.round(da))}°`:'',dd<-.4?'push in':dd>.4?'pull out':''].filter(Boolean).join(', ')||'hold'}L.push(`- ${k[0].toFixed(1)}s: ${shot(k[3])}, ${angle(k[2])}, ${side(k[1])}${move?` (${move}, ${k[4]||'smooth'})`:''}`)});
 L.push('','ACTION BEATS:');let notes=(p.notes||[]).slice().sort((a,b)=>a.t-b.t);if(notes.length)for(let n of notes)L.push(`- ${n.t.toFixed(1)}${n.until!==undefined?'–'+n.until.toFixed(1):''}s: ${n.text}`);else L.push('- (no notes — describe the action here)');
 L.push('','RENDER:',`- Replace mannequins with the final characters; keep exact poses, contact with the ground and timing.${style?' Style: '+style+'.':''}`,'- No extra cuts, no extra characters, no text overlays.');return L.join('\n')}

// ---------------------------------------------------------------- agent API (same JSON as the UI)
export const COMMANDS=['character','object','duration','fps','pose','joints','motion','hand','key','contact','camera','frame','note','mirror','saveMotion','retime','moveKeys','optimize','face','reach','approach','allowContact','removeObject','rename','grab','release','drop','snapToHand'];
export function newProject({fps=30,duration=10}={}){return {schemaVersion:SCHEMA_VERSION,app:APP_VERSION,fps,duration,characters:[],objects:[],tracks:[],cameraKeys:[[0,0,15,5,'smooth',0,1,0]],notes:[]}}
// at: number | "end" | "end+0.2" | "end-0.1" (relative to the end of this actor's previous motion/command).
export function runCommands(input,commands){let p=input?migrate(input):newProject(),ends={},results=[];let at=(c)=>{let a=c.at??0;if(typeof a==='string'){let m=/^end([+-][\d.]+)?$/.exec(a.trim());if(!m)throw Error('at không hợp lệ: '+a);a=(ends[c.actor]??0)+(m[1]?+m[1]:0)}return Math.max(0,+a)};
 commands.forEach((c,i)=>{try{let r=null,t;switch(c.op){
  case 'character':{if(p.characters.some(x=>x.id===c.id))throw Error('Trùng id '+c.id);p.characters.push({id:c.id,...(c.name?{name:c.name}:{}),...(c.desc?{desc:c.desc}:{}),position:c.position||[0,0,0],yaw:c.yaw||0,color:c.color||['#65caff','#ff9865','#84ed83','#bf9aff'][p.characters.length%4]});break}
  case 'object':r=addObject(p,{name:c.name||c.id,desc:c.desc,position:c.position||[0,.5,0],size:c.size||[1,1,1],color:c.color});if(c.id)p.objects[r].id=c.id;break;
  case 'removeObject':{let i=Number.isInteger(c.index)?c.index:(p.objects||[]).findIndex((o,k)=>objectName(o,k)===c.name);if(i<0)throw Error('Không tìm thấy vật thể '+(c.name??c.index));removeObject(p,i);break}
  case 'rename':{if(c.actor){let ch=p.characters.find(x=>x.id===c.actor);if(!ch)throw Error('Không có nhân vật '+c.actor);if(c.name!==undefined)ch.name=c.name;if(c.desc!==undefined)ch.desc=c.desc}else{let o=p.objects?.[c.index];if(!o)throw Error('Không có vật thể '+c.index);if(c.name)o.name=c.name;if(c.desc!==undefined)o.desc=c.desc}break}
  case 'duration':p.duration=c.value;break;case 'fps':p.fps=c.value;break;
  case 'pose':t=at(c);applyPose(p,c.actor,c.name,t,{ease:c.ease||'smooth',ground:c.ground!==false});ends[c.actor]=t;break;
  case 'joints':t=at(c);applyJoints(p,c.actor,t,c.joints,{ease:c.ease||'smooth',ground:c.ground===true,hands:c.hands});ends[c.actor]=t;break;
  case 'motion':t=at(c);r=applyMotion(p,c.actor,c.name,t,c);ends[c.actor]=r.end;break;
  case 'hand':t=at(c);r=applyHand(p,c.actor,c.side,c.preset,t,c.ease||'smooth');break;
  case 'key':t=at(c);setKey(p,c.actor,c.joint,c.axis,t,c.value,c.ease||'smooth');ends[c.actor]=Math.max(ends[c.actor]||0,t);break;
  case 'contact':setKey(p,c.actor,c.foot+'_foot','contact',c.from,c.mode===2||c.pivot?2:1);if(c.to!==undefined)setKey(p,c.actor,c.foot+'_foot','contact',c.to,0);break;
  case 'camera':setCamera(p,{...c,at:at(c)});break;
  case 'frame':frameCamera(p,{...c,at:at(c)});break;
  case 'note':addNote(p,{...c,t:at(c)});break;
  case 'mirror':t=at(c);mirrorPose(p,c.actor,t,{ease:c.ease});break;
  case 'saveMotion':extractClip(p,c.actor,c.from,c.to,{name:c.name,label:c.label});break;
  case 'retime':r=scaleRange(p,c.from,c.to,c.factor);break;
  case 'moveKeys':{let fr=sceneKeyTimes(p).filter(k=>k>=c.from-1e-9&&k<=c.to+1e-9).map(k=>frameOf(p,k));r=moveKeys(p,fr,c.by,{copy:!!c.copy});break}
  case 'optimize':p=optimize(p).project;break;
  case 'face':t=at(c);r=faceTarget(p,c.actor,c.target,t,c);ends[c.actor]=r.end;break;
  case 'reach':t=at(c);r=reach(p,c.actor,c.limb,c.target,t,c);if(!r.reached&&c.strict)throw Error(`không với tới (thiếu ${r.error}m)`);break;
  case 'approach':t=at(c);r=approach(p,c.actor,c.target,t,c);ends[c.actor]=r.end;break;
  case 'allowContact':allowContact(p,c);break;
  case 'grab':t=at(c);r=grabObject(p,c.object,c.actor,c.joint||(c.hand==='L'?'L_wrist':'R_wrist'),t,c);break;
  case 'release':t=at(c);r=releaseObject(p,c.object,t,c);break;
  case 'drop':t=at(c);r=dropObject(p,c.object,t,c);break;
  case 'snapToHand':t=at(c);r=snapToHand(p,c.object,t);break;
  default:throw Error('op không có: '+c.op+' (dùng '+COMMANDS.join('/')+')')}results.push({i,op:c.op,ok:true,...(r&&typeof r==='object'?r:r!=null?{result:r}:{})})}catch(e){results.push({i,op:c.op,ok:false,error:e.message})}});
 return {project:p,results}}
// Fluent wrapper for JS agents: new Studio().character('A',{...}).motion('A','walk',{at:0,distance:2}).toJSON()
export class Studio{constructor(project){this.p=project?migrate(project):newProject();this.log=[]}
 run(cmds){let r=runCommands(this.p,cmds);this.p=r.project;this.log.push(...r.results);let bad=r.results.filter(x=>!x.ok);if(bad.length)throw Error(bad.map(b=>`#${b.i} ${b.op}: ${b.error}`).join('\n'));return this}
 character(id,o={}){return this.run([{op:'character',id,...o}])}object(o={}){return this.run([{op:'object',...o}])}
 pose(actor,name,o={}){return this.run([{op:'pose',actor,name,...o}])}motion(actor,name,o={}){return this.run([{op:'motion',actor,name,...o}])}
 hand(actor,side,preset,o={}){return this.run([{op:'hand',actor,side,preset,...o}])}camera(o){return this.run([{op:'camera',...o}])}frame(o){return this.run([{op:'frame',...o}])}
 note(at,text,o={}){return this.run([{op:'note',at,text,...o}])}check(){return fullReport(this.p)}inspect(t){return inspect(this.p,t)}bake(o){return bakeProject(this.p,o)}face(actor,target,o={}){return this.run([{op:'face',actor,target,...o}])}reach(actor,limb,target,o={}){return this.run([{op:'reach',actor,limb,target,...o}])}approach(actor,target,o={}){return this.run([{op:'approach',actor,target,...o}])}prompt(o){return makePrompt(this.p,o)}toJSON(){return this.p}toString(){return stringifyProject(this.p)}}
export function catalog(){return {app:APP_VERSION,schemaVersion:SCHEMA_VERSION,commands:COMMANDS,poses:Object.fromEntries(Object.entries(POSES).map(([k,v])=>[k,v.label])),motions:Object.fromEntries(Object.entries(MOTIONS).map(([k,v])=>[k,{label:v.label,params:v.params}])),handPresets:Object.fromEntries(Object.entries(HAND_PRESETS).map(([k,v])=>[k,v.label])),eases:['smooth','linear','easeIn','easeOut','easeInOut','hold','strike','overshoot','cubic-bezier(x1,y1,x2,y2)'],motionParams:{at:'giây | "end" | "end+0.2" (end = hết lệnh trước của actor đó)',speed:'× thời gian (2 = nhanh gấp đôi)',duration:'giây (ghi đè speed)',distance:'m (walk/run/jump: quãng đường; dodge: độ sâu lách 0.1–0.4)',direction:'độ, so với hướng đang nhìn (walk/run sẽ quay người theo)',height:'m (jump)',side:'L|R (bên ra đòn / hướng né)',note:'chuỗi ghi chú hoặc false'},joints:JOINTS}}


// ================= v0.13 agent helpers: aim, reach (IK), approach, intended contacts, bake to v0.11 =================
function wrapNear(v,ref){return v+Math.round((ref-v)/360)*360}
// Write a joint rotation as keys, keeping Euler angles continuous with the current curve (no ±360° flips).
export function writeRot(p,actor,joint,t,vec,ease='smooth'){let cur=evalLocal(p,actor,t).rot[joint]||[0,0,0];vec.forEach((v,k)=>setKey(p,actor,joint,'xyz'[k],t,+wrapNear(v,cur[k]).toFixed(3),ease))}
export const worldAt=(p,actor,t)=>fk(evalPose(p,actor,t));
// target: [x,z] | [x,y,z] | "ActorId" (hips) | {actor, joint, offset:[x,y,z]}
export function targetPoint(p,target,t){if(Array.isArray(target))return target.length===2?[target[0],1,target[1]]:target.slice();if(typeof target==='string')target={actor:target,joint:'hips'};let w=worldAt(p,target.actor,t);let q=w.pos[target.joint||'hips'];if(!q)throw Error('Không có khớp '+target.joint);return target.offset?q.map((v,i)=>v+target.offset[i]):q.slice()}
// Turn an actor (shortest way) to face a target. Keys: hold at t, facing at t+duration.
export function faceTarget(p,actor,target,t,{duration=.3,ease='easeInOut',offset=0,pivot=true}={}){let l=evalLocal(p,actor,t),q=targetPoint(p,target,t),dx=q[0]-l.pos[0],dz=q[2]-l.pos[2];let yaw=wrapNear(Math.atan2(dx,dz)/R+offset,l.yaw);
 if(pivot&&Math.abs(yaw-l.yaw)>2){let w=worldAt(p,actor,t).pos;for(let s of ['L','R'])if(w[s+'_ankle'][1]<ANK+.03)setKey(p,actor,s+'_foot','contact',t,2)}/* turn on the balls of the planted feet */setKey(p,actor,'$root','yaw',t,+l.yaw.toFixed(3),'smooth');setKey(p,actor,'$root','yaw',t+duration,+yaw.toFixed(3),ease);return {yaw:+yaw.toFixed(2),turn:+(yaw-l.yaw).toFixed(2),end:snap(p,t+duration)}}
const CHAINS={L_foot:['L_hip','L_knee','L_ankle'],R_foot:['R_hip','R_knee','R_ankle'],L_hand:['L_shoulder','L_elbow','L_wrist'],R_hand:['R_shoulder','R_elbow','R_wrist']};
// IK: put a hand (wrist) or foot (ankle) on a world target at time t. stop = metres short of the target (surface contact).
// Legs: knee bends forward; hips lean automatically if the hip would leave its range. hold: also keep the pose until t+hold.
export function reach(p,actor,limb,target,t,{stop=0,ease='smooth',hold=0,lean=true}={}){let ch=CHAINS[limb];if(!ch)throw Error('limb phải là '+Object.keys(CHAINS).join('/'));let leg=limb.endsWith('foot'),side=limb[0];t=snap(p,t);
 let solveAt=tt=>{let l=evalPose(p,actor,tt),w=fk(l),goal=targetPoint(p,target,t),root=w.pos[ch[0]],dir=V3n([goal[0]-root[0],goal[1]-root[1],goal[2]-root[2]]);goal=goal.map((v,i)=>v-dir[i]*stop);
  let pole=leg?QT.rot(w.q.hips,[0,0,1]):QT.rot(w.q.chest,[0,-.6,-1]);let r=solveHinge(w,l,ch[0],ch[1],ch[2],goal,null,pole,leg?1:-1);return {r,goal}};
 let tBack=snap(p,t+hold+.25),hipsBack=(evalLocal(p,actor,tBack).rot.hips||[0,0,0]).slice(),leanZ=0,res,prevOver=Infinity;for(let pass=0;pass<4;pass++){res=solveAt(t);if(!res.r)throw Error('IK không giải được');if(!leg||!lean)break;let hz=res.r[ch[0]][2],lim=jointLimit(ch[0],'z'),over=hz<lim[0]+5?hz-(lim[0]+5):hz>lim[1]-5?hz-(lim[1]-5):0;if(Math.abs(over)<.5||Math.abs(over)>=prevOver-.5||Math.abs(leanZ)>=35)break;prevOver=Math.abs(over);leanZ=Math.max(-35,Math.min(35,leanZ+over));writeRot(p,actor,'hips',t,[...(evalLocal(p,actor,t).rot.hips||[0,0,0]).slice(0,2),leanZ],ease)}
 for(let tt of hold?[t,t+hold]:[t]){if(tt!==t){if(leanZ)writeRot(p,actor,'hips',tt,[...(evalLocal(p,actor,tt).rot.hips||[0,0,0]).slice(0,2),leanZ],'linear')}for(let j of [ch[0],ch[1]])writeRot(p,actor,j,tt,res.r[j],tt===t?ease:'linear')}
 if(leanZ)writeRot(p,actor,'hips',tBack,hipsBack,'easeInOut');/* lean is released after the contact */
 let got=worldAt(p,actor,t).pos[ch[2]],err=Math.hypot(...got.map((v,i)=>v-res.goal[i]));return {reached:err<.02,error:+err.toFixed(3),hipsLean:+leanZ.toFixed(2)}}
const V3n=a=>{let l=Math.hypot(...a)||1;return a.map(v=>v/l)};
// Walk (or run) so the actor ends `distance` m (hips to hips) from the target, then face it.
export function approach(p,actor,target,t0,{distance=.9,run=false,speed,note}={}){let l=evalLocal(p,actor,t0),q=targetPoint(p,target,t0),w=worldAt(p,actor,t0).pos.hips,dx=q[0]-w[0],dz=q[2]-w[2],d=Math.hypot(dx,dz),travel=d-distance;if(travel<.15)return {start:t0,end:t0,travel:0,...faceTarget(p,actor,target,t0)};
 let dir=((Math.atan2(dx,dz)/R-l.yaw)%360+540)%360-180,r=applyMotion(p,actor,run?'run':'walk',t0,{distance:+travel.toFixed(3),direction:+dir.toFixed(2),speed,note});let f=faceTarget(p,actor,target,r.end,{duration:.2});return {...r,travel:+travel.toFixed(3),end:f.end}}
export function allowContact(p,{from,to,actors}){p.intendedContacts=p.intendedContacts||[];p.intendedContacts.push({from:snap(p,from),to:snap(p,to),...(actors?{actors}:{})})}
// Snapshot for agents: world joint positions, facing, contacts and closest approach between characters at time t.
export function inspect(p,t,{joints=['hips','head','chest','L_wrist','R_wrist','L_ankle','R_ankle']}={}){let out={time:t,characters:{}},ws={};for(let c of p.characters){let l=evalPose(p,c.id,t),w=fk(l);ws[c.id]=w;out.characters[c.id]={root:l.pos.map(v=>+v.toFixed(3)),yaw:+l.yaw.toFixed(2),contact:{L:contactValueAt(p,c.id,'L',t),R:contactValueAt(p,c.id,'R',t)},joints:Object.fromEntries(joints.map(j=>[j,w.pos[j].map(v=>+v.toFixed(3))]))}}
 let ids=Object.keys(ws);out.pairs=[];for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){let h=limbHit(ws[ids[a]].pos,ws[ids[b]].pos),A=ws[ids[a]].pos.hips,B=ws[ids[b]].pos.hips;out.pairs.push({a:ids[a],b:ids[b],hipsDistance:+Math.hypot(A[0]-B[0],A[2]-B[2]).toFixed(3),clearance:+h.d.toFixed(3),closest:h.A+' ↔ '+h.B})}return out}
// Bake: evaluate everything (contacts/foot lock, presets, any ease) per frame and simplify to linear keys → plain v0.11 JSON.
function rdp(series,tols){let n=series[0].length,keep=new Uint8Array(n);keep[0]=keep[n-1]=1;let st=[[0,n-1]];while(st.length){let [a,b]=st.pop(),mx=-1,mi=-1;for(let i=a+1;i<b;i++){let d=0;for(let c=0;c<series.length;c++){let s=series[c],v=s[a]+(s[b]-s[a])*(i-a)/(b-a);d=Math.max(d,Math.abs(s[i]-v)/tols[c])}if(d>mx){mx=d;mi=i}}if(mx>1){keep[mi]=1;st.push([a,mi],[mi,b])}}let r=[];for(let i=0;i<n;i++)if(keep[i])r.push(i);return r}
export function bakeProject(input,{tolDeg=.1,tolPos=.0005}={}){let p=migrate(input),fps=p.fps,F=Math.round(p.duration*fps),T=f=>+(f/fps).toFixed(5),tracks=[],unwrap=a=>{for(let i=1;i<a.length;i++)a[i]+=Math.round((a[i-1]-a[i])/360)*360;return a};
 let poses={};for(let c of p.characters){let P=[];for(let f=0;f<=F;f++)P.push(evalPose(p,c.id,f/fps));poses[c.id]=P;
  let add=(joint,axis,vals,rest,tol)=>{if(vals.every(v=>Math.abs(v-rest)<1e-9))return;let idx=vals.every(v=>Math.abs(v-vals[0])<tol)?[0]:rdp([vals],[tol]);tracks.push({actor:c.id,joint,axis,keys:idx.map((i,k)=>k?[T(i),+vals[i].toFixed(4),'linear']:[T(i),+vals[i].toFixed(4)])})};
  ['x','y','z'].forEach((ax,k)=>add('$root',ax,P.map(l=>l.pos[k]),c.position[k],tolPos));add('$root','yaw',unwrap(P.map(l=>l.yaw)),c.yaw||0,tolDeg*.5);
  for(let j of JOINTS)for(let k=0;k<3;k++)add(j,'xyz'[k],unwrap(P.map(l=>(l.rot[j]||[0,0,0])[k])),0,tolDeg)}
 (p.objects||[]).forEach((o,i)=>{let mine=p.tracks.filter(tr=>tr.actor==='@object:'+i);if(!mine.some(isAttachTrack)){for(let tr of mine)tracks.push(clone(tr));return}
  let tfs=[];for(let f=0;f<=F;f++)tfs.push(propTransform(p,i,f/fps));let add=(axis,vals,tol)=>{let idx=vals.every(v=>Math.abs(v-vals[0])<tol)?[0]:rdp([vals],[tol]);tracks.push({actor:'@object:'+i,joint:'$root',axis,keys:idx.map((j,k)=>k?[T(j),+vals[j].toFixed(4),'linear']:[T(j),+vals[j].toFixed(4)])})};
  for(let k=0;k<3;k++){add('p'+'xyz'[k],tfs.map(x=>x.pos[k]),tolPos);add('r'+'xyz'[k],unwrap(tfs.map(x=>x.rotDeg[k])),tolDeg)}for(let tr of mine)if(/^s[xyz]$/.test(tr.axis))tracks.push(clone(tr))});
 let cams=p.cameraKeys?.length?[1,2,3,5,6,7].map(i=>{let ch=cameraChannel(p.cameraKeys,i),a=[];for(let f=0;f<=F;f++)a.push(sample(ch,f/fps));return a}):null,cameraKeys=cams?rdp(cams,[tolDeg,tolDeg,.002,.002,.002,.002]).map(i=>[T(i),...[0,1,2].map(c=>+cams[c][i].toFixed(4)),'linear',...[3,4,5].map(c=>+cams[c][i].toFixed(4))]):[];
 let out={version:'0.3',fps,duration:p.duration,characters:p.characters.map(c=>({id:c.id,...(c.name?{name:c.name}:{}),...(c.desc?{desc:c.desc}:{}),position:c.position,yaw:c.yaw||0,...(c.color?{color:c.color}:{})})),objects:(p.objects||[]).map(o=>clone(o)),tracks,cameraKeys};
 // verify through the plain (contact-free) evaluator
 let maxErr=0;for(let f=0;f<=F;f++)for(let c of p.characters){let a=fk(evalLocal(out,c.id,f/fps)).pos,b=fk(poses[c.id][f]).pos;for(let j in a)maxErr=Math.max(maxErr,Math.hypot(a[j][0]-b[j][0],a[j][1]-b[j][1],a[j][2]-b[j][2]))}
 return {project:out,intendedContacts:p.intendedContacts||[],report:{tracks:tracks.length,keys:tracks.reduce((n,t)=>n+t.keys.length,0),cameraKeys:cameraKeys.length,maxJointError_mm:+(maxErr*1000).toFixed(2),notes:p.notes||[]}}}

// ================= v0.18: ai-brief.json — the scene written for another AI to understand and reproduce =================
const BRIEF_LEVELS={standard:{dt:.1,joints:'body',rotations:false,source:false,label:'Chuẩn: 0.1 s, 21 khớp thân'},detailed:{dt:null,joints:'body',rotations:true,source:false,label:'Chi tiết: mỗi frame, 21 khớp + góc xoay'},max:{dt:null,joints:'all',rotations:true,source:true,label:'Tối đa: mỗi frame, 71 khớp + góc xoay + project gốc'}};
export const briefLevels=()=>Object.fromEntries(Object.entries(BRIEF_LEVELS).map(([k,v])=>[k,v.label]));
const KEY_JOINTS=['hips','chest','head','L_shoulder','R_shoulder','L_elbow','R_elbow','L_wrist','R_wrist','L_hip','R_hip','L_knee','R_knee','L_ankle','R_ankle'];
const PART={'hips→spine':'pelvis','spine→chest':'torso','chest→neck':'upper chest','neck→head':'neck','head→head':'head'};
const partName=seg=>{if(PART[seg])return PART[seg];if(/^[LR]_wrist→[LR]_finger$/.test(seg))return (seg[0]==='L'?'left':'right')+' hand';let m=/^([LR])_(\w+?)→[LR]_(\w+?)(?:\d_\d)?$/.exec(seg);if(!m)return seg;let s=m[1]==='L'?'left':'right',k=m[2]+'→'+m[3].replace(/\d.*$/,'');return `${s} ${({'shoulder→elbow':'upper arm','elbow→wrist':'forearm','hip→knee':'thigh','knee→ankle':'shin','ankle→toe':'foot'})[k]||k}`};
const r3=v=>+v.toFixed(3),r1=v=>+v.toFixed(1),wrapDeg=a=>((a%360)+540)%360-180;
// clip-time of the decisive moment of each library motion (scaled by the real beat length)
const PEAK={punch:.38,kick:.5,swing_sword:.55,dodge:.26,block:.14,counter:1.06,spin:.55,draw_sword:.75,sheathe_sword:.7,sit_down:1,stand_up:1.05,fall:1.1,land:.18,jump:'apex'};
const ATTACK=new Set(['punch','kick','swing_sword','counter']),DEFENSE={dodge:'evade',block:'guard',counter:'evade then strike'};
function facingWords(p,actor,t,yaw){let me=evalLocal(p,actor,t),out=[];for(let c of p.characters){if(c.id===actor)continue;let o=evalLocal(p,c.id,t),d=Math.atan2(o.pos[0]-me.pos[0],o.pos[2]-me.pos[2])*180/Math.PI,diff=Math.abs(wrapDeg(d-yaw));out.push(diff<30?`faces ${c.id}`:diff>150?`back to ${c.id}`:`${c.id} is on his ${wrapDeg(d-yaw)>0?'left':'right'} (${Math.round(diff)}°)`)}return out.join(', ')||`facing ${Math.round(yaw)}°`}
export function makeAiBrief(input,{level='detailed'}={}){const L=BRIEF_LEVELS[level]||BRIEF_LEVELS.detailed,p=migrate(input),fps=p.fps,dt=L.dt||1/fps,N=Math.floor(p.duration/dt+1e-9),T=i=>r3(i*dt);
 const W=(id,t)=>{let l=evalPose(p,id,t);return {l,w:fk(l)}};
 const jointsOf=L.joints==='all'?JOINTS:BODY_JOINTS;
 const issues=checkMotion(p),rep=fullReport(p);
 // cast & props
 const cast=p.characters.map(c=>{let {l}=W(c.id,0);return {id:c.id,...(c.name?{name:c.name}:{}),...(c.desc?{desc:c.desc}:{}),color:c.color,heightM:1.88,start:{position:l.pos.map(r3),facingDeg:r1(l.yaw),facing:facingWords(p,c.id,0,l.yaw)}}});
 const propTrack=(i,ax)=>p.tracks.find(t=>t.actor==='@object:'+i&&t.axis===ax);
 const props=(p.objects||[]).map((o,i)=>{let tr=p.tracks.filter(t=>t.actor==='@object:'+i&&t.keys.length>1&&!isAttachTrack(t)&&varies(t)),anim=null;if(tr.length){let ts=tr.flatMap(t=>t.keys.map(k=>k[0]));anim={from:r3(Math.min(...ts)),to:r3(Math.max(...ts)),changes:[...new Set(tr.map(t=>({p:'position',r:'rotation',s:'size'})[t.axis[0]]))]}}
  let holds=propHolds(p,i);return {index:i,name:objectName(o,i),...(o.desc?{desc:o.desc}:{}),...(holds.length?{holds:holds.map(h=>({from:h.from,to:h.to,by:h.by,part:h.joint}))}:{}),shape:'box',...(()=>{let t0=propTransform(p,i,0);return {sizeM:t0.size.map(r3),position:t0.pos.map(r3),rotationDeg:t0.rotDeg.map(r1)}})(),color:o.color,...(anim?{animated:anim}:{})}});
 // camera
 const cams=(p.cameraKeys?.length?p.cameraKeys:[[0,...DEFAULT_CAMERA.slice(0,3),'smooth',...DEFAULT_CAMERA.slice(3)]]).map((k,i,a)=>{let tgt=[k[5]??0,k[6]??1,k[7]??0],A=k[1]*Math.PI/180,E=k[2]*Math.PI/180,pos=[tgt[0]+Math.sin(A)*Math.cos(E)*k[3],tgt[1]+Math.sin(E)*k[3],tgt[2]+Math.cos(A)*Math.cos(E)*k[3]],prev=a[i-1],move='static';
  if(prev){let da=k[1]-prev[1],dd=k[3]-prev[3];move=[Math.abs(da)>5?`orbit ${da>0?'left':'right'} ${Math.abs(Math.round(da))}°`:'',dd<-.4?'push in':dd>.4?'pull out':''].filter(Boolean).join(' + ')||'hold'}
  return {t:r3(k[0]),shot:shot(k[3]),angle:angle(k[2]),side:side(k[1]),move,ease:k[4]||'smooth',azimuthDeg:r1(k[1]),elevationDeg:r1(k[2]),distanceM:r3(k[3]),target:tgt.map(r3),position:pos.map(r3)}});
 // contacts between bodies (from the motion check)
 const contacts=issues.filter(i=>i.code==='INTENDED_CONTACT'||i.code==='LIMB_COLLISION').map(i=>{let [x,y]=String(i.joint).split(' ↔ ');return {from:i.from,to:i.to,a:{actor:i.actor,part:partName(x)},b:{actor:i.other,part:partName(y)},depthM:r3(i.peak),intended:i.code==='INTENDED_CONTACT'}});
 // planted feet
 const feet={};for(let c of p.characters){feet[c.id]={};for(let s of ['L','R']){let tr=p.tracks.find(t=>t.actor===c.id&&t.joint===s+'_foot'&&t.axis==='contact'),iv=[];if(tr){let on=null;for(let i=0;i<=Math.round(p.duration*fps);i++){let t=i/fps,st=contactAt(tr.keys,t);if(st?.on&&on==null)on=t;if(!st?.on&&on!=null){iv.push([r3(on),r3(t)]);on=null}}if(on!=null)iv.push([r3(on),r3(p.duration)])}feet[c.id][s==='L'?'left':'right']=iv}}
 // beats (from timeline notes; library motions get a decisive "peak" pose and a result)
 const beats=(p.notes||[]).slice().sort((a,b)=>a.t-b.t).map(n=>{let from=r3(n.t),to=r3(n.until??n.t),b={from,to,...(n.actor?{actor:n.actor}:{}),...(n.motion?{action:n.motion}:{}),text:n.text};if(!n.actor)return b;
  let times=[['start',from]];if(n.motion&&PEAK[n.motion]!=null&&to>from){let pk;if(PEAK[n.motion]==='apex'){let best=-1;for(let t=from;t<=to;t+=1/fps){let y=evalLocal(p,n.actor,t).pos[1];if(y>best){best=y;pk=t}}}else{let m=MOTIONS[n.motion],d=m?m.make({},{groundUp:()=>0}).duration:to-from;pk=from+(to-from)*Math.min(1,PEAK[n.motion]/d)}times.push(['peak',r3(pk)])}if(to>from)times.push(['end',to]);
  let tPeak=(times.find(x=>x[0]==='peak')||times.at(-1))[1],others=p.characters.filter(c=>c.id!==n.actor).map(c=>{let a=fk(evalPose(p,n.actor,tPeak)).pos.hips,o=fk(evalPose(p,c.id,tPeak)).pos.hips;return {id:c.id,d:Math.hypot(a[0]-o[0],a[2]-o[2])}}).sort((x,y)=>x.d-y.d);
  if(others.length)b.target=others[0].id;
  b.keyPoses=times.map(([label,t])=>{let {l,w}=W(n.actor,t);let kp={label,t,root:l.pos.map(r3),facingDeg:r1(l.yaw),facing:facingWords(p,n.actor,t,l.yaw),joints:Object.fromEntries(KEY_JOINTS.map(j=>[j,w.pos[j].map(r3)])),distanceToM:Object.fromEntries(p.characters.filter(c=>c.id!==n.actor).map(c=>{let o=fk(evalPose(p,c.id,t)).pos.hips;return [c.id,r3(Math.hypot(w.pos.hips[0]-o[0],w.pos.hips[2]-o[2]))]}))};return kp});
  if(n.motion&&ATTACK.has(n.motion)&&b.target){let def=(p.notes||[]).find(o=>o.actor===b.target&&o.motion&&['block','dodge'].includes(o.motion)&&o.t<=tPeak+1e-6&&(o.until??o.t)>=tPeak-1e-6);
   // closest approach of the two bodies around the decisive moment: < 3 cm counts as contact
   // striking limb = the hand / foot moving fastest at the decisive moment; impact = the defender part it reaches
   let sp=j=>{let a=fk(evalPose(p,n.actor,tPeak-1/fps)).pos[j],c=fk(evalPose(p,n.actor,tPeak+1/fps)).pos[j];return Math.hypot(a[0]-c[0],a[1]-c[1],a[2]-c[2])};
   let limb=['L_wrist','R_wrist','L_ankle','R_ankle'].sort((x,y)=>sp(y)-sp(x))[0],strike=limb.endsWith('wrist')?[limb,limb[0]+'_finger2_0']:[limb,limb[0]+'_toe2_0'];b.strikingLimb=limb;
   let partMin={},best={d:9};for(let t=Math.max(from,tPeak-.12);t<=Math.min(to,tPeak+.18)+1e-9;t+=1/fps){let A=fk(evalPose(p,n.actor,t)).pos,B=fk(evalPose(p,b.target,t)).pos;for(let [p1,q1,r1] of SEG){let d=segDist(A[strike[0]],A[strike[1]],B[p1],B[q1])-r1-.045,key=p1+'→'+q1;if(!(key in partMin)||d<partMin[key])partMin[key]=d;if(d<best.d)best={d,t,A:strike[0]+'→'+strike[1].replace(/finger2_0/,'finger').replace(/toe2_0/,'toe2_0'),B:key}}}
   b.closestApproachM=r3(Math.max(0,best.d));
   let planned=(p.intendedContacts||[]).some(ic=>ic.from<=tPeak+.2&&ic.to>=tPeak-.2&&(!ic.actors||(ic.actors.includes(n.actor)&&ic.actors.includes(b.target))));b.planned=planned;
   if(best.d<(planned?.05:.01)){let mine=partName(best.A),theirs=partName(best.B),arm=/forearm|upper arm|hand/.test(theirs);b.result=def?.motion==='block'&&arm?'blocked':def?.motion==='dodge'&&arm?'dodged':'hit';b.impact={t:r3(best.t),with:mine,on:`${b.target} ${theirs}`,depthM:r3(Math.max(0,-best.d)),...(b.result==='dodged'?{graze:true}:{})};let also=Object.entries(partMin).filter(([k,d])=>k!==best.B&&d<(planned?.05:.01)&&d-best.d<.03).map(([k])=>`${b.target} ${partName(k)}`);if(also.length)b.impact.alsoTouches=[...new Set(also)]}else b.result=def?.motion==='dodge'?'dodged':'miss';
   if(def)b.defense={actor:def.actor,action:def.motion}}
  else if(n.motion&&DEFENSE[n.motion])b.result=DEFENSE[n.motion];else if(n.motion==='fall')b.result='knocked down';
  return b});
 // dense trajectory
 const traj={dt:+dt.toFixed(6),...(L.dt?{}:{fps,note:'one sample per frame: t[i] = i / fps'}),samples:N+1,t:Array.from({length:N+1},(_,i)=>T(i)),joints:jointsOf,characters:{}};
 for(let c of p.characters){let root=[],pos=Object.fromEntries(jointsOf.map(j=>[j,[]])),rot=L.rotations?Object.fromEntries(jointsOf.map(j=>[j,[]])):null;
  for(let i=0;i<=N;i++){let {l,w}=W(c.id,i*dt);root.push([...l.pos.map(r3),r1(l.yaw)]);for(let j of jointsOf){pos[j].push(w.pos[j].map(r3));if(rot)rot[j].push((l.rot[j]||[0,0,0]).map(r1))}}
  traj.characters[c.id]={root_xyz_yaw:root,worldPosition:pos,...(rot?{localRotationDeg:rot}:{})}}
 let propTraj={};(p.objects||[]).forEach((o,i)=>{let tr=p.tracks.filter(t=>t.actor==='@object:'+i);if(!tr.some(t=>t.keys.length>1||isAttachTrack(t)))return;if(tr.some(isAttachTrack)){let tf=traj.t.map((t,k)=>propTransform(p,i,k*dt));propTraj[objectName(o,i)]={position:tf.map(x=>x.pos.map(r3)),rotationDeg:tf.map(x=>x.rotDeg.map(r1)),sizeM:tf.map(x=>x.size.map(r3)),heldBy:tf.map(x=>x.held?`${x.held.to}:${x.held.joint}`:null)};return}let g=(ax,d)=>{let t=tr.find(x=>x.axis===ax);return t?tt=>sample(t.keys,tt):()=>d};let P=[0,1,2].map(k=>g('p'+'xyz'[k],o.position[k])),Rr=[0,1,2].map(k=>g('r'+'xyz'[k],0)),S=[0,1,2].map(k=>g('s'+'xyz'[k],o.size[k]));
  propTraj[objectName(o,i)]={position:traj.t.map(t=>P.map(f=>r3(f(t)))),rotationDeg:traj.t.map(t=>Rr.map(f=>r1(f(t)))),sizeM:traj.t.map(t=>S.map(f=>r3(f(t))))}});
 if(Object.keys(propTraj).length)traj.props=propTraj;
 const brief={format:'ai-motion-studio/ai-brief',version:1,app:APP_VERSION,detail:{level,description:L.label},
  howToRead:['Units: metres, seconds, degrees. World axes: +Y up, floor at y=0. A character with yaw 0° faces +Z; yaw +90° faces +X.',
   'Characters are 1.88 m mannequins. "root" is the point between the feet on the floor; "hips" is ~0.94 m above it. Joint names: L_ = the character\'s own left.',
   'cast/props: who and what is in the scene (name + desc = how it should look). Each prop is a box of sizeM at position (centre). props[].holds = time ranges when a character holds it (part = joint: R_wrist right hand, L_wrist left hand, chest back, hips hip); after a hold ends the prop is released (it falls / stays where trajectory.props says).',
   'beats: the action timeline. keyPoses give world positions of the main joints at start / peak (decisive moment) / end; result = hit | blocked | miss | dodged | evade | guard | knocked down. strikingLimb = the hand/foot delivering the attack; impact = what it touched first; alsoTouches = other parts touched at the same moment (within 3 cm); graze:true = only brushed the defender\'s arm while dodging.',
   'contacts: body parts touching between characters (intended = planned hit). feetOnGround: time ranges when each foot is planted (no sliding).',
   'camera: shot description plus exact numbers; position = where the camera is, target = what it looks at; vertical FOV 42°.',
   'trajectory: dense motion — for every sample time t[i], worldPosition[joint][i] = [x,y,z]; root_xyz_yaw[i] = root position + facing; localRotationDeg = joint Euler XYZ relative to its parent (rig in motion-schema.json).',
   'Reproduce or describe the motion from trajectory/keyPoses; do not invent extra actions. Timing in seconds is exact.'],
  scene:{durationS:p.duration,fps,floorY:0,characters:p.characters.length,props:(p.objects||[]).length},
  cast,props,camera:{fovVerticalDeg:42,keys:cams},beats,contacts,feetOnGround:feet,
  validation:{errors:rep.summary.errors,warnings:rep.summary.warnings,issues:[...rep.validation.errors,...rep.validation.warnings,...rep.motion.filter(i=>i.code!=='INTENDED_CONTACT').map(i=>`${i.from}–${i.to}s ${i.message}`)]},
  trajectory:traj};
 if(L.source)brief.sourceProject=p;
 return brief}
// Readable but compact: one line per joint series / list item
export function stringifyBrief(b){return JSON.stringify(b,(k,v)=>v,1).replace(/\[\s+([-\d.,\s"a-zA-Z_]+?)\s+\]/g,(m,inner)=>'['+inner.replace(/\s+/g,'')+']').replace(/\[\s*\n\s*(\[[^\[\]]*\](?:,\s*\n\s*\[[^\[\]]*\])*)\s*\n\s*\]/g,(m,inner)=>'['+inner.replace(/\s*\n\s*/g,'')+']')}

// ================= v0.19: grab / release / drop props =================
const varies=t=>{let v=t.keys.map(k=>k[1]).filter(Number.isFinite);return v.length>1&&Math.max(...v)-Math.min(...v)>1e-6};
export const HOLD_JOINTS={R_wrist:'tay phải',L_wrist:'tay trái',chest:'lưng / ngực',hips:'hông',head:'đầu'};
const QL=QT;
function propIndex(p,ref){if(Number.isInteger(ref))return ref;let i=(p.objects||[]).findIndex((o,k)=>objectName(o,k)===ref);if(i<0)throw Error('Không tìm thấy vật thể '+ref);return i}
// Attach prop i to a character joint at time t, keeping its current world pose (the grip = where you placed it).
export function grabObject(p,i,actor,joint,t,{handPreset='auto'}={}){i=propIndex(p,i);t=snap(p,t);if(!p.characters.some(c=>c.id===actor))throw Error('Không có nhân vật '+actor);if(!JOINTS.includes(joint))throw Error('Khớp cầm không hợp lệ '+joint);
 let tf=propTransform(p,i,t),w=fk(evalPose(p,actor,t)),jp=w.pos[joint],jq=w.q[joint],inv=QL.inv(jq),d=[tf.pos[0]-jp[0],tf.pos[1]-jp[1],tf.pos[2]-jp[2]];
 let offset=QL.rot(inv,d).map(v=>+v.toFixed(4)),rot=QL.toEuler(QL.mul(inv,tf.q)).map(v=>+(v/R).toFixed(2));
 setKey(p,'@object:'+i,'$root','attach',t,{to:actor,joint,offset,rot});
 if(handPreset&&/_wrist$/.test(joint))applyHand(p,actor,joint[0],handPreset==='auto'?'sword':handPreset,t);
 return {offset,rot,distanceM:+Math.hypot(...d).toFixed(3)}}
// Release at time t: the prop stays exactly where it left the hand (keys px..rz written at t); animate the fall yourself or use dropObject.
export function releaseObject(p,i,t,{handPreset='auto'}={}){i=propIndex(p,i);t=snap(p,t);let held=attachAt(p,i,t);if(!held)throw Error('Vật thể đang không được cầm');let tf=propTransform(p,i,t);
 setKey(p,'@object:'+i,'$root','attach',t,null);let a='@object:'+i,cur=evalAxis=>{let tr=findTrack(p,a,'$root',evalAxis);return tr?sample(tr.keys,t):null};
 for(let k=0;k<3;k++){setKey(p,a,'$root','p'+'xyz'[k],t,+tf.pos[k].toFixed(4),'smooth');let c=cur('r'+'xyz'[k]),v=tf.rotDeg[k];if(c!=null)v+=Math.round((c-v)/360)*360;setKey(p,a,'$root','r'+'xyz'[k],t,+v.toFixed(2),'smooth')}
 if(handPreset&&/_wrist$/.test(held.joint))applyHand(p,held.to,held.joint[0],handPreset==='auto'?'open':handPreset,t);
 return {t,position:tf.pos.map(v=>+v.toFixed(3)),from:held}}
// Release + a physically plausible fall to the floor (gravity, small bounce, lands flat on its widest face). Edit the keys afterwards.
export function dropObject(p,i,t,{bounce=true}={}){i=propIndex(p,i);t=snap(p,t);let dt=1/p.fps,before=propTransform(p,i,Math.max(0,t-dt)),tf=propTransform(p,i,t);let rel=releaseObject(p,i,t);
 let size=tf.size,vAx=[0,1,2].reduce((m,k)=>size[k]<size[m]?k:m,0),rest=size[vAx]/2,base=vAx===1?[0,0,0,1]:vAx===0?QL.euler(0,0,Math.PI/2):QL.euler(-Math.PI/2,0,0);
 let L=[0,1,2].reduce((m,k)=>size[k]>size[m]?k:m,0),ax=[0,0,0];ax[L]=1;let now=QL.rot(tf.q,ax),d0=QL.rot(base,ax),yaw=Math.atan2(now[0],now[2])-Math.atan2(d0[0],d0[2]);if(Math.hypot(now[0],now[2])<1e-3)yaw=0;
 let qEnd=QL.mul(QL.euler(0,yaw,0),base),eEnd=QL.toEuler(qEnd).map(v=>v/R);
 let h=Math.max(.02,tf.pos[1]-rest),T=Math.max(.12,Math.sqrt(2*h/9.8)),vx=(tf.pos[0]-before.pos[0])/dt,vz=(tf.pos[2]-before.pos[2])/dt,sp=Math.hypot(vx,vz),k=sp>1e-6?Math.min(1.2,sp*T*.6)/sp:0,land=[tf.pos[0]+vx*k,rest,tf.pos[2]+vz*k],a='@object:'+i,t1=t+T;
 const GRAV='cubic-bezier(0.333,0,0.667,0.333)';
 setKey(p,a,'$root','px',t1,+land[0].toFixed(4),'linear');setKey(p,a,'$root','pz',t1,+land[2].toFixed(4),'linear');setKey(p,a,'$root','py',t1,+rest.toFixed(4),GRAV);
 for(let k=0;k<3;k++){let tr=findTrack(p,a,'$root','r'+'xyz'[k]),c=sample(tr.keys,t),v=eEnd[k];v+=Math.round((c-v)/360)*360;setKey(p,a,'$root','r'+'xyz'[k],t1,+v.toFixed(2),'easeIn')}
 if(bounce&&h>.15){let up=Math.min(.06,h*.08);setKey(p,a,'$root','py',t1+.12,+(rest+up).toFixed(4),'easeOut');setKey(p,a,'$root','py',t1+.24,+rest.toFixed(4),'easeIn');let sx=vx*k*.08,sz=vz*k*.08;setKey(p,a,'$root','px',t1+.24,+(land[0]+sx).toFixed(4),'easeOut');setKey(p,a,'$root','pz',t1+.24,+(land[2]+sz).toFixed(4),'easeOut')}
 if(t1+.3>p.duration)p.duration=Math.min(600,Math.ceil(t1+.3));
 return {...rel,landAt:+(t1).toFixed(3),landing:[land[0],rest,land[2]].map(v=>+v.toFixed(3))}}
// Hold intervals of prop i: [{from,to,by,joint}]
export function propHolds(p,i){let tr=p.tracks.find(x=>x.actor==='@object:'+i&&x.axis==='attach');if(!tr)return [];let out=[],cur=null;for(let k of tr.keys){if(cur){cur.to=k[0];out.push(cur);cur=null}if(k[1]&&k[1].to)cur={from:k[0],by:k[1].to,joint:k[1].joint}}if(cur){cur.to=p.duration;out.push(cur)}return out.map(h=>({...h,from:+h.from.toFixed(3),to:+h.to.toFixed(3),part:HOLD_JOINTS[h.joint]||h.joint}))}

// Snap the active grip: the prop's longest side runs across the fist (joint local +X), handle end in the palm.
export function snapToHand(p,i,t){i=propIndex(p,i);let held=attachAt(p,i,t);if(!held)throw Error('Vật thể đang không được cầm');let tf=propTransform(p,i,t),size=tf.size,L=[0,1,2].reduce((m,k)=>size[k]>size[m]?k:m,0);
 let rot=L===0?[0,0,0]:L===1?[0,0,-90]:[0,90,0],len=size[L],grip=/_wrist$/.test(held.joint)?[0,-.085,.012]:[0,0,.12],offset=[grip[0]+Math.max(0,len/2-.09),grip[1],grip[2]].map(v=>+v.toFixed(4));
 let tr=p.tracks.find(x=>x.actor==='@object:'+i&&x.axis==='attach'),k=tr.keys.find(k=>Math.abs(k[0]-held.from)<1e-9);k[1]={...k[1],offset,rot};return {offset,rot}}

// ================= v0.20: personal library — poses + clips reused across projects =================
// File/localStorage shape: {type:'ams-my-library',version:1,poses:{name:{label,joints,hands?}},motions:{name:clip}}
const sameJSON=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function newLibrary(){return {type:'ams-my-library',version:1,poses:{},motions:{}}}
export function normLibrary(x){if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Không phải file thư viện');if(x.characters||x.tracks)throw Error('Đây là file cảnh (project), không phải thư viện');let L=newLibrary(),n=0;
 for(let [k,v] of Object.entries(x.poses||{}))if(v&&typeof v.joints==='object'){L.poses[k]={...v,label:v.label||k};n++}
 for(let [k,v] of Object.entries(x.motions||{}))if(Number.isFinite(v?.duration)&&v.duration>0&&v.channels&&typeof v.channels==='object'){L.motions[k]={...v,label:v.label||k};n++}
 if(!n&&(x.poses||x.motions)===undefined)throw Error('Không phải file thư viện');return L}
// Put an item under a free name (never shadows a built-in; same content = same name). Returns the name used.
export function libPut(lib,kind,name,item){let builtIn=kind==='poses'?POSES:MOTIONS,base=String(name||'').trim()||(kind==='poses'?'Tư thế':'Đòn'),n=base,i=2,body=it=>({...it,label:undefined});
 while(builtIn[n]||(lib[kind][n]&&!sameJSON(body(lib[kind][n]),body(item))))n=`${base} (${i++})`;lib[kind][n]={...clone(item),label:n};return n}
export function mergeLibrary(dst,src){let L=normLibrary(src),added=0,same=0;for(let kind of ['poses','motions'])for(let [k,v] of Object.entries(L[kind])){let had=Object.keys(dst[kind]).length,n=libPut(dst,kind,k,v);Object.keys(dst[kind]).length>had?added++:same++}return {added,same}}
// Snapshot a character's pose at t. rot (optional) = what the editor shows, {joint:[x,y,z]} in degrees.
export function capturePose(p,actor,t,{rot,label}={}){let l=evalLocal(p,actor,t);if(!l)throw Error('Không có nhân vật: '+actor);rot=rot||l.rot;let joints={},hands={},put=j=>{let v=rot[j]||[0,0,0];if(v.some(x=>Math.abs(x)>1e-3))joints[j]=v.map(x=>+(+x).toFixed(2))};
 for(let j of BODY_JOINTS)put(j);
 for(let s of ['L','R']){let fj=fingerJoints(s),explicit=p.tracks.some(tr=>tr.actor===actor&&fj.includes(tr.joint));if(explicit)fj.forEach(put);else hands[s]=presetAt(p,actor,s,t)||'open'}
 return {label:label||'Tư thế',joints,...(Object.keys(hands).length?{hands}:{})}}
// Copy a personal clip into the project library (so the exported JSON is self-contained). Returns the project key.
export function useLibMotion(p,clip,name){p.library=p.library||{};p.library.motions=p.library.motions||{};let m=p.library.motions,base=String(name).trim(),n=base,i=2,body=c=>({...c,label:undefined});
 while(MOTIONS[n]||(m[n]&&!sameJSON(body(m[n]),body(clip))))n=`${base} (${i++})`;if(!m[n])m[n]={...clone(clip),label:n};return n}
