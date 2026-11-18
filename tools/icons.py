#!/usr/bin/env python3
"""Dependency-free icon forge: SVG + Windows ICO for every installed app."""
from pathlib import Path
import math
import struct
import zlib

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'icons'
OUT.mkdir(exist_ok=True)
THEMES={
 'adamantium':('#67d6cc','<path d="M16 42L32 17L48 42M23 32h18M19 47h26" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>'),
 'workbench':('#54d8cb','<rect x="17" y="20" width="30" height="25" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M17 28h30M26 20v25M33 33h8" fill="none" stroke="currentColor" stroke-width="2.5"/>'),
 'editor':('#ffbd72','<path d="M26 23l-9 9 9 9M38 23l9 9-9 9M35 20l-6 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/>'),
 'studio':('#8ce6ac','<path d="M16 18h32v28H16zM16 27h32M27 27v19M34 34h9M34 41h6" fill="none" stroke="currentColor" stroke-width="3"/>'),
 'graph':('#a7abff','<path d="M22 40l11-17 10 14M22 40l21-3" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="22" cy="40" r="5" fill="currentColor"/><circle cx="33" cy="23" r="5" fill="currentColor"/><circle cx="43" cy="37" r="5" fill="currentColor"/>')
}
def png(data,w,h):
 def chunk(tag,d):return struct.pack('!I',len(d))+tag+d+struct.pack('!I',zlib.crc32(tag+d)&0xffffffff)
 raw=b''.join(b'\x00'+data[i*w*4:(i+1)*w*4] for i in range(h))
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
def line(x,y,x1,y1,x2,y2,width):
 dx=x2-x1;dy=y2-y1
 q=max(0,min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy or 1)))
 return math.hypot(x-x1-q*dx,y-y1-q*dy)<=width/2
def near_circle(x,y,cx,cy,r):
 return math.hypot(x-cx,y-cy)<=r
def render(name):
 accent=tuple(int(THEMES[name][0][i:i+2],16) for i in (1,3,5))
 shapes={
  'adamantium':[(16,42,32,17,3),(32,17,48,42,3),(23,32,41,32,3),(19,47,45,47,3)],
  'workbench':[(18,23,45,23,2),(18,23,18,44,2),(18,44,45,44,2),(45,23,45,44,2),(18,30,45,30,2),(27,30,27,44,2),(33,36,40,36,2)],
  'editor':[(26,24,19,32,3),(19,32,26,40,3),(38,24,45,32,3),(45,32,38,40,3),(35,21,29,43,3)],
  'graph':[(22,41,33,24,2),(33,24,43,37,2),(22,41,43,37,2)],
  'studio':[(16,18,48,18,2),(16,18,16,46,2),(16,46,48,46,2),(48,18,48,46,2),(16,27,48,27,2),(27,27,27,46,2),(34,35,43,35,2)]
 }
 pix=bytearray()
 for yy in range(256):
  for xx in range(256):
   x=xx/4;y=yy/4
   cx=max(10,min(54,x));cy=max(10,min(54,y))
   if math.hypot(x-cx,y-cy)>10:
    pix.extend((0,0,0,0));continue
   t=(x+y)/128
   bg=(int(21+12*t),int(33+16*t),int(50+20*t))
   glow=math.exp(-((x-43)**2+(y-19)**2)/550)*0.15
   color=tuple(min(255,int(bg[k]*(1-glow)+accent[k]*glow)) for k in range(3))
   if any(line(x,y,*s[:4],s[4]) for s in shapes.get(name,shapes['workbench'])) or (name=='graph' and any(near_circle(x,y,*c) for c in [(22,41,4),(33,24,4),(43,37,4)])):
    color=accent
   pix.extend((*color,255))
 data=png(bytes(pix),256,256)
 (OUT/(name+'.png')).write_bytes(data)
 (OUT/(name+'.ico')).write_bytes(struct.pack('<HHH',0,1,1)+struct.pack('<BBBBHHII',0,0,0,0,1,32,len(data),22)+data)
def svg(name,color,glyph):
 (OUT/(name+'.svg')).write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#223a49"/><stop offset="1" stop-color="#151e2c"/></linearGradient></defs><rect x="6" y="6" width="52" height="52" rx="12" fill="url(#bg)"/><g color="'+color+'">'+glyph+'</g></svg>',encoding='utf-8')
import sys
for name in sys.argv[1:]:
 if name not in THEMES and name.isascii() and name.isidentifier():
  THEMES[name]=('#61b6e7',THEMES['workbench'][1])
for name,(color,glyph) in THEMES.items():
 svg(name,color,glyph);render(name)
 print(name,'SVG+PNG+ICO generated')
