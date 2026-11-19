// User-initiated, bounded short microphone session. No background capture.
export async function captureStream(){
 if(!globalThis.navigator?.mediaDevices?.getUserMedia||
  typeof MediaRecorder==='undefined'||typeof AudioContext==='undefined')
  throw Error('microphone_not_supported');
 const stream=await navigator.mediaDevices.getUserMedia({audio:{
  echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
 let recorder=null,context=null,timer=null;
 try{
  recorder=new MediaRecorder(stream);
  const pieces=[],done=new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data?.size)pieces.push(e.data);};
   recorder.onerror=()=>reject(Error('microphone_capture_failed'));
   recorder.onstop=()=>resolve(new Blob(pieces,{type:recorder.mimeType}));
  });
  recorder.start();
  timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},2000);
  const blob=await done;
  if(blob.size<256||blob.size>4*1024*1024)throw Error('microphone_capture_size');
  context=new AudioContext();
  const decoded=await context.decodeAudioData(await blob.arrayBuffer());
  const channel=decoded.getChannelData(0),rate=decoded.sampleRate;
  if(!Number.isFinite(rate)||rate<8000||rate>96000)throw Error('sample_rate');
  const count=Math.min(48000,Math.floor(channel.length*12000/rate));
  if(count<4800)throw Error('microphone_capture_too_short');
  const samples=new Array(count);
  for(let i=0;i<count;i++){
   const x=i*rate/12000,j=Math.floor(x),t=x-j;
   const a=channel[Math.min(j,channel.length-1)];
   const b=channel[Math.min(j+1,channel.length-1)];
   if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('invalid_microphone_pcm');
   samples[i]=Math.max(-1,Math.min(1,a+(b-a)*t));
  }
  return {samples,sampleRate:12000,source:'explicit-microphone'};
 }finally{
  if(timer!==null)clearTimeout(timer);
  if(recorder?.state==='recording')recorder.stop();
  stream.getTracks().forEach(t=>t.stop());
  if(context)await context.close();
 }
}
