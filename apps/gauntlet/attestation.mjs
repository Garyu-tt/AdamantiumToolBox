import {verify} from 'node:crypto';
import {hash,validHash} from './shared.mjs';
const checks=['syntax','build','dependencies','isolation','unit','integration',
 'contract','security','regression','no_hardcode','conflicts'];
function validResult(test){
 if(!test||typeof test.log!=='string'||!test.log.length||test.log.length>65536||
  !validHash(test.log_sha256)||hash(test.log)!==test.log_sha256||
  typeof test.command!=='string'||!test.command.length||test.command.length>300||
  !Number.isInteger(test.duration_ms)||test.duration_ms<0||test.duration_ms>3600000||
  !(test.exit_code===null||(Number.isInteger(test.exit_code)&&test.exit_code>=0))||
  !(test.signal===null||(typeof test.signal==='string'&&/^SIG[A-Z]+$/.test(test.signal)))||
  !['PASS','FAIL'].includes(test.status))return false;
 return (test.exit_code===0&&test.signal===null)===(test.status==='PASS');
}
export function attest(payload,c,publicKey){
 const {report,signature}=payload||{};
 if(!report||typeof signature!=='string'||!publicKey)throw Error('missing_trusted_attestation');
 const raw=Buffer.from(JSON.stringify(report));
 if(!verify(null,raw,publicKey,Buffer.from(signature,'base64')))throw Error('bad_attestation_signature');
 if(report.schema!=='gauntlet-test-report-1'||report.task_id!==c.task_id||
 report.sha256!==c.sha256||report.challenge!==c.challenge||
 !report.run_id||!report.runner_id||
 report.runner_id===c.author_id)throw Error('attestation_mismatch');
 const cost=report.cost_usd;
 if(typeof cost!=='number'||!Number.isFinite(cost)||cost<0)throw Error('invalid_cost');
 if(!Array.isArray(report.tests))throw Error('missing_test_logs');
 const seen=new Set(),failed=[];
 for(const test of report.tests){
  if(!validResult(test)||typeof test.name!=='string'||seen.has(test.name))
   throw Error('invalid_test_evidence');
  seen.add(test.name);if(test.status==='FAIL')failed.push('test_failed:'+test.name);
 }
 for(const name of checks)if(!seen.has(name))failed.push('missing_test:'+name);
 if(report.dynamic_ui_supported===true){
  for(const name of ['dynamic_register','dynamic_remove','dynamic_update','ui_live'])
   if(!seen.has(name))failed.push('missing_test:'+name);
 }else if(report.dynamic_ui_supported!==false||!report.dynamic_skip_reason){
  failed.push('dynamic_ui_scope_undefined');
 }
 if(report.changed_contracts?.length){
  if(!validHash(report.dependency_graph_sha256)||report.graph_complete!==true||
   !Array.isArray(report.dependent_plugins)||!Array.isArray(report.dependent_results))
   failed.push('dependency_impact_unverified');
  else for(const id of report.dependent_plugins)
   if(!report.dependent_results.some(x=>x.plugin_id===id&&
    validResult(x)&&x.status==='PASS'))failed.push('dependent_unverified:'+id);
 }
 return {issues:failed,cost};
}
