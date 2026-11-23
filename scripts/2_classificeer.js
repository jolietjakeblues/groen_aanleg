// Past het stroomschema (classify.js) toe op alle rijksmonumenten en vergelijkt met lijst groenaanleg v1.
// Uitvoer: data/resultaat.json  (daarna: python scripts/3_excel.py)
const fs = require('fs');
const path = require('path');
const S = require('../classify.js');
const RAW = path.join(__dirname, '..', 'data', 'raw');
const L = n => JSON.parse(fs.readFileSync(path.join(RAW, n + '.json'), 'utf8'));
const id = u => u.split('/').pop();

const labels = L('labels');
const mon = new Map();
for (const r of L('monument')) if (!mon.has(r.s)) mon.set(r.s, { uri: r.s, nr: r.nr, functies: [], types: [] });
const multi = (file, key, f) => { for (const r of L(file)) { const m = mon.get(r.s); if (m) f(m, r); } };
multi('aard', 'aard', (m, r) => { m.aard = labels[r.o] || ''; });
multi('naam', 'naam', (m, r) => { m.naam = m.naam || r.naam; });
multi('functie', 'functies', (m, r) => { const l = labels[r.o]; if (l && !m.functies.includes(l)) m.functies.push(l); });
multi('type', 'types', (m, r) => { const l = labels[r.o]; if (l && !m.types.includes(l)) m.types.push(l); });
const owms = u => decodeURIComponent(u.split('/').pop()).replace(/_\(gemeente\)$/, '').replace(/_/g, ' ');
multi('locatie', 'gemeente', (m, r) => { if (!m.gemeente) { m.gemeente = owms(r.gemeente); m.provincie = owms(r.provincie); } });

// omschrijvingen: per object de meest recente formele omschrijving
const oms = new Map();
for (const r of L('omschrijving')) { const o = oms.get(r.s); if (!o || r.datum > o.datum) oms.set(r.s, r); }

const cx = new Map();
for (const r of L('complex')) cx.set(r.c, { uri: r.c, nr: r.cnr, delen: [] });
for (const r of L('complexhoofd')) { const c = cx.get(r.c); if (c) c.hoofd = r.hoofd; }
multi('incomplex', 'complex', (m, r) => { const c = cx.get(r.complex); if (c && !m.complex) { m.complex = c; c.delen.push(m); } });

// lijst groenaanleg, eerste versie
const v1 = new Map();
for (const r of L('groenaanleg')) v1.set(r.s, { objectid: r.objectid, naam: r.naam, type: r.type, categorie: r.categorie });
for (const r of L('groenaanleg_contour')) { const g = v1.get(r.s); if (g) { g.contour = r.contour; g.opp = Math.round(+r.opp); } }

const rows = [];
for (const m of mon.values()) {
  const o = oms.get(m.uri);
  let c = S.classify({ tekst: o ? o.tekst : '', functies: m.functies, types: m.types });
  // het stroomschema gaat over aangelegde monumenten; archeologische monumenten (grafvelden e.d.) vallen erbuiten
  if (/archeolog/i.test(m.aard || '') && c.code !== '-') c = { code: '-', uitkomst: S.UITKOMST['-'], zekerheid: 'hoog', beschermd: false, reden: 'Archeologisch monument; valt buiten het stroomschema groenaanleg.' };
  m.res = c;
  m.tekst = o ? o.tekst : '';
}
// stap 4: complexomschrijving noemt aanleg, geen enkel onderdeel noemt hem
const stap4 = [];
for (const c of cx.values()) {
  const o = oms.get(c.uri);
  if (!o || !c.delen.length) continue;
  if (c.delen.some(m => m.res.code !== '-')) continue;
  const r = S.classifyComplex({ tekst: o.tekst });
  if (r) { c.res = r; stap4.push(c); }
}

const vergelijk = (m, g) => {
  const c = m.res;
  if (g && c.beschermd) return 'bevestigd';
  if (g && c.code === '?') return 'twijfelaar (staat op lijst v1)';
  if (g && m.complex && m.complex.res) return 'twijfelaar (staat op lijst v1; alleen in complexomschrijving)';
  if (g) return 'mogelijke afvaller (staat op lijst v1)';
  if (c.beschermd) return 'nieuw t.o.v. lijst v1';
  if (c.code === '?') return 'twijfelaar (niet op lijst v1)';
  return '';
};
for (const m of mon.values()) {
  const g = v1.get(m.uri), c = m.res;
  let code = c.code, uitkomst = c.uitkomst, reden = c.reden, zekerheid = c.zekerheid;
  if (code === '-' && m.complex && m.complex.res) { code = m.complex.res.code; uitkomst = m.complex.res.uitkomst; reden = m.complex.res.reden; zekerheid = m.complex.res.zekerheid; }
  rows.push({
    nr: +m.nr, naam: m.naam || (g && g.naam) || '', gemeente: m.gemeente || '', provincie: m.provincie || '',
    complexnr: m.complex ? +m.complex.nr : null, hoofdobject: m.complex ? (m.complex.hoofd === m.uri ? 'ja' : 'nee') : '',
    functie: m.functies.join('; '), type: m.types.join('; '),
    code, voorstel: c.voorstel || '', uitkomst, beschermd: c.beschermd, zekerheid, reden,
    v1: g ? 'ja' : 'nee', v1type: g ? g.type : '', v1categorie: g ? g.categorie : '', v1contour: g ? g.contour || '' : '', v1opp: g ? g.opp || null : null,
    vergelijking: vergelijk(m, g),
    link: 'https://monumentenregister.cultureelerfgoed.nl/monumenten/' + m.nr
  });
}
rows.sort((a, b) => a.nr - b.nr);
fs.writeFileSync(path.join(__dirname, '..', 'data', 'resultaat.json'), JSON.stringify(rows));

const tel = (f) => { const t = {}; for (const r of rows) { const k = f(r); t[k] = (t[k] || 0) + 1; } return Object.entries(t).sort((a, b) => b[1] - a[1]); };
console.log('rijksmonumenten:', rows.length, '| lijst v1:', v1.size, '| stap 4 complexen:', stap4.length);
console.log('code:', tel(r => r.code).map(x => x.join(' ')).join(' | '));
console.log('vergelijking:', tel(r => r.vergelijking || '(geen groen)').map(x => x.join(': ')).join(' | '));
console.log('v1 per code:', tel(r => r.v1 === 'ja' ? r.code : null).filter(x => x[0] !== 'null').map(x => x.join(' ')).join(' | '));
console.log('beschermd per zekerheid (niet v1):', tel(r => r.beschermd && r.v1 === 'nee' ? r.code + '/' + r.zekerheid : null).filter(x => x[0] !== 'null').map(x => x.join(' ')).join(' | '));
if (process.argv[2]) for (const nr of process.argv.slice(2)) { const r = rows.find(x => x.nr === +nr); console.log(JSON.stringify(r, null, 1)); }
