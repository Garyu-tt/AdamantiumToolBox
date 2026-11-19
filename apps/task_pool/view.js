export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;parent.append(e);return e;};
 add('h2','Adamantium Task Pool');
 const status=add('p',''),refresh=add('button','Refresh tasks');
 const tasks=add('div'),output=add('pre','');
 const has=id=>api.graph().nodes.some(n=>n.id===id);
 const form=add('div'),title=add('input',undefined,form);
 title.placeholder='Task title';title.maxLength=160;
 const create=add('button','Submit task',form);create.disabled=!has('tasks.submit');
 async function reload(){
  tasks.replaceChildren();
  if(!has('tasks.list')){status.textContent='Task access denied';return;}
  const items=await api.call('tasks.list',{limit:100});
  status.textContent=items.length+' tasks';
  for(const t of items){
   const row=add('div',t.title+' · '+t.status+' · '+t.taskId+' ',tasks);
   const inspect=add('button','Details',row);
   inspect.onclick=async()=>{try{output.textContent=JSON.stringify(await api.call('tasks.get',
    {taskId:t.taskId}),null,2);}catch(e){output.textContent=e.message;}};
  }
 }
 create.onclick=async()=>{try{output.textContent=JSON.stringify(await api.call('tasks.submit',{
  title:title.value,requires:[],payload:{}}),null,2);title.value='';await reload();}
  catch(e){output.textContent=e.message;}};
 refresh.onclick=()=>reload().catch(e=>status.textContent=e.message);
 await reload().catch(e=>status.textContent=e.message);
}
