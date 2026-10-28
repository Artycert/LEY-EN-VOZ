// Agrupa la ley en temas (rangos) y pistas de audio
const LV = require('../core.js');
module.exports = function build(clean) {
  const law = LV.parseLaw(clean);
  const U = law.units;
  const chars = u => u.paras.filter(p => !p.note).reduce((a, p) => a + p.text.length, 0);
  const leaves = [];
  U.forEach(u => {
    if (u.type !== 'heading') return;
    const own = [];
    for (let j = u.i + 1; j < u.end && U[j].type !== 'heading'; j++) if (U[j].type === 'article') own.push(U[j]);
    if (own.length) leaves.push({ h: u, arts: own, ch: own.reduce((a, x) => a + chars(x), 0) });
  });
  const parentOf = (h, lvl) => { for (let j = h.i; j >= 0; j--) if (U[j].type === 'heading' && U[j].level <= lvl) return U[j]; return null; };
  const ranges = []; let cur = null;
  const flush = () => { if (cur) { ranges.push(cur); cur = null; } };
  for (const L of leaves) {
    if (L.h.trans) continue;
    const tit = parentOf(L.h, 2);
    if (L.ch > 16000) {
      flush();
      let part = { arts: [], ch: 0, heads: [L.h], tit }; const parts = [];
      const n = Math.ceil(L.ch / 11000), target = L.ch / n;
      for (const a of L.arts) { part.arts.push(a); part.ch += chars(a); if (part.ch >= target && parts.length < n - 1) { parts.push(part); part = { arts: [], ch: 0, heads: [L.h], tit }; } }
      if (part.arts.length) parts.push(part);
      parts.forEach(p => ranges.push(p)); continue;
    }
    if (cur && cur.tit === tit && cur.ch < 6000 && cur.ch + L.ch <= 13000) { cur.arts.push(...L.arts); cur.ch += L.ch; cur.heads.push(L.h); }
    else { flush(); cur = { arts: [...L.arts], ch: L.ch, heads: [L.h], tit }; }
  }
  flush();
  const t = leaves.find(L => L.h.trans);
  if (t) ranges.push({ arts: t.arts, ch: t.ch, heads: [t.h], tit: t.h });
  // pistas: cada tema incluye los encabezados que lo preceden
  const first = U.findIndex(u => u.type !== 'pre');
  const tracks = []; let start = first;
  ranges.forEach((r, k) => {
    const end = r.arts[r.arts.length - 1].i;
    tracks.push({ k: k + 1, start, end, range: k + 1 });
    start = end + 1;
  });
  if (start < U.length) tracks.push({ k: tracks.length + 1, start, end: U.length - 1, range: null });
  const out = ranges.map((r, k) => ({ k: k + 1, from: r.arts[0].i, to: r.arts[r.arts.length - 1].i, fromLabel: r.arts[0].label, toLabel: r.arts[r.arts.length - 1].label, n: r.arts.length, ch: r.ch }));
  return { law, ranges: out, tracks };
};
