import {strict as assert} from 'node:assert';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {provider,relayInvoke,authorizedHost,hostKey} from '../apps/browser/provider.mjs';
const root=await mkdtemp(join(tmpdir(),'mas-provider-test-'));
const runtime=join(root,'Adamantium Toolbox'),dir=join(runtime,'browser');
const key='a'.repeat(64);
const mock=createServer(async(req,res)=>{
 if(req.headers['x-browser-relay-key']!==key){res.writeHead(401);return res.end('{}');}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 res.writeHead(200,{'Content-Type':'application/json'});
 res.end(JSON.stringify({result:{action:payload.action,params:payload.params}}));
});
try{
 await mkdir(dir,{recursive:true});
 await writeFile(join(dir,'relay-client-key'),key);
 await writeFile(join(dir,'relay-host-key'),key);
 await new Promise(ok=>mock.listen(0,'127.0.0.1',ok));
 const port=mock.address().port;
 await writeFile(join(dir,'provider.json'),JSON.stringify({
  schema:'mas-browser-provider-1',mode:'relay',endpoint:'http://127.0.0.1:'+port}));
 const configured=await provider(runtime);
 assert.equal(configured.mode,'relay');
 assert.equal((await hostKey(runtime)),key);
 assert(authorizedHost(key,key));assert(!authorizedHost(key,'b'.repeat(64)));
 const result=await relayInvoke(runtime,configured,'browser.tabs',{sample:2});
 assert.deepEqual(result,{action:'browser.tabs',params:{sample:2}});
 for(const endpoint of ['http://192.168.1.4:8892','https://example.org',
  'http://127.0.0.1:8892/?token=hi']){
  await writeFile(join(dir,'provider.json'),JSON.stringify({
   schema:'mas-browser-provider-1',mode:'relay',endpoint}));
  await assert.rejects(provider(runtime),/relay_requires_local_ssh_tunnel/);
 }
 console.log('BROWSER_RELAY_POLICY_OK scoped key localhost-only remote provider');
}finally{
 await new Promise(ok=>mock.close(ok));
 await rm(root,{recursive:true,force:true});
}
