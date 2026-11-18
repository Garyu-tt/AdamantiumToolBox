import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createAdapterServer} from '../frank-addons/bridge/providers/shared/server.mjs';
import {authorized,CAPABILITY} from '../frank-addons/bridge/providers/javascript/authorize.mjs';
import {runJavaScript,sandboxReady} from '../frank-addons/bridge/providers/javascript/sandbox.mjs';
import {packageDigest,saveRegistry} from '../frank-addons/bridge/approval.mjs';
import {bridgeGraph,bridgeInvoke} from '../frank-addons/bridge/runtime.mjs';
const root=await mkdtemp(join(tmpdir(),'frank-js-test-'));
process.env.ADA_FRANK_STATE_DIR=join(root,'owner-state');
const secret='test-frank-javascript-service-key';
let server;
try{
 const directory=join(root,'frank-addons','javascript','hello');
 await mkdir(join(directory,'modules'),{recursive:true});
 const manifest={schema:'frank-addon-1',id:'hello',language:'javascript',
  name:'Hello',version:'0.1.0',entry:'main.mjs',adapter:CAPABILITY,
  lifecycle:'independent',permissions:[],
  actions:[{id:'echo',title:'Echo'},{id:'sum',title:'Sum'}]};
 await writeFile(join(directory,'frank-addon.json'),JSON.stringify(manifest));
 await writeFile(join(directory,'main.mjs'),
  "import {sum} from './modules/math.mjs';\nexport const handle=(action,p)=>action==='sum'?sum(p.numbers):p;\n");
 await writeFile(join(directory,'modules','math.mjs'),
  'export const sum=x=>x.reduce((a,b)=>a+b,0);\n');
 server=createAdapterServer({root,secret,port:0,capability:CAPABILITY,
  language:'javascript',ready:sandboxReady,execute:runJavaScript});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port,key='frank.javascript.hello';
 const registry={schema:'frank-registry-1',packages:[],adapters:[{capability:CAPABILITY,port}]};
 await saveRegistry(registry);
 assert.equal((await bridgeGraph(root,secret)).nodes.length,2);
 await assert.rejects(authorized(root,key,'echo',port),/not_approved/);
 registry.packages=[{key,digest:await packageDigest(directory)}];
 await saveRegistry(registry);
 const data=await authorized(root,key,'echo',port);
 assert.equal(data.pkg.language,'javascript');
 await assert.rejects(authorized(root,key,'delete',port),/not_declared/);
 await assert.rejects(authorized(root,key,'echo',port+1),/adapter_unregistered/);
 const address='http://127.0.0.1:'+port;
 const untrusted=await fetch(address+'/health');
 assert.equal(untrusted.status,401);
 const active=await sandboxReady();
 if(process.platform==='linux')assert(active,'Bubblewrap JS sandbox must work in Linux CI');
 if(active){
  const health=await fetch(address+'/health',{headers:{'X-Internal-Key':secret}});
  assert.equal(health.status,200);
  const graph=await bridgeGraph(root,secret);
  assert(graph.nodes.some(n=>n.id==='frankenstein.javascript.hello.sum'));
  const result=await bridgeInvoke(root,secret,'frankenstein.javascript.hello.sum',{numbers:[7,8,9]});
  assert.equal(result,24);
  const body={protocol:'frank-adapter-1',
   package:{key,entry:'/etc/passwd',directory:'/etc'},action:'echo',params:{text:'Привет 🌍'}};
  const direct=await fetch(address+'/invoke',{method:'POST',
   headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},
   body:JSON.stringify(body)});
  assert.equal(direct.status,200);
  assert.deepEqual((await direct.json()).result,{text:'Привет 🌍'});
  console.log('FRANK_JAVASCRIPT_RUNTIME_OK verified sandbox, nested imports, Unicode, bridge');
 }else{
  assert.equal((await bridgeGraph(root,secret)).nodes.length,2);
  console.log('FRANK_JAVASCRIPT_RUNTIME_UNAVAILABLE fail-closed platform');
 }
 await writeFile(join(directory,'modules','math.mjs'),'export const sum=x=>0;\n');
 await assert.rejects(authorized(root,key,'echo',port),/package_changed/);
 assert.equal((await bridgeGraph(root,secret)).nodes.length,2);
 manifest.permissions=['secrets.read'];
 await writeFile(join(directory,'frank-addon.json'),JSON.stringify(manifest));
 registry.packages[0].digest=await packageDigest(directory);
 await saveRegistry(registry);
 await assert.rejects(authorized(root,key,'echo',port),/scoped_permissions/);
 console.log('FRANK_JAVASCRIPT_POLICY_OK unauthorized, action bounds, hashes and permissions');
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 await rm(root,{recursive:true,force:true});
}
