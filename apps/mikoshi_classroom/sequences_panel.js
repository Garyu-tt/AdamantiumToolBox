// Memory of manually demonstrated ID order; no automatic speech parsing.
export function sequencesPanel(host,api,provider,allowed){
 const a=provider?.skill?.actions;
 if(!a||!allowed.has(a.predict))return ()=>{};
 const add=(tag,text,parent=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 add('h3','Порядок услышанных звуков');
 add('p','Интервал выбирает преподаватель. Это не измерение ритма аудиозаписи.');
 const timing=add('select');
 for(const [name,ms] of [['Короткий промежуток',110],['Обычный',280],
  ['Длинный',600],['Новая фраза / пауза',1200]]){
  const opt=add('option',name,timing);opt.value=String(ms);
 }
 timing.value='280';
 const info=add('pre','Сначала узнайте или запомните звуки по порядку');
 const trace=[],maximum=24;
 const report=()=>{info.textContent='Цепочка: '+(trace.length?
  trace.map(e=>e.id+(e.gapMs>=900?' (пауза)':'')).join(' → '):'пусто');};
 const clear=add('button','Очистить учебную цепочку');
 clear.onclick=()=>{trace.length=0;report();};
 function context(){
  let seq=trace;
  for(let i=trace.length-1;i>=1;i--)if(trace[i].gapMs>=900){
   seq=trace.slice(i);break;
  }
  return seq.slice(-3).map((e,i)=>({id:e.id,gapMs:i?e.gapMs:0}));
 }
 const predict=add('button','Предсказать следующий звук');
 predict.onclick=async()=>{
  if(!trace.length){report();return;}
  try{const out=await api.call(a.predict,{context:context()});
   info.textContent=out.candidates.length?
    'Наиболее вероятные продолжения:\n'+out.candidates.map(v=>
     v.nextId+' ('+v.gapBand+', доля наблюдений '+v.share+')').join('\n'):
    'Такая цепочка ещё не встречалась';
  }catch(e){info.textContent=String(e.message);}
 };
 if(a.teach&&allowed.has(a.teach)){
  const teach=add('button','Запомнить последовательность');
  teach.onclick=async()=>{
   if(trace.length<2){info.textContent='Нужно минимум два звуковых образа';return;}
   try{const out=await api.call(a.teach,{events:trace,sourceApproved:true});
    info.textContent=out.updated?
     'Изучено переходов: '+(out.reinforced+out.discovered)+
     ' · новых сочетаний: '+out.discovered:
     'Нет двух звуков в одной фразе (пауза разделяет сочетания)';
   }catch(e){info.textContent=String(e.message);}
  };
 }
 return id=>{
  if(typeof id!=='string'||!/^m[0-9]{5,7}$/.test(id))return;
  if(trace.length===maximum){trace.shift();trace[0].gapMs=0;}
  trace.push({id,gapMs:trace.length?Number(timing.value):0});
  report();
 };
}
