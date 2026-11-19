// Pure client-side parser. It neither issues grants nor authorizes access.
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(value,keys)=>object(value)&&
 Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const ref=x=>typeof x==='string'&&x.startsWith('workspace:')&&digest(x.slice(10));
const denied=()=>Object.freeze({available:false});

export function normalizeWorkspaceResult(operation,response) {
 const result=object(response)?response.result:null;
 if(!object(result)||result.allowed!==true)return denied();
 if(operation==='prepare') {
  if(!exact(result,['allowed','workspace_ref','sha256','bytes']) ||
     !ref(result.workspace_ref)||!digest(result.sha256)||
     !Number.isSafeInteger(result.bytes)||result.bytes<1||result.bytes>131072)
   return denied();
  return Object.freeze({available:true,workspace_ref:result.workspace_ref,
   sha256:result.sha256,bytes:result.bytes});
 }
 if(operation==='revoke') {
  if(!exact(result,['allowed','revoked','workspace_ref'])||
     result.revoked!==true||!ref(result.workspace_ref))return denied();
  return Object.freeze({available:true,revoked:true,workspace_ref:result.workspace_ref});
 }
 return denied();
}
