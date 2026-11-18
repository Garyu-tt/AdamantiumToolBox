import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateManifest,validateGraph} from '../core/contract.mjs';
import {providers,dispatch} from '../apps/godot/registry.mjs';
import {engine,projectPath} from '../apps/godot_local/config.mjs';
const root=await mkdtemp(join(tmpdir(),'godot-mas-')),previous=globalThis.fetch;
process.env.ADA_TOKEN='godot-test-token-with-sufficient-length';
process.env.ADA_CORE_URL='http://127.0.0.1:15555/';
delete process.env.ADA_GODOT_EXECUTABLE;
const kinds=['engine.inspect','project.check','session.start','session.status','session.stop'];
const nodes=[{id:'mock.provider',type:'resource',provider:{
 schema:'mas-world-engine-provider-1',engine:'godot',version:'4.7.2',
 locality:'local',operations:kinds.map(kind=>({kind,action:'mock.'+kind}))}},
 ...kinds.map(kind=>({id:'mock.'+kind,type:'action'}))];
const log=[];
globalThis.fetch=async(url,options={})=>{
 if(url.endsWith('/api/graph'))return new Response(JSON.stringify({nodes}),{status:200});
 if(url.endsWith('/api/invoke')){
  const body=JSON.parse(options.body);log.push(body);
  return new Response(JSON.stringify({result:{status:'ok',sessionId:'s1'}}),{status:200});
 }
 throw Error('unexpected_fetch');
};
try{
 for(const app of ['godot','godot_local']){
  const m=JSON.parse(await readFile(new URL('../apps/'+app+'/manifest.json',import.meta.url)));
  assert(validateManifest(m));
  assert(validateGraph({app:m.id,version:1,nodes:[{id:m.id+'.view',type:'view',
   title:'View',icon:m.icon,requires:[m.permissions[0]]}],edges:[]},m));
 }
 assert.equal((await providers()).length,1);
 const started=await dispatch('session.start',{projectId:'washitsu',profile:'headless'});
 assert.equal(started.providerId,'mock.provider');
 assert.equal(log[0].action,'mock.session.start');
 assert.equal(log[0].params.projectId,'washitsu');
 await assert.rejects(dispatch('session.stop',{sessionId:'s1'}),/provider_id_required/);
 await assert.rejects(dispatch('unknown',{}),/invalid_request/);
 assert.equal((await engine()).configured,false);
 const base=join(root,'projects'),project=join(base,'washitsu');
 await mkdir(project,{recursive:true});
 await writeFile(join(project,'project.godot'),'config_version=5\n');
 process.env.ADA_GODOT_PROJECT_ROOT=base;
 assert((await projectPath('washitsu')).endsWith('washitsu'));
 await assert.rejects(projectPath('../outside'),/invalid_project_id/);
 console.log('GODOT_MAS_OK discovery, routing, project isolation');
}finally{
 globalThis.fetch=previous;
 delete process.env.ADA_GODOT_PROJECT_ROOT;
 await rm(root,{recursive:true,force:true});
}
