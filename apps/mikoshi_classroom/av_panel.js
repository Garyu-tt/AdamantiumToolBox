// Optional synthetic cross-modal laboratory. No camera or autonomous learning.
export function avPanel(host,api,vision,grounding,memory,articulation,allowed){
 const v=vision?.skill?.actions,g=grounding?.skill?.actions;
 const m=memory?.skill?.actions,a=articulation?.skill?.actions;
 if(!v?.analyze||!g?.associate||!m?.remember||!a?.preview||
  ![v.analyze,g.associate,m.remember,a.preview].every(x=>allowed.has(x)))return;
 const add=(tag,t,parent=host)=>{const e=document.createElement(tag);
  if(t!==undefined)e.textContent=t;parent.append(e);return e;};
 add('h3','Зрение и слух — учебные совпадения');
 add('p','Синтетические цвета и звуки; связи не означают понимания предметов.');
 const status=add('pre','Создайте контрольную сцену без записи в память');
 const approval=add('label','Разрешаю записать две контрольные пары');
 const checkbox=add('input',undefined,approval);checkbox.type='checkbox';
 const blank=Array(192).fill(0),paint=color=>{
  const p=[...blank];
  for(let y=2;y<5;y++)for(let x=2;x<5;x++)p[(y*8+x)*3+color]=1;
  return p;
 };
 let lesson=null,busy=false;
 const preview=add('button','Показать два события без обучения');
 preview.onclick=async()=>{
  if(busy)return;busy=true;preview.disabled=true;lesson=null;
  try{
   const frames=[{timeMs:0,pixels:blank},{timeMs:200,pixels:paint(0)},
    {timeMs:400,pixels:blank},{timeMs:600,pixels:paint(2)}];
   const visual=await api.call(v.analyze,{frames});
   const events=visual.events.filter(e=>e.kind==='appear');
   if(events.length!==2)throw Error('visual_demo_unavailable');
   const sound1=await api.call(a.preview,{motor:{f1:810,f2:1290}});
   const sound2=await api.call(a.preview,{motor:{f1:300,f2:2450}});
   lesson=events.map((e,i)=>({event:e,
    samples:(i===0?sound1:sound2).samples}));
   status.textContent='Визуальных событий: '+visual.detected+
    '\nСлуховых образцов: 2. Синхронизация задана демонстрацией.'+
    '\nПамять не изменена.';
  }catch(e){status.textContent=String(e.message);}
  finally{busy=false;preview.disabled=false;}
 };
 if(g.teach&&allowed.has(g.teach)){
  const teach=add('button','Связать события со звуками');
  teach.onclick=async()=>{
   if(busy)return;
   if(!checkbox.checked){status.textContent='Нужно разрешение на обучение';return;}
   if(!lesson){status.textContent='Сначала создайте контрольную сцену';return;}
   busy=true;teach.disabled=true;checkbox.checked=false;let complete=0;
   try{
    const reports=[];
    for(const {event,samples} of lesson){
     const sound=await api.call(m.remember,{samples,sampleRate:12000,
      sourceApproved:true});
     const paired=await api.call(g.teach,{visualVector:event.vector,
      visualAtMs:event.timeMs,soundAtMs:event.timeMs,
      soundId:sound.id,sourceApproved:true});
     reports.push(paired);complete++;
    }
    status.textContent='Связано: '+complete+'\n'+reports.map(x=>
     x.visualId+' ↔ '+x.soundId+' (наблюдений '+x.support+')').join('\n');
   }catch(e){status.textContent='Частично сохранено: '+complete+
    '. Проверьте состояние перед повтором. '+String(e.message);}
   finally{busy=false;teach.disabled=false;}
  };
 }
 const check=add('button','Проверить визуально-слуховые ассоциации');
 check.onclick=async()=>{
  if(!lesson){status.textContent='Сначала создайте контрольную сцену';return;}
  try{
   const results=[];
   for(const {event} of lesson){
    const r=await api.call(g.associate,{visualVector:event.vector});
    results.push(r.ready?r.candidates[0].soundId:
     'Неопределённо ('+r.reason+')');
   }
   status.textContent='Событие 1: '+results[0]+'\nСобытие 2: '+results[1];
  }catch(e){status.textContent=String(e.message);}
 };
}
