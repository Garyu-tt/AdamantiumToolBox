import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createAdapterServer} from '../frank-addons/bridge/providers/shared/server.mjs';
import {sandboxReady} from '../frank-addons/bridge/providers/rust/sandbox.mjs';
import {packageDigest,saveRegistry} from '../frank-addons/bridge/approval.mjs';
import {authorizedAddon} from '../frank-addons/bridge/providers/shared/authorize.mjs';
import {bridgeGraph,bridgeInvoke} from '../frank-addons/bridge/runtime.mjs';
const root=await mkdtemp(join(tmpdir(),'frank-rust-'));
process.env.ADA_FRANK_STATE_DIR=join(root,'state');
const capability='frankenstein.adapter.rust',secret='frank-rust-test-key-with-sufficient-length';
let server;
try{
 const dir=join(root,'frank-addons','rust','hello');
 await mkdir(join(dir,'modules'),{recursive:true});
 const manifest={schema:'frank-addon-1',language:'rust',id:'hello',name:'Hello',
  entry:'main.rs',version:'0.1.0',adapter:capability,lifecycle:'independent',
  permissions:[],actions:[{id:'echo',title:'Echo'}]};
 await writeFile(join(dir,'frank-addon.json'),JSON.stringify(manifest));
 await writeFile(join(dir,'main.rs'),
  'use std::io::{self,Read};\n#[path="modules/echo.rs"] mod echo;\nfn main(){let mut s=String::new();io::stdin().read_to_string(&mut s).unwrap();println!("{}",echo::reply(&s));}\n');
 await writeFile(join(dir,'modules','echo.rs'),
  'pub fn reply(s:&str)->String {let v=s.split(",\\\"params\\\":").nth(1).unwrap().strip_suffix("}").unwrap();format!("{{\\\"result\\\":{v}}}")}\n');
 server=createAdapterServer({root,secret,port:0,capability,language:'rust',
  ready:sandboxReady,execute:runRust});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port,key='frank.rust.hello';
 const registry={schema:'frank-registry-1',packages:[],adapters:[{capability,port}]};
 await saveRegistry(registry);
 assert.equal((await bridgeGraph(root,secret)).nodes.length,2);
 await assert.rejects(authorizedAddon(root,key,'echo',port,capability,'rust'),/not_approved/);
 registry.packages=[{key,digest:await packageDigest(dir)}];await saveRegistry(registry);
 await assert.rejects(authorizedAddon(root,key,'other',port,capability,'rust'),/not_declared/);
 const ready=await sandboxReady();
 if(process.platform==='linux'&&process.env.CI)assert(ready,'rustc must work in CI Linux namespace');
 if(ready){
  const graph=await bridgeGraph(root,secret);
  assert(graph.nodes.some(n=>n.id==='frankenstein.rust.hello.echo'));
  const params={text:'Привет 🌍',nested:{a:[1,true,null]}};
  assert.deepEqual(await bridgeInvoke(root,secret,'frankenstein.rust.hello.echo',params),params);
  console.log('FRANK_RUST_RUNTIME_OK sandbox rustc compile, nested modules, Unicode JSON, bridge');
 }else{
  assert.equal((await bridgeGraph(root,secret)).nodes.length,2);
  console.log('FRANK_RUST_UNAVAILABLE: fail closed (no sandbox/toolchain)');
 }
 await writeFile(join(dir,'modules','echo.rs'),'// changed');
 assert.equal((await bridgeGraph(root,secret)).nodes.length,2);
 await assert.rejects(authorizedAddon(root,key,'echo',port,capability,'rust'),/package_changed/);
 console.log('FRANK_RUST_POLICY_OK approvals, declared actions, recursive integrity');
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 await rm(root,{recursive:true,force:true});
}
