import {isIP} from 'node:net';
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const port=x=>Number.isInteger(x)&&x>0&&x<=65535;
const ip=x=>typeof x==='string'&&isIP(x)!==0&&x!=='0.0.0.0'&&x!=='::';
export function parseTopology(input){
 if(!obj(input)||!Array.isArray(input.nodes)||input.nodes.length>250||
    !Array.isArray(input.services)||input.services.length>1000||
    !Array.isArray(input.rules)||input.rules.length>2000)throw Error('invalid_topology');
 const nodes=new Map(),services=new Map(),rules=new Map(),issues=[];
 for(const n of input.nodes){
  if(!obj(n)||!id(n.id)||nodes.has(n.id)||!['client','server','gateway'].includes(n.kind)||
     (n.addresses!==undefined&&(!Array.isArray(n.addresses)||n.addresses.length>32||!n.addresses.every(ip))))
   throw Error('invalid_node');
  nodes.set(n.id,{id:n.id,kind:n.kind,addresses:n.addresses||[]});
 }
 for(const s of input.services){
  if(!obj(s)||!id(s.id)||services.has(s.id)||!id(s.node)||!nodes.has(s.node)||
     !['tcp','udp'].includes(s.protocol)||!port(s.port)||
     (s.addresses!==undefined&&(!Array.isArray(s.addresses)||s.addresses.length>32||!s.addresses.every(ip))))
   throw Error('invalid_service');
  services.set(s.id,{id:s.id,node:s.node,protocol:s.protocol,port:s.port,addresses:s.addresses||[]});
 }
 for(const r of input.rules){
  if(!obj(r)||!id(r.id)||rules.has(r.id)||!nodes.has(r.from)||!services.has(r.to)||
    !['allow','deny'].includes(r.effect)||typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>500||
    (r.enabled!==undefined&&typeof r.enabled!=='boolean'))throw Error('invalid_rule');
  rules.set(r.id,{id:r.id,from:r.from,to:r.to,effect:r.effect,reason:r.reason,enabled:r.enabled!==false});
 }
 for(const [serviceId,s] of services){
  if(!s.addresses.length)issues.push({code:'unresolved_service_address',service:serviceId});
  const owner=nodes.get(s.node);
  for(const addr of s.addresses)if(!owner.addresses.includes(addr))
   issues.push({code:'service_address_not_on_host',service:serviceId,address:addr,node:s.node});
 }
 for(const [nodeId,n] of nodes){
  if(!n.addresses.length)issues.push({code:'unresolved_node_address',node:nodeId});
 }
 const addressOwners=new Map();
 for(const n of nodes.values())for(const address of n.addresses){
  const owners=addressOwners.get(address)||new Set();owners.add(n.id);addressOwners.set(address,owners);
 }
 for(const [address,owners] of addressOwners)if(owners.size>1)
  issues.push({code:'ambiguous_address_owner',address,owners:[...owners]});
 const pairs=new Map();
 for(const r of rules.values())if(r.enabled){
  const key=r.from+'|'+r.to,entry=pairs.get(key)||new Set();entry.add(r.effect);pairs.set(key,entry);
 }
 for(const [key,effects] of pairs)if(effects.size>1){
  const [from,to]=key.split('|');issues.push({code:'conflicting_effects',from,to});
 }
 return {nodes,services,rules,issues};
}
export function requireFlow(flow,model){
 if(!obj(flow)||!model.nodes.has(flow.from)||!model.services.has(flow.to)||
   !['tcp','udp'].includes(flow.protocol)||!port(flow.port))throw Error('invalid_flow');
 const service=model.services.get(flow.to);
 return {from:flow.from,to:flow.to,protocol:flow.protocol,port:flow.port,
  serviceProtocol:service.protocol,servicePort:service.port};
}
export function topologyGraph(model){
 const nodes=[...model.nodes.values()].map(n=>({id:'node:'+n.id,type:'node',label:n.id,kind:n.kind}));
 const edges=[];
 for(const s of model.services.values()){
  nodes.push({id:'service:'+s.id,type:'service',label:s.id,protocol:s.protocol,port:s.port});
  edges.push({from:'node:'+s.node,to:'service:'+s.id,type:'hosts'});
 }
 for(const r of model.rules.values()){
  nodes.push({id:'rule:'+r.id,type:'policy',label:r.id,effect:r.effect,enabled:r.enabled});
  edges.push({from:'node:'+r.from,to:'rule:'+r.id,type:'source'});
  edges.push({from:'rule:'+r.id,to:'service:'+r.to,type:r.effect});
 }
 return {nodes,edges};
}
