import {strict as assert} from 'node:assert';
import {spawn,spawnSync} from 'node:child_process';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,isAbsolute} from 'node:path';
const ns=process.env.ADA_NFT_LAB_NAMESPACE;
const ip=process.env.ADA_NFT_LAB_IP,nft=process.env.ADA_NFT_LAB_NFT;
const root=process.env.ADA_NFT_LAB_NAMESPACE_ROOT;
const valid=process.env.ADA_NFT_LAB_DISPOSABLE_ONLY==='1'&&
 /^ada-ci-[0-9]+-[0-9]+$/.test(ns||'')&&
 [ip,nft,root].every(x=>isAbsolute(x||''));
assert(valid,'CI-only disposable namespace authorization required');
const run=(args,expectSuccess=true)=>{
 const result=spawnSync(ip,['netns','exec',ns,nft,...args],{
  encoding:'utf8',shell:false,timeout:4000});
 if(expectSuccess)assert.equal(result.status,0,String(result.stderr).slice(0,600));
 return result;
};
if(process.argv[2]==='arm'){
 const table=process.argv[3];
 assert(/^ada_ci_wd_[a-z0-9]{1,32}$/.test(table||''));
 const worker=fileURLToPath(new URL('./nft_lab_watchdog_worker.mjs',import.meta.url));
 const child=spawn(process.execPath,[worker,table],{
  detached:true,stdio:'ignore',env:{...process.env}});
 await new Promise((done,fail)=>{child.once('spawn',done);child.once('error',fail);});
 child.unref();process.exit(0);
}
const [local,target]=await Promise.all([stat('/proc/self/ns/net'),stat(join(root,ns))]);
assert(local.ino!==target.ino||local.dev!==target.dev,
 'target cannot be controller network namespace');
const before=run(['-j','list','ruleset']).stdout.trim();
const table='ada_ci_wd_'+process.pid.toString(36);
let present=false,expired=false;
try{
 run(['add','table','inet',table]);present=true;
 assert.equal(run(['list','table','inet',table]).status,0);
 const arm=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'arm',table],{
  encoding:'utf8',timeout:5000,env:{...process.env}});
 assert.equal(arm.status,0,String(arm.stderr).slice(0,500));
 for(let i=0;i<50;i++){
  await new Promise(done=>setTimeout(done,100));
  if(run(['list','table','inet',table],false).status!==0){expired=true;present=false;break;}
 }
 assert(expired,'separate watchdog did not delete test-only unhooked table');
 assert.equal(run(['-j','list','ruleset']).stdout.trim(),before);
 console.log('NFTABLES_NATIVE_ROLLBACK_OK controller exited; independent worker reverted unhooked table');
}finally{
 if(present)run(['delete','table','inet',table],false);
}
