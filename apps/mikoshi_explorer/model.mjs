// Bounded intrinsic curriculum over observed sound IDs; no language model.
// The planner suggests actions, never executes external capabilities.
const ID=/^m[0-9]{5,7}$/,MAX=12;
export function initialize(){return {schema:'mikoshi.explorer.v1',session:null};}
export function validate(s){
 if(!s||s.schema!=='mikoshi.explorer.v1')throw Error('invalid_explorer_state');
 const t=s.session;if(t===null)return;
 if(!t||typeof t.id!=='string'||!/^[0-9a-f-]{36}$/.test(t.id)||
  !['active','complete','stopped'].includes(t.status)||
  !Number.isInteger(t.budget)||t.budget<2||t.budget>MAX||
  !Number.isInteger(t.step)||t.step<0||t.step>t.budget||
  !Array.isArray(t.skills)||t.skills.length<2||t.skills.length>6||
  !Array.isArray(t.history)||t.history.length!==t.step||
  new Set(t.skills.map(x=>x.id)).size!==t.skills.length)
  throw Error('invalid_explorer_state');
 for(const x of t.skills)if(!x||!ID.test(x.id)||
  typeof x.inspected!=='boolean'||!Number.isInteger(x.attempts)||
  x.attempts<0||x.attempts>MAX||
  (x.loss!==null&&(!Number.isFinite(x.loss)||x.loss<0||x.loss>1)))
  throw Error('invalid_explorer_state');
 for(const h of t.history)if(!t.skills.some(x=>x.id===h.id)||
  !['inspect','practice'].includes(h.action)||
  !Number.isInteger(h.step)||h.step<0||h.step>=t.step||
  !Number.isFinite(h.loss)||h.loss<0||h.loss>1||
  !Number.isFinite(h.progress)||h.progress<0||h.progress>1)
  throw Error('invalid_explorer_state');
}
export function begin(state,ids,budget,sessionId){
 validate(state);
 if(state.session?.status==='active')throw Error('exploration_session_active');
 if(!Array.isArray(ids)||ids.length<2||ids.length>6||
  new Set(ids).size!==ids.length||!ids.every(x=>typeof x==='string'&&ID.test(x))||
  !Number.isInteger(budget)||budget<2||budget>MAX||
  typeof sessionId!=='string'||!/^[0-9a-f-]{36}$/.test(sessionId))
  throw Error('invalid_exploration_budget');
 const next={schema:'mikoshi.explorer.v1',session:{id:sessionId,status:'active',
  budget,step:0,skills:ids.map(id=>({id,inspected:false,attempts:0,loss:null})),
  history:[]}};
 return next;
}
export function propose(state){
 validate(state);
 const t=state.session;
 if(!t||t.status!=='active')return {ready:false,reason:'session_inactive'};
 if(t.step>=t.budget)return {ready:false,reason:'budget_exhausted'};
 const unknown=t.skills.filter(x=>!x.inspected);
 if(unknown.length){
  const target=unknown[0];
  return {ready:true,sessionId:t.id,step:t.step,id:target.id,
   action:'inspect',reason:'unmeasured_acoustic_error',remaining:t.budget-t.step};
 }
 const targets=t.skills.filter(x=>x.attempts<MAX&&x.loss>.012);
 if(!targets.length)return {ready:false,reason:'learning_goal_reached'};
 // Greedy learning potential with uncertainty bonus: changes with feedback.
 const score=x=>.6*x.loss+.28*Math.sqrt(Math.log(t.step+2)/(x.attempts+1));
 targets.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
 return {ready:true,sessionId:t.id,step:t.step,id:targets[0].id,
  action:'practice',reason:'learning_potential_and_uncertainty',
  remaining:t.budget-t.step};
}
export function observe(state,outcome){
 validate(state);
 const p=propose(state);
 if(!p.ready||!outcome||outcome.sessionId!==p.sessionId||
  outcome.step!==p.step||outcome.id!==p.id||outcome.action!==p.action)
  throw Error('stale_exploration_feedback');
 const loss=outcome.loss;
 if(!Number.isFinite(loss)||loss<0||loss>1)throw Error('invalid_exploration_loss');
 const next=structuredClone(state),t=next.session;
 const x=t.skills.find(x=>x.id===p.id),prior=x.loss;
 const progress=prior===null?0:Math.max(0,prior-loss);
 x.loss=prior===null?loss:Math.min(prior,loss);
 if(p.action==='inspect')x.inspected=true;
 else x.attempts++;
 t.history.push({step:p.step,id:p.id,action:p.action,
  loss:+loss.toFixed(8),progress:+progress.toFixed(8)});
 t.step++;
 if(t.step>=t.budget||t.skills.every(x=>x.inspected&&x.loss<=.012))
  t.status='complete';
 return {state:next,result:{step:t.step,action:p.action,id:p.id,
  progress:+progress.toFixed(8),bestLoss:x.loss,status:t.status,
  remaining:t.budget-t.step}};
}
export function stop(state,sessionId){
 validate(state);
 if(!state.session||state.session.id!==sessionId||
  state.session.status!=='active')throw Error('session_not_active');
 const next=structuredClone(state);next.session.status='stopped';return next;
}
export function status(state){
 validate(state);
 return {schema:'mikoshi.explorer.status.v1',session:state.session?
  {id:state.session.id,status:state.session.status,step:state.session.step,
   budget:state.session.budget,
   skills:state.session.skills.map(x=>({...x})),
   history:state.session.history.map(x=>({...x}))}:null};
}
