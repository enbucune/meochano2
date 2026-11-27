// AI Motion Studio — exporters: BVH, glTF (.glb), OpenPose keypoints, Google Flow pack, ZIP. Pure JS (browser + Node).
import {APP_VERSION,RIG,OFFSET,Q,V,fk,evalPose,sample,cameraChannel,DEFAULT_CAMERA,propTransform,propLowest,attachAt,objectName,ANKLE_HEIGHT} from './core.js?v=0.23';
import {camWords,propHolds} from './library.js?v=0.23';
const R=Math.PI/180,num=v=>{let s=(+v).toFixed(5);s=s.replace(/0+$/,'').replace(/\.$/,'');return s==='-0'?'0':s};
const CHILDREN=(()=>{let m={};for(let [n,par] of RIG)(m[par||'']||(m[par||'']=[])).push(n);return m})();
const REST=(()=>{let pos={};for(let [n,par,off] of RIG)pos[n]=V.add(par?pos[par]:[0,0,0],off);return pos})();
export function frameTimes(p,t0=0,t1=p.duration,fps=p.fps){let n=Math.max(1,Math.round((t1-t0)*fps)),out=[];for(let i=0;i<=n;i++)out.push(+(t0+i/fps).toFixed(6));if(out.at(-1)>t1+1e-9)out[out.length-1]=t1;return out}
function needActor(p,id){if(!p.characters.some(c=>c.id===id))throw Error(`Không có nhân vật "${id}"`)}

// ------------------------------------------------------------------ BVH (one file per character)
// Channels "Xrotation Yrotation Zrotation" = same Euler XYZ as the editor (R = Rx·Ry·Rz), so values are written unchanged.
function endSite(n){return n==='head'?[0,.2,0]:/_finger\d_2$/.test(n)?[0,-.025,0]:/_toe\d_1$/.test(n)?[0,0,.025]:[0,.05,0]}
export function makeBVH(p,actor,{fps=p.fps,t0=0,t1=p.duration}={}){needActor(p,actor);let L=['HIERARCHY','ROOT Root','{','\tOFFSET 0 0 0','\tCHANNELS 6 Xposition Yposition Zposition Xrotation Yrotation Zrotation'],order=[];
 const walk=(n,d)=>{let ind='\t'.repeat(d);order.push(n);L.push(`${ind}JOINT ${n}`,`${ind}{`,`${ind}\tOFFSET ${OFFSET[n].map(num).join(' ')}`,`${ind}\tCHANNELS 3 Xrotation Yrotation Zrotation`);let ch=CHILDREN[n]||[];if(ch.length)for(let c of ch)walk(c,d+1);else L.push(`${ind}\tEnd Site`,`${ind}\t{`,`${ind}\t\tOFFSET ${endSite(n).map(num).join(' ')}`,`${ind}\t}`);L.push(`${ind}}`)};
 for(let c of CHILDREN[''])walk(c,1);L.push('}');let ts=frameTimes(p,t0,t1,fps);L.push('MOTION',`Frames: ${ts.length}`,`Frame Time: ${(1/fps).toFixed(6)}`);
 for(let t of ts){let l=evalPose(p,actor,t),row=[...l.pos,0,l.yaw,0];for(let n of order){let r=l.rot[n]||[0,0,0];row.push(r[0],r[1],r[2])}L.push(row.map(num).join(' '))}
 return L.join('\n')+'\n'}

// ------------------------------------------------------------------ camera (same maths as the editor)
export function cameraAt(p,t){let k=p.cameraKeys||[],s=[1,2,3,5,6,7].map((i,j)=>k.length?sample(cameraChannel(k,i),t):DEFAULT_CAMERA[j]),a=s[0]*R,e=s[1]*R,back=[Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)],right=[Math.cos(a),0,-Math.sin(a)],up=[-Math.sin(a)*Math.sin(e),Math.cos(e),-Math.cos(a)*Math.sin(e)],target=s.slice(3),pos=target.map((v,i)=>v+back[i]*s[2]);return {state:s,pos,target,back,right,up,fov:42,near:.05,far:100}}
function quatFromBasis(x,y,z){let [m00,m10,m20]=x,[m01,m11,m21]=y,[m02,m12,m22]=z,tr=m00+m11+m22,q;if(tr>0){let s=.5/Math.sqrt(tr+1);q=[(m21-m12)*s,(m02-m20)*s,(m10-m01)*s,.25/s]}else if(m00>m11&&m00>m22){let s=2*Math.sqrt(1+m00-m11-m22);q=[.25*s,(m01+m10)/s,(m02+m20)/s,(m21-m12)/s]}else if(m11>m22){let s=2*Math.sqrt(1+m11-m00-m22);q=[(m01+m10)/s,.25*s,(m12+m21)/s,(m02-m20)/s]}else{let s=2*Math.sqrt(1+m22-m00-m11);q=[(m02+m20)/s,(m12+m21)/s,.25*s,(m10-m01)/s]}let l=Math.hypot(...q);return q.map(v=>v/l)}

// ------------------------------------------------------------------ glTF binary (.glb): skinned mannequins + props + camera + one animation
const srgb2lin=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
function hexRGB(h){let m=/^#?([0-9a-f]{6})$/i.exec(String(h||'').trim());let n=m?parseInt(m[1],16):0x8899aa;return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
function meshBuilder(){let P=[],N=[],J=[],I=[];const vert=(p,n,j)=>{P.push(...p);N.push(...n);J.push(j,0,0,0);return P.length/3-1};
 return {P,N,J,I,
  sphere(c,r,j,seg=10,rings=6){let base=P.length/3;for(let y=0;y<=rings;y++){let v=y/rings,th=v*Math.PI;for(let x=0;x<=seg;x++){let ph=x/seg*2*Math.PI,n=[Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)];vert([c[0]+n[0]*r[0],c[1]+n[1]*r[1],c[2]+n[2]*r[2]],V.norm([n[0]/r[0],n[1]/r[1],n[2]/r[2]]),j)}}for(let y=0;y<rings;y++)for(let x=0;x<seg;x++){let a=base+y*(seg+1)+x,b=a+seg+1;I.push(a,a+1,b,b,a+1,b+1)}},
  cylinder(a,b,r,j,seg=8){let ax=V.sub(b,a),l=V.len(ax);if(l<1e-6)return;let u=V.mul(ax,1/l),t=Math.abs(u[1])<.9?[0,1,0]:[1,0,0],e1=V.norm([u[1]*t[2]-u[2]*t[1],u[2]*t[0]-u[0]*t[2],u[0]*t[1]-u[1]*t[0]]),e2=[u[1]*e1[2]-u[2]*e1[1],u[2]*e1[0]-u[0]*e1[2],u[0]*e1[1]-u[1]*e1[0]],base=P.length/3;
   for(let i=0;i<=seg;i++){let ph=i/seg*2*Math.PI,n=V.add(V.mul(e1,Math.cos(ph)),V.mul(e2,Math.sin(ph)));vert(V.add(a,V.mul(n,r)),n,j);vert(V.add(b,V.mul(n,r)),n,j)}for(let i=0;i<seg;i++){let k=base+i*2;I.push(k,k+2,k+1,k+1,k+2,k+3)}},
  box(c,s,j){let h=s.map(v=>v/2);for(let [ax,sg] of [[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]]){let n=[0,0,0];n[ax]=sg;let u=(ax+1)%3,w=(ax+2)%3,base=P.length/3;for(let [du,dw] of [[-1,-1],[1,-1],[1,1],[-1,1]]){let p=c.slice();p[ax]+=sg*h[ax];p[u]+=du*h[u];p[w]+=dw*h[w];vert(p,n,j)}I.push(...(sg>0?[base,base+1,base+2,base,base+2,base+3]:[base,base+2,base+1,base,base+3,base+2]))}}}}
function mannequin(jointIndex){let m=meshBuilder(),R0=REST;
 for(let [n,par,off] of RIG){let r=/_(finger|toe)\d/.test(n)?.009:.035;m.sphere(R0[n],[r,r,r],jointIndex[n],8,5);if(par&&!/_(finger|toe)\d+_0$/.test(n))m.cylinder(R0[par],R0[n],r*.7,jointIndex[par],8)}
 m.sphere(V.add(R0.head,[0,.06,0]),[.11,.14,.10],jointIndex.head,12,8);m.box(V.add(R0.chest,[0,-.08,0]),[.32,.25,.15],jointIndex.chest);
 for(let s of ['L','R']){m.box(V.add(R0[s+'_wrist'],[0,-.045,0]),[.09,.10,.035],jointIndex[s+'_wrist']);m.box(V.add(R0[s+'_ankle'],[0,-.025,.07]),[.11,.06,.19],jointIndex[s+'_ankle'])}return m}
export function makeGLB(p,{fps=p.fps,t0=0,t1=p.duration,aspect=16/9}={}){
 const ts=frameTimes(p,t0,t1,fps),T=ts.map(t=>+(t-t0).toFixed(6)),chunks=[];let byteLen=0;
 const g={asset:{version:'2.0',generator:'AI Motion Studio '+APP_VERSION},scene:0,scenes:[{name:'AI Motion Studio',nodes:[],extras:{fps,duration:+(t1-t0).toFixed(6),start:t0,source:'AI Motion Studio '+APP_VERSION}}],nodes:[],meshes:[],materials:[],skins:[],cameras:[],accessors:[],bufferViews:[],buffers:[],animations:[{name:'Scene',samplers:[],channels:[]}]};
 const view=(arr,target)=>{let bytes=new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength),pad=(4-byteLen%4)%4;if(pad){chunks.push(new Uint8Array(pad));byteLen+=pad}g.bufferViews.push({buffer:0,byteOffset:byteLen,byteLength:bytes.length,...(target?{target}:{})});chunks.push(bytes);byteLen+=bytes.length;return g.bufferViews.length-1};
 const acc=(arr,type,ct,target,minmax)=>{let n={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[type],a={bufferView:view(arr,target),componentType:ct,count:arr.length/n,type};if(minmax){let mn=Array(n).fill(Infinity),mx=Array(n).fill(-Infinity);for(let i=0;i<arr.length;i++){let k=i%n;if(arr[i]<mn[k])mn[k]=arr[i];if(arr[i]>mx[k])mx[k]=arr[i]}a.min=mn.map(v=>Math.fround(v));a.max=mx.map(v=>Math.fround(v))}g.accessors.push(a);return g.accessors.length-1};
 const timeAcc=acc(new Float32Array(T),'SCALAR',5126,null,true),oneAcc=acc(new Float32Array([0]),'SCALAR',5126,null,true);
 const material=(name,color)=>{let c=hexRGB(color).map(srgb2lin);g.materials.push({name,pbrMetallicRoughness:{baseColorFactor:[...c,1],metallicFactor:0,roughnessFactor:.75}});return g.materials.length-1};
 const node=o=>{g.nodes.push(o);return g.nodes.length-1};
 // animate one node property from per-frame values (constant → stored as the node's own TRS, no channel)
 const animate=(ni,path,vals)=>{let n=path==='rotation'?4:3;if(path==='rotation')for(let i=n;i<vals.length;i+=n){let d=0;for(let k=0;k<4;k++)d+=vals[i+k]*vals[i-n+k];if(d<0)for(let k=0;k<4;k++)vals[i+k]=-vals[i+k]}
  let constant=true;for(let i=n;i<vals.length&&constant;i++)if(Math.abs(vals[i]-vals[i%n])>1e-6)constant=false;g.nodes[ni][path]=Array.from(vals.slice(0,n),v=>+v.toFixed(7));if(constant)return;
  let s=g.animations[0].samplers.push({input:timeAcc,output:acc(new Float32Array(vals),n===4?'VEC4':'VEC3',5126,null,false),interpolation:'LINEAR'})-1;g.animations[0].channels.push({sampler:s,target:{node:ni,path}})};
 const isIdent=(path,v)=>path==='rotation'?Math.abs(v[0])<1e-7&&Math.abs(v[1])<1e-7&&Math.abs(v[2])<1e-7&&Math.abs(v[3]-1)<1e-7:path==='scale'?v.every(x=>Math.abs(x-1)<1e-7):v.every(x=>Math.abs(x)<1e-7);
 // characters
 for(let c of p.characters){let id=c.id,ji={},names=['$root',...RIG.map(r=>r[0])];names.forEach((n,i)=>ji[n]=i);
  let nodeOf={};nodeOf.$root=node({name:id,extras:{character:id,name:c.name||'',desc:c.desc||''}});for(let [n,par,off] of RIG){nodeOf[n]=node({name:`${id}_${n}`,translation:off.slice()});let pi=nodeOf[par||'$root'];(g.nodes[pi].children||(g.nodes[pi].children=[])).push(nodeOf[n])}
  let mesh=mannequin(ji),mat=material(id,c.color),pos=acc(new Float32Array(mesh.P),'VEC3',5126,34962,true),nor=acc(new Float32Array(mesh.N),'VEC3',5126,34962,false),jo=acc(new Uint8Array(mesh.J),'VEC4',5121,34962,false),wArr=new Float32Array(mesh.J.length);for(let i=0;i<wArr.length;i+=4)wArr[i]=1;let we=acc(wArr,'VEC4',5126,34962,false),idx=acc(new Uint32Array(mesh.I),'SCALAR',5125,34963,false);
  g.meshes.push({name:id+'_mannequin',primitives:[{attributes:{POSITION:pos,NORMAL:nor,JOINTS_0:jo,WEIGHTS_0:we},indices:idx,material:mat}]});
  let ibm=new Float32Array(16*names.length);names.forEach((n,i)=>{let r=n==='$root'?[0,0,0]:REST[n];ibm.set([1,0,0,0,0,1,0,0,0,0,1,0,-r[0],-r[1],-r[2],1],i*16)});
  g.skins.push({name:id,joints:names.map(n=>nodeOf[n]),skeleton:nodeOf.$root,inverseBindMatrices:acc(ibm,'MAT4',5126,null,false)});
  let body=node({name:id+'_body',mesh:g.meshes.length-1,skin:g.skins.length-1});g.scenes[0].nodes.push(nodeOf.$root,body);
  let F=ts.length,rootT=new Float32Array(F*3),rootR=new Float32Array(F*4),rot={};for(let [n] of RIG)rot[n]=new Float32Array(F*4);
  ts.forEach((t,f)=>{let l=evalPose(p,id,t);rootT.set(l.pos,f*3);rootR.set(Q.euler(0,l.yaw*R,0),f*4);for(let [n] of RIG){let r=l.rot[n]||[0,0,0];rot[n].set(Q.euler(r[0]*R,r[1]*R,r[2]*R),f*4)}});
  animate(nodeOf.$root,'translation',rootT);animate(nodeOf.$root,'rotation',rootR);for(let [n] of RIG){animate(nodeOf[n],'rotation',rot[n]);if(isIdent('rotation',g.nodes[nodeOf[n]].rotation)&&!g.animations[0].channels.some(ch=>ch.target.node===nodeOf[n]))delete g.nodes[nodeOf[n]].rotation}}
 // props (unit cube scaled by size; world transform incl. being held)
 let cube=meshBuilder();cube.box([0,0,0],[1,1,1],0);let cP=acc(new Float32Array(cube.P),'VEC3',5126,34962,true),cN=acc(new Float32Array(cube.N),'VEC3',5126,34962,false),cI=acc(new Uint32Array(cube.I),'SCALAR',5125,34963,false);
 (p.objects||[]).forEach((o,i)=>{g.meshes.push({name:objectName(o,i),primitives:[{attributes:{POSITION:cP,NORMAL:cN},indices:cI,material:material(objectName(o,i),o.color||'#64748b')}]});let ni=node({name:objectName(o,i),mesh:g.meshes.length-1,extras:{desc:o.desc||''}});g.scenes[0].nodes.push(ni);
  let F=ts.length,tr=new Float32Array(F*3),rq=new Float32Array(F*4),sc=new Float32Array(F*3);ts.forEach((t,f)=>{let x=propTransform(p,i,t);tr.set(x.pos,f*3);rq.set(x.q,f*4);sc.set(x.size,f*3)});animate(ni,'translation',tr);animate(ni,'rotation',rq);animate(ni,'scale',sc);
  for(let path of ['rotation','scale'])if(isIdent(path,g.nodes[ni][path])&&!g.animations[0].channels.some(ch=>ch.target.node===ni&&ch.target.path===path))delete g.nodes[ni][path]});
 // camera (glTF cameras look down local −Z: columns = right, up, back)
 g.cameras.push({name:'Camera',type:'perspective',perspective:{yfov:42*R,znear:.05,zfar:100,aspectRatio:aspect}});let cn=node({name:'Camera',camera:0});g.scenes[0].nodes.push(cn);
 {let F=ts.length,tr=new Float32Array(F*3),rq=new Float32Array(F*4);ts.forEach((t,f)=>{let c=cameraAt(p,t);tr.set(c.pos,f*3);rq.set(quatFromBasis(c.right,c.up,c.back),f*4)});animate(cn,'translation',tr);animate(cn,'rotation',rq)}
 if(!g.animations[0].channels.length)g.animations=[];
 for(let k of ['skins','cameras','materials'])if(!g[k].length)delete g[k];
 let binLen=byteLen+(4-byteLen%4)%4;g.buffers.push({byteLength:binLen});
 let json=new TextEncoder().encode(JSON.stringify(g)),jsonLen=json.length+(4-json.length%4)%4,total=12+8+jsonLen+8+binLen,out=new Uint8Array(total),dv=new DataView(out.buffer);
 dv.setUint32(0,0x46546C67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);dv.setUint32(12,jsonLen,true);dv.setUint32(16,0x4E4F534A,true);out.set(json,20);out.fill(0x20,20+json.length,20+jsonLen);
 let o=20+jsonLen;dv.setUint32(o,binLen,true);dv.setUint32(o+4,0x004E4942,true);o+=8;for(let c of chunks){out.set(c,o);o+=c.length}return out}

// ------------------------------------------------------------------ OpenPose (COCO-18 body + 21-point hands), same colours as ControlNet/DWPose
export const OPENPOSE={
 limbs:[[1,2],[1,5],[2,3],[3,4],[5,6],[6,7],[1,8],[8,9],[9,10],[1,11],[11,12],[12,13],[1,0],[0,14],[14,16],[0,15],[15,17]],
 colors:[[255,0,0],[255,85,0],[255,170,0],[255,255,0],[170,255,0],[85,255,0],[0,255,0],[0,255,85],[0,255,170],[0,255,255],[0,170,255],[0,85,255],[0,0,255],[85,0,255],[170,0,255],[255,0,255],[255,0,170],[255,0,85]],
 handEdges:[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20]]};
// World keypoints from fk() output. Body order: nose, neck, R sho/elb/wri, L sho/elb/wri, R hip/knee/ankle, L hip/knee/ankle, R eye, L eye, R ear, L ear.
export function poseKeypoints(w){let P=w.pos,hq=w.q.head,loc=v=>V.add(P.head,Q.rot(hq,v)),body=[loc([0,.05,.10]),V.lerp(P.L_shoulder,P.R_shoulder,.5),P.R_shoulder,P.R_elbow,P.R_wrist,P.L_shoulder,P.L_elbow,P.L_wrist,P.R_hip,P.R_knee,P.R_ankle,P.L_hip,P.L_knee,P.L_ankle,loc([-.035,.085,.088]),loc([.035,.085,.088]),loc([-.105,.06,0]),loc([.105,.06,0])],hands={};
 for(let s of ['L','R']){let h=[P[s+'_wrist']];for(let f=0;f<5;f++){for(let b=0;b<3;b++)h.push(P[`${s}_finger${f}_${b}`]);let n=`${s}_finger${f}_2`;h.push(V.add(P[n],Q.rot(w.q[n],[0,-.025,0])))}hands[s]=h}return {body,hands}}
const hsv=h=>{let i=Math.floor(h*6),f=h*6-i,q=1-f,t=f,v=[[1,t,0],[q,1,0],[0,1,t],[0,q,1],[t,0,1],[1,0,q]][i%6];return v.map(x=>Math.round(x*255))};
// Draw on a 2D canvas context. project(p3) → [x,y] in pixels or null when behind the camera.
export function drawOpenPose(ctx,people,project,{width,height}){ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);let s=Math.max(1,Math.min(width,height)/720),stick=4*s,rad=4*s;
 for(let kp of people){let b=kp.body.map(project);OPENPOSE.limbs.forEach(([i,j],k)=>{let A=b[i],B=b[j];if(!A||!B)return;let c=OPENPOSE.colors[k],len=Math.hypot(B[0]-A[0],B[1]-A[1]);ctx.save();ctx.translate((A[0]+B[0])/2,(A[1]+B[1])/2);ctx.rotate(Math.atan2(B[1]-A[1],B[0]-A[0]));ctx.beginPath();ctx.ellipse(0,0,Math.max(len/2,.5),stick,0,0,2*Math.PI);ctx.fillStyle=`rgb(${c.map(v=>Math.floor(v*.6)).join(',')})`;ctx.fill();ctx.restore()});
  b.forEach((P,k)=>{if(!P)return;ctx.beginPath();ctx.arc(P[0],P[1],rad,0,2*Math.PI);ctx.fillStyle=`rgb(${OPENPOSE.colors[k].join(',')})`;ctx.fill()})}
 // hands: same look as ControlNet, but dots / lines shrink with the hand's size on screen so small hands stay readable
 for(let kp of people)for(let side of ['L','R']){let h=kp.hands[side].map(project),span=h[0]&&h[12]?Math.hypot(h[12][0]-h[0][0],h[12][1]-h[0][1]):0,r=Math.max(1,Math.min(rad,span/14)),lw=Math.max(1,Math.min(2*s,span/18));ctx.lineWidth=lw;ctx.lineCap='round';OPENPOSE.handEdges.forEach(([i,j],e)=>{if(!h[i]||!h[j])return;ctx.strokeStyle=`rgb(${hsv(e/OPENPOSE.handEdges.length).join(',')})`;ctx.beginPath();ctx.moveTo(...h[i]);ctx.lineTo(...h[j]);ctx.stroke()});
  for(let P of h){if(!P)continue;ctx.beginPath();ctx.arc(P[0],P[1],r,0,2*Math.PI);ctx.fillStyle='rgb(0,0,255)';ctx.fill()}}}

// ------------------------------------------------------------------ Google Flow pack (start/end frames + text-only prompts per short segment)
const colorWord=h=>{let [r,g,b]=hexRGB(h),mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,l=(mx+mn)/2;if(d<.12)return l>.8?'white':l<.2?'black':'grey';let hue=mx===r?((g-b)/d+6)%6:mx===g?(b-r)/d+2:(r-g)/d+4;hue*=60;let w=hue<15?'red':hue<45?'orange':hue<70?'yellow':hue<160?'green':hue<200?'cyan':hue<250?'blue':hue<290?'purple':hue<335?'pink':'red';return (l>.62&&w!=='yellow'?'light ':'')+w};
const limbName={R_wrist:'right hand',L_wrist:'left hand',R_ankle:'right foot',L_ankle:'left foot'};
function dirWords(v){let [f,u,l]=v,m=Math.hypot(f,u,l),w=[];if(Math.abs(f)>.4*m)w.push(f>0?'forward':'back');if(Math.abs(u)>.4*m)w.push(u>0?'up':'down');if(Math.abs(l)>.4*m)w.push(l>0?'to its left':'to its right');return w.join(' and ')||'slightly'}
// Plain-English description of what one character does between a and b (relative to its own facing at a).
export function describeMotion(p,id,a,b){let la=evalPose(p,id,a),lb=evalPose(p,id,b),yaw=la.yaw*R,F=[Math.sin(yaw),0,Math.cos(yaw)],Lf=[Math.cos(yaw),0,-Math.sin(yaw)],rel=v=>[V.dot(v,F),v[1],V.dot(v,Lf)],out=[];
 let d=rel(V.sub(lb.pos,la.pos));if(Math.abs(d[0])>.12)out.push(d[0]>0?`moves forward ${d[0].toFixed(1)} m`:`moves back ${(-d[0]).toFixed(1)} m`);if(Math.abs(d[2])>.12)out.push(`moves ${d[2]>0?'to its left':'to its right'} ${Math.abs(d[2]).toFixed(1)} m`);
 let dy=((lb.yaw-la.yaw+540)%360)-180;if(Math.abs(dy)>12)out.push(`turns ${Math.round(Math.abs(dy))}° to its ${dy>0?'left':'right'}`);
 let n=Math.max(2,Math.round((b-a)*p.fps)),hips=[],air=false,lim={};for(let k=0;k<=n;k++){let t=a+(b-a)*k/n,w=fk(evalPose(p,id,t));hips.push(w.pos.hips[1]);if(w.pos.L_ankle[1]>ANKLE_HEIGHT+.08&&w.pos.R_ankle[1]>ANKLE_HEIGHT+.08)air=true;for(let j in limbName)(lim[j]||(lim[j]=[])).push(rel(V.sub(w.pos[j],w.pos.hips)))}
 if(air)out.push('jumps (both feet leave the ground)');else{let lo=Math.min(...hips)-hips[0],hi=Math.max(...hips)-hips[0];if(lo<-.12)out.push(`lowers its body ${(-lo).toFixed(1)} m${hips.at(-1)-hips[0]>lo+.08?' then rises':''}`);else if(hi>.1)out.push(`rises ${hi.toFixed(1)} m`)}
 let moves=Object.entries(lim).map(([j,s])=>{let pk=0,pv=[0,0,0];for(let v of s){let dv=V.sub(v,s[0]),m=V.len(dv);if(m>pk){pk=m;pv=dv}}let net=V.len(V.sub(s.at(-1),s[0]));return {j,pk,pv,net}}).filter(m=>m.pk>.18).sort((x,y)=>y.pk-x.pk).slice(0,3);
 for(let m of moves){let fast=m.pk/(b-a)>2.5;out.push(`${limbName[m.j]} ${fast?'snaps':'moves'} ${dirWords(m.pv)} (${m.pk.toFixed(1)} m)${m.net<m.pk*.45?' and pulls back':''}`)}
 return out}
function camText(p,a,b){let A=cameraAt(p,a).state,B=cameraAt(p,b).state,{shot,angle,side}=camWords,da=B[0]-A[0],dd=B[2]-A[2],de=B[1]-A[1],mv=[Math.abs(da)>5?`orbit ${da>0?'left':'right'} ${Math.abs(Math.round(da))}°`:'',dd<-.3?'push in':dd>.3?'pull out':'',Math.abs(de)>6?(de>0?'crane up':'crane down'):''].filter(Boolean);return `${shot(A[2])}, ${angle(A[1])}, ${side(A[0])}${mv.length?`; camera moves: ${mv.join(', ')}`:'; static camera'}`}
export function makeFlowPack(p,{t0=0,t1=p.duration,seg=2,aspect='16:9'}={}){let fps=p.fps,snap=t=>Math.round(t*fps)/fps;t0=snap(Math.max(0,t0));t1=snap(Math.min(p.duration,t1));if(t1-t0<1/fps)throw Error('Vùng quá ngắn');
 let cuts=[t0];while(cuts.at(-1)+seg<t1-1e-6)cuts.push(snap(cuts.at(-1)+seg));if(t1-cuts.at(-1)<.25&&cuts.length>1)cuts.pop();cuts.push(t1);
 let fname=(i,t)=>`k${String(i).padStart(2,'0')}_${t.toFixed(2)}s.png`,frames=cuts.map((t,i)=>({t,file:fname(i,t)}));
 let who=p.characters.map(c=>`${c.id}${c.name?` = "${c.name}"`:''}${c.desc?` (${c.desc})`:''}`).join('; '),props=(p.objects||[]).map((o,i)=>`"${objectName(o,i)}"${o.desc?` (${o.desc})`:''}`).join('; ');
 let segments=[];for(let i=0;i<cuts.length-1;i++){let a=cuts[i],b=cuts[i+1],L=[];
  L.push(`SHOT ${i+1}/${cuts.length-1} · ${a.toFixed(2)}–${b.toFixed(2)}s (${(b-a).toFixed(1)} s) · ${aspect}`);L.push(`First frame: ${frames[i].file} · Last frame: ${frames[i+1].file} (both redrawn as the final characters).`);
  L.push(`Camera: ${camText(p,a,b)}.`);L.push('Action (one continuous move from the first frame to the last frame, keep this timing):');
  for(let n of (p.notes||[]).filter(n=>n.t<b-1e-6&&(n.until??n.t)>a+1e-6).sort((x,y)=>x.t-y.t))L.push(`- ${Math.max(a,n.t).toFixed(1)}–${Math.min(b,n.until??n.t).toFixed(1)}s: ${n.text}`);
  for(let c of p.characters){let d=describeMotion(p,c.id,a,b);L.push(`- ${c.id}: ${d.length?d.join('; '):'holds the pose (small breathing only)'}.`)}
  (p.objects||[]).forEach((o,k)=>{for(let h of propHolds(p,k)){if(h.from>a+1e-6&&h.from<b-1e-6)L.push(`- ${h.by} takes "${objectName(o,k)}" at ${h.from.toFixed(1)}s.`);if(h.to>a+1e-6&&h.to<b-1e-6&&!attachAt(p,k,h.to+1e-3)){let e=propTransform(p,k,b);L.push(`- ${h.by} lets go of "${objectName(o,k)}" at ${h.to.toFixed(1)}s${propLowest(e)<.05?'; it falls and lands on the floor':''}.`)}}});
  for(let ic of (p.intendedContacts||[]).filter(c=>c.from<b&&c.to>a))L.push(`- Intended contact ${ic.from.toFixed(1)}–${ic.to.toFixed(1)}s${ic.note?`: ${ic.note}`:''} (the hit must visibly land).`);
  L.push(`Characters: ${who}.${props?` Props: ${props}.`:''}`);L.push('Rules: one continuous shot, no cuts, no extra people, no text; feet stay planted unless stepping; keep the same character look as the first frame.');
  segments.push({i:i+1,a,b,prompt:L.join('\n')})}
 let imagePrompt=['Redraw this 3D pose reference as a finished film frame.','Keep EXACTLY: every limb angle of each character, their positions and size in the frame, the camera angle and framing.',...p.characters.map(c=>`- the ${colorWord(c.color)} mannequin = ${c.id}${c.name?` "${c.name}"`:''}${c.desc?`: ${c.desc}`:''}`),...(p.objects||[]).map((o,i)=>`- the box "${objectName(o,i)}" (${(o.size||[]).map(v=>+(+v).toFixed(2)).join('×')} m) = ${o.desc||objectName(o,i)}`),'Remove the mannequins, coloured outlines and grid floor; add a real setting. Style: [your style here]. No text.'].join('\n');
 let text=['=== PROMPT VẼ LẠI KHUNG (dùng cho mọi ảnh trong thư mục khung/) ===',imagePrompt,'',...segments.flatMap(s=>[`=== SHOT ${s.i} ===`,s.prompt,''])].join('\n');
 let readme=[`GÓI CHO GOOGLE FLOW · ${segments.length} đoạn · ${t0.toFixed(2)}–${t1.toFixed(2)}s · ${aspect} · tạo bởi AI Motion Studio ${APP_VERSION}`,'',
  '1) Vẽ lại khung: đưa từng ảnh trong thư mục khung/ (kèm ảnh nhân vật của anh) vào công cụ tạo ảnh (Gemini / Nano Banana, Higgsfield…), dán "PROMPT VẼ LẠI KHUNG" trong prompts.txt.',
  '2) Trong Flow chọn chế độ dùng ảnh làm khung đầu / khung cuối (Frames to Video):',...segments.map(s=>`   - Đoạn ${s.i}: khung đầu ${frames[s.i-1].file} → khung cuối ${frames[s.i].file}, dán prompt "SHOT ${s.i}"`),
  '   Khung cuối của đoạn trước = khung đầu của đoạn sau nên các clip nối liền nhau.','3) Ghép các clip theo thứ tự.','',
  'Lưu ý: Flow vẫn tự đoán chuyển động giữa hai khung; đoạn càng ngắn càng sát JSON. Muốn khớp tuyệt đối: dùng video điều khiển (tab Xuất) với công cụ video-to-video, hoặc file .glb / .bvh trong Blender.'].join('\n');
 return {frames,segments,imagePrompt,text,readme}}

// ------------------------------------------------------------------ ZIP (store, no compression; UTF-8 names)
const CRC=(()=>{let t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
export function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
export function zipStore(files,date=new Date()){let enc=new TextEncoder(),parts=[],central=[],off=0,dos=((((date.getFullYear()-1980)&127)<<25)|((date.getMonth()+1)<<21)|(date.getDate()<<16)|(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1))>>>0;
 for(let f of files){let name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data instanceof Uint8Array?f.data:new Uint8Array(f.data),crc=crc32(data),h=new DataView(new ArrayBuffer(30)),c=new DataView(new ArrayBuffer(46));
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(10,dos,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint32(12,dos,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,off,true);
  parts.push(new Uint8Array(h.buffer),name,data);central.push(new Uint8Array(c.buffer),name);off+=30+name.length+data.length}
 let cs=central.reduce((n,a)=>n+a.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
 let all=[...parts,...central,new Uint8Array(e.buffer)],out=new Uint8Array(all.reduce((n,a)=>n+a.length,0)),o=0;for(let a of all){out.set(a,o);o+=a.length}return out}
