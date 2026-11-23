# Groenaanleg in het monumentenregister

Het stroomschema *Inventarisatie beschermde groenaanleg: uniform inventariseren* (RCE, 16 november 2015), werkend gemaakt. Het schema wordt automatisch toegepast op de registeromschrijving van elk rijksmonument en de uitkomst wordt vergeleken met de lijst groenaanleg v1.

**De uitkomst is een voorstel met reden, geen besluit.** Het schema leest alleen de tekst van de omschrijving. Zekerheid "laag" en code "?" moeten altijd door een specialist worden nagelezen.

## Wat zit erin

| Onderdeel | Bestand | Wat het doet |
|---|---|---|
| Stroomschema per monument | `index.html` | Monumentnummer invullen, de omschrijving wordt live opgehaald en het pad door het schema licht op. Zelf een pad aanklikken of eigen tekst plakken kan ook. Met kaartje: contour van het rijksmonument en van de aanleg uit lijst v1, op kaart of luchtfoto (PDOK). |
| Lijst | `lijst.html` | Alle groene monumenten, afvallers en twijfelaars, met filters, reden, CSV-export van de selectie en een kaart van de selectie. |
| Over | `over.html` | Uitleg voor gebruikers: wat het instrument doet, hoe het werkt en waar de grenzen liggen. |
| De regels | `classify.js` | Het stroomschema als code. Wordt door de pagina én door de bulkverwerking gebruikt, zodat beide hetzelfde antwoord geven. |
| Excel en CSV | `resultaat/` | Dezelfde lijst als Excel (met leeswijzer en uitsplitsing) en als CSV. |
| Website | `site/` | Kant-en-klare map voor Cloudflare Pages. Wordt gemaakt door stap 4 hieronder. |
| Bron van het schema | `Stroomschema-Registerinventarisatie-groen.pdf` | Het originele stroomschema. |

## Codes

| Code | Uitkomst |
|---|---|
| 1.A, 2.A, 2.B, 3.B, 3.C, 3.D, 3.E | Beschermde groenaanleg |
| 2.C, 3.A, 3.F, 3.G, 4.B | Geen beschermde groenaanleg |
| 4.A | Geen beschermde groenaanleg, vraagt nader onderzoek |
| ? | Het schema kan niet beslissen; kolom "voorstel" geeft de meest waarschijnlijke code |
| - | Geen groenaanleg genoemd in de omschrijving |

Zekerheid: **hoog** = aanleg in kapitalen of als hoofdonderwerp, **middel** = meerdere of gespecificeerde vermeldingen, **laag** = één vermelding in lopende tekst.

## Zelf opnieuw draaien

Nodig: Python 3 met `openpyxl`, en Node.js. Vanuit deze map:

```powershell
python scripts/1_download.py
```

```powershell
node scripts/2_classificeer.js
```

```powershell
python scripts/4_site.py
```

1. `1_download.py` haalt alle formele omschrijvingen, functies, typen, complexen en de lijst groenaanleg op uit de Linked Data Voorziening en zet ze in `data/raw/`. Bestaande bestanden worden overgeslagen: gooi `data/raw/` weg om te verversen. Duurt enkele minuten.
2. `2_classificeer.js` legt alle rijksmonumenten langs het schema en schrijft `data/resultaat.json`.
3. `4_site.py` maakt de Excel en CSV's in `resultaat/` en zet de map `site/` klaar. (`3_excel.py` maakt alleen de Excel en CSV's.)

Eén monument of een steekproef in de terminal bekijken:

```powershell
node scripts/toon.js 518800
```

```powershell
node scripts/toon.js --steekproef "v1=ja,code=3.G" 10 300
```

## De regels aanpassen

Alles staat in `classify.js`:

- **Woordenlijsten** bovenin: welke woorden een groenaanleg aanduiden (`EXACT`, `SUFFIX`), welke alleen losse elementen zijn (`ZWAK`: laan, vijver, haag, bomen), welke voorzetsels op plaatsbepaling wijzen (`PLAATS`).
- **Het schema zelf** in de functie `classify`: stap 1 (hoofdonderwerp), stap 2 (platte tekst), stap 3 (inleiding/omschrijving/waardering) en `classifyComplex` voor stap 4.

Na een wijziging stap 2 en 3 hierboven opnieuw draaien. De pagina gebruikt de nieuwe regels direct.

## Online zetten op Cloudflare Pages

De map `site/` bevat alleen statische bestanden; er is geen server of database nodig.

**Via het dashboard (geen installatie):** Cloudflare dashboard → Workers & Pages → Create → Pages → *Upload assets* → projectnaam kiezen → de inhoud van `site/` slepen → Deploy. Voor een update: zelfde project → *Create deployment* → opnieuw uploaden.

**Via de terminal:**

```powershell
npx wrangler pages deploy site --project-name groenaanleg
```

De eerste keer vraagt wrangler om in te loggen en het project aan te maken.

### Afschermen met Cloudflare Access

Zonder Access is de site bereikbaar voor iedereen met de link. `robots.txt` en `_headers` houden zoekmachines buiten, maar dat is geen beveiliging.

1. Cloudflare dashboard → Workers & Pages → project `groenaanleg` → Settings → General → **Access policy** → Enable. Dit maakt een Access-applicatie aan voor `*.groenaanleg.pages.dev`. Die beschermt alleen de adressen per upload (zoals `adcfee96.groenaanleg.pages.dev`), **niet** het vaste adres.
2. Klik op **Manage** (opent Zero Trust → Access → Applications) en open de zojuist gemaakte applicatie.
3. Voeg bij de hostnamen een tweede regel toe met domein `groenaanleg.pages.dev` en een leeg subdomein. Nu vallen het vaste adres en de adressen per upload er allebei onder.
4. Bij **Policies**: een regel met actie *Allow* en als voorwaarde *Emails ending in* `@cultureelerfgoed.nl`, plus eventueel losse adressen onder *Emails*.
5. Controleer in een privévenster: https://groenaanleg.pages.dev moet om een e-mailadres vragen en een eenmalige code sturen.

Inloggen gaat standaard met een code per e-mail; er is geen account nodig. Zero Trust is gratis tot 50 gebruikers, maar vraagt de eerste keer om een teamnaam en een betaalmethode.

Kijk na het instellen even of de adressen per upload ook om een code vragen; elke upload krijgt een eigen adres en die blijven bestaan.

## Bekende beperkingen

- **Hofjes** worden niet als groenaanleg herkend als de tekst geen tuin of aanleg noemt.
- **Gat in het schema:** aanleg in onderkast in inleiding én waardering, maar niet in de omschrijving, staat niet in het stroomschema. Uitkomst "?" met voorstel 3.A.
- **Stap 4** kijkt of de aanleg alleen in de complexomschrijving staat en bij geen enkel onderdeel.
- **Archeologische monumenten** vallen buiten het schema.
- **Werkafspraak Funerair** is niet apart ingebouwd. Een begraafplaats of kerkhof als hoofdonderwerp komt via stap 1 op 1.A uit.
- De **lijst v1** is de eerste versie uit de dataset `rce/groenaanleg` (2024).

## Bronnen

- Rijksmonumenten: https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql (alleen kennis met formeel standpunt)
- Lijst groenaanleg v1: https://linkeddata.cultureelerfgoed.nl/rce/groenaanleg
