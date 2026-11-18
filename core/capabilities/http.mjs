export async function capabilityApi(req,res,{authorized,reply,graph}){
 const url=new URL(req.url,'http://127.0.0.1');
 if(req.method!=='GET'||url.pathname!=='/api/capabilities')return false;
 if(!authorized(req)){reply(res,401,{error:'unauthorized'});return true;}
 try{reply(res,200,{schema:'mas-capability-providers-1',
  providers:(await graph()).providers.list()});}
 catch{reply(res,503,{error:'discovery_failed'});}
 return true;
}
export async function capabilityInvoke(live,body,caps){
 return live.providers.invoke({name:body.capability,version:body.version,
  operation:body.operation,scopes:[...caps],nodeId:body.nodeId,
  providerId:body.providerId,params:body.params});
}
