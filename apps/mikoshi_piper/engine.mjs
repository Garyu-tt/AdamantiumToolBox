// Optional, separately installed OHF Piper TTS. Never download a voice automatically.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {isAbsolute,basename} from 'node:path';
let probed=null;
function config(){
 const model=process.env.MIKOSHI_PIPER_MODEL||'';
 if(!isAbsolute(model)||!model.endsWith('.onnx')||
  process.env.MIKOSHI_PIPER_MODEL_RIGHTS!=='approved'||
  !existsSync(model)||!existsSync(model+'.json'))return null;
 return {model,python:process.env.MIKOSHI_PIPER_PYTHON||'python3'};
}
export function available(){
 const c=config();if(!c)return false;
 if(probed!==null)return probed;
 const p=spawnSync(c.python,['-c','import piper'],{timeout:2800,windowsHide:true});
 return (probed=p.status===0&&!p.error);
}
export function status(){
 const c=config();
 return {available:available(),model:c?basename(c.model):null,
  provider:'piper',languageModel:false,modelOwnerApproved:Boolean(c)};
}
export function speak(text,prosody={}){
 if(!available())throw Error('piper_provider_offline');
 if(typeof text!=='string'||!text.trim()||text.length>80||
  /[\x00-\x08]/.test(text))throw Error('invalid_utterance');
 if(!prosody||typeof prosody!=='object'||Array.isArray(prosody))throw Error('invalid_prosody');
 const pitchDelta=prosody.pitchDelta??0,speedDelta=prosody.speedDelta??0;
 if(pitchDelta!==0)throw Error('piper_pitch_adjust_unavailable');
 if(!Number.isInteger(speedDelta)||Math.abs(speedDelta)>20)
  throw Error('prosody_out_of_bounds');
 const lengthScale=+(1-speedDelta/120).toFixed(4),c=config();
 if(!c)throw Error('piper_provider_offline');
 const args=['-m','piper','-m',c.model,'--length-scale',String(lengthScale),
  '-f','-','--',text];
 const r=spawnSync(c.python,args,{timeout:16500,windowsHide:true,maxBuffer:2*1024*1024});
 if(r.error||r.status!==0||!r.stdout||r.stdout.length<44||
  r.stdout.subarray(0,4).toString('ascii')!=='RIFF')throw Error('piper_synthesis_failed');
 return {mime:'audio/wav',audioBase64:r.stdout.toString('base64'),provider:'piper',
  voiceProfile:{model:basename(c.model)},appliedProsody:{pitchDelta:0,speedDelta},
  model:'neural-acoustic-tts',languageModel:false};
}
