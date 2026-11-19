import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync,sign} from 'node:crypto';
import {approvalPayload} from '../apps/rollback_watchdog/receipt.mjs';
const root=await mkdtemp(join(tmpdir(),'ledger-http-'));
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const trustedPublicKey=publicKey.export({format:'der',type:'spki'}).toString('base64');
const now=Math.floor(Date.now()/1000),base={schema:'rollback-watchdog-approval-1',
 leaseId:'restart-proof',targetNode:'host',planDigest:'a'.repeat(64),
 baseRevision:'b'.repeat(64),issuedAt:now-2,expiresAt:now+200};
const receipt={...base,signature:sign(null,Buffer.from(approvalPayload(base)),
 privateKey).toString('base64')};
const params={receipt,context:{expectedLeaseId:base.leaseId,
 expectedTargetNode:base.targetNode,expectedPlanDigest:base.planDigest,
 expectedBaseRevision:base.baseRevision}};
const internalKey='ledger-http-fixture-long-internal-key';
const free=async()=>new Promise(ok=>{const s=createServer();
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const origin='http://127.0.0.1:'+(await free());
const service=resolve(fileURLToPath(new URL('../apps/rollback_ledger/service.mjs',import.meta.url)));
const headers={'X-Internal-Key':internalKey,'Content-Type':'application/json'};
let child=null;
async function start(caps){
 child=spawn(process.execPath,[service],{stdio:'ignore',env:{...process.env,
  ADA_INTERNAL_KEY:internalKey,ADA_CAPS:caps,
  ADA_ROLLBACK_LEDGER_DIR:root,ADA_ROLLBACK_TRUST_SPKI:trustedPublicKey,
  APP_PORT:origin.split(':').at(-1)}});
 for(let i=0;i<80;i++){
  try{if((await fetch(origin+'/health')).ok)return;}catch{}
  await new Promise(ok=>setTimeout(ok,40));
 }
 throw Error('ledger_service_timeout');
}
async function stop(){
 if(child?.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}
 child=null;
}
const invoke=async(action,p)=>fetch(origin+'/invoke',{method:'POST',
 headers,body:JSON.stringify({action,params:p})});
try{
 await start('rollback_ledger.read');
 let graph=await (await fetch(origin+'/graph',{headers})).json();
 assert(!graph.nodes.some(x=>x.id==='rollback_ledger.reserve'));
 assert.equal((await invoke('rollback_ledger.reserve',params)).status,403);
 await stop();
 await start('rollback_ledger.read,rollback_ledger.reserve');
 graph=await (await fetch(origin+'/graph',{headers})).json();
 assert(graph.nodes.some(x=>x.id==='rollback_ledger.reserve'));
 const first=await invoke('rollback_ledger.reserve',params);
 assert.equal((await first.json()).result.status,'reserved');
 await stop();
 await start('rollback_ledger.read,rollback_ledger.reserve');
 const second=await invoke('rollback_ledger.reserve',params);
 assert.equal((await second.json()).result.status,'already_consumed');
 const audit=await invoke('rollback_ledger.audit',{});
 assert.equal((await audit.json()).result.entries[0].state,'reserved_unverified');
 const checkpoint=await invoke('rollback_ledger.checkpoint',{});
 const fingerprint=(await checkpoint.json()).result;
 assert.equal(fingerprint.status,'observed');
 const compare=await invoke('rollback_ledger.checkpoint',{expectedDigest:fingerprint.digest});
 assert.equal((await compare.json()).result.callerAnchorMatches,true);
 assert.equal(fingerprint.remoteAnchorVerified,false);
 const denied=await fetch(origin+'/graph');
 assert.equal(denied.status,401);
 console.log('GRAPH_LEDGER_HTTP_OK read/write split and no replay across service restart');
}finally{await stop();await rm(root,{recursive:true,force:true});}
