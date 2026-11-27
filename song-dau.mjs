// "Song đấu" — trận đánh 5 pha, dựng 100% bằng SDK v0.13: đo → đặt → kiểm tra → sửa.
import fs from 'fs';import path from 'path';import {pathToFileURL} from 'url';
// Usage (from the app folder): node examples/song-dau.mjs . out
const [ROOT='.',OUT='out']=process.argv.slice(2);const U=pathToFileURL(path.resolve(ROOT)).href;const C=await import(U+'/core.js?v=0.20'),L=await import(U+'/library.js?v=0.20');
const log=(...a)=>console.log(...a);
const run=(p,cmds)=>{let r=L.runCommands(p,cmds),bad=r.results.filter(x=>!x.ok);if(bad.length)throw Error(JSON.stringify(bad));return r};
const W=(p,id,j,t)=>L.worldAt(p,id,t).pos[j],copy=p=>JSON.parse(JSON.stringify(p));
const clear=(p,a,b)=>{let m=9;for(let t=a;t<=b;t+=1/30)m=Math.min(m,L.inspect(p,t).pairs[0].clearance);return m};
const bisect=(f,lo,hi,n=22)=>{for(let i=0;i<n;i++){let m=(lo+hi)/2;if(f(m)>0)hi=m;else lo=m}return (lo+hi)/2};// root of increasing f
const tp=(p,target,t)=>L.targetPoint(p,target,t);
// Side kick planner: approach distance solved so the natural kick lands `stop` m short of the target; then IK finishes it.
function sideKick(p0,att,def,at,side,target,{stop=.18,note}={}){const build=d=>{let p=copy(p0);let r=run(p,[{op:'approach',actor:att,target:def,at,distance:+d.toFixed(3),note:`${att} áp sát`},{op:'face',actor:att,target:def,at:'end',offset:side==='L'?-90:90,duration:.25},{op:'motion',actor:att,name:'kick',at:'end',side,note}]);return {p:r.project,kick:r.results[2]}};
 const f=d=>{let {p,kick}=build(d),t=kick.start+.5,a=W(p,att,side+'_ankle',t),q=tp(p,target,t);return Math.hypot(a[0]-q[0],a[2]-q[2])-stop};
 let d=bisect(f,.55,1.8),{p,kick}=build(d),tk=+(kick.start+.5).toFixed(4);return {p,kick,tk,d}}

let p=run(null,[{op:'fps',value:30},{op:'duration',value:30},
 {op:'character',id:'A',position:[-2.4,0,0],yaw:90,color:'#65caff'},{op:'character',id:'B',position:[1.2,0,0],yaw:-90,color:'#ff9865'},
 {op:'pose',actor:'A',name:'guard',at:0},{op:'pose',actor:'B',name:'guard',at:0},{op:'note',at:0,until:.9,text:'Hai bên thủ thế, dò xét'}]).project;

// Pha 1 — A áp sát, đấm thẳng phải; B đỡ (nắm đấm chạm tay đỡ)
let r=run(p,[{op:'approach',actor:'A',target:'B',at:.9,distance:.95,note:'A tiến vào'},{op:'motion',actor:'A',name:'punch',at:'end+0.1',note:'Pha 1: A đấm thẳng phải — B đỡ'}]);p=r.project;
const pun1=r.results[1],t1=+(pun1.start+.38).toFixed(4);p=run(p,[{op:'motion',actor:'B',name:'block',at:+(t1-.14).toFixed(4),note:'B giơ tay đỡ'}]).project;
let h=L.reach(p,'A','R_hand',{actor:'B',joint:'L_wrist'},t1,{stop:.07,ease:'strike'});L.allowContact(p,{from:t1-.08,to:t1+.12,actors:['A','B']});log(`P1 punch ${t1}s → block, IK ${h.error}`);

// Pha 2 — B phản đòn; A lách ra ngoài (khoảng hở ≥ 2 cm), rồi lùi giãn khoảng cách
r=run(p,[{op:'motion',actor:'B',name:'punch',at:+(pun1.end-.05).toFixed(4),note:'Pha 2: B phản đòn — A lách'}]);p=r.project;const pun2=r.results[0],t2=+(pun2.start+.38).toFixed(4);
let b2=copy(p),slip;for(slip=.24;slip<=.401;slip+=.04){p=copy(b2);p=run(p,[{op:'motion',actor:'A',name:'dodge',at:+(t2-.26).toFixed(4),side:'R',distance:+slip.toFixed(2),note:'A lách ra ngoài'}]).project;if(clear(p,pun2.start+.2,pun2.end)>=.02)break}
r=run(p,[{op:'motion',actor:'A',name:'walk',at:+(t2-.26+.85).toFixed(4),distance:-.5,note:'A lùi lấy khoảng cách'}]);p=r.project;const back2=r.results[0];
log(`P2 B punch ${t2}s · A slip ${slip.toFixed(2)} (clear ${clear(p,pun2.start+.2,pun2.end).toFixed(3)}) · A steps back to ${back2.end.toFixed(2)}s`);

// Pha 3 — A lao vào đấm trái trúng thân B; B gập người rồi lùi
r=run(p,[{op:'approach',actor:'A',target:'B',at:+(back2.end+.15).toFixed(4),distance:.8,note:'A lao vào'},{op:'motion',actor:'A',name:'punch',at:'end',side:'L',note:'Pha 3: A đấm trái trúng thân B'}]);p=r.project;
const pun3=r.results[1],t3=+(pun3.start+.38).toFixed(4);p=run(p,[{op:'pose',actor:'B',name:'block',at:+(t3-.22).toFixed(4),ease:'easeOut'},{op:'note',at:+(t3-.22).toFixed(4),text:'B che mặt — hở sườn'}]).project;h=L.reach(p,'A','L_hand',{actor:'B',joint:'spine',offset:[0,.02,0]},t3,{stop:.14,ease:'strike'});L.allowContact(p,{from:t3-.08,to:t3+.15,actors:['A','B']});
p=run(p,[{op:'joints',actor:'B',at:+(t3+.12).toFixed(4),joints:{chest:[30,0,0],head:[25,0,0],spine:[10,0,0]},ease:'easeOut'},{op:'pose',actor:'B',name:'guard',at:+(t3+.55).toFixed(4),ease:'easeInOut'}]).project;
r=run(p,[{op:'motion',actor:'B',name:'walk',at:+(t3+.6).toFixed(4),distance:-.8,note:'B lùi lại, lấy lại nhịp'}]);p=r.project;const back3=r.results[0];
log(`P3 hook ${t3}s → B body, IK ${h.error} · B backs off until ${back3.end.toFixed(2)}s`);

// Pha 4 — B xoay người lấy đà (đủ xa: đo khoảng hở), áp sát, đá ngang phải; A đỡ
r=run(p,[{op:'motion',actor:'B',name:'spin',at:+(back3.end+.1).toFixed(4),note:'Pha 4: B xoay người lấy đà'}]);p=r.project;const spin=r.results[0];log(`P4 spin clearance ${clear(p,spin.start,spin.end).toFixed(3)} m`);
let k4=sideKick(p,'B','A',+(spin.end+.05).toFixed(4),'R',{actor:'A',joint:'chest',offset:[0,-.12,0]},{note:'B đá ngang phải — A đỡ'});p=k4.p;
p=run(p,[{op:'motion',actor:'A',name:'block',at:+(k4.tk-.14).toFixed(4),note:'A đỡ cú đá'}]).project;
h=L.reach(p,'B','R_foot',{actor:'A',joint:'chest',offset:[0,-.12,0]},k4.tk,{stop:.18,hold:.1,ease:'strike'});L.allowContact(p,{from:k4.tk-.08,to:k4.tk+.2,actors:['A','B']});
r=run(p,[{op:'face',actor:'B',target:'A',at:+k4.kick.end.toFixed(4),duration:.25},{op:'motion',actor:'B',name:'walk',at:+(k4.kick.end+.3).toFixed(4),distance:-.6,note:'B lùi về thế thủ'}]);p=r.project;const back4=r.results[1];
log(`P4 kick ${k4.tk}s (approach ${k4.d.toFixed(2)} m) → A guard, IK ${h.error}, lean ${h.hipsLean}`);

// Pha 5 — A đá ngang trái quyết định vào thân B → B ngã; A thủ thế rồi giơ tay
let k5=sideKick(p,'A','B',+(back4.end+.2).toFixed(4),'L',{actor:'B',joint:'spine',offset:[0,.08,0]},{stop:.2,note:'Pha 5: A đá ngang trái quyết định'});p=k5.p;
h=L.reach(p,'A','L_foot',{actor:'B',joint:'spine',offset:[0,.08,0]},k5.tk,{stop:.2,hold:.1,ease:'strike'});L.allowContact(p,{from:k5.tk-.08,to:k5.tk+.3,actors:['A','B']});
r=run(p,[{op:'motion',actor:'B',name:'fall',at:+(k5.tk+.04).toFixed(4),speed:1.1,note:'B trúng đòn, ngã ngửa'},{op:'face',actor:'A',target:'B',at:+k5.kick.end.toFixed(4),duration:.3},{op:'pose',actor:'A',name:'guard',at:+(k5.kick.end+.35).toFixed(4)}]);p=r.project;const fall=r.results[0];
const tWin=+(fall.end+.4).toFixed(4);p=run(p,[{op:'pose',actor:'A',name:'victory',at:tWin,ease:'easeOut'},{op:'note',at:tWin,text:'A giơ tay chiến thắng, B nằm sàn'}]).project;
log(`P5 kick ${k5.tk}s (approach ${k5.d.toFixed(2)} m), IK ${h.error}, lean ${h.hipsLean} · B down ${fall.end.toFixed(2)}s`);
const tEnd=+(Math.ceil((tWin+1.6)*10)/10).toFixed(1);p.duration=tEnd;

// Camera theo nhịp (điểm nhìn + khoảng cách do SDK tính)
p.cameraKeys=[];for(let [at,az,el,ease,pad] of [[0,10,10,'smooth',1.25],[t1-.4,25,8,'easeInOut',1.3],[t2,-15,8,'easeInOut',1.3],[t3,15,6,'easeOut',1.3],[spin.start+.3,40,10,'easeInOut',1.35],[k4.tk,55,6,'easeOut',1.3],[k5.tk,30,6,'easeOut',1.3],[fall.end,15,16,'easeInOut',1.5],[tEnd,5,18,'linear',1.55]])L.frameCamera(p,{at:+Math.min(at,tEnd).toFixed(4),azimuth:az,elevation:el,ease,padding:pad});

let rep=C.fullReport(p);log('CHECK',JSON.stringify(rep.summary));for(let w of rep.validation.warnings)log('  ',w);for(let i of rep.motion)log('  ',i.severity,i.code,i.message,i.from,'-',i.to,(+i.peak).toFixed(3));
fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(OUT+'/native.json',C.stringifyProject(p));
fs.writeFileSync(OUT+'/beats.json',JSON.stringify({t1,t2,t3,t4:k4.tk,t5:k5.tk,spin:spin.start,fallEnd:fall.end,tWin,tEnd}));
