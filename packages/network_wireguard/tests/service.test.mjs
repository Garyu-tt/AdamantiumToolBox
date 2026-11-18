import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const location=fileURLToPath(new URL('../service.mjs',import.meta.url));
const key='test-valid-host-internal-secret-32';
const free=()=>new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
async function stop(child){if(child.exitCode!==null)return;const end=once(child,'exit').catch(()=>{});child.kill();await Promise.race([end,new Promise(r=>setTimeout(r,2000))]);}
const pause=n=>new Promise(r=>setTimeout(r,n));
const key64=()=>randomBytes(32).toString('base64');
test('read-only service hides secrets and removes actions when wg probe fails',{timeout:20000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wg-provider-')),port=await free();let child;
 const p=join(dir,'wg-mock'),secretKey=key64(),psk=key64(),publicKey=key64(),peerKey=key64();
 const dump=['wg0',secretKey,publicKey,'12345','off'].join('\t')+'\n'+
  ['wg0',peerKey,psk,'192.0.2.12:2000','10.0.0.1/32','900','123','456','off'].join('\t')+'\n';
 try{
  await writeFile(p,'#!/usr/bin/env node\nprocess.stdout.write('+JSON.stringify(dump)+');\n');await chmod(p,0o700);
  child=spawn(process.execPath,[location],{env:{...process.env,ADA_INTERNAL_KEY:key,
   ADA_CAPS:'network_wireguard.read',NETWORK_WG_BIN:p,APP_PORT:String(port)},stdio:['ignore','ignore','pipe']});
  let errors='';child.stderr.on('data',d=>errors+=d);
  const base='http://127.0.0.1:'+port,headers={'x-internal-key':key};
  let graph;
  for(let i=0;i<80;i++){
   if(child.exitCode!==null)throw Error('early exit '+errors);
   try{const r=await fetch(base+'/graph',{headers});if(r.ok){graph=await r.json();break;}}catch{} await pause(80);
  }
  assert(graph?.nodes.some(n=>n.id==='network_wireguard.peers'));
  assert.equal((await fetch(base+'/graph')).status,401);
  const invoke=async(action)=>fetch(base+'/invoke',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action})});
  const res=await invoke('network_wireguard.peers');assert.equal(res.status,200);
  const body=await res.text();
  assert(body.includes('10.0.0.1/32'));for(const v of [secretKey,psk,publicKey,peerKey,'192.0.2.12'])assert(!body.includes(v));
  assert.equal((await invoke('network_wireguard.apply')).status,403);
  await rm(p);
  const missing=await (await fetch(base+'/graph',{headers})).json();
  assert.deepEqual(missing.nodes.map(x=>x.id),['network_wireguard.status']);
  assert.equal((await invoke('network_wireguard.peers')).status,403);
  const status=await (await invoke('network_wireguard.status')).json();assert.equal(status.result.available,false);
 }finally{await stop(child);await rm(dir,{recursive:true,force:true});}
});
