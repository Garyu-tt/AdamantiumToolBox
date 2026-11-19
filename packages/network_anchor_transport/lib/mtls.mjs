import https from 'node:https';
import tls from 'node:tls';
import {readFile} from 'node:fs/promises';
import {createHash,X509Certificate} from 'node:crypto';
import {privateRead} from './config.mjs';
export const spki=raw=>createHash('sha256').update(new X509Certificate(raw).publicKey.export({format:'der',type:'spki'})).digest('hex');
export async function client(cfg){const c=cfg.sender,url=new URL(c.url),ca=await readFile(c.caFile);
 const cert=await readFile(c.clientCertFile),key=await privateRead(c.clientKeyFile);
 async function call(path,content){return new Promise((ok,no)=>{
  const payload=content===undefined?null:JSON.stringify(content);
  const req=https.request(new URL(path,url),{method:payload===null?'GET':'POST',ca,cert,key,minVersion:'TLSv1.3',
   timeout:7000,checkServerIdentity:(hostname,peer)=>tls.checkServerIdentity(hostname,peer)||
    (spki(peer.raw)===c.serverSpkiSha256?undefined:Error('remote_spki_mismatch')),
   headers:payload===null?{}:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{
    let size=0,data='';res.on('data',d=>{size+=d.length;if(size>262144){req.destroy(Error('response_too_large'));return;}data+=d;});
    res.on('end',()=>{let result;try{result=JSON.parse(data);}catch{return no(Error('invalid_remote_json'));}
     if(res.statusCode<200||res.statusCode>=300)return no(Error('remote_'+res.statusCode+':'+String(result?.error||'rejected').slice(0,50)));
     ok(result);});});
  req.on('timeout',()=>req.destroy(Error('remote_timeout')));req.on('error',no);
  if(payload!==null)req.write(payload);req.end();
 });}
 return {get:()=>call('/state'),post:data=>call('/commit',data)};
}
