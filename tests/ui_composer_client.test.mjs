import {strict as assert} from 'node:assert';
import {findUiComposer,validUiPlan} from '../apps/leonardo/compose-client.js';
const nodes=[
 {id:'layout.provider',type:'resource',
  uiComposer:{schema:'mas-ui-composer-provider-1',planAction:'layout.plan',
   modes:['automatic'],priority:15}},
 {id:'layout.plan',type:'action'},
 {id:'untrusted.provider',type:'resource',
  uiComposer:{schema:'mas-ui-composer-provider-1',planAction:'layout.plan',
   modes:['intelligent'],priority:100}}];
assert.equal(findUiComposer({nodes})?.planAction,'layout.plan');
assert.equal(findUiComposer({nodes},'intelligent'),null);
assert.equal(findUiComposer({nodes:[]}),null);
const schema={app:'example',elements:[
 {id:'field',role:'field'},{id:'submit',role:'action'}]};
const plan={schema:'mas-ui-plan-1',app:'example',mode:'automatic',sections:[
 {id:'work',title:'Work',width:'full',items:['field','submit']}]};
assert(validUiPlan(plan,schema));
assert(!validUiPlan({...plan,sections:[{...plan.sections[0],items:['field']}]},schema));
assert(!validUiPlan({...plan,sections:[{...plan.sections[0],items:['field','field']}]},schema));
assert(!validUiPlan({...plan,sections:[{...plan.sections[0],items:['field','submit','extra']}]},schema));
assert(!validUiPlan({...plan,mode:'intelligent'},schema));
assert(!validUiPlan({...plan,sections:[{...plan.sections[0],title:'x'.repeat(200)}]},schema));
console.log('UI_COMPOSER_CLIENT_OK dynamic discovery and complete validated layout');
