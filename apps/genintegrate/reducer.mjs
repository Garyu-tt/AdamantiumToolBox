import {emptyContext,validateNormalized,validateContext,cursorKey,eventId} from './contract.mjs';
import {summarize} from './metrics.mjs';
export function integrate({context=null,event,maxSources=32,maxRecent=32}={}){
 if(!Number.isSafeInteger(maxSources)||maxSources<1||maxSources>64||
    !Number.isSafeInteger(maxRecent)||maxRecent<1||maxRecent>64)throw Error('invalid_limits');
 validateNormalized(event);
 const state=context===null?emptyContext():context;
 validateContext(state,{maxSources,maxRecent});
 const key=cursorKey(event.source,event.kind),id=eventId(event);
 const previous=state.cursors.find(c=>cursorKey(c.source,c.kind)===key);
 if(previous&&event.sequence<previous.sequence)throw Error('sequence_regression');
 if(previous&&event.sequence===previous.sequence){
  if(previous.payloadSha256!==event.payloadSha256)throw Error('sequence_conflict');
  return {schema:'genesis.sensory.integration.v1',status:'duplicate',eventId:id,
    context:structuredClone(state),summary:summarize(state.recent,event.source,event.kind)};
 }
 if(previous&&event.sequence!==previous.sequence+1)throw Error('sequence_gap');
 if(!previous&&state.cursors.length>=maxSources)throw Error('source_limit');
 if(state.count===Number.MAX_SAFE_INTEGER)throw Error('event_counter_overflow');
 const cursors=state.cursors.filter(c=>cursorKey(c.source,c.kind)!==key);
 cursors.push({source:event.source,kind:event.kind,sequence:event.sequence,
  payloadSha256:event.payloadSha256,eventId:id});
 const recent=[...state.recent,structuredClone(event)].slice(-maxRecent);
 const next={schema:state.schema,count:state.count+1,cursors,recent};
 validateContext(next,{maxSources,maxRecent});
 return {schema:'genesis.sensory.integration.v1',status:'integrated',eventId:id,
  context:next,summary:summarize(recent,event.source,event.kind)};
}
