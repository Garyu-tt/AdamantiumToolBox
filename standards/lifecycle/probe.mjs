import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {validateGraph} from '../../core/contract.mjs';
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const host=process.env.ADA_LOOPBACK_HOST||'127.0.0.1';
if(!['127.0.0.1','::1'].includes(host))throw Error('local_probe_only');
async function freePort(){
 const server=createServer();
 await new Promise((ok,bad)=>server.once('error',bad).listen(0,host,ok));
 const port=server.address().port;
 await new Promise(ok=>server.close(ok));
 return port;
}
export async function probePlugin(directory,manifest,timeout=5000){
 const port=await freePort(),secret=randomBytes(32).toString('hex');
 const env={...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:secret,
  ADA_CAPS:manifest.permissions.join(',')};
 const proc=spawn(process.execPath,[join(directory,'service.mjs')],{
  cwd:directory,env,windowsHide:true,stdio:'ignore'});
 const base='http://'+(host.includes(':')?'['+host+']':host)+':'+port;
 let verified=false,error='probe_unavailable';
 try{
  const until=Date.now()+timeout;
  while(Date.now()<until){
   if(proc.exitCode!==null){error='probe_exited_'+proc.exitCode;break;}
   try{
    const health=await fetch(base+'/health',{signal:AbortSignal.timeout(350)});
    if(!health.ok||(await health.json()).app!==manifest.id)throw Error('health_wrong_app');
    const graph=await fetch(base+'/graph',{headers:{'X-Internal-Key':secret},
     signal:AbortSignal.timeout(350)});
    if(!graph.ok||!validateGraph(await graph.json(),manifest))throw Error('graph_contract_failed');
    verified=true;break;
   }catch(e){error=String(e.message).slice(0,100);}
   await pause(120);
  }
 }finally{
  if(proc.exitCode===null){
   const closed=once(proc,'exit').catch(()=>{});
   proc.kill();await Promise.race([closed,pause(1000)]);
   if(proc.exitCode===null){proc.kill('SIGKILL');await Promise.race([closed,pause(1000)]);}
  }
 }
 if(!verified)throw Error('probe_failed:'+error);
 return {health:'ok',graph:'valid'};
}
