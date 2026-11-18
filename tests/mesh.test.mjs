import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {identity} from '../standards/mesh/identity.mjs';
import {inventory,readEnvelope,receive} from '../standards/mesh/store.mjs';
import {syncOnce} from '../standards/mesh/worker.mjs';
import {signedHeaders} from '../standards/mesh/transport.mjs';
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const base=await mkdtemp(join(tmpdir(),'mas-mesh-'));
const prefixA=join(base,'A'),prefixB=join(base,'B');
const a=join(prefixA,'Adamantium Toolbox'),b=join(prefixB,'Adamantium Toolbox');
const alloc=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const pause=t=>new Promise(ok=>setTimeout(ok,t));
async function start(prefix,port){
 const child=spawn(process.execPath,[join(project,'standards/mesh/server.mjs')],{
  env:{...process.env,LOCALAPPDATA:prefix,ADA_MESH_PORT:String(port)},windowsHide:true,stdio:'ignore'});
 for(let n=0;n<30;n++){
  try{const r=await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(500)});
   if(r.ok)return child;}catch{}
  if(child.exitCode!==null)throw Error('mesh_server_early_exit');
  await pause(120);
 }
 child.kill();throw Error('mesh_server_timeout');
}
let serverA,serverB;
try{
 const idA=await identity(join(a,'mesh')),idB=await identity(join(b,'mesh'));
 await writeFile(join(a,'mesh','trust.json'),JSON.stringify({[idB.id]:{publicKey:idB.publicKey,receive:true}}));
 await writeFile(join(b,'mesh','trust.json'),JSON.stringify({[idA.id]:{publicKey:idA.publicKey,receive:true}}));
 const portA=await alloc(),portB=await alloc();
 await writeFile(join(a,'mesh','peers.json'),JSON.stringify([{id:idB.id,url:'http://127.0.0.1:'+portB+'/'}]));
 await writeFile(join(b,'mesh','peers.json'),JSON.stringify([{id:idA.id,url:'http://127.0.0.1:'+portA+'/'}]));
 const inbox=join(a,'plugins','inbox','editor');await mkdir(inbox,{recursive:true});
 for(const name of ['manifest.json','service.mjs','view.js'])
  await copyFile(join(project,'apps','editor',name),join(inbox,name));
 serverA=await start(prefixA,portA);serverB=await start(prefixB,portB);
 const sent=await syncOnce(a);
 assert.equal(sent.sent,1);assert.equal(sent.peers[0].status,'synchronized');
 let items=await inventory(b);assert.equal(items.length,1);
 assert.equal((await syncOnce(b)).peers[0].status,'synchronized');
 const header=signedHeaders(idA,'GET','/v1/index','');
 const url='http://127.0.0.1:'+portB+'/v1/index';
 assert.equal((await fetch(url,{headers:header})).status,200);
 assert.equal((await fetch(url,{headers:header})).status,400);
 const altered=await readEnvelope(a,items[0]);
 altered.payload.files['view.js']=Buffer.from('not valid').toString('base64');
 await assert.rejects(receive(b,altered,{[idA.id]:{publicKey:idA.publicKey,receive:true}}),/tampered_package/);
 serverB.kill();await once(serverB,'exit');serverB=null;
 await writeFile(join(inbox,'view.js'),'export async function mount(host){host.textContent="v2";}');
 const down=await syncOnce(a);assert.equal(down.localNew,1);
 assert.equal(down.peers[0].status,'unavailable');
 serverB=await start(prefixB,portB);
 const recovered=await syncOnce(a);assert.equal(recovered.sent,1);
 items=await inventory(b);assert.equal(items.length,2);
 console.log('MESH_SYNC_OK signed packages peers=2 offline=recovered integrity replay');
}finally{
 if(serverA){serverA.kill();await once(serverA,'exit');}
 if(serverB){serverB.kill();await once(serverB,'exit');}
 await rm(base,{recursive:true,force:true});
}
