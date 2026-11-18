import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {negotiateProviders} from '../apps/forge/negotiation.mjs';
import {prepareIntegration,assessVisibility} from '../apps/forge/integration.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const fn=JSON.parse(await readFile(resolve(root,'apps/forge/example.function.json'),'utf8'));
const now=Date.now();
const input={function:fn,request_id:'forge-r04-req-0001',expected_revision:'graph-81'};
const snapshot={schema:'forge.provider.snapshot.v1',source:'host-discovery',revision:'discovery-91',
 policy_revision:'policy-42',observed_at:new Date(now-2000).toISOString(),
 expires_at:new Date(now+60000).toISOString(),capabilities:[]};
const preview=negotiateProviders({flow:'publication',input,snapshot},now);
const offers=preview.selections.map((s,i)=>({contract:s.contract,contract_version:'1.0.0',
 provider_ref:`provider${i}`,node_ref:`host${i}`,action_id:`provider${i}.invoke`,
 status:'reachable',can_invoke:true,identity_pinned:true,policy_allowed:true,
 primary:s.mode==='write',access:[s.mode]}));
const call={schema:'forge.integration.request.v1',flow:'publication',input,
 snapshot:{...snapshot,capabilities:offers}};
const prepared=prepareIntegration(call,now);
assert.equal(prepared.ok,true);
assert.equal(prepared.intents.length,preview.selections.length);
assert.equal(prepared.executed,false);
assert.equal(prepared.authorized,false);
assert.equal(prepared.provider_bound,false);
assert.equal(prepared.can_execute,false);
assert.equal(prepared.intents[0].request_id,input.request_id);
assert.equal(prepared.intents[0].revision_precondition,input.expected_revision);
assert(prepared.intents.every(x=>x.requires_host_identity_check&&x.requires_host_policy_check));
assert(prepared.intents.every((x,i)=>x.order===i&&x.executed===false));
assert.equal(prepareIntegration({...call,input:{...input,expected_revision:undefined}},now).ok,false);
assert.equal(prepareIntegration({...call,snapshot:{...snapshot,capabilities:[]}},now).ok,false);
assert.equal(prepareIntegration({...call,snapshot:{...snapshot,capabilities:offers,
 expires_at:new Date(now-1).toISOString()}},now).ok,false);
assert.equal(prepareIntegration({...call,schema:'unsupported'},now).ok,false);
assert.equal(prepareIntegration({...call,snapshot:{...snapshot,capabilities:offers.map(x=>({...x,
 identity_pinned:false}))}},now).ok,false);
const write=offers.find(x=>x.primary);
assert.equal(prepareIntegration({...call,snapshot:{...snapshot,capabilities:[...offers,
 {...write,provider_ref:'surprise',node_ref:'surprise'}]}},now).ok,false);
const reconInput={function_ref:fn.id,trigger:'provider.revoked',observed_revision:'graph-82'};
const reconBase={schema:'forge.integration.request.v1',flow:'reconciliation',input:reconInput,
 request_id:'forge-r04-recon-0001',snapshot};
const reconPreview=negotiateProviders({flow:'reconciliation',input:reconInput,snapshot},now);
const reconOffers=reconPreview.selections.map((s,i)=>({contract:s.contract,
 contract_version:'1.0.0',provider_ref:`recon${i}`,node_ref:`hostrecon${i}`,
 action_id:`recon${i}.invoke`,status:'reachable',can_invoke:true,
 identity_pinned:true,policy_allowed:true,primary:s.mode==='write',access:[s.mode]}));
const recon=prepareIntegration({...reconBase,snapshot:{...snapshot,capabilities:reconOffers}},now);
assert.equal(recon.ok,true);
assert.equal(recon.intents[0].revision_precondition,'graph-82');
assert.equal(prepareIntegration({...reconBase,request_id:undefined,
 snapshot:{...snapshot,capabilities:reconOffers}},now).ok,false);
import {runVisibilityR04} from './forge-r04-visibility.case.mjs';
await runVisibilityR04({fn,input,call,now});
