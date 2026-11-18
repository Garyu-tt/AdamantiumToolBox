import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {message,revokeMessage} from '../lib/contract.mjs';
const repo=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const source=join(repo,'packages','network_approval');
const free=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>ok(port));});});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function stop(p){if(!p||p.exitCode!==null)return;const end=once(p,'exit').catch(()=>{});p.kill('SIGTERM');await Promise.race([end,wait(2500)]);}
const auth='test-core-operator-bearer-long';
const secret='test-internal-gateway-secret-long';
test('Core + only network_approval: signed bilateral request, revoke, authenticated graph and hot revocation', {timeout:30000},async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'approval-core-')),runtime=join(tmp,'runtime'),home=join(tmp,'home');
 const corePort=await free(),appPort=await free(),host='http://127.0.0.1:'+corePort;
 const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519');
 const trust={schema:'network-approval-trust-v1',nodes:{
  alpha:{keyId:'alpha-v1',publicKey:a.publicKey.export({type:'spki',format:'pem'}).toString()},
  beta:{keyId:'beta-v1',publicKey:b.publicKey.export({type:'spki',format:'pem'}).toString()}}};
 const trustPath=join(tmp,'trust.json'),journalPath=join(tmp,'journal.jsonl');
 let app,core;const logs={core:'',app:''};
 const bearer={Authorization:'Bearer '+auth};
 async function graph(){const r=await fetch(host+'/api/graph',{headers:bearer,signal:AbortSignal.timeout(800)});return {status:r.status,body:await r.json()};}
 async function invoke(action,params={}){const r=await fetch(host+'/api/invoke',{method:'POST',headers:{...bearer,'Content-Type':'application/json'},
  body:JSON.stringify({action,params}),signal:AbortSignal.timeout(2500)});return {status:r.status,body:await r.json()};}
 try{
  await mkdir(join(runtime,'apps'),{recursive:true});await mkdir(join(runtime,'interface'),{recursive:true});await mkdir(home,{recursive:true});
  await cp(join(repo,'core'),join(runtime,'core'),{recursive:true});
  await cp(source,join(runtime,'apps','network_approval'),{recursive:true});
  const manifest=join(runtime,'apps','network_approval','manifest.json');const m=JSON.parse(await readFile(manifest,'utf8'));
  m.service.port=appPort;await writeFile(manifest,JSON.stringify(m));
  await writeFile(trustPath,JSON.stringify(trust),{mode:0o600});
  const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:auth,ADA_INTERNAL_KEY:secret,
   ADA_CAPS:'network_approval.read,network_approval.write',ADA_PORT:String(corePort),APP_PORT:String(appPort),
   NETWORK_APPROVAL_TRUST:trustPath,NETWORK_APPROVAL_JOURNAL:journalPath};
  app=spawn(process.execPath,[join(runtime,'apps','network_approval','service.mjs')],{env,stdio:['ignore','ignore','pipe']});
  core=spawn(process.execPath,[join(runtime,'core','kernel.mjs')],{env,stdio:['ignore','ignore','pipe']});
  for(const [name,child] of [['app',app],['core',core]])child.stderr.on('data',b=>logs[name]=(logs[name]+b).slice(-2000));
  let discovered=null;
  for(let i=0;i<120;i++){
   if(app.exitCode!==null||core.exitCode!==null)throw Error('early_exit '+JSON.stringify(logs));
   try{const g=await graph();if(g.status===200&&g.body.nodes.some(n=>n.id==='network_approval.propose')){discovered=g.body;break;}}
   catch{}await wait(100);
  }
  assert(discovered,'Core could not discover approval app: '+JSON.stringify(logs));
  assert(discovered.nodes.every(n=>n.id.startsWith('network_approval.')),'Another plugin was required');
  const unauthorized=await fetch(host+'/api/graph');assert.equal(unauthorized.status,401);
  const forbidden=await invoke('network_approval.apply');assert.equal(forbidden.status,403);
  const s=await invoke('network_approval.status');assert.equal(s.status,200);
  const flow={source:'alpha',destination:'beta',principal:'owner',protocol:'tcp',port:22};
  const prep=await invoke('network_approval.prepare',{flow,revision:'v1',expiresAt:new Date(Date.now()+120000).toISOString()});
  assert.equal(prep.status,200);const request=prep.body.result.request;
  const proof=(side,kind='sign',reason)=>({side,keyId:side==='source'?'alpha-v1':'beta-v1',
   signature:sign(null,kind==='revoke'?revokeMessage(request,side,reason):message(request,side),side==='source'?a.privateKey:b.privateKey).toString('base64')});
  const started=await invoke('network_approval.propose',{request,proof:proof('source'),expectedRevision:s.body.result.revision});
  assert.equal(started.status,200);assert.equal(started.body.result.record.state,'pending');
  const signed=await invoke('network_approval.endorse',{id:request.id,proof:proof('destination'),expectedRevision:started.body.result.revision});
  assert.equal(signed.status,200);assert.equal(signed.body.result.record.state,'bilaterally_signed');
  const revoked=await invoke('network_approval.revoke',{id:request.id,proof:proof('source','revoke','owner_withdrawal'),
   reason:'owner_withdrawal',expectedRevision:signed.body.result.revision});
  assert.equal(revoked.status,200);assert.equal(revoked.body.result.record.state,'revoked');
  const list=await invoke('network_approval.list');assert.equal(list.body.result.requests[0].enforcement,false);
  await stop(app);app=null;
  const after=await graph();assert(after.body.nodes.every(n=>!n.id.startsWith('network_approval.')),'hot revocation missing');
 }finally{await Promise.all([stop(core),stop(app)]);await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
