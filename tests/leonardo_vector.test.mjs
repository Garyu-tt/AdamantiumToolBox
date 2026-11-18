import {strict as assert} from 'node:assert';
import {vectorSVG,vectorArtifact} from '../apps/leonardo_vector/scene.mjs';
const a=vectorSVG('vector example'),b=vectorSVG('vector example');
assert.equal(a,b);assert(a.startsWith('<svg '));
assert(a.includes('<circle '));assert(!a.includes('<script'));
const xml=vectorSVG('Safe <title> & text',{width:400,height:200,scene:[
 {type:'rect',x:0,y:0,width:400,height:200,fill:'#aabbcc'},
 {type:'line',x1:5,y1:5,x2:50,y2:45,stroke:'#123456',strokeWidth:2},
 {type:'text',x:10,y:25,text:'<script>alert("x")</script> &',fill:'#000000'}]});
assert(xml.includes('&lt;script&gt;'));assert(!xml.includes('<script>'));
assert(xml.includes('width="400" height="200"'));
const artifact=vectorArtifact('one',{scene:[]});
assert.equal(artifact.mime,'image/svg+xml');
assert(Buffer.from(artifact.data,'base64').toString().startsWith('<svg'));
assert.throws(()=>vectorSVG('a',{scene:[{type:'rect',x:0,y:0,width:1,height:1,fill:'url(https://bad)'}]}),/invalid_fill/);
assert.throws(()=>vectorSVG('a',{scene:[{type:'path',d:'M 0 0'}]}),/unsupported_shape/);
assert.throws(()=>vectorSVG('a',{scene:Array.from({length:97},()=>({}))}),/invalid_scene/);
assert.throws(()=>vectorSVG('a',{width:99999}),/invalid_width/);
assert.throws(()=>vectorSVG('a',{scene:[{type:'text',x:1,y:1,text:'a'.repeat(161)}]}),/invalid_text/);
console.log('LEONARDO_VECTOR_OK deterministic SVG scenes validation and XML escaping');
