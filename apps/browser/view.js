export async function mount(host,api){
 const e=(tag,text,parent=host)=>{const n=document.createElement(tag);
  if(text!==undefined)n.textContent=text;parent.append(n);return n;};
 const root=e('section');root.className='browser-app';
 const toolbar=e('div',undefined,root);toolbar.className='mas-toolbar';
 const back=e('button','◀',toolbar),forward=e('button','▶',toolbar);
 const reload=e('button','⟳',toolbar);
 const addr=e('input',undefined,toolbar);addr.type='url';addr.placeholder='Введите URL' ;
 addr.className='browser-address';addr.setAttribute('aria-label','Адрес страницы');
 const go=e('button','Перейти',toolbar),refresh=e('button','Обновить вид',toolbar);
 const tabbar=e('div',undefined,root);tabbar.className='mas-toolbar';
 const tabs=e('select',undefined,tabbar);tabs.setAttribute('aria-label','Вкладки');
 const add=e('button','Новая вкладка',tabbar);
 const close=e('button','Закрыть вкладку',tabbar),stop=e('button','Закрыть сессию',tabbar);
 const viewport=e('div',undefined,root);viewport.className='browser-preview';
 const img=e('img',undefined,viewport);img.alt='Просмотр страницы Chromium';
 const controls=e('div',undefined,root);controls.className='mas-toolbar';
 const text=e('input',undefined,controls);text.type='text';text.placeholder='Текст в выбранное поле';
 const type=e('button','Ввести',controls),status=e('small','Браузер готов',root);
 let active='',busy=false;
 const allowed=name=>api.graph().nodes.some(n=>n.id==='browser.'+name);
 async function list(){
  const pages=await api.call('browser.tabs');tabs.replaceChildren();
  for(const page of pages){
   const option=e('option',page.title||page.url,tabs);option.value=page.id;
  }
  if(!active&&pages.length)active=pages[0].id;
  if(active)tabs.value=active;
  return pages;
 }
 async function snap(){
  if(!active||busy||!allowed('screenshot'))return;
  busy=true;try{
   const shot=await api.call('browser.screenshot',{id:active});
   img.src=shot.src;img.dataset.width=shot.viewport.width;
   img.dataset.height=shot.viewport.height;
   status.textContent='Подключено: '+active.slice(0,10);
  }catch(error){status.textContent=error.message;}
  finally{busy=false;}
 }
 async function open(){
  if(!allowed('open'))return;
  const url=addr.value.trim();if(!url)return;
  try{const tab=await api.call('browser.open',{url});active=tab.id;
   await list();await snap();}catch(error){status.textContent=error.message;}
 }
 async function navigate(){
  if(!active)return open();
  if(!allowed('navigate'))return;
  try{await api.call('browser.navigate',{id:active,url:addr.value.trim()});
   await snap();}catch(error){status.textContent=error.message;}
 }
 go.onclick=navigate;addr.onkeydown=ev=>{if(ev.key==='Enter')navigate();};
 add.onclick=()=>{active='';open();};refresh.onclick=snap;
 tabs.onchange=async()=>{active=tabs.value;
  const page=(await list()).find(x=>x.id===active);if(page)addr.value=page.url;
  await snap();};
 async function travel(name){
  if(!active||!allowed(name))return;
  try{const r=await api.call('browser.'+name,{id:active});
   if(r.url)addr.value=r.url;
   await snap();}catch(error){status.textContent=error.message;}
 }
 back.onclick=()=>travel('back');forward.onclick=()=>travel('forward');
 reload.onclick=()=>travel('reload');
 close.onclick=async()=>{
  if(!active||!allowed('closeTab'))return;
  try{await api.call('browser.closeTab',{id:active});active='';
   const pages=await list();if(pages.length){active=pages[0].id;
    addr.value=pages[0].url;await snap();}
   else img.removeAttribute('src');}
  catch(error){status.textContent=error.message;}
 };
 stop.onclick=async()=>{if(!allowed('stop'))return;
  try{const result=await api.call('browser.stop');active='';tabs.replaceChildren();
   img.removeAttribute('src');status.textContent=result.profileRetained?'Сессия закрыта, входы сохранены':'Сессия закрыта';}
  catch(error){status.textContent=error.message;} };
 img.onclick=async ev=>{
  if(!active||!allowed('click'))return;
  const rect=img.getBoundingClientRect();
  const x=Math.floor((ev.clientX-rect.left)*Number(img.dataset.width)/rect.width);
  const y=Math.floor((ev.clientY-rect.top)*Number(img.dataset.height)/rect.height);
  try{await api.call('browser.click',{id:active,x,y});await snap();}
  catch(error){status.textContent=error.message;}
 };
 type.onclick=async()=>{
  if(!active||!allowed('type'))return;
  try{await api.call('browser.type',{id:active,text:text.value});await snap();}
  catch(error){status.textContent=error.message;}
 };
 if(!allowed('open')){go.disabled=true;add.disabled=true;addr.readOnly=true;
  stop.disabled=true;back.disabled=true;forward.disabled=true;reload.disabled=true;close.disabled=true;}
 if(!allowed('click'))img.style.cursor='default';
 if(!allowed('type')){type.disabled=true;text.disabled=true;}
 const link=e('link');link.rel='stylesheet';link.href='/apps/browser/style.css';
 await list().catch(error=>status.textContent=error.message);
 const provider=await api.call('browser.provider').catch(()=>({mode:'local'}));
 status.textContent=provider.mode==='relay'?'Браузер на другой ноде':'Локальный профиль браузера';
 const settings=await api.call('browser.settings').catch(()=>({previewRefreshMs:5000}));
 const timer=setInterval(()=>{if(!host.isConnected)return clearInterval(timer);
  if(document.visibilityState==='visible'&&active)snap();},settings.previewRefreshMs);
}
