import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {packageDigest,saveRegistry} from '../frank-addons/bridge/approval.mjs';
import {bridgeGraph,bridgeInvoke} from '../frank-addons/bridge/runtime.mjs';
const root=await mkdtemp(join(tmpdir(),'frank-pipe-'));
process.env.ADA_FRANK_STATE_DIR=join(root,'state');
const secret='test-frank-pipeline-internal-key',servers=[];
async function adapter(capability,handler){
 const server=createServer(async(req,res)=>{
  if(req.headers['x-internal-key']!==secret){res.writeHead(401);res.end();return;}
  res.setHeader('Content-Type','application/json');
  if(req.url==='/health'){
   res.end(JSON.stringify({protocol:'frank-adapter-1',adapter:capability}));return;
  }
  let raw='';for await(const part of req)raw+=part;
  const body=JSON.parse(raw);
  res.end(JSON.stringify({result:await handler(body)}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 servers.push(server);return server.address().port;
}
async function addon(language,adapterCapability){
 const id='hello',dir=join(root,'frank-addons',language,id);
 await mkdir(dir,{recursive:true});
 const m={schema:'frank-addon-1',id,language,name:id,version:'0.1.0',
  entry:'main.txt',adapter:adapterCapability,lifecycle:'independent',
  permissions:[],actions:[{id:'echo',title:'Echo'}]};
 await writeFile(join(dir,'main.txt'),'fixture');
 await writeFile(join(dir,'frank-addon.json'),JSON.stringify(m));
 return {key:'frank.'+language+'.'+id,digest:await packageDigest(dir),dir};
}
try{
 const python='frankenstein.adapter.python',js='frankenstein.adapter.javascript';
 const portPython=await adapter(python,body=>({from:'python',value:body.params}));
 const portJs=await adapter(js,body=>({from:'js',received:body.params.input}));
 const py=await addon('python',python),script=await addon('javascript',js);
 const registry={schema:'frank-registry-1',adapters:[
  {capability:python,port:portPython},{capability:js,port:portJs}],packages:[py]};
 await saveRegistry(registry);
 assert(!(await bridgeGraph(root,secret)).nodes.some(n=>n.id==='frankenstein.pipe'));
 registry.packages.push(script);await saveRegistry(registry);
 assert((await bridgeGraph(root,secret)).nodes.some(n=>n.id==='frankenstein.pipe'));
 const from='frankenstein.python.hello.echo',to='frankenstein.javascript.hello.echo';
 const input={text:'Привет 🌍',exact:{$frank:'i64',value:'9223372036854775807'}};
 const output=await bridgeInvoke(root,secret,'frankenstein.pipe',{from,to,input});
 assert.deepEqual(output,{from:'js',received:{from:'python',value:input}});
 await assert.rejects(bridgeInvoke(root,secret,'frankenstein.pipe',
  {from:'frankenstein.nope',to,input}),/capability_unavailable/);
 await assert.rejects(bridgeInvoke(root,secret,'frankenstein.pipe',
  {from,to,input:JSON.parse('{"__proto__":true}')}),/invalid_frank_value/);
 await assert.rejects(bridgeInvoke(root,secret,'frankenstein.pipe',
  {from,to,input:{over:Number.MAX_SAFE_INTEGER+2}}),/invalid_frank_value/);
 await writeFile(join(script.dir,'main.txt'),'tampered');
 await assert.rejects(bridgeInvoke(root,secret,'frankenstein.pipe',{from,to,input}),
  /capability_unavailable/);
 assert(!(await bridgeGraph(root,secret)).nodes.some(n=>n.id==='frankenstein.pipe'));
 console.log('FRANK_PIPELINE_OK two languages, typed value, invalid action, digest revocation');
}finally{
 for(const server of servers)await new Promise(ok=>server.close(ok));
 await rm(root,{recursive:true,force:true});
}
