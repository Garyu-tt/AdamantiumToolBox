export function watchGraphEvents(token,onChange){
 let stopped=false,controller=null,retry=null,last='';
 const connect=async()=>{
  if(stopped)return;
  controller=new AbortController();
  try{
   const response=await fetch('/api/graph/events',{headers:{
    Authorization:'Bearer '+token,Accept:'text/event-stream'},
    signal:controller.signal,cache:'no-store'});
   if(!response.ok||!response.body)throw Error('events_unavailable');
   const reader=response.body.getReader(),decoder=new TextDecoder();
   let buffer='';
   while(!stopped){
    const {done,value}=await reader.read();if(done)break;
    buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');
    if(buffer.length>32768)throw Error('event_frame_too_large');
    let index=buffer.indexOf('\n\n');
    while(index>=0){
     const frame=buffer.slice(0,index);buffer=buffer.slice(index+2);
     if(frame.split('\n').includes('event: graph_changed')){
      const data=frame.split('\n').find(line=>line.startsWith('data:'));
      try{
       const revision=JSON.parse(data?.slice(5)||'{}').revision;
       if(revision&&revision!==last){last=revision;onChange();}
      }catch{}
     }
     index=buffer.indexOf('\n\n');
    }
   }
  }catch{}
  if(!stopped)retry=setTimeout(connect,5000);
 };
 void connect();
 return ()=>{stopped=true;controller?.abort();clearTimeout(retry);};
}
