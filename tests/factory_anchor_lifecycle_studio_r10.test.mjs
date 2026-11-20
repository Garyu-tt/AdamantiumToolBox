// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {factoryLifecycleStudioPreview} from '../packages/factory_anchor/studio-lifecycle-r10.mjs';
test('R10 immutable Node-RED graph reports missing policy and staged-only states',()=>{
 const root=resolve('r10-public-status');
 const lens=factoryLifecycleStudioPreview(root);
 assert.equal(lens.nodes.length,12);
 assert.equal(lens.mutatesPolicies,false);
 assert.equal(lens.activatesPlugins,false);
 assert.equal(lens.canGrantPermissions,false);
 const ids=new Set(lens.nodes.map(n=>n.id));
 assert.equal(ids.size,lens.nodes.length);
 const safe=new Set(['tab','comment','watch','inject','file in','json','switch','debug']);
 assert.ok(lens.nodes.every(n=>safe.has(n.type)));
 assert.ok(lens.nodes.every(n=>!JSON.stringify(n).includes('privateKey')));
 for(const n of lens.nodes)for(const wires of n.wires||[])
  for(const target of wires)assert.ok(ids.has(target));
 assert.equal(lens.nodes.find(n=>n.type==='file in').filename,
  join(root,'factory-anchor-lifecycle-r10.json'));
 assert.deepEqual(lens.nodes.find(n=>n.type==='switch').rules.map(x=>x.v),
  ['signed_staged_unactivated','ready_to_stage',undefined]);
 for(const unsafe of [null,'','a/relative/path'])
  assert.throws(()=>factoryLifecycleStudioPreview(unsafe),
   /absolute_lifecycle_status_directory_required/);
});
