const stable=(v)=>JSON.stringify(v);
const group=(records,get)=>{
 const result=new Map();for(const r of records){
  const values=get(r);for(const v of values){
   if(!result.has(v))result.set(v,[]);result.get(v).push(r);
  }
 }return result;
};
export function reconcile(records,prior=[],observations=null,previousObservations=null,at=null,maxAge=null){
 const conflicts=[],changes=[];
 const clashes=(groups,type,filter)=>{
  for(const [key,items] of groups){
   if(items.length>1&&(!filter||filter(items))){
    conflicts.push({type,key,records:items.map(x=>({uid:x.uid,path:x.manifest.path,
     sha256:x.manifest.sha256})).sort((a,b)=>a.path.localeCompare(b.path))});
   }
  }
 };
 clashes(group(records,r=>[r.uid]),'duplicate_uid');
 clashes(group(records,r=>r.declared.capabilities),'capability_claim_overlap',
  arr=>new Set(arr.map(x=>x.uid)).size>1);
 clashes(group(records,r=>r.declared.port===null?[]:[r.declared.port]),'service_port_collision',
  arr=>new Set(arr.map(x=>x.uid)).size>1);
 const current=group(records,r=>[r.uid]);
 const old=group(prior.filter(x=>x?.uid),r=>[r.uid]);
 for(const [uid,items] of current){
  if(!old.has(uid))changes.push({uid,type:'new_in_source',current:items.map(x=>x.manifest)});
  else if(stable(items.map(x=>x.manifest.sha256))!==stable(old.get(uid).map(x=>x.manifest?.sha256||x.manifest_sha))){
   changes.push({uid,type:'source_changed',current:items.map(x=>x.manifest),previous:old.get(uid).map(x=>x.manifest||x.source_ref)});
  }
 }
 for(const [uid,items] of old){
  if(!current.has(uid))changes.push({uid,type:'absent_from_scanned_source',previous:items.map(x=>x.manifest||x.source_ref),
   runtime_state:'unknown'});
 }
 const runtime=[];
 if(observations){
  const oldMap=new Map((previousObservations?.apps||[]).map(x=>[x.uid,x]));
  for(const obs of observations.apps||[]){
   const older=oldMap.get(obs.uid);
   if(older&&(older.state!==obs.state||stable(older.capabilities||[])!==stable(obs.capabilities||[]))){
    changes.push({uid:obs.uid,type:'reported_runtime_signal_changed',from:older.state,to:obs.state});
   }
   const age=Date.parse(at)-Date.parse(observations.observed_at||'');
   const freshness=!(maxAge>=0)||!Number.isFinite(age)?'unassessed':
    age<0?'future_dated':age>maxAge?'stale':'within_window';
   runtime.push({uid:obs.uid||null,reported_state:obs.state||'unknown',
    reported_capabilities:obs.capabilities||[],node:obs.node||null,
    observed_at:observations.observed_at||null,
    provenance:observations.source||null,freshness,verified_by_registry:false});
  }
 }
 conflicts.sort((a,b)=>a.type.localeCompare(b.type)||String(a.key).localeCompare(String(b.key)));
 changes.sort((a,b)=>a.uid.localeCompare(b.uid)||a.type.localeCompare(b.type));
 return {conflicts,changes,reported_runtime:runtime};
}