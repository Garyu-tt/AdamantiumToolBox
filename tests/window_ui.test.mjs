import {strict as assert} from 'node:assert';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {engine} from '../apps/browser/engine.mjs';
import {BrowserSession} from '../apps/browser/session.mjs';
import {cdp} from '../apps/browser/cdp.mjs';
import {windowFixture} from './support/window_fixture.mjs';
if(process.env.CI&&process.platform!=='win32'&&!process.env.MAS_BROWSER_CI_RUNTIME){
 console.log('WINDOW_UI_SKIPPED no Linux Chromium sandbox');process.exit(0);}
const found=await engine().catch(e=>e.message==='browser_engine_unavailable'?null:Promise.reject(e));
if(!found){if(process.env.MAS_BROWSER_REQUIRE_ENGINE)throw Error('browser_engine_required');
 console.log('WINDOW_UI_SKIPPED no Chromium');process.exit(0);}
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const work=await mkdtemp(join(tmpdir(),'mas-ui-windows-'));
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://example.invalid').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html');return res.end(windowFixture);}
 if(!/^\/shell\/[a-z0-9_-]+\.(?:js|css)$/.test(path)){res.writeHead(404);return res.end();}
 try{const body=await readFile(join(root,path.slice(1)));
  res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(body);}
 catch{res.writeHead(404);res.end();}
});
let browser;
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function pointer(ws,type,x,y,buttons){
 await cdp(ws,'Input.dispatchMouseEvent',{type,x,y,button:'left',
  buttons,clickCount:1},8000);
}
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=new BrowserSession(join(work,'profile'));
 const page=await browser.open('http://127.0.0.1:'+server.address().port+'/');
 const tab=await browser.target(page.id),ws=tab.webSocketDebuggerUrl;
 const evalJs=async expression=>{
  const result=await cdp(ws,'Runtime.evaluate',{expression,returnByValue:true,
   awaitPromise:true},9000);
  if(result.exceptionDetails)throw Error('browser_js_exception');
  return result.result.value;
 };
 let initial;
 for(let i=0;i<70;i++){
  initial=await evalJs('window.fixture?.state()').catch(()=>null);
  if(initial?.desktop?.left)break;
  await pause(120);
 }
 assert(initial,'window_manager_not_bootstrapped');
 assert.equal(initial.left,55);assert.equal(initial.top,33);
 assert.equal(initial.desktop.left,220);assert.equal(initial.desktop.top,55);
 const x=initial.desktop.left+initial.left+100;
 const y=initial.desktop.top+initial.top+15;
 await pointer(ws,'mousePressed',x,y,1);
 await pointer(ws,'mouseMoved',x+113,y+78,1);
 await pointer(ws,'mouseReleased',x+113,y+78,0);
 const moved=await evalJs('window.fixture.state()');
 assert.equal(moved.left,168,'drag_left_offset_regression');
 assert.equal(moved.top,111,'drag_top_offset_regression');
 await evalJs("document.querySelector('[aria-label=\"Развернуть или восстановить\"]').click()");
 const maximized=await evalJs('window.fixture.state()');
 assert.equal(maximized.left,0);assert.equal(maximized.top,0);
 assert.equal(maximized.width,850);assert.equal(maximized.height,580);
 await evalJs("document.querySelector('[aria-label=\"Развернуть или восстановить\"]').click()");
 assert.equal((await evalJs('window.fixture.state()')).top,111);
 const resumed=await evalJs('window.fixture.state()');
 const sx=resumed.desktop.left+resumed.left+100;
 const sy=resumed.desktop.top+resumed.top+15;
 await pointer(ws,'mousePressed',sx,sy,1);
 await pointer(ws,'mouseMoved',600,resumed.desktop.top+7,1);
 assert.equal(await evalJs('document.querySelector(\".window-snap-preview\").hidden'),false);
 await pointer(ws,'mouseReleased',600,resumed.desktop.top+7,0);
 assert.equal((await evalJs('window.fixture.state()')).height,580);
 assert.equal(await evalJs('document.querySelector(\".window-snap-preview\").hidden'),true);
 await evalJs('window.fixture.manager.restore(document.querySelector(\"#test\"))');
 const grid=await evalJs("window.fixture.tile(8,'grid',0.62)");
 assert.equal(grid.length,8);
 for(const a of grid)for(const b of grid)if(a!==b){
  assert(a.left>=b.left+b.width||b.left>=a.left+a.width||
   a.top>=b.top+b.height||b.top>=a.top+a.height,'windows_overlap');
 }
 const mosaic=await evalJs("window.fixture.tile(8,'main-left',0.75)");
 assert(mosaic[0].width>grid[0].width*2);
 await evalJs('window.fixture.manager.restoreAll()');
 assert.equal((await evalJs('window.fixture.state()')).top,111);
 console.log('WINDOW_UI_OK Chromium pointer anchor, maximize restore, 8-way grid mosaic');
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
 await rm(work,{recursive:true,force:true,maxRetries:6,retryDelay:160});
}
