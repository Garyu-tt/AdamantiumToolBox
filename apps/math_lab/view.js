import {mountResearchPlan} from './view_research_plan.js';
import {mountRootExperiment} from './view_root_experiment.js';
import {mountGraphSearch} from './view_graph_search.js';
import {mountOperationWorkbench} from './view_operation_workbench.js';
/**
 * Math Lab R01 — host-delegated MAS UI. No direct fetch, no secrets, no raw
 * HTML injection. Existing Core graph controls which actions are available.
 */
export async function mount(host,api){
 const el=(tag,parent,content)=>{
  const node=document.createElement(tag);
  if(content!==undefined)node.textContent=content;
  parent.append(node);return node;
 };
 const style=el('link',host);
 style.rel='stylesheet';
 style.href=new URL('./view.css',import.meta.url).href;
 const root=el('section',host);root.className='math-lab';
 el('h2',root,'Mechanicus Math Lab');
 el('p',root,'Математический исследовательский отдел: гипотезы, эксперименты, измерение MDL, проверка. Первый полигон — точное сжатие.');
 const status=el('p',root);status.setAttribute('role','status');
 const permitted=()=>{
  const graph=typeof api.graph==='function'?api.graph():{nodes:[]};
  return new Set((graph.nodes||[]).filter(n=>n.type==='action').map(n=>n.id));
 };
 const allowed=permitted();
 const disciplines=el('details',root);
 el('summary',disciplines,'Направления исследования и научные роли');
 const list=el('ul',disciplines);
 if(allowed.has('math_lab.catalog')){
  try{
   const catalog=await api.call('math_lab.catalog',{});
   for(const title of catalog.disciplines||[])el('li',list,title);
   el('p',disciplines,'Приоритет: compression · далее ALT, GENESIS, Noosphere, графовый мозг.');
   el('p',disciplines,'Роли: '+(catalog.researchRoles||[]).join(' · '));
  }catch{el('p',disciplines,'Каталог исследовательских направлений недоступен.');}
 }else el('p',disciplines,'Нет подтверждённого разрешения math_lab.read.');
 const planUI=mountResearchPlan({el,root,api,allowed});
 const rootUI=mountRootExperiment({el,root,api,allowed,status});
 const graphUI=mountGraphSearch({el,root,api,allowed,status,input:rootUI.input});
 const operationUI=await mountOperationWorkbench({el,root,api,allowed,graphInput:graphUI.graphInput});
 return {dispose:()=>{planUI.dispose();rootUI.dispose();graphUI.dispose();operationUI.dispose();}};
}
