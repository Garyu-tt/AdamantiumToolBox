"""Prevent new architectural hardcoding and keep the debt ratchet honest."""
from pathlib import Path
import importlib.util,json,subprocess,sys
ROOT=Path(__file__).resolve().parent.parent
path=ROOT/'tools/architecture-check.py'
spec=importlib.util.spec_from_file_location('mas_archcheck',path)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
legacy=json.loads((ROOT/'standards/architecture/legacy-debt.json').read_text())
assert legacy['schema']=='mas-architecture-debt-1'
assert legacy['status']=='legacy_only_not_approval_for_new_code'
source="const base='http://10.0.0.40:9999/api'\n"
findings=mod.inspect('apps/newapp/service.mjs',source)
assert findings and findings[0]['rule']=='fixed_network'
assert findings[0]['id'] not in legacy['ids']
assert not mod.inspect('apps/newapp/service.mjs',"const endpoint=process.env.API_URL\n")
assert mod.inspect('apps/newapp/view.js',"const color='#f00'\n")
assert mod.inspect('apps/newapp/service.mjs',"import x from '../apps/other/service.mjs'\n")
result=subprocess.run([sys.executable,str(path)],capture_output=True,text=True)
assert result.returncode==0,result.stdout+result.stderr
print('ARCH_RULES_OK strict new-violations-blocked existing-debt-visible',len(legacy['ids']))
