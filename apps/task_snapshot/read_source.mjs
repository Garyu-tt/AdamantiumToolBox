/**
 * Mechanicus R07 — server-side read-only Task Pool snapshot projection.
 *
 * IMPORTANT: caller must supply a freshly authenticated and permission-filtered
 * MAS Core graph and a host-mediated Core read callback; neither this module
 * nor the resulting snapshot grants any MAS permission.
 */
export const SNAPSHOT_VIEW_SCHEMA = 'mechanicus.orchestration-view/1';
const ID = /^[a-z][a-z0-9._:-]{0,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KNOWN_STATES = Object.freeze({
  queued:'queued', claimed:'claimed', needs_review:'needs-review',
  completed:'completed-unverified', failed:'failed', cancelled:'cancelled'
});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
function fail(why){throw new TypeError('Task snapshot rejected: '+why);}
const safeText=(v,fallback,max=300)=>{
  if(typeof v!=='string')return fallback;
  const text=v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
  return text || fallback;
};
export function discoverTaskListAction(visibleCoreGraph,{expectedOwner}={}){
  if(!object(visibleCoreGraph)||!Array.isArray(visibleCoreGraph.nodes)||
    visibleCoreGraph.nodes.length>4096)fail('invalid permission-filtered Core graph');
  if(typeof expectedOwner!=='string'||!ID.test(expectedOwner))fail('explicit approved task owner required');
  const actions=new Set(visibleCoreGraph.nodes
    .filter(n=>object(n)&&n.type==='action'&&typeof n.id==='string').map(n=>n.id));
  const matched=[];
  for(const n of visibleCoreGraph.nodes){
    if(!object(n)||n.type!=='resource'||n.provider?.schema!=='mas-task-provider-1')continue;
    if(typeof n.id!=='string'||!n.id.startsWith(expectedOwner+'.'))continue;
    const action=n.provider.listAction;
    if(action!==expectedOwner+'.list'||!actions.has(action))continue;
    matched.push(action);
  }
  if(matched.length>1)fail('ambiguous task read resource');
  return matched[0]??null;
}
function convertTask(row){
  if(!object(row)||typeof row.taskId!=='string'||!UUID.test(row.taskId))fail('invalid task UUID');
  if(typeof row.title!=='string'||row.title.length<1||row.title.length>160)fail('invalid task title');
  if(!own(KNOWN_STATES,row.status))fail('unsupported task status');
  if(!Number.isSafeInteger(row.revision)||row.revision<1)fail('invalid task revision');
  if(!Array.isArray(row.requires)||row.requires.length>128||
     !row.requires.every(x=>typeof x==='string'&&x.length>0&&x.length<=128))fail('invalid capabilities');
  if(row.status==='claimed'&&(!object(row.lease)||typeof row.lease.workerId!=='string'))fail('claimed without lease');
  const status=KNOWN_STATES[row.status];
  const blockers=status==='needs-review'?[{
    code:'taskpool.needs_review',
    reason:safeText(row.note,'Uncertain outcome requires independent review'),
    recoveryTaskId:null
  }]:[];
  // No raw payload, error, outcome, lease, worker identity, private results,
  // or misleading inferred DAG dependencies leave the source boundary.
  return {
    id:'task:'+row.taskId.toLowerCase(),
    title:safeText(row.title,'Task without title',160),
    status,ownerProviderId:null,dependsOn:[],blockers
  };
}
/**
 * A missing source or read failure yields NO snapshot; caller must never
 * rebrand it as a real zero-task queue. Task Pool R01 is capped at 200 rows
 * even though its backing store can contain 256 tasks.
 */
export async function collectTaskSnapshot({
  visibleCoreGraph,expectedOwner,readAction,revision,observedAt
}={}){
  if(!Number.isSafeInteger(revision)||revision<1)fail('positive publisher revision required');
  if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))fail('invalid observation timestamp');
  const action=discoverTaskListAction(visibleCoreGraph,{expectedOwner});
  if(!action)return Object.freeze({status:'source-not-visible',partial:true,snapshot:null});
  if(typeof readAction!=='function')fail('authorized Core read callback required');
  let rows;
  try{rows=await readAction(action,Object.freeze({limit:200}));}
  catch{return Object.freeze({status:'source-read-failed',partial:true,snapshot:null});}
  if(!Array.isArray(rows)||rows.length>200)fail('invalid bounded task source response');
  const seen=new Set();
  const tasks=rows.map(row=>{
    const item=convertTask(row);
    if(seen.has(item.id))fail('duplicate task UUID');
    seen.add(item.id);
    return item;
  });
  const snapshot={
    schema:SNAPSHOT_VIEW_SCHEMA,revision,observedAt,
    authorityProviderId:expectedOwner,
    providers:[{id:expectedOwner,label:'Task Pool',role:'graph-authority',
      connection:'read-only',observedAt,capabilities:[]}],
    tasks
  };
  return Object.freeze({status:'read-only',partial:true,taskCount:tasks.length,snapshot,
    actionContract:'mas-task-provider-1',authorizedExecution:false});
}
