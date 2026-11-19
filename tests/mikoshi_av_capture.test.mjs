import {strict as assert} from 'node:assert';
import {captureAV} from '../apps/mikoshi_classroom/av_capture.js';
// Mock device lifecycle only; no claim about real hardware, codecs or clocks.
let clock=0,closed=0,paused=0,denied=false,decodeFails=false;
const tracks=[];
const devices={getUserMedia:async()=>{
 if(denied)throw Error('camera_permission_denied');
 const pair=[{stop(){this.stopped=true;}},{stop(){this.stopped=true;}}];
 tracks.push(pair);
 return {getTracks:()=>pair,getAudioTracks:()=>[pair[0]]};
}};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:devices},
 configurable:true});
Object.defineProperty(globalThis,'performance',{value:{now:()=>{clock+=200;return clock;}},
 configurable:true});
globalThis.document={createElement:tag=>{
 if(tag==='video')return {muted:false,playsInline:false,videoWidth:320,
  async play(){},pause(){paused++;},srcObject:null};
 if(tag==='canvas')return {width:0,height:0,getContext:()=>({
  drawImage(){},getImageData:()=>{
   const data=new Uint8ClampedArray(8*8*4);
   for(let k=0;k<data.length;k+=4){data[k]=180;data[k+3]=255;}
   return {data};
  }})};
 throw Error('unknown_element');
}};
globalThis.MediaStream=class{constructor(tracks){this.tracks=tracks;}};
globalThis.MediaRecorder=class{
 constructor(){this.state='inactive';this.mimeType='audio/webm';}
 start(){this.state='recording';}
 stop(){
  this.state='inactive';
  this.ondataavailable?.({data:new Blob([new Uint8Array(1024)])});
  this.onstop?.();
 }
};
globalThis.AudioContext=class{
 async decodeAudioData(){
  if(decodeFails)throw Error('decode_failed');
  const channel=Float32Array.from({length:24000},(_,i)=>
   Math.sin(2*Math.PI*i*220/12000)*.2);
  return {sampleRate:12000,getChannelData:()=>channel};
 }
 async close(){closed++;}
};
globalThis.setInterval=fn=>{for(let n=0;n<4;n++)fn();return 10;};
globalThis.clearInterval=()=>{};
globalThis.setTimeout=fn=>{queueMicrotask(fn);return 11;};
globalThis.clearTimeout=()=>{};
const result=await captureAV();
assert.equal(result.schema,'mikoshi.avcapture.v1');
assert(result.frames.length>=2&&result.frames.length<=12);
assert.equal(result.samples.length,24000);
assert.equal(result.sampleRate,12000);
assert.equal(result.verifiedSync,false);
assert.equal(result.uncertaintyMs,160);
assert(tracks[0].every(t=>t.stopped),'all device tracks must stop');
assert.equal(paused,1);assert.equal(closed,1);
decodeFails=true;
await assert.rejects(captureAV(),/decode_failed/);
assert(tracks[1].every(t=>t.stopped),'cleanup also after decoder error');
assert.equal(closed,2);
denied=true;
await assert.rejects(captureAV(),/camera_permission_denied/);
assert.equal(tracks.length,2,'denied request creates no tracks');
console.log('MIKOSHI_AV_CAPTURE_OK permission-gated, bounded, cleanup on success/error');
