import http from 'node:http';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {spawn} from 'node:child_process';
import {join,resolve} from 'node:path';
export const app=resolve(import.meta.dirname,'../../apps/mcp_bridge');
export const auth='test-user-auth-token-long-enough';
export const key='test-app-internal-token-long-enough';
export const ext='test-remote-mcp-token-long-enough';
export const createIdentity=()=>{const pair=generateKeyPairSync('ed25519');return {
 id:randomUUID(),publicKey:pair.publicKey.export({format:'pem',type:'spki'}),privateKey:pair.privateKey};};
export const open=async(fn)=>new Promise(ok=>{const s=http.createServer(fn);s.listen(0,'127.0.0.1',()=>ok(s));});
export const addr=s=>'http://127.0.0.1:'+s.address().port;
export const close=async s=>new Promise(ok=>s.close(ok));
export const req=async(url,data,token=ext)=>{
 const r=await fetch(url+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Accept':'application/json, text/event-stream'},body:JSON.stringify(data)});
 return {status:r.status,payload:await r.json()};
};
export const rpc=(id,method,params)=>({jsonrpc:'2.0',id,method,params});
export const result=(p)=>JSON.parse(p.payload.result.content[0].text);
export const fakeCore=(label,actions,owner)=>async(q,r)=>{
 const out=(code,data)=>{r.writeHead(code,{'Content-Type':'application/json'});r.end(JSON.stringify(data));};
 if(q.headers.authorization!=='Bearer '+auth)return out(401,{error:'unauthorized'});
 const u=new URL(q.url,'http://localhost');
 if(q.method==='GET'&&u.pathname==='/api/identity'){
  const challenge=u.searchParams.get('challenge');if(!/^[0-9a-f]{48}$/.test(challenge||''))return out(400,{error:'invalid_challenge'});
  const msg='adamantium.core.identity.v1\n'+owner.id+'\n'+challenge;
  return out(200,{schema:'adamantium.core.identity.v1',id:owner.id,challenge,signature:sign(null,Buffer.from(msg),owner.privateKey).toString('base64')});
 }
 if(q.method==='GET'&&u.pathname==='/api/graph')return out(200,{version:1,nodes:actions.map(id=>({id,type:'action'})),edges:[]});
 if(q.method==='POST'&&u.pathname==='/api/invoke'){
  if(q.headers['x-adamantium-target-node']!==owner.id)return out(409,{error:'node_identity_mismatch'});
  let raw='';for await (const c of q)raw+=c;const d=JSON.parse(raw);
  if(!actions.includes(d.action))return out(403,{error:'missing_action'});
  return out(200,{result:{node:label,action:d.action,params:d.params}});
 }
 out(404,{error:'not_found'});
};
export const run=(env)=>spawn(process.execPath,[join(app,'service.mjs')],{env:{...process.env,...env},stdio:'pipe'});
export async function untilReady(url,child){for(let i=0;i<100;i++){
 try{const r=await fetch(url+'/health');if(r.ok)return;}catch{}
 if(child.exitCode!==null)throw Error('bridge_exit: '+child.exitCode);
 await new Promise(r=>setTimeout(r,20));}throw Error('startup_timeout');}
export const pin=o=>({id:o.id,publicKey:o.publicKey});
