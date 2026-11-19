import {createHash} from 'node:crypto';
import {compilePreview} from './compile.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ident=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(x);
const port=x=>Number.isInteger(x)&&x>0&&x<=65535;
const stages=[
 ['identity','Verify pinned Mesh identity','fresh Ed25519 attestation and approval registry'],
 ['inventory','Check interface and route ownership','authenticated per-node local inventory'],
 ['wg_nat','Resolve VPN, NAT and policy routes','independent WireGuard and routing evidence'],
 ['kernel','Validate current nftables revision','read-only kernel ruleset digest and syntax check'],
 ['management','Probe out-of-band management','independent connectivity probe, not same session'],
 ['rollback','Arm rollback watchdog','verified autonomous timer outside changed network'],
 ['approval','Require operator approval','signed approval for exact change digest'],
 ['commit','Apply and verify atomically','distinct privileged provider with readback']
];
const mgmtCheck=(flow,preview)=>{
 if(!flow||!ident(flow.from)||!ident(flow.to)||!['tcp','udp'].includes(flow.protocol)||
    !port(flow.port))throw Error('invalid_management_flow');
 return preview.candidate.some(x=>x.sourceNode===flow.from&&x.service===flow.to&&
  x.protocol===flow.protocol&&x.destinationPort===flow.port);
};
export function transactionPlan(input){
 const preview=compilePreview(input);
 const flows=input.managementFlows??[];
 if(!Array.isArray(flows)||flows.length>100)throw Error('invalid_management_flows');
 const warnings=[...preview.warnings];
 if(!flows.length)warnings.push({code:'management_probes_missing',
  cause:'no explicit expected administrative connections',
  remediation:'register protected management flows'});
 for(const flow of flows)if(!mgmtCheck(flow,preview))
  warnings.push({code:'management_flow_not_in_candidate',flow,
   cause:'candidate rules do not preserve declared access',
   remediation:'resolve graph policy before considering a cutover'});
 const inv=input.inventory;
 if(inv!==undefined){
  if(!inv||inv.schema!=='network-inventory-snapshot-1')throw Error('invalid_inventory');
  const found=new Set((inv.interfaces||[]).flatMap(x=>(x.addresses||[]).map(a=>a.address)));
  for(const rule of preview.candidate)if(!found.has(rule.destinationAddress))
   warnings.push({code:'destination_not_seen_locally',service:rule.service,address:rule.destinationAddress,
    cause:'candidate destination absent from provided local observation',
    remediation:'check service binding and local interfaces'});
  warnings.push({code:'inventory_unattested',
   cause:'caller supplied evidence is not authenticated',
   remediation:'obtain signed local attestation from trusted backend'});
 }
 const wg=input.wireguard;
 if(wg!==undefined){
  if(!wg||wg.schema!=='wireguard-graph-snapshot-1')throw Error('invalid_wireguard');
  if(wg.status!=='observed'||wg.issues?.length)
   warnings.push({code:'wireguard_incomplete',
    cause:'WireGuard snapshot unavailable or has diagnostics',
    remediation:'reconcile peers and AllowedIPs on approved host'});
  warnings.push({code:'wireguard_unattested',
   cause:'peer snapshot does not verify approved Mesh identity',
   remediation:'validate pinned identity and remote challenge'});
 }
 const revision=digest({targetNode:preview.targetNode,revision:preview.revision,
  candidates:preview.candidate,flows});
 const nodes=stages.map(([id,label,remediation],i)=>({id:'gate:'+id,type:'gate',label,
  status:'blocked',cause:i===0?'no signed privileged-node attestation':
   'independent enforcement evidence not yet available',remediation,
  downstream:stages.slice(i+1).map(x=>'gate:'+x[0])}));
 const edges=stages.slice(1).map((stage,i)=>({
  from:'gate:'+stages[i][0],to:'gate:'+stage[0],type:'precondition'}));
 return {schema:'nftables-transaction-plan-1',revision,preview,warnings,
  graph:{nodes,edges},state:'draft',readyToCommit:false,applied:false,
  rollbackArmed:false,approvalVerified:false,identityVerified:false,
  enforcementProvider:'unavailable',requiresIndependentVerification:true};
}
