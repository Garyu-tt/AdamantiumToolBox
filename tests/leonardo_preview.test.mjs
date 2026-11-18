import {strict as assert} from 'node:assert';
import {previewUrl,parseOptions} from '../apps/leonardo/view.js';
assert.equal(previewUrl({mime:'image/svg+xml',encoding:'base64',data:'PHN2Zz4='}),
 'data:image/svg+xml;base64,PHN2Zz4=');
assert.equal(previewUrl({mime:'image/png',encoding:'base64',data:'AAAA'}),
 'data:image/png;base64,AAAA');
assert.equal(previewUrl({mime:'text/html',encoding:'base64',data:'AAAA'}),null);
assert.equal(previewUrl({mime:'image/png',encoding:'utf8',data:'AAAA'}),null);
assert.equal(previewUrl({mime:'image/png',encoding:'base64',data:'bad!'}),null);
assert.deepEqual(parseOptions(''),{});
assert.deepEqual(parseOptions('{"width":320,"scene":[]}'),{width:320,scene:[]});
assert.throws(()=>parseOptions('[1,2]'),/options_must_be_object/);
assert.throws(()=>parseOptions('{'),SyntaxError);
assert.throws(()=>parseOptions('x'.repeat(12001)),/invalid_options/);
console.log('LEONARDO_PREVIEW_OK png svg safe url and typed options');
