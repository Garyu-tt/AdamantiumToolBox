/** Typed, reversible Encode/Decode DAG projection, no execution rights. */
import {validateOperationPlan,resolveOperation,REGISTRY_SHA256} from './operation_registry.mjs';
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
