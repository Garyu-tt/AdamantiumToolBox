import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {packageDigest,saveRegistry} from '../frank-addons/bridge/approval.mjs';
import {bridgeGraph,bridgeInvoke} from '../frank-addons/bridge/runtime.mjs';
const root=await mkdtemp(join(tmpdir(),'frank-bridge-'));
process.env.ADA_FRANK_STATE_DIR=join(root,'owner-private');
const secret='frank-bridge-test-internal-secret';
let server;
try{
 const dir=join(root,'frank-addons','python','hello');
 await mkdir(join(dir,'modules'),{recursive:true});
 const m={schema:'frank-addon-1',id:'hello',language:'python',name:'Hello',
  version:'0.1.0',entry:'main.py',adapter:'frankenstein.adapter.python',
  lifecycle:'independent',permissions:[],actions:[{id:'echo',title:'Echo'}]};
 await writeFile(join(dir,'frank-addon.json'),JSON.stringify(m));
 await writeFile(join(dir,'main.py'),'print("hello")');
 await writeFile(join(dir,'modules','nested.py'),'pass');
 server=createServer(async(req,res)=>{
  if(req.headers['x-internal-key']!==secret){res.writeHead(401);res.end();return;}
  res.setHeader('Content-Type','application/json');
  if(req.url==='/health'){
   res.end(JSON.stringify({protocol:'frank-adapter-1',adapter:m.adapter}));return;
  }
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw);
  res.end(JSON.stringify({result:{action:body.action,params:body.params,key:body.package.key}}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const d={schema:'frank-registry-1',packages:[],
  adapters:[{capability:m.adapter,port:server.address().port}]};
 assert.equal((await bridgeGraph(root,secret)).nodes.length,2);
 d.packages=[{key:'frank.python.hello',digest:await packageDigest(dir)}];
 await saveRegistry(d);
 assert((await bridgeGraph(root,secret)).nodes.some(x=>x.id==='frankenstein.python.hello.echo'));
 assert.deepEqual(await bridgeInvoke(root,secret,'frankenstein.python.hello.echo',{v:1}),
  {action:'echo',params:{v:1},key:'frank.python.hello'});
 assert.equal((await bridgeInvoke(root,secret,'frankenstein.list')).packages.length,1);
 await writeFile(join(dir,'modules','nested.py'),'changed');
 assert.equal((await bridgeGraph(root,secret)).nodes.length,2);
 await assert.rejects(bridgeInvoke(root,secret,'frankenstein.python.hello.echo'),/capability_unavailable/);
 console.log('FRANK_BRIDGE_OK approval, adapter, graph, recursive integrity');
}finally{
 if(server)await new Promise(ok=>server.close(ok));
 await rm(root,{recursive:true,force:true});
}
