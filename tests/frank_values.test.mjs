import {strict as assert} from 'node:assert';
import {assertFrankValue,frankI64,frankBytes} from '../frank-addons/bridge/values.mjs';
const precise=frankI64('9223372036854775807');
assert.deepEqual(precise,{$frank:'i64',value:'9223372036854775807'});
assert.deepEqual(frankBytes(new Uint8Array([1,2,3])),{$frank:'bytes',value:'AQID'});
const value={message:'Привет 🌍',precise,bytes:frankBytes([0,255]),
 list:[null,true,12.25,{$frank:'u64',value:'18446744073709551615'}]};
assert.equal(assertFrankValue(value),value);
const bad=[
 {$frank:'i64',value:'9223372036854775808'},
 {$frank:'i64',value:'01'},
 {$frank:'u64',value:'-1'},
 {$frank:'bytes',value:'@@=='},
 {$frank:'bytes',value:'AQI='+'='},
 {$frank:'i64',value:'5',extra:true},
 {$frank:'decimal128',value:'1'},
 JSON.parse('{"__proto__":{"admin":true}}'),
 {constructor:'evil'},
 {unsafe:Number.MAX_SAFE_INTEGER+2},
 {notFinite:Infinity},
 {bigint:1n},
 {nothing:undefined},
 {tooBig:'a'.repeat(40000)}
];
for(const input of bad)assert.throws(()=>assertFrankValue(input),/invalid_frank_value/);
const cycle={};cycle.self=cycle;
assert.throws(()=>assertFrankValue(cycle),/invalid_frank_value/);
let deep={};for(let i=0;i<20;i++)deep={a:deep};
assert.throws(()=>assertFrankValue(deep),/invalid_frank_value/);
console.log('FRANK_VALUES_OK typed i64/u64/bytes, nested JSON, fail closed');
