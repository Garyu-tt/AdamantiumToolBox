const endpoint=()=>{
 const raw=process.env.ADA_CORE_URL,token=process.env.ADA_TOKEN;
 if(!raw||!token||token.length<24)throw Error('core_unavailable');
 const u=new URL(raw);
 if(u.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(u.hostname)||
  !u.port||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error('core_must_be_loopback');
 return u.origin;
};
export async function call(path,body,signal){
 const response=await fetch(endpoint()+path,{method:body?'POST':'GET',
  headers:{Authorization:'Bearer '+process.env.ADA_TOKEN,'Content-Type':'application/json'},
  body:body?JSON.stringify(body):undefined,
  signal:AbortSignal.any([AbortSignal.timeout(15000),signal||new AbortController().signal])});
 if(!response.ok)throw Error('core_'+response.status);
 const json=await response.json();if(json.error)throw Error(json.error);
 return body?json.result:json;
}
