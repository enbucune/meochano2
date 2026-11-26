// Usage: node ams-cli.mjs validate <file.json>   |   node ams-cli.mjs optimize <in.json> [out.json]
import fs from 'fs';import {migrate,validate,optimize,stringifyProject} from './core.js';
const [cmd,inp,out]=process.argv.slice(2);
if(!['validate','optimize'].includes(cmd)||!inp){console.log('node ams-cli.mjs validate <file.json>\nnode ams-cli.mjs optimize <in.json> [out.json]');process.exit(2)}
const p=migrate(JSON.parse(fs.readFileSync(inp,'utf8'))),r=validate(p);
for(const m of r.errors)console.log('✖',m);for(const m of r.warnings)console.log('⚠',m);
console.log(`${r.errors.length} lỗi, ${r.warnings.length} cảnh báo`);
if(cmd==='optimize'&&!r.errors.length){const {project,report}=optimize(p);fs.writeFileSync(out||inp,stringifyProject(project));console.log(`Tối ưu: ${report.keysBefore} → ${report.keysAfter} key, ${report.tracksBefore} → ${report.tracksAfter} track → ${out||inp}`)}
process.exit(r.errors.length?1:0);
