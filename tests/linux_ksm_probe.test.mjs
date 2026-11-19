import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
if(process.platform!=='linux'){
 console.log('DRAM_KSM_SKIPPED non-linux host');process.exit(0);
}
const cc=spawnSync('cc',['--version'],{encoding:'utf8'});
if(cc.error?.code==='ENOENT'){
 console.log('DRAM_KSM_SKIPPED no C compiler');process.exit(0);
}
assert.equal(cc.status,0);
const dir=await mkdtemp(join(tmpdir(),'dram-ksm-'));
try{
 const exe=join(dir,'ksm-benchmark');
 const source=resolve(dirname(fileURLToPath(import.meta.url)),'../experiments/dram/ksm-benchmark.c');
 const built=spawnSync('cc',['-std=c11','-O2','-Wall','-Wextra','-Werror',source,'-o',exe],{encoding:'utf8'});
 assert.equal(built.status,0,built.stderr);
 const noOp=spawnSync(exe,[],{encoding:'utf8',timeout:5000});
 assert.equal(noOp.status,0,noOp.stderr);
 const guard=JSON.parse(noOp.stdout);
 assert.equal(guard.status,'opt_in_required');
 assert.equal(guard.host_policy_modified,false);
 const attempt=spawnSync(exe,['--execute','--pages','16','--copies','2','--wait-ms','0'],{encoding:'utf8',timeout:5000});
 assert.equal(attempt.status,0,attempt.stderr);
 const sample=JSON.parse(attempt.stdout);
 assert.equal(sample.schema,'dram-ksm-probe-1');
 assert.equal(sample.host_policy_modified,false);
 assert.equal(sample.pages_per_copy,16);
 assert.equal(sample.copies,2);
 assert(sample.baseline.pss_kb>=0);
 assert(sample.after.pss_kb>=0);
 assert(['unavailable_no_sysfs','disabled_by_host','madvise_rejected',
   'smaps_unavailable','ksm_pages_observed','no_merge_observed'].includes(sample.status));
 if(sample.verified_ksm_merging)assert.equal(sample.status,'ksm_pages_observed');
 const bad=spawnSync(exe,['--execute','--pages','999999'],{encoding:'utf8',timeout:5000});
 assert.equal(bad.status,2);
 console.log('DRAM_KSM_PROBE_OK',sample.status,'no-global-policy-changes');
}finally{await rm(dir,{recursive:true,force:true});}
