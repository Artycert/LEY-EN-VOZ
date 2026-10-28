import json, sys, os
p = '/home/claude/leyes/build/expl.json'
d = json.load(open(p)) if os.path.exists(p) else {}
new = json.load(sys.stdin)
for k, v in new.items():
    d[str(k)] = v
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('temas guardados:', len(d), '| palabras:', {k: len(v['text'].split()) for k, v in new.items()})
