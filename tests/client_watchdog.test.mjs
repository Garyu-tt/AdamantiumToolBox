import {strict as assert} from 'node:assert';
import {cp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {summarize,currentStatus} from '../apps/client_watchdog/status.mjs';
import {catalog} from '../core/catalog.mjs';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const auth='client-watchdog-integration-owner-token';
const key='client-watchdog-integration-internal-key';
const now=Date.now(),stamp=new Date(now).toISOString();
const sample={schema:'mas-client-watchdog-state-1',updatedAt:stamp,targets:[
 {id:'transport',taskRunning:true,probeOk:true,failures:0,reason:'healthy',
  lastGoodUtc:stamp,lastAttemptUtc:null,privateToken:'must_not_escape'}]};
const clean=summarize(sample,now);
assert.equal(clean.mode,'fresh');assert.equal(clean.targets[0].id,'transport');
assert(!JSON.stringify(clean).includes('must_not_escape'));
assert.equal(summarize(sample,now+600000).mode,'stale');
assert.equal(summarize({...sample,schema:'other'},now).mode,'invalid');
assert.equal(summarize({...sample,updatedAt:new Date(now+900000).toISOString()},now).mode,'invalid');
assert.equal((await currentStatus(null)).mode,'not_configured');
const free=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const port=s.address().port;s.close(()=>ok(port));});});
const sleep=n=>new Promise(ok=>setTimeout(ok,n));
const root=await mkdtemp(join(tmpdir(),'mas-client-watchdog-'));
const home=join(root,'home'),appdir=join(root,'apps','client_watchdog');
const stateDir=join(home,'Adamantium Toolbox','client-watchdog');
const port=await free(),corePort=await free();
let app,core;
try{
 await mkdir(join(root,'apps'),{recursive:true});
 await cp(join(source,'core'),join(root,'core'),{recursive:true});
 await cp(join(source,'apps','client_watchdog'),appdir,{recursive:true});
 await mkdir(stateDir,{recursive:true});
 const m=JSON.parse(await (await import('node:fs/promises')).readFile(join(appdir,'manifest.json'),'utf8'));
 m.service.port=port;await writeFile(join(appdir,'manifest.json'),JSON.stringify(m));
 assert.equal((await catalog(root))[0].ui.mode,'headless');
 const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:auth,ADA_INTERNAL_KEY:key,
  ADA_CAPS:'client_watchdog.read',ADA_PORT:String(corePort),APP_PORT:String(port)};
 app=spawn(process.execPath,[join(appdir,'service.mjs')],{env,stdio:'ignore'});
 core=spawn(process.execPath,[join(root,'core','kernel.mjs')],{env,stdio:'ignore'});
 const base='http://127.0.0.1:'+corePort,header={Authorization:'Bearer '+auth};
 let nodes=[];
 for(let i=0;i<70;i++){
  try{const r=await fetch(base+'/api/graph',{headers:header,
   signal:AbortSignal.timeout(350)});if(r.ok){nodes=(await r.json()).nodes;if(nodes.length)break;}}catch{}
  if(app.exitCode!==null||core.exitCode!==null)throw Error('process_exited');
  await sleep(100);
 }
 assert.deepEqual(nodes.map(n=>n.id),['client_watchdog.status']);
 assert.equal((await fetch('http://127.0.0.1:'+port+'/graph')).status,401);
 async function status(){
  const r=await fetch(base+'/api/invoke',{method:'POST',headers:{...header,
   'Content-Type':'application/json'},body:JSON.stringify({action:'client_watchdog.status'})});
  assert.equal(r.status,200);return (await r.json()).result;
 }
 assert.equal((await status()).mode,'not_configured');
 await writeFile(join(stateDir,'status.json'),JSON.stringify(sample));
 assert.equal((await status()).mode,'fresh');
 assert(!JSON.stringify(await status()).includes('privateToken'));
 await writeFile(join(stateDir,'status.json'),'not json');
 assert.equal((await status()).mode,'invalid');
 await rm(join(stateDir,'status.json'));
 const external=join(root,'external.json');await writeFile(external,JSON.stringify(sample));
 await symlink(external,join(stateDir,'status.json'));
 assert.equal((await status()).mode,'invalid');
 console.log('CLIENT_WATCHDOG_OK headless, permission, status sanitization, missing, malformed, symlink');
}finally{
 for(const child of [app,core])if(child&&child.exitCode===null){
  child.kill();await Promise.race([once(child,'exit'),sleep(3000)]);
 }
 await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:150});
}
