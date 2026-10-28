"""Genera el icono y la pantalla de inicio de la app (barras de sonido blancas sobre verde)."""
import os, sys
from PIL import Image, ImageDraw
RES = sys.argv[1]
GREEN = (11, 107, 87, 255); WHITE = (255, 255, 255, 255); BG = (236, 240, 237, 255)
# barras del logotipo de la página: (x, y, ancho, alto) en una caja de 24
BARS = [(3, 9, 3, 6, 1.0), (8.5, 5, 3, 14, 1.0), (14, 7.5, 3, 9, 1.0), (19.5, 10, 2, 4, 0.6)]

def bars(draw, ox, oy, size, color):
    s = size / 24
    for x, y, w, h, a in BARS:
        c = color[:3] + (int(255 * a),)
        draw.rounded_rectangle([ox + x * s, oy + y * s, ox + (x + w) * s, oy + (y + h) * s], radius=w * s / 2, fill=c)

def icon(px, round_=False):
    S = px * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if round_: d.ellipse([0, 0, S - 1, S - 1], fill=GREEN)
    else: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=GREEN)
    g = S * 0.62; bars(d, (S - g) / 2, (S - g) / 2, g, WHITE)
    return im.resize((px, px), Image.LANCZOS)

def foreground(px):
    S = px * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    g = S * 0.42; bars(d, (S - g) / 2, (S - g) / 2, g, WHITE)
    return im.resize((px, px), Image.LANCZOS)

for dens, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = os.path.join(RES, 'mipmap-' + dens)
    icon(px).save(os.path.join(d, 'ic_launcher.png'))
    icon(px, True).save(os.path.join(d, 'ic_launcher_round.png'))
    foreground(int(px * 2.25)).save(os.path.join(d, 'ic_launcher_foreground.png'))

for root, dirs, files in os.walk(RES):
    if 'splash.png' in files:
        p = os.path.join(root, 'splash.png'); w, h = Image.open(p).size
        im = Image.new('RGBA', (w, h), BG)
        s = int(min(w, h) * 0.28); ic = icon(s)
        im.paste(ic, ((w - s) // 2, (h - s) // 2), ic)
        im.convert('RGB').save(p)
with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B6B57</color>\n</resources>\n')
print('ok')
