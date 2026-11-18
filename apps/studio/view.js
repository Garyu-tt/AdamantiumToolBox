import {addTab,addControl,remove,connect,bound,tabs,backendActions} from './model.js';
import {renderCanvas} from './canvas.js';
import {showGraph} from './graphview.js';
import {element as h,button,input,select} from '/ui/kit.js';
export async function mount(host,api){
 let doc=await api.call('studio.load'),etag=doc.etag,tab=tabs(doc)[0]?.id;
 let selected='',mode='edit',showGraphs=false;
 const head=h('div',host,{className:'mas-toolbar'}),nav=h('div',host,{className:'mas-tabs'});
 const main=h('div',host,{className:'mas-studio'}),area=h('section',main,{className:'mas-editor'});
 const side=h('aside',main,{className:'mas-inspector'}),note=h('p',host,{className:'mas-note'});
 const mark=()=>note.textContent='Несохранённые изменения';
 function inspect(){
  side.replaceChildren();h('h3',side,{text:'Свойства'});
  const node=doc.frontend.nodes.find(n=>n.id===selected);
  if(!node){h('p',side,{text:'Выбери элемент'});return;}
  h('small',side,{text:node.id});
  input(side,'Название',node.title,v=>{node.title=v;mark();render();});
  if(node.kind==='button'||node.kind==='connector'){
   const options=[{value:'',title:'Не подключено'},...backendActions(api).map(n=>({value:n.id,title:n.id}))];
   select(side,'Backend action',bound(doc,node.id),options,v=>{connect(doc,node.id,v);mark();render();});
  }
  if(node.kind!=='tab'){
   h('p',side,{text:'X '+node.x+' · Y '+node.y});
   button(side,'Удалить элемент',()=>{remove(doc,node.id);selected='';mark();render();},'mas-danger');
  }
 }
 function render(){
  head.replaceChildren();nav.replaceChildren();area.replaceChildren();
  h('h2',head,{text:'Graph Studio'});
  button(head,'+ Вкладка',()=>{
   const name=prompt('Название вкладки','Новая вкладка');
   if(name){tab=addTab(doc,name);selected='';mark();render();}
  });
  for(const kind of ['button','label','connector'])
   button(head,'+ '+({button:'Кнопка',label:'Текст',connector:'Коннектор'}[kind]),()=>{
    selected=addControl(doc,tab,kind,kind==='label'?'Надпись':kind==='button'?'Кнопка':'Коннектор');
    mark();render();
   });
  button(head,mode==='edit'?'Предпросмотр':'Редактировать',()=>{mode=mode==='edit'?'preview':'edit';render();});
  button(head,showGraphs?'Полотно':'Два графа',()=>{showGraphs=!showGraphs;render();});
  button(head,'Сохранить',async()=>{
   try{const saved=await api.call('studio.save',{frontend:doc.frontend,bridge:doc.bridge,etag});
    etag=saved.etag;note.textContent='Сохранено';}
   catch(e){note.textContent=e.message;}
  },'mas-primary');
  for(const t of tabs(doc)){
   const b=button(nav,t.title,()=>{tab=t.id;selected='';render();},'mas-tab');
   if(t.id===tab)b.classList.add('is-active');
  }
  if(showGraphs){showGraph(area,doc,api.graph());}
  else renderCanvas(area,doc,tab,api,mode,id=>{
   if(typeof id==='string'){selected=id;inspect();}
   else{note.textContent=id.error?'Ошибка: '+id.error:JSON.stringify(id.result).slice(0,400);}
  },()=>{mark();inspect();});
  inspect();
 }
 render();
 if(!api.graph().nodes.some(n=>n.id==='studio.save')){
  head.querySelectorAll('button').forEach(b=>{if(b.textContent!=='Два графа'&&b.textContent!=='Полотно')b.disabled=true;});
  note.textContent='Режим чтения';
 }
}
