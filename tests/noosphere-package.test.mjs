import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {packDir} from '../standards/mesh/bundle.mjs';
const root=resolve(fileURLToPath(new URL('../apps/noosphere/',import.meta.url)));
const payload=await packDir(root);
assert.equal(payload.id,'noosphere');
assert(payload.files['runtime/loader.mjs']);
const dir=await mkdtemp(join(tmpdir(),'mas-portable-ns-'));
const port=await new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const n=s.address().port;s.close(()=>ok(n));});});
let child;
try{
 for(const [name,b64] of Object.entries(payload.files)){
  const target=join(dir,...name.split('/'));
  await mkdir(resolve(target,'..'),{recursive:true});
  await writeFile(target,Buffer.from(b64,'base64'));
 }
 child=spawn(process.execPath,[join(dir,'service.mjs')],{cwd:dir,
  env:{...process.env,APP_PORT:String(port),
   ADA_INTERNAL_KEY:'standalone-package-secret-aaaaaaaa'},stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 let status;
 for(let n=0;n<50;n++){
  try{const r=await fetch(base+'/health');if(r.ok){status=await r.json();break;}}catch{}
  if(child.exitCode!==null)throw Error('service_exited_early');
  await new Promise(ok=>setTimeout(ok,100));
 }
 assert(status,'package_start_timeout');
 assert.equal(status.mode,'stateless');
 const r=await fetch(base+'/graph',{headers:{'X-Internal-Key':'standalone-package-secret-aaaaaaaa'}});
 assert.equal(r.status,200);
 const g=await r.json();
 assert(g.nodes.some(x=>x.capability==='memory.envelope.validate'));
 assert(!g.nodes.some(x=>x.capability?.startsWith('storage.')));
 console.log('NOOSPHERE_PACKAGE_R03_OK relocatable-without-repository-or-database');
}finally{
 if(child){child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit');}
 await rm(dir,{recursive:true,force:true});
}
