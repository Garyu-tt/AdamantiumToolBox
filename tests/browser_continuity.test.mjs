import {strict as assert} from 'node:assert';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {engine} from '../apps/browser/engine.mjs';
import {BrowserSession} from '../apps/browser/session.mjs';
import {identity} from '../apps/browser/continuity.mjs';
if(process.env.CI&&process.platform!=='win32'&&!process.env.MAS_BROWSER_CI_RUNTIME){
 console.log('BROWSER_CONTINUITY_SKIPPED CI runtime unavailable');process.exit(0);}
const available=await engine().catch(e=>e.message==='browser_engine_unavailable'?null:Promise.reject(e));
if(!available){
 if(process.env.MAS_BROWSER_REQUIRE_ENGINE)throw Error('required_chromium_missing');
 console.log('BROWSER_CONTINUITY_SKIPPED Chromium unavailable');process.exit(0);}
const home=await mkdtemp(join(tmpdir(),'ada-auth-persist-'));
const runtime=join(home,'Adamantium Toolbox');
const site=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 if(req.url==='/login'){
  res.setHeader('Set-Cookie','mas_test_login=active; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600');
  return res.end('<title>LOGIN</title>');}
 res.end('<title>'+((req.headers.cookie||'').includes('mas_test_login=active')?
  'SIGNED_IN':'SIGNED_OUT')+'</title>');
});
let first,second;
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function title(session,id,expect){
 for(let n=0;n<35;n++){
  const page=(await session.pages()).find(x=>x.id===id);
  if(page?.title===expect)return;
  await pause(160);
 }
 throw Error('expected_title_'+expect);
}
try{
 await new Promise(ok=>site.listen(0,'127.0.0.1',ok));
 const origin='http://'+'127.0.0.1:'+site.address().port;
 first=new BrowserSession(runtime);
 const login=await first.open(origin+'/login');
 await title(first,login.id,'LOGIN');
 const id1=await identity(runtime);
 const stop=await first.close();
 assert(stop.profileRetained);
 second=new BrowserSession(runtime);
 const account=await second.open(origin+'/account');
 await title(second,account.id,'SIGNED_IN');
 const id2=await identity(runtime);
 assert.equal(id1.id,id2.id);
 assert.equal(id1.profile,id2.profile);
 console.log('BROWSER_CONTINUITY_OK persistent HttpOnly login survives browser restart');
}finally{
 if(first)await first.close();
 if(second)await second.close();
 await new Promise(ok=>site.close(ok));
 await rm(home,{recursive:true,force:true,maxRetries:6,retryDelay:200});
}
