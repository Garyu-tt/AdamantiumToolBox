import {projectGraph,findCycles} from './model.js';
const MAX_FILES=250,MAX_TASKS=200,MAX_EDGES=800;
const safe=s=>typeof s==='string'&&s.length>0&&s.length<=150&&!/[\x00-\x1f\x7f]/.test(s);
const status=s=>({claimed:'running',needs_review:'blocked',cancelled:'unknown'}[s]||
 (['queued','running','completed','failed','blocked'].includes(s)?s:'unknown'));
export function discoverTaskReader(core){
 const nodes=Array.isArray(core?.nodes)?core.nodes:[];
 const actions=new Set(nodes.filter(n=>n.type==='action').map(n=>n.id));
 for(const n of nodes){
  const p=n?.provider;
  if(n.type!=='resource'||p?.schema!=='mas-task-provider-1'||!safe(n.id))continue;
  const owner=n.id.split('.')[0];
  const candidate=typeof p.listAction==='string'?p.listAction:
   nodes.find(a=>a.type==='action'&&a.id===owner+'.list')?.id;
  if(safe(candidate)&&candidate.startsWith(owner+'.')&&actions.has(candidate))return candidate;
 }
 return null;
}
export function federate(core,{code=null,tasks=null,taskAction=null}={}){
 const out=projectGraph(core),seen=new Set(out.nodes.map(n=>n.id));
 const warnings=[],freshEdges=[],totals={files:0,tasks:0};
 const add=n=>{if(!safe(n.id)||seen.has(n.id)){warnings.push('duplicate_or_invalid:'+String(n.id).slice(0,80));return false;}
  seen.add(n.id);out.nodes.push(n);return true;};
 const edge=(from,to,type)=>{if(!safe(from)||!safe(to))return;
  (seen.has(from)&&seen.has(to)?freshEdges:out.missing).push({from,to,type});};
 if(code?.schema==='mas-codegraph-1'&&Array.isArray(code.nodes)){
  totals.files=code.nodes.length;
  for(const f of code.nodes.slice(0,MAX_FILES)){
   if(!safe(f?.file)||!f.file.includes('/')||f.file.includes('..'))continue;
   const id='file:'+f.file;
   if(add({id,kind:'file',title:f.file,status:'unknown',observed:true,
    source:{type:'codegraph',trust:'static_import_analysis',sha256:f.sha256||null}})){
    const match=/^apps\/([a-z][a-z0-9_-]{1,39})\//.exec(f.file);
    if(match&&seen.has('mas:'+match[1]))edge('mas:'+match[1],id,'contains');
   }
  }
  const imports=Array.isArray(code.edges)?code.edges:[];
  for(const e of imports.slice(0,MAX_EDGES))if(e?.type==='imports'&&safe(e.from)&&safe(e.to))
   edge('file:'+e.from,'file:'+e.to,'imports');
  if(totals.files>MAX_FILES||imports.length>MAX_EDGES)warnings.push('codegraph_truncated');
 }
 if(Array.isArray(tasks)){
  totals.tasks=tasks.length;
  for(const t of tasks.slice(0,MAX_TASKS)){
   if(!safe(t?.taskId)||!safe(t?.title))continue;
   const id='task:'+t.taskId;
   const st=status(t.status);
   if(!add({id,kind:'task',title:t.title,status:st,observed:true,
    reason:st==='blocked'?(safe(t.note)?t.note:'Reconciliation required'):null,
    responsible:safe(t.lease?.workerId)?t.lease.workerId:null,
    source:{type:'task_provider',action:taskAction,revision:t.revision??null}}))continue;
   for(const requirement of Array.isArray(t.requires)?t.requires.slice(0,32):[]){
    if(safe(requirement))edge(id,requirement,'requires');
   }
  }
  if(totals.tasks>MAX_TASKS)warnings.push('tasks_truncated');
 }
 out.edges.push(...freshEdges);
 out.cycles=findCycles(out.nodes,out.edges.filter(e=>e.type==='depends'||e.type==='imports'||e.type==='requires'));
 out.warnings=warnings;out.totals=totals;
 return out;
}
