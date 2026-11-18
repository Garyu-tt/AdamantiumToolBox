import {spawnSync} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {hash} from './gauntlet-evidence-contract.mjs';
import {checkEvidence} from './gauntlet-evidence-contract.mjs';
const scripts=process.argv.slice(2),valid=/^tests\/gauntlet[a-z_]*\.test\.mjs$/;
if(!scripts.length||scripts.length>20||scripts.some(s=>!valid.test(s)))
 throw Error('unapproved_qa_script');
const report={schema:'gauntlet-ci-evidence-1',
 commit_sha:process.env.GITHUB_SHA||'local-fixture',
 run_id:process.env.GITHUB_RUN_ID||'local-fixture',
 run_attempt:process.env.GITHUB_RUN_ATTEMPT||'0',
 event:process.env.GITHUB_EVENT_NAME||'local',
 executor:process.env.GITHUB_ACTIONS==='true'?'github-actions':'local',
 tests:[]};
for(const name of scripts){
 const start=Date.now();
 const result=spawnSync(process.execPath,[resolve(name)],{
  encoding:'utf8',timeout:90000,maxBuffer:65536,
  env:{...process.env,NODE_ENV:'test'}});
 const log=(result.stdout||'')+'\n'+(result.stderr||'')+
  (result.error?'\nPROCESS_ERROR: '+result.error.code:'');
 const status=result.status===0&&!result.error?'PASS':'FAIL';
 report.tests.push({name,exit_code:result.status,
  signal:result.signal||null,duration_ms:Date.now()-start,
  status,log,log_sha256:hash(log)});
}
const checked=checkEvidence(report),path=process.env.GAUNTLET_EVIDENCE_PATH;
if(!path)throw Error('GAUNTLET_EVIDENCE_PATH_required');
await mkdir(dirname(path),{recursive:true});
await writeFile(path,JSON.stringify({report,sha256:checked.sha256},null,2));
console.log('GAUNTLET_CI_EVIDENCE',checked.sha256,
 checked.tests,checked.all_pass?'PASS':'FAIL');
if(!checked.all_pass)process.exitCode=1;
