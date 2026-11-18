import {strict as assert} from 'node:assert';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {identity,lease} from '../apps/browser/continuity.mjs';
const root=await mkdtemp(join(tmpdir(),'mas-browser-lease-'));
try{
 const state=await identity(root);
 const again=await identity(root);assert.equal(state.id,again.id);
 const done=await lease(state.profile);
 await assert.rejects(lease(state.profile),/browser_profile_already_owned/);
 await done();
 await writeFile(join(state.profile,'.mas-active'),
  JSON.stringify({pid:999999999,at:'2020-01-01T00:00:00Z'}));
 const recovered=await lease(state.profile);
 await recovered();
 console.log('BROWSER_LEASE_OK exclusive owner crash recovery stable identity');
}finally{await rm(root,{recursive:true,force:true,maxRetries:6,retryDelay:100});}
