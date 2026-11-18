export function findUiComposer(graph,mode='automatic'){
 const nodes=Array.isArray(graph?.nodes)?graph.nodes:[];
 const actions=new Set(nodes.filter(n=>n.type==='action').map(n=>n.id));
 return nodes.filter(n=>{
  const p=n.uiComposer,owner=String(n.id||'').split('.')[0]+'.';
  return n.type==='resource'&&p?.schema==='mas-ui-composer-provider-1'&&
   Array.isArray(p.modes)&&p.modes.includes(mode)&&
   typeof p.planAction==='string'&&p.planAction.startsWith(owner)&&actions.has(p.planAction);
 }).sort((a,b)=>(Number(b.uiComposer.priority)||0)-(Number(a.uiComposer.priority)||0))[0]?.uiComposer||null;
}
export function validUiPlan(plan,schema,mode='automatic'){
 if(plan?.schema!=='mas-ui-plan-1'||plan.app!==schema.app||plan.mode!==mode||
  !Array.isArray(plan.sections)||!plan.sections.length||plan.sections.length>32)return false;
 const expected=new Set(schema.elements.map(e=>e.id)),seen=new Set(),groups=new Set();
 for(const group of plan.sections){
  if(typeof group.id!=='string'||!group.id.match(/^[a-z][a-z0-9_-]{0,47}$/)||
   groups.has(group.id)||typeof group.title!=='string'||group.title.length>90||
   !['full','card','sidebar'].includes(group.width)||!Array.isArray(group.items)||
   group.items.length>96||
   !group.items.length)return false;
  groups.add(group.id);
  for(const id of group.items){
   if(!expected.has(id)||seen.has(id))return false;
   seen.add(id);
  }
 }
 return seen.size===expected.size;
}
const style=(node,css)=>Object.assign(node.style,css);
export function attachComposition(host,api,{schema,controls,after}){
 const entries=new Map(schema.elements.map(e=>[e.id,{
  element:controls[e.id],role:e.role,label:e.label,style:controls[e.id]?.style.cssText||''}]));
 if([...entries.values()].some(x=>!x.element||!host.contains(x.element)))throw Error('controls');
 const anchors=new Map();
 for(const [id,item] of entries){
  const anchor=document.createComment('ui:'+id);item.element.before(anchor);anchors.set(id,anchor);
 }
 const toolbar=document.createElement('div'),choice=document.createElement('select');
 const message=document.createElement('span');
 style(toolbar,{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',margin:'8px 0'});
 for(const [id,name] of [['raw','Raw UI'],['automatic','Automatic'],['intelligent','Intelligent']]){
  const option=document.createElement('option');option.value=id;option.textContent=name;
  choice.append(option);
 }
 choice.setAttribute('aria-label','Режим компоновки');
 toolbar.append(choice,message);after.after(toolbar);
 const area=document.createElement('div');toolbar.after(area);
 const key='ui:'+schema.app;
 let preference='automatic';
 try{const saved=localStorage.getItem(key);if(['raw','automatic','intelligent'].includes(saved))preference=saved;}catch{}
 choice.value=preference;
 let rendered=false,signature='',epoch=0;
 function restore(){
  if(!rendered)return;
  for(const [id,item] of entries){anchors.get(id).after(item.element);item.element.style.cssText=item.style;}
  area.replaceChildren();rendered=false;signature='';
 }
 function render(plan){
  const focused=document.activeElement;
  const position=focused&&'selectionStart' in focused?
   [focused.selectionStart,focused.selectionEnd]:null;
  restore();
  style(area,{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,290px),1fr))',
   gap:'12px',alignItems:'start',margin:'8px 0'});
  for(const group of plan.sections){
   const section=document.createElement('section');
   style(section,{border:'1px solid var(--line)',background:'var(--surface)',
    padding:'12px',borderRadius:'8px',minWidth:'0',overflowWrap:'anywhere'});
   if(group.width==='full')section.style.gridColumn='1 / -1';
   if(group.title){const title=document.createElement('h3');title.textContent=group.title;
    style(title,{margin:'0 0 12px'});section.append(title);}
   const grid=document.createElement('div');
   style(grid,{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,210px),1fr))',
    gap:'10px',alignItems:'end'});
   for(const id of group.items){
    const item=entries.get(id),holder=document.createElement('div');
    style(holder,{minWidth:'0',display:'flex',flexDirection:'column',gap:'5px'});
    if(item.role==='output'||item.role==='collection'||item.role==='heading')
     holder.style.gridColumn='1 / -1';
    if(item.role==='field'&&item.label){
     const caption=document.createElement('span');caption.textContent=item.label;
     caption.setAttribute('aria-hidden','true');holder.append(caption);
     if(!item.element.getAttribute('aria-label'))item.element.setAttribute('aria-label',item.label);
    }
    if(['field','output','collection'].includes(item.role))
     style(item.element,{maxWidth:'100%',minWidth:'0',boxSizing:'border-box'});
    holder.append(item.element);grid.append(holder);
   }
   section.append(grid);area.append(section);
  }
  rendered=true;
  if(focused&&host.contains(focused)&&focused.focus){
   focused.focus({preventScroll:true});
   if(position&&typeof focused.setSelectionRange==='function')
    try{focused.setSelectionRange(...position);}catch{}
  }
 }
 async function sync(){
  if(!host.isConnected){clearInterval(interval);return;}
  const mode=choice.value,provider=findUiComposer(api.graph(),mode);
  choice.querySelector('option[value="intelligent"]').disabled=!findUiComposer(api.graph(),'intelligent');
  if(mode==='raw'||!provider){epoch++;restore();message.textContent=mode==='raw'?
   'Raw UI':'Composer offline';return;}
  const next=mode+':'+provider.planAction+':'+(provider.version||'');
  if(rendered&&signature===next)return;
  const ticket=++epoch;
  try{
   const plan=await api.call(provider.planAction,{schema,mode});
   if(ticket!==epoch||choice.value!==mode||!validUiPlan(plan,schema,mode))return;
   render(plan);signature=next;message.textContent='Компоновка: '+mode;
  }catch{if(ticket===epoch){restore();message.textContent='Raw fallback';}}
 }
 choice.onchange=()=>{try{localStorage.setItem(key,choice.value);}catch{}void sync();};
 const interval=setInterval(()=>void sync(),5500);
 void sync();
 return {restore,refresh:sync};
}
