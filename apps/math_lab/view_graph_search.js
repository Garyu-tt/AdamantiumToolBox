/** Bounded R02 reversible transformation search UI. */
export function mountGraphSearch({el,root,api,allowed,status,input}){
 const graphForm=el('form',root);
 el('h3',graphForm,'Граф обратимых преобразований R02');
 el('p',graphForm,'Сравнение целого закодированного потока с исходными байтами, zlib и корнями. Результат не является независимой приёмкой.');
 const graphLabel=el('label',graphForm,'Байтовый блок (hex)');
 const graphInput=el('textarea',graphLabel);
 graphInput.rows=4;graphInput.maxLength=4096;
 graphInput.placeholder='Hex до 2048 байт';
 const graphActions=el('div',graphForm);graphActions.className='math-lab-controls';
 const useRootSample=el('button',graphActions,'Копировать пример из RootTransform');
 useRootSample.type='button';useRootSample.onclick=()=>{graphInput.value=input.value;};
 const graphButton=el('button',graphActions,'Исследовать цепочки преобразований');
 graphButton.type='submit';graphButton.disabled=!allowed.has('math_lab.search');
 const graphOutput=el('pre',root,'Нет результата поиска графа');
 graphForm.onsubmit=async event=>{
  event.preventDefault();
  if(!allowed.has('math_lab.search'))return;
  graphButton.disabled=true;
  try{
   const report=await api.call('math_lab.search',{
    datasetId:'interactive.graph',
    inputHex:graphInput.value.trim().toLowerCase(),
    maxDepth:2,maxStates:16,maxRootCalls:4,maxRootEvaluations:8
   });
   graphOutput.textContent=JSON.stringify({
    baseline:report.report?.candidates,
    selected:report.report?.selectedMethod,
    totalBytes:report.report?.selectedTotalBytes,
    savedBytes:report.report?.savingsBytes,
    selectedPath:report.report?.chosenSteps,
    states:report.report?.visitedStates,
    evaluatedEdges:report.report?.attemptedEdges,
    exactReferenceReproduction:report.referenceReproduction?.exactByteEquality??null,
    independentAgentReviewed:report.independentAgentReviewed,
    independentQACompleted:report.independentQACompleted
   },null,2);
   status.textContent='Поиск графа завершён. Отдельная организационная QA ещё не проводилась.';
  }catch(err){
   graphOutput.textContent='Ошибка поиска: '+String(err.message).slice(0,180);
  }finally{graphButton.disabled=false;}
 };

 return {graphInput,dispose:()=>{graphForm.onsubmit=null;useRootSample.onclick=null;}};
}
