import {createHash} from 'node:crypto';
// Sends invalidation signals only. /api/graph remains the authority on permissions.
export class GraphEventHub {
 constructor({heartbeatMs=15000,maxClients=64}={}) {
  this.clients=new Set();this.revision=0;this.digest=null;
  this.heartbeatMs=heartbeatMs;this.maxClients=maxClients;
 }
 subscribe(req,res) {
  if(this.clients.size>=this.maxClients) {
   res.writeHead(503,{'Retry-After':'3'});res.end();return false;
  }
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8',
   'Cache-Control':'no-store, no-transform','X-Content-Type-Options':'nosniff',
   'X-Accel-Buffering':'no','Connection':'keep-alive'});
  const peer={res,timer:null,close:null};
  const close=()=>{if(!this.clients.delete(peer))return;
   clearInterval(peer.timer);req.off('close',close);res.off('close',close);};
  peer.close=close;this.clients.add(peer);
  req.on('close',close);res.on('close',close);
  res.write('event: ready\ndata: '+JSON.stringify({revision:this.revision})+'\n\n');
  peer.timer=setInterval(()=>{
   if(!res.write(': heartbeat\n\n')){close();res.end();}
  },this.heartbeatMs);
  peer.timer.unref?.();return true;
 }
 invalidate() {
  this.revision++;
  const body='id: '+this.revision+'\nevent: invalidate\ndata: {}\n\n';
  for(const peer of this.clients)if(!peer.res.write(body)){peer.close();peer.res.end();}
  return this.revision;
 }
 track(snapshot) {
  const digest=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  if(this.digest===digest)return false;
  const first=this.digest===null;this.digest=digest;
  if(!first)this.invalidate();return !first;
 }
 close() {for(const peer of [...this.clients]){peer.close();peer.res.end();}}
}
