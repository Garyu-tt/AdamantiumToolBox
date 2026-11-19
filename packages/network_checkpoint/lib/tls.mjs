import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {X509Certificate,createHash} from 'node:crypto';
import {sensitive} from './config.mjs';
export const spki=raw=>createHash('sha256').update(new X509Certificate(raw).publicKey.export({format:'der',type:'spki'})).digest('hex');
export async function client(config){const w=config.witness,u=new URL(w.url);
 const ca=await readFile(w.caFile),cert=await readFile(w.clientCertFile),key=await sensitive(w.clientKeyFile);
 function call(method,path,data){return new Promise((resolve,reject)=>{
  const req=https.request({protocol:'https:',hostname:u.hostname,port:u.port||443,path,method,
   ca,cert,key,minVersion:'TLSv1.3',rejectUnauthorized:true,timeout:7500,
   headers:{'Accept':'application/json','Content-Type':'application/json'},
   checkServerIdentity:(hostname,certificate)=>{
    // Verify the DNS SAN and the operator-pinned server SPKI.
    const err=(awaitHostnameCheck)(hostname,certificate);if(err)return err;
    if(spki(certificate.raw)!==w.serverSpkiSha256)return Error('server_identity_mismatch');
   }},res=>{
    let n=0;const parts=[];res.on('data',d=>{n+=d.length;if(n>262144){req.destroy(Error('response_too_large'));return;}parts.push(d);});
    res.on('end',()=>{let obj;try{obj=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return reject(Error('invalid_response'));}
     if(res.statusCode!==200)return reject(Error('remote_'+res.statusCode+'_'+String(obj.error||'failed').slice(0,65)));
     resolve(obj);
    });
   });req.on('timeout',()=>req.destroy(Error('ambiguous_delivery_timeout')));req.on('error',reject);
   req.end(data===undefined?undefined:JSON.stringify(data));
 });}
 return {get:()=>call('GET','/state'),post:data=>call('POST','/anchor',data)};
}
import {checkServerIdentity as awaitHostnameCheck} from 'node:tls';
