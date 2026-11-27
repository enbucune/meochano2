// AI Motion Studio CLI for agents. Same JSON + same functions as the web UI.
//   node ams-cli.mjs catalog                         → poses, motions, eases, commands, joints (JSON)
//   node ams-cli.mjs build <commands.json> <out.json> → run commands (file: [..] or {"base":"project.json","commands":[..]})
//   node ams-cli.mjs check <project.json> [report.json] → validation + motion check (exit 1 on errors)
//   node ams-cli.mjs validate <project.json>
//   node ams-cli.mjs optimize <in.json> [out.json]   → lossless key reduction
//   node ams-cli.mjs prompt <project.json> [16:9]    → video prompt text
//   node ams-cli.mjs inspect <project.json> <time>    → world positions, facing, contacts, distances between characters
//   node ams-cli.mjs bake <in.json> <out.json>       → plain v0.11 JSON (foot lock, presets, eases baked; opens in every version)
//   node ams-cli.mjs brief <in.json> <out.json> [standard|detailed|max] → ai-brief.json: scene written for another AI (beats, hits, poses, camera, joint trajectories)
//   node ams-cli.mjs glb <in.json> <out.glb>        → glTF binary: skinned mannequins + props + camera + animation (Blender / Unreal / Unity)
//   node ams-cli.mjs bvh <in.json> <actor> <out.bvh> → BVH motion capture of one character
//   node ams-cli.mjs flow <in.json> [seconds]        → Google Flow prompts (text-only, per segment)
import fs from 'fs';import path from 'path';
import {migrate,validate,optimize,stringifyProject,fullReport} from './core.js?v=0.23';
import {runCommands,makePrompt,catalog,inspect,bakeProject,makeAiBrief,stringifyBrief} from './library.js?v=0.23';
import {makeGLB,makeBVH,makeFlowPack} from './exporters.js?v=0.23';
const [cmd,a,b]=process.argv.slice(2),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const usage=()=>{console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\n').slice(1,13).join('\n').replace(/^\/\/ ?/gm,''));process.exit(2)};
switch(cmd){
 case 'catalog':console.log(JSON.stringify(catalog(),null,1));break;
 case 'build':{if(!a||!b)usage();let spec=read(a),cmds=Array.isArray(spec)?spec:spec.commands,base=spec.base?read(path.resolve(path.dirname(a),spec.base)):spec.project||null;
  let {project,results}=runCommands(base,cmds);for(let r of results)if(!r.ok)console.log(`✖ #${r.i} ${r.op}: ${r.error}`);fs.writeFileSync(b,stringifyProject(project));let rep=fullReport(project);
  console.log(`${results.filter(r=>r.ok).length}/${results.length} lệnh OK → ${b} · ${project.duration}s · kiểm tra: ${rep.summary.errors} lỗi, ${rep.summary.warnings} cảnh báo`);for(let i of rep.motion.slice(0,15))console.log(`  ${i.severity==='error'?'✖':'⚠'} ${i.code} ${i.message} @${i.from}s → ${i.fix}`);process.exit(results.some(r=>!r.ok)||rep.summary.errors?1:0)}
 case 'check':{if(!a)usage();let rep=fullReport(migrate(read(a)));if(b)fs.writeFileSync(b,JSON.stringify(rep,null,1));for(let m of rep.validation.errors)console.log('✖',m);for(let m of rep.validation.warnings)console.log('⚠',m);for(let i of rep.motion)console.log(`${i.severity==='error'?'✖':i.severity==='warning'?'⚠':'ℹ'} ${i.code} ${i.from}–${i.to}s ${i.message} → ${i.fix}`);console.log(`${rep.summary.errors} lỗi, ${rep.summary.warnings} cảnh báo`);process.exit(rep.summary.errors?1:0)}
 case 'validate':{if(!a)usage();let r=validate(migrate(read(a)));for(let m of r.errors)console.log('✖',m);for(let m of r.warnings)console.log('⚠',m);console.log(`${r.errors.length} lỗi, ${r.warnings.length} cảnh báo`);process.exit(r.errors.length?1:0)}
 case 'optimize':{if(!a)usage();let p=migrate(read(a)),r=validate(p);if(r.errors.length){console.log(r.errors.join('\n'));process.exit(1)}let {project,report}=optimize(p);fs.writeFileSync(b||a,stringifyProject(project));console.log(`Tối ưu: ${report.keysBefore} → ${report.keysAfter} key, ${report.tracksBefore} → ${report.tracksAfter} track → ${b||a}`);break}
 case 'prompt':{if(!a)usage();console.log(makePrompt(migrate(read(a)),{aspect:b||'16:9'}));break}
 case 'inspect':{if(!a||b===undefined)usage();console.log(JSON.stringify(inspect(migrate(read(a)),+b),null,1));break}
 case 'bake':{if(!a||!b)usage();let p=migrate(read(a)),v=validate(p);if(v.errors.length){console.log(v.errors.join('\n'));process.exit(1)}let {project,report,intendedContacts}=bakeProject(p);fs.writeFileSync(b,JSON.stringify(project));let rep=fullReport({...project,intendedContacts});console.log(`Bake → ${b}: ${report.tracks} track, ${report.keys} key, sai lệch khớp tối đa ${report.maxJointError_mm} mm · kiểm tra bản bake: ${rep.summary.errors} lỗi, ${rep.summary.warnings} cảnh báo`);if(report.notes.length)console.log('Ghi chú (v0.11 không hiển thị, giữ ở file riêng):\n'+report.notes.map(n=>`  ${n.t}${n.until!==undefined?'–'+n.until:''}s ${n.text}`).join('\n'));break}
 case 'brief':{if(!a||!b)usage();let lv=process.argv[5]||'detailed',p=migrate(read(a)),v=validate(p);if(v.errors.length){console.log(v.errors.join('\n'));process.exit(1)}let br=makeAiBrief(p,{level:lv}),txt=stringifyBrief(br);fs.writeFileSync(b,txt);console.log(`ai-brief (${lv}) → ${b}: ${(txt.length/1024).toFixed(0)} KB · ${br.beats.length} nhịp · ${br.trajectory.samples} mẫu × ${br.trajectory.joints.length} khớp`);for(let x of br.beats.filter(x=>x.result))console.log(`  ${x.from}s ${x.actor} ${x.action||''} → ${x.target||''}: ${x.result}${x.impact?` (${x.impact.with} → ${x.impact.on})`:''}`);break}
 case 'glb':{if(!a||!b)usage();let p=migrate(read(a)),v=validate(p);if(v.errors.length){console.log(v.errors.join('\n'));process.exit(1)}let g=makeGLB(p);fs.writeFileSync(b,g);console.log(`→ ${b} · ${(g.length/1024).toFixed(0)} KB · ${p.characters.length} nhân vật, ${(p.objects||[]).length} vật thể, camera, ${p.duration}s @ ${p.fps} fps`);break}
 case 'bvh':{let out=process.argv[5];if(!a||!b||!out)usage();let p=migrate(read(a));fs.writeFileSync(out,makeBVH(p,b));console.log(`→ ${out} · ${b} · ${Math.round(p.duration*p.fps)+1} frame`);break}
 case 'flow':{if(!a)usage();let fp=makeFlowPack(migrate(read(a)),{seg:+b||2});console.log(fp.text);break}
 default:usage()}
