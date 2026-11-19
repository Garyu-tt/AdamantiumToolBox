import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {packDir} from '../standards/mesh/bundle.mjs';
const source=resolve(fileURLToPath(new URL('../apps/database/',import.meta.url)));
const payload=await packDir(source);
assert(payload.files['runtime/loader.mjs']);
const home=await mkdtemp(join(tmpdir(),'mas-db-package-')),dir=join(home,'plugin');
const data=join(home,'data');
const port=await new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const p=s.address().port;s.close(()=>ok(p));});});
let child;
try{
 for(const [file,b64] of Object.entries(payload.files)){
  const full=join(dir,...file.split('/'));
  await mkdir(resolve(full,'..'),{recursive:true});
  await writeFile(full,Buffer.from(b64,'base64'));
 }
 child=spawn(process.execPath,[join(dir,'service.mjs')],{cwd:dir,
  env:{...process.env,APP_PORT:String(port),DATABASE_DATA_DIR:data,
   ADA_INTERNAL_KEY:'database-edge-package-test-secret'},stdio:'ignore'});
 const base='http://127.0.0.1:'+port,headers={'X-Internal-Key':'database-edge-package-test-secret'};
 let ok=false;
 for(let n=0;n<50;n++){
  try{const h=await fetch(base+'/health');if(h.ok){ok=true;break;}}catch{}
  if(child.exitCode!==null)throw Error('database_crashed');
  await new Promise(ok=>setTimeout(ok,100));
 }
 assert(ok,'database_start_timeout');
 const graph=await (await fetch(base+'/graph',{headers})).json();
 const ids=graph.nodes.map(x=>x.id);
 assert(ids.includes('database.query'));
 assert(ids.includes('database.status'));
 assert(!ids.includes('database.transact'));
 const invoke=async action=>{
  const r=await fetch(base+'/invoke',{method:'POST',headers:{...headers,
   'Content-Type':'application/json'},body:JSON.stringify({action,params:{namespace:'edge'}})});
  return {status:r.status,body:await r.json()};
 };
 const status=await invoke('database.status');
 assert.equal(status.status,200);
 assert.equal(status.body.result.allowWrites,false);
 assert.equal(status.body.result.backupCopies,0);
 assert.equal(status.body.result.maxJournalBytes,16*1024*1024);
 assert.equal((await invoke('database.transact')).status,400);
 console.log('DATABASE_PACKAGE_R04_OK standalone-readonly-16MiB-zero-backups');
}finally{
 if(child){child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit');}
 await rm(home,{recursive:true,force:true});
}
