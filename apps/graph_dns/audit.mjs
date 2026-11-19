import {inspect,name} from './model.mjs';
export function audit(input){
 const {issues,nodes,edges,rows,byName,zones}=inspect(input);
 for(const [fqdn,records] of byName){
  if(records.some(r=>r.type==='CNAME')&&records.some(r=>r.type!=='CNAME'))
   issues.push({code:'cname_conflict',name:fqdn});
 }
 for(const r of rows.filter(x=>x.type==='MX')){
  const target=name(r.value),zone=[...zones].find(z=>target===z||target.endsWith('.'+z));
  if(!zone)continue;
  if(!(byName.get(target)||[]).some(x=>x.type==='A'||x.type==='AAAA'))
   issues.push({code:'mx_target_without_address',name:r.fqdn,target});
  edges.push({from:'rr:'+r.sourceIndex,to:'hostname:'+target,type:'mail_routes_to'});
 }
 for(const bind of input.bindings||[]){
  const target=name(bind.hostname),observed=(byName.get(target)||[])
   .filter(x=>x.type==='A'||x.type==='AAAA').map(x=>x.value);
  nodes.push({id:'hostname:'+target,type:'service',label:target});
  if(!observed.includes(bind.ip))issues.push({code:'binding_ip_mismatch',hostname:target,
   expected:bind.ip,actual:observed});
 }
 return {schema:'graph-dns-audit-1',issues,nodes,edges,
  summary:{zones:zones.size,records:rows.length,issues:issues.length},safeToPublish:false};
}
export function plan(input){
 const current=audit(input);
 const proposed=audit({...input,records:input.proposedRecords||input.records});
 return {schema:'graph-dns-plan-1',current,proposed,
  changed:JSON.stringify(input.records)!==JSON.stringify(input.proposedRecords||input.records),
  applied:false,reason:'explicit_provider_adapter_and_approval_required'};
}
