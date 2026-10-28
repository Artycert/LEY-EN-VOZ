// Imprime el texto de uno o varios temas para escribir su explicación
const fs = require('fs'); const build = require('./ranges.js');
const { law, ranges } = build(fs.readFileSync('fuentes/LGIPE.clean.txt', 'utf8'));
const ks = process.argv.slice(2).map(Number);
for (const k of ks) {
  const r = ranges[k - 1];
  // encabezados que enmarcan el tema
  const heads = []; let lvlSeen = 99;
  for (let j = r.from; j >= 0 && lvlSeen > 1; j--) { const u = law.units[j]; if (u.type === 'heading' && u.level < lvlSeen) { heads.unshift(u.label + ' ' + (u.name || '')); lvlSeen = u.level; } }
  console.log(`\n######## TEMA ${k}: ${r.fromLabel} a ${r.toLabel} (${r.n} arts)\n# ${heads.join(' > ')}`);
  for (let i = r.from; i <= r.to; i++) {
    const u = law.units[i];
    const body = u.paras.filter(p => !p.note).map(p => p.text).join(' ');
    console.log(u.type === 'heading' ? `[${u.label} ${u.name || ''}]` : `${u.raw || u.label} ${body}`);
  }
}
