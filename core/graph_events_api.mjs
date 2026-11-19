import {GraphEventHub} from './graph_stream.mjs';
export {GraphEventHub};
// Explicitly limited to Core's authenticated local listener. Never authorizes invoke.
export async function routeGraphEvents(req,res,{url,token,secret,reply,hub}) {
 if(url.pathname==='/api/events') {
  if(req.headers.authorization!=='Bearer '+token){reply(res,401,{error:'unauthorized'});return true;}
  if(req.method!=='GET'){reply(res,405,{error:'method'});return true;}
  hub.subscribe(req,res);return true;
 }
 if(url.pathname==='/api/internal/graph-invalidated') {
  if(req.headers['x-internal-key']!==secret){reply(res,401,{error:'unauthorized'});return true;}
  if(req.method!=='POST'){reply(res,405,{error:'method'});return true;}
  reply(res,202,{revision:hub.invalidate()});return true;
 }
 return false;
}
