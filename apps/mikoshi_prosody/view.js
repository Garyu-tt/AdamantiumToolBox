export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,t)=>{const e=document.createElement(tag);e.textContent=t||'';host.append(e);return e;};
 add('h2','Mikoshi Prosody Coach — local neural learning');
 const text=add('textarea');text.maxLength=160;text.value='Привет, я Данте!';
 const output=add('pre','');
 const graph=api.graph().nodes;
 const canSuggest=graph.some(n=>n.id==='mikoshi_prosody.suggest');
 const canLearn=graph.some(n=>n.id==='mikoshi_prosody.feedback');
 const suggest=add('button','Предложить интонацию');suggest.disabled=!canSuggest;
 suggest.onclick=async()=>{
  try{output.textContent=JSON.stringify(
   await api.call('mikoshi_prosody.suggest',{text:text.value}),null,2);}
  catch(e){output.textContent=String(e.message);}
 };
 const choices=[['higher','Выше'],['lower','Ниже'],['faster','Быстрее'],
  ['slower','Медленнее'],['good','Хорошо']];
 for(const [value,label] of choices){
  const btn=add('button',label);btn.disabled=!canLearn;
  btn.onclick=async()=>{
   try{const r=await api.call('mikoshi_prosody.feedback',
    {text:text.value,feedback:value});output.textContent=JSON.stringify(r,null,2);}
   catch(e){output.textContent=String(e.message);}
  };
 }
 if(!canLearn)add('p','Learning is unavailable until owner enables private state and permissions.');
}
