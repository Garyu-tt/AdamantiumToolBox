import {strict as assert} from 'node:assert';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {engine} from '../apps/browser/engine.mjs';
if(process.env.CI&&process.platform!=='win32'&&!process.env.MAS_BROWSER_CI_RUNTIME){
 console.log('BROWSER_HANDOFF_SKIPPED CI no Chromium');process.exit(0);}
const found=await engine().catch(e=>e.message==='browser_engine_unavailable'?null:Promise.reject(e));
if(!found){if(process.env.MAS_BROWSER_REQUIRE_ENGINE)throw Error('chromium_missing');
 console.log('BROWSER_HANDOFF_SKIPPED no browser engine');process.exit(0);}
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const base=await mkdtemp(join(tmpdir(),'mas-handoff-'));
const secretA='local-host-internal-key-for-browser',secretB='local-client-internal-key-for-browser';
const relayKey='b'.repeat(64),delay=ms=>new Promise(ok=>setTimeout(ok,ms));
const site=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 if(req.url==='/login'){res.setHeader('Set-Cookie','account=logged; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600');
  return res.end('<title>LOGIN</title>');}
 res.end('<title>'+((req.headers.cookie||'').includes('account=logged')?'SIGNED_IN':'SIGNED_OUT')+'</title>');
});
const free=()=>new Promise(ok=>{const s=createServer();
 s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>ok(port));});});
const hosts=[];
async function launch(label,port,secret,mode,hostPort){
 const home=join(base,label),runtime=join(home,'Adamantium Toolbox'),dir=join(runtime,'browser');
 await mkdir(dir,{recursive:true});
 if(mode==='host')await writeFile(join(dir,'relay-host-key'),relayKey);
 else{
  await writeFile(join(dir,'relay-client-key'),relayKey);
  await writeFile(join(dir,'provider.json'),JSON.stringify({
   schema:'mas-browser-provider-1',mode:'relay',endpoint:'http://127.0.0.1:'+hostPort}));}
 const child=spawn(process.execPath,[join(root,'apps/browser/service.mjs')],{
  env:{...process.env,LOCALAPPDATA:home,ADA_INTERNAL_KEY:secret,
   ADA_CAPS:'browser.read,browser.navigate,browser.interact',APP_PORT:String(port),
   ADA_BROWSER_EXECUTABLE:mode==='host'?found.path:'missing-engine-because-remote'},
  stdio:'ignore',windowsHide:true});
 hosts.push(child);
 for(let i=0;i<50;i++){
  try{const res=await fetch('http://127.0.0.1:'+port+'/health',
   {signal:AbortSignal.timeout(300)});if(res.ok)return;}
  catch{}
  if(child.exitCode!==null)throw Error(label+'_service_exit');
  await delay(130);
 }
 throw Error(label+'_unavailable');
}
const call=async(port,secret,action,params={})=>{
 const res=await fetch('http://127.0.0.1:'+port+'/invoke',{method:'POST',
  headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},
  body:JSON.stringify({action,params}),signal:AbortSignal.timeout(25000)});
 const data=await res.json();if(!res.ok)throw Error(action+':'+data.error);return data.result;
};
async function title(port,key,id,expected){
 for(let i=0;i<30;i++){
  if((await call(port,key,'browser.tabs')).some(x=>x.id===id&&x.title===expected))return;
  await delay(160);
 }
 throw Error('expected_'+expected);
}
try{
 await new Promise(ok=>site.listen(0,'127.0.0.1',ok));
 const sitePort=site.address().port,hostPort=await free(),clientPort=await free();
 await launch('laptop',hostPort,secretA,'host');
 const origin='http://127.0.0.1:'+sitePort;
 const tab=await call(hostPort,secretA,'browser.open',{url:origin+'/login'});
 await title(hostPort,secretA,tab.id,'LOGIN');
 assert((await call(hostPort,secretA,'browser.stop')).profileRetained);
 await launch('server',clientPort,secretB,'relay',hostPort);
 const info=await call(clientPort,secretB,'browser.provider');
 assert.equal(info.mode,'relay');
 const reused=await call(clientPort,secretB,'browser.open',{url:origin+'/account'});
 await title(clientPort,secretB,reused.id,'SIGNED_IN');
 const denied=await fetch('http://127.0.0.1:'+hostPort+'/invoke',{method:'POST',
  headers:{'X-Browser-Relay-Key':'wrong'},body:'{}'});
 assert.equal(denied.status,401);
 assert((await call(clientPort,secretB,'browser.stop')).profileRetained);
 console.log('BROWSER_HANDOFF_OK host login survives restart remote client remains signed in');
}finally{
 for(const child of hosts)if(child.exitCode===null){
  child.kill();await Promise.race([once(child,'exit').catch(()=>{}),delay(1500)]);}
 await new Promise(ok=>site.close(ok));
 await rm(base,{recursive:true,force:true,maxRetries:6,retryDelay:200});
}
