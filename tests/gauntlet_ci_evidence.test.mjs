import {strict as assert} from 'node:assert';
import {hash} from '../apps/gauntlet/shared.mjs';
import {checkEvidence} from '../apps/gauntlet/ci_evidence.mjs';
const log='actual stdout fixture',ok={name:'tests/gauntlet.test.mjs',
 exit_code:0,signal:null,status:'PASS',duration_ms:150,
 log,log_sha256:hash(log)};
const report={schema:'gauntlet-ci-evidence-1',commit_sha:'commit-test',
 run_id:'fixture',tests:[ok]};
assert.equal(checkEvidence(report).all_pass,true);
assert.throws(()=>checkEvidence({...report,tests:[{...ok,log:'forged'}]}),
 /evidence_hash_or_record/);
assert.throws(()=>checkEvidence({...report,tests:[{...ok,exit_code:1}]}),
 /fabricated_test_status/);
assert.equal(checkEvidence({...report,tests:[{...ok,status:'FAIL',
 exit_code:1}]}).all_pass,false);
console.log('GAUNTLET_CI_EVIDENCE_OK hash and observed exit code gate');
