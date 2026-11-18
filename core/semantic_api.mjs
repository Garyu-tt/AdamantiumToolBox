import {loadFrontend} from './frontend.mjs';
import {semanticGraph,describe} from './semantic.mjs';
import {planChange,applyChange,rollbackChange,history} from './change.mjs';
const READ=new Set(['/api/semantic','/api/object','/api/changes/history']);
const WRITE=new Set(['/api/changes/plan','/api/changes/apply','/api/changes/rollback']);
function readJson(req,limit=150000){
 return new Promise((accept,reject)=>{
  let raw='';
  req.on('data',chunk=>{
   raw+=chunk;
   if(Buffer.byteLength(raw)>limit){reject(Error('body_too_large'));req.destroy();}
  });
  req.on('end',()=>{try{accept(JSON.parse(raw));}catch{reject(Error('invalid_json'));}});
  req.on('error',reject);
 });
}
export async function semanticApi(req,res,{reply,token,secret,caps,backend}){
 const url=new URL(req.url,'http://127.0.0.1');
 if(!READ.has(url.pathname)&&!WRITE.has(url.pathname))return false;
 const valid=req.headers.authorization==='Bearer '+token||req.headers['x-internal-key']===secret;
 if(!valid){reply(res,401,{error:'unauthorized'});return true;}
 if(READ.has(url.pathname)){
  if(req.method!=='GET'||!caps.has('semantic.read')){reply(res,403,{error:'denied'});return true;}
  try{
   const front=await loadFrontend(),back=await backend();
   if(url.pathname==='/api/semantic')reply(res,200,semanticGraph(front,back));
   else if(url.pathname==='/api/object')reply(res,200,describe(url.searchParams.get('ref'),front,back));
   else reply(res,200,await history(Number(url.searchParams.get('limit'))||30));
  }catch(e){reply(res,400,{error:String(e.message).slice(0,120)});}
  return true;
 }
 const planOnly=url.pathname==='/api/changes/plan';
 if(req.method!=='POST'||!caps.has(planOnly?'semantic.read':'semantic.write')){
  reply(res,403,{error:'denied'});return true;
 }
 try{
  const data=await readJson(req),back=await backend();
  if(planOnly)reply(res,200,await planChange(data,back));
  else if(url.pathname==='/api/changes/apply')reply(res,200,await applyChange(data,back));
  else reply(res,200,await rollbackChange(data.change_id,data.expected_etag,back));
 }catch(e){
  const msg=String(e.message).slice(0,120);
  reply(res,/stale|conflict|not_latest/.test(msg)?409:400,{error:msg});
 }
 return true;
}
