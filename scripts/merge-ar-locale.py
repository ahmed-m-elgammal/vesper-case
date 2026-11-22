#!/usr/bin/env python3
"""Merge Arabic translation parts into locales/ar.json, in en.json key order,
with strict coverage/QA checks (key parity, placeholder parity, punctuation)."""
import json, re, sys, glob

EN = 'public/content/locales/en.json'
OUT = 'public/content/locales/ar.json'

en = json.load(open(EN, encoding='utf-8'))
ar = {}
for p in sorted(glob.glob('scripts/ar-parts/part*.json')):
    part = json.load(open(p, encoding='utf-8'))
    for k, v in part.items():
        if k in ar:
            sys.exit(f'duplicate key across parts: {k}')
        ar[k] = v

missing = [k for k in en if k not in ar]
extra = [k for k in ar if k not in en]
if missing:
    sys.exit(f'MISSING {len(missing)}: {missing[:10]}')
if extra:
    sys.exit(f'EXTRA {len(extra)}: {extra[:10]}')

# placeholder parity (none today, but enforce for future batches)
for k, v in en.items():
    ep = sorted(re.findall(r'\{[^}]+\}', v))
    ap = sorted(re.findall(r'\{[^}]+\}', ar[k]))
    assert ep == ap, f'placeholder mismatch in {k}: {ep} vs {ap}'

# QA: Arabic sentence period '.' is correct usage; flag only English commas,
# ASCII question marks / semicolons / double quotes, and stray Latin words
latin_hits = []
for k, v in ar.items():
    if ', ' in v:
        latin_hits.append((k, 'ENGLISH COMMA'))
    for bad, why in [('?', 'ASCII QUESTION MARK'), ('; ', 'ASCII SEMICOLON'), ('"', 'ASCII QUOTE')]:
        if bad in v:
            latin_hits.append((k, why))
    for m in re.findall(r'[A-Za-z]{2,}', v):
        latin_hits.append((k, f'LATIN WORD: {m}'))

out = {k: ar[k] for k in en}  # preserve en.json key order
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(OUT, 'a', encoding='utf-8').write('\n')

print(f'ar.json written: {len(out)} keys, key order = en.json order')
if latin_hits:
    print('QA notes (review):')
    for k, why in latin_hits[:20]:
        print('  ', k, '->', why)
else:
    print('QA clean: no Latin residue, no English punctuation')
