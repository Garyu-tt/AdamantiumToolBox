import {strict as assert} from 'node:assert';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {GraphEventHub,routeGraphEvents} from '../core/graph_events_api.mjs';
const hub=new GraphEventHub({heartbeatMs:100000});
const secret='internal_key_sufficient_length_fixture';
const token='user_token_sufficient_length_fixture';
const reply=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(!await routeGraphEvents(req,res,{url,token,secret,reply,hub}))reply(res,404,{error:'not_found'});
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const port=server.address().port;
const call=async(path,method,headers={})=>{
 const req=request({port,host:'127.0.0.1',path,method,headers});req.end();
 const [res]=await once(req,'response');
 if(res.headers['content-type']?.startsWith('text/event-stream'))return {req,res};
 let body='';for await (const chunk of res)body+=chunk;
 return {status:res.statusCode,body};
};
try {
 assert.equal((await call('/api/events','GET')).status,401);
 assert.equal((await call('/api/events','POST',{Authorization:'Bearer '+token})).status,405);
 assert.equal((await call('/api/internal/graph-invalidated','POST')).status,401);
 assert.equal((await call('/api/internal/graph-invalidated','GET',{'X-Internal-Key':secret})).status,405);
 assert.equal((await call('/outside','GET')).status,404);
 const live=await call('/api/events','GET',{Authorization:'Bearer '+token});
 assert.equal(live.res.statusCode,200);
 assert.equal((await call('/api/internal/graph-invalidated','POST',{'X-Internal-Key':secret})).status,202);
 live.req.destroy();
 console.log('MAS_GRAPH_EVENTS_API_OK local authenticated route/denial');
} finally {hub.close();await new Promise(ok=>server.close(ok));}
