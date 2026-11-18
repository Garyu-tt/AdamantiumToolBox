export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;parent.append(e);return e;};
 add('h2','Noosphere Lite · Read-only memory');
 const state=add('p',''),form=add('div'),query=add('input',undefined,form);
 query.placeholder='Search memory';query.maxLength=500;
 const search=add('button','Search',form),output=add('pre','',host);
 const enabled=api.graph().nodes.some(n=>n.id==='noosphere_lite.search');
 state.textContent=enabled?'MCP memory provider available':'MCP provider unavailable or permission denied';
 search.disabled=!enabled;
 search.onclick=async()=>{try{
  output.textContent=JSON.stringify(await api.call('noosphere_lite.search',{
   query:query.value,limit:8}),null,2);
 }catch(e){output.textContent=e.message;}};
}
