import {strict as assert} from 'node:assert';
import {iconAssetProvider,createIconAssets} from '../shell/icon_assets.js';
const root=(listAction='art.catalog',getAction='art.get')=>({nodes:[
 {id:'art.icons',type:'resource',assetProvider:{schema:'mas-graphics-asset-provider-1',
  kind:'icon',listAction,getAction,priority:4}},
 {id:'art.catalog',type:'action'},{id:'art.get',type:'action'}]});
assert.equal(iconAssetProvider(root())?.getAction,'art.get');
assert.equal(iconAssetProvider(root('other.bad','art.get')),null);
assert.equal(iconAssetProvider({nodes:[]}),null);
let current='a'.repeat(64),data='data:image/png;base64,AAAA';
const calls=[];
const assets=createIconAssets(async(action,params)=>{
 calls.push([action,params]);
 if(action==='art.catalog')return {schema:'mas-graphics-icon-catalog-1',
  items:{editor:{revision:1,sha256:current}}};
 if(action==='art.get')return {found:true,sha256:current,dataUri:data};
 throw Error('unexpected_action');
},()=>({src:'',alt:'',dataset:{},isConnected:true}));
const icon=assets.make({icon:'editor'}),fallback=icon.src;
assert(fallback.includes('editor.svg'));
await assets.sync(root());
await new Promise(resolve=>setImmediate(resolve));
assert.equal(icon.src,data);
const another=assets.make({icon:'editor'});
assert.equal(another.src,data);
current='b'.repeat(64);data='data:image/png;base64,AABB';
await assets.sync(root());await new Promise(resolve=>setImmediate(resolve));
assert.equal(icon.src,data);assert.equal(another.src,data);
assert.equal(calls.filter(([action])=>action==='art.get').length,2);
await assets.sync({nodes:[]});
assert.equal(icon.src,fallback);
assert.equal(another.src,fallback);
console.log('ICON_ASSETS_OK dynamic capability, revision updates, no-provider fallback');
