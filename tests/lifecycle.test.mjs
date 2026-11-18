import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {identity,seal} from '../standards/mesh/identity.mjs';
import {packDir} from '../standards/mesh/bundle.mjs';
import {receive} from '../standards/mesh/store.mjs';
import {planActivation} from '../standards/lifecycle/plan.mjs';
import {activate,rollback} from '../standards/lifecycle/apply.mjs';
import {current} from '../standards/lifecycle/registry.mjs';
import {catalog} from '../core/catalog.mjs';
import {resolveAsset} from '../core/assets.mjs';
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const home=await mkdtemp(join(tmpdir(),'mas-lifecycle-'));
process.env.LOCALAPPDATA=home;
const runtime=join(home,'Adamantium Toolbox'),name='fixture';
const owner=await identity(join(runtime,'mesh'));
const rule={[owner.id]:{publicKey:owner.publicKey,receive:true,activate:true}};
await writeFile(join(runtime,'policy.json'),JSON.stringify({schema:'mas-owner-policy-1',capabilities:['workspace.read']}));
async function packageVersion(version,mode='ok',port=9131,perms=['workspace.read']){
 const directory=join(home,'test-'+version.replace(/\W/g,'')+'-'+mode+'-'+port);
 await mkdir(directory);
 const manifest={mas:'1.0',id:name,name:'Fixture',version,icon:name,lifecycle:'independent',
  service:{protocol:'mas-http-1',port},ui:{standard:'mas-ui-1',mode:'embedded-and-standalone'},
  auth:{mode:'host-delegated'},permissions:perms,events:{schema:'mas-event-1'},
  data:{refs:'mas-ref-1'},updates:{strategy:'semver',migrations:[]}};
 await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest));
 const script=mode==='bad'?"throw Error('bad startup');":[
  "import http from 'node:http';",
  "const secret=process.env.ADA_INTERNAL_KEY;",
  "const spec={app:'fixture',version:1,nodes:[{id:'fixture.view',type:'view',title:'Fixture',icon:'fixture',requires:['workspace.read']}],edges:[]};",
  "const send=(res,data)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};",
  "http.createServer((req,res)=>{",
  "if(req.url==='/health')return send(res,{app:'fixture',version:"+JSON.stringify(version)+"});",
  "if(req.url==='/graph'&&req.headers['x-internal-key']===secret)return send(res,spec);",
  "res.writeHead(403);res.end();",
  "}).listen(Number(process.env.APP_PORT),'127.0.0.1');"
 ].join('\n');
 await writeFile(join(directory,'service.mjs'),script);
 await writeFile(join(directory,'view.js'),'export async function mount(host){host.textContent="Fixture"}');
 await writeFile(join(directory,'icon.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 const env=seal(await packDir(directory),owner);
 await receive(runtime,env,rule);return env.hash;
}
try{
 const first=await packageVersion('1.0.0');
 const plan=await planActivation(project,runtime,first);
 assert.equal(plan.previous,null);
 await assert.rejects(activate(project,runtime,plan),/explicit_approval_required/);
 await assert.rejects(activate(project,runtime,{...plan,plan_id:'altered'},true),/plan_changed/);
 const activated=await activate(project,runtime,plan,true);
 assert.equal(activated.state,'selected');
 assert.equal(activated.probe,'passed');
 assert.equal((await current(runtime)).apps[0].hash,first);
 const entry=(await catalog(project)).find(a=>a.id===name);
 assert.equal(entry.source,'plugin');assert.equal(entry.version,'1.0.0');
 const roots=new Map((await catalog(project)).map(a=>[a.id,{directory:a.directory,hash:a.hash}]));
 assert((await resolveAsset(project,'/apps/fixture/'+first+'/view.js',roots)).endsWith(join(first,'view.js')));
 assert((await resolveAsset(project,'/apps/fixture/'+first+'/icon.svg',roots)).endsWith(join(first,'icon.svg')));
 await assert.rejects(resolveAsset(project,'/apps/fixture/'+first+'/manifest.json',roots),/asset_type_denied/);
 await assert.rejects(resolveAsset(project,'/apps/fixture/view.js',roots),/stale_asset_revision/);
 const bad=await packageVersion('1.1.0','bad');
 const badPlan=await planActivation(project,runtime,bad);
 await assert.rejects(activate(project,runtime,badPlan,true),/probe_failed/);
 assert.equal((await current(runtime)).apps[0].hash,first);
 const second=await packageVersion('1.1.0','ok');
 const next=await planActivation(project,runtime,second);
 assert.equal(next.previous,first);
 await activate(project,runtime,next,true);
 assert.equal((await current(runtime)).apps[0].hash,second);
 await assert.rejects(activate(project,runtime,next,true),/already_active/);
 await assert.rejects(planActivation(project,runtime,first),/version_downgrade/);
 const rolled=await rollback(project,runtime,name,true);
 assert.equal(rolled.hash,first);
 assert.equal((await catalog(project)).find(x=>x.id===name).version,'1.0.0');
 const removed=await rollback(project,runtime,name,true);
 assert.equal(removed.hash,second);
 const collision=await packageVersion('2.0.0','ok',8881);
 await assert.rejects(planActivation(project,runtime,collision),/port_reserved/);
 const breaking=await packageVersion('2.0.0','ok',9131);
 await assert.rejects(planActivation(project,runtime,breaking),/major_upgrade_requires_review/);
 const denied=await packageVersion('2.1.0','ok',9132,['scope.admin']);
 await assert.rejects(planActivation(project,runtime,denied),/missing_permission_approval/);
 const doc=await current(runtime);
 assert(doc.history.length>=4);
 await writeFile(join(runtime,'plugins','installed',second,'unsigned.js'),'export const injected=true');
 assert(!(await catalog(project)).some(a=>a.id===name));
 await writeFile(join(runtime,'plugins','active.json'),'{corrupt');
 assert((await catalog(project)).some(a=>a.id==='editor'));
 console.log('LIFECYCLE_OK signed plan staged probe apply reject rollback tamper perms ports');
}finally{await rm(home,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
