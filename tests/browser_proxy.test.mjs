import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import http from 'node:http';
const home=process.env.LOCALAPPDATA;
if(!home||process.env.CI){console.log('BROWSER_PROXY_SKIPPED no running Windows profile');process.exit(0);}
const auth=JSON.parse((await readFile(join(home,'Adamantium Toolbox','auth.json'),'utf8')).replace(/^\uFEFF/,''));
const base='http://'+'127.0.0.1:'+String(process.env.ADA_PORT||8880);
const headers={Authorization:'Bearer '+auth.token,'Content-Type':'application/json'};
const get=async(path,opts={})=>fetch(base+path,{headers,...opts,signal:AbortSignal.timeout(18000)});
const graph=await (await get('/api/graph')).json();
const browser=graph.nodes.find(x=>x.id==='browser.view');
if(!browser){console.log('BROWSER_PROXY_SKIPPED owner browser scope absent');process.exit(0);}
const nav=await (await get('/api/navigation')).json();
const navFind=nodes=>nodes.some(x=>x.view==='browser.view'||navFind(x.children||[]));
assert(navFind(nav.children||[]),'browser_missing_from_navigation');
for(const path of [browser.entry,'/apps/browser/style.css','/icons/browser.svg']){
 const res=await get(path);assert.equal(res.status,200,path);
}
const server=http.createServer((req,res)=>{
 res.writeHead(200,{'Content-Type':'text/html'});
 res.end('<title>Browser Proxy Fixture</title><h1>MAS TEST</h1>');
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='http://'+'127.0.0.1:'+server.address().port;
let openId='';
const call=async(action,params={})=>{
 const response=await get('/api/invoke',{method:'POST',
  body:JSON.stringify({action,params})});
 const data=await response.json();if(!response.ok)throw Error(action+':'+data.error);
 return data.result;
};
try{
 const tab=await call('browser.open',{url:origin+'/fixture'});openId=tab.id;
 assert(typeof openId==='string'&&openId.length>8);
 assert((await call('browser.tabs')).some(x=>x.id===openId));
 const shot=await call('browser.screenshot',{id:openId});
 assert(shot.src.startsWith('data:image/jpeg;base64,'));
 assert(shot.src.length>1000);
 assert((await call('browser.reload',{id:openId})).reloaded);
 console.log('BROWSER_PROXY_OK graph nav assets typed invoke screenshot',shot.src.length);
}finally{
 await call('browser.stop').catch(()=>{});
 await new Promise(ok=>server.close(ok));
}
