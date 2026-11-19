import {inspectAV} from './av_commit.js';
import {inspectRecovery,resumeMissingLinks} from './av_recovery.js';
// UI owns only deliberate actions. Ambiguous writes are never auto-retried.
export function recoveryControls(host,api,actions,canTeach,canReconcile,
 snapshot,setBusy,erase){
 if(!canTeach)return;
 const add=(caption)=>{const button=document.createElement('button');
  button.textContent=caption;host.append(button);return button;};
 const recover=add('Проверить сохранённые пары');
 recover.onclick=async()=>{
  const {pending,busy}=snapshot();if(busy)return;
  if(!pending){return;}
  try{
   if(canReconcile){
    const {assessment}=await inspectRecovery(
     api,actions,pending.permit,pending.count);
    const lines=assessment.rows.map(row=>
     'Пара '+(row.pairIndex+1)+': '+row.state+' / '+row.advice);
    snapshot().info.textContent=lines.join('\n');
   }else{
    const rows=await inspectAV(api,actions,pending.permit,pending.count);
    snapshot().info.textContent=rows.map(row=>
     'Пара '+(row.pairIndex+1)+': слух '+row.motif+
     ', связь '+row.grounding).join('\n');
   }
  }catch(e){snapshot().info.textContent=String(e.message);}
 };
 if(!canReconcile)return;
 const repair=add('Восстановить подтверждённые связи');
 repair.onclick=async()=>{
  const {pending,lesson,busy,checked,info}=snapshot();
  if(busy)return;
  if(!checked.checked){info.textContent='Нужно отдельное согласие';return;}
  if(!pending||!lesson){info.textContent='Нет данных для восстановления';return;}
  setBusy(true);repair.disabled=true;checked.checked=false;
  try{
   const result=await resumeMissingLinks(api,actions,lesson,pending.permit);
   info.textContent='Восстановлено связей: '+result.resumed+
    '. Завершено: '+(result.completed?'да':'нет');
   if(result.completed)erase();
  }catch(e){info.textContent='Не удалось восстановить: '+String(e.message);}
  finally{setBusy(false);repair.disabled=false;}
 };
}
