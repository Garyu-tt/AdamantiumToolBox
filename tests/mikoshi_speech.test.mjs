import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {validateManifest} from '../core/contract.mjs';
import {analyze} from '../apps/mikoshi_hearing/features.mjs';
import {teach,infer,progress} from '../apps/mikoshi_learning/learner.mjs';
import {profile} from '../apps/mikoshi_voice/engine.mjs';
for(const id of ['mikoshi_hearing','mikoshi_voice','mikoshi_learning','mikoshi_classroom']){
 const m=JSON.parse(await readFile(new URL('../apps/'+id+'/manifest.json',import.meta.url)));
 assert(validateManifest(m));assert.equal(m.id,id);
}
const samples=Array.from({length:1600},(_,i)=>Math.sin(2*Math.PI*200*i/16000)*.3);
const a=analyze(samples);
assert(a.pitchHz>=190&&a.pitchHz<=210);assert.equal(a.activity,'active');
assert.throws(()=>analyze([0,1]),/pcm_frame_length/);
assert.throws(()=>analyze(Array(400).fill(2)),/pcm_value/);
const blank={schema:'mikoshi.prototypes.v1',items:[]};
assert.equal(infer(blank,{domain:'hearing',vector:a.vector}).label,null);
const first=teach(blank,{domain:'hearing',label:'ah',vector:a.vector,correct:true});
assert.equal(first.updated,true);assert.equal(blank.items.length,0);
assert.equal(infer(first.state,{domain:'hearing',vector:a.vector}).label,'ah');
const rejected=teach(first.state,{domain:'hearing',label:'uh',vector:a.vector,correct:false});
assert.equal(rejected.updated,false);assert.equal(progress(rejected.state).observations,1);
assert.throws(()=>teach(blank,{domain:'hearing',label:'?',vector:[999,0],correct:true}),/invalid/);
assert.equal(profile().language.length>=2,true);
console.log('MIKOSHI_NONLLM_SPEECH_OK PCM, feedback, independent MAS');
