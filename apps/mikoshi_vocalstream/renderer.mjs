// Continuous-phase CPU formant synthesis for a discovered gesture plan.
export const RATE=12000,FRAME_SAMPLES=120;
export function anchor(){
 const value=process.env.MIKOSHI_VOCAL_ANCHOR_HZ;
 const pitch=value===undefined?235:Number(value);
 if(!Number.isFinite(pitch)||pitch<170||pitch>340)throw Error('vocal_anchor_invalid');
 return pitch;
}
export function validate(trajectory){
 if(!trajectory||trajectory.schema!=='mikoshi.gesture.frames.v1'||
  trajectory.frameMs!==10||!Number.isInteger(trajectory.durationMs)||
  !Array.isArray(trajectory.frames)||trajectory.frames.length<24||
  trajectory.frames.length>360||trajectory.durationMs!==trajectory.frames.length*10||
  !Number.isInteger(trajectory.segments)||trajectory.segments<2||trajectory.segments>6)
  throw Error('invalid_vocal_trajectory');
 for(const m of trajectory.frames){
  if(!m||!Number.isInteger(m.f1)||!Number.isInteger(m.f2)||
   m.f1<250||m.f1>1050||m.f2<900||m.f2>3300||
   m.f2-m.f1<400||typeof m.voiced!=='boolean')
   throw Error('invalid_vocal_frame');
 }
}
function harmonics(m,pitch){
 const values=[];
 for(let k=1;k*pitch<4400;k++){
  const hz=k*pitch;
  const a=Math.exp(-.5*((hz-m.f1)/145)**2);
  const b=Math.exp(-.5*((hz-m.f2)/245)**2);
  const c=Math.exp(-.5*((hz-3050)/450)**2);
  values.push(m.voiced?(.08+3*a+2.6*b+.45*c)/k**.72:0);
 }
 return values;
}
export function render(trajectory,pitch=anchor()){
 validate(trajectory);
 if(!Number.isFinite(pitch)||pitch<170||pitch>340)throw Error('vocal_anchor_invalid');
 const frames=trajectory.frames,total=frames.length*FRAME_SAMPLES;
 const data=new Float64Array(total);
 let previous=harmonics({...frames[0],voiced:false},pitch);
 let peak=0;
 for(let f=0;f<frames.length;f++){
  const current=harmonics(frames[f],pitch);
  for(let n=0;n<FRAME_SAMPLES;n++){
   const sample=f*FRAME_SAMPLES+n,t=(n+1)/FRAME_SAMPLES;
   const edge=Math.min(1,sample/120,(total-1-sample)/120);
   let value=0;
   for(let k=1;k<=current.length;k++){
    const amp=previous[k-1]+(current[k-1]-previous[k-1])*t;
    value+=amp*Math.sin(2*Math.PI*k*pitch*sample/RATE);
   }
   data[sample]=value*edge;
   peak=Math.max(peak,Math.abs(data[sample]));
  }
  previous=current;
 }
 const gain=peak>.68?.68/peak:1;
 return Array.from(data,v=>v*gain);
}
export function wav(samples){
 if(!Array.isArray(samples)||samples.length<1024||samples.length>43200||
  !samples.every(v=>Number.isFinite(v)&&Math.abs(v)<=1))
  throw Error('invalid_vocal_audio');
 const wav=Buffer.alloc(44+samples.length*2);
 wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);
 wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
 wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
 wav.writeUInt32LE(RATE,24);wav.writeUInt32LE(RATE*2,28);
 wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
 wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++)
  wav.writeInt16LE(Math.round(samples[i]*32767),44+i*2);
 return wav.toString('base64');
}
