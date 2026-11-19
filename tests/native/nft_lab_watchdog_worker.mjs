import {spawnSync} from 'node:child_process';
import {isAbsolute} from 'node:path';
const ns=process.env.ADA_NFT_LAB_NAMESPACE;
const ip=process.env.ADA_NFT_LAB_IP,nft=process.env.ADA_NFT_LAB_NFT;
const table=process.argv[2];
if(process.env.ADA_NFT_LAB_DISPOSABLE_ONLY!=='1'||
 !/^ada-ci-[0-9]+-[0-9]+$/.test(ns||'')||
 !/^ada_ci_wd_[a-z0-9]{1,32}$/.test(table||'')||
 !isAbsolute(ip||'')||!isAbsolute(nft||''))process.exit(3);
await new Promise(done=>setTimeout(done,750));
const result=spawnSync(ip,['netns','exec',ns,nft,'delete','table','inet',table],{
 stdio:'ignore',timeout:4000,shell:false});
process.exit(result.status===0?0:4);
