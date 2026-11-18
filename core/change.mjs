import {createHash,randomUUID} from 'node:crypto';
import {loadFrontend,saveFrontend} from './frontend.mjs';
import {mutate} from './semantic.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const required=['preserve_api','preserve_permissions','validate_dependents'];
const isString=x=>typeof x==='string'&&x.length>0;
function checkRequest(input){
 if(input?.operation!=='modify'||!isString(input.target)||!isString(input.expected_etag))throw Error('invalid_intent');
 if(!input.change||!isString(input.change.property))throw Error('invalid_change');
 const limits=input.constraints||{};
 if(Object.keys(limits).some(k=>!required.includes(k)))throw Error('unsupported_constraint');
 if(required.some(k=>limits[k]===false))throw Error('unsafe_constraint');
 return {operation:'modify',target:input.target,change:{property:input.change.property,value:input.change.value},
  expected_etag:input.expected_etag,constraints:Object.fromEntries(required.map(k=>[k,true]))};
}
export async function planChange(input,backend){
 const intent=checkRequest(input),front=await loadFrontend();
 if(intent.expected_etag!==front.etag)throw Error('stale_revision');
 const {diff,affected,checks}=mutate(front,backend,intent);
 const base={schema:'mas-change-plan-1',intent,diff,affected,checks};
 return {...base,plan_id:sha(base)};
}
export async function applyChange(plan,backend){
 if(plan?.schema!=='mas-change-plan-1'||!isString(plan.plan_id))throw Error('invalid_plan');
 const expected=await planChange(plan.intent,backend);
 if(plan.plan_id!==expected.plan_id||sha(plan)!==sha(expected))throw Error('plan_tampered');
 const front=await loadFrontend();
 if(front.etag!==expected.intent.expected_etag)throw Error('stale_revision');
 const changed=mutate(front,backend,expected.intent);
 const event={id:randomUUID(),kind:'change',plan_id:expected.plan_id,diff:changed.diff,
  affected:changed.affected,checks:changed.checks,at:new Date().toISOString()};
 const written=await saveFrontend({...changed.doc,etag:front.etag},{audit:event});
 return {schema:'mas-change-result-1',result:'accepted',change_id:event.id,
  revision:written.etag,changed_objects:1,affected_dependencies:changed.affected.length,
  tests_passed:changed.checks.length,contract_breaks:0};
}
export async function rollbackChange(id,expectedEtag,backend){
 if(!isString(id)||!isString(expectedEtag))throw Error('invalid_rollback');
 const front=await loadFrontend();
 if(front.etag!==expectedEtag)throw Error('stale_revision');
 const last=(front.history||[]).at(-1);
 if(!last||last.id!==id||last.kind!=='change')throw Error('not_latest_change');
 const {target,property,before,after}=last.diff;
 const current=front.frontend.nodes.find(n=>'component://'+n.id===target);
 const value=property==='binding'?front.bridge.edges.find(e=>e.from===current?.id)?.to||'':current?.[property];
 if(value!==after)throw Error('rollback_conflict');
 const reverse={operation:'modify',target,change:{property,value:before}};
 const changed=mutate(front,backend,reverse);
 const event={id:randomUUID(),kind:'rollback',reverts:id,diff:changed.diff,
  affected:changed.affected,checks:changed.checks,at:new Date().toISOString()};
 const saved=await saveFrontend({...changed.doc,etag:front.etag},{audit:event});
 return {result:'rolled_back',reverted:id,change_id:event.id,revision:saved.etag};
}
export async function history(limit=30){
 const data=await loadFrontend();
 return {schema:'mas-change-history-1',revision:data.etag,events:(data.history||[]).slice(-Math.min(100,Math.max(1,limit)))};
}
