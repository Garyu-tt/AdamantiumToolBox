import {cdp} from './cdp.mjs';
export async function history(session,id,step){
 if(step!==1&&step!==-1)throw Error('invalid_history_step');
 const tab=await session.target(id),ws=tab.webSocketDebuggerUrl;
 const log=await cdp(ws,'Page.getNavigationHistory');
 const target=log.entries?.[log.currentIndex+step];
 if(!target)return {moved:false};
 await cdp(ws,'Page.navigateToHistoryEntry',{entryId:target.id});
 return {moved:true,url:target.url};
}
export async function reload(session,id){
 const tab=await session.target(id);
 await cdp(tab.webSocketDebuggerUrl,'Page.reload',{ignoreCache:false});
 return {reloaded:true};
}
export async function closeTab(session,id){
 await session.target(id);
 const res=await fetch(session.endpoint('/json/close/'+encodeURIComponent(id)),
  {signal:AbortSignal.timeout(4000)});
 if(!res.ok)throw Error('tab_close_failed');
 session.tabs.delete(id);return {closed:id};
}
