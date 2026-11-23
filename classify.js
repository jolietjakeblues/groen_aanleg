/*
 * Stroomschema "Inventarisatie beschermde groenaanleg: Uniform inventariseren" (RCE, 16 november 2015)
 * als uitvoerbare regels. Dit ene bestand wordt gebruikt door de pagina (index.html) en door de
 * bulkverwerking (scripts/2_classificeer.js), zodat beide altijd hetzelfde antwoord geven.
 *
 * classify({tekst, functies, types}) -> {code, uitkomst, zekerheid, reden, stappen, vermeldingen, secties}
 */
(function (root) {
  'use strict';

  var UITKOMST = {
    '1.A': 'Beschermde groenaanleg', '2.A': 'Beschermde groenaanleg', '2.B': 'Beschermde groenaanleg',
    '2.C': 'Geen beschermde groenaanleg', '3.A': 'Geen beschermde groenaanleg', '3.B': 'Beschermde groenaanleg',
    '3.C': 'Beschermde groenaanleg', '3.D': 'Beschermde groenaanleg', '3.E': 'Beschermde groenaanleg',
    '3.F': 'Geen beschermde groenaanleg', '3.G': 'Geen beschermde groenaanleg',
    '4.A': 'Geen beschermde groenaanleg, vraagt nader onderzoek', '4.B': 'Geen beschermde groenaanleg',
    '-': 'Geen groenaanleg genoemd', '?': 'Twijfel: handmatig beoordelen'
  };

  // --- woordenlijsten ------------------------------------------------------------------------
  // Woorden die een groenaanleg aanduiden. Samenstellingen waarin het groene woord vooraan staat
  // (tuinmuur, tuinhuis, parkgebouw, kerkhofmuur) zijn gebouwde objecten en tellen dus niet mee.
  var EXACT = ('tuin tuinen tuintje park parken parkje begraafplaats begraafplaatsen kerkhof kerkhoven ' +
    'plantsoen plantsoenen boomgaard boomgaarden erf boerenerf laan lanen oprijlaan toegangslaan lanenstelsel ' +
    'lanenstructuur beplanting erfbeplanting tuinaanleg parkaanleg groenaanleg erfaanleg bosaanleg parkbos sterrenbos ' +
    'wandelbos eendenkooi arboretum pinetum hortus doolhof berceau grafveld grafvelden dodenakker kloosterhof ' +
    'vijver vijvers waterpartij waterpartijen slotgracht omgrachting boomgroep boomgroepen bomenrij bomenrijen ' +
    'boomsingel hagen haag gazon gazons godsakker kerkhofje begraafplaatsje tuingedeelte achtererf voorerf binnenerf ' +
    'leilinden lindebomen bomen bomengroep bosschage bosquet').split(' ');
  var SUFFIX = /(tuin|tuinen|tuintje|park|parken|parkje|parkaanleg|tuinaanleg|begraafplaats|begraafplaatsen|kerkhof|plantsoen|boomgaard|beplanting|laan|lanen)$/;
  var NIET = ('wintertuin daktuin dierenpark industriepark bedrijvenpark wagenpark machinepark sportpark ' +
    'woonpark bungalowpark recreatiepark attractiepark').split(' ');
  // alleen in HOOFDLETTERS een groenaanleg (in onderkast te dubbelzinnig: "aanleg van de spoorlijn")
  var ALLEEN_KAPITAAL = ['aanleg', 'beplantingen'];
  // zwakke aanduidingen: tellen alleen mee als ondersteuning/specificatie, niet als zelfstandige aanleg
  var ZWAK = ('vijver vijvers waterpartij waterpartijen slotgracht omgrachting boomgroep boomgroepen bomenrij bomenrijen ' +
    'boomsingel hagen haag gazon gazons laan lanen oprijlaan toegangslaan beplanting grafveld grafvelden leilinden lindebomen bomen bomengroep bosschage bosquet').split(' ');

  var PLAATS = ('in op aan bij naast achter voor tegenover langs rondom binnen buiten tussen naar nabij te vanuit ' +
    'vanaf uit over tegen door tot om onder boven richting van vanwege ten ter').split(' ');
  var OPSOMMING = 'met en alsmede benevens inclusief alsook evenals plus alsmede benevens'.split(' ');
  var LIDWOORD = ("de het een den der des 't zijn haar hun deze dit die dat dezelfde bijbehorende bijbehorend " +
    'voormalige voormalig huidige oorspronkelijke oude grote kleine omliggende omringende aangrenzende gelijknamige ' +
    'besloten ommuurde omgrachte fraaie ruime diepe brede smalle lange eigen aanliggende achterliggende nabijgelegen ' +
    'aangelegde historische landschappelijke formele').split(' ');
  var SPECIFICATIE = ('bomen boom linden lindebomen leilinden beuken eiken kastanjes haag hagen vijver vijvers paden pad ' +
    'gracht singel boomsingel lanen gazon heesters beplanting bestaande omgeven omringd aangelegd ontworpen ontwerp ' +
    'landschapsstijl landschappelijke formele geometrische slingerpaden waterpartij graven grafmonumenten zerken ' +
    'boomgaard moestuin perken borders rozen fruitbomen').split(' ');
  var UITGEZONDERD = /(niet\s+(?:onder\s+de\s+bescherming|beschermd|beschermenswaardig|van\s+rijkswege)|geen\s+bescherming|buiten\s+de\s+bescherming|van\s+(?:de\s+)?bescherming\s+uitgesloten|uitgezonderd|valt\s+niet\s+onder)/i;

  var set = function (a) { var o = Object.create(null); a.forEach(function (x) { o[x] = 1; }); return o; };
  EXACT = set(EXACT); NIET = set(NIET); ALLEEN_KAPITAAL = set(ALLEEN_KAPITAAL); ZWAK = set(ZWAK);
  PLAATS = set(PLAATS); OPSOMMING = set(OPSOMMING); LIDWOORD = set(LIDWOORD); SPECIFICATIE = set(SPECIFICATIE);

  var GROENE_FUNCTIES = set(('historische aanleg|tuin|begraafplaats|park|kerkhof|erfinrichting|erfbeplanting|plantsoen|' +
    'boomgroep|boomgaard|wandelpark|kloosterhof|hortus|landschappelijke tuin|landschapspark|formele tuin|siertuin|' +
    'stadspark|particuliere begraafplaats|overtuin|moestuin(l)|heemtuin|plantentuin|pinetum|schooltuin|instructietuin|' +
    'binnentuin (l)|rotstuin|algemene begraafplaats|kerkelijke begraafplaats|joodse begraafplaats').split('|'));

  // --- tekst ontleden ------------------------------------------------------------------------
  var WOORD = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’]*(?:-[A-Za-zÀ-ÿ]+)*-?/g;
  var KOP = /^[ \t]*(inleiding|omschrijving|beschrijving|waardering|motivering)\b[ \t]*((?:van\s+het\s+)?(?:complex)?(?:onderdeel)?\s*\d*)?[ \t]*[:.]?[ \t]*$/gim;

  function isKapitaal(w) { var l = w.replace(/[^A-Za-zÀ-ÿ]/g, ''); return l.length >= 3 && l === l.toUpperCase(); }

  function groenWoord(w, kapitaal, zinsbegin) {
    var k = w.toLowerCase().replace(/-$/, '').replace(/[’']s$/, '');
    if (NIET[k]) return null;
    // Eigennaam midden in de zin (Wilhelminapark, Parklaan) is een adres of naam, geen aanduiding van een aanleg.
    // (exacte woorden als Kerkhof en Tuin mogen wel met een hoofdletter geschreven zijn)
    var eigennaam = !kapitaal && /^[A-ZÀ-Ý]/.test(w) && !zinsbegin;
    if (eigennaam && !(EXACT[k] && !/laan$|lanen$|park$/.test(k))) return null;
    if (ALLEEN_KAPITAAL[k]) return kapitaal ? k : null;
    var delen = k.split('-');
    for (var i = 0; i < delen.length; i++) {
      var d = delen[i];
      if (EXACT[d]) return k;
      if (d.length > 5 && SUFFIX.test(d) && !NIET[d]) {
        // straatnamen op -laan/-park in onderkast komen niet voor; in kapitalen wel (bv. adresregels) -> accepteren
        if (/laan$|lanen$/.test(d) && !/^(oprij|toegangs|beuken|linden|eiken|kastanje|zicht|hoofd|dwars|midden|zij)/.test(d) && !kapitaal) continue;
        return k;
      }
    }
    return null;
  }

  function secties(tekst) {
    var koppen = [], m;
    KOP.lastIndex = 0;
    while ((m = KOP.exec(tekst))) {
      var n = m[1].toLowerCase();
      koppen.push({ naam: n === 'beschrijving' ? 'omschrijving' : n === 'motivering' ? 'waardering' : n, start: m.index, eind: m.index + m[0].length, nummer: !!(m[2] && m[2].trim()) });
    }
    // "Omschrijving onderdeel 40" direct gevolgd door "Inleiding" is een titelregel, geen sectie
    koppen = koppen.filter(function (k, i) {
      return !(k.naam === 'omschrijving' && k.nummer && koppen[i + 1] && koppen[i + 1].naam === 'inleiding' && tekst.slice(k.eind, koppen[i + 1].start).trim().length < 5);
    });
    var heeft = {}; koppen.forEach(function (k) { heeft[k.naam] = 1; });
    var gestructureerd = !!(heeft.waardering || heeft.inleiding);
    var res = [];
    if (!gestructureerd) return { gestructureerd: false, delen: [{ naam: 'tekst', start: 0, eind: tekst.length }] };
    if (koppen[0].start > 0 && tekst.slice(0, koppen[0].start).trim().length > 0) {
      // tekst voor de eerste kop geldt als inleiding
      res.push({ naam: 'inleiding', start: 0, eind: koppen[0].start });
    }
    for (var i = 0; i < koppen.length; i++) {
      res.push({ naam: koppen[i].naam, start: koppen[i].eind, eind: i + 1 < koppen.length ? koppen[i + 1].start : tekst.length });
    }
    return { gestructureerd: true, delen: res };
  }

  function tokens(tekst) {
    var t = [], m; WOORD.lastIndex = 0;
    while ((m = WOORD.exec(tekst))) t.push({ w: m[0], s: m.index, e: m.index + m[0].length });
    return t;
  }

  function vermeldingen(tekst, sec) {
    var tk = tokens(tekst), uit = [];
    var nKap = 0; tk.forEach(function (t) { t.kap = isKapitaal(t.w); if (t.kap) nKap++; });
    var allesKapitaal = tk.length > 0 && nKap / tk.length > 0.5;
    for (var i = 0; i < tk.length; i++) {
      var t = tk[i];
      var tussen = i > 0 ? tekst.slice(tk[i - 1].e, t.s) : '\n';
      var zinsbegin = i === 0 || /[.!?:;]\s*$|\n\s*$/.test(tussen);
      var kap = t.kap && !allesKapitaal;
      var g = groenWoord(t.w, kap, zinsbegin);
      if (!g) continue;
      if (tekst.charAt(t.s - 1) === '(' && /^\)[a-zA-Z]/.test(tekst.slice(t.e, t.e + 2))) continue; // "(tuin)architect"
      if (/-$/.test(t.w)) {
        // afgebroken samenstelling: "TUIN- en STOEPHEK" is een hek, "TUIN- EN PARKAANLEG" een aanleg
        var rest = tk[i + 2] && /^(en|of)$/i.test(tk[i + 1].w) ? tk[i + 2].w : (tk[i + 1] ? tk[i + 1].w : '');
        if (!(groenWoord(rest, isKapitaal(rest), false) || /aanleg$/i.test(rest))) continue;
      }
      // klasse bepalen: KAPITAAL, OPSOMMING ("met tuin"), ONDERWERP ("De tuin is ..."), PLAATS ("in de tuin")
      var klasse = 'ONDERWERP', j = i - 1, stappen = 0, voorzetsel = null;
      if (kap) {
        klasse = 'KAPITAAL';
        // "HEK VAN DE BEGRAAFPLAATS", "ORANJERIE van de TUIN": het object is het hek, de aanleg is plaatsbepaling
        for (var c = i - 1, cn = 0; c >= 0 && cn < 4; c--, cn++) {
          if (/[.!?;:()\n,]/.test(tekst.slice(tk[c].e, tk[c + 1].s))) break;
          var cw = tk[c].w.toLowerCase();
          if (/^(van|bij|op|in|aan|over|naar|tot|rond|rondom|om|voor|achter|langs)$/.test(cw)) { if (c > 0) { klasse = 'PLAATS'; voorzetsel = cw; } break; }
          if (!(LIDWOORD[cw] || /(e|en)$/.test(cw))) break;
        }
        // "TUINVAZEN ROTSTUIN": objectnaam gevolgd door de plek; "op ... KERKHOF gelegen KERK": situering
        var pv = i > 0 && !/[.!?;:()\n,]/.test(tussen) ? tk[i - 1] : null;
        if (pv && pv.kap && !/^(EN|OF|MET)$/.test(pv.w) && (/^(TUIN|PARK|GRAF|HEK)/.test(pv.w) || !/(E|EN|SCH|\d)-?$/.test(pv.w))) { klasse = 'PLAATS'; voorzetsel = 'object ' + pv.w; }
        if (/^\s*(gelegen|staande|gebouwde?|geplaatste?|gesitueerde?)\b/.test(tekst.slice(t.e, t.e + 15))) { klasse = 'PLAATS'; voorzetsel = 'gelegen'; }
      } else {
        while (j >= 0 && stappen < 5) {
          var gat = tekst.slice(tk[j].e, tk[j + 1].s);
          if (/[.!?;:()\n]/.test(gat)) break; // zinsgrens
          var lw = tk[j].w.toLowerCase();
          if (PLAATS[lw]) { klasse = 'PLAATS'; voorzetsel = lw; break; }
          if (OPSOMMING[lw]) {
            // "tussen de kerk en de tuin": kijk verder terug of de opsomming zelf onder een voorzetsel hangt
            klasse = 'OPSOMMING'; voorzetsel = lw;
            if (lw === 'met' && j > 0 && /^(relatie|samenhang|verband|samen|geheel|eenheid|ensemble|verbonden|overeenkomst|tezamen|combinatie|contact|verbinding)$/i.test(tk[j - 1].w)) { klasse = 'PLAATS'; voorzetsel = tk[j - 1].w + ' met'; break; }
            var vorige = uit[uit.length - 1];
            if (lw !== 'met' && vorige && vorige.index >= j - 3 && vorige.klasse === 'PLAATS') { klasse = 'PLAATS'; voorzetsel = vorige.voorzetsel + ' ... ' + lw; break; }
            if (lw === 'met') {
              var voor = tekst.slice(Math.max(0, tk[j].s - 90), tk[j].s).split(/[.;:\n]/).pop();
              if (/\b(gelegen|ligt|liggen|staat|staan|gesitueerd|situering)\b/i.test(voor)) { klasse = 'PLAATS'; voorzetsel = 'gelegen ... met'; break; }
            }
            for (var q = j - 1, n = 0; q >= 0 && n < 5; q--, n++) {
              if (/[.!?;:()\n]/.test(tekst.slice(tk[q].e, tk[q + 1].s))) break;
              var qw = tk[q].w.toLowerCase();
              if (PLAATS[qw] && qw !== 'van') { klasse = 'PLAATS'; voorzetsel = qw + ' ... ' + lw; break; }
              if (OPSOMMING[qw] || tk[q].kap) break;
            }
            break;
          }
          if (/,/.test(gat) && stappen === 0) { klasse = 'OPSOMMING'; voorzetsel = ','; }
          if (!(LIDWOORD[lw] || /(e|en|ste|de|d|ig|ijk)$/.test(lw))) break; // geen lidwoord/bijv. nw. meer: stop
          j--; stappen++;
        }
      }
      // nadere specificatie: bijvoeglijk naamwoord ervoor of kenmerkende woorden erna
      var spec = false, zinEind = tekst.slice(t.e).search(/[.!?;\n]/); zinEind = zinEind < 0 ? tekst.length : t.e + zinEind;
      for (var a = i + 1; a < tk.length && a <= i + 10 && tk[a].s < zinEind; a++) if (SPECIFICATIE[tk[a].w.toLowerCase()]) spec = true;
      if (i > 0 && !/[.!?;:()\n,]/.test(tussen)) { var vw = tk[i - 1].w.toLowerCase(); if (/e$/.test(vw) && !/^(de|deze|die|een)$/.test(vw)) spec = true; }
      // zin waarin de vermelding staat (voor de reden en voor "uitgezonderd")
      var zs = Math.max(tekst.lastIndexOf('.', t.s - 1), tekst.lastIndexOf('\n', t.s - 1)) + 1;
      var zin = tekst.slice(zs, Math.min(zinEind + 1, zs + 400)).replace(/\s+/g, ' ').trim();
      if (!kap && klasse !== 'PLAATS') {
        // voetnoot bij 2.C: "de tuin wordt aan de oostzijde afgesloten door een TUINMUUR" is situering
        var na = tekst.slice(t.e, zinEind), heleZin = tekst.slice(zs, zinEind);
        if (/^[^,]{0,60}\b(wordt|worden|is|zijn|werd)\b[^.]{0,120}\b(afgesloten|gescheiden|afgescheiden|omgeven|begrensd|omsloten|omheind|afgezet|omzoomd|omringd|bereikbaar|te bereiken|toegankelijk)\b/i.test(na)
          || /\b(afsluit|afsluiten|begrenst|begrenzen|omsluit|omsluiten|scheidt|scheiden|toegang (?:geeft|geven|biedt|bieden) tot|uitkomt op|uitkijkt op)\b/i.test(heleZin) || /\bsluit(en)?\b[^.]{0,160}\baf\b/i.test(heleZin)) {
          klasse = 'PLAATS'; voorzetsel = 'afsluiting/toegang';
        }
      }
      var sectie = 'tekst';
      for (var s = 0; s < sec.delen.length; s++) if (t.s >= sec.delen[s].start && t.s < sec.delen[s].eind) sectie = sec.delen[s].naam;
      uit.push({ woord: t.w, term: g, start: t.s, eind: t.e, sectie: sectie, klasse: klasse, voorzetsel: voorzetsel,
        zwak: !!ZWAK[g.split('-').pop()] && !kap, zwakTerm: !!ZWAK[g.split('-').pop()], specificatie: spec, uitgezonderd: UITGEZONDERD.test(zin), zin: zin, index: i });
    }
    return { vermeldingen: uit, tokens: tk, allesKapitaal: allesKapitaal };
  }

  function citaat(v) { var z = v.zin; return '“' + (z.length > 180 ? z.slice(0, 177) + '…' : z) + '”'; }
  function uniek(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  // --- het stroomschema ----------------------------------------------------------------------
  function classify(inp) {
    var tekst = (inp.tekst || '').replace(/\r\n?/g, '\n');
    var functies = (inp.functies || []).concat(inp.types || []);
    var sec = secties(tekst), an = vermeldingen(tekst, sec), V = an.vermeldingen, tk = an.tokens;
    var stappen = [];
    var res = function (code, zekerheid, reden, extra) {
      var o = { code: code, uitkomst: UITKOMST[code], zekerheid: zekerheid, reden: reden, stappen: stappen,
        vermeldingen: V, secties: sec, beschermd: /^(1\.A|2\.A|2\.B|3\.[BCDE])$/.test(code) };
      if (extra) for (var k in extra) o[k] = extra[k];
      return o;
    };
    if (!tekst.trim()) return res('?', 'laag', 'Geen registeromschrijving beschikbaar.');

    // ---- Stap 1: eigen monumentnummer, groenaanleg is hoofdonderwerp --------------------------
    // Het hoofdonderwerp is de eerste aanduiding in kapitalen; zonder kapitalen het begin van de tekst.
    var hoofd = null, eersteKap = -1;
    for (var i = 0; i < tk.length; i++) if (tk[i].kap && !an.allesKapitaal) { eersteKap = i; break; }
    var groeneFunctie = functies.filter(function (f) { return GROENE_FUNCTIES[String(f).toLowerCase()]; });
    if (eersteKap >= 0) {
      var eind = eersteKap;
      while (eind + 1 < tk.length && (tk[eind + 1].kap || (/^(en|met|of)$/i.test(tk[eind + 1].w) && eind + 2 < tk.length && tk[eind + 2].kap && /^(en|of)$/i.test(tk[eind + 1].w)))
        && !/[.;:(\n]/.test(tekst.slice(tk[eind].e, tk[eind + 1].s))) eind++;
      var frase = tekst.slice(tk[eersteKap].s, tk[eind].e);
      var inFrase = V.filter(function (v) { return v.index >= eersteKap && v.index <= eind && v.klasse === 'KAPITAAL'; });
      // het laatste woord van de frase is het zelfstandig naamwoord: "HEK VAN DE BEGRAAFPLAATS" is een hek
      var vanConstructie = /\b(VAN|BIJ|OP|IN|AAN|OVER|TE|MET|NAAR|TOT)\b/.test(frase);
      if (vanConstructie) {
        // alleen het deel voor het voorzetsel is het object: "PARK MET VIJVER" wel, "BRUG OVER GRACHT" niet
        var grens = tk[eersteKap].s + frase.search(/(VAN|BIJ|OP|IN|AAN|OVER|TE|MET|NAAR|TOT)/);
        inFrase = inFrase.filter(function (v) { return v.start < grens; });
      }
      // woorden voor de aanleg moeten bijvoeglijk zijn (OMMUURDE MOESTUIN); "TUINVAZEN ROTSTUIN" en "STENEN TUINBANK ROTSTUIN" zijn objecten in de tuin
      inFrase = inFrase.filter(function (v) {
        for (var b = eersteKap; b < v.index; b++) { var bw = tk[b].w; if (/^(TUIN|PARK|GRAF|HEK|KERKHOF)/.test(bw) || !/(E|EN|SCH|\d)-?$/.test(bw)) return false; }
        return true;
      });
      if (inFrase.length && /^\s*(gelegen|staande|gebouwde?|geplaatste?|gesitueerde?)\b/.test(tekst.slice(inFrase[0].eind, inFrase[0].eind + 15))) inFrase = [];
      if (inFrase.length) hoofd = { frase: frase, v: inFrase[0], bron: 'kapitalen' };
      stappen.push({ stap: 1, vraag: 'De groenaanleg heeft een eigen monumentnummer, is hoofdonderwerp', antwoord: hoofd ? 'ja' : 'nee',
        toelichting: 'Eerste aanduiding in kapitalen: ' + frase });
    } else {
      // zonder kapitalen: de tekst moet met de aanleg zelf beginnen ("Kerkhof met ...", "Oude begraafplaats ...")
      var begin = V.filter(function (v) {
        if (v.index > 3 || v.klasse === 'PLAATS' || v.zwak) return false;
        for (var b = 0; b < v.index; b++) { var bw = tk[b].w.toLowerCase(); if (!(LIDWOORD[bw] || /(e|en|d|ig|ijk)$/.test(bw) || /^(herv|ned|alg|rk|isr|n\.?h)$/.test(bw))) return false; }
        return true;
      });
      var alleFunctiesGroen = functies.length > 0 && groeneFunctie.length === functies.length;
      if (begin.length) hoofd = { frase: tekst.slice(0, Math.min(tekst.length, tk[Math.min(tk.length - 1, 7)].e)), v: begin[0], bron: 'tekstbegin' };
      else if (alleFunctiesGroen && V.some(function (v) { return v.klasse !== 'PLAATS'; })) hoofd = { frase: groeneFunctie.join(', '), v: null, bron: 'functie' };
      stappen.push({ stap: 1, vraag: 'De groenaanleg heeft een eigen monumentnummer, is hoofdonderwerp', antwoord: hoofd ? 'ja' : 'nee',
        toelichting: hoofd ? 'Geen kapitalen in de tekst; ' + (hoofd.bron === 'functie' ? 'functie/type in het register: ' : 'de tekst begint met: ') + hoofd.frase
          : 'Geen kapitalen in de tekst en de tekst begint niet met een groenaanleg.' });
    }
    if (hoofd) {
      var z = hoofd.bron === 'kapitalen' ? (hoofd.v.zwakTerm ? 'middel' : 'hoog') : 'middel';
      var r = 'Hoofdonderwerp van dit monumentnummer is een groenaanleg: ' +
        (hoofd.bron === 'kapitalen' ? 'de omschrijving opent met “' + hoofd.frase + '” in kapitalen'
          : hoofd.bron === 'tekstbegin' ? 'de omschrijving begint met “' + hoofd.frase.replace(/\s+/g, ' ') + '”'
          : 'functie/type in het register is ' + hoofd.frase + ' en de aanleg wordt in de tekst genoemd') +
        (groeneFunctie.length && hoofd.bron !== 'functie' ? '; functie/type in het register: ' + uniek(groeneFunctie).join(', ') : '') + '.';
      if (hoofd.v && hoofd.v.zwakTerm) r += ' Let op: “' + hoofd.v.woord + '” is een onderdeel van een aanleg (laan, vijver, haag), geen complete aanleg.';
      return res('1.A', z, r);
    }

    var echte = V.filter(function (v) { return !v.zwak; });
    if (!echte.length) {
      stappen.push({ stap: sec.gestructureerd ? 3 : 2, vraag: 'Wordt een groenaanleg genoemd?', antwoord: 'nee', toelichting: 'Geen tuin, park, begraafplaats, kerkhof, plantsoen e.d. in de omschrijving.' });
      return res('-', 'hoog', 'In de registeromschrijving wordt geen groenaanleg genoemd' + (V.length ? ' (alleen losse elementen: ' + uniek(V.map(function (v) { return v.woord; })).slice(0, 4).join(', ') + ')' : '') + '.');
    }
    var plaats = echte.filter(function (v) { return v.klasse === 'PLAATS'; });
    var geenPlaats = echte.filter(function (v) { return v.klasse !== 'PLAATS'; });
    var kap = echte.filter(function (v) { return v.klasse === 'KAPITAAL'; });
    var uitgez = geenPlaats.filter(function (v) { return v.uitgezonderd; });
    var woorden = function (a) { return uniek(a.map(function (v) { return v.woord; })).slice(0, 4).join(', '); };
    // aanleg zelf alleen als plaats genoemd, maar met groene elementen erin ("In de tuin diverse monumentale bomen")
    var GROEN_ELEMENT = /(bomen|boom|geboomte|beuk|beuken|linde|linden|leilinden|eik|eiken|kastanje|kastanjes|plataan|platanen|taxus|moerbei\w*|beplanting|haag|hagen|boomgroep\w*|solitair\w*)/i;
    var metElement = plaats.filter(function (v) { return GROEN_ELEMENT.test(v.zin); });
    var waarschuwing = uitgez.length ? ' LET OP: de tekst lijkt de aanleg uit te zonderen van bescherming: ' + citaat(uitgez[0]) : '';

    // ---- Stap 2: oudere, platte omschrijving --------------------------------------------------
    if (!sec.gestructureerd) {
      stappen.push({ stap: 2, vraag: 'De (oudere) omschrijving is een platte tekst zonder indeling in inleiding/omschrijving/waardering', antwoord: 'ja',
        toelichting: 'Geen kopjes Inleiding of Waardering gevonden.' });
      if (!geenPlaats.length) {
        stappen.push({ stap: '2.C', vraag: 'Louter plaatsaanduiding (situeringswaarde)', antwoord: metElement.length ? 'twijfel' : 'ja', toelichting: woorden(plaats) });
        if (metElement.length) return res('?', 'laag', 'Platte omschrijving; de aanleg (' + woorden(plaats) + ') is alleen als plaatsaanduiding genoemd (2.C), maar er worden wel groene elementen in genoemd: ' + citaat(metElement[0]), { voorstel: '2.C' });
        return res('2.C', plaats.length > 1 ? 'hoog' : 'middel', 'Platte omschrijving; de aanleg (' + woorden(plaats) + ') komt alleen voor als plaatsaanduiding: ' + citaat(plaats[0]));
      }
      var zelfst = kap.length ? kap : geenPlaats.filter(function (v) { return v.klasse === 'OPSOMMING'; });
      if (!zelfst.length) {
        // alleen als onderwerp van een zin ("De tuin wordt afgesloten door een TUINMUUR"): schema-voorbeeld bij 2.C,
        // maar kan ook een echte beschrijving van de aanleg zijn.
        var gespec = geenPlaats.filter(function (v) { return v.specificatie; });
        stappen.push({ stap: '2.B/2.C', vraag: 'Zelfstandige eenheid of plaatsaanduiding?', antwoord: 'onduidelijk', toelichting: woorden(geenPlaats) });
        return res('?', 'laag', 'Platte omschrijving; de aanleg (' + woorden(geenPlaats) + ') wordt genoemd in een lopende zin, niet in kapitalen en niet in een opsomming. ' +
          (gespec.length ? 'Mogelijk 2.B (nadere specificatie)' : 'Mogelijk 2.C (situering)') + ': ' + citaat(geenPlaats[0]) + waarschuwing, { voorstel: gespec.length ? '2.B' : '2.C' });
      }
      var metSpec = zelfst.filter(function (v) { return v.specificatie; });
      var code = metSpec.length ? '2.B' : '2.A', v0 = (metSpec[0] || zelfst[0]);
      stappen.push({ stap: code, vraag: code === '2.B' ? 'Genoemd als zelfstandige eenheid met nadere specificatie' : 'Genoemd als zelfstandige eenheid met zeer korte aanduiding', antwoord: 'ja', toelichting: woorden(zelfst) });
      return res(uitgez.length ? '?' : code, kap.length ? 'hoog' : 'middel',
        'Platte omschrijving; de aanleg wordt als zelfstandige eenheid genoemd (' + (kap.length ? 'in kapitalen: ' : 'in opsomming: ') + woorden(zelfst) + ')' +
        (code === '2.B' ? ' met nadere specificatie' : ' met zeer korte aanduiding') + ': ' + citaat(v0) + waarschuwing, uitgez.length ? { voorstel: code } : null);
    }

    // ---- Stap 3: nieuwere omschrijving met inleiding / omschrijving / waardering ---------------
    stappen.push({ stap: 2, vraag: 'De (oudere) omschrijving is een platte tekst', antwoord: 'nee', toelichting: 'Kopjes gevonden: ' + uniek(sec.delen.map(function (d) { return d.naam; })).join(', ') });
    stappen.push({ stap: 3, vraag: 'Nieuwere omschrijving met inleiding, omschrijving en waardering', antwoord: 'ja', toelichting: '' });
    var inSec = function (a, n) { return a.filter(function (v) { return v.sectie === n; }); };
    var I = inSec(geenPlaats, 'inleiding'), O = inSec(geenPlaats, 'omschrijving'), W = inSec(geenPlaats, 'waardering');
    var waar = [I.length ? 'inleiding' : '', O.length ? 'omschrijving' : '', W.length ? 'waardering' : ''].filter(String).join(' + ');
    var stap3 = function (code, vraag) { stappen.push({ stap: code, vraag: vraag, antwoord: 'ja', toelichting: woorden(geenPlaats.length ? geenPlaats : plaats) + (waar ? ' (' + waar + ')' : '') }); };
    if (!geenPlaats.length) {
      stap3('3.G', 'De aanleg is alleen genoemd als plaatsbepaling, in welk deel ook');
      if (metElement.length) return res('?', 'laag', 'De aanleg (' + woorden(plaats) + ') is alleen als plaatsbepaling genoemd (3.G), maar er worden wel groene elementen in genoemd: ' + citaat(metElement[0]), { voorstel: '3.G' });
      return res('3.G', plaats.length > 1 ? 'hoog' : 'middel', 'De aanleg (' + woorden(plaats) + ') is alleen genoemd als plaatsbepaling: ' + citaat(plaats[0]));
    }
    if (kap.length) {
      var kI = inSec(kap, 'inleiding'), kO = inSec(kap, 'omschrijving'), kW = inSec(kap, 'waardering');
      if (kI.length || (kW.length && !kO.length)) {
        stap3('3.B', 'De aanleg is genoemd in de inleiding, of inleiding en waardering, in HOOFDLETTERS');
        return res(uitgez.length ? '?' : '3.B', 'hoog', 'De aanleg is in HOOFDLETTERS genoemd in de ' + (kI.length ? 'inleiding' : 'waardering') + ' (' + woorden(kap) + '): ' + citaat(kI[0] || kW[0]) + waarschuwing, uitgez.length ? { voorstel: '3.B' } : null);
      }
      // kapitalen alleen in het deel "omschrijving": valt onder 3.C/3.D/3.E, met hoge zekerheid
    }
    var code3, vraag3;
    if (I.length && O.length && W.length) { code3 = '3.D'; vraag3 = 'De aanleg is genoemd in de inleiding, omschrijving én waardering en het is geen plaatsbepaling'; }
    else if (I.length && O.length) { code3 = '3.C'; vraag3 = 'De aanleg is genoemd in de inleiding en omschrijving, en het is geen plaatsbepaling'; }
    else if (O.length) { code3 = '3.E'; vraag3 = 'De aanleg is genoemd in omschrijving of omschrijving en waardering, en het is geen plaatsbepaling'; }
    else if (W.length && !I.length) { code3 = '3.F'; vraag3 = 'De aanleg is alleen genoemd in de waardering'; }
    else if (I.length && !W.length) { code3 = '3.A'; vraag3 = 'De aanleg is alleen genoemd in de inleiding, in kleine letters (onderkast)'; }
    else {
      // inleiding + waardering in onderkast, niet in omschrijving: deze combinatie staat niet in het stroomschema
      stappen.push({ stap: '3.?', vraag: 'Genoemd in inleiding en waardering in onderkast, niet in omschrijving', antwoord: 'niet in schema', toelichting: woorden(geenPlaats) });
      return res('?', 'laag', 'De aanleg (' + woorden(geenPlaats) + ') is in onderkast genoemd in inleiding én waardering, maar niet in de omschrijving. Deze combinatie staat niet in het stroomschema (ligt tussen 3.A en 3.F): ' + citaat(I[0]), { voorstel: '3.A' });
    }
    stap3(code3, vraag3);
    var sterk = kap.length > 0 || geenPlaats.filter(function (v) { return v.klasse === 'OPSOMMING' || v.specificatie; }).length > 0;
    var zk = kap.length ? 'hoog' : (geenPlaats.length >= 2 && sterk ? 'middel' : 'laag');
    var besch = /3\.[CDE]/.test(code3);
    var red = 'De aanleg (' + woorden(geenPlaats) + ') is genoemd in ' + waar + (besch ? ' en het is geen plaatsbepaling' : (code3 === '3.A' ? ', in onderkast' : '')) + ': ' + citaat((O[0] || I[0] || W[0])) + waarschuwing;
    if (besch && uitgez.length) return res('?', 'laag', red, { voorstel: code3 });
    return res(code3, zk, red);
  }

  // ---- Stap 4: alleen genoemd in de complexomschrijving -------------------------------------
  function classifyComplex(inp) {
    var tekst = (inp.tekst || '').replace(/\r\n?/g, '\n');
    var sec = secties(tekst), V = vermeldingen(tekst, sec).vermeldingen.filter(function (v) { return !v.zwak; });
    var gp = V.filter(function (v) { return v.klasse !== 'PLAATS'; });
    if (!V.length) return null;
    var uitgebreid = gp.length >= 3 || gp.filter(function (v) { return v.klasse === 'KAPITAAL' || v.specificatie; }).length >= 1 && gp.length >= 2;
    var code = uitgebreid ? '4.A' : '4.B', v0 = gp[0] || V[0];
    return { code: code, uitkomst: UITKOMST[code], zekerheid: uitgebreid ? 'middel' : 'laag', beschermd: false, vermeldingen: V, secties: sec,
      reden: 'De aanleg is alleen genoemd in de complexomschrijving, niet bij een van de complexonderdelen, en is daar ' +
        (uitgebreid ? 'vrij uitgebreid omschreven (' + gp.length + ' vermeldingen)' : 'niet uitgebreid omschreven (situeringswaarde)') + ': ' + citaat(v0) };
  }

  var api = { classify: classify, classifyComplex: classifyComplex, UITKOMST: UITKOMST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Stroomschema = api;
})(typeof self !== 'undefined' ? self : this);
