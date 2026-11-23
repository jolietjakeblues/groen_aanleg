// Hulpmiddel: toon uitkomst (en tekst) voor monumentnummers of een steekproef.
//   node scripts/toon.js 518800 6842            -> uitkomst per nummer
//   node scripts/toon.js --steekproef "v1=ja,code=3.G" 8 300
const fs = require('fs');
const path = require('path');
const rows = require('../data/resultaat.json');
const RAW = path.join(__dirname, '..', 'data', 'raw');
const uri = new Map(JSON.parse(fs.readFileSync(path.join(RAW, 'monument.json'), 'utf8')).map(r => [+r.nr, r.s]));
const oms = new Map();
for (const r of JSON.parse(fs.readFileSync(path.join(RAW, 'omschrijving.json'), 'utf8'))) oms.set(r.s, r.tekst);
const show = (r, n) => {
  console.log(`--- ${r.nr} [${r.code}${r.voorstel ? '>' + r.voorstel : ''}/${r.zekerheid}] v1:${r.v1type || '-'} | F:${r.functie} | T:${r.type}`);
  console.log('   R: ' + r.reden.slice(0, 300));
  if (n) console.log('   T: ' + (oms.get(uri.get(r.nr)) || '').replace(/\s+/g, ' ').slice(0, n));
};
const a = process.argv.slice(2);
if (a[0] === '--steekproef') {
  const conds = a[1].split(',').map(c => c.split('='));
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sel = rows.filter(r => conds.every(([k, v]) => new RegExp('^(' + v + ')$').test(String(r[k]))));
  console.log(`\n######## ${a[1]}: ${sel.length}`);
  sel.map(x => [rnd(), x]).sort((x, y) => x[0] - y[0]).slice(0, +a[2] || 8).forEach(x => show(x[1], +a[3] || 0));
} else a.forEach(nr => { const r = rows.find(x => x.nr === +nr); if (r) show(r, 400); });
