export async function mount(host,api){
 const add=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;host.append(n);return n;};
 add('h2','Godot · Local Backend');
 const status=add('pre','Ожидание статуса…');
 const refresh=add('button','Проверить установленный движок');
 refresh.onclick=async()=>{
  try{status.textContent=JSON.stringify(await api.call('godot_local.engine.inspect'),null,2);}
  catch(e){status.textContent=e.message;}
 };
 refresh.click();
}
