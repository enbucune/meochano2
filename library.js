// AI Motion Studio library: poses, motion clips, timeline ops, notes, prompt, agent API.
// Pure data functions on the project JSON. Used by the UI (engine.js), the CLI and AI agents alike.
import {objectName,ANKLE_HEIGHT as ANK,evalPose,solveTwoBone,solveHinge,jointLimit,cameraChannel,checkMotion,limbHit,Q as QT,APP_VERSION,SCHEMA_VERSION,JOINTS,BODY_JOINTS,HAND_PRESETS,presetAngles,fingerJoints,isPresetTrack,isContactTrack,sample,migrate,validate,optimize,fullReport,stringifyProject,evalLocal,fk,lowestPoint,contactAt,DEFAULT_CAMERA} from './core.js?v=0.16';

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
 if(!tr){tr={actor,joint,axis,keys:[]};p.tracks.push(tr);if(frameOf(p,t)>0){let base=restOf(p,actor,joint,axis),prior=sceneKeyTimes(p).filter(k=>frameOf(p,k)<frameOf(p,t)).at(-1)||0;tr.keys.push([0,base,'hold']);if(frameOf(p,prior)>0)tr.keys.push([prior,base,'hold'])}}
 tr.keys=tr.keys.filter(k=>frameOf(p,k[0])!==frameOf(p,t));let key=[t,v];if(ease&&axis!=='contact')key.push(ease);tr.keys.push(key);tr.keys.sort((a,b)=>a[0]-b[0]);if(t>p.duration)p.duration=Math.min(600,Math.ceil(t));return tr}
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
export function applyMotion(p,actor,name,t0,opts={}){let ctx={groundUp:pose=>{let l=evalLocal(p,actor,t0);let w=fk({pos:[0,0,0],yaw:0,rot:pose});return -lowestPoint(w)-l.pos[1]}};
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
 L.push('','CHARACTERS:');for(let c of p.characters){let l=evalLocal(p,c.id,0);L.push(`- ${c.id} (${c.color||'mannequin'}): starts at x=${l.pos[0].toFixed(2)}, z=${l.pos[2].toFixed(2)}, facing ${Math.round(l.yaw)}°.`)}
 if(p.objects?.length){L.push('','PROPS / SET (each box in the reference is one of these objects):');p.objects.forEach((o,i)=>{let tr=p.tracks.filter(t=>t.actor==='@object:'+i&&t.keys.length>1),mv='';if(tr.length){let ts=tr.flatMap(t=>t.keys.map(k=>k[0])),what=[...new Set(tr.map(t=>({p:'moves',r:'rotates',s:'changes size'})[t.axis[0]]))].join(', ');mv=` — ${what} between ${Math.min(...ts).toFixed(1)}s and ${Math.max(...ts).toFixed(1)}s`}
  L.push(`- "${objectName(o,i)}"${o.desc?`: ${o.desc}`:''} (box ${o.size.map(v=>+(+v).toFixed(2)).join('×')} m at x=${(+o.position[0]).toFixed(2)}, z=${(+o.position[2]).toFixed(2)})${mv}`)})}
 L.push('','CAMERA:');cam.forEach((k,i)=>{let prev=cam[i-1],move='';if(prev){let da=k[1]-prev[1],dd=k[3]-prev[3];move=[Math.abs(da)>5?`orbit ${da>0?'left':'right'} ${Math.abs(Math.round(da))}°`:'',dd<-.4?'push in':dd>.4?'pull out':''].filter(Boolean).join(', ')||'hold'}L.push(`- ${k[0].toFixed(1)}s: ${shot(k[3])}, ${angle(k[2])}, ${side(k[1])}${move?` (${move}, ${k[4]||'smooth'})`:''}`)});
 L.push('','ACTION BEATS:');let notes=(p.notes||[]).slice().sort((a,b)=>a.t-b.t);if(notes.length)for(let n of notes)L.push(`- ${n.t.toFixed(1)}${n.until!==undefined?'–'+n.until.toFixed(1):''}s: ${n.text}`);else L.push('- (no notes — describe the action here)');
 L.push('','RENDER:',`- Replace mannequins with the final characters; keep exact poses, contact with the ground and timing.${style?' Style: '+style+'.':''}`,'- No extra cuts, no extra characters, no text overlays.');return L.join('\n')}

// ---------------------------------------------------------------- agent API (same JSON as the UI)
export const COMMANDS=['character','object','duration','fps','pose','joints','motion','hand','key','contact','camera','frame','note','mirror','saveMotion','retime','moveKeys','optimize','face','reach','approach','allowContact'];
export function newProject({fps=30,duration=10}={}){return {schemaVersion:SCHEMA_VERSION,app:APP_VERSION,fps,duration,characters:[],objects:[],tracks:[],cameraKeys:[[0,0,15,5,'smooth',0,1,0]],notes:[]}}
// at: number | "end" | "end+0.2" | "end-0.1" (relative to the end of this actor's previous motion/command).
export function runCommands(input,commands){let p=input?migrate(input):newProject(),ends={},results=[];let at=(c)=>{let a=c.at??0;if(typeof a==='string'){let m=/^end([+-][\d.]+)?$/.exec(a.trim());if(!m)throw Error('at không hợp lệ: '+a);a=(ends[c.actor]??0)+(m[1]?+m[1]:0)}return Math.max(0,+a)};
 commands.forEach((c,i)=>{try{let r=null,t;switch(c.op){
  case 'character':{if(p.characters.some(x=>x.id===c.id))throw Error('Trùng id '+c.id);p.characters.push({id:c.id,position:c.position||[0,0,0],yaw:c.yaw||0,color:c.color||['#65caff','#ff9865','#84ed83','#bf9aff'][p.characters.length%4]});break}
  case 'object':p.objects=p.objects||[];p.objects.push({...(c.id?{id:c.id}:{}),name:(c.name||c.id||`Vật thể ${p.objects.length+1}`),...(c.desc?{desc:c.desc}:{}),position:c.position||[0,.5,0],size:c.size||[1,1,1],color:c.color||'#64748b'});r=p.objects.length-1;break;
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
 for(let tr of p.tracks)if(tr.actor.startsWith('@object:'))tracks.push(clone(tr));
 let cams=p.cameraKeys?.length?[1,2,3,5,6,7].map(i=>{let ch=cameraChannel(p.cameraKeys,i),a=[];for(let f=0;f<=F;f++)a.push(sample(ch,f/fps));return a}):null,cameraKeys=cams?rdp(cams,[tolDeg,tolDeg,.002,.002,.002,.002]).map(i=>[T(i),...[0,1,2].map(c=>+cams[c][i].toFixed(4)),'linear',...[3,4,5].map(c=>+cams[c][i].toFixed(4))]):[];
 let out={version:'0.3',fps,duration:p.duration,characters:p.characters.map(c=>({id:c.id,position:c.position,yaw:c.yaw||0,...(c.color?{color:c.color}:{})})),objects:(p.objects||[]).map(o=>clone(o)),tracks,cameraKeys};
 // verify through the plain (contact-free) evaluator
 let maxErr=0;for(let f=0;f<=F;f++)for(let c of p.characters){let a=fk(evalLocal(out,c.id,f/fps)).pos,b=fk(poses[c.id][f]).pos;for(let j in a)maxErr=Math.max(maxErr,Math.hypot(a[j][0]-b[j][0],a[j][1]-b[j][1],a[j][2]-b[j][2]))}
 return {project:out,intendedContacts:p.intendedContacts||[],report:{tracks:tracks.length,keys:tracks.reduce((n,t)=>n+t.keys.length,0),cameraKeys:cameraKeys.length,maxJointError_mm:+(maxErr*1000).toFixed(2),notes:p.notes||[]}}}
