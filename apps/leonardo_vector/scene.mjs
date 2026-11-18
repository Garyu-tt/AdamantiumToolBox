import {createHash} from 'node:crypto';
const colors=/^#[0-9a-fA-F]{6}$/;
const escapeText=s=>String(s).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/&/g,'&amp;')
 .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function num(value,min,max,name){
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)
  throw Error('invalid_'+name);
 return Number(value.toFixed(4));
}
const coordinate=(v,name)=>num(v,-8192,8192,name);
function paint(value,name){
 if(typeof value!=='string'||!(colors.test(value)||value==='none'))
  throw Error('invalid_'+name);
 return value;
}
const attr=(s,n,lo,hi)=>num(s[n],lo,hi,n);
function element(s){
 if(!s||typeof s!=='object'||Array.isArray(s))throw Error('invalid_shape');
 const type=s.type,fill=paint(s.fill??'#597bb8','fill');
 const opacity=s.opacity===undefined?1:num(s.opacity,0,1,'opacity');
 const common=' fill="'+fill+'" opacity="'+opacity+'"';
 if(type==='rect')return '<rect x="'+coordinate(s.x,'x')+'" y="'+coordinate(s.y,'y')+
  '" width="'+attr(s,'width',0,8192)+'" height="'+attr(s,'height',0,8192)+'"'+common+'/>';
 if(type==='circle')return '<circle cx="'+coordinate(s.cx,'cx')+'" cy="'+coordinate(s.cy,'cy')+
  '" r="'+attr(s,'r',0,8192)+'"'+common+'/>';
 if(type==='ellipse')return '<ellipse cx="'+coordinate(s.cx,'cx')+'" cy="'+coordinate(s.cy,'cy')+
  '" rx="'+attr(s,'rx',0,8192)+'" ry="'+attr(s,'ry',0,8192)+'"'+common+'/>';
 if(type==='line')return '<line x1="'+coordinate(s.x1,'x1')+'" y1="'+coordinate(s.y1,'y1')+
  '" x2="'+coordinate(s.x2,'x2')+'" y2="'+coordinate(s.y2,'y2')+
  '" stroke="'+paint(s.stroke??'#597bb8','stroke')+
  '" stroke-width="'+num(s.strokeWidth??2,0,128,'strokeWidth')+'" opacity="'+opacity+'"/>';
 if(type==='text'){
  if(typeof s.text!=='string'||s.text.length>160)throw Error('invalid_text');
  return '<text x="'+coordinate(s.x,'x')+'" y="'+coordinate(s.y,'y')+
   '" font-size="'+num(s.fontSize??20,4,256,'fontSize')+
   '" font-family="sans-serif"'+common+'>'+escapeText(s.text)+'</text>';
 }
 throw Error('unsupported_shape');
}
function procedural(prompt,w,h){
 const digest=createHash('sha256').update(prompt).digest(),seed=digest.readUInt32LE();
 let state=seed;
 const random=()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296);
 const tint=n=>'#'+[0,1,2].map(i=>(70+digest[(n+i)%32]%150).toString(16).padStart(2,'0')).join('');
 const scene=[{type:'rect',x:0,y:0,width:w,height:h,fill:tint(0)}];
 for(let i=0;i<14;i++)scene.push({type:i%4===0?'rect':'circle',
  ...((i%4===0)?{x:Math.floor(random()*w),y:Math.floor(random()*h),
   width:Math.floor(10+random()*w/3),height:Math.floor(10+random()*h/3)}:
   {cx:Math.floor(random()*w),cy:Math.floor(random()*h),
    r:Math.floor(8+random()*Math.min(w,h)/4)}),
  fill:tint(i+1),opacity:Number((0.28+random()*0.65).toFixed(3))});
 return scene;
}
export function vectorSVG(prompt,options={}){
 if(typeof prompt!=='string'||prompt.length>4000||!options||
  typeof options!=='object'||Array.isArray(options))throw Error('invalid_vector_request');
 const width=num(options.width??512,16,2048,'width');
 const height=num(options.height??512,16,2048,'height');
 const scene=options.scene===undefined?procedural(prompt,width,height):options.scene;
 if(!Array.isArray(scene)||scene.length>96)throw Error('invalid_scene');
 const body=scene.map(element).join('');
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+
  '" viewBox="0 0 '+width+' '+height+'"><title>'+escapeText(prompt.slice(0,120))+
  '</title>'+body+'</svg>';
 if(Buffer.byteLength(svg,'utf8')>110000)throw Error('svg_too_large');
 return svg;
}
export function vectorArtifact(prompt,options={}){
 return {mime:'image/svg+xml',encoding:'base64',
  data:Buffer.from(vectorSVG(prompt,options),'utf8').toString('base64')};
}
