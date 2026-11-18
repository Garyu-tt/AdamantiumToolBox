import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {authorized,CAPABILITY} from '../frank-addons/bridge/providers/python/authorize.mjs';
import {runPython,sandboxReady} from '../frank-addons/bridge/providers/python/sandbox.mjs';
import {packageDigest,saveRegistry} from '../frank-addons/bridge/approval.mjs';
const root=await mkdtemp(join(tmpdir(),'frank-python-test-'));
process.env.ADA_FRANK_STATE_DIR=join(root,'state');
try{
 const dir=join(root,'frank-addons','python','test');
 await mkdir(join(dir,'modules'),{recursive:true});
 const m={schema:'frank-addon-1',id:'test',name:'test',language:'python',
  version:'0.1.0',entry:'main.py',adapter:CAPABILITY,
  lifecycle:'independent',permissions:[],actions:[{id:'echo',title:'Echo'}]};
 await writeFile(join(dir,'main.py'),'from modules.worker import handle\n');
 await writeFile(join(dir,'modules','worker.py'),
  'def handle(action, params):\n    return params\n');
 await writeFile(join(dir,'frank-addon.json'),JSON.stringify(m));
 const port=9214,key='frank.python.test';
 const d={schema:'frank-registry-1',adapters:[{capability:CAPABILITY,port}],packages:[]};
 const digest=await packageDigest(dir);
 await saveRegistry(d);
 await assert.rejects(authorized(root,key,'echo',port),/not_approved/);
 d.packages=[{key,digest}];await saveRegistry(d);
 const auth=await authorized(root,key,'echo',port);
 assert.equal(auth.digest,digest);
 await assert.rejects(authorized(root,key,'other',port),/not_declared/);
 await assert.rejects(authorized(root,key,'echo',port+1),/adapter_unregistered/);
 if(await sandboxReady()){
  assert.deepEqual(await runPython(auth.pkg,digest,'echo',{ping:'pong'}),{ping:'pong'});
  console.log('FRANK_PYTHON_RUNTIME_OK Linux namespace execution + nested imports');
 }else console.log('FRANK_PYTHON_RUNTIME_SKIPPED sandbox unavailable (fail closed)');
 await writeFile(join(dir,'modules','worker.py'),'print("changed")');
 await assert.rejects(authorized(root,key,'echo',port),/package_changed/);
 m.permissions=['files.read'];
 await writeFile(join(dir,'frank-addon.json'),JSON.stringify(m));
 d.packages[0].digest=await packageDigest(dir);await saveRegistry(d);
 await assert.rejects(authorized(root,key,'echo',port),/scoped_permissions/);
 console.log('FRANK_PYTHON_POLICY_OK approval, actions, adapter port, integrity, permissions');
}finally{await rm(root,{recursive:true,force:true});}
