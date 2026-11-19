import {mkdtemp,writeFile,readFile,rm,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,X509Certificate} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
const run=promisify(execFile);
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
export const free=()=>new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
export const fingerprint=cert=>createHash('sha256').update(new X509Certificate(cert).publicKey.export({format:'der',type:'spki'})).digest('hex');
export async function tlsFixture(){
 const dir=await mkdtemp(join(tmpdir(),'anchorlink-tls-'));const ca=join(dir,'ca.pem'),cakey=join(dir,'ca.key');
 await run('openssl',['req','-new','-x509','-newkey','rsa:2048','-nodes','-keyout',cakey,'-out',ca,'-days','1','-subj','/CN=Audit Anchor Test CA']);
 for(const kind of ['server','client']){
  const f=join(dir,kind);await run('openssl',['req','-newkey','rsa:2048','-nodes','-keyout',f+'.key','-out',f+'.csr',
   '-subj','/CN='+(kind==='server'?'localhost':'anchor-source'),'-addext',kind==='server'?'subjectAltName=DNS:localhost':'extendedKeyUsage=clientAuth']);
  await run('openssl',['x509','-req','-in',f+'.csr','-CA',ca,'-CAkey',cakey,'-CAcreateserial',
   '-out',f+'.crt','-days','1','-copy_extensions','copy']);await chmod(f+'.key',0o600);
 }
 return {ca,serverCert:join(dir,'server.crt'),serverKey:join(dir,'server.key'),
  clientCert:join(dir,'client.crt'),clientKey:join(dir,'client.key'),
  serverPin:fingerprint(await readFile(join(dir,'server.crt'))),
  clientPin:fingerprint(await readFile(join(dir,'client.crt'))),remove:()=>rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:100})};
}
export async function spawnService(path,port,env){
 const p=spawn(process.execPath,[path],{env:{...process.env,...env,APP_PORT:String(port)},stdio:['ignore','ignore','pipe']});let stderr='';
 p.stderr.on('data',d=>stderr=(stderr+String(d)).slice(-1600));
 for(let i=0;i<140;i++){if(p.exitCode!==null)throw Error('service_early_exit:'+stderr);
  try{const res=await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(300)});if(res.ok)return p;}catch{}await sleep(60);}
 await stop(p);throw Error('service_not_ready:'+stderr);
}
export async function stop(p){if(!p||p.exitCode!==null)return;p.kill('SIGTERM');
 for(let i=0;i<60&&p.exitCode===null;i++)await sleep(40);if(p.exitCode===null)p.kill('SIGKILL');}
export async function invoke(port,secret,action){const res=await fetch('http://127.0.0.1:'+port+'/invoke',{
 method:'POST',headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:JSON.stringify({action}),signal:AbortSignal.timeout(9000)});
 return {status:res.status,body:await res.json()};}
export async function config(path,data){await writeFile(path,JSON.stringify(data),{mode:0o600});}
