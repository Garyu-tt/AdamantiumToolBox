export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 add('h2','Mechanicus Forge · Adapter API');
 add('p','Здесь только контракты. Граф, очередь, память и выполнение принадлежат внешним провайдерам.');
 const status=add('p',''),area=add('textarea');area.rows=12;area.style.width='100%';
 area.value=JSON.stringify({schema:'forge.function.v1',id:'mechanicus.example.inspect',version:'0.1.0',
  request:{atomic:true,goal:'Inspect one function',acceptance:['A typed result is returned']},
  capability:{action:'example.inspect',input_schema:{type:'object'},output_schema:{type:'object'}},
  dependencies:[],ui:{expose:true,role:'action',label:'Inspect'}},null,2);
 const submit=add('button','Validate contract'),out=add('pre','');
 out.style.whiteSpace='pre-wrap';out.style.overflowWrap='anywhere';
 submit.onclick=async()=>{
  try{out.textContent=JSON.stringify(await api.call('forge.validate',{function:JSON.parse(area.value)}),null,2);}
  catch(e){out.textContent='Validation unavailable: '+e.message;}
 };
 try{const info=await api.call('forge.describe');
  status.textContent='Adapter '+info.schema+' · '+info.provider_ports.length+' optional provider contracts';
 }catch(e){status.textContent='Contract discovery failed: '+e.message;}
}
