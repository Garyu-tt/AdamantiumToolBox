/** Proposed scientific DAG UI; no task submission. */
export function mountResearchPlan({el,root,api,allowed}){
 const planning=el('details',root);
 el('summary',planning,'Научный граф исследования');
 const planForm=el('form',planning);
 const researchIdLabel=el('label',planForm,'Идентификатор гипотезы');
 const researchId=el('input',researchIdLabel);researchId.value='roots001';
 const claimLabel=el('label',planForm,'Проверяемая гипотеза');
 const claim=el('input',claimLabel);claim.value='Входные блоки с точными степенями могут иметь короткие обратимые описания';
 const planButton=el('button',planForm,'Сформировать научный DAG');
 planButton.type='submit';
 planButton.disabled=!allowed.has('math_lab.plan');
 const planOutput=el('pre',planning,'Нет предложенного плана');
 planForm.onsubmit=async event=>{
  event.preventDefault();
  if(!allowed.has('math_lab.plan'))return;
  planButton.disabled=true;
  try{
   const result=await api.call('math_lab.plan',{
    schema:'mechanicus.math-hypothesis/1',
    id:researchId.value.trim().toLowerCase(),
    title:'Исследование точного сжатия корнями',
    target:'compression',discipline:'number-theory',
    method:'root-transform',
    datasetId:'unassigned.demo',
    claim:claim.value.trim(),
    sourceRefs:[]
   });
   planOutput.textContent=JSON.stringify({
    planId:result.planId,sha256:result.digest,
    status:result.proposedOnly?'proposed':'unknown',
    independentQACompleted:result.independentQACompleted,
    nodes:result.nodes.map(n=>({
     id:n.id,role:n.role,phase:n.phase,
     predecessors:n.dependsOn,
     needsEvidence:n.evidenceRequired,
     requiresApproval:n.requiresOperatorApproval===true
    }))
   },null,2);
  }catch(error){planOutput.textContent='План отклонён: '+String(error.message).slice(0,180);}
  finally{planButton.disabled=false;}
 };
 return {dispose:()=>{planForm.onsubmit=null;}};
}
