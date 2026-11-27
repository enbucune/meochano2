// "Kiếm rơi" — A chém, B lách, chặt vào cổ tay cầm kiếm, kiếm văng rơi xuống sàn. 100% SDK v0.19.
// Usage (from the app folder): node examples/kiem-roi.mjs . out
import fs from 'fs';import path from 'path';import {pathToFileURL} from 'url';
const [ROOT='.',OUT='out']=process.argv.slice(2);const U=pathToFileURL(path.resolve(ROOT)).href;const C=await import(U+'/core.js?v=0.23'),L=await import(U+'/library.js?v=0.23');
const run=(p,cmds)=>{let r=L.runCommands(p,cmds),bad=r.results.filter(x=>!x.ok);if(bad.length)throw Error(JSON.stringify(bad));return r};
let r=run(null,[{op:'fps',value:30},{op:'duration',value:8},
 {op:'character',id:'A',name:'Kiếm sĩ áo đen',desc:'nam, áo choàng đen, tóc buộc cao',position:[-1.0,0,0],yaw:90,color:'#65caff'},
 {op:'character',id:'B',name:'Võ sư áo cam',desc:'nữ, võ phục cam, tay không',position:[0.95,0,0],yaw:-90,color:'#ff9865'},
 {op:'object',name:'Kiếm',desc:'kiếm katana thép sáng, chuôi quấn vải đen',position:[-.75,.9,.3],size:[.04,.9,.06],color:'#c9d3dd'},
 {op:'pose',actor:'A',name:'sword_ready',at:0},{op:'pose',actor:'B',name:'guard',at:0},
 {op:'grab',object:'Kiếm',actor:'A',hand:'R',at:0},{op:'snapToHand',object:'Kiếm',at:0},
 {op:'motion',actor:'A',name:'swing_sword',at:.8,note:'A vung kiếm chém xuống'}]);let p=r.project,sw=r.results[9];
const tSlash=+(sw.start+.55).toFixed(4);
p=run(p,[{op:'motion',actor:'B',name:'dodge',at:+(tSlash-.26).toFixed(4),side:'R',distance:.38,note:'B lách tránh nhát chém'}]).project;
const dEnd=L.findTrack(p,'B','$root','z').keys.at(-1)[0];
// B steps in and strikes A's sword wrist: try both hands, approach distance solved by bisection, IK finishes the strike
const bisect=(f,lo,hi,n=22)=>{for(let i=0;i<n;i++){let m=(lo+hi)/2;if(f(m)>0)hi=m;else lo=m}return (lo+hi)/2};
function plan(side){const build=d=>{let q=JSON.parse(JSON.stringify(p));let rr=run(q,[{op:'approach',actor:'B',target:'A',at:+(dEnd+.05).toFixed(4),distance:+d.toFixed(3),note:'B áp sát'},{op:'motion',actor:'B',name:'punch',at:'end',side,note:`B chặt tay ${side==='L'?'trái':'phải'} vào tay cầm kiếm sát ngực A`}]);return {q,pun:rr.results[1],q2:rr.project}};
 const gapAt=d=>{let {q2,pun}=build(d),t=pun.start+.38,a=L.worldAt(q2,'B',side+'_wrist'===side+'_wrist'?t:t).pos[side+'_wrist'],w=L.worldAt(q2,'A',t).pos.R_wrist;return Math.hypot(a[0]-w[0],a[1]-w[1],a[2]-w[2])-.06};
 let d=bisect(gapAt,.6,1.8),b=build(d),q=b.q2,tHit=+(b.pun.start+.38).toFixed(4),h=L.reach(q,'B',side+'_hand',{actor:'A',joint:'R_wrist'},tHit,{stop:0,ease:'strike'});L.allowContact(q,{from:+(b.pun.start).toFixed(4),to:+(b.pun.end).toFixed(4),actors:['A','B']});
 let rep=C.fullReport(q);return {side,q,pun:b.pun,tHit,h,score:rep.summary.errors*100+rep.summary.warnings+h.error*10}}
let best=['L','R'].map(plan).sort((a,b)=>a.score-b.score)[0];p=best.q;const kick=best.pun,tHit=best.tHit,h=best.h;console.log(`strike hand ${best.side}`);
let drop=L.dropObject(p,'Kiếm',+(tHit+.03).toFixed(4));
p=run(p,[{op:'note',at:+(tHit+.03).toFixed(4),until:drop.landAt,text:'Kiếm văng khỏi tay A, rơi xuống sàn'},{op:'face',actor:'B',target:'A',at:+(kick.end).toFixed(4),duration:.25},
 {op:'motion',actor:'A',name:'walk',at:+(tHit+.25).toFixed(4),distance:-.6,note:'A lùi lại, tay không'},{op:'pose',actor:'A',name:'guard',at:'end+0.1'},
 {op:'note',at:+(drop.landAt+.4).toFixed(4),until:8,text:'Hai bên thủ thế, thanh kiếm nằm giữa sàn'}]).project;
p.cameraKeys=[];for(let [at,az,el,pad] of [[0,15,10,1.3],[tSlash,30,8,1.3],[tHit,50,8,1.3],[drop.landAt+.5,20,18,1.5],[8,10,20,1.55]])L.frameCamera(p,{at,azimuth:az,elevation:el,padding:pad});
let rep=C.fullReport(p);console.log(`slash ${tSlash}s · wrist strike ${tHit}s (IK ${h.error} m) · sword lands ${drop.landAt}s at`,drop.landing,'· check',JSON.stringify(rep.summary));for(let i of rep.motion)console.log('  ',i.severity,i.code,i.message,i.from,'-',i.to);for(let w of rep.validation.warnings)console.log('  ',w);
fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(OUT+'/kiem-roi.json',C.stringifyProject(p));
