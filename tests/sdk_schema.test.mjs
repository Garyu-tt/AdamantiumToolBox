import {strict as assert} from 'node:assert';
import {assertSchema,validateValue} from '../sdk/schema.mjs';
import {invokeTyped} from '../sdk/invoke.mjs';
const shape={type:'object',additionalProperties:false,required:['name','data'],
 properties:{name:{type:'string',minLength:1,maxLength:20},
  data:{type:'array',minItems:1,maxItems:3,items:{type:'integer',minimum:0}},
  ready:{type:'boolean'}}};
assert(assertSchema(shape));assert(validateValue(shape,{name:'x',data:[0,2]}));
for(const bad of [{name:'',data:[1]},{name:'x',data:[1.2]},
 {name:'x',data:[]},{name:'x',data:[1],admin:true},{name:'x',data:'yes'},
 {name:'x',data:[1],ready:'yes'}])assert(!validateValue(shape,bad));
for(const bad of [{type:'object',properties:{x:{$ref:'#/xyz'}}},
 {type:'object',properties:{x:{type:'string',pattern:'.*'}}},
 {type:'array',minItems:-1},{type:'object',required:['missing']},
 {type:'object',properties:{'__proto__':{type:'string'}}}])
 if(Object.keys(bad.properties||{}).includes('__proto__')||
  JSON.stringify(bad).includes('required')||JSON.stringify(bad).includes('minItems')||
  JSON.stringify(bad).includes('pattern')||JSON.stringify(bad).includes('$ref'))
  assert.throws(()=>assertSchema(bad),/schema_/);
assert(!validateValue({type:'integer'},Number.MAX_SAFE_INTEGER+1));
assert(!validateValue({type:'number'},Infinity));
assert.throws(()=>assertSchema({type:'object',additionalProperties:{type:'string'}}),
 /schema_unsupported/);
const action={id:'sample.test',type:'action',input:shape,
 output:{type:'object',required:['ok'],properties:{ok:{type:'boolean'}},
  additionalProperties:false}};
const state={doc:{modules:[{provides:[action],children:[]}]},
 spec:{nodes:[{id:action.id,type:'action'}]}};
let called=0;
const handlers={'sample.test':async()=>{called++;return {ok:true}}};
await assert.rejects(invokeTyped(state,handlers,action.id,{name:'x',data:[1],root:true}),
 /input_invalid/);assert.equal(called,0);
assert.deepEqual(await invokeTyped(state,handlers,action.id,{name:'x',data:[1]}),{ok:true});
await assert.rejects(invokeTyped({...state,spec:{nodes:[]}},handlers,action.id,{}),
 /capability_unavailable/);
await assert.rejects(invokeTyped(state,{'sample.test':async()=>({ok:'yes'})},
 action.id,{name:'x',data:[1]}),/output_invalid/);
console.log('SDK_SCHEMA_OK strict schemas input before handler output fail-closed');
