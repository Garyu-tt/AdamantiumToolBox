export async function mount(host,api){
 const add=(tag,txt,parent=host)=>{const el=document.createElement(tag);
  if(txt!==undefined)el.textContent=txt;parent.append(el);return el;};
 add('h2','UI Composer');
 add('p','Декларативная компоновка поверх Capability Graph. Удаление плагина сохраняет Raw UI.');
 const status=add('p','Проверка доступности…');
 const code=add('textarea');code.rows=9;code.style.width='100%';
 code.value=JSON.stringify({schema:'mas-ui-schema-1',app:'example',
  groups:[{id:'form',title:'Новая операция',width:'full',priority:1},
   {id:'history',title:'Задания',width:'card',priority:10}],
  elements:[{id:'prompt',role:'field',group:'form',label:'Описание'},
   {id:'submit',role:'action',group:'form',label:'Создать'},
   {id:'jobs',role:'collection',group:'history'}]},null,2);
 const run=add('button','Проверить компоновку');
 const output=add('pre','');output.style.whiteSpace='pre-wrap';output.style.overflowWrap='anywhere';
 run.onclick=async()=>{try{
  const schema=JSON.parse(code.value);
  const plan=await api.call('ui_composer.plan',{schema,mode:'automatic'});
  output.textContent=JSON.stringify(plan,null,2);
 }catch(e){output.textContent='Ошибка: '+e.message;}};
 status.textContent=api.graph().nodes.some(n=>n.id==='ui_composer.plan')?
  'Доступен Automatic · AI-модуль необязателен и пока не подключён':'Raw UI — действие недоступно';
}
