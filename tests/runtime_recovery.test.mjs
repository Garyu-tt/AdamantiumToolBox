import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,cp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {identity} from '../standards/mesh/identity.mjs';
import {planActivation} from '../standards/lifecycle/plan.mjs';
import {activate} from '../standards/lifecycle/apply.mjs';
import {current} from '../standards/lifecycle/registry.mjs';
import {readGuard} from '../core/runtime_guard.mjs';
import {fixturePackage} from './support/runtime_package.mjs';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const temp=await mkdtemp(join(tmpdir(),'mas-runtime-recovery-'));
const project=join(temp,'project'),home=join(temp,'home');
const runtime=join(home,'Adamantium Toolbox');
const originalHome=process.env.LOCALAPPDATA;
process.env.LOCALAPPDATA=home;
const alloc=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const port=s.address().port;s.close(()=>ok(port));});});
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
let supervisor;
try{
 await mkdir(project);await mkdir(join(project,'apps'));
 await cp(join(source,'core'),join(project,'core'),{recursive:true});
 await cp(join(source,'standards'),join(project,'standards'),{recursive:true});
 await mkdir(runtime,{recursive:true});
 const appPort=await alloc(),kernelPort=await alloc();
 const keys=await identity(join(runtime,'mesh'));
 await writeFile(join(runtime,'auth.json'),JSON.stringify({
  token:'fixture-token-long-enough-for-tests',internal:'fixture-internal-long-enough-for-tests'}));
 await writeFile(join(runtime,'policy.json'),JSON.stringify({
  schema:'mas-owner-policy-1',capabilities:['workspace.read','graph.read']}));
 await writeFile(join(runtime,'runtime-policy.json'),JSON.stringify({
  schema:'mas-runtime-policy-1',checkIntervalMs:1000,startupGraceMs:200,
  healthTimeoutMs:500,crashLimit:3,windowMs:20000,backoffBaseMs:200,
  backoffMaxMs:1000,stableResetMs:30000,autoRollback:true}));
 const stable=await fixturePackage(temp,runtime,keys,'1.0.0',appPort,false);
 await activate(project,runtime,await planActivation(project,runtime,stable),true);
 const broken=await fixturePackage(temp,runtime,keys,'1.1.0',appPort,true);
 await activate(project,runtime,await planActivation(project,runtime,broken),true);
 supervisor=spawn(process.execPath,[join(project,'core','background.mjs')],{
  cwd:project,env:{...process.env,LOCALAPPDATA:home,ADA_PORT:String(kernelPort)},
  windowsHide:true,stdio:'ignore'});
 let result;
 for(let i=0;i<40;i++){
  await pause(500);
  if(supervisor.exitCode!==null)throw Error('supervisor_exited');
  const doc=await current(runtime);
  if(doc.apps[0]?.hash===stable){result=doc;break;}
 }
 assert(result,'rollback_not_triggered');
 assert.equal(result.history.at(-1).kind,'rollback');
 const state=await readGuard(runtime),bad=state.entries['app:fixture@'+broken];
 assert(bad?.blocked&&bad.attempted,'crash_loop_not_quarantined');
 let healthy=false;
 for(let i=0;i<15;i++){
  try{
   const res=await fetch('http://127.0.0.1:'+appPort+'/health',
    {signal:AbortSignal.timeout(500)});
   if(res.ok&&(await res.json()).app==='fixture'){healthy=true;break;}
  }catch{}
  await pause(200);
 }
 assert(healthy,'last_good_version_not_running');
 console.log('RUNTIME_RECOVERY_OK crashes=3 quarantined rollback restored last good');
}finally{
 if(supervisor&&supervisor.exitCode===null){
  if(process.platform==='win32'){
   try{execFileSync('taskkill',['/PID',String(supervisor.pid),'/T','/F'],{stdio:'ignore'});}catch{}
  }else supervisor.kill('SIGTERM');
  await pause(500);
 }
 await rm(temp,{recursive:true,force:true,maxRetries:8,retryDelay:150});
 if(originalHome===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=originalHome;
}
