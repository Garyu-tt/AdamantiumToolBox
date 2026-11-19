import {createHash} from 'node:crypto';
export const SCHEMA='genesis.selfstate.snapshot.v1';
const name=/^[a-z][a-z0-9_.-]{0,95}$/;
const contract=/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+\.v[1-9][0-9]*$/;
const sha=/^[a-f0-9]{64}$/;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 [Object.prototype,null].includes(Object.getPrototypeOf(v));
const digest=s=>createHash('sha256').update(s).digest('hex');
function canonical(v,depth=0){
 if(depth>12)throw Error('state_depth_exceeded');
 if(v===null||typeof v==='boolean')return v;
 if(typeof v==='string'&&v.length<=2048)return v;
 if(typeof v==='number'&&Number.isFinite(v))return v;
 if(Array.isArray(v)){
  if(v.length>64)throw Error('array_limit');
  return v.map(x=>canonical(x,depth+1));
 }
 if(!plain(v))throw Error('invalid_state_value');
 const keys=Object.keys(v).sort();
 if(keys.length>64)throw Error('key_limit');
 const copy=Object.create(null);
 for(const k of keys){
  if(!k||k.length>96||['__proto__','prototype','constructor'].includes(k))throw Error('unsafe_state_key');
  copy[k]=canonical(v[k],depth+1);
 }
 return copy;
}
function normalizedComponents(components){
 if(!Array.isArray(components)||components.length<1||components.length>24)throw Error('invalid_components');
 const slots=new Set(),out=[];
 for(const c of components){
  if(!plain(c)||typeof c.slot!=='string'||!name.test(c.slot)||
     typeof c.contract!=='string'||!contract.test(c.contract)||!plain(c.state)||slots.has(c.slot))
    throw Error('invalid_component');
  slots.add(c.slot);
  const state=canonical(c.state),raw=JSON.stringify(state);
  if(Buffer.byteLength(raw)>65536)throw Error('component_too_large');
  out.push({slot:c.slot,contract:c.contract,state,sha256:digest(raw)});
 }
 return out.sort((a,b)=>a.slot<b.slot?-1:a.slot>b.slot?1:0);
}
const withoutDigest=s=>({schema:s.schema,instanceId:s.instanceId,revision:s.revision,
 lastEventId:s.lastEventId,parentDigest:s.parentDigest,components:s.components,origin:'candidate'});
export function verifySnapshot(snapshot){
 if(!plain(snapshot)||Object.keys(snapshot).sort().join(',')!==
    'components,digest,instanceId,lastEventId,origin,parentDigest,revision,schema'||
    snapshot.schema!==SCHEMA||typeof snapshot.instanceId!=='string'||
    !name.test(snapshot.instanceId)||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||
    !(snapshot.lastEventId===null||typeof snapshot.lastEventId==='string'&&sha.test(snapshot.lastEventId))||
    !(snapshot.parentDigest===null||typeof snapshot.parentDigest==='string'&&sha.test(snapshot.parentDigest))||
    (snapshot.revision===0)!==(snapshot.parentDigest===null)||snapshot.origin!=='candidate'||
    typeof snapshot.digest!=='string'||!sha.test(snapshot.digest))throw Error('invalid_snapshot');
 const components=normalizedComponents(snapshot.components);
 const expected={...withoutDigest(snapshot),components};
 if(JSON.stringify(components)!==JSON.stringify(snapshot.components)||
    digest(JSON.stringify(expected))!==snapshot.digest)throw Error('snapshot_integrity_failed');
 if(Buffer.byteLength(JSON.stringify(snapshot))>131072)throw Error('snapshot_too_large');
 return structuredClone(snapshot);
}
export function createSnapshot({instanceId,components,lastEventId=null,previous=null}={}){
 if(typeof instanceId!=='string'||!name.test(instanceId)||
    !(lastEventId===null||typeof lastEventId==='string'&&sha.test(lastEventId)))throw Error('invalid_snapshot_input');
 const prior=previous===null?null:verifySnapshot(previous);
 if(prior&&prior.instanceId!==instanceId)throw Error('instance_mismatch');
 if(prior&&(!lastEventId||lastEventId===prior.lastEventId))throw Error('event_cursor_regression');
 if(prior&&prior.revision===Number.MAX_SAFE_INTEGER)throw Error('revision_overflow');
 const candidate={schema:SCHEMA,instanceId,revision:prior?prior.revision+1:0,
  lastEventId,parentDigest:prior?.digest??null,components:normalizedComponents(components),origin:'candidate'};
 const raw=JSON.stringify(candidate);
 if(Buffer.byteLength(raw)>130000)throw Error('snapshot_too_large');
 return verifySnapshot({...candidate,digest:digest(raw)});
}
