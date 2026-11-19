// Align numerical event timestamps only; no raw media, word labels or IDs.
const LIMIT=12,WINDOW=250;
function check(data,kind){
 if(!Array.isArray(data)||data.length>LIMIT)return false;
 let previous=-1;
 for(const e of data){
  if(!e||!Number.isInteger(e.timeMs)||e.timeMs<0||
   e.timeMs>4000||e.timeMs<=previous)return false;
  if(kind==='visual'&&!['appear','disappear','change'].includes(e.kind))
   return false;
  previous=e.timeMs;
 }
 return true;
}
export function align(visual,audio,uncertaintyMs){
 if(!check(visual,'visual')||!check(audio,'audio')||
  !Number.isInteger(uncertaintyMs)||uncertaintyMs<0||
  uncertaintyMs>250)throw Error('invalid_av_timeline');
 const candidates=[],ambiguous=[];
 const eligible=visual.flatMap((v,vi)=>v.kind==='appear'?[{v,vi}]:[]);
 for(const {v,vi} of eligible){
  const near=audio.map((a,ai)=>({ai,delta:Math.abs(v.timeMs-a.timeMs)}))
   .filter(p=>p.delta+uncertaintyMs<=WINDOW)
   .sort((a,b)=>a.delta-b.delta||a.ai-b.ai);
  if(near.length!==1){
   ambiguous.push({visualIndex:vi,reason:near.length?
    'ambiguous_audio_nearby':'no_audio_within_window'});continue;
  }
  candidates.push({visualIndex:vi,audioIndex:near[0].ai,
   deltaMs:near[0].delta});
 }
 const counts=new Map();
 for(const p of candidates)counts.set(p.audioIndex,(counts.get(p.audioIndex)||0)+1);
 const matches=[];
 for(const p of candidates){
  if(counts.get(p.audioIndex)>1){
   ambiguous.push({visualIndex:p.visualIndex,reason:'audio_shared_by_events'});
   continue;
  }
  matches.push({visualIndex:p.visualIndex,audioIndex:p.audioIndex,
   visualAtMs:visual[p.visualIndex].timeMs,
   soundAtMs:audio[p.audioIndex].timeMs,
   deltaMs:p.deltaMs});
 }
 return {schema:'mikoshi.avsync.alignment.v1',matches,
  unpaired:ambiguous,considered:eligible.length,uncertaintyMs,
  timeModel:'approximate_session_relative',certified:false,
  automaticLearning:false};
}
