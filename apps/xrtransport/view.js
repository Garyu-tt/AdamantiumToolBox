export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;parent.append(e);return e;};
 add('h2','ParallaXis · XR Transport');
 add('p','Адаптеры независимы. Диагностика не изменяет устройство.');
 const output=add('pre','');
 const available=new Set(api.graph().nodes.filter(n=>n.type==='action').map(n=>n.id));
 const options=[
  ['xrtransport.devices','ADB устройства'],
  ['xrtransport.usb_routes','USB маршруты'],
  ['xrtransport.adapters','Доступные адаптеры'],
  ['xrtransport.providers','Состояние подключений']
 ];
 for(const [id,title] of options){
  if(!available.has(id))continue;
  const button=add('button',title);
  button.onclick=async()=>{
   try{output.textContent=JSON.stringify(await api.call(id),null,2);}
   catch(e){output.textContent=String(e.message);}
  };
 }
 if(available.has('xrtransport.inventory')){
  const group=add('div');add('p','Снимок списка пакетов (не APK-бэкап)',group);
  const select=add('select',undefined,group),refresh=add('button','Найти устройство',group);
  const take=add('button','Снять инвентаризацию',group);
  async function update(){
   select.replaceChildren();
   const result=await api.call('xrtransport.devices');
   for(const dev of result.devices||[]){
    if(dev.status!=='device')continue;
    const o=add('option',dev.description||dev.serial,select);o.value=dev.serial;
   }
   take.disabled=!select.options.length;
  }
  refresh.onclick=()=>update().catch(e=>output.textContent=String(e.message));
  take.onclick=async()=>{
   if(!select.value)return;
   try{output.textContent=JSON.stringify(
    await api.call('xrtransport.inventory',{serial:select.value}),null,2);}
   catch(e){output.textContent=String(e.message);}
  };
  await update().catch(e=>output.textContent=String(e.message));
 }
}
