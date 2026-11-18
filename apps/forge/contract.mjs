const name=/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/;
const version=/^\d+\.\d+\.\d+$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fault=(code,path,reason,remedies)=>({code,path,reason,
 evidence:{path,check:code},impact:'Function cannot be verified or published',
 remedies:remedies.map(action=>({action,safety:'manual-input'}))});
export function validateFunction(node){
 const errors=[];
 const add=(...args)=>errors.push(fault(...args));
 if(!object(node))return {ok:false,errors:[fault('INVALID_NODE','$','Object required',['send-object'])],
 checks:[{name:'shape',passed:false}]};
 if(node.schema!=='forge.function.v1')add('INVALID_SCHEMA','schema','Expected forge.function.v1',['select-supported-schema']);
 if(typeof node.id!=='string'||!name.test(node.id))add('INVALID_ID','id','Namespaced stable id required',['repair-id']);
 if(typeof node.version!=='string'||!version.test(node.version))add('INVALID_VERSION','version','Semver required',['set-semver']);
 if(!object(node.request)||node.request.atomic!==true||
    typeof node.request.goal!=='string'||!node.request.goal.trim())
   add('NOT_ATOMIC','request','One clear atomic function goal required',['split-function']);
 if(!Array.isArray(node.request?.acceptance)||!node.request.acceptance.length||
    !node.request.acceptance.every(x=>typeof x==='string'&&x.trim()))
   add('NO_ACCEPTANCE','request.acceptance','Explicit acceptance checks required',['define-tests']);
 if(!object(node.capability)||typeof node.capability.action!=='string'||
    !name.test(node.capability.action)||!object(node.capability.input_schema)||
    !object(node.capability.output_schema))
   add('BAD_CAPABILITY','capability','One typed action with input/output schemas required',['define-contract']);
 if(node.dependencies!==undefined&&(!Array.isArray(node.dependencies)||
    node.dependencies.some(x=>!object(x)||typeof x.capability!=='string'||!name.test(x.capability))))
   add('BAD_DEPENDENCIES','dependencies','Use typed capability references',['repair-references']);
 if(object(node.ui)&&node.ui.expose===true&&
    (!['action','view','field'].includes(node.ui.role)||typeof node.ui.label!=='string'||!node.ui.label.trim()))
   add('BAD_UI','ui','Visible UI needs a role and label',['define-ui-contribution']);
 if(node.ui!==undefined&&!object(node.ui))add('BAD_UI','ui','UI contribution must be object',['repair-ui']);
 const seen=new Set();
 for(const dep of Array.isArray(node.dependencies)?node.dependencies:[]){
  if(!object(dep)||typeof dep.capability!=='string')continue;
  if(seen.has(dep.capability)||dep.capability===node.capability?.action)
   add('DEPENDENCY_CONFLICT','dependencies','Duplicate or direct self dependency',['remove-conflict']);
  seen.add(dep.capability);
 }
 return {ok:errors.length===0,errors,
 checks:[{name:'function_contract',passed:errors.length===0}]};
}
export function prepareInvocation(params){
 const checked=validateFunction(params?.function);
 if(!checked.ok)return checked;
 const requestId=params.request_id;
 if(typeof requestId!=='string'||requestId.length<8||requestId.length>128)
  return {ok:false,errors:[fault('BAD_REQUEST_ID','request_id','Stable request id required',['set-request-id'])]};
 if(!object(params.arguments))
  return {ok:false,errors:[fault('BAD_ARGUMENTS','arguments','Typed object required',['repair-arguments'])]};
 return {ok:true,executed:false,provider_bound:false,
 envelope:{schema:'forge.invoke.request.v1',request_id:requestId,
 target:{action:params.function.capability.action,version:params.function.version},
 arguments:params.arguments,expected_revision:params.expected_revision??null,
 validation_level:'structural-only',publish_policy:'verified-provider-only'}};
}
