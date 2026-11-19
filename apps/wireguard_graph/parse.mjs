import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {prefixesOverlap} from './prefix.mjs';
const name=x=>typeof x==='string'&&/^[a-zA-Z0-9_.-]{1,32}$/.test(x);
const fingerprint=key=>{
 if(typeof key!=='string'||! /^[A-Za-z0-9+/]{43}=$/.test(key))return null;
 const bytes=Buffer.from(key,'base64');
 if(bytes.length!==32||bytes.toString('base64')!==key)return null;
 return createHash('sha256').update(bytes).digest('hex').slice(0,32);
};
const readLines=(data)=>{
 if(typeof data!=='string'||Buffer.byteLength(data)>262144)throw Error('invalid_wg_evidence');
 const lines=data.trim()?data.trim().split(/\r?\n/):[];
 if(lines.length>2048)throw Error('wg_evidence_limit');
 return lines;
};
const prefixValid=x=>{
 if(typeof x!=='string'||x.length>64)return false;
 const parts=x.split('/');
 if(parts.length!==2||! /^\d{1,3}$/.test(parts[1]))return false;
 const family=isIP(parts[0]),mask=Number(parts[1]);
 return family!==0&&mask<=(family===4?32:128);
};
export function parseWireguardEvidence(input){
 if(!input||typeof input!=='object')throw Error('invalid_wg_input');
 const now=Number.isSafeInteger(input.nowSeconds)?input.nowSeconds:Math.floor(Date.now()/1000);
 if(now<0||now>253402300799)throw Error('invalid_time');
 const peers=new Map(),issues=[],interfaces=new Set();
 const observe=(iface,key,row,kind)=>{
  const fp=fingerprint(key);
  if(!name(iface)||!fp){issues.push({code:'malformed_'+kind,row});return null;}
  interfaces.add(iface);const id=iface+'|'+fp;
  if(!peers.has(id))peers.set(id,{id:'peer:'+fp+'@'+iface,interface:iface,
   fingerprint:fp,allowedIps:[],lastHandshake:null,identityVerified:false});
  return peers.get(id);
 };
 for(const [i,line] of readLines(input.allowedIps).entries()){
  const fields=line.trim().split(/\s+/);
  if(fields.length<3){issues.push({code:'malformed_allowed_ips',row:i+1});continue;}
  const p=observe(fields[0],fields[1],i+1,'allowed_ips');if(!p)continue;
  const all=fields.slice(2).join('').split(',');
  for(const cidr of all)if(cidr!=='(none)'&&cidr!==''){
   if(!prefixValid(cidr)){issues.push({code:'invalid_allowed_prefix',peer:p.id});continue;}
   if(!p.allowedIps.includes(cidr))p.allowedIps.push(cidr);
  }
 }
 for(const [i,line] of readLines(input.latestHandshakes).entries()){
  const fields=line.trim().split(/\s+/);
  if(fields.length!==3||! /^\d{1,16}$/.test(fields[2])){
   issues.push({code:'malformed_handshake',row:i+1});continue;
  }
  const p=observe(fields[0],fields[1],i+1,'handshake');if(!p)continue;
  const epoch=Number(fields[2]);
  if(!Number.isSafeInteger(epoch)||epoch>now+300){
   issues.push({code:'invalid_handshake_time',peer:p.id});continue;
  }
  p.lastHandshake=epoch===0?null:epoch;
 }
 const values=[...peers.values()].sort((a,b)=>a.id.localeCompare(b.id));
 if(values.length>256)throw Error('wg_peer_limit');
 const owner=new Map(),advertised=[];
 for(const p of values){
  p.allowedIps.sort();
  if(!p.allowedIps.length)issues.push({code:'no_allowed_ips',peer:p.id});
  if(p.lastHandshake===null)issues.push({code:'no_observed_handshake',peer:p.id});
  if(p.lastHandshake!==null&&now-p.lastHandshake>3600)
   issues.push({code:'stale_handshake',peer:p.id,ageSeconds:now-p.lastHandshake});
  for(const range of p.allowedIps){
   if(advertised.length>=512)throw Error('wg_prefix_limit');
   for(const x of advertised)if(x.peer!==p.id){
    const overlap=prefixesOverlap(x.prefix,range);
    if(overlap===true&&x.prefix!==range)
     issues.push({code:'overlapping_allowed_prefix',peers:[x.peer,p.id],prefixes:[x.prefix,range]});
    if(overlap===null)issues.push({code:'prefix_overlap_unverified',peer:p.id,prefix:range});
   }
   advertised.push({peer:p.id,prefix:range});
   const old=owner.get(range);
   if(old&&old!==p.id)issues.push({code:'duplicate_allowed_prefix',prefix:range,peers:[old,p.id]});
   else owner.set(range,p.id);
   if(range==='0.0.0.0/0'||range==='::/0')
    issues.push({code:'wide_allowed_prefix',peer:p.id,prefix:range});
  }
 }
 const nodes=[...interfaces].sort().map(x=>({id:'wg:'+x,type:'interface',label:x}));
 const edges=[];
 for(const p of values){
  nodes.push({id:p.id,type:'unverified_peer',label:p.fingerprint,attested:false});
  edges.push({from:'wg:'+p.interface,to:p.id,type:'observes'});
  for(const cidr of p.allowedIps){
   const id='prefix:'+cidr;
   if(!nodes.some(n=>n.id===id))nodes.push({id,type:'allowed_prefix',label:cidr});
   edges.push({from:p.id,to:id,type:'advertises'});
  }
 }
 return {schema:'wireguard-graph-snapshot-1',source:'wg_public_fields_only',peers:values,
  graph:{nodes,edges},issues,observedAt:new Date(now*1000).toISOString(),
  peerIdentityVerified:false,meshAuthorizationVerified:false,
  routingVerified:false,canApply:false,readOnly:true};
}
