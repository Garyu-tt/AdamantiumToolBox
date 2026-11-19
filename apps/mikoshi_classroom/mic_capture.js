import {lessonPcm} from './pcm.js';
// Explicit user-initiated microphone access; the recording stays in memory.
export async function captureLesson(){
 if(!globalThis.navigator?.mediaDevices?.getUserMedia||
  typeof MediaRecorder==='undefined'||typeof AudioContext==='undefined')
  throw Error('microphone_not_supported');
 const stream=await navigator.mediaDevices.getUserMedia({
  audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
 let recorder=null,context=null,timer=null;
 try{
  recorder=new MediaRecorder(stream);
  const chunks=[];
  const done=new Promise((ok,bad)=>{
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
   recorder.onerror=()=>bad(Error('microphone_capture_failed'));
   recorder.onstop=()=>ok(new Blob(chunks,{type:recorder.mimeType}));
  });
  recorder.start();
  timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},950);
  const blob=await done;
  if(blob.size<256)throw Error('microphone_capture_empty');
  context=new AudioContext();
  const decoded=await context.decodeAudioData(await blob.arrayBuffer());
  return {samples:lessonPcm(decoded.getChannelData(0),decoded.sampleRate),
   sampleRate:12000};
 }finally{
  if(timer!==null)clearTimeout(timer);
  if(recorder?.state==='recording')recorder.stop();
  stream.getTracks().forEach(track=>track.stop());
  if(context)await context.close();
 }
}
