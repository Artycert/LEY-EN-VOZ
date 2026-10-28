// Arma leyes-en-voz.html: plantilla + core.js + instructivo + ley integrada (texto, temas, explicaciones y tiempos del audio)
const fs = require('fs'), path = require('path');
const B = __dirname, R = path.join(B, '..');
const LV = require(path.join(R, 'core.js'));
const pad = n => String(n).padStart(2, '0');
const partial = process.env.PARTIAL === '1';

const text = fs.readFileSync(path.join(R, 'fuentes/LGIPE.clean.txt'), 'utf8');
const law = LV.parseLaw(text);
const ranges = JSON.parse(fs.readFileSync(path.join(B, 'ranges.json')));
const expl = JSON.parse(fs.readFileSync(path.join(B, 'expl.json')));
const tracks = JSON.parse(fs.readFileSync(path.join(B, 'tracks.json')));

const packRanges = ranges.map(r => {
  const e = expl[r.k]; if (!e) throw new Error('Falta explicación ' + r.k);
  const a = law.units[r.from], b = law.units[r.to];
  if (a.label !== r.fromLabel || b.label !== r.toLabel) throw new Error('Rango no coincide ' + r.k);
  return { k: r.k, from: r.from, to: r.to, fromLabel: r.fromLabel, toLabel: r.toLabel, title: e.title, text: e.text };
});
const packTracks = [], missing = [];
for (const t of tracks) {
  const f = path.join(B, 'audio', `t${pad(t.k)}.json`);
  if (!fs.existsSync(f) || !fs.existsSync(path.join(B, 'audio', `t${pad(t.k)}.mp3`))) { missing.push(t.k); continue; }
  const a = JSON.parse(fs.readFileSync(f));
  for (const [u, p, s] of a.t) {
    const unit = law.units[u]; if (!unit) throw new Error(`Unidad ${u} no existe (pista ${t.k})`);
    if (p >= 0 && !unit.paras[p]) throw new Error(`Párrafo ${u}/${p} no existe`);
    if (p >= 0 && LV.splitSentences(unit.paras[p].text).length <= s) throw new Error(`Frase ${u}/${p}/${s} no existe`);
  }
  packTracks.push({ k: t.k, range: t.range, dur: +a.dur.toFixed(2), t: a.t.map(x => [x[0], x[1], x[2], +x[3].toFixed(2), +x[4].toFixed(2)]) });
}
// duración de cada tema (lectura + explicación), para el selector de temas
let explTotal = 0;
for (const r of packRanges) {
  const tr = packTracks.find(t => t.range === r.k);
  const ej = path.join(B, 'audio', `e${pad(r.k)}.json`);
  const ed = fs.existsSync(ej) ? JSON.parse(fs.readFileSync(ej)).dur : 0;
  explTotal += ed;
  if (tr) r.dur = Math.round(tr.dur + ed);
}
const missE = ranges.filter(r => !fs.existsSync(path.join(B, 'audio', `e${pad(r.k)}.mp3`))).map(r => r.k);
if ((missing.length || missE.length) && !partial) throw new Error(`Faltan audios: pistas ${missing.join(',')} explicaciones ${missE.join(',')}`);
if (missing.length || missE.length) console.warn('PARCIAL: faltan pistas', missing.length, 'explicaciones', missE.length);

const pack = {
  id: 'lipe-campeche',
  name: 'Ley de Instituciones y Procedimientos Electorales del Estado de Campeche',
  meta: `${law.articles} artículos · voz grabada y ${packRanges.length} temas con explicación`,
  source: 'Texto del Compendio Jurídico del Congreso del Estado de Campeche (documento para consulta, sin validez legal). Última reforma: Decreto 70, P.O. 28 de marzo de 2025.',
  note: 'Al final de cada tema hay una explicación preparada con Claude a partir del texto de la ley. Es una guía de estudio: no sustituye la lectura de los artículos.',
  explTotal: Math.round(explTotal),
  text, ranges: packRanges, tracks: packTracks
};

const js = s => JSON.stringify(s).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const tpl = fs.readFileSync(path.join(R, 'app.html'), 'utf8');
const core = fs.readFileSync(path.join(R, 'core.js'), 'utf8');
function render({ instr, packs, remote, appver, appjs, artwork }) {
  let html = tpl;
  const put = (tag, val) => { if (!html.includes(tag)) throw new Error('Falta ' + tag); html = html.split(tag).join(val); };
  put('/*@@CORE@@*/', core);
  put('/*@@INSTR@@*/', js(instr));
  put('/*@@PACKS@@*/', js(packs));
  put('/*@@REMOTE@@*/', js(remote));
  put('/*@@APPVER@@*/', js(appver));
  put('<!--@@APPJS@@-->', appjs);
  put('/*@@ARTWORK@@*/', js(artwork || ''));
  if (html.includes('\uFFFD')) throw new Error('U+FFFD en la salida');
  return html;
}

// 1) Página web (artefacto): ley incluida, audio junto a la página
const ARTWORK_PNG = path.join(process.env.REPO || '/home/claude/ley-en-voz', 'app/tools/artwork.png');
const artwork = fs.existsSync(ARTWORK_PNG) ? 'data:image/png;base64,' + fs.readFileSync(ARTWORK_PNG).toString('base64') : '';
const web = render({ artwork, instr: fs.readFileSync(path.join(R, 'instructivo.txt'), 'utf8'), packs: [pack], remote: null, appver: '', appjs: '' });
fs.writeFileSync(path.join(R, 'leyes-en-voz.html'), web);
console.log('web ok', (web.length / 1024).toFixed(0) + ' KB', 'pistas', packTracks.length, 'temas', packRanges.length);

// 2) App de Android y repositorio de GitHub
const REPO = process.env.REPO || '/home/claude/ley-en-voz';
const APPVER = process.env.APPVER || '0.1.0';
if (fs.existsSync(REPO) && !partial) {
  const base = 'https://raw.githubusercontent.com/Artycert/LEY-EN-VOZ/main/';
  const www = path.join(REPO, 'app', 'www');
  fs.mkdirSync(www, { recursive: true });
  fs.copyFileSync(path.join(REPO, 'app/node_modules/@capacitor/core/dist/capacitor.js'), path.join(www, 'capacitor.js'));
  fs.copyFileSync(path.join(REPO, 'app/node_modules/@jofr/capacitor-media-session/dist/plugin.js'), path.join(www, 'media-session.js'));
  const appHtml0 = render({ artwork,
    instr: fs.readFileSync(path.join(R, 'instructivo_app.txt'), 'utf8'), packs: [],
    remote: { base, catalog: 'catalog.json' }, appver: APPVER,
    appjs: '<script src="capacitor.js"></script>\n<script src="media-session.js"></script>\n'
  });
  // en la app las fuentes van incluidas (funciona sin internet y abre más rápido)
  require('child_process').execFileSync('python3', [path.join(REPO, 'app/tools/fonts.py'), path.join(R, 'app.html'), www], { stdio: 'inherit' });
  const appHtml = appHtml0.replace(/<link rel="preconnect"[^>]*>\n/g, '').replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts/fonts.css">');
  if (appHtml.includes('fonts.googleapis')) throw new Error('quedó la liga a Google Fonts');
  const head = '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#0B6B57">\n';
  fs.writeFileSync(path.join(www, 'index.html'), head + appHtml.replace('<title>', '</head>\n<body>\n<title>') + '\n</body>\n</html>\n');
  // paquete de la ley
  const pdir = path.join(REPO, 'packs', pack.id);
  fs.mkdirSync(path.join(pdir, 'audio'), { recursive: true });
  const packJson = JSON.stringify(pack);
  fs.writeFileSync(path.join(pdir, 'pack.json'), packJson);
  let bytes = 0, files = 0;
  for (const f of fs.readdirSync(path.join(B, 'audio')).filter(f => f.endsWith('.mp3'))) {
    const dst = path.join(pdir, 'audio', f);
    if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(path.join(B, 'audio', f)).size) fs.copyFileSync(path.join(B, 'audio', f), dst);
    bytes += fs.statSync(dst).size; files++;
  }
  const hours = packTracks.reduce((a, t) => a + t.dur, 0) / 3600;
  const catalog = {
    app: { version: APPVER, url: `https://github.com/Artycert/LEY-EN-VOZ/raw/main/apk/LeyEnVoz-${APPVER}.apk` },
    leyes: [{
      id: pack.id, name: pack.name, v: 1,
      meta: `${law.articles} artículos · ${packRanges.length} temas con explicación · ${Math.round(hours)} h de audio`,
      pack: `packs/${pack.id}/pack.json`, audio: `packs/${pack.id}/audio/`,
      files, mb: Math.round(bytes / 1048576)
    }]
  };
  fs.writeFileSync(path.join(REPO, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log('app ok', (appHtml.length / 1024).toFixed(0) + ' KB', 'pack', (packJson.length / 1024).toFixed(0) + ' KB', 'audio', files, Math.round(bytes / 1048576) + ' MB');
}
