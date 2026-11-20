/**
 * Mechanicus Math Lab R03 — immutable operation registry ABI.
 *
 * Stable IDs are the on-wire contract, not JS function names, human labels,
 * Node-RED node IDs or MAS privileges. Existing R02 single-byte opcodes 1..5
 * are LEGACY IDs and are mapped explicitly, never silently renumbered.
 */
import {createHash} from 'node:crypto';

export const OP_REGISTRY_ABI='mechanicus.math-operation-registry/1';
export const GRAPH_PLAN_ABI='mechanicus.math-operation-plan/1';
export const REGISTRY_MAJOR=1;
const declaration=Object.freeze([
  // kind=transform: exact, bijective byte[N] -> byte[N], no parameters.
  {id:0x0101,key:'bytes.delta-xor-prev',kind:'transform',inverseId:0x8101,legacyR02:1},
  {id:0x0102,key:'bytes.delta-sub-prev',kind:'transform',inverseId:0x8102,legacyR02:2},
  {id:0x0103,key:'bytes.even-odd',kind:'transform',inverseId:0x8103,legacyR02:3},
  {id:0x0104,key:'bits.transpose-8x8',kind:'transform',inverseId:0x8104,legacyR02:4},
  {id:0x0105,key:'bytes.reverse',kind:'transform',inverseId:0x8105,legacyR02:5},
  // A codec transforms byte[N] into a length-changing frame. Codec ID means
  // the complete well-specified format, NOT an arbitrary algorithm variant.
  {id:0x0201,key:'codec.zlib-wrapper',kind:'codec',inverseId:0x8201,legacyR02:1},
  {id:0x0202,key:'codec.root-mlr1',kind:'codec',inverseId:0x8202,legacyR02:2}
]);
const registry=Object.freeze(declaration.flatMap(item=>[
 Object.freeze({
  id:item.id,key:item.key,kind:item.kind,version:1,direction:'encode',
  input:'bytes',output:item.kind==='codec'?'encoded-frame':'bytes',
  inverseId:item.inverseId,legacyR02:item.legacyR02,
  parameters:'none',reversible:true
 }),
 Object.freeze({
  id:item.inverseId,key:item.key+'.inverse',kind:item.kind,version:1,
  direction:'decode',input:item.kind==='codec'?'encoded-frame':'bytes',
  output:'bytes',inverseId:item.id,legacyR02:null,
  parameters:'none',reversible:true
 })
]));
const lookup=new Map(registry.map(row=>[row.id,row]));
if(lookup.size!==registry.length)throw Error('Operation registry collision');
for(const row of registry){
 const inverse=lookup.get(row.inverseId);
 if(!inverse||inverse.inverseId!==row.id||inverse.direction===row.direction||
  inverse.kind!==row.kind||inverse.input!==row.output||inverse.output!==row.input){
  throw Error('Invalid bidirectional math registry for '+row.id);
 }
}
const digest=createHash('sha256').update(JSON.stringify(registry),'utf8').digest();
export const REGISTRY_SHA256=digest.toString('hex');
export const REGISTRY_FINGERPRINT_HEX=digest.subarray(0,8).toString('hex');
export const LEGACY_R02_TRANSFORMS=Object.freeze(
 Object.fromEntries(declaration.filter(x=>x.kind==='transform')
  .map(x=>[x.legacyR02,x.id]))
);
export const LEGACY_R02_CODECS=Object.freeze(
 Object.fromEntries(declaration.filter(x=>x.kind==='codec')
  .map(x=>[x.legacyR02,x.id]))
);
function reject(why){throw new TypeError('Math operation graph rejected: '+why);}
function safeId(value,name){
 if(!Number.isSafeInteger(value)||value<0||value>0xffff)reject('invalid '+name);
 return value;
}
export function resolveOperation(id,{direction}={}){
 safeId(id,'operation ID');
 const result=lookup.get(id);
 if(!result)reject('unknown or unsupported operation ID '+id);
 if(direction&&result.direction!==direction)reject('operation direction mismatch');
 return result;
}
export function getOperationCatalog(){
 return Object.freeze({
  abi:OP_REGISTRY_ABI,major:REGISTRY_MAJOR,sha256:REGISTRY_SHA256,
  operations:registry,semantics:'exact registry revision; immutable IDs',
  dynamicExecutablePluginsAllowed:false,
  changesRequireNewId:true
 });
}
export function validateOperationPlan(plan){
 if(plan===null||typeof plan!=='object'||Array.isArray(plan))reject('plan must be object');
 for(const key of Object.keys(plan))
  if(!['schema','operationIds','codecId'].includes(key))reject('unknown plan field '+key);
 if(plan.schema!==GRAPH_PLAN_ABI)reject('plan schema mismatch');
 if(!Array.isArray(plan.operationIds)||plan.operationIds.length>3)reject('step depth');
 for(const id of plan.operationIds){
  const op=resolveOperation(id,{direction:'encode'});
  if(op.kind!=='transform')reject('non-transform step');
 }
 const codec=resolveOperation(plan.codecId,{direction:'encode'});
 if(codec.kind!=='codec')reject('missing terminal codec');
 return Object.freeze({
  schema:GRAPH_PLAN_ABI,operationIds:Object.freeze([...plan.operationIds]),codecId:plan.codecId,
  registrySha256:REGISTRY_SHA256,executionAuthorized:false
 });
}
/**
 * Two separate typed linear DAGs. This first implementation supports one input
 * and one output only. Branching/fan-in would require explicit type semantics,
 * inverse witnesses and a new versioned graph schema.
 */
export function buildEncodeDecodeGraphs(plan){
 const valid=validateOperationPlan(plan);
 function graph(direction,order){
  const nodes=[Object.freeze({
   id:'input',operationId:null,type:'input',
   outputType:direction==='encode'?'bytes':'encoded-frame'
  })];
  for(let i=0;i<order.length;i++){
   const op=resolveOperation(order[i],{direction});
   nodes.push(Object.freeze({
    id:'n'+String(i).padStart(2,'0'),
    operationId:op.id,key:op.key,type:op.kind,
    inputType:op.input,outputType:op.output
   }));
  }
  nodes.push(Object.freeze({
   id:'output',operationId:null,type:'output',
   inputType:direction==='encode'?'encoded-frame':'bytes'
  }));
  const edges=[];
  for(let i=1;i<nodes.length;i++){
   const from=nodes[i-1],to=nodes[i];
   const fromType=from.outputType,toType=to.inputType;
   if(fromType!==toType)reject('graph type mismatch');
   edges.push(Object.freeze({from:from.id,to:to.id,dataType:fromType}));
  }
  return Object.freeze({
   schema:'mechanicus.math-codec-dag/1',direction,
   nodes:Object.freeze(nodes),edges:Object.freeze(edges),
   registrySha256:REGISTRY_SHA256,rootOfTrust:false,
   authorityToInvoke:false
  });
 }
 const encoder=graph('encode',[...valid.operationIds,valid.codecId]);
 const decoder=graph('decode',[
  resolveOperation(valid.codecId).inverseId,
  ...[...valid.operationIds].reverse().map(id=>resolveOperation(id).inverseId)
 ]);
 return Object.freeze({
  schema:'mechanicus.math-codec-graph-pair/1',
  registrySha256:REGISTRY_SHA256,
  plan:valid,encode:encoder,decode:decoder,executionAuthorized:false
 });
}
