"""Download alle gegevens die het stroomschema nodig heeft uit de Linked Data Voorziening van de RCE.

Resultaat: data/raw/*.json (een bestand per deelvraag). Opnieuw draaien = verversen.
"""
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

CHO = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql"
GROEN = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/groenaanleg/sparql"
RAW = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

PFX = """PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX dct: <http://purl.org/dc/terms/>
"""
RM_STATUS = "<https://data.cultureelerfgoed.nl/term/id/rn/2/b2d9a59a-fe1e-4552-9a05-3c2acddff864>"


def run(endpoint, query):
    data = urllib.parse.urlencode({"query": PFX + query}).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request(
                endpoint, data=data,
                headers={"Accept": "application/sparql-results+json", "User-Agent": "groenaanleg-stroomschema"})
            with urllib.request.urlopen(req, timeout=180) as r:
                res = json.load(r)
            return [{k: v["value"] for k, v in b.items()} for b in res["results"]["bindings"]]
        except Exception as e:  # noqa: BLE001
            print("  opnieuw proberen:", e, file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    raise SystemExit("query mislukt")


def paged(name, endpoint, query, page=10000, force=False):
    out = RAW / f"{name}.json"
    if out.exists() and not force:
        print(name, "bestaat al")
        return
    rows, offset = [], 0
    while True:
        part = run(endpoint, f"{query} LIMIT {page} OFFSET {offset}")
        rows += part
        print(f"{name}: {len(rows)}", flush=True)
        if len(part) < page:
            break
        offset += page
    out.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")


G = "GRAPH <https://linkeddata.cultureelerfgoed.nl/graph/instanties-rce>"
# Let op: het endpoint geeft een time-out op DISTINCT / ORDER BY / OPTIONAL over de hele set.
# Daarom alleen simpele patronen binnen een graph; ontdubbelen en koppelen gebeurt in 2_classificeer.py.

paged("monument", CHO, f"SELECT ?s ?nr WHERE {{ {G} {{ ?s ceo:rijksmonumentnummer ?nr ; ceo:heeftJuridischeStatus {RM_STATUS} }} }}")
paged("aard", CHO, f"SELECT ?s ?o WHERE {{ {G} {{ ?s ceo:rijksmonumentnummer ?nr ; ceo:heeftMonumentAard ?o }} }}")
paged("incomplex", CHO, f"SELECT ?s ?complex WHERE {{ {G} {{ ?s ceo:rijksmonumentnummer ?nr ; ceo:isOnderdeelVanComplex ?complex }} }}")
paged("omschrijving", CHO, f"SELECT ?s ?k ?tekst ?datum WHERE {{ {G} {{ ?k ceo:omschrijving ?tekst ; ceo:formeelStandpunt true ; ceo:heeftBetrekkingOp ?s ; ceo:registratiedatum ?datum }} }}", page=2000)
paged("naam", CHO, f"SELECT ?s ?naam WHERE {{ {G} {{ ?k ceo:naam ?naam ; ceo:formeelStandpunt true ; ceo:heeftBetrekkingOp ?s }} }}")
paged("functie", CHO, f"SELECT ?s ?o WHERE {{ {G} {{ ?k ceo:heeftFunctieNaam ?o ; ceo:formeelStandpunt true ; ceo:heeftBetrekkingOp ?s }} }}")
paged("type", CHO, f"SELECT ?s ?o WHERE {{ {G} {{ ?k ceo:heeftTypeNaam ?o ; ceo:formeelStandpunt true ; ceo:heeftBetrekkingOp ?s }} }}")
paged("locatie", CHO, f"SELECT ?s ?gemeente ?provincie WHERE {{ {G} {{ ?s ceo:heeftBasisregistratieRelatie ?b . ?b ceo:heeftGemeente ?gemeente ; ceo:heeftProvincie ?provincie }} }}")
paged("complex", CHO, f"SELECT ?c ?cnr WHERE {{ {G} {{ ?c a ceo:Complex ; ceo:complexnummer ?cnr }} }}")
paged("complexhoofd", CHO, f"SELECT ?c ?hoofd WHERE {{ {G} {{ ?c ceo:heeftHoofdobject ?hoofd }} }}")

# labels van de gebruikte thesaurustermen
lab = RAW / "labels.json"
if not lab.exists():
    uris = set()
    for n in ("aard", "functie", "type"):
        uris |= {r["o"] for r in json.loads((RAW / f"{n}.json").read_text(encoding="utf-8"))}
    uris = sorted(uris)
    labels = {}
    for i in range(0, len(uris), 150):
        vals = " ".join(f"<{u}>" for u in uris[i:i + 150])
        for r in run(CHO, f"SELECT ?o ?l WHERE {{ VALUES ?o {{ {vals} }} ?o skos:prefLabel ?l FILTER(lang(?l) IN ('nl','')) }}"):
            labels.setdefault(r["o"], r["l"])
        print("labels:", len(labels), flush=True)
    lab.write_text(json.dumps(labels, ensure_ascii=False), encoding="utf-8")

# Eerste versie van de lijst groenaanleg (dataset rce/groenaanleg, peildatum 2024-02)
paged("groenaanleg", GROEN, """SELECT ?s ?objectid ?naam ?type ?categorie WHERE {
  ?s ceo:heeftTypeAanleg ?t ; dct:identifier ?objectid ; ceo:naam ?naam ; ceo:heeftCategorieGroenaanleg ?cat .
  ?t skos:prefLabel ?type . ?cat skos:prefLabel ?categorie }""")
paged("groenaanleg_complex", GROEN, "SELECT ?s ?complexnr WHERE { ?s ceo:isOnderdeelVanComplex/ceo:complexnummer ?complexnr }")
paged("groenaanleg_contour", GROEN, "SELECT ?s ?contour ?bron ?opp WHERE { ?s ceo:heeftAanlegGeometrie ?g . ?g ceo:heeftContour/skos:prefLabel ?contour ; ceo:heeftContourBron/skos:prefLabel ?bron ; ceo:oppervlakteInVierkanteMeters ?opp }")
