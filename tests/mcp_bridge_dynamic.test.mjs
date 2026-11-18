import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,cp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {identity} from '../core/node_identity.mjs';
import {current} from '../standards/lifecycle/registry.mjs';
import {catalog} from '../core/catalog.mjs';
const project=resolve(import.meta.dirname,'..');
test('MCP Bridge dynamic Lifecycle installs, reuses port on upgrade and never grants rights',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ada-stage-'));
 const runtime=join(dir,'Adamantium Toolbox'),src=join(project,'packages','mcp_bridge');
 const cli=join(project,'tools','plugin-stage.mjs'),port=9101;
 const env={...process.env,LOCALAPPDATA:dir};
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],
  {cwd:project,env,encoding:'utf8',timeout:12000});
 const original=process.env.LOCALAPPDATA;
 try{
  await mkdir(runtime,{recursive:true});
  await identity(join(runtime,'mesh'));
  await writeFile(join(runtime,'policy.json'),JSON.stringify({
   schema:'mas-owner-policy-1',capabilities:['mcp_bridge.read']}));
  const denied=run('install',src,'--port='+port);
  assert.notEqual(denied.status,0);assert.match(denied.stderr,/explicit_approval_required/);
  const prepared=run('prepare',src,'--port='+port);
  assert.equal(prepared.status,0,prepared.stderr);
  const preview=JSON.parse(prepared.stdout);
  assert.equal(preview.state,'plan_ready');assert.equal(preview.plan.id,'mcp_bridge');
  assert.equal(preview.plan.port,port);assert.match(preview.hash,/^[0-9a-f]{64}$/);
  const installed=run('install',src,'--approve','--port='+port);
  assert.equal(installed.status,0,installed.stderr);
  const selected=JSON.parse(installed.stdout);
  assert.equal(selected.state,'selected');assert.equal(selected.catalog,'verified');
  assert.equal(selected.probe,'passed');assert.equal(selected.port,port);
  process.env.LOCALAPPDATA=dir;
  let listed=(await catalog(project)).find(x=>x.id==='mcp_bridge');
  assert.equal(listed.source,'plugin');assert.equal(listed.hash,selected.hash);
  assert.equal(listed.service.port,port);
  const repeat=run('install',src,'--approve','--port='+port);
  assert.equal(repeat.status,0,repeat.stderr);
  assert.equal(JSON.parse(repeat.stdout).state,'already_active');
  const upgraded=join(dir,'upgrade');await cp(src,upgraded,{recursive:true});
  const file=join(upgraded,'manifest.json'),next=JSON.parse(await readFile(file,'utf8'));
  next.version='0.4.0';next.service.port=9155;await writeFile(file,JSON.stringify(next));
  const fresh=run('prepare',upgraded);
  assert.equal(fresh.status,0,fresh.stderr);
  assert.equal(JSON.parse(fresh.stdout).plan.port,port);
  const changed=run('install',upgraded,'--approve');
  assert.equal(changed.status,0,changed.stderr);
  const newer=JSON.parse(changed.stdout);
  assert.equal(newer.state,'selected');assert.equal(newer.port,port);
  listed=(await catalog(project)).find(x=>x.id==='mcp_bridge');
  assert.equal(listed.version,'0.4.0');assert.equal(listed.service.port,port);
  assert.equal((await current(runtime)).apps.find(x=>x.id==='mcp_bridge').hash,newer.hash);
 }finally{
  if(original===undefined)delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA=original;
  await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
});
