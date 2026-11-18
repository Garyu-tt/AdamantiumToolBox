// Shared Forge-alone HTTP harness: no graph, agents or external providers.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
export async function withForgeHost(secret,test){
 const port=await new Promise(done=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
  const n=s.address().port;s.close(()=>done(n));});});
 const child=spawn(process.execPath,[resolve(root,'apps/forge/service.mjs')],{env:{...process.env,
  ADA_INTERNAL_KEY:secret,ADA_CAPS:'forge.read,forge.validate',APP_PORT:String(port)},stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 const query=(route,body,auth=true)=>fetch(base+route,{method:body?'POST':'GET',
  headers:{...(auth?{'x-internal-key':secret}:{}),'Content-Type':'application/json'},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(2000)});
 try{
  let ready=false;
  for(let i=0;i<45;i++){
   try{if((await query('/health')).ok){ready=true;break;}}catch{}
   if(child.exitCode!==null)throw Error('forge_host_exited');
   await new Promise(done=>setTimeout(done,50));
  }
  if(!ready)throw Error('forge_host_timeout');
  await test(query);
 }finally{child.kill();}
}
