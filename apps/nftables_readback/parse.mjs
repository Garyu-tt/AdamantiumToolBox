import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const family=new Set(['ip','ip6','inet','arp','bridge','netdev']);
const ident=x=>typeof x==='string'&&x.length>0&&x.length<=128;
export function parseRuleset(raw,observedAt){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>1048576)throw Error('ruleset_size_limit');
 let data;try{data=JSON.parse(raw);}catch{throw Error('invalid_nft_json');}
 if(!data||!Array.isArray(data.nftables)||data.nftables.length>10000)
  throw Error('invalid_nft_schema');
 const tables=[],chains=[],issues=[];
 let rules=0,sets=0,objects=0;
 for(const node of data.nftables){
  if(!node||typeof node!=='object')throw Error('invalid_nft_entry');
  if(node.metainfo)continue;
  if(node.table){
   const x=node.table;
   if(!family.has(x.family)||!ident(x.name))throw Error('invalid_table');
   tables.push({family:x.family,name:x.name});
  }else if(node.chain){
   const x=node.chain;
   if(!family.has(x.family)||!ident(x.table)||!ident(x.name))
    throw Error('invalid_chain');
   chains.push({family:x.family,table:x.table,name:x.name,
    baseChain:typeof x.hook==='string',hook:x.hook||null});
  }else if(node.rule){rules++;}
  else if(node.set||node.map){sets++;}
  else{objects++;issues.push({code:'unclassified_nft_object'});}
 }
 tables.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 chains.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return {schema:'nftables-readback-1',status:'observed',
  observedAt,revision:hash(JSON.stringify(data.nftables)),
  summary:{tables:tables.length,chains:chains.length,rules,sets,objects},
  tables,chains,issues,
  namespaceAttested:false,managementReachabilityVerified:false,
  snapshotSigned:false,kernelTransactionApplied:false,readyToApply:false};
}
