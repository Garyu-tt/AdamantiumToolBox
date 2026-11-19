// Independent Node GA1a canonical encoder; no execution or key access.
import {Buffer} from 'node:buffer';
import {MAX,GENES,decodeWire} from './reader.mjs';
const check=(ok,code)=>{if(!ok)throw new RangeError(code)};
const ASCII=/^[\x20-\x7e]*$/;
class Writer {
  constructor(){this.parts=[];this.size=0}
  raw(bytes){
    check(this.size+bytes.length<=MAX,'wire_budget');
    this.parts.push(bytes);this.size+=bytes.length;
  }
  num(value,width){
    let n=BigInt(value);
    check(n>=0n && n<(1n<<BigInt(width*8)),'number_range');
    const buf=Buffer.alloc(width);
    for(let i=width-1;i>=0;--i){buf[i]=Number(n&255n);n>>=8n}
    this.raw(buf);
  }
  str(value){
    check(typeof value==='string' && value.length<=256 &&
      ASCII.test(value),'wire_string');
    const buf=Buffer.from(value,'ascii');
    this.num(buf.length,2);this.raw(buf);
  }
  port(p){
    this.str(p.id);this.str(p.dataType);
    this.num(p.direction,1);this.num(p.semantics,1);
  }
  gene(g){
    this.num(g.kind,1);this.num(g.ordinal,4);
    const p=g.payload;
    switch(g.kind){
      case 0:
        this.num(p.domain,1);this.num(p.schemaVersion,4);
        this.num(p.revision,8);break;
      case 1:case 3:
        this.str(p.owner);this.port(p.port);break;
      case 2:
        this.str(p.id);this.num(p.nodeKind,1);
        this.str(p.typeRef);this.str(p.graphRef);
        this.num(p.graphRefRevision,8);break;
      case 4:
        this.str(p.id);this.str(p.fromNode);this.str(p.fromPort);
        this.str(p.toNode);this.str(p.toPort);
        this.num(p.semantics,1);this.num(p.delayTicks,4);break;
      default:throw new RangeError('unknown_gene');
    }
  }
  result(){return Buffer.concat(this.parts,this.size)}
}
export function encodeWire(genome){
  check(genome && genome.version===1 &&
    Number.isInteger(genome.lane) && genome.lane>=0 && genome.lane<=2 &&
    Array.isArray(genome.chromosomes) &&
    genome.chromosomes.length>=1 && genome.chromosomes.length<=2048,
    'invalid_genome');
  const w=new Writer();
  w.raw(Buffer.from('AGM1','ascii'));
  w.num(1,2);w.num(1,2);w.num(genome.lane,1);w.num(0,1);
  w.str(genome.genomeId);w.str(genome.rootGraph);
  w.num(genome.chromosomes.length,4);
  let total=0,prior='';
  for(const c of genome.chromosomes){
    check(!prior || c.graphId>prior,'noncanonical_chromosome_order');
    prior=c.graphId;
    check(Array.isArray(c.genes)&&c.genes.length>0,'invalid_chromosome');
    total+=c.genes.length;
    check(total<=GENES,'gene_budget');
    w.str(c.graphId);w.num(c.genes.length,4);
    for(const g of c.genes)w.gene(g);
  }
  const bytes=w.result();
  decodeWire(bytes); // verify framing and tags; host Graph IR validates semantics
  return bytes;
}
