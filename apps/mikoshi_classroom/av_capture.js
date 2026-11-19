// One explicit shared camera+microphone permission; never background capture.
export async function captureAV(){
 if(!navigator?.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'||
  typeof AudioContext==='undefined')throw Error('audiovisual_capture_unsupported');
 const stream=await navigator.mediaDevices.getUserMedia({
  video:{width:{ideal:320},height:{ideal:240},frameRate:{ideal:15}},
  audio:{echoCancellation:false,autoGainControl:false,noiseSuppression:false}});
 let recorder=null,audio=null,timer=null,watchdog=null,interval=null,video=null;
 try{
  video=document.createElement('video');video.muted=true;video.playsInline=true;
  video.srcObject=stream;await video.play();
  const canvas=document.createElement('canvas');
  canvas.width=8;canvas.height=8;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('canvas_unavailable');
  const track=stream.getAudioTracks()[0];
  if(!track)throw Error('microphone_unavailable');
  recorder=new MediaRecorder(new MediaStream([track]));
  const pieces=[],done=new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data?.size)pieces.push(e.data);};
   recorder.onerror=()=>reject(Error('av_capture_recorder_error'));
   recorder.onstop=()=>resolve(new Blob(pieces,{type:recorder.mimeType}));
  });
  const frames=[],started=performance.now();
  const frame=()=>{
   if(frames.length>=12||!video.videoWidth)return;
   ctx.drawImage(video,0,0,8,8);
   const rgba=ctx.getImageData(0,0,8,8).data;
   const pixels=[];
   for(let i=0;i<rgba.length;i+=4)
    for(let c=0;c<3;c++)pixels.push(+((rgba[i+c]||0)/255).toFixed(5));
   const timeMs=Math.max(0,Math.min(4000,Math.round(performance.now()-started)));
   if(!frames.length||timeMs>frames.at(-1).timeMs)
    frames.push({timeMs,pixels});
  };
  recorder.start();frame();interval=setInterval(frame,190);
  await new Promise(resolve=>{timer=setTimeout(resolve,2000);});
  clearInterval(interval);interval=null;frame();
  if(recorder.state==='recording')recorder.stop();
  const blob=await Promise.race([done,new Promise((_,reject)=>{
   watchdog=setTimeout(()=>reject(Error('recorder_stop_timeout')),1600);
  })]);
  if(blob.size<256||blob.size>4*1024*1024)
   throw Error('av_capture_audio_size');
  if(frames.length<2)throw Error('camera_frames_unavailable');
  audio=new AudioContext();
  const decoded=await audio.decodeAudioData(await blob.arrayBuffer());
  const channel=decoded.getChannelData(0),rate=decoded.sampleRate;
  if(!Number.isFinite(rate)||rate<8000||rate>96000)
   throw Error('av_sample_rate_invalid');
  const count=Math.min(48000,Math.floor(channel.length*12000/rate));
  if(count<4800)throw Error('av_audio_too_short');
  const samples=new Array(count);
  for(let i=0;i<count;i++){
   const at=i*rate/12000,j=Math.floor(at),t=at-j;
   const a=channel[Math.min(j,channel.length-1)];
   const b=channel[Math.min(j+1,channel.length-1)];
   if(!Number.isFinite(a)||!Number.isFinite(b))
    throw Error('invalid_av_audio_samples');
   samples[i]=Math.max(-1,Math.min(1,a+(b-a)*t));
  }
  return {schema:'mikoshi.avcapture.v1',frames,samples,sampleRate:12000,
   uncertaintyMs:160,clock:'best-effort-performance-now',
   verifiedSync:false,source:'one-explicit-shared-stream'};
 }finally{
  if(interval!==null)clearInterval(interval);
  if(timer!==null)clearTimeout(timer);
  if(watchdog!==null)clearTimeout(watchdog);
  if(recorder?.state==='recording')recorder.stop();
  stream.getTracks().forEach(track=>track.stop());
  if(video){video.pause();video.srcObject=null;}
  if(audio)await audio.close();
 }
}
