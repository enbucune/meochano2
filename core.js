// AI Motion Studio core: pure data logic (no DOM, no Three.js). Runs in browser and Node.
export const APP_VERSION='0.16';
export const SCHEMA_VERSION=2;
export const EASES=['smooth','linear','easeIn','easeOut','easeInOut','hold','strike','overshoot'];
// Also accepted: "cubic-bezier(x1,y1,x2,y2)" (CSS syntax). Unknown/missing ease = smooth (v0.11 behaviour).
const BEZ=/^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/,bezCache=new Map();
export function bezierEase(str){if(bezCache.has(str))return bezCache.get(str);let m=BEZ.exec(str),f=null;if(m){let [x1,y1,x2,y2]=m.slice(1).map(Number);if(x1>=0&&x1<=1&&x2>=0&&x2<=1){let c=(a,b,s)=>3*a*s*(1-s)*(1-s)+3*b*s*s*(1-s)+s*s*s;f=u=>{if(u<=0)return 0;if(u>=1)return 1;let s=u;for(let i=0;i<8;i++){let x=c(x1,x2,s)-u,d=3*(1-s)*(1-s)*x1+6*(1-s)*s*(x2-x1)+3*s*s*(1-x2);if(Math.abs(x)<1e-7||Math.abs(d)<1e-6)break;s-=x/d}if(!(s>=0&&s<=1)||Math.abs(c(x1,x2,s)-u)>1e-6){let lo=0,hi=1;for(let i=0;i<40;i++){s=(lo+hi)/2;if(c(x1,x2,s)<u)lo=s;else hi=s}}return c(y1,y2,s)}}}bezCache.set(str,f);return f}
export const isEase=e=>e==null||EASES.includes(e)||(typeof e==='string'&&!!bezierEase(e));
export const DEFAULT_CAMERA=[0,15,5,0,1,0]; // [azimuth°, elevation°, distance, targetX, targetY, targetZ]

// ---------- Skeleton (must mirror actor() in engine.js) ----------
export const JOINTS=(()=>{let n=['hips','spine','chest','neck','head'];for(let s of ['L','R']){n.push(s+'_clavicle',s+'_shoulder',s+'_elbow',s+'_forearm',s+'_wrist');for(let f=0;f<5;f++)for(let b=0;b<3;b++)n.push(`${s}_finger${f}_${b}`);n.push(s+'_hip',s+'_knee',s+'_ankle');for(let f=0;f<5;f++)for(let b=0;b<2;b++)n.push(`${s}_toe${f}_${b}`)}return n})();
const JOINT_SET=new Set(JOINTS);
export const fingerJoints=side=>{let r=[];for(let f=0;f<5;f++)for(let b=0;b<3;b++)r.push(`${side}_finger${f}_${b}`);return r};

// Soft anatomical limits in degrees (rig convention: hip/shoulder flex forward = negative X,
// elbow flex = negative X, knee flex = positive X, finger curl = positive X). Warnings only.
const LIMITS=[
 [/^(hips)$/,{x:[-90,90],y:[-180,180],z:[-60,60]}],
 [/^(spine|chest)$/,{x:[-60,60],y:[-60,60],z:[-45,45]}],
 [/^(neck|head)$/,{x:[-70,70],y:[-90,90],z:[-50,50]}],
 [/_clavicle$/,{x:[-30,30],y:[-30,30],z:[-30,30]}],
 [/_shoulder$/,{x:[-190,80],y:[-110,110],z:[-180,180]}],
 [/_elbow$/,{x:[-160,10],y:[-90,90],z:[-20,20]}],
 [/_forearm$/,{x:[-20,20],y:[-100,100],z:[-20,20]}],
 [/_wrist$/,{x:[-90,90],y:[-45,45],z:[-70,70]}],
 [/_finger0_\d$/,{x:[-40,100],y:[-60,60],z:[-60,60]}],
 [/_finger\d_\d$/,{x:[-30,115],y:[-25,25],z:[-30,30]}],
 [/_hip$/,{x:[-140,50],y:[-70,70],z:[-80,80]}],
 [/_knee$/,{x:[-10,160],y:[-20,20],z:[-20,20]}],
 [/_ankle$/,{x:[-60,60],y:[-40,40],z:[-40,40]}],
 [/_toe\d_\d$/,{x:[-70,70],y:[-20,20],z:[-20,20]}],
];
export function jointLimit(joint,axis){for(let [re,l] of LIMITS)if(re.test(joint))return l[axis];return null}

// ---------- Hand presets (degrees per segment, X = curl, Z = thumb opposition) ----------
// Finger index f = 0…4 ordered along the hand (the mannequin has no anatomical thumb; finger0 is the outer finger, given a small extra Z spread). Values: [[x0,x1,x2] per finger…, z0].
const curl=(t,i,m,r,p,tz=0)=>[t,i,m,r,p,tz];
export const HAND_PRESETS={
 open:   {label:'Mở tay',    pose:curl([0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],0)},
 relaxed:{label:'Thả lỏng',  pose:curl([10,12,8],[12,18,12],[15,20,14],[18,22,15],[20,25,16],10)},
 fist:   {label:'Nắm đấm',   pose:curl([35,45,35],[85,95,70],[85,95,70],[85,95,70],[85,95,70],35)},
 sword:  {label:'Cầm kiếm',  pose:curl([30,25,20],[60,70,45],[70,80,55],[75,85,60],[80,90,62],30)},
 point:  {label:'Chỉ tay',   pose:curl([35,45,35],[0,0,0],[85,95,70],[85,95,70],[85,95,70],35)},
};
// Joint-local rotation {joint:{x,y,z}} for a preset, mirrored so both hands curl the same way.
export function presetAngles(name,side){let p=HAND_PRESETS[name];if(!p)return null;let out={};for(let f=0;f<5;f++)for(let b=0;b<3;b++)out[`${side}_finger${f}_${b}`]={x:p.pose[f][b],y:0,z:f===0&&b===0?(side==='L'?-1:1)*p.pose[5]:0};return out}
export const isPresetTrack=t=>t.axis==='preset'&&/^[LR]_hand$/.test(t.joint);
export const isContactTrack=t=>t.axis==='contact'&&/^[LR]_foot$/.test(t.joint);

// ---------- Sampling (identical maths to v0.11) ----------
export function easeValue(u,mode){switch(mode){case 'linear':return u;case 'hold':return u>=1?1:0;case 'easeIn':return u*u*u;case 'easeOut':{let v=1-u;return 1-v*v*v}case 'easeInOut':return u<.5?4*u*u*u:1-Math.pow(2-2*u,3)/2;case 'strike':return Math.pow(u,2.5);case 'overshoot':{let c=1.70158,v=u-1;return 1+(c+1)*v*v*v+c*v*v}}if(typeof mode==='string'&&mode.charCodeAt(0)===99){let f=bezierEase(mode);if(f)return f(u)}return u*u*(3-2*u)}
export function sample(keys,t){let n=keys.length;if(!n)return 0;if(t<=keys[0][0])return keys[0][1];if(t>keys[n-1][0])return keys[n-1][1];
 // first index i with t<=keys[i][0] (same key the v0.11 linear scan picks)
 let lo=1,hi=n-1;while(lo<hi){let m=(lo+hi)>>1;if(t<=keys[m][0])hi=m;else lo=m+1}
 let a=keys[lo-1],b=keys[lo],u=(t-a[0])/(b[0]-a[0]);u=easeValue(u,b[2]);return a[1]+(b[1]-a[1])*u}
// Preset track -> numeric keys per finger joint/axis (cached per keys content).
const presetCache=new WeakMap();
export function presetChannels(track){let c=presetCache.get(track),sig=JSON.stringify(track.keys);if(c&&c.sig===sig)return c.ch;let side=track.joint[0],ch={};for(let j of fingerJoints(side))for(let ax of 'xyz')ch[j+'.'+ax]=[];for(let k of track.keys){let a=presetAngles(k[1],side)||presetAngles('open',side);for(let j in a)for(let ax of 'xyz'){let key=[k[0],a[j][ax]];if(k.length>2)key.push(k[2]);ch[j+'.'+ax].push(key)}}presetCache.set(track,{sig,ch});return ch}
export function cameraChannel(cameraKeys,i){let j=[1,2,3,5,6,7].indexOf(i);return cameraKeys.map(v=>[v[0],v[i]??DEFAULT_CAMERA[j],v[4]])}

// ---------- Migration / backward compatibility ----------
// schemaVersion 1 = every file before v0.12 (field "version" was an unrelated label, e.g. "0.3").
export const objectName=(o,i)=>(typeof o?.name==='string'&&o.name.trim())||(o?.id!=null&&String(o.id).trim())||`Vật thể ${i+1}`;
export function migrate(input){let p=JSON.parse(JSON.stringify(input));if(!p||typeof p!=='object')return p;let from=Number.isInteger(p.schemaVersion)?p.schemaVersion:1;
 if(from<2){if(p.version!==undefined&&p.legacyVersion===undefined)p.legacyVersion=String(p.version);delete p.version}
 p.schemaVersion=Math.max(from,SCHEMA_VERSION);
 if(Array.isArray(p.tracks))for(let t of p.tracks)if(Array.isArray(t.keys))t.keys.sort((a,b)=>a[0]-b[0]);
 if(Array.isArray(p.cameraKeys))p.cameraKeys.sort((a,b)=>a[0]-b[0]);
 // every prop carries a human/AI-readable name (older files: from id, else "Vật thể N")
 if(Array.isArray(p.objects))p.objects.forEach((o,i)=>{if(o&&typeof o==='object'&&!(typeof o.name==='string'&&o.name.trim()))o.name=objectName(o,i)});
 return p}

// ---------- Validator ----------
const fin=Number.isFinite, vec3=v=>Array.isArray(v)&&v.length===3&&v.every(fin);
export function validate(p){let errors=[],warnings=[],E=(m)=>errors.push(m),W=(m)=>warnings.push(m);
 if(!p||typeof p!=='object')return {errors:['JSON không phải object'],warnings};
 if(!fin(p.fps)||p.fps<=0)E('fps phải là số > 0');else if(p.fps>120)W(`fps=${p.fps} quá cao (khuyên ≤ 60)`);
 if(!fin(p.duration)||p.duration<=0)E('duration phải là số giây > 0');else if(p.duration>600)W('duration > 600s');
 if(!Array.isArray(p.characters))E('characters phải là mảng');
 if(!Array.isArray(p.tracks))E('tracks phải là mảng');
 if(p.objects!==undefined&&!Array.isArray(p.objects))E('objects phải là mảng');
 if(errors.length)return {errors,warnings};
 let ids=new Set(),dur=p.duration,frame=t=>Math.round(t*p.fps);
 p.characters.forEach((c,i)=>{let n=`characters[${i}]`;if(typeof c?.id!=='string'||!c.id)E(n+': thiếu id');else if(ids.has(c.id))E(n+`: trùng id "${c.id}"`);else ids.add(c.id);
  if(!vec3(c?.position))E(n+': position phải là [x,y,z]');else{if(Math.abs(c.position[0])>20||Math.abs(c.position[2])>20)W(n+': đứng quá xa tâm (>20m)');if(c.position[1]<-0.5||c.position[1]>10)W(n+': độ cao bất thường')}
  if(c?.yaw!==undefined&&!fin(c.yaw))E(n+': yaw phải là số');if(c?.color!==undefined&&typeof c.color!=='string')W(n+': color nên là chuỗi #rrggbb')});
 (p.objects||[]).forEach((o,i)=>{let n=`objects[${i}]`;if(!vec3(o?.position))E(n+': position phải là [x,y,z]');if(!vec3(o?.size))E(n+': size phải là [x,y,z]');else if(o.size.some(s=>s<=0))W(n+': size có cạnh ≤ 0');else if(o.size.some(s=>s>50))W(n+': kích thước > 50m');if(o?.name!==undefined&&(typeof o.name!=='string'||!o.name.trim()))W(n+': name nên là chuỗi khác rỗng');if(o?.desc!==undefined&&typeof o.desc!=='string')W(n+': desc nên là chuỗi')});
 {let seen=new Map();(p.objects||[]).forEach((o,i)=>{let k=typeof o?.name==='string'?o.name.trim().toLowerCase():'';if(!k)return;if(seen.has(k))W(`objects[${i}]: trùng tên "${o.name}" với objects[${seen.get(k)}] — AI sẽ khó phân biệt`);else seen.set(k,i)})}
 let checkKeys=(keys,n,valueCheck)=>{if(!Array.isArray(keys)||!keys.length){E(n+': keys rỗng');return}let prev=-Infinity,frames=new Set();keys.forEach((k,j)=>{let kn=`${n}.keys[${j}]`;if(!Array.isArray(k)||k.length<2){E(kn+': phải là [t, value, ease?]');return}if(!fin(k[0])){E(kn+': thời gian không hợp lệ');return}if(k[0]<0)E(kn+': thời gian âm');if(k[0]>dur+1e-9)W(kn+`: t=${k[0]}s vượt duration ${dur}s`);if(k[0]<prev)E(kn+': keys chưa sắp xếp theo thời gian');if(k[0]===prev)E(kn+': trùng thời gian (gây NaN khi nội suy)');else if(frames.has(frame(k[0])))W(kn+': hai key cùng một frame');prev=k[0];frames.add(frame(k[0]));if(k.length>2&&!isEase(k[2]))W(kn+`: ease "${k[2]}" không hợp lệ (dùng ${EASES.join('/')} hoặc cubic-bezier(x1,y1,x2,y2))`);valueCheck(k[1],kn)})};
 let seen=new Set();
 p.tracks.forEach((t,i)=>{let n=`tracks[${i}]`;if(!t||typeof t!=='object'){E(n+': không phải object');return}let label=`${n} ${t.actor}/${t.joint}/${t.axis}`,sig=t.actor+'|'+t.joint+'|'+t.axis;if(seen.has(sig))W(label+': track trùng lặp, track sau sẽ ghi đè');seen.add(sig);
  let obj=/^@object:(\d+)$/.exec(t.actor||'');
  if(obj){let oi=+obj[1];if(!p.objects?.[oi])E(label+': vật thể không tồn tại');if(t.joint!=='$root')E(label+': vật thể chỉ có joint "$root"');if(!/^[prs][xyz]$/.test(t.axis))E(label+': axis vật thể phải là px..sz');
   checkKeys(t.keys,label,(v,kn)=>{if(!fin(v)){E(kn+': giá trị không phải số');return}if(t.axis[0]==='s'&&v<=0)W(kn+': scale ≤ 0');if(t.axis[0]==='p'&&Math.abs(v)>50)W(kn+': vị trí > 50m')});return}
  if(!ids.has(t.actor)){E(label+': nhân vật không tồn tại');return}
  if(isContactTrack(t)){checkKeys(t.keys,label,(v,kn)=>{if(v!==0&&v!==1&&v!==2)E(kn+': contact chỉ nhận 0 (nhấc), 1 (chạm đất), 2 (xoay trên mũi chân)')});return}
  if(isPresetTrack(t)){checkKeys(t.keys,label,(v,kn)=>{if(!HAND_PRESETS[v])E(kn+`: preset "${v}" không có (${Object.keys(HAND_PRESETS).join('/')})`)});return}
  if(t.joint==='$root'){if(!['x','y','z','yaw'].includes(t.axis))E(label+': axis $root phải là x/y/z/yaw');checkKeys(t.keys,label,(v,kn)=>{if(!fin(v)){E(kn+': giá trị không phải số');return}if(t.axis==='y'&&(v<-1||v>10))W(kn+`: độ cao ${v}m bất thường`);if((t.axis==='x'||t.axis==='z')&&Math.abs(v)>20)W(kn+`: vị trí ${v}m quá xa`);if(t.axis==='yaw'&&Math.abs(v)>1080)W(kn+': yaw vượt ±1080°')});return}
  if(!JOINT_SET.has(t.joint)){E(label+': khớp không tồn tại');return}
  if(!['x','y','z'].includes(t.axis)){E(label+': axis khớp phải là x/y/z');return}
  let lim=jointLimit(t.joint,t.axis),worst=null;
  checkKeys(t.keys,label,(v,kn)=>{if(!fin(v)){E(kn+': giá trị không phải số');return}if(lim&&(v<lim[0]||v>lim[1])&&(!worst||Math.abs(v)>Math.abs(worst[0])))worst=[v,kn]});
  if(worst)W(`${worst[1]}: ${worst[0]}° ngoài giới hạn khớp [${lim[0]}, ${lim[1]}]`)});
 if(p.cameraKeys!==undefined){if(!Array.isArray(p.cameraKeys))E('cameraKeys phải là mảng');else{let prev=-Infinity;p.cameraKeys.forEach((k,j)=>{let n=`cameraKeys[${j}]`;if(!Array.isArray(k)||k.length<4||![0,1,2,3].every(i=>fin(k[i]))){E(n+': phải là [t, azimuth, elevation, distance, ease?, tx, ty, tz]');return}if(k[0]<0)E(n+': thời gian âm');if(k[0]>dur+1e-9)W(n+`: t=${k[0]}s vượt duration`);if(k[0]===prev)E(n+': trùng thời gian');prev=k[0];if(!isEase(k[4]))W(n+`: ease "${k[4]}" không hợp lệ`);if(Math.abs(k[2])>=90)W(n+': elevation phải trong (-90, 90)');if(k[3]<=0||k[3]>80)W(n+': distance nên trong (0, 80]');for(let i=5;i<8;i++)if(k[i]!==undefined&&(!fin(k[i])||Math.abs(k[i])>50))W(n+': target bất thường')})}}
 if(p.notes!==undefined){if(!Array.isArray(p.notes))E('notes phải là mảng');else p.notes.forEach((n,i)=>{if(!fin(n?.t)||typeof n?.text!=='string')E(`notes[${i}]: cần {t, text}`);else if(n.until!==undefined&&(!fin(n.until)||n.until<n.t))W(`notes[${i}]: until phải ≥ t`)})}
 if(p.intendedContacts!==undefined&&(!Array.isArray(p.intendedContacts)||p.intendedContacts.some(c=>!fin(c?.from)||!fin(c?.to))))E('intendedContacts phải là [{from,to,actors?}]');
 if(p.library?.motions)for(let [k,m] of Object.entries(p.library.motions))if(!fin(m?.duration)||typeof m?.channels!=='object')E(`library.motions.${k}: cần {duration, channels}`);
 return {errors,warnings}}

// ---------- Lossless optimizer ----------
function restValue(p,t){let obj=/^@object:(\d+)$/.exec(t.actor);if(obj){let o=p.objects?.[+obj[1]];if(!o)return null;let i='xyz'.indexOf(t.axis[1]);return t.axis[0]==='p'?o.position[i]:t.axis[0]==='s'?o.size[i]:0}let c=p.characters.find(c=>c.id===t.actor);if(!c)return null;if(t.joint==='$root')return t.axis==='yaw'?(c.yaw||0):c.position['xyz'.indexOf(t.axis)];return 0}
// Removable middle key: merged segment must equal both originals exactly.
// Only bit-exact removals: a key inside a run of equal values (any ease) is invisible.
// Collinear linear keys are deliberately kept: merging them can differ by 1 ulp.
function redundant(a,b,c){return a[1]===b[1]&&b[1]===c[1]}
function simplify(keys){if(keys.length<2)return keys.slice();let k=keys.slice(),changed=true;
 while(changed){changed=false;
  // leading/trailing duplicates are invisible (sample clamps outside the key range)
  while(k.length>1&&k[0][1]===k[1][1]){k.shift();changed=true}
  while(k.length>1&&k.at(-1)[1]===k.at(-2)[1]){k.pop();changed=true}
  for(let i=1;i<k.length-1;i++)if(redundant(k[i-1],k[i],k[i+1])){k.splice(i,1);i--;changed=true}}
 return k}
function probeTimes(keys,extra,dur,fps){let ts=new Set(extra);for(let i=0;i<=Math.ceil(dur*fps);i++)ts.add(i/fps);for(let i=0;i<keys.length;i++){ts.add(keys[i][0]);if(i)for(let s of [.13,.25,.5,.75,.91])ts.add(keys[i-1][0]+(keys[i][0]-keys[i-1][0])*s)}return [...ts]}
const same=(a,b)=>Object.is(a,b)||a===b;
function sameCurve(A,B,times){for(let t of times)if(!same(sample(A,t),sample(B,t)))return false;return true}
// Returns {project, report}. Never changes the evaluated animation; verified by dense sampling.
export function optimize(input,{preserveKeyTimes=true}={}){let p=migrate(input),dur=Math.max(p.duration,...(p.tracks||[]).flatMap(t=>t.keys.map(k=>k[0])),0),fps=p.fps||30;
 let before=p.tracks.reduce((n,t)=>n+t.keys.length,0),tracksBefore=p.tracks.length,origTimes=new Set([...p.tracks.flatMap(t=>t.keys.map(k=>k[0])),...(p.cameraKeys||[]).map(k=>k[0])]);
 let presetHands=new Set(p.tracks.filter(isPresetTrack).map(t=>t.actor+'|'+t.joint[0]));
 let out=[],removed=[];
 for(let t of p.tracks){if(isPresetTrack(t)||isContactTrack(t)){let ks=t.keys.slice(),changed=true;while(changed){changed=false;while(ks.length>1&&ks[0][1]===ks[1][1]){ks.shift();changed=true}while(ks.length>1&&ks.at(-1)[1]===ks.at(-2)[1]){ks.pop();changed=true}for(let i=1;i<ks.length-1;i++)if(ks[i-1][1]===ks[i][1]&&ks[i][1]===ks[i+1][1]){ks.splice(i,1);i--;changed=true}}out.push({...t,keys:ks});continue}
  if(!t.keys.length||!t.keys.every(k=>Number.isFinite(k[0])&&Number.isFinite(k[1]))){out.push(t);continue}
  let ks=simplify(t.keys),times=probeTimes(t.keys,[],dur,fps);if(!sameCurve(t.keys,ks,times))ks=t.keys.slice();
  let rest=restValue(p,t),finger=/^([LR])_finger/.exec(t.joint);
  let overridesPreset=finger&&presetHands.has(t.actor+'|'+finger[1]);
  if(rest!==null&&!overridesPreset&&ks.every(k=>k[1]===rest)){removed.push({...t,keys:ks});continue}
  out.push({...t,keys:ks})}
 // Keep every timeline marker the user saw (one key per original time is enough).
 if(preserveKeyTimes){let have=()=>new Set([...out.flatMap(t=>t.keys.map(k=>k[0])),...(p.cameraKeys||[]).map(k=>k[0])]),now=have();
  for(let time of origTimes){if(now.has(time))continue;let done=false;
   for(let t of [...out,...removed]){if(isPresetTrack(t)||isContactTrack(t))continue;let orig=p.tracks.find(o=>o.actor===t.actor&&o.joint===t.joint&&o.axis===t.axis),k=orig?.keys.find(k=>k[0]===time);if(!k)continue;let ks=[...t.keys,k].sort((a,b)=>a[0]-b[0]);if(sameCurve(orig.keys,ks,probeTimes(orig.keys,[time],dur,fps))){t.keys=ks;if(removed.includes(t)){removed.splice(removed.indexOf(t),1);out.push(t)}done=true;break}}
   if(done)now.add(time)}}
 let order=new Map(p.tracks.map((t,i)=>[t.actor+'|'+t.joint+'|'+t.axis,i]));out.sort((a,b)=>order.get(a.actor+'|'+a.joint+'|'+a.axis)-order.get(b.actor+'|'+b.joint+'|'+b.axis));
 p.tracks=out;let after=out.reduce((n,t)=>n+t.keys.length,0);
 return {project:p,report:{keysBefore:before,keysAfter:after,tracksBefore,tracksAfter:out.length}}}

// ---------- Export formatting: one track per line, easy for agents to diff/patch ----------
export function stringifyProject(p){let q={$schema:'./motion-schema.json',schemaVersion:SCHEMA_VERSION,app:APP_VERSION,...p};q.$schema='./motion-schema.json';q.schemaVersion=SCHEMA_VERSION;q.app=APP_VERSION;
 let lines=['{'],entries=Object.entries(q);entries.forEach(([k,v],i)=>{let end=i<entries.length-1?',':'';if(Array.isArray(v)&&v.length&&typeof v[0]==='object')lines.push(`  ${JSON.stringify(k)}: [\n${v.map(x=>'    '+JSON.stringify(x)).join(',\n')}\n  ]${end}`);else lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}${end}`)});lines.push('}');return lines.join('\n')+'\n'}

// ======================= v0.13: pure FK / IK / foot lock (mirrors engine.js rig) =======================
const R=Math.PI/180;
// Rig definition: identical to actor() in engine.js. [name, parent, offset]
export const RIG=(()=>{let d=[['hips',null,[0,.94,0]],['spine','hips',[0,.2,0]],['chest','spine',[0,.23,0]],['neck','chest',[0,.19,0]],['head','neck',[0,.12,0]]];
 for(let s of ['L','R']){let k=s==='L'?1:-1;d.push([s+'_clavicle','chest',[k*.12,.08,0]],[s+'_shoulder',s+'_clavicle',[k*.08,0,0]],[s+'_elbow',s+'_shoulder',[0,-.29,0]],[s+'_forearm',s+'_elbow',[0,-.13,0]],[s+'_wrist',s+'_forearm',[0,-.13,0]]);
  for(let f=0;f<5;f++){let p=s+'_wrist';for(let b=0;b<3;b++){let n=`${s}_finger${f}_${b}`;d.push([n,p,[b===0?(f-2)*.019:0,b===0?-.09:-.025,0]]);p=n}}
  d.push([s+'_hip','hips',[k*.11,0,0]],[s+'_knee',s+'_hip',[0,-.44,0]],[s+'_ankle',s+'_knee',[0,-.44,0]]);
  for(let f=0;f<5;f++){let p=s+'_ankle';for(let b=0;b<2;b++){let n=`${s}_toe${f}_${b}`;d.push([n,p,[b===0?(f-2)*.02:0,0,b===0?.16:.025]]);p=n}}}
 return d})();
export const BODY_JOINTS=JOINTS.filter(j=>!/_(finger|toe)\d/.test(j));
export const ANKLE_HEIGHT=.06; // ankle above floor when standing; sole ≈ ankle-0.055
// quaternion [x,y,z,w]
export const Q={
 mul:(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]],
 inv:q=>[-q[0],-q[1],-q[2],q[3]],
 rot:(q,v)=>{let [x,y,z,w]=q,ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x]},
 euler:(x,y,z)=>{let c1=Math.cos(x/2),c2=Math.cos(y/2),c3=Math.cos(z/2),s1=Math.sin(x/2),s2=Math.sin(y/2),s3=Math.sin(z/2);return [s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3]},
 toEuler:q=>{let [x,y,z,w]=q,m11=1-2*(y*y+z*z),m12=2*(x*y-w*z),m13=2*(x*z+w*y),m22=1-2*(x*x+z*z),m23=2*(y*z-w*x),m32=2*(y*z+w*x),m33=1-2*(x*x+y*y),ey=Math.asin(Math.max(-1,Math.min(1,m13)));return Math.abs(m13)<.9999999?[Math.atan2(-m23,m33),ey,Math.atan2(-m12,m11)]:[Math.atan2(m32,m22),ey,0]},
 fromUnit:(a,b)=>{let r=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+1,q;if(r<1e-8){q=Math.abs(a[0])>Math.abs(a[2])?[-a[1],a[0],0,0]:[0,-a[2],a[1],0]}else q=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0],r];let l=Math.hypot(...q);return q.map(v=>v/l)},
 slerp:(a,b,t)=>{let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];if(d<0){b=b.map(v=>-v);d=-d}if(d>.9995){let q=a.map((v,i)=>v+(b[i]-v)*t),l=Math.hypot(...q);return q.map(v=>v/l)}let th=Math.acos(d),s=Math.sin(th);return a.map((v,i)=>(v*Math.sin((1-t)*th)+b[i]*Math.sin(t*th))/s)}};
const V={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len:a=>Math.hypot(a[0],a[1],a[2]),norm:a=>{let l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]},lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]};
export {V};
// Track index per actor (cached on the tracks array; key arrays are read live).
const idxCache=new WeakMap();
export function actorTracks(p,id){let c=idxCache.get(p.tracks);if(!c||c.len!==p.tracks.length){c={len:p.tracks.length,m:new Map()};for(let t of p.tracks){if(!c.m.has(t.actor))c.m.set(t.actor,{presets:[],tracks:[],contacts:{}});let e=c.m.get(t.actor);if(isPresetTrack(t))e.presets.push(t);else if(isContactTrack(t))e.contacts[t.joint[0]]=t;else e.tracks.push(t)}idxCache.set(p.tracks,c)}return c.m.get(id)||{presets:[],tracks:[],contacts:{}}}
// Local pose of one character from tracks only (same order/maths as engine pose()). Degrees.
export function evalLocal(p,id,t){let c=p.characters.find(c=>c.id===id);if(!c)return null;let out={pos:c.position.slice(),yaw:c.yaw||0,rot:{}},e=actorTracks(p,id);
 for(let pt of e.presets){let ch=presetChannels(pt);for(let k in ch){let [j,ax]=k.split('.');(out.rot[j]||(out.rot[j]=[0,0,0]))['xyz'.indexOf(ax)]=sample(ch[k],t)}}
 for(let tr of e.tracks){if(tr.joint==='$root'){if(tr.axis==='yaw')out.yaw=sample(tr.keys,t);else if(tr.axis in {x:1,y:1,z:1})out.pos['xyz'.indexOf(tr.axis)]=sample(tr.keys,t)}else if(JOINT_SET.has(tr.joint)&&tr.axis in {x:1,y:1,z:1})(out.rot[tr.joint]||(out.rot[tr.joint]=[0,0,0]))['xyz'.indexOf(tr.axis)]=sample(tr.keys,t)}
 return out}
// World positions/orientations of every joint.
export function fk(local){let pos={},q={},rq=Q.euler(0,local.yaw*R,0);pos.$root=local.pos.slice();q.$root=rq;
 for(let [n,par,off] of RIG){let pp=par?pos[par]:local.pos,pq=par?q[par]:rq,r=local.rot[n]||[0,0,0];pos[n]=V.add(pp,Q.rot(pq,off));q[n]=Q.mul(pq,Q.euler(r[0]*R,r[1]*R,r[2]*R))}return {pos,q}}
export const OFFSET=Object.fromEntries(RIG.map(([n,,o])=>[n,o]));
// Analytic 2-bone IK on (upper, mid, end). Returns new local rotations (deg) for upper, mid and optionally end orientation.
export function solveTwoBone(w,local,upper,mid,end,target,endQ,poleHint){let A=w.pos[upper],B=w.pos[mid],C=w.pos[end],l1=V.len(V.sub(B,A)),l2=V.len(V.sub(C,B)),ta=V.sub(target,A),dist=V.len(ta);if(dist<1e-6)return null;let u=V.mul(ta,1/dist),d=Math.min(Math.max(dist,Math.abs(l1-l2)+1e-5),l1+l2-1e-5),along=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-along*along));
 let pole;if(poleHint){pole=V.sub(poleHint,V.mul(u,V.dot(poleHint,u)))}else{let ac=V.norm(V.sub(C,A));pole=V.sub(B,A);pole=V.sub(pole,V.mul(ac,V.dot(pole,ac)));pole=V.sub(pole,V.mul(u,V.dot(pole,u)))}if(V.len(pole)<1e-4){pole=Q.rot(w.q.hips,[0,0,-1]);pole=V.sub(pole,V.mul(u,V.dot(pole,u)))}if(V.len(pole)<1e-6)pole=[0,1,0];pole=V.norm(pole);
 let B2=V.add(V.add(A,V.mul(u,along)),V.mul(pole,h)),C2=V.add(A,V.mul(u,d));
 let parQ=w.q[RIG.find(r=>r[0]===upper)[1]],upW=Q.mul(Q.fromUnit(V.norm(V.sub(B,A)),V.norm(V.sub(B2,A))),w.q[upper]);
 let midLocal=Q.euler(...(local.rot[mid]||[0,0,0]).map(v=>v*R)),midW=Q.mul(upW,midLocal),cur=Q.rot(midW,OFFSET[end]),midW2=Q.mul(Q.fromUnit(V.norm(cur),V.norm(V.sub(C2,B2))),midW);
 let res={[upper]:Q.toEuler(Q.mul(Q.inv(parQ),upW)).map(v=>v/R),[mid]:Q.toEuler(Q.mul(Q.inv(upW),midW2)).map(v=>v/R)};
 if(endQ)res[end]=Q.toEuler(Q.mul(Q.inv(midW2),endQ)).map(v=>v/R);return res}
// Hinge 2-bone IK: the middle joint (knee/elbow) bends ONLY around its local X (sign +1 knee, −1 elbow),
// the upper joint aims the chain at the target and twists it so the middle joint points toward `pole`.
export function solveHinge(w,local,upper,mid,end,target,endQ,pole,sign=1){let A=w.pos[upper],B=w.pos[mid],Cc=w.pos[end],l1=V.len(V.sub(B,A)),l2=V.len(V.sub(Cc,B)),ta=V.sub(target,A),dist=V.len(ta);if(dist<1e-6||l1<1e-6||l2<1e-6)return null;
 let d=Math.min(Math.max(dist,Math.abs(l1-l2)+1e-5),l1+l2-1e-5),bend=Math.PI-Math.acos(Math.max(-1,Math.min(1,(l1*l1+l2*l2-d*d)/(2*l1*l2)))),u=V.mul(ta,1/dist);
 let par=RIG.find(r=>r[0]===upper)[1],l2c={...local,rot:{...local.rot,[mid]:[sign*bend/R,0,0]}},w2=fk(l2c);
 let q1=Q.fromUnit(V.norm(V.sub(w2.pos[end],w2.pos[upper])),u),upW=Q.mul(q1,w2.q[upper]);
 let kneeDir=Q.rot(upW,OFFSET[mid]),kp=V.sub(kneeDir,V.mul(u,V.dot(kneeDir,u))),pp=pole?V.sub(pole,V.mul(u,V.dot(pole,u))):null;
 if(pp&&V.len(kp)>1e-6&&V.len(pp)>1e-6){kp=V.norm(kp);pp=V.norm(pp);let c=Math.max(-1,Math.min(1,V.dot(kp,pp))),cr=[kp[1]*pp[2]-kp[2]*pp[1],kp[2]*pp[0]-kp[0]*pp[2],kp[0]*pp[1]-kp[1]*pp[0]],ang=Math.atan2(V.dot(cr,u),c),h=ang/2,s=Math.sin(h);upW=Q.mul([u[0]*s,u[1]*s,u[2]*s,Math.cos(h)],upW)}
 let res={[upper]:Q.toEuler(Q.mul(Q.inv(w.q[par]),upW)).map(v=>v/R),[mid]:[sign*bend/R,0,0]};
 if(endQ){let midW=Q.mul(upW,Q.euler(sign*bend,0,0)),endPar=RIG.find(r=>r[0]===end)[1];let pw=midW;if(endPar!==mid){pw=Q.mul(midW,Q.euler(...(local.rot[endPar]||[0,0,0]).map(v=>v*R)))}res[end]=Q.toEuler(Q.mul(Q.inv(pw),endQ)).map(v=>v/R)}
 return res}
// Contact track: [[t,1],[t,0]...] step function. Returns {on, start, release}.
// Values: 0 lifted, 1 planted (position + orientation locked), 2 pivot (position locked, foot turns with the leg).
export function contactAt(keys,t){if(!keys?.length)return null;let on=keys[0][1]>=.5,mode=keys[0][1],start=0,release=-Infinity,prevStart=0;for(let k of keys){if(k[0]>t)break;let v=k[1]>=.5;mode=k[1];if(v&&!on){on=true;start=k[0]}else if(!v&&on){on=false;release=k[0];prevStart=start}}return on?{on,start,mode}:{on,release,start:prevStart,mode}}
export const FOOT_BLEND=.15;
// Foot lock: planted feet stay fixed in world while the body moves. Mutates local.rot, returns changed joints.
export function footLock(p,id,t,local){let e=actorTracks(p,id),changed={};for(let s of ['L','R']){let tr=e.contacts[s];if(!tr)continue;let st=contactAt(tr.keys,t);if(!st)continue;let w=1;if(!st.on){let dt=t-st.release;if(!(dt<FOOT_BLEND))continue;let u=dt/FOOT_BLEND;w=1-u*u*(3-2*u)}
  let lockLocal=evalLocal(p,id,st.start),lw=fk(lockLocal),lockPos=lw.pos[s+'_ankle'].slice(),lockQ=lw.q[s+'_ankle'];if(lockPos[1]<ANKLE_HEIGHT+.02)lockPos[1]=ANKLE_HEIGHT;
  let turn=Math.abs((((local.yaw+(local.rot.hips?.[1]||0))-(lockLocal.yaw+(lockLocal.rot.hips?.[1]||0)))%360+540)%360-180),ow=st.mode===2?0:Math.min(1,Math.max(0,1-(turn-15)/25));
  let cw=fk(local),cur=cw.pos[s+'_ankle'],target=V.lerp(cur,lockPos,w),fwd=Q.rot(cw.q.hips,[0,0,1]);
  // out of reach (lunge): lift the heel up to 8 cm instead of sliding the foot
  {let hp=cw.pos[s+'_hip'],Lmax=.879,hx=Math.hypot(target[0]-hp[0],target[2]-hp[2]);if(V.len(V.sub(target,hp))>Lmax&&hx<Lmax){let y=hp[1]-Math.sqrt(Lmax*Lmax-hx*hx);target=[target[0],Math.min(Math.max(target[1],y),lockPos[1]+.08),target[2]]}}
  let r=solveHinge(cw,local,s+'_hip',s+'_knee',s+'_ankle',target,null,fwd,1);if(!r)continue;
  // ankle: locked orientation blended with the orientation the leg gives (pivot on the ball of the foot)
  let tmp={...local,rot:{...local.rot,...r}},tw=fk(tmp),tq=Q.slerp(tw.q[s+'_ankle'],lockQ,w*ow);r[s+'_ankle']=Q.toEuler(Q.mul(Q.inv(tw.q[s+'_knee']),tq)).map(v=>v/R);
  for(let j in r){local.rot[j]=r[j];changed[j]=r[j]}}
 // Ground clamp (only for actors using contact tracks, so older projects render unchanged).
 let gw=null;if(e.contacts.L||e.contacts.R)for(let s of ['L','R']){gw=gw||fk(local);let a=gw.pos[s+'_ankle'];if(a[1]>=ANKLE_HEIGHT-1e-4)continue;let r=solveHinge(gw,local,s+'_hip',s+'_knee',s+'_ankle',[a[0],ANKLE_HEIGHT,a[2]],gw.q[s+'_ankle'],Q.rot(gw.q.hips,[0,0,1]),1);if(!r)continue;for(let j in r){local.rot[j]=r[j];changed[j]=r[j]}gw=null}
 return changed}
export function evalPose(p,id,t){let l=evalLocal(p,id,t);if(l)footLock(p,id,t,l);return l}
// Lowest point of the body (sole/head/hands) for auto-grounding. Returns y of the lowest surface.
const MARGIN={head:.09,L_ankle:.055,R_ankle:.055,L_toe2_1:.03,R_toe2_1:.03,hips:.06,spine:.06,chest:.12,L_wrist:.05,R_wrist:.05,L_knee:.04,R_knee:.04,L_elbow:.04,R_elbow:.04,L_shoulder:.05,R_shoulder:.05,neck:.04};
export function lowestPoint(w){let m=Infinity;for(let j in MARGIN)m=Math.min(m,w.pos[j][1]-MARGIN[j]);return m}

// ======================= v0.13: automatic motion check (report for AI self-repair) =======================
export function checkMotion(p,{step}={}){let issues=[],fps=p.fps,dt=step||1/fps,n=Math.floor(p.duration/dt+1e-9),add=(sev,code,o)=>issues.push({severity:sev,code,...o});
 let runs=new Map(),open=(key,t,o)=>{let r=runs.get(key);if(r&&Math.abs(r.to-(t-dt))<1e-6){r.to=t;r.peak=Math.max(r.peak,o.peak??0);return}if(r)flush(key);runs.set(key,{from:t,to:t,peak:o.peak??0,...o})},flush=key=>{let r=runs.get(key);runs.delete(key);if(!r)return;let {sev,code,from,to,peak,min,...rest}=r;if(to-from+dt<(min||0))return;add(sev,code,{from:+from.toFixed(3),to:+to.toFixed(3),peak:+peak.toFixed(3),...rest})};
 let prev=new Map();
 for(let i=0;i<=n;i++){let t=i*dt,ws={};for(let c of p.characters){let l=evalPose(p,c.id,t);if(!l)continue;let w=fk(l);ws[c.id]=w;let e=actorTracks(p,c.id),pv=prev.get(c.id);
  let low=Infinity,lowJ='';for(let j of BODY_JOINTS){let y=w.pos[j][1]-(MARGIN[j]??.03);if(y<low){low=y;lowJ=j}}
  if(low<-.03)open(c.id+'|pen',t,{sev:'error',code:'GROUND_PENETRATION',actor:c.id,joint:lowJ,peak:-low,message:`${c.id}: ${lowJ} xuyên sàn`,fix:'Nâng track $root y, hoặc giảm gập hông/gối; dùng pose có ground=true'});else flush(c.id+'|pen');
  for(let s of ['L','R']){let a=w.pos[s+'_ankle'],st=e.contacts[s]?contactAt(e.contacts[s].keys,t):null,locked=st&&(st.on||t-st.release<FOOT_BLEND);
   if(pv&&!e.contacts[s]&&a[1]<ANKLE_HEIGHT+.02&&pv.pos[s+'_ankle'][1]<ANKLE_HEIGHT+.02){let sp=Math.hypot(a[0]-pv.pos[s+'_ankle'][0],a[2]-pv.pos[s+'_ankle'][2])/dt;if(sp>.3)open(c.id+'|slide'+s,t,{sev:'warning',code:'FOOT_SLIDE',actor:c.id,joint:s+'_foot',peak:sp,min:.15,message:`${c.id}: chân ${s} trượt trên sàn`,fix:`Thêm contact {"actor":"${c.id}","joint":"${s}_foot","axis":"contact"} = 1 khi chân chạm đất, 0 khi nhấc`});else flush(c.id+'|slide'+s)}else flush(c.id+'|slide'+s)
   if(st&&st.on){let lk=fk(evalLocal(p,c.id,st.start)).pos[s+'_ankle'],gy=a[1]-Math.max(lk[1]<ANKLE_HEIGHT+.02?ANKLE_HEIGHT:lk[1],ANKLE_HEIGHT),gap=Math.max(Math.hypot(lk[0]-a[0],lk[2]-a[2]),gy>.085?gy-.085:0,gy<-.01?-gy:0);if(gap>.03)open(c.id+'|reach'+s,t,{sev:'warning',code:'FOOT_LOCK_STRETCH',actor:c.id,joint:s+'_foot',peak:gap,message:`${c.id}: chân ${s} đang khoá nhưng không với tới (thân đi quá xa)`,fix:'Giảm quãng di chuyển $root trong lúc chân khoá, hoặc đặt contact=0 sớm hơn'});else flush(c.id+'|reach'+s)}else flush(c.id+'|reach'+s)}
  let feetY=Math.min(w.pos.L_ankle[1],w.pos.R_ankle[1]);if(feetY>ANKLE_HEIGHT+.15)open(c.id+'|air',t,{sev:'info',code:'AIRBORNE',actor:c.id,peak:feetY-ANKLE_HEIGHT,min:.9,message:`${c.id}: lơ lửng trên không lâu`,fix:'Nếu không phải bay/nhảy, hạ $root y'});else flush(c.id+'|air');
  if(pv)for(let j of BODY_JOINTS){let a=l.rot[j]||[0,0,0],b=pv.rot[j]||[0,0,0];for(let k=0;k<3;k++){let sp=Math.abs(a[k]-b[k])/dt;if(sp>2800)open(c.id+'|spd|'+j+k,t,{sev:'warning',code:'JOINT_SPEED',actor:c.id,joint:j,axis:'xyz'[k],peak:sp,message:`${c.id}: ${j}.${'xyz'[k]} quay quá nhanh (${Math.round(sp)}°/s) – giật hoặc lật góc`,fix:'Thêm key trung gian, tránh nhảy >180° giữa 2 key (dùng góc liên tục, ví dụ 190 thay vì -170)'});else flush(c.id+'|spd|'+j+k)}}
  for(let s of ['L','R']){let k=l.rot[s+'_knee']||[0,0,0],el=l.rot[s+'_elbow']||[0,0,0];if(k[0]<-12)open(c.id+'|hyper'+s,t,{sev:'warning',code:'KNEE_HYPEREXTENSION',actor:c.id,joint:s+'_knee',peak:-k[0],message:`${c.id}: gối ${s} gập ngược ${Math.round(k[0])}°`,fix:'Gối chỉ gập dương (x>0): sửa key gối hoặc giảm quãng di chuyển khi chân khoá'});else flush(c.id+'|hyper'+s);if(el[0]>15)open(c.id+'|elb'+s,t,{sev:'warning',code:'ELBOW_HYPEREXTENSION',actor:c.id,joint:s+'_elbow',peak:el[0],message:`${c.id}: khuỷu ${s} gập ngược`,fix:'Khuỷu chỉ gập âm (x<0)'});else flush(c.id+'|elb'+s)
   let ct=e.contacts[s]?contactAt(e.contacts[s].keys,t):null;if(pv&&ct&&!ct.on&&t-ct.release>FOOT_BLEND){let a=w.pos[s+'_ankle'],b=pv.pos[s+'_ankle'],sp=Math.hypot(a[0]-b[0],a[2]-b[2])/dt;if(a[1]<ANKLE_HEIGHT+.02&&sp>.5)open(c.id+'|scuff'+s,t,{sev:'warning',code:'FOOT_SCUFF',actor:c.id,joint:s+'_foot',peak:sp,min:.1,message:`${c.id}: chân ${s} đang nhấc nhưng cạ sát sàn`,fix:'Gập gối/háng chân bước nhiều hơn giữa bước, hoặc đặt contact=1 nếu chân thật sự chạm đất'});else flush(c.id+'|scuff'+s)}else flush(c.id+'|scuff'+s)}
  prev.set(c.id,{pos:w.pos,rot:l.rot})}
  let ids=Object.keys(ws);for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){let hit=limbHit(ws[ids[a]].pos,ws[ids[b]].pos),key=ids[a]+'|'+ids[b]+'|limb',ok=(p.intendedContacts||[]).some(ic=>t>=ic.from-1e-9&&t<=ic.to+1e-9&&(!ic.actors||(ic.actors.includes(ids[a])&&ic.actors.includes(ids[b]))));
   if(hit.d<-.01)open(key,t,{sev:ok?'info':'warning',code:ok?'INTENDED_CONTACT':'LIMB_COLLISION',actor:ids[a],other:ids[b],joint:hit.A+' ↔ '+hit.B,peak:-hit.d,message:ok?`${ids[a]}–${ids[b]}: chạm theo ý đồ (${hit.A} ↔ ${hit.B})`:`${ids[a]} xuyên ${ids[b]}: ${hit.A} ↔ ${hit.B}`,fix:ok?'—':'Giãn khoảng cách/đổi hướng; nếu là đòn trúng có chủ đích thì thêm intendedContacts {from,to,actors}'});else flush(key);let A=ws[ids[a]].pos.hips,B=ws[ids[b]].pos.hips,d=Math.hypot(A[0]-B[0],A[2]-B[2]);let k2=ids[a]+'|'+ids[b]+'|ov';if(d<.32)open(k2,t,{sev:'warning',code:'ACTOR_OVERLAP',actor:ids[a],other:ids[b],peak:.32-d,message:`${ids[a]} và ${ids[b]} chồng lên nhau`,fix:'Giãn khoảng cách $root x/z ≥ 0.4m'});else flush(k2)}}
 for(let k of [...runs.keys()])flush(k);
 for(let t of p.tracks){if(isPresetTrack(t)||isContactTrack(t)||t.joint==='$root'||!Array.isArray(t.keys))continue;for(let i=1;i<t.keys.length;i++){let d=Math.abs(t.keys[i][1]-t.keys[i-1][1]);if(d>200)add('warning','ROTATION_FLIP',{actor:t.actor,joint:t.joint,axis:t.axis,from:t.keys[i-1][0],to:t.keys[i][0],peak:d,message:`${t.actor}: ${t.joint}.${t.axis} đổi ${Math.round(d)}° giữa 2 key`,fix:'Kiểm tra lật góc ±360°; chia nhỏ chuyển động'})}}
 issues.sort((a,b)=>(a.from??0)-(b.from??0));return issues}
const SEG=[['hips','spine',.13],['spine','chest',.13],['chest','neck',.12],['neck','head',.05],['head','head',.12],...['L','R'].flatMap(s=>[[s+'_shoulder',s+'_elbow',.045],[s+'_elbow',s+'_wrist',.04],[s+'_hip',s+'_knee',.06],[s+'_knee',s+'_ankle',.05],[s+'_ankle',s+'_toe2_0',.045]])];
export function segDist(p1,q1,p2,q2){let d1=V.sub(q1,p1),d2=V.sub(q2,p2),r=V.sub(p1,p2),a=V.dot(d1,d1),e=V.dot(d2,d2),f=V.dot(d2,r),s=0,t=0;if(a<1e-9&&e<1e-9)return V.len(r);if(a<1e-9)t=Math.min(1,Math.max(0,f/e));else{let c=V.dot(d1,r);if(e<1e-9)s=Math.min(1,Math.max(0,-c/a));else{let b=V.dot(d1,d2),den=a*e-b*b;s=den>1e-12?Math.min(1,Math.max(0,(b*f-c*e)/den)):0;t=(b*s+f)/e;if(t<0){t=0;s=Math.min(1,Math.max(0,-c/a))}else if(t>1){t=1;s=Math.min(1,Math.max(0,(b-c)/a))}}}return V.len(V.sub(V.add(p1,V.mul(d1,s)),V.add(p2,V.mul(d2,t))))}
// Closest approach between two bodies (capsule model). d<0 = interpenetration depth.
export function limbHit(A,B){let best={d:9};for(let [p1,q1,r1] of SEG)for(let [p2,q2,r2] of SEG){let d=segDist(A[p1],A[q1],B[p2],B[q2])-r1-r2;if(d<best.d)best={d,A:p1+'→'+q1,B:p2+'→'+q2}}return best}
export function fullReport(p){let v=validate(p),issues=v.errors.length?[]:checkMotion(p);return {schemaVersion:SCHEMA_VERSION,app:APP_VERSION,summary:{errors:v.errors.length+issues.filter(i=>i.severity==='error').length,warnings:v.warnings.length+issues.filter(i=>i.severity==='warning').length,info:issues.filter(i=>i.severity==='info').length},validation:v,motion:issues,howToFix:'Sửa JSON theo trường fix của từng mục, rồi chạy lại: node ams-cli.mjs check project.json'}}
