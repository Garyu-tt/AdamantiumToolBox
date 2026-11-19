import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const service=fileURLToPath(new URL('../service.mjs',import.meta.url));
const pause=n=>new Promise(r=>setTimeout(r,n));
async function port(){return await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>r(n))})})}
async function stop(child){if(!child||child.exitCode!==null)return;const e=once(child,'exit').catch(()=>{});child.kill();await Promise.race([e,pause(2000)]);}
test('isolated app; no public invoke, no write without opt-in; safe preview', {timeout:20000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wg-peer-http-')),p=await port();
 const mock=join(dir,'wg'),pub=randomBytes(32).toString('base64');let child,err='';
 try{
  await writeFile(mock,'#!/usr/bin/env node\nif(process.argv[2]==="show") process.stdout.write(""); else process.exit(2);\n');
  await chmod(mock,0o700);
  child=spawn(process.execPath,[service],{env:{...process.env,APP_PORT:String(p),
   ADA_INTERNAL_KEY:'secret-longer-than-24-characters',ADA_CAPS:'network_wireguard_peer.read,network_wireguard_peer.write',
   NETWORK_WG_IFACE:'wg0',NETWORK_WG_POOL:'10.222.33.0/24',NETWORK_WG_BIN:mock},stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',v=>err+=v);
  const url='http://127.0.0.1:'+p,headers={'x-internal-key':'secret-longer-than-24-characters'};
  for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error(err);
   try{if((await fetch(url+'/health')).ok)break}catch{}await pause(100);
  }
  assert.equal((await fetch(url+'/graph')).status,401);
  const g=await (await fetch(url+'/graph',{headers})).json();
  assert(g.nodes.some(x=>x.id==='network_wireguard_peer.prepare'));
  assert(!g.nodes.some(x=>x.id==='network_wireguard_peer.apply'));
  const invoke=(action,params)=>fetch(url+'/invoke',{method:'POST',
   headers:{...headers,'content-type':'application/json'},body:JSON.stringify({action,params})});
  const preview=await invoke('network_wireguard_peer.prepare',{operation:'add',peerPublicKey:pub,allowedIP:'10.222.33.4/32'});
  assert.equal(preview.status,200);
  const data=(await preview.json()).result;
  assert.equal(data.plan.peerPublicKey,pub);
  assert.equal(data.writeEnabled,false);
  assert.equal((await invoke('network_wireguard_peer.apply',{plan:data.plan})).status,403);
 }finally{await stop(child);await rm(dir,{recursive:true,force:true})}
});
