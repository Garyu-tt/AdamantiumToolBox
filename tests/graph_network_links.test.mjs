import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const free=()=>new Promise(done=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const port=s.address().port;s.close(()=>done(port));});});
const pause=t=>new Promise(done=>setTimeout(done,t));
const test=await mkdtemp(join(tmpdir(),'mas-graph-links-'));
const children=[];
const token='safe-test-token-for-mas-linking';
const secret='safe-test-key-for-mas-linking';
try{
 await cp(join(root,'core'),join(test,'core'),{recursive:true});
 const ids=['graph_firewall','network_inventory'],ports=[await free(),await free()];
 for(let i=0;i<ids.length;i++){
  const id=ids[i],dir=join(test,'apps',id);
  await mkdir(join(test,'apps'),{recursive:true});
  await cp(join(root,'apps',id),dir,{recursive:true});
  const manifest=join(dir,'manifest.json'),obj=JSON.parse(await readFile(manifest,'utf8'));
  obj.service.port=ports[i];await writeFile(manifest,JSON.stringify(obj));
 }
 const corePort=await free();
 const env={...process.env,LOCALAPPDATA:join(test,'home'),
  ADA_TOKEN:token,ADA_INTERNAL_KEY:secret,
  ADA_CAPS:'graph_firewall.read,network_inventory.read,graph.read,frontend.read',
  ADA_PORT:String(corePort)};
 for(let i=0;i<ids.length;i++)children.push(spawn(process.execPath,
  [join(test,'apps',ids[i],'service.mjs')],
  {env:{...env,APP_PORT:String(ports[i])},stdio:'ignore',windowsHide:true}));
 const kernel=spawn(process.execPath,[join(test,'core','kernel.mjs')],
  {env,stdio:'ignore',windowsHide:true});children.push(kernel);
 const url='http://127.0.0.1:'+corePort+'/api/graph';
 async function inspect(predicate){
  for(let i=0;i<60;i++){
   try{const res=await fetch(url,{headers:{Authorization:'Bearer '+token},
    signal:AbortSignal.timeout(1000)});
    if(res.ok){const graph=await res.json();if(predicate(graph))return graph;}
   }catch{}
   await pause(100);
  }
  throw Error('capability_graph_timeout');
 }
 const linked=await inspect(g=>g.edges.some(e=>e.from==='graph_firewall.inspect'&&
  e.to==='network_inventory.reconcile'&&e.type==='related'));
 assert(linked.nodes.some(n=>n.id==='network_inventory.reconcile'));
 children[1].kill();
 const unlinked=await inspect(g=>g.nodes.some(n=>n.id==='graph_firewall.inspect')&&
  !g.nodes.some(n=>n.id==='network_inventory.reconcile'));
 assert(!unlinked.edges.some(e=>e.from==='graph_firewall.inspect'&&e.to==='network_inventory.reconcile'));
 console.log('GRAPH_LIVE_LINKS_OK links appear and disappear without core restart');
}finally{
 for(const child of children)if(child.exitCode===null)child.kill();
 await pause(150);
 await rm(test,{recursive:true,force:true,maxRetries:6,retryDelay:150});
}
