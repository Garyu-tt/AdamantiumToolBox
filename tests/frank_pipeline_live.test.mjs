import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createAdapterServer} from '../frank-addons/bridge/providers/shared/server.mjs';
import {sandboxReady as pyReady,runPython} from '../frank-addons/bridge/providers/python/sandbox.mjs';
import {sandboxReady as jsReady,runJavaScript} from '../frank-addons/bridge/providers/javascript/sandbox.mjs';
import {packageDigest,saveRegistry} from '../frank-addons/bridge/approval.mjs';
import {bridgeInvoke} from '../frank-addons/bridge/runtime.mjs';
const root=await mkdtemp(join(tmpdir(),'frank-pipe-live-'));
process.env.ADA_FRANK_STATE_DIR=join(root,'state');
const secret='test-frank-pipeline-runtime-secret',servers=[];
async function addon(language,entry,contents){
 const dir=join(root,'frank-addons',language,'hello');
 await mkdir(dir,{recursive:true});
 const m={schema:'frank-addon-1',id:'hello',language,name:'hello',
  version:'0.1.0',entry,adapter:'frankenstein.adapter.'+language,
  lifecycle:'independent',permissions:[],actions:[{id:'echo',title:'Echo'}]};
 await writeFile(join(dir,'frank-addon.json'),JSON.stringify(m));
 await writeFile(join(dir,entry),contents);
 return {key:'frank.'+language+'.hello',digest:await packageDigest(dir)};
}
async function server(language,ready,execute){
 const capability='frankenstein.adapter.'+language;
 const s=createAdapterServer({root,secret,port:0,capability,language,ready,execute});
 s.listen(0,'127.0.0.1');await once(s,'listening');servers.push(s);
 return {capability,port:s.address().port};
}
try{
 const ok=await pyReady()&&await jsReady();
 if(process.platform==='linux'&&process.env.CI)assert(ok,'Linux CI needs both isolated adapters');
 if(!ok)console.log('FRANK_PIPELINE_LIVE_UNAVAILABLE safe platform skip');
 else{
  const py=await addon('python','main.py',
   'def handle(action,params):\n    return {"origin":"python","payload":params}\n');
  const js=await addon('javascript','main.mjs',
   'export const handle=async(action,params)=>({origin:"js",received:params.input});\n');
  const adapters=[await server('python',pyReady,runPython),
   await server('javascript',jsReady,runJavaScript)];
  await saveRegistry({schema:'frank-registry-1',adapters,packages:[py,js]});
  const input={text:'Привет 🌍',integer:{$frank:'i64',value:'9223372036854775807'},
   bytes:{$frank:'bytes',value:'AQID'}};
  const answer=await bridgeInvoke(root,secret,'frankenstein.pipe',{
   from:'frankenstein.python.hello.echo',to:'frankenstein.javascript.hello.echo',input});
  assert.deepEqual(answer,{origin:'js',received:{origin:'python',payload:input}});
  console.log('FRANK_PIPELINE_LIVE_OK Python -> JavaScript, sandbox, lossless typed tags');
 }
}finally{
 for(const s of servers)await new Promise(ok=>s.close(ok));
 await rm(root,{recursive:true,force:true});
}
