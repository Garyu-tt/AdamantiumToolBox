// Public presentation parser: never authorize an OS runner based on this result.
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join('|')===
 [...keys].sort().join('|');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const ref=x=>typeof x==='string'&&x.startsWith('workspace:')&&sha(x.slice(10));
const bounds=b=>exact(b,['timeout_ms','memory_mib','cpu_percent','network'])&&
 Number.isSafeInteger(b.timeout_ms)&&b.timeout_ms>=100&&b.timeout_ms<=30000&&
 Number.isSafeInteger(b.memory_mib)&&b.memory_mib>=32&&b.memory_mib<=1024&&
 Number.isSafeInteger(b.cpu_percent)&&b.cpu_percent>=1&&b.cpu_percent<=100&&
 b.network==='deny';
const unavailable=()=>Object.freeze({eligible:false,runnable:false});

export function normalizeRunnerPreview(response) {
 const result=object(response)?response.result:null;
 if(!object(result)||result.runnable!==false)return unavailable();
 if(result.eligible===false) {
  if(!exact(result,['eligible','runnable','reason'])||
      result.reason!=='unavailable')return unavailable();
  return unavailable();
 }
 if(result.eligible!==true||
    !exact(result,['eligible','runnable','reason','workspace_ref','sha256','bytes','budget'])||
    result.reason!=='isolation_unavailable'||!ref(result.workspace_ref)||
    !sha(result.sha256)||!Number.isSafeInteger(result.bytes)||
    result.bytes<1||result.bytes>131072||!bounds(result.budget))
  return unavailable();
 return Object.freeze({eligible:true,runnable:false,workspace_ref:result.workspace_ref,
  sha256:result.sha256,bytes:result.bytes,
  budget:Object.freeze({...result.budget})});
}
