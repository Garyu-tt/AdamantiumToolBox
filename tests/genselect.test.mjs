import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {select} from '../apps/genselect/selector.mjs';
const basis='a'.repeat(64);
const proposals={schema:'genesis.policy.proposals.v1',mode:'simulation',basis,
 sourceRevision:5,executable:false,candidates:[{id:'move.right',scope:'virtual',utility:1,projected:3,delta:1,cost:0},
 {id:'move.left',scope:'virtual',utility:-1,projected:1,delta:-1,cost:0}]};
test('only explicitly allowed positive options and advisory-only decisions',()=>{
 const result=select({proposals,allowedIds:['move.right','move.left'],expectedBasis:basis});
 assert.equal(result.selectedAction,'move.right');assert.equal(result.executable,false);assert.equal(result.approved,false);
 assert.equal(select({proposals,allowedIds:['move.left'],expectedBasis:basis}).reason,'abstain');
 assert.equal(select({proposals,allowedIds:[],expectedBasis:basis}).selectedAction,null);
});
test('stale basis, duplicate allowlist, executable inputs fail closed',()=>{
 assert.throws(()=>select({proposals,allowedIds:[],expectedBasis:'b'.repeat(64)}),/invalid_policy_selection/);
 assert.throws(()=>select({proposals:{...proposals,executable:true},allowedIds:[],expectedBasis:basis}),/invalid_policy_selection/);
 assert.throws(()=>select({proposals,allowedIds:['move.right','move.right'],expectedBasis:basis}),/invalid_allowed_action/);
 assert.throws(()=>select({proposals:{...proposals,candidates:[{...proposals.candidates[0],scope:'external'}]},allowedIds:[],expectedBasis:basis}),/invalid_candidate/);
});
