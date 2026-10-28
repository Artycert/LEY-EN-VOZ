"""Genera el audio de las explicaciones por tema con la voz de mujer."""
import json, os, subprocess, sys, numpy as np
from piper import PiperVoice
SR = 22050
OUT = '/home/claude/leyes/build/audio'
v = PiperVoice.load('/home/claude/voces/es_MX-claude-high.onnx')
items = json.load(open('/home/claude/leyes/build/expl_speech.json'))
only = set(map(int, sys.argv[1:]))
for it in items:
    if only and it['k'] not in only: continue
    k = it['k']; mp3 = os.path.join(OUT, 'e%02d.mp3' % k); js = os.path.join(OUT, 'e%02d.json' % k)
    if os.path.exists(mp3) and os.path.exists(js) and json.load(open(js)).get('h') == it['h']:
        continue
    buf = [np.zeros(int(SR * 0.3), dtype=np.int16)]
    for i, s in enumerate(it['parts']):
        if i: buf.append(np.zeros(int(SR * (0.5 if i == 1 else 0.28)), dtype=np.int16))
        buf += [np.frombuffer(c.audio_int16_bytes, dtype=np.int16) for c in v.synthesize(s)]
    buf.append(np.zeros(int(SR * 0.4), dtype=np.int16))
    pcm = np.concatenate(buf)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-codec:a', 'libmp3lame', '-b:a', '32k', mp3], input=pcm.tobytes(), check=True)
    json.dump({'k': k, 'dur': round(len(pcm) / SR, 2), 'h': it['h']}, open(js, 'w'))
    print('e%02d' % k, round(len(pcm) / SR, 1), flush=True)
print('DONE', flush=True)
