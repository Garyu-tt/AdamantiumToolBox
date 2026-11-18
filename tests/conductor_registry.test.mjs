import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from '../tools/conductor-registry.mjs';

const at='2026-11-18T20:00:00.000Z';
const manifest=(id,port,permissions=[])=>({mas:'1.0',id,version:'0.1.0',name:id,
 service:{port},permissions,lifecycle:'independent'});
async function fixture(){const root=await mkdtemp(join(tmpdir(),'conductor-registry-'));
 const add=async(path,body)=>{const f=join(root,path);await mkdir(f.slice(0,f.lastIndexOf('/')),{recursive:true});
  await writeFile(f,JSON.stringify(body));};
 return {root,add,cleanup:()=>rm(root,{recursive:true,force:true})};}

test('discovers MAS and language separated Frank addons without static app names',async()=>{
 const f=await fixture();try{
  await f.add('apps/aa/manifest.json',manifest('aa',9001,['a.read']));
  await f.add('plugins/another/manifest.json',manifest('another',9002));
  await f.add('frank-addons/python/aa/frank-addon.json',
   {schema:'frank-addon-1',id:'aa',language:'python',version:'1.2.3',name:'A'});
  const x=await build({root:f.root,at});
  assert.deepEqual(x.registry.records.map(y=>y.uid),['frank:python:aa','mas:aa','mas:another']);
  assert(x.registry.records.every(y=>y.runtime_state==='unknown'));
  assert(x.registry.records.every(y=>y.manifest.sha256.length===64));
 }finally{await f.cleanup();}
});
test('detects duplicate IDs and source-level conflicts without merging records',async()=>{
 const f=await fixture();try{
  await f.add('apps/aa/manifest.json',{...manifest('aa',9001),capabilities:['shared.read']});
  await f.add('plugins/aa/manifest.json',manifest('aa',9002));
  await f.add('apps/bb/manifest.json',{...manifest('bb',9001),capabilities:['shared.read']});
  const x=await build({root:f.root,at});
  assert.equal(x.registry.records.length,3);
  assert.deepEqual(x.reconciliation.conflicts.map(y=>y.type),
   ['capability_claim_overlap','duplicate_uid','service_port_collision']);
 }finally{await f.cleanup();}
});
test('PR-sourced code never implies merge, activation or deployment',async()=>{
 const f=await fixture();try{
  await f.add('apps/experimental/manifest.json',manifest('experimental',9003));
  const x=await build({root:f.root,at,'source-type':'git_pr',ref:'PR-99'});
  assert.equal(x.registry.records[0].source_state,'git_pr');
  assert.equal(x.registry.records[0].runtime_state,'unknown');
  assert.equal(x.registry.records[0].manifest.ref,'PR-99');
 }finally{await f.cleanup();}
});
test('previous snapshots become absent-from-scanned-source, not uninstalled',async()=>{
 const f=await fixture();try{
  await f.add('apps/old/manifest.json',manifest('old',9002));
  const old=(await build({root:f.root,at})).registry;
  const prev=join(f.root,'prev.json');await writeFile(prev,JSON.stringify(old));
  await rm(join(f.root,'apps'),{recursive:true,force:true});
  const x=await build({root:f.root,at,previous:prev});
  assert.equal(x.reconciliation.changes[0].type,'absent_from_scanned_source');
  assert.equal(x.reconciliation.changes[0].runtime_state,'unknown');
 }finally{await f.cleanup();}
});
test('external runtime signal is attributed, freshness checked, never trusted as signed',async()=>{
 const f=await fixture();try{
  const prev={apps:[{uid:'mas:aa',state:'stopped',capabilities:[]}]};
  const now={observed_at:'2026-11-18T18:00:00Z',source:{kind:'unverified_export'},
   apps:[{uid:'mas:aa',state:'running',capabilities:['a.view'],node:'n'}]};
  const before=join(f.root,'before.json'),after=join(f.root,'after.json');
  await writeFile(before,JSON.stringify(prev));await writeFile(after,JSON.stringify(now));
  const x=await build({root:f.root,at,observations:after,
   'previous-observations':before,'max-age-minutes':'30'});
  assert.equal(x.reconciliation.reported_runtime[0].freshness,'stale');
  assert.equal(x.reconciliation.reported_runtime[0].verified_by_registry,false);
  assert.equal(x.reconciliation.changes[0].type,'reported_runtime_signal_changed');
 }finally{await f.cleanup();}
});
test('symlinked manifests are never traversed',async()=>{
 const f=await fixture();try{
  await f.add('external/manifest.json',manifest('outside',9009));
  await mkdir(join(f.root,'apps'),{recursive:true});
  await symlink(join(f.root,'external'),join(f.root,'apps','linked'));
  const x=await build({root:f.root,at});
  assert.equal(x.registry.records.filter(y=>y.manifest.path.startsWith('apps/')).length,0);
 }finally{await f.cleanup();}
});