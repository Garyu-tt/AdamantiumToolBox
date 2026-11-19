// Pure R08 contract primitives; no entitlement or identity authority.
export {obj,tok,ref} from './reactive-common.mjs';
import {problem,reject,intent} from './reactive-common.mjs';
export const issue=(code,path,reason,remedy)=>problem(code,reason,path,
 'A personalized UI projection must not be trusted or invoked without host readback',remedy);
export const fail=issues=>({...reject(issues),projection_applied:false,
 reconnected:false,principal_authenticated:false});
export const step=(operation,port,context)=>intent(operation,port,'external-authorized-provider',context);
export const safe=x=>Number.isSafeInteger(x)&&x>=0;
export const unique=a=>Array.isArray(a)&&new Set(a).size===a.length;
