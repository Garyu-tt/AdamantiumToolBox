export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 add('h2','Рабочие файлы');const bar=add('div',undefined);bar.className='editor-bar';
 const refresh=add('button','Обновить',bar),create=add('button','Новый файл',bar);
 const path=add('small','',host),files=add('div',undefined,host),input=add('textarea',undefined,host);
 files.className='file-list';input.className='source';input.spellcheck=false;
 const save=add('button','Сохранить',host),msg=add('p','',host);
 let active='',etag='';
 async function list(){
  files.replaceChildren();const rows=await api.call('editor.list',{path:'.'});
  for(const f of rows){if(f.type!=='file')continue;const b=add('button',f.name,files);b.onclick=()=>open(f.name);}
 }
 async function open(name){
  try{const r=await api.call('editor.read',{path:name});active=name;etag=r.etag;
   path.textContent=name;input.value=r.content;msg.textContent='';}catch(e){msg.textContent=e.message;}
 }
 create.onclick=()=>{const n=prompt('Имя файла (в рабочей папке):');if(n){active=n;etag='';path.textContent=n;input.value='';msg.textContent='';}};
 refresh.onclick=()=>list().catch(e=>msg.textContent=e.message);
 save.onclick=async()=>{
  if(!active)return msg.textContent='Сначала выбери файл';
  if(!api.graph().nodes.some(n=>n.id==='editor.save'))return msg.textContent='Нет разрешения на запись';
  try{const r=await api.call('editor.save',{path:active,content:input.value,etag});etag=r.etag;msg.textContent='Сохранено';await list();}
  catch(e){msg.textContent=e.message;}
 };
 if(!api.graph().nodes.some(n=>n.id==='editor.save')){save.remove();create.remove();input.readOnly=true;}
 await list().catch(e=>msg.textContent=e.message);
}
