import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {tryRootTransform,decodeRootTransform,ROOT_TRANSFORM_ABI}
 from '../apps/math_lab/root_transform.mjs';
import {runCompressionExperiment,validateHypothesis,shannonBitsPerByte}
 from '../apps/math_lab/experiment.mjs';
import {createResearchPlan,RESEARCH_PLAN_SCHEMA} from '../apps/math_lab/research_plan.mjs';
import {validateManifest} from '../core/contract.mjs';
import {readFile} from 'node:fs/promises';

const toBytes=n=>{
 let hex=n.toString(16);
 if(hex.length%2)hex='0'+hex;
 return Buffer.from(hex,'hex');
};

test('astronomical model cost prevents false RootTransform economics',()=>{
 const data=toBytes(10n**1000n);
 const r=runCompressionExperiment(data,{datasetId:'charged',degrees:[1000],
  maxDepth:1,rootModelBytes:1000000,zlibModelBytes:1000000});
 assert.equal(r.selected,'raw');
 assert.equal(r.savingsBytes,0);
});

test('ASCII decimal powers are treated as bytes, not magically as the integer 10^1000',()=>{
 const data=Buffer.from('1'+'0'.repeat(1000),'ascii');
 const r=runCompressionExperiment(data,{datasetId:'decimal-ascii',
  degrees:[1000],maxDepth:1});
 assert.equal(r.originalBytes,1001);
 assert.equal(r.selected,'zlib');
});

test('hypothesis schema supports all research programs and rejects ungrounded domains',()=>{
 const v=validateHypothesis({
  schema:'mechanicus.math-hypothesis/1',
  id:'root001',title:'Perfect powers compress with k-th roots',
  target:'genesis',discipline:'number-theory',method:'root-transform',
  datasetId:'tensor-expert84',claim:'Exact bytes survive all experiments',
  sourceRefs:['MIT Information Theory', 'Grunwald MDL']
 });
 assert.equal(v.target,'genesis');
 assert.ok(Object.isFrozen(v));
 assert.throws(()=>validateHypothesis({...v,target:'unrestricted-inference'}),/unknown research domain/);
 assert.throws(()=>validateHypothesis({...v,executeScript:'rm -rf /'}),/unexpected hypothesis field/);
});

test('resource exhaustion and malformed input fail closed',()=>{
 assert.throws(()=>tryRootTransform(Buffer.alloc(8193)),/CPU budget/);
 assert.throws(()=>tryRootTransform(Buffer.from([1]),{degrees:[1]}),/degree/);
 assert.throws(()=>tryRootTransform(Buffer.from([1]),{maxDepth:9}),/depth/);
 assert.throws(()=>runCompressionExperiment(Buffer.from([1]),{rootModelBytes:-1}),/model bytes/);
});


test('scientific department builds a proposed DAG with independent QA, consent and archive gates',()=>{
 const hypothesis={
  schema:'mechanicus.math-hypothesis/1',id:'compression001',
  title:'Exact roots on repeated powers',target:'compression',
  discipline:'number-theory',method:'root-transform',
  datasetId:'benchmark0001',claim:'At least one power corpus has lower complete wire length',
  sourceRefs:['MIT information theory','MDL']
 };
 const plan=createResearchPlan(hypothesis);
 assert.equal(plan.schema,RESEARCH_PLAN_SCHEMA);
 assert.equal(plan.nodes.length,8);
 assert.equal(plan.methodImplemented,true);
 assert.equal(plan.graphMutationAuthorized,false);
 assert.equal(plan.independentQACompleted,false);
 assert.equal(plan.archiveAuthorized,false);
 assert.equal(plan.nodes.find(x=>x.phase==='audit').role,'qa-auditor');
 assert.deepEqual(plan.nodes.find(x=>x.phase==='audit').dependsOn,
  ['compression001:reproduction','compression001:counterexamples']);
 assert.equal(plan.nodes.find(x=>x.phase==='archive').requiresOperatorApproval,true);
 assert.equal(plan.nodes.every(x=>x.status==='proposed'&&x.executionAuthorized===false),true);
 assert.equal(createResearchPlan(hypothesis).digest,plan.digest);
 assert.match(plan.digest,/^[a-f0-9]{64}$/);
});

test('unimplemented mathematical methods become explicit recovery branches, not fake completed research',()=>{
 const plan=createResearchPlan({
  schema:'mechanicus.math-hypothesis/1',id:'spectral001',
  title:'Investigate wavelet structure',target:'alt',
  discipline:'spectral-analysis',method:'generic-analysis',
  datasetId:'weights0001',claim:'Potential structure under alternative basis',
  sourceRefs:[]
 });
 assert.equal(plan.nodes.length,9);
 assert.equal(plan.methodImplemented,false);
 const recovery=plan.nodes.find(x=>x.phase==='implement-method');
 assert.ok(recovery);
 assert.match(recovery.blockerReason,/No authorized/);
 const experiment=plan.nodes.find(x=>x.phase==='experiment');
 assert.ok(experiment.dependsOn.includes(recovery.id));
 assert.equal(plan.taskPoolSubmissionAuthorized,false);
});
