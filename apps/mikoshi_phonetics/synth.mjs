// Small additive-formant vowel instrument. Pitch identity stays fixed.
export const RATE=12000,FRAME=2400;
export function motors(value){
 const m=value||{f1:560,f2:1640};
 if(!m||!Number.isFinite(m.f1)||!Number.isFinite(m.f2)||
  m.f1<250||m.f1>1050||m.f2<900||m.f2>3300||m.f2-m.f1<400)
  throw Error('invalid_formant_motors');
 return {f1:Math.round(m.f1),f2:Math.round(m.f2)};
}
export function synth(value,pitch=235){
 const m=motors(value);
 if(!Number.isFinite(pitch)||pitch<170||pitch>340)throw Error('pitch_anchor');
 const partial=[];
 for(let k=1;k*pitch<4400;k++){
  const hz=k*pitch;
  const a=Math.exp(-.5*((hz-m.f1)/145)**2);
  const b=Math.exp(-.5*((hz-m.f2)/245)**2);
  const c=Math.exp(-.5*((hz-3050)/450)**2);
  partial.push({omega:2*Math.PI*hz/RATE,
   amplitude:(.08+3*a+2.6*b+.45*c)/(k**.72)});
 }
 const samples=Array(FRAME).fill(0);
 let peak=0;
 for(let i=0;i<FRAME;i++){
  const edge=Math.min(1,i/130,(FRAME-1-i)/130);
  let v=0;
  for(const h of partial)v+=Math.sin(h.omega*i)*h.amplitude;
  samples[i]=v*edge;peak=Math.max(peak,Math.abs(samples[i]));
 }
 const scale=peak>0?.68/peak:1;
 return samples.map(v=>v*scale);
}
export function wav(samples){
 if(!Array.isArray(samples)||samples.length<1024||samples.length>4096)
  throw Error('invalid_pcm');
 const data=Buffer.alloc(44+samples.length*2);
 data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);
 data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);
 data.writeUInt16LE(1,22);data.writeUInt32LE(RATE,24);
 data.writeUInt32LE(RATE*2,28);data.writeUInt16LE(2,32);
 data.writeUInt16LE(16,34);data.write('data',36);
 data.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++){
  if(!Number.isFinite(samples[i])||Math.abs(samples[i])>1)throw Error('invalid_pcm');
  data.writeInt16LE(Math.round(samples[i]*32767),44+i*2);
 }
 return data.toString('base64');
}
