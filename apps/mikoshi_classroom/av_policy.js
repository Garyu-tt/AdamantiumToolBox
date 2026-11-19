// Opt-in composed-source gate; signed tokens are operator CLAIMS, not consent proof.
export const PURPOSE='audiovisual-association-training';
export async function digestLesson(lesson){
 if(!Array.isArray(lesson)||lesson.length<1||lesson.length>12||
  !globalThis.crypto?.subtle)throw Error('source_digest_unavailable');
 const serialized=lesson.map(e=>({
  vector:e.visual?.vector,timeMs:e.pair?.visualAtMs,
  sampleTimeMs:e.pair?.soundAtMs,samples:e.audio?.samples}));
 const bytes=new TextEncoder().encode(JSON.stringify(serialized));
 if(bytes.length>650000)throw Error('source_lesson_too_large');
 const result=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(result)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function hashFields(value){
 if(!globalThis.crypto?.subtle)throw Error('source_digest_unavailable');
 const data=new TextEncoder().encode(JSON.stringify(value));
 const bytes=await crypto.subtle.digest('SHA-256',data);
 return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export async function pairBindings(lesson){
 if(!Array.isArray(lesson)||lesson.length<1||lesson.length>12)
  throw Error('invalid_source_pairs');
 return Promise.all(lesson.map(async item=>({
  audioHash:await hashFields({samples:item.audio?.samples,sampleRate:12000}),
  visualHash:await hashFields({visualVector:item.visual?.vector,
   visualAtMs:item.pair?.visualAtMs,soundAtMs:item.pair?.soundAtMs})
 })));
}
export async function permitLesson(api,actions,lesson,durationMs){
 if(typeof actions?.authorize!=='string'||typeof actions?.verify!=='string')
  throw Error('source_policy_missing');
 if(!Number.isInteger(durationMs)||durationMs<400||durationMs>2500)
  throw Error('source_duration_invalid');
 const digest=await digestLesson(lesson);
 const claim={sourceKind:'user-live-av',captureMethod:'explicit-gesture',
  purpose:PURPOSE,captureConsent:true,subjectsConsentConfirmed:true,
  noThirdPartyMedia:true,rawRetention:false,
  sessionDurationMs:durationMs,pairs:lesson.length,digest,
  pairBindings:await pairBindings(lesson)};
 const issued=await api.call(actions.authorize,{claim});
 if(!issued?.token)throw Error('source_policy_denied');
 const permit={digest,token:issued.token,pairs:lesson.length,
  expiresAt:issued.expiresAt};
 await verifyLesson(api,actions,lesson,permit);
 return permit;
}
export async function verifyLesson(api,actions,lesson,permit){
 const actual=await digestLesson(lesson);
 if(actual!==permit?.digest)throw Error('lesson_changed_since_approval');
 const result=await api.call(actions.verify,{token:permit.token,
  digest:actual,purpose:PURPOSE});
 if(!result?.allowed||result.pairs!==lesson.length||
  result.permitVersion!==2)
  throw Error('source_policy_denied');
 return result;
}
