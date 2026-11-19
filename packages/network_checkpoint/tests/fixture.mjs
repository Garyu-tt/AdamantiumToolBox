import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {generateKeyPairSync,sign,X509Certificate,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
const run=promisify(execFile);
export const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const reserved=new Set();
export async function free(){for(let attempt=0;attempt<20;attempt++){const port=await new Promise(ok=>{
 const server=createServer();server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>ok(p));});});
 if(!reserved.has(port)){reserved.add(port);return port;}}throw Error('port_collision');}
export async function stop(p){if(!p||p.exitCode!==null)return;p.kill('SIGTERM');for(let i=0;i<50&&p.exitCode===null;i++)await pause(60);if(p.exitCode===null)p.kill('SIGKILL');}
export const pub=k=>k.publicKey.export({type:'spki',format:'pem'}).toString();
export const pem=k=>k.privateKey.export({type:'pkcs8',format:'pem'}).toString();
export const fingerprint=content=>createHash('sha256').update(new X509Certificate(content).publicKey.export({type:'spki',format:'der'})).digest('hex');
export async function crypt(){
 const dir=await mkdtemp(join(tmpdir(),'checkpoint-tls-'));
 const caKey=join(dir,'ca.key'),caCert=join(dir,'ca.crt');
 await run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',caKey,'-out',caCert,'-days','1','-subj','/CN=Checkpoint Test CA']);
 for(const who of ['server','client']){
  const path=join(dir,who),cn=who==='server'?'localhost':'source-client';
  await run('openssl',['req','-newkey','rsa:2048','-nodes','-keyout',path+'.key','-out',path+'.csr','-subj','/CN='+cn,
   '-addext',who==='server'?'subjectAltName=DNS:localhost':'extendedKeyUsage=clientAuth']);
  await run('openssl',['x509','-req','-in',path+'.csr','-CA',caCert,'-CAkey',caKey,
   '-CAcreateserial','-out',path+'.crt','-days','1','-copy_extensions','copy']);
  await (await import('node:fs/promises')).chmod(path+'.key',0o600);
 }
 return {dir,caCert,serverKey:join(dir,'server.key'),serverCert:join(dir,'server.crt'),
  clientKey:join(dir,'client.key'),clientCert:join(dir,'client.crt'),
  serverPin:fingerprint(await readFile(join(dir,'server.crt'))),
  clientPin:fingerprint(await readFile(join(dir,'client.crt'))),remove:()=>rm(dir,{recursive:true,force:true})};
}
export async function setup(){const dir=await mkdtemp(join(tmpdir(),'checkpoint-test-'));
 const source=generateKeyPairSync('ed25519'),destination=generateKeyPairSync('ed25519'),witness=generateKeyPairSync('ed25519');
 const sourceKey=join(dir,'source.key'),witnessKey=join(dir,'witness.key');
 await writeFile(sourceKey,pem(source),{mode:0o600});await writeFile(witnessKey,pem(witness),{mode:0o600});
 const ledgerTrust={schema:'network-approval-trust-v1',nodes:{approval:{keyId:'approval-key',publicKey:pub(source)},destination:{keyId:'destination-key',publicKey:pub(destination)}}};
 const witnessTrust={schema:'network-witness-trust-v1',witness:{id:'remote_witness',keyId:'witness-key',publicKey:pub(witness)},
  sources:{approval:{id:'approval',keyId:'approval-key',publicKey:pub(source)}}};
 const witnessTrustPath=join(dir,'witness-trust.json');await writeFile(witnessTrustPath,JSON.stringify(witnessTrust),{mode:0o600});
 return {dir,source,destination,witness,sourceKey,witnessKey,ledgerTrust,witnessTrustPath,
  ledgerPath:join(dir,'ledger.jsonl'),witnessLog:join(dir,'witness.jsonl'),remove:()=>rm(dir,{recursive:true,force:true})};
}
export async function writeConfig(path,data){await writeFile(path,JSON.stringify(data),{mode:0o600});}
export async function invoke(port,secret,action,params={}){const res=await fetch('http://127.0.0.1:'+port+'/invoke',{
 method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action,params}),signal:AbortSignal.timeout(6500)});
 return {status:res.status,data:await res.json()};}
export async function spawnService(path,env,port){const p=spawn(process.execPath,[path],{env:{...process.env,...env,APP_PORT:String(port)},stdio:['ignore','ignore','pipe']});let stderr='';p.stderr.on('data',d=>stderr+=(String(d).slice(0,500)));
 for(let i=0;i<125;i++){if(p.exitCode!==null)throw Error('service_exit:'+stderr);
  try{const res=await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(350)});if(res.ok)return p;}catch{}await pause(60);}
 await stop(p);throw Error('service_not_ready:'+stderr);
}
