import os from 'node:os';
import {readFile} from 'node:fs/promises';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {parseIpv4Routes,parseIpv6Routes} from './routes.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const issue=(code,detail)=>({code,detail,impact:'network_evidence_incomplete',
 remediation:'inspect local routing and interfaces with an authorized operator'});
export async function captureNetworkSnapshot(options={}){
 const platform=options.platform||process.platform;
 const addresses=options.interfaces||os.networkInterfaces();
 const read=options.readText||((p)=>readFile(p,'utf8'));
 const interfaces=[],issues=[],routes=[],sources={};
 for(const [name,raw] of Object.entries(addresses)){
  if(!Array.isArray(raw)){issues.push(issue('invalid_interface_data',name));continue;}
  const found=[];
  for(const record of raw){
   if(!record||!['IPv4','IPv6'].includes(record.family)||isIP(record.address)===0){
    issues.push(issue('unusable_interface_address',name));continue;
   }
   found.push({address:record.address,family:record.family,
    prefix:typeof record.cidr==='string'?record.cidr:null,internal:record.internal===true});
  }
  found.sort((a,b)=>a.address.localeCompare(b.address));
  interfaces.push({name,addresses:found});
 }
 interfaces.sort((a,b)=>a.name.localeCompare(b.name));
 if(platform==='linux'){
  for(const [kind,path,parser] of [['v4','/proc/net/route',parseIpv4Routes],
   ['v6','/proc/net/ipv6_route',parseIpv6Routes]]){
   try{const parsed=parser(await read(path));routes.push(...parsed.routes);
    issues.push(...parsed.issues);sources[kind]='procfs_partial';
   }catch{sources[kind]='unavailable';issues.push(issue('route_source_unavailable',kind));}
  }
 }else{sources.v4='unsupported_platform';sources.v6='unsupported_platform';
  issues.push(issue('routing_not_supported',platform));}
 routes.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const observedAt=(options.now||(()=>new Date().toISOString()))();
 const graphNodes=[{id:'local:unverified',type:'observed_host',label:'Local process host',attested:false}];
 const graphEdges=[];
 for(const n of interfaces){
  const nid='iface:'+n.name;graphNodes.push({id:nid,type:'interface',label:n.name});
  graphEdges.push({from:'local:unverified',to:nid,type:'observes'});
  for(const a of n.addresses){
   const aid='address:'+a.address;
   if(!graphNodes.some(x=>x.id===aid))graphNodes.push({id:aid,type:'address',label:a.address});
   graphEdges.push({from:nid,to:aid,type:'has_address'});
  }
 }
 for(const [i,r] of routes.entries()){
  const rid='route:'+i;graphNodes.push({id:rid,type:'route',label:r.destination});
  graphEdges.push({from:'iface:'+r.interface,to:rid,type:'advertises_route'});
  if(!interfaces.some(x=>x.name===r.interface))
   issues.push(issue('route_without_interface',r.interface));
 }
 const evidence={interfaces,routes,sources};
 return {schema:'network-inventory-snapshot-1',observedAt,revision:digest(evidence),
  scope:'local_process_network_namespace',identityVerified:false,
  interfaceEvidence:'os.networkInterfaces',routeEvidence:sources,interfaces,routes,
  graph:{nodes:graphNodes,edges:graphEdges},issues,readOnly:true,canApply:false};
}
