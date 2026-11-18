import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RuntimeGuard,loadRuntimePolicy,readGuard,persistGuard} from '../core/runtime_guard.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const runtime=await mkdtemp(join(tmpdir(),'ada-guard-'));
try{
 const p=await loadRuntimePolicy(root,runtime);
 let now=100000;
 const g=new RuntimeGuard({...p,crashLimit:3,windowMs:30000,backoffBaseMs:500,
  backoffMaxMs:10000,stableResetMs:2000}, {},()=>now);
 const a='app:fixture@hashA',b='app:fixture@hashB';
 assert(g.allowed(a));
 let f=g.fail(a);assert.equal(f.failures.length,1);assert(!g.allowed(a));
 now+=501;assert(g.allowed(a));g.healthy(a);
 now+=10;f=g.fail(a);assert.equal(f.failures.length,2);
 now+=1001;f=g.fail(a);assert(f.blocked);assert(!g.allowed(a));
 assert(g.allowed(b));
 g.attempted(a);assert(g.get(a).attempted);
 await persistGuard(runtime,g);
 const state=await readGuard(runtime);
 assert(state.entries[a].blocked);assert(state.entries[a].attempted);
 const recovered=new RuntimeGuard(g.policy,state.entries,()=>now);
 assert(!recovered.allowed(a));assert(recovered.allowed(b));
 now+=31000;assert(!recovered.allowed(a),'quarantine survives incident window');
 recovered.fail(b);now+=600;recovered.healthy(b);
 now+=2100;recovered.healthy(b);
 assert.deepEqual(recovered.get(b).failures,[]);
 await persistGuard(runtime,recovered);
 assert(!(await readGuard(runtime)).entries[b]);
 console.log('RUNTIME_GUARD_OK backoff persistent quarantine stable reset revision separation');
}finally{await rm(runtime,{recursive:true,force:true});}
