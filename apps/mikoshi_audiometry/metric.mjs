// CPU-only paired-wave feedback for phase-aligned synthetic exercises.
// NOT reliable for unaligned real microphones or different speakers.
const RATE=12000,MAX_SAMPLES=43200;
export function decode(base64){
 if(typeof base64!=='string'||base64.length<44||base64.length>120000||
  !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw Error('invalid_wave_encoding');
 const b=Buffer.from(base64,'base64');
 if(b.toString('base64')!==base64||b.length<44||b.length>44+MAX_SAMPLES*2||
  b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE'||
  b.toString('ascii',12,16)!=='fmt '||b.readUInt32LE(16)!==16||
  b.readUInt16LE(20)!==1||b.readUInt16LE(22)!==1||
  b.readUInt32LE(24)!==RATE||b.readUInt16LE(32)!==2||
  b.readUInt16LE(34)!==16||b.toString('ascii',36,40)!=='data'||
  b.readUInt32LE(4)!==b.length-8||
  b.readUInt32LE(40)!==b.length-44||
  (b.length-44)%2)throw Error('invalid_pcm_wave');
 const count=(b.length-44)/2;
 if(count<2880||count>MAX_SAMPLES)throw Error('invalid_wave_duration');
 const audio=new Float32Array(count);
 for(let i=0;i<count;i++)audio[i]=b.readInt16LE(44+i*2)/32768;
 return audio;
}
export function compare(reference,candidate){
 const a=decode(reference),b=decode(candidate);
 if(a.length!==b.length)throw Error('unaligned_audio_duration');
 let aa=0,bb=0;
 for(let i=0;i<a.length;i++){aa+=a[i]*a[i];bb+=b[i]*b[i];}
 if(aa/a.length<.0001||bb/b.length<.0001)throw Error('silent_audio');
 const ga=Math.sqrt(aa/a.length),gb=Math.sqrt(bb/b.length);
 let error=0,energy=0;
 for(let i=0;i<a.length;i++){
  const da=a[i]/ga,db=b[i]/gb,d=da-db;
  error+=d*d;energy+=da*da+db*db;
 }
 const loss=Math.min(1,error/(energy+1e-12));
 return {schema:'mikoshi.acoustic.feedback.v1',loss:+loss.toFixed(8),
  durationMs:a.length/RATE*1000,frames:Math.floor(a.length/120),
  method:'aligned-normalized-pcm',languageModel:false};
}
