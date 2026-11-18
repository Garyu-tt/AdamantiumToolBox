import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iconPNG} from '../apps/leonardo_cpu/png.mjs';
import {discover,dispatch} from '../apps/leonardo/router.mjs';
const home=await mkdtemp(join(tmpdir(),'leonardo-test-'));
const original=globalThis.fetch;
process.env.LOCALAPPDATA=home;
process.env.ADA_TOKEN='test-token-long-enough-for-router-tests';
process.env.ADA_CORE_URL='http://127.0.0.1:12345';
const signature='89504e470d0a1a0a';
const a=iconPNG('pencil'),b=iconPNG('pencil'),c=iconPNG('pencil','second');
assert.equal(a.subarray(0,8).toString('hex'),signature);
assert(a.equals(b));assert(!a.equals(c));
const graph={nodes:[
 {id:'leonardo_cpu.provider',type:'resource',
  provider:{schema:'mas-graphics-provider-1',locality:'local',operations:[
   {kind:'icon',action:'leonardo_cpu.generate',formats:['image/png'],priority:10}]}},
 {id:'leonardo_cpu.generate',type:'action'}]};
globalThis.fetch=async(url,options={})=>{
 if(url.endsWith('/api/graph'))return new Response(JSON.stringify(graph),{status:200});
 if(url.endsWith('/api/invoke')){
  const input=JSON.parse(options.body);
  assert.equal(input.action,'leonardo_cpu.generate');
  return new Response(JSON.stringify({result:{status:'completed',artifact:{
   mime:'image/png',encoding:'base64',data:a.toString('base64')}}}),{status:200});
 }
 throw Error('unexpected_fetch');
};
try{
 const provider=await discover();assert.equal(provider.length,1);
 const item=await dispatch({kind:'icon',prompt:'pencil'});
 assert.equal(item.providerId,'leonardo_cpu.provider');
 await assert.rejects(dispatch({kind:'video',prompt:'demo'}),/no_eligible_graphics_provider/);
 const {getIcon,saveIcon}=await import('../apps/leonardo/icon-store.mjs');
 const first=await saveIcon('editor',item.artifact,item.providerId);
 assert.equal(first.revision,1);
 const second=await saveIcon('editor',item.artifact,item.providerId);
 assert.equal(second.revision,2);
 const stored=await getIcon('editor');
 assert.equal(stored.revision,2);assert(stored.dataUri.startsWith('data:image/png;base64,'));
 await assert.rejects(saveIcon('../editor',item.artifact,item.providerId),/invalid_icon_key/);
 console.log('LEONARDO_OK CPU PNG provider router icon revisions missing video');
}finally{globalThis.fetch=original;await rm(home,{recursive:true,force:true});}
