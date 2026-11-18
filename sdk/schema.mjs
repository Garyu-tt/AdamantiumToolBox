const types=new Set(['object','array','string','number','integer','boolean','null']);
const shared=new Set(['type','enum']);
const specific={
 object:['properties','required','additionalProperties'],
 array:['items','minItems','maxItems'],
 string:['minLength','maxLength'],
 number:['minimum','maximum'],integer:['minimum','maximum'],
 boolean:[],null:[]};
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const scalar=v=>v===null||['string','boolean','number'].includes(typeof v)&&
 (typeof v!=='number'||Number.isFinite(v));
export function assertSchema(schema){
 const seen=new WeakSet();let count=0;
 function visit(s,depth){
  if(!obj(s)||seen.has(s)||++count>256||depth>16||!types.has(s.type))
   throw Error('schema_invalid');
  seen.add(s);
  const allowed=new Set([...shared,...specific[s.type]]);
  if(Object.keys(s).some(k=>!allowed.has(k)))throw Error('schema_unsupported');
  if(s.enum!==undefined&&(!Array.isArray(s.enum)||!s.enum.length||
   s.enum.length>32||!s.enum.every(scalar)))throw Error('schema_invalid');
  if(s.type==='object'){
   if(s.properties!==undefined&&!obj(s.properties))throw Error('schema_invalid');
   const props=s.properties||{},keys=Object.keys(props);
   if(keys.length>128||keys.some(k=>!k||k.length>128||
    ['__proto__','prototype','constructor'].includes(k)))throw Error('schema_invalid');
   if(s.required!==undefined&&(!Array.isArray(s.required)||
    new Set(s.required).size!==s.required.length||
    s.required.some(k=>typeof k!=='string'||!Object.hasOwn(props,k))))
    throw Error('schema_invalid');
   if(s.additionalProperties!==undefined&&typeof s.additionalProperties!=='boolean')
    throw Error('schema_unsupported');
   for(const value of Object.values(props))visit(value,depth+1);
  }
  if(s.type==='array'&&s.items!==undefined)visit(s.items,depth+1);
  for(const [min,max] of [['minItems','maxItems'],['minLength','maxLength'],
   ['minimum','maximum']]){
   for(const name of [min,max])if(s[name]!==undefined&&
    (!Number.isFinite(s[name])||(min!=='minimum'&&
     (!Number.isInteger(s[name])||s[name]<0))))throw Error('schema_invalid');
   if(s[min]!==undefined&&s[max]!==undefined&&s[min]>s[max])
    throw Error('schema_invalid');
  }
 }
 visit(schema,0);return true;
}
export function validateValue(schema,value){
 assertSchema(schema);
 const seen=new WeakSet();let visited=0;
 function check(s,v,depth){
  if(++visited>10000||depth>24)return false;
  const ok=s.type==='null'?v===null:s.type==='array'?Array.isArray(v):
   s.type==='object'?obj(v)&&[null,Object.prototype].includes(Object.getPrototypeOf(v)):
   s.type==='integer'?Number.isSafeInteger(v):
   s.type==='number'?typeof v==='number'&&Number.isFinite(v):
   typeof v===s.type;
  if(!ok||s.enum&&!s.enum.some(x=>Object.is(x,v)))return false;
  if(s.type==='string'&&((s.minLength!==undefined&&v.length<s.minLength)||
   (s.maxLength!==undefined&&v.length>s.maxLength)))return false;
  if(['number','integer'].includes(s.type)&&
   ((s.minimum!==undefined&&v<s.minimum)||(s.maximum!==undefined&&v>s.maximum)))
   return false;
  if(s.type==='array'||s.type==='object'){
   if(seen.has(v))return false;seen.add(v);
  }
  if(s.type==='array'){
   if(s.minItems!==undefined&&v.length<s.minItems||
    s.maxItems!==undefined&&v.length>s.maxItems)return false;
   if(s.items&&v.some(x=>!check(s.items,x,depth+1)))return false;
  }
  if(s.type==='object'){
   const props=s.properties||{},keys=Object.keys(v);
   if((s.required||[]).some(k=>!Object.hasOwn(v,k)))return false;
   if(s.additionalProperties===false&&keys.some(k=>!Object.hasOwn(props,k)))
    return false;
   for(const k of keys)if(Object.hasOwn(props,k)&&!check(props[k],v[k],depth+1))
    return false;
  }
  return true;
 }
 return check(schema,value,0);
}
