/**
 * Mechanicus Math Lab — inert, deterministic research department work plan.
 *
 * A plan is proposed data, NOT a Task Pool submission or MAS invocation.
 * Roles are labels for future approved workers, not automatically created agents.
 */
import {createHash} from 'node:crypto';
import {validateHypothesis} from './experiment.mjs';

export const RESEARCH_PLAN_SCHEMA='mechanicus.math-research-plan/1';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const PHASES=Object.freeze([
 {phase:'sources',role:'literature-analyst',dependsOn:[],
  evidence:'Verifiable literature, definitions, assumptions and source permissions'},
 {phase:'theory',role:'mathematical-theorist',dependsOn:['sources'],
  evidence:'Mathematical hypothesis, counterexamples and lossless/lossy obligations'},
 {phase:'dataset',role:'experimentalist',dependsOn:['sources'],
  evidence:'Dataset hash, provenance, consent, format and evaluation split'},
 {phase:'experiment',role:'experimentalist',dependsOn:['theory','dataset'],
  evidence:'Reproducible code version, exact model/metadata cost and raw measurements'},
 {phase:'reproduction',role:'independent-reproducer',dependsOn:['experiment'],
  evidence:'Independent runner receipt, exact reconstructed bytes or distortion metrics'},
 {phase:'counterexamples',role:'independent-reproducer',dependsOn:['experiment'],
  evidence:'Adversarial and representative corpora with distinct failure cases'},
 {phase:'audit',role:'qa-auditor',dependsOn:['reproduction','counterexamples'],
  evidence:'Independent baseline comparison and signed QA decision'},
 {phase:'archive',role:'noosphere-archivist',dependsOn:['audit'],
  evidence:'Owner-approved provenance, dataset rights, timestamp and Noosphere record'}
]);
export function createResearchPlan(untrustedHypothesis){
 const hypothesis=validateHypothesis(untrustedHypothesis);
 const implemented=hypothesis.method==='root-transform';
 const nodes=[];
 if(!implemented){
  nodes.push(Object.freeze({
   id:hypothesis.id+':implement-method',phase:'implement-method',
   role:'mathematical-theorist',status:'proposed',
   dependsOn:Object.freeze([hypothesis.id+':theory']),
   evidenceRequired:'Approved bounded experimental adapter and independent tests',
   blockerReason:'No authorized experiment engine for this mathematical method',
   executionAuthorized:false
  }));
 }
 for(const step of PHASES){
  const predecessors=step.dependsOn.map(phase=>hypothesis.id+':'+phase);
  if(step.phase==='experiment'&&!implemented)predecessors.push(hypothesis.id+':implement-method');
  nodes.push(Object.freeze({
   id:hypothesis.id+':'+step.phase,
   phase:step.phase,role:step.role,status:'proposed',
   dependsOn:Object.freeze(predecessors),
   evidenceRequired:step.evidence,
   requiresOperatorApproval:step.phase==='archive',
   executionAuthorized:false
  }));
 }
 const index=new Map(nodes.map(n=>[n.id,n]));
 if(index.size!==nodes.length)throw new TypeError('research plan duplicate nodes');
 const seen=new Set(),visiting=new Set();
 function walk(id){
  if(visiting.has(id))throw new TypeError('research plan dependency cycle');
  if(seen.has(id))return;
  const node=index.get(id);
  if(!node)throw new TypeError('research plan missing dependency');
  visiting.add(id);
  for(const prev of node.dependsOn)walk(prev);
  visiting.delete(id);seen.add(id);
 }
 for(const id of index.keys())walk(id);
 const edges=nodes.flatMap(n=>n.dependsOn.map(from=>Object.freeze({
  from,to:n.id,type:'depends'
 })));
 const result={
  schema:RESEARCH_PLAN_SCHEMA,
  planId:'math-plan:'+hypothesis.id,
  revision:1,
  hypothesisId:hypothesis.id,
  hypothesisSha256:sha(hypothesis),
  target:hypothesis.target,
  method:hypothesis.method,
  methodImplemented:implemented,
  nodes:Object.freeze(nodes),
  edges:Object.freeze(edges),
  proposedOnly:true,
  graphMutationAuthorized:false,
  taskPoolSubmissionAuthorized:false,
  independentQACompleted:false,
  archiveAuthorized:false
 };
 return Object.freeze({...result,digest:sha(result)});
}
