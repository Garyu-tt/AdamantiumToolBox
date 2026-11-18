import {strict as assert} from 'node:assert';
import {planCompositeImpact} from '../apps/forge/composite.mjs';
import {runHttpR05} from './forge-r05-http.case.mjs';
export async function runImpactR05({a,b,c,plan,request}){
// A function can appear under several UI groups without creating multiple execution requests.
const changed={schema:'forge.composite.impact.request.v1',observed_revision:'graph-78',
 trigger:'contract.changed',graph_intent:plan.graph_intent,changed_refs:[a.id]};
const impact=planCompositeImpact(changed);
assert.equal(impact.ok,true,JSON.stringify(impact.errors));
assert(impact.revisit_function_refs.includes(a.id));
assert(impact.revisit_function_refs.includes(b.id));
assert(impact.revisit_function_refs.includes(c.id));
assert(impact.composite_refresh_refs.includes('sample.admin'));
assert(impact.composite_refresh_refs.includes('sample.root'));
assert(impact.ui_revoke_intents.includes(`ui:${b.id}`));
assert.equal(impact.ui_revoked,false);assert.equal(impact.authoritative,false);
const capImpact=planCompositeImpact({...changed,trigger:'provider.revoked',changed_refs:['capability:sample.auth']});
assert.equal(capImpact.ok,true);
assert(capImpact.revisit_function_refs.includes(b.id));
assert.equal(planCompositeImpact({...changed,changed_refs:['unknown.missing']}).ok,false);
assert.equal(planCompositeImpact({...changed,observed_revision:''}).ok,false);
assert.equal(planCompositeImpact({...changed,graph_intent:{...plan.graph_intent,
 edges:[...plan.graph_intent.edges,{from:'missing',to:a.id,kind:'contains'}]}}).ok,false);
// HTTP integration and independent start with only the MAS host, no TaskPool/Graph Manager/agents.
 await runHttpR05({request,changed});
}
