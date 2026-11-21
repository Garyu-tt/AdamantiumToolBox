import {createHash} from 'node:crypto';
export const PROPOSALS_SCHEMA='genesis.policy.proposals.v1';
const id=/^[a-z][a-z0-9_.-]{0,95}$/;
const bounded=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e9;
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function propose({model,goal,actions}={}){
 if(!plain(model)||model.schema!=='genesis.worldmodel.state.v1'||
    !Number.isSafeInteger(model.revision)||model.revision<0||
    !(model.lastEventId===null||typeof model.lastEventId==='string'&&/^[a-f0-9]{64}$/.test(model.lastEventId))||
    !Array.isArray(model.entities)||model.entities.length>64||
    !plain(goal)||typeof goal.entityId!=='string'||goal.entityId.length>256||!goal.entityId||!id.test(goal.feature)||!bounded(goal.target)||
    !Array.isArray(actions)||actions.length>32||Buffer.byteLength(JSON.stringify(model))>65536)
  throw Error('invalid_policy_input');
 if(model.entities.some(e=>!plain(e)||typeof e.id!=='string'||!plain(e.features)))
  throw Error('invalid_world_entities');
 const found=model.entities.filter(e=>e.id===goal.entityId);
 if(found.length>1)throw Error('ambiguous_entity');
 const actual=found.length?found[0].features[goal.feature]:undefined;
 if(actual!==undefined&&!bounded(actual))throw Error('invalid_feature');
 const seen=new Set();
 const candidates=[];
 for(const a of actions){
  if(!plain(a)||!id.test(a.id)||seen.has(a.id)||a.scope!=='virtual'||
     a.entityId!==goal.entityId||a.feature!==goal.feature||
     !bounded(a.delta)||!bounded(a.cost)||a.cost<0||a.cost>100||
     !['simulate'].includes(a.mode))throw Error('invalid_virtual_action');
  seen.add(a.id);
  if(actual===undefined)continue;
  const projected=actual+a.delta;
  if(!bounded(projected))continue;
  const improvement=Math.abs(actual-goal.target)-Math.abs(projected-goal.target);
  const utility=improvement-a.cost;
  if(!Number.isFinite(utility))continue;
  candidates.push({id:a.id,utility,projected,delta:a.delta,cost:a.cost,scope:'virtual'});
 }
 candidates.sort((a,b)=>b.utility-a.utility||a.id.localeCompare(b.id));
 const basis=hash({model,goal});
 return {schema:PROPOSALS_SCHEMA,mode:'simulation',basis,sourceRevision:model.revision,
  sourceEventId:model.lastEventId,goal:{entityId:goal.entityId,feature:goal.feature,target:goal.target},candidates,
  reason:actual===undefined?'unknown_feature':candidates.length?'candidates':'no_allowed_actions',
  executable:false};
}
