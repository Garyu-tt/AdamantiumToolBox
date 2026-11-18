#!/usr/bin/env python3
"""Enforce context-sized source files. Generated binary assets are reproducible."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
SUFFIX={'.mjs','.js','.py','.ps1','.css','.html','.svg','.json','.md'}
bad=[]
for file in ROOT.rglob('*'):
 if not file.is_file() or file.suffix.lower() not in SUFFIX:continue
 data=file.read_bytes()
 if len(data)>6144 or len(data.splitlines())>120:
  bad.append(f'{file.relative_to(ROOT)}: {len(data)} bytes / {len(data.splitlines())} lines')
if bad:raise SystemExit('Source size budget exceeded:\n'+'\n'.join(bad))
print('SOURCE_BUDGET_OK')
