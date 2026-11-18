import {strict as assert} from 'node:assert';
import {validateSchema,validatePlan} from '../apps/ui_composer/contract.mjs';
import {planLayout} from '../apps/ui_composer/planner.mjs';
const schema={schema:'mas-ui-schema-1',app:'graphics',
 groups:[{id:'form',title:'New task',width:'full',priority:1},
 {id:'jobs',title:'Jobs',width:'card',priority:20}],
 elements:[{id:'input',role:'field',group:'form'},
 {id:'submit',role:'action',group:'form'},
 {id:'history',role:'collection',group:'jobs'},
 {id:'status',role:'status'}]};
assert(validateSchema(schema));
const plan=planLayout(schema);
assert(validatePlan(plan,schema));assert.equal(plan.sections[0].id,'form');
assert.deepEqual(plan.sections.flatMap(s=>s.items).sort(),
 schema.elements.map(e=>e.id).sort());
assert.equal(plan.sections[0].width,'full');
assert.throws(()=>planLayout(schema,'intelligent'),/composer_mode_unavailable/);
assert.equal(validatePlan({...plan,sections:[...plan.sections,
 {id:'extra',title:'Injected',width:'card',items:['submit']}]},schema),false);
assert.equal(validateSchema({...schema,elements:[...schema.elements,schema.elements[0]]}),false);
assert.equal(validateSchema({...schema,elements:[{id:'script',role:'arbitrary'}]}),false);
assert.equal(validateSchema({...schema,elements:[{id:'input',role:'field',group:'unknown'}]}),false);
const inferred=planLayout({schema:'mas-ui-schema-1',app:'simple',
 elements:[{id:'button',role:'action'},{id:'list',role:'collection'}]});
assert.equal(inferred.sections.length,2);
console.log('UI_COMPOSER_OK bounded declarative schema, exact action retention, AI fail-closed');
