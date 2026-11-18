import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createServer} from 'node:net';
import {message,revokeMessage} from '../lib/contract.mjs';
const secret='network-approval-internal-key-very-long';
const base=resolve(import.meta.dirname,'..');
const freePort=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>ok(port));});});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function stop(c){if(!c||c.exitCode!==null)return;const end=once(c,'exit').catch(()=>{});c.kill();await Promise.race([end,pause(2000)]);}
function makeTrust(){const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519');return {a,b,trust:{schema:'network-approval-trust-v1',nodes:{
 alpha:{keyId:'alpha-v1',publicKey:a.publicKey.export({type:'spki',format:'pem'}).toString()},
 beta:{keyId:'beta-v1',publicKey:b.publicKey.export({type:'spki',format:'pem'}).toString()}}}};}
export async function launch({caps='network_approval.read,network_approval.write',configured=true}={}){
 const tmp=await mkdtemp(join(tmpdir(),'approval-http-')),port=await freePort();const host='http://127.0.0.1:'+port;
 const {a,b,trust}=makeTrust(),trustFile=join(tmp,'trust.json'),journal=join(tmp,'journal.jsonl');
 await writeFile(trustFile,JSON.stringify(trust),{mode:0o600});
 const env={...process.env,ADA_INTERNAL_KEY:secret,ADA_CAPS:caps,APP_PORT:String(port),
 ...(configured?{NETWORK_APPROVAL_TRUST:trustFile,NETWORK_APPROVAL_JOURNAL:journal}:{} )};
 const child=spawn(process.execPath,[join(base,'service.mjs')],{env,stdio:['ignore','ignore','pipe']});
 let errors='';child.stderr.on('data',b=>errors+=b.toString().slice(-1000));
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('child_exit '+errors);
  try{const r=await fetch(host+'/health',{signal:AbortSignal.timeout(200)});if(r.ok)break;}catch{}await pause(50);
 }
 async function req(path,body,authorized=true){const r=await fetch(host+path,{method:body?'POST':'GET',headers:{...(authorized?{'X-Internal-Key':secret}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json()};}
 const invoke=(action,params)=>req('/invoke',{action,params});
 const proof=(request,side,type='sign',reason)=>({side,keyId:side==='source'?'alpha-v1':'beta-v1',
  signature:sign(null,type==='revoke'?revokeMessage(request,side,reason):message(request,side),side==='source'?a.privateKey:b.privateKey).toString('base64')});
 return {tmp,host,child,req,invoke,proof,journal,async dispose(){await stop(child);await rm(tmp,{recursive:true,force:true});}};
}
