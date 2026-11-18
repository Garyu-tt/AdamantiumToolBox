import {createHash} from 'node:crypto';
export function createGraphEvents(readGraph,intervalMs=1500){
 const clients=new Set();
 let revision='',timer=null,busy=false,ticks=0;
 const emit=(res,hash)=>{
  if(res.destroyed)return;
  if(!res.write('event: graph_changed\ndata: '+JSON.stringify({revision:hash})+'\n\n'))
   res.end();
 };
 async function sample(){
  if(busy||!clients.size)return;
  busy=true;
  try{
   const graph=await readGraph();
   const hash=createHash('sha256').update(JSON.stringify(graph)).digest('hex');
   if(hash!==revision){revision=hash;for(const res of clients)emit(res,hash);}
   if(++ticks%10===0)for(const res of clients)if(!res.write(': ping\n\n'))res.end();
  }catch{}finally{busy=false;}
 }
 const interval=Math.max(250,Math.min(15000,Number(intervalMs)||1500));
 return function subscribe(res){
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8',
   'Cache-Control':'no-store, no-transform','Connection':'keep-alive',
   'X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});
  res.flushHeaders?.();
  res.write(': connected\n\n');
  clients.add(res);
  res.on('close',()=>{
   clients.delete(res);
   if(!clients.size){clearInterval(timer);timer=null;revision='';ticks=0;}
  });
  if(revision)emit(res,revision);
  if(!timer){timer=setInterval(sample,interval);timer.unref?.();}
  void sample();
 };
}
