import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {spki} from './tls.mjs';
import {sensitive,localTarget} from './config.mjs';
import {ORIGIN} from './contract.mjs';
const MAX=262144;
export async function upstream(url,secret,action,params={}){
 const u=localTarget(url);
 const response=await fetch(new URL('/invoke',u),{method:'POST',headers:{'X-Internal-Key':secret,
  'Content-Type':'application/json'},body:JSON.stringify({action,params}),signal:AbortSignal.timeout(6000)});
 let result;try{result=await response.json();}catch{throw Error('witness_invalid_reply');}
 if(!response.ok||!result||typeof result!=='object'||!result.result)throw Error('witness_'+response.status);
 return result.result;
}
export async function stateFor(cfg,secret){const r=cfg.receiver;
 const head=await upstream(r.localWitnessUrl,secret,'network_witness.latest',{journalId:r.journalId});
 if(head?.schema!=='network-witness-journal-head-v1'||head.witnessId!==r.witnessId||
  head.journalId!==r.journalId||!Number.isSafeInteger(head.count)||head.count<0||
  !/^[0-9a-f]{64}$/.test(head.revision)||head.latest===undefined)throw Error('invalid_witness_journal_head');
 const mine=head.latest;
 if(mine!==null&&(!mine?.receipt||mine.receipt.journalId!==r.journalId||
  !Number.isSafeInteger(mine.receipt.ledgerSeq)||mine.receipt.ledgerSeq<1||
  !/^[0-9a-f]{64}$/.test(mine.witnessRevision)||!mine.signature))throw Error('invalid_witness_journal_head');
 return {schema:'network-checkpoint-state-v1',witnessId:r.witnessId,journalId:r.journalId,
  witnessRevision:head.revision,ledgerSeq:mine?.receipt?.ledgerSeq||0,
  ledgerHead:mine?.receipt?.ledgerHead||ORIGIN,latest:mine};
}
function body(req){return new Promise((done,fail)=>{let size=0;const chunks=[];
 req.on('data',d=>{size+=d.length;if(size>MAX){fail(Error('packet_too_large'));req.destroy();}else chunks.push(d);});
 req.on('end',()=>{try{done(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{fail(Error('invalid_packet'));}});req.on('error',fail);
});}
export async function startReceiver(cfg,secret,caps){const r=cfg.receiver;
 const ca=await readFile(r.caFile),cert=await readFile(r.serverCertFile),key=await sensitive(r.serverKeyFile);
 const server=https.createServer({ca,cert,key,minVersion:'TLSv1.3',requestCert:true,rejectUnauthorized:true},async(req,res)=>{
  const send=(status,record)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(record));};
  try{if(!req.socket.authorized||!req.socket.getPeerCertificate()?.raw||
    spki(req.socket.getPeerCertificate().raw)!==r.clientSpkiSha256)return send(403,{error:'client_identity_denied'});
   if(req.method==='GET'&&req.url==='/state'){
    if(!caps.has('network_checkpoint.read')||!caps.has('network_witness.read'))return send(403,{error:'permission_denied'});
    return send(200,await stateFor(cfg,secret));
   }
   if(req.method==='POST'&&req.url==='/anchor'){
    if(!caps.has('network_checkpoint.receive')||!caps.has('network_witness.write')||!caps.has('network_witness.read'))return send(403,{error:'permission_denied'});
    const data=await body(req);if(data?.schema!=='network-checkpoint-transfer-v1'||
     data.checkpoint?.journalId!==r.journalId)return send(400,{error:'invalid_journal'});
    const before=await stateFor(cfg,secret);if(before.witnessRevision!==data.expectedRevision)return send(409,{error:'revision_conflict'});
    return send(200,await upstream(r.localWitnessUrl,secret,'network_witness.anchor',data));
   }return send(404,{error:'not_found'});
  }catch(e){return send(503,{error:String(e.message).slice(0,90)});}
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(r.listenPort,r.listenHost,ok)});
 return server;
}
