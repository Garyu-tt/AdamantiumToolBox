import {spawnSync} from 'node:child_process';
export function profile(){
 let p={language:'ru',pitch:48,speed:155,amplitude:100};
 if(process.env.MIKOSHI_VOICE_PROFILE_JSON){
  try{p=JSON.parse(process.env.MIKOSHI_VOICE_PROFILE_JSON);}
  catch{throw Error('invalid_voice_profile_json');}
 }
 if(!p||!/^[a-z]{2,3}([+-][a-z0-9_-]+)?$/i.test(p.language||'')||
  !Number.isInteger(p.pitch)||p.pitch<0||p.pitch>99||
  !Number.isInteger(p.speed)||p.speed<80||p.speed>300||
  !Number.isInteger(p.amplitude)||p.amplitude<0||p.amplitude>200)
  throw Error('invalid_voice_profile');
 return Object.freeze(p);
}
const executable=()=>process.env.MIKOSHI_ESPEAK_BINARY||'espeak-ng';
export function available(){
 const r=spawnSync(executable(),['--version'],{timeout:1500,windowsHide:true});
 return r.status===0&&!r.error;
}
export function speak(text){
 if(typeof text!=='string'||!text.trim()||text.length>80||/[\x00-\x08]/.test(text))
  throw Error('invalid_utterance');
 if(!available())throw Error('tts_provider_offline');
 const p=profile();
 const r=spawnSync(executable(),['--stdout','-v',p.language,'-p',String(p.pitch),
  '-s',String(p.speed),'-a',String(p.amplitude),text],{
  encoding:'buffer',windowsHide:true,timeout:8000,maxBuffer:1024*1024});
 if(r.error||r.status!==0||!r.stdout?.length)throw Error('tts_failed');
 return {mime:'audio/wav',audioBase64:r.stdout.toString('base64'),
  voiceProfile:{...p},provider:'espeak-ng',model:'none'};
}
