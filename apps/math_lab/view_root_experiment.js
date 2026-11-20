/** Bounded exact RootTransform experiment form. */
export function mountRootExperiment({el,root,api,allowed,status}){
 const form=el('form',root);
 el('h3',form,'Эксперимент RootTransform');
 el('label',form,'Двоичный блок (hex, максимум 2048 байт)');
 const input=el('textarea',form);input.rows=4;input.placeholder='Введите hex-байты. Входной блок не сохраняется в Lab.';
 const controls=el('div',form);controls.className='math-lab-controls';
 const sample=el('button',controls,'Пример: 10^1000');
 sample.type='button';
 sample.onclick=()=>{
  let hex=(10n**1000n).toString(16);
  if(hex.length%2)hex='0'+hex;
  input.value=hex;
 };
 const degreeLabel=el('label',controls,'Проверяемые степени');
 const degree=el('input',degreeLabel);degree.value='2,3,4,8,16,1000';
 const modelLabel=el('label',controls,'Стоимость модели, байты');
 const modelCost=el('input',modelLabel);modelCost.type='number';modelCost.min='0';modelCost.max='1000000';modelCost.value='0';
 const button=el('button',form,'Запустить точный эксперимент');
 button.type='submit';
 const output=el('pre',root,'Нет результатов');
 const hasRun=allowed.has('math_lab.experiment');
 button.disabled=!hasRun;
 if(!hasRun)status.textContent='math_lab.experiment недоступен по разрешениям. Просмотр каталога не даёт права запуска.';
 else status.textContent='Тестовый режим, ограниченный CPU. Это не приёмка в production.';
 form.onsubmit=async event=>{
  event.preventDefault();
  if(!hasRun)return;
  button.disabled=true;status.textContent='Выполняется ограниченный математический тест…';
  try{
   const degrees=degree.value.split(',').map(s=>Number(s.trim()));
   if(!degrees.length||degrees.length>16||degrees.some(k=>!Number.isSafeInteger(k)||k<2)){
    throw Error('Укажите до 16 целых степеней, начиная со второй.');
   }
   const result=await api.call('math_lab.experiment',{
    datasetId:'interactive.lab',
    inputHex:input.value.trim().toLowerCase(),
    degrees,maxDepth:2,maxEvaluations:40,
    rootModelBytes:Number(modelCost.value),zlibModelBytes:0
   });
   const selected=(result.candidates||[]).find(c=>c.method===result.selected);
   output.textContent=JSON.stringify({
    digest:result.experimentDigest,
    originalBytes:result.originalBytes,
    entropyBitsPerByte:result.entropyBitsPerByte,
    method:result.selected,totalBytes:result.selectedTotalBytes,
    savingsBytes:result.savingsBytes,
    candidates:result.candidates,
    evaluations:result.search?.evaluated,
    exactRoundtrip:result.verification?.exactRootRoundtrip,
    independentAudit:result.verification?.independentAudit
   },null,2);
   status.textContent='Эксперимент завершён. Декодер проверен, независимая QA ещё не проведена.';
  }catch(error){
   status.textContent='Исследование не выполнено: '+String(error.message).slice(0,180);
  }finally{button.disabled=false;}
 };

 return {input,dispose:()=>{form.onsubmit=null;sample.onclick=null;}};
}
