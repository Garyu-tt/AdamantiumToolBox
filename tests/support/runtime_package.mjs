import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {seal} from '../../standards/mesh/identity.mjs';
import {packDir} from '../../standards/mesh/bundle.mjs';
import {receive} from '../../standards/mesh/store.mjs';
export async function fixturePackage(root,runtime,owner,version,port,crash){
 const source=join(root,'candidate-'+version.replace(/\W/g,''));
 await mkdir(source);
 const manifest={mas:'1.0',id:'fixture',name:'Runtime Fixture',version,icon:'fixture',
 lifecycle:'independent',service:{protocol:'mas-http-1',port},
 ui:{standard:'mas-ui-1',mode:'embedded-and-standalone'},auth:{mode:'host-delegated'},
 permissions:['workspace.read'],events:{schema:'mas-event-1'},
 data:{refs:'mas-ref-1'},updates:{strategy:'semver',migrations:[]}};
 await writeFile(join(source,'manifest.json'),JSON.stringify(manifest));
 const lines=[
 "import http from 'node:http';",
 "const secret=process.env.ADA_INTERNAL_KEY;",
 "const spec={app:'fixture',version:1,nodes:[{id:'fixture.view',type:'view',title:'Fixture',icon:'fixture',requires:['workspace.read']}],edges:[]};",
 "const reply=(res,data)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};",
 "http.createServer((req,res)=>{",
 "if(req.url==='/health')return reply(res,{app:'fixture'});",
 "if(req.url==='/graph'&&req.headers['x-internal-key']===secret)return reply(res,spec);",
 "res.writeHead(403);res.end();",
 "}).listen(Number(process.env.APP_PORT),'127.0.0.1');"
 ];
 if(crash)lines.push("setTimeout(()=>process.exit(7),1200);");
 await writeFile(join(source,'service.mjs'),lines.join('\n'));
 await writeFile(join(source,'view.js'),'export async function mount(host){host.textContent="Fixture"}');
 const envelope=seal(await packDir(source),owner);
 await receive(runtime,envelope,{[owner.id]:{publicKey:owner.publicKey,receive:true}});
 return envelope.hash;
}
