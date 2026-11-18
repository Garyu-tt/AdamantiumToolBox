import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const serialPattern=/^[a-zA-Z0-9._:-]{1,128}$/;
export async function adb(args){
 const bin=process.env.XR_ADB_BIN||'adb';
 try{
  const result=await run(bin,args,{timeout:4500,maxBuffer:262144,windowsHide:true});
  return {ok:true,text:result.stdout.trim()};
 }catch(error){
  return {ok:false,error:error.code==='ENOENT'?'adb_not_installed':'adb_failed',
   detail:error.killed?'timeout':error.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER'?'too_much_output':'command_failed'};
 }
}
export function parseDevices(text){
 return text.split(/\r?\n/).filter(x=>x&&!x.startsWith('List of devices attached')&&
  !x.startsWith('* daemon')).map(line=>{
  const [serial,status,...rest]=line.trim().split(/\s+/);
  return {serial,status,description:rest.join(' ')};
 }).filter(x=>serialPattern.test(x.serial)&&x.status);
}
export function parsePackages(text){
 return [...new Set(text.split(/\r?\n/).filter(x=>x.startsWith('package:'))
  .map(x=>x.slice(8).trim()).filter(x=>/^[a-zA-Z][a-zA-Z0-9_.]{0,180}$/.test(x)))].sort();
}
export async function devices(){
 const r=await adb(['devices','-l']);
 return r.ok?{ok:true,devices:parseDevices(r.text)}:r;
}
export async function usbRoutes(){
 const [forward,reverse]=await Promise.all([adb(['forward','--list']),adb(['reverse','--list'])]);
 return {forward,reverse,note:'routes_observed_not_streaming_verified'};
}
export async function inventory(params={}){
 const serial=params?.serial;
 if(typeof serial!=='string'||!serialPattern.test(serial))return {ok:false,error:'invalid_serial'};
 const visible=await devices();
 if(!visible.ok)return visible;
 if(!visible.devices.some(d=>d.serial===serial&&d.status==='device'))
  return {ok:false,error:'device_not_authorized_or_offline'};
 const [sys,user,model,abi,build]=await Promise.all([
  adb(['-s',serial,'shell','pm','list','packages','-s']),
  adb(['-s',serial,'shell','pm','list','packages','-3']),
  adb(['-s',serial,'shell','getprop','ro.product.model']),
  adb(['-s',serial,'shell','getprop','ro.product.cpu.abi']),
  adb(['-s',serial,'shell','getprop','ro.build.version.release'])
 ]);
 if(![sys,user,model,abi,build].every(r=>r.ok))
  return {ok:false,error:'device_inventory_incomplete'};
 return {ok:true,serial,observed_at:new Date().toISOString(),
  properties:{model:model.text.slice(0,120),abi:abi.text.slice(0,60),android:build.text.slice(0,60)},
  packages:{system:parsePackages(sys.text),user:parsePackages(user.text)},
  note:'package_names_only_not_apk_backup'};
}
