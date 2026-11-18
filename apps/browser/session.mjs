import {spawn} from 'node:child_process';
import {mkdir,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {engine,config,allowedUrl} from './engine.mjs';
import {cdp} from './cdp.mjs';
import * as tabs from './tab_actions.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class BrowserSession{
 constructor(runtime){this.runtime=runtime;this.port=null;this.child=null;this.tabs=new Set();}
 endpoint(path){if(!this.port)throw Error('browser_not_running');
  return new URL(path,'http://'+(process.env.ADA_LOOPBACK_HOST||'127.0.0.1')+':'+this.port).href;}
 async request(path,method='GET'){
  const res=await fetch(this.endpoint(path),{method,signal:AbortSignal.timeout(5000)});
  if(!res.ok)throw Error('browser_endpoint_'+res.status);
  return res.json();
 }
 async start(){
  if(this.port)return;
  const c=await config(),found=await engine(c);
  const profile=join(this.runtime,'browser','sessions',randomUUID());
  await mkdir(profile,{recursive:true});
  const flags=[...c.flags,'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',
   '--user-data-dir='+profile,'--window-size='+c.viewport.width+','+c.viewport.height,
   'about:blank'];
  const child=spawn(found.path,flags,{windowsHide:true,stdio:'ignore'});
  this.child=child;this.profile=profile;this.settings=c;
  child.on('error',()=>{this.port=null;});
  try{
   const deadline=Date.now()+c.startupTimeoutMs;
   while(Date.now()<deadline){
    if(child.exitCode!==null)throw Error('browser_process_exited');
    try{
     const data=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/);
     const port=Number(data[0]);
     if(Number.isInteger(port)&&port>=1024&&port<=65535){
      this.port=port;
      const version=await this.request('/json/version');
      if(!version.webSocketDebuggerUrl?.startsWith('ws://'))throw Error('bad_debugger');
      this.browserWs=version.webSocketDebuggerUrl;
      this.engineInfo={id:found.source,product:version.Browser||'Chromium',protocol:version['Protocol-Version']};
      return;
     }
    }catch(e){if(!['ENOENT','ECONNREFUSED','fetch failed'].includes(e.code||e.message)){}}
    await pause(130);
   }
   throw Error('browser_start_timeout');
  }catch(e){await this.close();throw e;}
 }
 async pages(){
  await this.start();
  const list=await this.request('/json/list');
  const pages=list.filter(x=>x.type==='page'&&this.tabs.has(x.id));
  return pages.map(x=>({id:x.id,url:x.url,title:x.title}));
 }
 async target(id){
  if(typeof id!=='string'||!this.tabs.has(id))throw Error('unknown_tab');
  const list=await this.request('/json/list');
  const target=list.find(x=>x.id===id&&x.type==='page');
  if(!target?.webSocketDebuggerUrl)throw Error('tab_closed');
  return target;
 }
 async open(url){
  const href=allowedUrl(url);await this.start();
  if(this.tabs.size>=this.settings.maxTabs)throw Error('tab_limit');
  const tab=await this.request('/json/new?about:blank','PUT');
  this.tabs.add(tab.id);await this.navigate(tab.id,href);
  return {id:tab.id,url:href};
 }
 async navigate(id,url){
  const href=allowedUrl(url),tab=await this.target(id);
  await cdp(tab.webSocketDebuggerUrl,'Page.navigate',{url:href});
  return {id,url:href};
 }
 async history(id,step){return tabs.history(this,id,step);}
 async reload(id){return tabs.reload(this,id);}
 async closeTab(id){return tabs.closeTab(this,id);}
 async shot(id){
  const tab=await this.target(id);
  const image=await cdp(tab.webSocketDebuggerUrl,'Page.captureScreenshot',{
   format:this.settings.screenshot.format,quality:this.settings.screenshot.quality,
   captureBeyondViewport:false});
  if(typeof image.data!=='string'||image.data.length>1400000)throw Error('screenshot_too_large');
  return {id,src:'data:image/jpeg;base64,'+image.data,viewport:this.settings.viewport};
 }
 async click(id,x,y){
  const tab=await this.target(id),{width,height}=this.settings.viewport;
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)
   throw Error('click_out_of_bounds');
  for(const type of ['mousePressed','mouseReleased'])
   await cdp(tab.webSocketDebuggerUrl,'Input.dispatchMouseEvent',{
    type,x,y,button:'left',clickCount:1});
  return {clicked:true};
 }
 async type(id,text){
  if(typeof text!=='string'||text.length>2000)throw Error('invalid_text');
  const tab=await this.target(id);
  await cdp(tab.webSocketDebuggerUrl,'Input.insertText',{text});
  return {inserted:text.length};
 }
 async close(){
  this.port=null;this.tabs.clear();
  if(this.browserWs)try{await cdp(this.browserWs,'Browser.close',{},2000);}catch{}
  const child=this.child;this.browserWs=null;this.child=null;
  if(child?.exitCode===null)child.kill();
  let profileRemoved=false;
  if(this.profile){
   try{await rm(this.profile,{recursive:true,force:true,maxRetries:6,retryDelay:250});
    profileRemoved=true;}catch{}
  }
  this.profile=null;return {stopped:true,profileRemoved};
 }
}
