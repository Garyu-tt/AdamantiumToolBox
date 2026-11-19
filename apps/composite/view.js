import {compile} from './compile.js';
export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const x=document.createElement(tag);
  if(text!==undefined)x.textContent=text;parent.append(x);return x;};
 add('h2','Составные программы');
 add('p','Несколько независимых действий в одном интерфейсе; права проверяются заново при вызове.');
 const data=add('textarea');data.rows=9;data.style.width='100%';
 data.placeholder='{"schema":"mas-composite-1","groups":[]}';
 const trigger=add('button','Собрать интерфейс');
 const panel=add('section');
 trigger.onclick=()=>{panel.replaceChildren();try{
  const plan=compile(JSON.parse(data.value),api.graph());
  for(const g of plan.groups){const section=add('section',undefined,panel);
   add('h3',g.title,section);
   for(const item of g.items){const b=add('button',item.label,section);
    b.onclick=async()=>{try{
     const result=await api.call(item.action,item.params);
     add('pre',JSON.stringify(result,null,2),section);
    }catch(e){add('p','Ошибка: '+e.message,section);}};
   }
  }
  if(plan.diagnostics.length)add('p','Скрыто недоступных действий: '+plan.diagnostics.length,panel);
 }catch(e){add('p','Ошибка схемы: '+e.message,panel);}};
}
