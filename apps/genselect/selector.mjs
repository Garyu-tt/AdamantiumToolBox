export const DECISION_SCHEMA='genesis.policy.selection.v1';
const id=/^[a-z][a-z0-9_.-]{0,95}$/;
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
export function select({proposals,allowedIds,expectedBasis,minUtility=0}={}){
 if(!plain(proposals)||proposals.schema!=='genesis.policy.proposals.v1'||
  proposals.mode!=='simulation'||proposals.executable!==false||!hash(proposals.basis)||
  !hash(expectedBasis)||proposals.basis!==expectedBasis||
  !Number.isSafeInteger(proposals.sourceRevision)||proposals.sourceRevision<0||
  !Array.isArray(proposals.candidates)||proposals.candidates.length>32||
  !Array.isArray(allowedIds)||allowedIds.length>32||
  !Number.isFinite(minUtility)||minUtility<0||minUtility>100)
  throw Error('invalid_policy_selection');
 const allow=new Set();
 for(const actionId of allowedIds){if(typeof actionId!=='string'||!id.test(actionId)||allow.has(actionId))throw Error('invalid_allowed_action');allow.add(actionId);}
 const seen=new Set();const choices=[];
 for(const a of proposals.candidates){
  if(!plain(a)||!id.test(a.id)||seen.has(a.id)||a.scope!=='virtual'||
     ![a.utility,a.projected,a.delta,a.cost].every(Number.isFinite)||a.cost<0)
   throw Error('invalid_candidate');
  seen.add(a.id);if(allow.has(a.id)&&a.utility>minUtility)choices.push(a);
 }
 choices.sort((a,b)=>b.utility-a.utility||a.id.localeCompare(b.id));
 const choice=choices[0]??null;
 return {schema:DECISION_SCHEMA,mode:'simulation',basis:expectedBasis,
  selectedAction:choice?.id??null,utility:choice?.utility??null,
  reason:choice?'best_allowed_positive_utility':'abstain',
  approved:false,executable:false};
}
