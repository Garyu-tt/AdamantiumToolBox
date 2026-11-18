import {isIP} from 'node:net';
const hex=(s,n)=>typeof s==='string'&&s.length===n&&new RegExp('^[0-9a-fA-F]{'+n+'}$').test(s);
const iface=s=>typeof s==='string'&&/^[a-zA-Z0-9_.:@-]{1,64}$/.test(s);
const ipv4=s=>[6,4,2,0].map(i=>parseInt(s.slice(i,i+2),16)).join('.');
const ipv6=s=>Array.from({length:8},(_,i)=>s.slice(i*4,i*4+4)).join(':');
const contiguous=mask=>{const bits=mask.split('.').map(Number).map(x=>x.toString(2).padStart(8,'0')).join('');
 return /^1*0*$/.test(bits)?bits.indexOf('0')===-1?32:bits.indexOf('0'):null;};
const rows=(raw,skipHeader=false,max=4096)=>{
 if(typeof raw!=='string'||raw.length>262144)throw Error('invalid_route_source');
 const lines=raw.trim()?raw.trim().split(/\r?\n/):[];
 if(lines.length>max+(skipHeader?1:0))throw Error('route_limit');
 return lines.slice(skipHeader?1:0).filter(Boolean);
};
export function parseIpv4Routes(raw){
 const routes=[],issues=[];
 for(const [i,line] of rows(raw,true).entries()){
  const x=line.trim().split(/\s+/),[name,dst,via,flags,,,metric,mask]=x;
  if(x.length<8||!iface(name)||![dst,via,mask].every(v=>hex(v,8))||!/^[0-9a-fA-F]{1,8}$/.test(flags)||!/^\d+$/.test(metric)){
   issues.push({code:'invalid_ipv4_route',row:i+2});continue;
  }
  const dest=ipv4(dst),gateway=ipv4(via),prefix=contiguous(ipv4(mask));
  if(prefix===null||isIP(dest)!==4||isIP(gateway)!==4){
   issues.push({code:'invalid_ipv4_mask',row:i+2});continue;
  }
  routes.push({family:'IPv4',interface:name,destination:dest+'/'+prefix,
   gateway:gateway==='0.0.0.0'?null:gateway,metric:Number(metric),
   active:(parseInt(flags,16)&1)!==0});
 }
 return {routes,issues};
}
export function parseIpv6Routes(raw){
 const routes=[],issues=[];
 for(const [i,line] of rows(raw).entries()){
  const x=line.trim().split(/\s+/);
  if(x.length<10||!hex(x[0],32)||!hex(x[2],32)||!hex(x[4],32)||
   ![x[1],x[3]].every(v=>hex(v,2))||![x[5],x[6],x[7],x[8]].every(v=>hex(v,8))||
   !iface(x[9])||parseInt(x[1],16)>128||parseInt(x[3],16)>128){
   issues.push({code:'invalid_ipv6_route',row:i+1});continue;
  }
  const dst=ipv6(x[0]),gw=ipv6(x[4]);
  routes.push({family:'IPv6',interface:x[9],
   destination:dst+'/'+parseInt(x[1],16),
   gateway:/^0(:0){7}$/.test(gw)?null:gw,
   metric:parseInt(x[5],16),active:(parseInt(x[8],16)&1)!==0});
 }
 return {routes,issues};
}
