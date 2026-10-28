/* ===== Motor: análisis de la ley y texto para la voz ===== */
const LV = (() => {
  const ORD_BASE = 'primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|s[ée]ptim[oa]|octav[oa]|noven[oa]|und[ée]cim[oa]|duod[ée]cim[oa]|d[ée]cim[oa]|vig[ée]sim[oa]|trig[ée]sim[oa]|cuadrag[ée]sim[oa]|quincuag[ée]sim[oa]|[úu]nic[oa]';
  const ORD = `(?:${ORD_BASE})(?:\\s+(?:${ORD_BASE}))?`;
  const SUFFIX = '(?:\\s*(?:bis|ter|qu[áa]ter|quinquies|sexies|septies|octies|nonies|decies)(?:\\s*\\d+)?)?(?:\\s*-\\s*(?:[a-z]|\\d{1,3})(?=\\s*[.\\-–—]))?';
  const SEP = '(\\.\\s*[-–—]+|[-–—]+|\\.|:)';
  const ART_RE = new RegExp(`^(art[íi]culo|art\\.)\\s+((\\d+)(?:[oº°ª]|\\s*[º°])?|${ORD})(${SUFFIX})\\s*${SEP}\\s*`, 'i');
  const TRANS_ITEM_RE = new RegExp(`^(${ORD})\\s*${SEP}\\s*`, 'i');
  const TRANS_ITEM_DASH_RE = new RegExp(`^(${ORD})\\s*\\.?\\s*[-–—]`, 'i');
  const HEAD_RE = new RegExp(`^(libro|parte|t[íi]tulo|cap[íi]tulo|subsecci[óo]n|secci[óo]n)\\s+(${ORD}|[ivxlc]+|\\d+)(\\s*(?:bis|ter|qu[áa]ter))?(?![a-záéíóúñ])\\.?\\s*[-–—.:]?\\s*(.*)$`, 'i');
  const TRANS_HEAD_RE = /^(art[íi]culos?\s+)?transitori[oa]s?(\s+de\s+.{0,90})?\.?$/i;
  const DECREE_RE = /^DECRETO\s+(por|que|mediante|n[úu]mero|no\.)\b/;
  const NOTE_DATE = /\b(?:DOF|D\.\s?O\.\s?F\.|P\.\s?O\.\s?E?\.?|POE)\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/;
  const NOTE_START = /^(?:art[íi]culos?|p[áa]rrafos?|fracci[óo]n(?:es)?|incisos?|apartados?|denominaci[óo]n|cap[íi]tulos?|t[íi]tulos?|secci[óo]n(?:es)?|leyes?|numerales?|bases?|fe de erratas|reformad[oa]s?|adicionad[oa]s?|derogad[oa]s?|se\s+(?:reforma|adiciona|deroga)|nota|[úu]ltimo|primer|segundo|tercer|cuarto|quinto|sexto|s[ée]ptimo|octavo|noveno)\b/i;
  const NOTE_PAREN = /^\((?:reformad|adicionad|derogad|f\.\s*de\s*e|n\.\s*de\s*e|ref\.|adic\.)[^)]*\)\.?$/i;
  const LEVELS = { parte: 0, libro: 1, 'título': 2, titulo: 2, 'capítulo': 3, capitulo: 3, 'sección': 4, seccion: 4, 'subsección': 5, subseccion: 5 };
  const KIND_LABEL = { parte: 'Parte', libro: 'Libro', 'título': 'Título', titulo: 'Título', 'capítulo': 'Capítulo', capitulo: 'Capítulo', 'sección': 'Sección', seccion: 'Sección', 'subsección': 'Subsección', subseccion: 'Subsección' };

  const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  function romanToInt(s) {
    if (!/^[IVXLC]+$/.test(s)) return null;
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const v = ROMAN[s[i]], nx = ROMAN[s[i + 1]] || 0;
      n += v < nx ? -v : v;
    }
    return intToRoman(n) === s ? n : null;
  }
  function intToRoman(n) {
    const t = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let r = '';
    for (const [v, s] of t) while (n >= v) { r += s; n -= v; }
    return r;
  }
  function fraccionNum(tok) {
    const n = romanToInt(tok);
    if (n == null || n > 89) return null;
    if (tok === 'C' || tok === 'L') return null;
    return n;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s; }
  function capWords(s) { return s.split(/\s+/).map(cap).join(' '); }
  function startsUpper(s) { return /^[A-ZÁÉÍÓÚÑ]/.test(s); }

  function normalize(text) {
    return String(text || '')
      .normalize('NFC')
      .replace(/\r\n?/g, '\n')
      .replace(/\f/g, '\n')
      .replace(/­/g, '')
      .replace(/[    ]/g, ' ')
      .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl')
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ');
  }

  function isJunkLine(line) {
    return /^(p[áa]g(ina)?\.?\s*)?\d{1,4}(\s*(de|\/)\s*\d{1,4})?$/i.test(line);
  }
  function isNote(p) {
    if (/^(?:nota|n\.\s*de\s*e\.)\s*:/i.test(p) && p.length < 600) return true;
    if (p.length > 320) return false;
    if (NOTE_PAREN.test(p)) return true;
    if (!NOTE_START.test(p) || !NOTE_DATE.test(p)) return false;
    if (ART_RE.test(p) || TRANS_ITEM_RE.test(p)) return false;
    return true;
  }
  function matchArticle(p) {
    if (p[0] !== 'A') return null;
    const m = p.match(ART_RE);
    if (!m) return null;
    const isNum = !!m[3];
    const after = p.slice(m[0].length);
    // "Artículo 27. de la ley" no es encabezado
    if (m[5] === '.' && after && /^[a-záéíóúñ]/.test(after)) return null;
    const numTxt = isNum ? m[2].replace(/\s+/g, '') : capWords(m[2]);
    const suf = (m[4] || '').trim().replace(/\s+/g, ' ');
    const sufTxt = suf ? (suf.startsWith('-') ? suf.replace(/\s+/g, '').toUpperCase() : ' ' + cap(suf)) : '';
    return {
      raw: m[0].trim(),
      label: 'Artículo ' + numTxt + sufTxt,
      num: isNum ? parseInt(m[3], 10) : null,
      rest: after.trim()
    };
  }
  function matchTransItem(p) {
    if (!startsUpper(p)) return null;
    const m = p.match(TRANS_ITEM_RE);
    if (!m) return null;
    const after = p.slice(m[0].length);
    if (m[2] === '.' && after && /^[a-záéíóúñ]/.test(after)) return null;
    return { raw: m[0].trim(), label: capWords(m[1]), num: null, rest: after.trim() };
  }
  function matchHeading(p) {
    if (!startsUpper(p) || p.length > 200) return null;
    const m = p.match(HEAD_RE);
    if (!m) return null;
    const rest = (m[4] || '').trim();
    if (rest && (/^[a-záéíóúñ,;:]/.test(rest) || rest.length > 150)) return null;
    if (NOTE_DATE.test(p)) return null;
    let numTok = m[2];
    const kindKey = m[1].toLowerCase();
    let num;
    if (/^[ivxlc]+$/i.test(numTok) && romanToInt(numTok.toUpperCase()) != null) num = numTok.toUpperCase();
    else if (/^\d+$/.test(numTok)) num = numTok;
    else if (new RegExp(`^${ORD}$`, 'i').test(numTok)) num = capWords(numTok);
    else return null;
    const suf = m[3] ? ' ' + cap(m[3].trim()) : '';
    return { kind: kindKey, level: LEVELS[kindKey], label: KIND_LABEL[kindKey] + ' ' + num + suf, name: rest };
  }
  function isRomanMarker(line) {
    const m = line.match(/^([IVXLC]+)\s*(?:\.\s*[-–—]*|[-–—]+|\))\s+\S/);
    return !!(m && fraccionNum(m[1]) != null);
  }
  function isHeadingLike(line) {
    return !!(matchHeading(line) || TRANS_HEAD_RE.test(line) || DECREE_RE.test(line));
  }
  function lone(s) { const m = s.match(/^([IVXLC]+|[a-zñ]|\d{1,2})\s*[.)]\s*[-–—]?$/); return !!m && (!/^[IVXLC]+$/.test(m[1]) || romanToInt(m[1]) != null); }
  function isMarker(line) {
    return !!(lone(line) || matchArticle(line) || isHeadingLike(line) || isNote(line) ||
      isRomanMarker(line) || /^[a-zñ]\)\s+[A-ZÁÉÍÓÚÑ"“¿¡(«]/.test(line) || /^\d{1,2}[.)]\s/.test(line) ||
      /^[A-Z]\.\s*[-–—]/.test(line) || (startsUpper(line) && TRANS_ITEM_DASH_RE.test(line)));
  }
  function joinLine(a, b) {
    if (/[a-záéíóúñ]-$/.test(a) && /^[a-záéíóúñ]/.test(b)) return a.slice(0, -1) + b;
    return a + ' ' + b;
  }

  /* Junta las líneas cortadas del PDF en párrafos */
  function toParagraphs(text) {
    const lines = normalize(text).split('\n');
    const paras = [];
    let cur = null, curHead = false, curNote = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { if (cur !== null && !lone(cur)) { paras.push(cur); cur = null; } continue; }
      if (isJunkLine(line)) continue;
      const marker = isMarker(line);
      let join = false;
      if (cur !== null && lone(cur) && !isHeadingLike(line)) join = true;
      else if (cur !== null && !marker && !curHead) {
        if (curNote) join = /^nota\s*:/i.test(cur)
          ? (!/\.["”)]?$/.test(cur) || /\b(?:No|Núm|núm|Sec|Secc)\.$/.test(cur) || /^[\d(a-záéíóúñ]/.test(line))
          : /^[\d,y]/.test(line);
        else join = !/[.:;!?]["”»')]?$/.test(cur);
      }
      if (join) { cur = joinLine(cur, line); }
      else {
        if (cur !== null) paras.push(cur);
        cur = line; curHead = isHeadingLike(line); curNote = isNote(line);
      }
    }
    if (cur !== null) paras.push(cur);
    return paras;
  }

  /* Quita encabezados y pies de página repetidos (PDF por páginas) */
  function cleanPages(pages) {
    const n = pages.length;
    const key = l => l.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
    const counts = new Map();
    const EDGE_TOP = 7, EDGE_BOTTOM = 4;
    pages.forEach(lines => {
      const seen = new Set();
      lines.forEach((l, i) => {
        if (i < EDGE_TOP || i >= lines.length - EDGE_BOTTOM) {
          const k = key(l); if (!k || seen.has(k)) return; seen.add(k);
          counts.set(k, (counts.get(k) || 0) + 1);
        }
      });
    });
    const limit = Math.max(3, Math.ceil(n * 0.4));
    // líneas repetidas en casi todas las páginas, estén donde estén (encabezados que el PDF intercala)
    const anywhere = new Map();
    pages.forEach(lines => { const seen = new Set(); lines.forEach(l => { const k = key(l); if (!k || seen.has(k)) return; seen.add(k); anywhere.set(k, (anywhere.get(k) || 0) + 1); }); });
    const limitAny = Math.max(3, Math.ceil(n * 0.6));
    const out = [];
    pages.forEach(lines => {
      lines.forEach((l, i) => {
        const edge = i < EDGE_TOP || i >= lines.length - EDGE_BOTTOM;
        if (edge && n >= 3 && (counts.get(key(l)) || 0) >= limit) return;
        const t = l.trim();
        if (n >= 3 && t.length <= 120 && (anywhere.get(key(l)) || 0) >= limitAny && !isMarker(t)) return;
        if (edge && isJunkLine(l.trim())) return;
        out.push(l);
      });
    });
    return out.join('\n');
  }

  /* Estructura: títulos, capítulos, artículos */
  function parseLaw(text) {
    const paras = toParagraphs(text);
    const units = [];
    const pre = { type: 'pre', label: 'Encabezado', name: '', paras: [], num: null, trans: false };
    let target = pre;
    let seenTrans = false, decreeArea = false, inDecree = false;
    const isHeadingName = p => p.length <= 160 && !isMarker(p) && !/[;:]$/.test(p) &&
      (!/\.$/.test(p) || p.length < 70) && /^[A-ZÁÉÍÓÚÑ(«"“]/.test(p);
    for (let i = 0; i < paras.length; i++) {
      const p = paras[i];
      if (isNote(p)) { target.paras.push({ text: p, note: true }); continue; }
      let h = null;
      if (TRANS_HEAD_RE.test(p)) {
        seenTrans = true;
        if (/decretos/i.test(p)) { decreeArea = true; h = { kind: 'transitorios', level: 1, label: 'Transitorios de decretos de reforma', name: '' }; }
        else h = { kind: 'transitorios', level: inDecree ? 3 : 2, label: 'Transitorios', name: '' };
      } else if (seenTrans && DECREE_RE.test(p)) {
        inDecree = true;
        h = { kind: 'decreto', level: 2, label: 'Decreto', name: cap(p.replace(/^DECRETO\s+/, '').charAt(0)) + p.replace(/^DECRETO\s+/, '').slice(1) };
      } else {
        h = matchHeading(p);
        if (h) { seenTrans = false; inDecree = false; }
      }
      if (h) {
        if (!h.name && h.kind !== 'transitorios' && i + 1 < paras.length && isHeadingName(paras[i + 1])) h.name = paras[++i];
        const u = { type: 'heading', kind: h.kind, level: h.level, label: h.label, name: h.name, paras: [], num: null, trans: h.kind === 'transitorios' || h.kind === 'decreto' };
        units.push(u); target = u; continue;
      }
      let a = matchArticle(p);
      if (!a && seenTrans) a = matchTransItem(p);
      if (a) {
        const u = { type: 'article', label: a.label, raw: a.raw, num: seenTrans ? null : a.num, trans: seenTrans, paras: [] };
        if (a.rest) u.paras.push({ text: a.rest, note: false });
        units.push(u); target = u; continue;
      }
      target.paras.push({ text: p, note: false });
    }
    let articles = units.filter(u => u.type === 'article').length;
    if (articles === 0) {
      // Sin artículos reconocibles: se divide en bloques para poder navegar
      const all = pre.paras.concat(...units.map(u => u.paras));
      units.length = 0; pre.paras = [];
      const size = 6;
      for (let i = 0; i < all.length; i += size) {
        const n = units.length + 1;
        units.push({ type: 'article', label: 'Bloque ' + n, raw: '', num: n, trans: false, paras: all.slice(i, i + size), block: true });
      }
      articles = units.length;
    } else if (pre.paras.length) {
      units.unshift(pre);
    }
    // jerarquía: rango de cada encabezado
    units.forEach((u, i) => { u.i = i; });
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.type !== 'heading') continue;
      let end = units.length;
      for (let j = i + 1; j < units.length; j++) {
        if (units[j].type === 'heading' && units[j].level <= u.level) { end = j; break; }
      }
      u.end = end;
    }
    const headings = units.filter(u => u.type === 'heading').length;
    return { units, articles, headings };
  }

  /* ---- Oraciones y voz ---- */
  const ABBR = new Set(['art', 'arts', 'fracc', 'fraccs', 'frac', 'fr', 'párr', 'parr', 'inc', 'incs', 'núm', 'num', 'no', 'nos', 'lic', 'licda', 'sr', 'sra', 'srta', 'dr', 'dra', 'ing', 'arq', 'mtro', 'mtra', 'prof', 'gral', 'pág', 'págs', 'pag', 'vol', 'cfr', 'cf', 'ej', 'sig', 'sigs', 'dto', 'depto', 'av', 'col', 'pp', 'ss', 'tel', 'ext', 'aprox', 'exp', 'of', 'fol', 'vs', 'cía']);
  function splitSentences(t) {
    const parts = t.match(/[^.!?]+(?:[.!?]+["”»')\]]*|$)\s*/g) || [t];
    const out = [];
    for (const raw of parts) {
      if (!raw.trim()) { if (out.length) out[out.length - 1] += raw; continue; }
      if (out.length) {
        const prev = out[out.length - 1].trimEnd();
        const next = raw.trimStart();
        const w = prev.match(/(?:^|[\s(«"“])([A-Za-zÁÉÍÓÚÑáéíóúñ]{1,6})\.$/);
        const merge =
          (w && ABBR.has(w[1].toLowerCase())) ||
          /(?:^|[\s.(])[A-Za-zÁÉÍÓÚÑ]\.$/.test(prev) ||
          /^[a-záéíóúñ,;:)\]]/.test(next) ||
          (/\d\.$/.test(prev) && /^\d/.test(next)) ||
          /^[IVXLC]+\.$/.test(prev.trim()) ||
          prev.length < 4;
        if (merge) { out[out.length - 1] += raw; continue; }
      }
      out.push(raw);
    }
    return out;
  }

  const ORDINALS = ['', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];
  const MONTHS = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const ACR = new Set(['RAN', 'DOF', 'SEDATU', 'SAT', 'RFC', 'CURP', 'IMSS', 'ISSSTE', 'INFONAVIT', 'INEGI', 'CNPCF', 'PROCEDE', 'FANAR', 'TUA', 'SCJN', 'UMA', 'CFE', 'CONAGUA', 'PEMEX', 'FIFONAFE', 'CONAFOR', 'SEMARNAT', 'PROFEPA', 'SADER', 'INSUS', 'CORETT', 'IVA', 'ISR', 'MP', 'FGR', 'FGE', 'DIF', 'INE']);

  function decap(s) {
    // corridas de palabras en mayúsculas: "DE LOS EJIDOS" -> "de los ejidos"
    s = s.replace(/(?:\b[A-ZÁÉÍÓÚÑÜ]{2,}\b[\s,.;:]*){2,}/g, run => run.replace(/[A-ZÁÉÍÓÚÑÜ]{2,}/g, tok =>
      (ACR.has(tok) || romanToInt(tok) != null) ? tok : tok.toLowerCase()));
    const letters = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
    const upp = s.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length;
    const mostlyCaps = letters.length >= 6 && upp / letters.length > 0.6;
    let first = true;
    return s.replace(/[A-Za-zÁÉÍÓÚÑáéíóúñÜü]+/g, tok => {
      const isFirst = first; first = false;
      if (tok !== tok.toUpperCase() || tok.length < 2) return tok;
      if (ACR.has(tok)) return tok;
      if (/^[IVXLC]+$/.test(tok) && romanToInt(tok) != null) return tok;
      if (!mostlyCaps && tok.length < 4) return tok;
      const low = tok.toLowerCase();
      return isFirst ? cap(low) : low;
    });
  }

  function speechify(s, paraStart) {
    let t = ' ' + s.replace(/\s+/g, ' ').trim() + ' ';
    t = decap(t);
    // abreviaturas
    t = t.replace(/\bArts\.\s*/gi, 'artículos ')
      .replace(/\bArt\.\s*/gi, 'artículo ')
      .replace(/\bfraccs\.\s*/gi, 'fracciones ')
      .replace(/\bfracc?\.\s*/gi, 'fracción ')
      .replace(/\bfr\.\s*(?=[IVXLC]+\b)/g, 'fracción ')
      .replace(/\bp[áa]rrs?\.\s*/gi, 'párrafo ')
      .replace(/\bincs?\.\s*/gi, 'inciso ')
      .replace(/\bN[úu]m\.\s*/gi, 'número ')
      .replace(/\bNo\.\s*(?=\d)/g, 'número ')
      .replace(/\bD\.\s?O\.\s?F\.?/g, 'Diario Oficial de la Federación')
      .replace(/\bDOF\b/g, 'Diario Oficial de la Federación')
      .replace(/\bP\.\s?O\.\s?E\.?(?=[\s,;:]|$)/g, 'Periódico Oficial del Estado')
      .replace(/\bP\.\s?O\.(?=[\s,;:]|$)/g, 'Periódico Oficial')
      .replace(/\bRAN\b/g, 'Registro Agrario Nacional')
      .replace(/\bTUA\b/g, 'Tribunal Unitario Agrario')
      .replace(/\bCNPCF\b/g, 'Código Nacional de Procedimientos Civiles y Familiares')
      .replace(/\betc\./gi, 'etcétera.')
      .replace(/\by\/o\b/gi, 'y o')
      .replace(/\bLic\./g, 'licenciado ')
      .replace(/(\d)\s*(?:has?|Has?)\.?(?=[\s,.;:)]|$)/g, '$1 hectáreas')
      .replace(/(\d)\s*(?:m2|m²)(?![a-z])/g, '$1 metros cuadrados')
      .replace(/(\d)\s*(?:km2|km²)(?![a-z])/g, '$1 kilómetros cuadrados');
    // fechas 26-02-1992
    t = t.replace(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g, (m, d, mo, y) => {
      const mi = parseInt(mo, 10); return mi >= 1 && mi <= 12 ? `${parseInt(d, 10)} de ${MONTHS[mi]} de ${y}` : m;
    });
    // ordinales 1o.
    t = t.replace(/\b(\d{1,2})(?:[oº°]|\s*[º°])\.?(?![a-záéíóúñ\d])/g, (m, n) => ORDINALS[+n] || n);
    // romanos después de fracción, capítulo, título...
    t = t.replace(/\b(fracci[óo]n(?:es)?|cap[íi]tulos?|t[íi]tulos?|secci[óo]n(?:es)?|libros?|apartados?|partes?|numerales?|bases?)\s+((?:[IVXLC]+\b(?:\s*(?:,|y|e|o|u|a|al|hasta|bis)\s*)?)+)/gi,
      (m, k, list) => k + ' ' + list.replace(/\b[IVXLC]+\b/g, r => { const n = romanToInt(r); return n == null ? r : String(n); }));
    t = t.trim();
    if (paraStart) {
      t = t.replace(/^([IVXLC]+)\s*(?:\.\s*[-–—]*|[-–—]+|\))\s*/, (m, r) => { const n = fraccionNum(r); return n == null ? m : `Fracción ${n}. `; })
        .replace(/^([a-zñ])\)\s*/, 'Inciso $1. ')
        .replace(/^([A-Z])\.\s*[-–—]+\s*/, 'Apartado $1. ')
        .replace(/^(\d{1,2})[.)]\s*[-–—]?\s*/, '$1. ');
    }
    t = t.replace(/\.\s*[-–—]+/g, '. ')
      .replace(/\s[-–—]+\s/g, ', ')
      .replace(/[*•■▪_]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return t;
  }

  function chunk(s, max = 220) {
    s = s.trim();
    if (!s) return [];
    if (s.length <= max) return [s];
    const pieces = s.match(/[^,;:]+[,;:]?\s*/g) || [s];
    const out = []; let cur = '';
    const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
    for (const p of pieces) {
      if (p.length > max) {
        push();
        const words = p.split(/\s+/); let w = '';
        for (const x of words) { if ((w + ' ' + x).length > max) { if (w.trim()) out.push(w.trim()); w = x; } else w = w ? w + ' ' + x : x; }
        if (w.trim()) out.push(w.trim());
        continue;
      }
      if ((cur + p).length > max) push();
      cur += p;
    }
    push();
    return out;
  }

  function labelSpeech(u) {
    if (u.type === 'heading') {
      const name = u.name ? ' ' + speechify(u.name, false).replace(/[.]$/, '') : '';
      return speechify(u.label, false) + '.' + (name ? name + '.' : '');
    }
    if (u.type === 'pre') return '';
    if (u.block) return '';
    let l = speechify(u.label.replace(/(\d)\s*-\s*(\d)/g, '$1 guion $2'), false);
    if (u.trans && !/^art/i.test(l)) l = 'Transitorio ' + l.toLowerCase();
    return l.replace(/\s*\.$/, '') + '.';
  }

  /* Segmentos que se leen para una unidad */
  function unitSegments(u, opts) {
    const segs = [];
    if (u.type !== 'heading' || opts.readHeadings !== false) {
      const l = labelSpeech(u);
      if (l) chunk(l).forEach(c => segs.push({ p: -1, s: 0, text: c }));
    }
    u.paras.forEach((para, pi) => {
      if (para.note && opts.skipNotes) return;
      splitSentences(para.text).forEach((sen, si) => {
        chunk(speechify(sen, si === 0)).forEach(c => segs.push({ p: pi, s: si, text: c }));
      });
    });
    return segs;
  }

  function unitChars(u, opts) {
    let n = u.label ? u.label.length + (u.name || '').length : 0;
    for (const p of u.paras) if (!(p.note && opts.skipNotes)) n += p.text.length;
    return n;
  }

  return { normalize, toParagraphs, cleanPages, parseLaw, splitSentences, speechify, chunk, unitSegments, unitChars, romanToInt, isNote, matchArticle, matchHeading };
})();
if (typeof module !== 'undefined') module.exports = LV;
