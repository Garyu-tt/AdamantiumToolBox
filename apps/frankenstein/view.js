export async function mount(host,api){
 const add=(tag,text)=>{const x=document.createElement(tag);x.textContent=text;host.append(x);return x;};
 add('h2','Frank Addons');
 const state=add('p',''),list=add('ul',''),button=add('button','Обновить');
 async function refresh(){
  list.replaceChildren();
  try{
   const result=await api.call('frankenstein.list');
   state.textContent='Активных пакетов: '+result.packages.length;
   for(const p of result.packages){
    const item=document.createElement('li');
    item.textContent=p.key+' ('+p.version+') — '+p.actions.join(', ');
    list.append(item);
   }
  }catch(e){state.textContent=String(e.message);}
 }
 button.onclick=refresh;await refresh();
}
