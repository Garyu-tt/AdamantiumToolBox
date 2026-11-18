import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(x);
const port=x=>Number.isInteger(x)&&x>0&&x<=65535;
const address=x=>typeof x==='string'&&isIP(x)!==0&&x!=='0.0.0.0'&&x!=='::';
const list=x=>Array.isArray(x)&&x.length<=32&&x.every(address);
const types=['client','server','gateway'],protocols=['tcp','udp'];
const fingerprint=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function compilePreview(input){
 if(!obj(input)||!id(input.targetNode)||!obj(input.topology))throw Error('invalid_input');
 const {nodes,services,rules}=input.topology;
 if(!Array.isArray(nodes)||nodes.length>250||!Array.isArray(services)||services.length>1000||
    !Array.isArray(rules)||rules.length>2000)throw Error('invalid_topology');
 const nm=new Map(),sm=new Map(),rm=new Map();
 for(const n of nodes){
  if(!obj(n)||!id(n.id)||nm.has(n.id)||!types.includes(n.kind)||!list(n.addresses||[]))
   throw Error('invalid_node');
  nm.set(n.id,n);
 }
 for(const s of services){
  if(!obj(s)||!id(s.id)||sm.has(s.id)||!nm.has(s.node)||
   !protocols.includes(s.protocol)||!port(s.port)||!list(s.addresses||[]))
   throw Error('invalid_service');
  sm.set(s.id,s);
 }
 for(const r of rules){
  if(!obj(r)||!id(r.id)||rm.has(r.id)||!nm.has(r.from)||!sm.has(r.to)||
   !['allow','deny'].includes(r.effect)||typeof r.reason!=='string'||!r.reason.trim()||
   r.reason.length>500||(r.enabled!==undefined&&typeof r.enabled!=='boolean'))
   throw Error('invalid_rule');
  rm.set(r.id,r);
 }
 if(!nm.has(input.targetNode))throw Error('target_not_in_topology');
 const accepted=new Map(),warnings=[];
 for(const r of rm.values()){
  if(r.enabled===false||sm.get(r.to).node!==input.targetNode)continue;
  const key=r.from+'|'+r.to,entry=accepted.get(key)||{allow:[],deny:[]};
  entry[r.effect].push(r.id);accepted.set(key,entry);
 }
 const candidate=[],skipped=[];
 for(const [pair,entry] of accepted){
  const [src,target]=pair.split('|'),s=sm.get(target),n=nm.get(src);
  if(entry.deny.length){skipped.push({src,target,reason:'explicit_deny',rules:entry.deny});continue;}
  if(!n.addresses.length||!s.addresses.length){
   warnings.push({code:'missing_address_binding',source:src,service:target});continue;
  }
  for(const sourceAddress of n.addresses)for(const destinationAddress of s.addresses){
   const family=isIP(sourceAddress),destinationFamily=isIP(destinationAddress);
   if(family!==destinationFamily)continue;
   if(candidate.length>=1024)throw Error('rule_expansion_limit');
   candidate.push({sourceNode:src,service:target,addressFamily:family===4?'ip':'ip6',
    sourceAddress,destinationAddress,protocol:s.protocol,destinationPort:s.port,
    verdict:'accept',originRules:entry.allow});
  }
  if(!candidate.some(x=>x.sourceNode===src&&x.service===target))
   warnings.push({code:'address_family_mismatch',source:src,service:target});
 }
 candidate.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return {schema:'nftables-intent-preview-1',targetNode:input.targetNode,
  revision:fingerprint({targetNode:input.targetNode,topology:input.topology}),
  candidate,skipped,warnings,defaultIntent:'deny',
  proposedBackend:{family:'inet',chainType:'regular_unhooked',attachedToKernel:false},
  unverified:['node_identity','address_ownership','interface_routes','nat','management_reachability',
   'kernel_syntax','base_ruleset_revision','rollback'],safeToApply:false,applied:false};
}
