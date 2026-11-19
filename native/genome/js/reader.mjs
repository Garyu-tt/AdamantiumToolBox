// Independent Node GA1a wire decoder. No privileged genome expression.
import {Buffer} from 'node:buffer';
export const MAGIC='AGM1', MAX=16*1024*1024, GENES=1000000;
const check=(ok,code)=>{if(!ok)throw new RangeError(code)};
const ASCII=/^[\x20-\x7e]*$/;
export class Reader {
  constructor(data) {
    this.bytes=Buffer.from(data);
    check(this.bytes.length>=10 && this.bytes.length<=MAX,'wire_length');
    this.at=0;
  }
  num(width) {
    check(width>=1 && width<=8 && this.at+width<=this.bytes.length,
      'truncated_wire');
    let n=0n;
    for(let i=0;i<width;i++) n=(n<<8n)|BigInt(this.bytes[this.at++]);
    return n;
  }
  small(width) {return Number(this.num(width))}
  str() {
    const len=this.small(2);
    check(len<=256 && this.at+len<=this.bytes.length,'wire_string_length');
    for(let i=0;i<len;i++)
      check(this.bytes[this.at+i]>=0x20 && this.bytes[this.at+i]<=0x7e,
        'wire_nonascii');
    const s=this.bytes.toString('ascii',this.at,this.at+len);
    this.at+=len;
    check(ASCII.test(s),'wire_nonascii');
    return s;
  }
  port() {
    const id=this.str(),dataType=this.str();
    const direction=this.small(1),semantics=this.small(1);
    check(direction<=1 && semantics<=6,'invalid_port_tag');
    return {id,dataType,direction,semantics};
  }
  gene() {
    const kind=this.small(1),ordinal=this.small(4);
    let payload;
    switch(kind) {
      case 0: {
        const domain=this.small(1),schemaVersion=this.small(4),
          revision=this.num(8);
        check(domain<=5,'invalid_domain');
        payload={domain,schemaVersion,revision}; break;
      }
      case 1: case 3: {
        const owner=this.str(),port=this.port();
        payload={owner,port};break;
      }
      case 2: {
        const id=this.str(),nodeKind=this.small(1),
          typeRef=this.str(),graphRef=this.str(),graphRefRevision=this.num(8);
        check(nodeKind<=9,'invalid_node_kind');
        payload={id,nodeKind,typeRef,graphRef,graphRefRevision};break;
      }
      case 4: {
        const id=this.str(),fromNode=this.str(),fromPort=this.str(),
          toNode=this.str(),toPort=this.str(),
          semantics=this.small(1),delayTicks=this.small(4);
        check(semantics<=6,'invalid_edge_semantics');
        payload={id,fromNode,fromPort,toNode,toPort,semantics,delayTicks};break;
      }
      default:throw new RangeError('unknown_gene');
    }
    return {kind,ordinal,payload};
  }
}
export function decodeWire(data) {
  const r=new Reader(data);
  check(r.bytes.subarray(0,4).toString('ascii')===MAGIC,'bad_magic');
  r.at=4;
  check(r.small(2)===1 && r.small(2)===1,'bad_wire_version');
  const lane=r.small(1);
  check(lane<=2 && r.small(1)===0,'bad_lane_reserved');
  const genomeId=r.str(),rootGraph=r.str(),count=r.small(4);
  check(count>=1 && count<=2048,'chromosome_budget');
  const chromosomes=[];
  let prior='',total=0;
  for(let i=0;i<count;i++){
    const graphId=r.str();
    check(!prior || graphId>prior,'noncanonical_chromosome_order');
    prior=graphId;
    const n=r.small(4);
    total+=n;
    check(n>0 && total<=GENES && n<=Math.floor((r.bytes.length-r.at)/5),
      'gene_budget');
    const genes=[];
    for(let j=0;j<n;j++)genes.push(r.gene());
    chromosomes.push({graphId,genes});
  }
  check(r.at===r.bytes.length,'trailing_bytes');
  return {version:1,genomeId,rootGraph,lane,chromosomes};
}
