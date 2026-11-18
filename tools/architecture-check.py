#!/usr/bin/env python3
"""Heuristic architecture lint: enforce no NEW environmental/UI coupling."""
import argparse,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
SCANNED={'core','apps','shell','standards','tools'}
EXTS={'.mjs','.js','.ts','.jsx','.tsx','.py','.ps1','.css','.html'}
PATTERNS={
 'fixed_network':re.compile(r'https?://(?:localhost|127\.0\.0\.1|(?:\d{1,3}\.){3}\d{1,3}|[a-z0-9.-]+\.[a-z]{2,})(?::\d+)?',re.I),
 'fixed_os_path':re.compile(r'[A-Za-z]:[\\/](?:Program Files|Windows|Users|Apps)|/(?:opt|var|srv|home|mnt|etc)/'),
 'fixed_permission_list':re.compile(r'(?:env\.ADA_CAPS|\$env:ADA_CAPS)\s*=\s*["\x27][a-z0-9.,_-]+["\x27]',re.I),
 'fixed_module_boot':re.compile(r"start\(['\x22][a-z0-9_-]+['\x22],join\(root,['\x22](?:standards|apps)['\x22]"),
 'static_shell_menu':re.compile(r'<button\s+id=' ,re.I),
 'static_asset_allowlist':re.compile(r'const\s+safe\s*=\s*/\^'),
 'cross_app_import':re.compile(r"(?:from\s+|import\s*\(|require\s*\()\s*['\x22][^'\x22]*(?:/apps/|\\\\apps\\\\)[a-z0-9_-]+",re.I),
 'literal_ui_color':re.compile(r"""(?:color|background|borderColor)\s*[:=]\s*['"]#[0-9a-fA-F]{3,8}['"]"""),
}
def identity(path,rule,line):
 raw=(path+'|'+rule+'|'+line.strip()).encode('utf8')
 return hashlib.sha256(raw).hexdigest()[:20]
def inspect(path,text):
 findings=[]
 for number,line in enumerate(text.splitlines(),1):
  if line.lstrip().startswith(('#','//','*')):continue
  for rule,pattern in PATTERNS.items():
   if rule=='literal_ui_color' and path.endswith('.css'):continue
   if rule=='static_shell_menu' and path!='shell/index.html':continue
   examined=line.replace('http://www.w3.org/2000/svg','') if rule=='fixed_network' else line
   if pattern.search(examined):
    findings.append({'id':identity(path,rule,line),'path':path,'line':number,
      'rule':rule,'excerpt':line.strip()[:130]})
 return findings
def collect(paths):
 results=[]
 if not paths:
  paths=[p for d in SCANNED for p in (ROOT/d).rglob('*') if p.is_file() and p.suffix in EXTS]
  paths.extend(p for p in ROOT.iterdir() if p.is_file() and p.suffix in EXTS)
 for item in paths:
  p=Path(item)
  if not p.is_absolute():p=ROOT/p
  if not p.is_file() or p.suffix not in EXTS:continue
  relative=p.relative_to(ROOT).as_posix()
  results.extend(inspect(relative,p.read_text(encoding='utf8')))
 return sorted(results,key=lambda v:(v['path'],v['line'],v['rule']))
def main():
 cli=argparse.ArgumentParser()
 cli.add_argument('files',nargs='*')
 cli.add_argument('--audit',action='store_true')
 cli.add_argument('--json',action='store_true')
 a=cli.parse_args()
 findings=collect(a.files)
 baseline=ROOT/'standards'/'architecture'/'legacy-debt.json'
 old=json.loads(baseline.read_text()) if baseline.exists() else {'ids':[]}
 accepted=set(old['ids'])
 novel=[x for x in findings if x['id'] not in accepted]
 if a.json:print(json.dumps({'total':len(findings),'legacy':len(findings)-len(novel),
   'new':novel},ensure_ascii=False,indent=2))
 else:
  for x in findings if a.audit else novel:
   print(f"{x['path']}:{x['line']} [{x['rule']}] {x['excerpt']}")
  print(f"ARCH_AUDIT total={len(findings)} legacy={len(findings)-len(novel)} new={len(novel)}")
 return 0 if a.audit or not novel else 2
if __name__=='__main__':raise SystemExit(main())
