import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const service=fileURLToPath(new URL('../service.mjs',import.meta.url));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const port=()=>new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const key=()=>randomBytes(32).toString('base64');
test('Core-style profile action checks live peer table and needs no private key',{timeout:20000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wg-client-integration-'));
 const client=key(),server=key(),p=await port(),mock=join(dir,'wg'),secret='host-internal-secret-longer-than-24';
 let child;
 try{
  await writeFile(mock,'#!/usr/bin/env node\nif(process.argv[2]==="show")process.stdout.write('+JSON.stringify(client+'\t10.222.33.4/32\n')+');else process.exit(2);\n');
  await chmod(mock,0o700);
  child=spawn(process.execPath,[service],{env:{...process.env,
   APP_PORT:String(p),ADA_INTERNAL_KEY:secret,ADA_CAPS:'network_wireguard_peer.read',
   NETWORK_WG_IFACE:'wg0',NETWORK_WG_POOL:'10.222.33.0/24',NETWORK_WG_BIN:mock,
   NETWORK_WG_SERVER_PUBLIC_KEY:server,NETWORK_WG_SERVER_ENDPOINT:'vpn.example.net:51820',
   NETWORK_WG_CLIENT_ROUTES:'10.222.33.0/24'},stdio:['ignore','ignore','pipe']});
  let errors='';child.stderr.on('data',d=>errors+=d);
  const url='http://127.0.0.1:'+p,headers={'x-internal-key':secret,'content-type':'application/json'};
  let up=false;
  for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('early-exit '+errors);
   try{up=(await fetch(url+'/health')).ok;if(up)break}catch{}await pause(100);
  }
  assert(up);
  const g=await (await fetch(url+'/graph',{headers})).json();
  assert(g.nodes.some(x=>x.id==='network_wireguard_peer.clientProfile'));
  assert.equal((await fetch(url+'/graph')).status,401);
  const invoke=async(address,pub=client)=>fetch(url+'/invoke',{method:'POST',headers,
   body:JSON.stringify({action:'network_wireguard_peer.clientProfile',params:{peerPublicKey:pub,address}})});
  const r=await invoke('10.222.33.4/32');
  assert.equal(r.status,200);
  const profile=(await r.json()).result;
  assert.equal(profile.secretIncluded,false);
  assert(profile.template.includes('PrivateKey = __LOCAL_PRIVATE_KEY__'));
  assert(profile.template.includes('PublicKey = '+server));
  assert(!profile.template.includes(client));
  assert.equal((await invoke('10.222.33.9/32')).status,400);
  assert.equal((await invoke('10.222.33.4/32',key())).status,400);
 }finally{if(child?.exitCode===null){child.kill();await pause(100)}await rm(dir,{recursive:true,force:true})}
});
