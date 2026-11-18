import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {BrowserSession} from '../apps/browser/session.mjs';
import {cdp} from '../apps/browser/cdp.mjs';
if(process.env.CI||!process.env.LOCALAPPDATA){
 console.log('WINDOW_SHELL_SKIPPED no live Toolbox');process.exit(0);}
const runtime=join(process.env.LOCALAPPDATA,'Adamantium Toolbox');
const auth=JSON.parse((await readFile(join(runtime,'auth.json'),'utf8')).replace(/^\uFEFF/,''));
const tmp=await mkdtemp(join(tmpdir(),'ada-window-shell-'));
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
let browser;
try{
 browser=new BrowserSession(join(tmp,'profile'));
 const page=await browser.open('http://127.0.0.1:'+String(process.env.ADA_PORT||8880)+
  '/#token='+encodeURIComponent(auth.token));
 const tab=await browser.target(page.id),ws=tab.webSocketDebuggerUrl;
 const evalJs=async expression=>{
  const response=await cdp(ws,'Runtime.evaluate',{expression,
   returnByValue:true,awaitPromise:true},9000);
  if(response.exceptionDetails)throw Error('window_shell_eval_failed');
  return response.result.value;
 };
 let ready=false;
 for(let i=0;i<60;i++){
  const result=await evalJs("document.querySelector('#status')?.textContent");
  if(result?.includes('приложений')){ready=true;break;}
  await pause(120);
 }
 assert(ready,'shell_boot_failed');
 assert(await evalJs("!!document.querySelector('.controls button:not([id])')"));
 const workspace=await evalJs("document.body.classList.contains('workspace-mode')");
 if(workspace){
  await evalJs("document.querySelector('.ada-start-button')?.click()");
  await evalJs("document.querySelector('.ada-start-entry')?.click()");
 }else await evalJs("document.querySelector('.app-tile')?.click()");
 await evalJs("document.querySelector('#backend-graph').click()");
 await pause(350);
 assert.equal(await evalJs("document.querySelectorAll('#desktop .window').length"),2);
 await evalJs("document.querySelector('.controls button:not([id])').click()");
 assert.equal(await evalJs("document.querySelector('.layout-panel').hidden"),false);
 await evalJs("document.querySelector('.layout-panel select').value='grid'");
 await evalJs("document.querySelector('.layout-panel .mas-toolbar button').click()");
 assert.equal(await evalJs("document.querySelectorAll('#desktop .window.tiled').length"),2);
 await evalJs("document.querySelector('.layout-panel .mas-toolbar button:nth-child(2)').click()");
 assert.equal(await evalJs("document.querySelectorAll('#desktop .window.tiled').length"),0);
 const count=await evalJs("document.querySelectorAll('#tasks button').length");
 assert.equal(count,2);
 console.log('WINDOW_SHELL_OK live app and system window shared grid and restore');
}finally{
 if(browser)await browser.close();
 await rm(tmp,{recursive:true,force:true,maxRetries:6,retryDelay:180});
}
