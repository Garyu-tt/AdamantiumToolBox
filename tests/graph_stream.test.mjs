import {strict as assert} from 'node:assert';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {GraphEventHub} from '../core/graph_stream.mjs';
const hub=new GraphEventHub({heartbeatMs:100000,maxClients:2});
const token='test_authorized_token_for_local_fixture_only';
const server=createServer((req,res)=>{
 if(req.headers.authorization!=='Bearer '+token){res.writeHead(401);res.end();return;}
 if(req.method!=='GET'||req.url!=='/api/events'){res.writeHead(404);res.end();return;}
 hub.subscribe(req,res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,streams=[];
async function subscribe(auth=token) {
 const req=request({port,host:'127.0.0.1',path:'/api/events',headers:{Authorization:'Bearer '+auth}});
 req.end();const [res]=await once(req,'response');
 let content='';res.on('data',b=>{content+=b.toString();});
 streams.push({req,res,content:()=>content});return res;
}
try {
 const forbidden=await subscribe('invalid');assert.equal(forbidden.statusCode,401);
 const first=await subscribe(),second=await subscribe();
 assert.equal(first.statusCode,200);assert.equal(second.statusCode,200);
 assert.equal(hub.clients.size,2);
 const overload=await subscribe();assert.equal(overload.statusCode,503);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(streams[1].content(),/event: ready/);
 assert.equal(hub.track({nodes:[],edges:[]}),false);
 assert.equal(hub.track({nodes:[],edges:[]}),false);
 assert.equal(hub.revision,0);
 assert.equal(hub.track({nodes:[{id:'x'}],edges:[]}),true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(streams[1].content(),/id: 1\nevent: invalidate/);
 assert.match(streams[2].content(),/id: 1\nevent: invalidate/);
 first.destroy();await new Promise(resolve=>setTimeout(resolve,40));
 assert.equal(hub.clients.size,1);
 assert.equal(hub.invalidate(),2);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(streams[2].content(),/id: 2\nevent: invalidate/);
 console.log('MAS_GRAPH_STREAM_OK auth fanout revision cap revoke cleanup');
}finally {hub.close();for(const s of streams)s.req.destroy();await new Promise(r=>server.close(r));}
