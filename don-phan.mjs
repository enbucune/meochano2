// "Đòn phản" — built ONLY with AI Motion Studio v0.13 SDK commands + SDK measurements (no hand-set joint angles).
// Usage (from the app folder): node examples/don-phan.mjs . out
import fs from 'fs';import path from 'path';import {pathToFileURL} from 'url';
const [ROOT='.',OUT='out']=process.argv.slice(2);const U=pathToFileURL(path.resolve(ROOT)).href;const C=await import(U+'/core.js?v=0.20'),L=await import(U+'/library.js?v=0.20');
const log=(...a)=>console.log(...a),R=Math.PI/180;
const run=(p,cmds)=>{let r=L.runCommands(p,cmds),bad=r.results.filter(x=>!x.ok);if(bad.length)throw Error(JSON.stringify(bad));return r};
const pos=(p,id,j,t)=>L.worldAt(p,id,t).pos[j];
// root of an increasing function f on [lo,hi]
const bisect=(f,lo,hi,n=30)=>{for(let i=0;i<n;i++){let m=(lo+hi)/2;if(f(m)>0)hi=m;else lo=m}return (lo+hi)/2};

// 1. Blocking
const base=run(null,[{op:'fps',value:30},{op:'duration',value:10},
 {op:'character',id:'A',position:[-2.4,0,0],yaw:90,color:'#65caff'},{op:'character',id:'B',position:[1.0,0,0],yaw:-90,color:'#ff9865'},
 {op:'pose',actor:'A',name:'guard',at:0},{op:'pose',actor:'B',name:'guard',at:0}]).project;

// 2–3. A closes the distance and punches; B slips outside exactly at the extension.
// Search (shortest punch gap, slip depth ≤ 0.4) until A's arm clears B's body by ≥ 2 cm.
const stage2=(d)=>{let r=run(base,[{op:'approach',actor:'A',target:'B',at:.5,distance:d,note:'A tiến vào, khép khoảng cách'},{op:'motion',actor:'A',name:'punch',at:'end+0.15',note:'A tung cú đấm thẳng tay phải'}]);return {p:r.project,punch:r.results[1]}};
let P,punch,tImpact,P3,slip,gap,dA;const clearIn=(p,a,b)=>{let m=9;for(let t=a;t<=b;t+=1/30)m=Math.min(m,L.inspect(p,t).pairs[0].clearance);return m};
search:for(gap of [.13,.18,.23,.28,.33]){dA=bisect(d=>{let {p,punch}=stage2(d),t=punch.start+.38;return pos(p,'B','head',t)[0]-pos(p,'A','R_wrist',t)[0]-gap},0.4,2.5);({p:P,punch}=stage2(dA));tImpact=+(punch.start+.38).toFixed(4);
 for(slip=.32;slip<=.401;slip+=.04){P3=run(P,[{op:'motion',actor:'B',name:'dodge',at:+(tImpact-.26).toFixed(4),side:'R',distance:+slip.toFixed(2),note:'B lách ra ngoài đúng lúc nắm đấm vươn tới'}]).project;if(clearIn(P3,punch.start+.2,punch.end)>=.02)break search}}
log(`A approach → hips ${dA.toFixed(3)} m · punch ${punch.start.toFixed(2)}s, extension ${tImpact}s · aimed ${gap} m short of B's head · B slip ${slip.toFixed(2)} m → clearance ${clearIn(P3,punch.start+.2,punch.end).toFixed(3)} m`);
const dodgeEnd=L.findTrack(P3,'B','$root','z').keys.at(-1)[0];log(`fist misses B head by ${Math.hypot(...pos(P3,'B','head',tImpact).map((v,i)=>v-pos(P3,'A','R_wrist',tImpact)[i])).toFixed(2)} m`);

// 4. Counter: B steps in, presents the kicking side (shortest pivot), side-kicks; IK puts the foot on A's torso
function plan(KS){let kp={pos:[0,0,0],yaw:0,rot:{}};for(let [j,v] of Object.entries(KS==='R'?L.POSES.kick.joints:L.mirrorJoints(L.POSES.kick.joints)))kp.rot[j]=v;let fo=C.fk(kp).pos[KS+'_ankle'],reachSide=Math.abs(fo[0]);
 let r=run(P3,[{op:'approach',actor:'B',target:'A',at:+(dodgeEnd+.05).toFixed(4),distance:+(reachSide+.15).toFixed(3),note:'B áp sát'},
  {op:'face',actor:'B',target:'A',at:'end',offset:KS==='L'?-90:90,duration:.3},
  {op:'motion',actor:'B',name:'kick',at:'end',side:KS,note:`B xoay trụ, đá ngang chân ${KS==='L'?'trái':'phải'} vào thân A`}]);
 let kick=r.results[2],tK=+(kick.start+.5).toFixed(4);return {KS,p:r.project,kick,tK,turn:Math.abs(r.results[1].turn)}}
const plans=['L','R'].map(plan);for(let q of plans)log(`  plan ${q.KS}-leg: pivot ${q.turn.toFixed(1)}°`);const best=plans.sort((a,b)=>a.turn-b.turn)[0];
let {p:P4,kick,tK,KS}=best;
let rr=run(P4,[{op:'reach',actor:'B',limb:KS+'_foot',target:{actor:'A',joint:'spine',offset:[0,.08,0]},at:tK,stop:.22,hold:.12,ease:'strike'},
 {op:'face',actor:'B',target:'A',at:+kick.end.toFixed(4),duration:.3}]);P4=rr.project;const ik=rr.results[0];
log(`kick ${KS}-leg · contact ${tK}s · IK error ${ik.error} m · hips lean ${ik.hipsLean}°`);

// 5. A blocks high (too late), takes the kick, knocked down. Mark the hit as an intended contact.
let r5=run(P4,[{op:'pose',actor:'A',name:'guard',at:+(tK-.55).toFixed(4)},
 {op:'motion',actor:'A',name:'block',at:+(tK-.3).toFixed(4),note:'A giơ tay đỡ cao, hở bụng'},
 {op:'motion',actor:'A',name:'fall',at:+(tK+.04).toFixed(4),speed:1.15,note:'Trúng đòn: A bật ngửa ra sau'},
 {op:'allowContact',from:+(tK-.1).toFixed(4),to:+(tK+.35).toFixed(4),actors:['A','B']}]);let P5=r5.project,fallEnd=r5.results[2].end;

// 6. B walks up and points down at A
let r6=run(P5,[{op:'approach',actor:'B',target:'A',at:+(fallEnd+.2).toFixed(4),distance:1.3,note:'B tiến tới, đứng phía chân A'},
 {op:'pose',actor:'B',name:'point',at:'end+0.25',ease:'easeOut'}]);let P6=r6.project,tPoint=+(r6.results[0].end+.25).toFixed(4);
run(P6,[]);let rp=L.reach(P6,'B','R_hand',{actor:'A',joint:'head'},tPoint,{ease:'easeOut'});L.addNote(P6,{t:tPoint,until:10,actor:'B',text:'B chỉ tay xuống A — giữ khung đến hết'});
log(`B points at ${tPoint}s (arm aimed by IK, residual ${rp.error} m = target beyond arm length)`);

// 7. Camera: framing per beat; final shot perpendicular to the B→A line
let bh=pos(P6,'B','hips',tPoint),ah=pos(P6,'A','head',tPoint),line=Math.atan2(ah[0]-bh[0],ah[2]-bh[2])/R,endAz=[line+90,line-90].map(a=>((a%360)+540)%360-180).sort((a,b)=>Math.abs(a-60)-Math.abs(b-60))[0];
P6.cameraKeys=[];for(let [at,az,el,ease,pad] of [[0,18,10,'smooth',1.25],[tImpact-.6,28,8,'easeInOut',1.25],[tK,42,6,'easeOut',1.25],[fallEnd,60,14,'easeInOut',1.4],[tPoint,endAz,16,'easeInOut',1.6],[10,endAz+6,18,'linear',1.6]])L.frameCamera(P6,{at:+at.toFixed(4),azimuth:+az.toFixed(1),elevation:el,ease,padding:pad});
P6.duration=10;

// 8. Verify, bake, verify again
let rep=C.fullReport(P6);log('native check:',JSON.stringify(rep.summary));for(let w of rep.validation.warnings)log('  ',w);for(let i of rep.motion)log('  ',i.severity,i.code,i.message,i.from,'-',i.to,i.peak);
let {project:B11,report:bk,intendedContacts:IC}=L.bakeProject(P6);let rb=C.fullReport({...B11,intendedContacts:IC});log('baked:',JSON.stringify(bk),'check:',JSON.stringify(rb.summary));for(let i of rb.motion)log('  ',i.severity,i.code,i.message,i.from,'-',i.to);for(let w of rb.validation.warnings)log('  ',w);
fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(OUT+'/project.v013.json',C.stringifyProject(P6));fs.writeFileSync(OUT+'/project.json',JSON.stringify(B11));
fs.writeFileSync(OUT+'/bao-cao-kiem-tra.json',JSON.stringify({native:rep,baked:{bake:bk,...rb}},null,1));
fs.writeFileSync(OUT+'/beats.json',JSON.stringify({tImpact,tKick:tK,kickLeg:KS,tPoint,kickStart:kick.start,fallEnd}));
