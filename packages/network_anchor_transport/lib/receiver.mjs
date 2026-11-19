import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {spki} from './mtls.mjs';
import {privateRead,loopback} from './config.mjs';
import {verifyRemoteState} from './verify.mjs';
const MAX=262144;
export async function invokeLocal(url,credential,action,params={}){
 const endpoint=new URL('/invoke',loopback(url));
 const res=await fetch(endpoint,{method:'POST',headers:{'X-Internal-Key':credential,'Content-Type':'application/json'},
  body:JSON.stringify({action,params}),signal:AbortSignal.timeout(6000)});
 let body;try{body=await res.json();}catch{throw Error('invalid_anchor_reply');}
 if(!res.ok||!body||typeof body!=='object'||!body.result)throw Error('anchor_'+res.status+':'+String(body?.error||'error').slice(0,50));
 return body.result;
}
export async function stateFor(cfg,credential){
 const s=await invokeLocal(cfg.receiver.localAnchorUrl,credential,'network_anchor.status');
 const l=await invokeLocal(cfg.receiver.localAnchorUrl,credential,'network_anchor.latest');
 if(!s.configured||s.revision!==l.revision)throw Error('anchor_state_race');
 return verifyRemoteState({schema:'network-anchor-transport-state-v1',anchorId:cfg.trust.anchor.id,
  witnessId:cfg.trust.witness.id,revision:s.revision,count:s.count,witnessSeq:s.witnessSeq,
  witnessHead:s.witnessHead,latest:l.attestation},cfg.trust);
}
const decode=req=>new Promise((ok,no)=>{let size=0,raw='';req.on('data',part=>{size+=part.length;
 if(size>MAX){no(Error('payload_too_large'));req.destroy();return;}raw+=part;});
 req.on('end',()=>{try{ok(JSON.parse(raw));}catch{no(Error('invalid_body'));}});req.on('error',no);});
export async function startReceiver(cfg,credential,caps){
 const c=cfg.receiver,ca=await readFile(c.caFile),cert=await readFile(c.serverCertFile),key=await privateRead(c.serverKeyFile);
 const server=https.createServer({ca,cert,key,requestCert:true,rejectUnauthorized:true,minVersion:'TLSv1.3'},async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
   'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try{
   if(!req.socket.authorized||!req.socket.getPeerCertificate()?.raw||
    spki(req.socket.getPeerCertificate().raw)!==c.clientSpkiSha256)return send(403,{error:'client_identity_denied'});
   if(req.method==='GET'&&req.url==='/state'){
    if(!caps.has('network_anchor_transport.read')||!caps.has('network_anchor.read'))return send(403,{error:'permission_denied'});
    return send(200,await stateFor(cfg,credential));
   }
   if(req.method==='POST'&&req.url==='/commit'){
    if(!caps.has('network_anchor_transport.receive')||!caps.has('network_anchor.read')||
     !caps.has('network_anchor.write'))return send(403,{error:'permission_denied'});
    const packet=await decode(req);
    if(packet?.schema!=='network-anchor-transport-transfer-v1'||
     !Array.isArray(packet.batch)||packet.batch.length<1||packet.batch.length>16)return send(400,{error:'invalid_batch'});
    const state=await stateFor(cfg,credential);
    if(packet.expectedRevision!==state.revision)return send(409,{error:'revision_conflict'});
    return send(200,await invokeLocal(c.localAnchorUrl,credential,'network_anchor.commit',
     {batch:packet.batch,expectedRevision:packet.expectedRevision}));
   }
   return send(404,{error:'not_found'});
  }catch(e){const code=String(e.message).startsWith('anchor_409')?409:503;
   return send(code,{error:String(e.message).slice(0,90)});}
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(c.listenPort,c.listenHost,ok)});
 return server;
}
