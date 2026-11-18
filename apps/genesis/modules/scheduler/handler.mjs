import {step} from '../../brain.mjs';
let timer=null,busy=false;
export function start(store){
 if(timer)return;
 timer=setInterval(async()=>{
  if(busy)return;busy=true;
  try{
   for(const item of await store.list()){
    try{
     if(!(await store.load(item.id)).schedule?.enabled)continue;
     await store.change(item.id,b=>{
      if(!b.schedule?.enabled)return null;
      return step(b,{steps:b.schedule.steps_per_tick,stimulus:b.schedule.stimulus});
     });
    }catch(e){console.error('genesis_brain_tick_failed',item.id,String(e.message).slice(0,80));}
   }
  }catch(e){console.error('genesis_scheduler_failed',String(e.message).slice(0,80));}
  finally{busy=false;}
 },1000);
 timer.unref();
}
export async function invoke(action,p,store){
 if(action==='genesis.brains.autostep'){
  const count=p.steps_per_tick??1,stimulus=p.stimulus??0;
  if(!Number.isSafeInteger(count)||count<1||count>20||
     !Number.isFinite(stimulus)||stimulus<-1||stimulus>1)throw Error('invalid_clock_policy');
  return store.change(p.id,b=>{
   b.schedule={enabled:true,steps_per_tick:count,stimulus};
   b.revision++;return {id:b.id,schedule:b.schedule,ticks:b.ticks};
  });
 }
 if(action==='genesis.brains.pause')return store.change(p.id,b=>{
  b.schedule={...b.schedule,enabled:false};b.revision++;
  return {id:b.id,schedule:b.schedule,ticks:b.ticks};
 });
 throw Error('action_not_found');
}
