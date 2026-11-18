import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {engine} from '../apps/browser/engine.mjs';
if(process.platform!=='win32'){
 console.log('DESKTOP_UI_SKIPPED Windows Chromium fixture');process.exit(0);
}
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const free=()=>new Promise(ok=>{const s=createServer();
 s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>ok(port));});});
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const home=await mkdtemp(join(tmpdir(),'ada-ui-home-'));
const chromeHome=await mkdtemp(join(tmpdir(),'ada-ui-chrome-'));
const token='test-desktop-token-is-long-enough',secret='test-desktop-internal-secret-long-enough';
const corePort=await free(),debugPort=await free();
const base='http://127.0.0.1:'+corePort,devtools='http://127.0.0.1:'+debugPort;
const env={...process.env,LOCALAPPDATA:home,ADA_TOKEN:token,ADA_INTERNAL_KEY:secret,
 ADA_PORT:String(corePort),ADA_CAPS:'workspace.read,workspace.write'};
const children=[],launch=(file,more={})=>{
 const cp=spawn(process.execPath,[join(root,file)],{env:{...env,...more},stdio:'ignore',windowsHide:true});
 children.push(cp);return cp;
};
const until=async(fn,what)=>{
 for(let i=0;i<80;i++){try{const value=await fn();if(value)return value;}catch{}
  await pause(200);}
 throw Error('timeout_'+what);
};
let ws=null;
try{
 const browser=await engine();
 launch('apps/desktop/service.mjs',{APP_PORT:'8893'});
 launch('apps/editor/service.mjs',{APP_PORT:'8881'});
 launch('core/kernel.mjs');
 await until(async()=>{const r=await fetch(base+'/api/graph',{headers:{Authorization:'Bearer '+token},
  signal:AbortSignal.timeout(500)});return r.ok&&(await r.json()).nodes.some(n=>n.id==='editor.view');},'core');
 const chrome=spawn(browser.path,[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--disable-extensions','--remote-debugging-port='+debugPort,
  '--user-data-dir='+chromeHome,'--window-size=1360,900',base+'/#token='+token
 ],{stdio:'ignore',windowsHide:true});children.push(chrome);
 const target=await until(async()=>{
  const r=await fetch(devtools+'/json/list',{signal:AbortSignal.timeout(500)});
  return (await r.json()).find(t=>t.type==='page'&&t.url.startsWith(base));
 },'chrome_tab');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});
  ws.addEventListener('error',no,{once:true});});
 let sequence=0;const pending=new Map();
 ws.addEventListener('message',event=>{
  const data=JSON.parse(event.data),callback=pending.get(data.id);
  if(!callback)return;pending.delete(data.id);
  if(data.error||data.result?.exceptionDetails)callback.reject(Error('cdp_evaluate_failed'));
  else callback.resolve(data.result?.result?.value);
 });
 const evaluate=expression=>new Promise((resolve,reject)=>{
  const id=++sequence;pending.set(id,{resolve,reject});
  ws.send(JSON.stringify({id,method:'Runtime.evaluate',
   params:{expression,returnByValue:true,awaitPromise:true}}));
 });
 await until(()=>evaluate('document.body.classList.contains("workspace-mode")'),'workspace');
 assert(await evaluate('!!document.querySelector(".ada-start-button")'));
 assert(await evaluate('!!document.querySelector(".ada-layout-control")'));
 assert(await evaluate('document.querySelectorAll(".ada-layout-glyph").length===4'));
 await evaluate('document.querySelector(".ada-start-button").click()');
 assert(await evaluate('document.querySelector(".ada-start").classList.contains("open")'));
 assert(await evaluate('(()=>{const b=[...document.querySelectorAll(".ada-start-entry")].find(b=>b.textContent.includes("Редактор"));if(!b)return false;b.click();return true})()'));
 await until(()=>evaluate('!!document.querySelector(".window .win-controls")'),'app_window');
 assert(await evaluate('document.querySelector(".win-task")?.textContent.includes("Редактор")'));
 await evaluate('document.querySelector(".window .win-controls button:nth-child(2)").click()');
 assert(await evaluate('document.querySelector(".window").dataset.mode==="max"'));
 await evaluate('document.querySelector(".window .win-controls button:first-child").click()');
 assert(await evaluate('document.querySelector(".window").hidden'));
 await evaluate('document.querySelector(".win-task").click()');
 assert(await evaluate('!document.querySelector(".window").hidden'));
 await evaluate('document.querySelector(".ada-layout-button").click()');
 await evaluate('document.querySelector(".ada-layout-menu button").click()');
 assert(await evaluate('document.querySelector(".window").dataset.mode==="tile"'));
 console.log('DESKTOP_UI_OK actual Chromium Start shortcut app min/max taskbar and Snap Layout');
}finally{
 ws?.close();
 for(const cp of children)if(cp.exitCode===null)cp.kill();
 await pause(400);
 await rm(home,{recursive:true,force:true,maxRetries:5,retryDelay:250}).catch(()=>{});
 await rm(chromeHome,{recursive:true,force:true,maxRetries:5,retryDelay:250}).catch(()=>{});
}
