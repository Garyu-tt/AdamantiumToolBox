function endpoint(config){
 if(typeof config.endpoint!=='string')return null;
 try{
  const url=new URL(config.endpoint);
  if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||
   url.username||url.password||url.search||url.hash||url.pathname!=='/')return null;
  url.pathname='/api/version';
  return url;
 }catch{return null;}
}
async function limitedText(response){
 const reader=response.body?.getReader();
 if(!reader)return '';
 let data='',total=0;
 for(;;){
  const {done,value}=await reader.read();
  if(done)break;
  total+=value.length;if(total>512){await reader.cancel();return null;}
  data+=new TextDecoder().decode(value,{stream:true});
 }
 return data.trim();
}
export async function probe(config){
 const url=endpoint(config);
 if(!url)return {state:'invalid_local_endpoint'};
 try{
  const response=await fetch(url,{method:'GET',redirect:'manual',
   headers:{'X-ALVR':'1'},signal:AbortSignal.timeout(1600)});
  if(!response.ok)return {state:'not_running',httpStatus:response.status};
  let version=await limitedText(response);
  if(version===null)return {state:'unexpected_response'};
  try{version=JSON.parse(version);}catch{}
  if(typeof version!=='string'||version.length>100||
   !/^v?\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.\-]+)?$/.test(version))
   return {state:'unexpected_response'};
  return {state:'server_observed',version,observed_at:new Date().toISOString(),
   evidence:'alvr_api_version',streaming:'unverified',paired:'unverified'};
 }catch{return {state:'not_running'};}
}
