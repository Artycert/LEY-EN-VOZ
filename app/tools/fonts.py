"""Descarga las fuentes de Google Fonts que usa la página para incluirlas en la app (sin internet).
Uso: python3 fonts.py <app.html> <carpeta www>"""
import re, sys, os, urllib.request
html = open(sys.argv[1], encoding='utf-8').read()
www = sys.argv[2]
m = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/css2\?[^"]+)">', html)
url = m.group(1).replace('&amp;', '&')
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
css = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA})).read().decode()
blocks = re.findall(r'/\* ([a-z-]+) \*/\s*(@font-face \{.*?\})', css, re.S)
out = []; os.makedirs(os.path.join(www, 'fonts'), exist_ok=True)
for subset, block in blocks:
    if subset not in ('latin', 'latin-ext'): continue
    src = re.search(r'url\((https://[^)]+\.woff2)\)', block).group(1)
    name = re.sub(r'[^a-zA-Z0-9]+', '-', src.split('/s/')[1].rsplit('.', 1)[0])[-60:] + '.woff2'
    path = os.path.join(www, 'fonts', name)
    if not os.path.exists(path):
        open(path, 'wb').write(urllib.request.urlopen(src).read())
    out.append(f'/* {subset} */\n' + block.replace(src, name))
open(os.path.join(www, 'fonts', 'fonts.css'), 'w').write('\n'.join(out) + '\n')
print(len(out), 'fuentes', sum(os.path.getsize(os.path.join(www, 'fonts', f)) for f in os.listdir(os.path.join(www, 'fonts'))) // 1024, 'KB')
