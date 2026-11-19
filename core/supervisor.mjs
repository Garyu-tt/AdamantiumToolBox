import { catalog } from './catalog.mjs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const registry=await catalog(root);
for(const app of registry){
 if(!/^[a-z0-9_-]+$/.test(app.id))continue;
 const entry=resolve(app.directory,'service.mjs');
 try{
  const res=await fetch('http://127.0.0.1:'+app.service.port+'/health',{signal:AbortSignal.timeout(500)});
  if((await res.json()).app===app.id)continue;
 }catch{}
 spawn(process.execPath,[entry],{cwd:root,detached:true,stdio:'ignore',windowsHide:true,env:{...process.env,APP_PORT:String(app.service.port)}}).unref();
}
try{
 const res=await fetch('http://127.0.0.1:8880/health',{signal:AbortSignal.timeout(500)});
 if((await res.json()).service==='Adamantium Toolbox')process.exit(0);
}catch{}
spawn(process.execPath,[resolve(root,'core/kernel.mjs')],{cwd:root,detached:true,stdio:'ignore',windowsHide:true}).unref();
