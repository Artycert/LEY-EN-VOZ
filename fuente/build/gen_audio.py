"""Genera las pistas MP3 de la ley con la voz de mujer (Piper es_MX claude) y sus tiempos."""
import json, sys, subprocess, numpy as np, os, time
from multiprocessing import Pool
from piper import PiperVoice

MODEL = '/home/claude/voces/es_MX-claude-high.onnx'
OUT = '/home/claude/leyes/build/audio'
SR = 22050
_voice = None

def voice():
    global _voice
    if _voice is None:
        _voice = PiperVoice.load(MODEL)
    return _voice

def synth(text):
    parts = [np.frombuffer(c.audio_int16_bytes, dtype=np.int16) for c in voice().synthesize(text)]
    return np.concatenate(parts) if parts else np.zeros(0, dtype=np.int16)

def sil(sec):
    return np.zeros(int(SR * sec), dtype=np.int16)

def encode(pcm, path):
    p = subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-codec:a', 'libmp3lame', '-b:a', '32k', path], input=pcm.tobytes())
    if p.returncode: raise RuntimeError('ffmpeg failed ' + path)

def do_track(t):
    name = 't%02d' % t['k']
    mp3 = os.path.join(OUT, name + '.mp3')
    js = os.path.join(OUT, name + '.json')
    if os.path.exists(mp3) and os.path.exists(js):
        return name, 'skip'
    buf, timings, pos = [sil(0.3)], [], int(SR * 0.3)
    prev = None
    for s in t['segs']:
        if prev is not None:
            gap = 0.6 if s['u'] != prev['u'] else (0.45 if s['p'] != prev['p'] else 0.25)
            g = sil(gap); buf.append(g); pos += len(g)
        a = synth(s['text'])
        timings.append([s['u'], s['p'], s['s'], round(pos / SR, 2), round((pos + len(a)) / SR, 2)])
        buf.append(a); pos += len(a)
        prev = s
    buf.append(sil(0.5))
    encode(np.concatenate(buf), mp3)
    json.dump({'k': t['k'], 'dur': round(pos / SR + 0.5, 2), 't': timings}, open(js, 'w'))
    return name, round(pos / SR / 60, 1)

if __name__ == '__main__':
    tracks = json.load(open('/home/claude/leyes/build/tracks.json'))
    only = [int(x) for x in sys.argv[1:]]
    if only: tracks = [t for t in tracks if t['k'] in only]
    t0 = time.time()
    with Pool(2) as pool:
        for name, info in pool.imap_unordered(do_track, tracks):
            print(name, info, round(time.time() - t0), flush=True)
    print('DONE', round(time.time() - t0), flush=True)
