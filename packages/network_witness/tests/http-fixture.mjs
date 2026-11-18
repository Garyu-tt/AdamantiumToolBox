import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {resolve,join} from 'node:path';
import {fixture} from './fixture.mjs';
export const secret='test-witness-internal-key-very-long';
export const free=()=>new Promise(ok=>{const x=createServer();x.listen(0,'127.0.0.1',()=>{const p=x.address().port;x.close(()=>ok(p));});});
const pause=t=>new Promise(ok=>setTimeout(ok,t));
export async function stop(p){if(!p||p.exitCode!==null)return;const done=once(p,'exit').catch(()=>{});
 p.kill('SIGTERM');await Promise.race([done,pause(2000)]);}
export async function launch(extra={}){
 const f=await fixture(),port=await free(),root=resolve(import.meta.dirname,'..');
 const env={...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:secret,
  ADA_CAPS:'network_witness.read,network_witness.write',NETWORK_WITNESS_LOG:f.logPath,
  NETWORK_WITNESS_TRUST:f.trustPath,NETWORK_WITNESS_KEY:f.keyPath,...extra};
 const p=spawn(process.execPath,[join(root,'service.mjs')],{env,stdio:['ignore','ignore','pipe']});let errors='';
 p.stderr.on('data',x=>errors=(errors+x).slice(-2500));
 const url='http://127.0.0.1:'+port;
 const request=async(path,body,key=secret)=>{const r=await fetch(url+path,{method:body?'POST':'GET',
 headers:{'X-Internal-Key':key,'Content-Type':'application/json'},
 body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(1000)});
 return {status:r.status,body:await r.json()};};
 for(let i=0;i<80;i++){if(p.exitCode!==null)throw Error('early_exit '+errors);
  try{const h=await request('/health');if(h.status===200)return {...f,port,p,url,request,shutdown:async()=>{await stop(p);await f.remove();}};}
  catch{}await pause(50);}
 throw Error('not_started '+errors);
}
