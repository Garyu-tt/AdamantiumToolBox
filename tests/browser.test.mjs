import {strict as assert} from 'node:assert';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {allowedUrl,engine} from '../apps/browser/engine.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
await assert.rejects(Promise.resolve().then(()=>allowedUrl('file:///etc/passwd')),/browser_url_denied/);
await assert.rejects(Promise.resolve().then(()=>allowedUrl('javascript:alert(1)')),/browser_url_denied/);
if(process.env.CI&&process.platform!=='win32'&&!process.env.MAS_BROWSER_CI_RUNTIME){
 console.log('BROWSER_RUNTIME_SKIPPED CI Chromium sandbox not provisioned');process.exit(0);
}
const where=await engine().catch(e=>e.message==='browser_engine_unavailable'?null:Promise.reject(e));
if(!where){
 if(process.env.MAS_BROWSER_REQUIRE_ENGINE)throw Error('required_chromium_missing');
 console.log('BROWSER_RUNTIME_SKIPPED no Chromium engine');process.exit(0);
}
const home=await mkdtemp(join(tmpdir(),'ada-browser-'));
const secret='test-browser-internal-secret-for-runtime';
const launch=()=>{
 const h={...process.env,LOCALAPPDATA:home,ADA_BROWSER_EXECUTABLE:where.path,
  APP_PORT:String(appPort),ADA_INTERNAL_KEY:secret,
  ADA_CAPS:'browser.read,browser.navigate,browser.interact'};
 return spawn(process.execPath,[join(root,'apps','browser','service.mjs')],
  {env:h,cwd:root,windowsHide:true,stdio:'ignore'});
};
const site=http.createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 if(req.url==='/input')return res.end('<input id="entry" style="position:absolute;left:20px;top:20px;width:240px;height:40px"><script>entry.oninput=()=>document.title="TYPED:"+entry.value</script>');
 if(req.url==='/second')return res.end('<title>SECOND PAGE</title><h1>Second</h1>');
 res.end('<title>TEST PAGE</title><button onclick="location.href=\'/second\'" style="position:absolute;left:20px;top:20px;width:140px;height:42px">Next</button>');
});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
const openPort=()=>new Promise(ok=>site.listen(0,'127.0.0.1',()=>ok(site.address().port)));
const freePort=()=>new Promise(ok=>{const s=http.createServer();
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
let appPort;
try{
 const sitePort=await openPort();appPort=await freePort();browser=launch();
 const base='http://'+'127.0.0.1:'+appPort;
 let up=false;
 for(let n=0;n<60;n++){
  try{const res=await fetch(base+'/health',{signal:AbortSignal.timeout(250)});
   if(res.ok){up=true;break;}}catch{}
  if(browser.exitCode!==null)throw Error('browser_service_exited');
  await pause(100);
 }
 assert(up,'browser_service_not_ready');
 const unauthorized=await fetch(base+'/graph');
 assert.equal(unauthorized.status,401);
 const headers={'X-Internal-Key':secret,'Content-Type':'application/json'};
 const api=async(action,params={})=>{
  const response=await fetch(base+'/invoke',{method:'POST',headers,
   body:JSON.stringify({action,params}),signal:AbortSignal.timeout(25000)});
  const body=await response.json();
  if(!response.ok)throw Error(body.error);
  return body.result;
 };
 const graph=await (await fetch(base+'/graph',{headers})).json();
 assert(graph.nodes.some(n=>n.id==='browser.view'));
 assert((await api('browser.settings')).previewRefreshMs>=1000);
 const url='http://'+'127.0.0.1:'+sitePort;
 const tab=await api('browser.open',{url:url+'/start'});
 assert.equal(typeof tab.id,'string');
 for(let n=0;n<10;n++){
  if((await api('browser.tabs')).some(x=>x.id===tab.id&&x.url.includes('/start')))break;
  await pause(150);
 }
 const screenshot=await api('browser.screenshot',{id:tab.id});
 assert(screenshot.src.startsWith('data:image/jpeg;base64,'));
 assert(screenshot.src.length>1000);
 await pause(250);await api('browser.click',{id:tab.id,x:50,y:40});
 let second=false;
 for(let n=0;n<16;n++){
  if((await api('browser.tabs')).some(x=>x.id===tab.id&&x.url.includes('/second'))){second=true;break;}
  await pause(200);
 }
 assert(second,'cdp_click_failed');
 assert((await api('browser.back',{id:tab.id})).moved);
 assert((await api('browser.forward',{id:tab.id})).moved);
 assert((await api('browser.reload',{id:tab.id})).reloaded);
 await api('browser.navigate',{id:tab.id,url:url+'/input'});
 await pause(180);await api('browser.click',{id:tab.id,x:60,y:40});
 await api('browser.type',{id:tab.id,text:'Hello MAS'});
 let typed=false;
 for(let n=0;n<12;n++){
  if((await api('browser.tabs')).some(x=>x.id===tab.id&&x.title.includes('Hello MAS'))){typed=true;break;}
  await pause(180);
 }
 assert(typed,'cdp_text_failed');
 const another=await api('browser.open',{url:url+'/second'});
 assert((await api('browser.tabs')).some(x=>x.id===another.id));
 await api('browser.closeTab',{id:another.id});
 assert(!(await api('browser.tabs')).some(x=>x.id===another.id));
 assert((await api('browser.stop')).stopped);
 console.log('BROWSER_CDP_OK Edge/Chromium tab navigate snapshot click text local-only');
}finally{
 if(browser?.exitCode===null){browser.kill();await Promise.race([once(browser,'exit'),pause(1600)]);}
 await new Promise(ok=>site.close(ok));
 await rm(home,{recursive:true,force:true,maxRetries:8,retryDelay:200});
}
