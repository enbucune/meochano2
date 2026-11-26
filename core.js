// AI Motion Studio core: pure data logic (no DOM, no Three.js). Runs in browser and Node.
export const APP_VERSION='0.12';
export const SCHEMA_VERSION=2;
export const EASES=['smooth','linear','hold'];
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
// Finger index: 0 = thumb, 1 = index … 4 = pinky. Values: [[x0,x1,x2], z0].
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

// ---------- Sampling (identical maths to v0.11) ----------
export function easeValue(u,mode){return mode==='linear'?u:mode==='hold'?(u>=1?1:0):u*u*(3-2*u)}
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
export function migrate(input){let p=JSON.parse(JSON.stringify(input));if(!p||typeof p!=='object')return p;let from=Number.isInteger(p.schemaVersion)?p.schemaVersion:1;
 if(from<2){if(p.version!==undefined&&p.legacyVersion===undefined)p.legacyVersion=String(p.version);delete p.version}
 p.schemaVersion=Math.max(from,SCHEMA_VERSION);
 if(Array.isArray(p.tracks))for(let t of p.tracks)if(Array.isArray(t.keys))t.keys.sort((a,b)=>a[0]-b[0]);
 if(Array.isArray(p.cameraKeys))p.cameraKeys.sort((a,b)=>a[0]-b[0]);
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
 (p.objects||[]).forEach((o,i)=>{let n=`objects[${i}]`;if(!vec3(o?.position))E(n+': position phải là [x,y,z]');if(!vec3(o?.size))E(n+': size phải là [x,y,z]');else if(o.size.some(s=>s<=0))W(n+': size có cạnh ≤ 0');else if(o.size.some(s=>s>50))W(n+': kích thước > 50m')});
 let checkKeys=(keys,n,valueCheck)=>{if(!Array.isArray(keys)||!keys.length){E(n+': keys rỗng');return}let prev=-Infinity,frames=new Set();keys.forEach((k,j)=>{let kn=`${n}.keys[${j}]`;if(!Array.isArray(k)||k.length<2){E(kn+': phải là [t, value, ease?]');return}if(!fin(k[0])){E(kn+': thời gian không hợp lệ');return}if(k[0]<0)E(kn+': thời gian âm');if(k[0]>dur+1e-9)W(kn+`: t=${k[0]}s vượt duration ${dur}s`);if(k[0]<prev)E(kn+': keys chưa sắp xếp theo thời gian');if(k[0]===prev)E(kn+': trùng thời gian (gây NaN khi nội suy)');else if(frames.has(frame(k[0])))W(kn+': hai key cùng một frame');prev=k[0];frames.add(frame(k[0]));if(k.length>2&&k[2]!=null&&!EASES.includes(k[2]))W(kn+`: ease "${k[2]}" không hợp lệ (dùng ${EASES.join('/')})`);valueCheck(k[1],kn)})};
 let seen=new Set();
 p.tracks.forEach((t,i)=>{let n=`tracks[${i}]`;if(!t||typeof t!=='object'){E(n+': không phải object');return}let label=`${n} ${t.actor}/${t.joint}/${t.axis}`,sig=t.actor+'|'+t.joint+'|'+t.axis;if(seen.has(sig))W(label+': track trùng lặp, track sau sẽ ghi đè');seen.add(sig);
  let obj=/^@object:(\d+)$/.exec(t.actor||'');
  if(obj){let oi=+obj[1];if(!p.objects?.[oi])E(label+': vật thể không tồn tại');if(t.joint!=='$root')E(label+': vật thể chỉ có joint "$root"');if(!/^[prs][xyz]$/.test(t.axis))E(label+': axis vật thể phải là px..sz');
   checkKeys(t.keys,label,(v,kn)=>{if(!fin(v)){E(kn+': giá trị không phải số');return}if(t.axis[0]==='s'&&v<=0)W(kn+': scale ≤ 0');if(t.axis[0]==='p'&&Math.abs(v)>50)W(kn+': vị trí > 50m')});return}
  if(!ids.has(t.actor)){E(label+': nhân vật không tồn tại');return}
  if(isPresetTrack(t)){checkKeys(t.keys,label,(v,kn)=>{if(!HAND_PRESETS[v])E(kn+`: preset "${v}" không có (${Object.keys(HAND_PRESETS).join('/')})`)});return}
  if(t.joint==='$root'){if(!['x','y','z','yaw'].includes(t.axis))E(label+': axis $root phải là x/y/z/yaw');checkKeys(t.keys,label,(v,kn)=>{if(!fin(v)){E(kn+': giá trị không phải số');return}if(t.axis==='y'&&(v<-1||v>10))W(kn+`: độ cao ${v}m bất thường`);if((t.axis==='x'||t.axis==='z')&&Math.abs(v)>20)W(kn+`: vị trí ${v}m quá xa`);if(t.axis==='yaw'&&Math.abs(v)>1080)W(kn+': yaw vượt ±1080°')});return}
  if(!JOINT_SET.has(t.joint)){E(label+': khớp không tồn tại');return}
  if(!['x','y','z'].includes(t.axis)){E(label+': axis khớp phải là x/y/z');return}
  let lim=jointLimit(t.joint,t.axis),worst=null;
  checkKeys(t.keys,label,(v,kn)=>{if(!fin(v)){E(kn+': giá trị không phải số');return}if(lim&&(v<lim[0]||v>lim[1])&&(!worst||Math.abs(v)>Math.abs(worst[0])))worst=[v,kn]});
  if(worst)W(`${worst[1]}: ${worst[0]}° ngoài giới hạn khớp [${lim[0]}, ${lim[1]}]`)});
 if(p.cameraKeys!==undefined){if(!Array.isArray(p.cameraKeys))E('cameraKeys phải là mảng');else{let prev=-Infinity;p.cameraKeys.forEach((k,j)=>{let n=`cameraKeys[${j}]`;if(!Array.isArray(k)||k.length<4||![0,1,2,3].every(i=>fin(k[i]))){E(n+': phải là [t, azimuth, elevation, distance, ease?, tx, ty, tz]');return}if(k[0]<0)E(n+': thời gian âm');if(k[0]>dur+1e-9)W(n+`: t=${k[0]}s vượt duration`);if(k[0]===prev)E(n+': trùng thời gian');prev=k[0];if(k[4]!=null&&!EASES.includes(k[4]))W(n+`: ease "${k[4]}" không hợp lệ`);if(Math.abs(k[2])>=90)W(n+': elevation phải trong (-90, 90)');if(k[3]<=0||k[3]>80)W(n+': distance nên trong (0, 80]');for(let i=5;i<8;i++)if(k[i]!==undefined&&(!fin(k[i])||Math.abs(k[i])>50))W(n+': target bất thường')})}}
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
 for(let t of p.tracks){if(isPresetTrack(t)){let ks=t.keys.slice(),changed=true;while(changed){changed=false;while(ks.length>1&&ks[0][1]===ks[1][1]){ks.shift();changed=true}while(ks.length>1&&ks.at(-1)[1]===ks.at(-2)[1]){ks.pop();changed=true}for(let i=1;i<ks.length-1;i++)if(ks[i-1][1]===ks[i][1]&&ks[i][1]===ks[i+1][1]){ks.splice(i,1);i--;changed=true}}out.push({...t,keys:ks});continue}
  if(!t.keys.length||!t.keys.every(k=>Number.isFinite(k[0])&&Number.isFinite(k[1]))){out.push(t);continue}
  let ks=simplify(t.keys),times=probeTimes(t.keys,[],dur,fps);if(!sameCurve(t.keys,ks,times))ks=t.keys.slice();
  let rest=restValue(p,t),finger=/^([LR])_finger/.exec(t.joint);
  let overridesPreset=finger&&presetHands.has(t.actor+'|'+finger[1]);
  if(rest!==null&&!overridesPreset&&ks.every(k=>k[1]===rest)){removed.push({...t,keys:ks});continue}
  out.push({...t,keys:ks})}
 // Keep every timeline marker the user saw (one key per original time is enough).
 if(preserveKeyTimes){let have=()=>new Set([...out.flatMap(t=>t.keys.map(k=>k[0])),...(p.cameraKeys||[]).map(k=>k[0])]),now=have();
  for(let time of origTimes){if(now.has(time))continue;let done=false;
   for(let t of [...out,...removed]){if(isPresetTrack(t))continue;let orig=p.tracks.find(o=>o.actor===t.actor&&o.joint===t.joint&&o.axis===t.axis),k=orig?.keys.find(k=>k[0]===time);if(!k)continue;let ks=[...t.keys,k].sort((a,b)=>a[0]-b[0]);if(sameCurve(orig.keys,ks,probeTimes(orig.keys,[time],dur,fps))){t.keys=ks;if(removed.includes(t)){removed.splice(removed.indexOf(t),1);out.push(t)}done=true;break}}
   if(done)now.add(time)}}
 let order=new Map(p.tracks.map((t,i)=>[t.actor+'|'+t.joint+'|'+t.axis,i]));out.sort((a,b)=>order.get(a.actor+'|'+a.joint+'|'+a.axis)-order.get(b.actor+'|'+b.joint+'|'+b.axis));
 p.tracks=out;let after=out.reduce((n,t)=>n+t.keys.length,0);
 return {project:p,report:{keysBefore:before,keysAfter:after,tracksBefore,tracksAfter:out.length}}}

// ---------- Export formatting: one track per line, easy for agents to diff/patch ----------
export function stringifyProject(p){let q={$schema:'./motion-schema.json',schemaVersion:SCHEMA_VERSION,app:APP_VERSION,...p};q.$schema='./motion-schema.json';q.schemaVersion=SCHEMA_VERSION;q.app=APP_VERSION;
 let lines=['{'],entries=Object.entries(q);entries.forEach(([k,v],i)=>{let end=i<entries.length-1?',':'';if(Array.isArray(v)&&v.length&&typeof v[0]==='object')lines.push(`  ${JSON.stringify(k)}: [\n${v.map(x=>'    '+JSON.stringify(x)).join(',\n')}\n  ]${end}`);else lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}${end}`)});lines.push('}');return lines.join('\n')+'\n'}
