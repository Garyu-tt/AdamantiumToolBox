const limit=1600000;
export async function cdp(target,method,params={},timeoutMs=9000){
 if(!/^[A-Za-z]+\.[A-Za-z]+$/.test(method))throw Error('invalid_cdp_method');
 const address=new URL(target);
 if(address.protocol!=='ws:'||!['127.0.0.1','localhost','[::1]'].includes(address.hostname)||
  !(address.pathname.startsWith('/devtools/page/')||
  (method==='Browser.close'&&address.pathname.startsWith('/devtools/browser/'))))throw Error('unsafe_cdp_endpoint');
 const ws=new WebSocket(target);
 const response=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.close();reject(Error('cdp_timeout'));},timeoutMs);
  const end=(fn,value)=>{clearTimeout(timer);fn(value);};
  ws.addEventListener('open',()=>ws.send(JSON.stringify({id:1,method,params})),{once:true});
  ws.addEventListener('error',()=>end(reject,Error('cdp_connection_failed')),{once:true});
  ws.addEventListener('message',e=>{
   if(typeof e.data!=='string'||e.data.length>limit)return end(reject,Error('cdp_payload_too_large'));
   let data;try{data=JSON.parse(e.data);}catch{return;}
   if(data.id!==1)return;
   if(data.error)return end(reject,Error('cdp_'+data.error.code));
   end(resolve,data.result||{});
  });
  ws.addEventListener('close',()=>end(reject,Error('cdp_closed')),{once:true});
 });
 ws.close();return response;
}
