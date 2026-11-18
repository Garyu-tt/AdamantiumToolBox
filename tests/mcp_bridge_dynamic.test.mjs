import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {identity} from '../core/node_identity.mjs';
import {current} from '../standards/lifecycle/registry.mjs';
import {catalog} from '../core/catalog.mjs';
const project=resolve(import.meta.dirname,'..');
test('MCP Bridge source stays optional and installs through signed dynamic Lifecycle',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ada-stage-'));
 const runtime=join(dir,'Adamantium Toolbox'),src=join(project,'packages','mcp_bridge');
 const cli=join(project,'tools','plugin-stage.mjs');
 const env={...process.env,LOCALAPPDATA:dir};
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],
  {cwd:project,env,encoding:'utf8',timeout:12000});
 const original=process.env.LOCALAPPDATA;
 try{
  await mkdir(runtime,{recursive:true});
  await identity(join(runtime,'mesh'));
  await writeFile(join(runtime,'policy.json'),JSON.stringify({
   schema:'mas-owner-policy-1',capabilities:['mcp_bridge.read']}));
  const denied=run('install',src);
  assert.notEqual(denied.status,0);assert.match(denied.stderr,/explicit_approval_required/);
  const prepared=run('prepare',src);
  assert.equal(prepared.status,0,prepared.stderr);
  const preview=JSON.parse(prepared.stdout);
  assert.equal(preview.state,'plan_ready');assert.equal(preview.plan.id,'mcp_bridge');
  assert.match(preview.hash,/^[0-9a-f]{64}$/);
  assert(!preview.plan.checks.includes('auto_start'));
  const installed=run('install',src,'--approve');
  assert.equal(installed.status,0,installed.stderr);
  const selected=JSON.parse(installed.stdout);
  assert.equal(selected.state,'selected');assert.equal(selected.catalog,'verified');
  assert.equal(selected.probe,'passed');
  process.env.LOCALAPPDATA=dir;
  const listed=(await catalog(project)).find(x=>x.id==='mcp_bridge');
  assert.equal(listed.source,'plugin');assert.equal(listed.hash,selected.hash);
  assert.equal((await current(runtime)).apps.find(x=>x.id==='mcp_bridge').hash,selected.hash);
  const repeat=run('install',src,'--approve');
  assert.equal(repeat.status,0,repeat.stderr);
  assert.equal(JSON.parse(repeat.stdout).state,'already_active');
 }finally{
  if(original===undefined)delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA=original;
  await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
});
