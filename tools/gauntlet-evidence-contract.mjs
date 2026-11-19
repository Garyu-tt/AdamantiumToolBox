import {createHash} from 'node:crypto';
export const hash=data=>createHash('sha256').update(data).digest('hex');
export function checkEvidence(report){
 if(report?.schema!=='gauntlet-ci-evidence-1'||!report.commit_sha||
  !report.run_id||!Array.isArray(report.tests)||!report.tests.length)
  throw Error('invalid_evidence');
 const names=new Set();
 for(const t of report.tests){
  if(typeof t?.name!=='string'||names.has(t.name)||typeof t.log!=='string'||
   t.log.length>131072||hash(t.log)!==t.log_sha256||
   !Number.isInteger(t.duration_ms)||t.duration_ms<0||
   !['PASS','FAIL'].includes(t.status))throw Error('evidence_hash_or_record');
  names.add(t.name);
  if((t.exit_code===0&&t.signal===null)!==(t.status==='PASS'))
   throw Error('fabricated_test_status');
 }
 return {all_pass:report.tests.every(t=>t.status==='PASS'),
  tests:report.tests.length,sha256:hash(JSON.stringify(report))};
}
