const viewable=node=>node.type==='view'&&typeof node.entry==='string'&&
 /^\/apps\/[a-z0-9_-]+\/(?:[a-f0-9]{40,64}\/)?view\.js$/.test(node.entry);
export async function mount(host,api){
 const owner=api.graph().nodes.find(n=>n.id==='chat_workspace.view');
 const spec=owner?.composition;
 if(spec?.schema!=='mas-composition-1'||!Array.isArray(spec.slots))throw Error('invalid_composition');
 const css=document.createElement('link');css.rel='stylesheet';css.href='/apps/chat_workspace/style.css';host.append(css);
 const layout=document.createElement('div');layout.className='mas-chat-workspace';host.append(layout);
 const slots=new Map(),mounted=new Map();
 for(const s of spec.slots){if(!/^[a-z][a-z0-9_-]{0,30}$/.test(s.id))continue;
  const area=document.createElement('section');area.dataset.masSlot=s.id;
  area.className='mas-chat-slot mas-chat-'+s.width;layout.append(area);slots.set(s.id,area);}
 async function reconcile(){
  const available=api.graph().nodes.filter(n=>viewable(n)&&
   n.composition?.schema==='mas-composite-view-1'&&
   n.composition.surface===spec.surface&&slots.has(n.composition.slot));
  available.sort((a,b)=>(a.composition.order||0)-(b.composition.order||0)||a.id.localeCompare(b.id));
  const seen=new Set(available.map(n=>n.id));
  for(const [id,item] of mounted)if(!seen.has(id)||!available.some(n=>n.id===id&&n.entry===item.entry)){
   item.controller.abort();item.element.remove();mounted.delete(id);}
  for(const node of available){if(mounted.has(node.id))continue;
   const element=document.createElement('div');element.className='mas-chat-widget';
   const controller=new AbortController();element._masSignal=controller.signal;
   slots.get(node.composition.slot).append(element);
   mounted.set(node.id,{element,controller,entry:node.entry});
   try{const module=await import(node.entry);if(typeof module.mount!=='function')throw Error('mount_missing');
    await module.mount(element,api);
   }catch(e){element.textContent='Ошибка компонента: '+e.message;}
  }
  for(const [id,area] of slots){area.hidden=![...mounted.values()].some(x=>x.element.parentNode===area);}
 }
 await reconcile();
 const timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);for(const m of mounted.values())m.controller.abort();return;}
  reconcile().catch(()=>{});},3000);
}
