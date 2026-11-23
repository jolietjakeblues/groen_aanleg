"""Zet de map site/ klaar voor Cloudflare Pages (of elke andere statische hosting).

site/ bevat alleen statische bestanden: het stroomschema (index.html + classify.js), de lijst (lijst.html + lijst.json)
en de downloads. Uploaden: zie README.md.
"""
import datetime
import json
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
SITE = ROOT / "site"
SITE.mkdir(exist_ok=True)

rows = json.loads((ROOT / "data" / "resultaat.json").read_text(encoding="utf-8"))
from importlib import import_module  # noqa: E402

oorzaak = import_module("3_excel").oorzaak  # draait ook meteen de Excel/CSV-export opnieuw

VELDEN = ["nr", "naam", "gemeente", "provincie", "complexnr", "functie", "code", "voorstel", "uitkomst", "beschermd",
          "zekerheid", "reden", "v1", "v1type", "v1categorie", "vergelijking"]
ZEK = {"hoog": 0, "middel": 1, "laag": 2}
keuze = [r for r in rows if r["beschermd"] or r["v1"] == "ja" or r["code"] in ("?", "4.A")]
keuze.sort(key=lambda r: (ZEK.get(r["zekerheid"], 3), r["provincie"], r["gemeente"], r["nr"]))
uit = []
for r in keuze:
    d = {k: r[k] for k in VELDEN}
    d["oorzaak"] = oorzaak(r) if r["v1"] == "ja" and not r["beschermd"] else ""
    uit.append(d)
peil = datetime.date.fromtimestamp((ROOT / "data" / "raw" / "omschrijving.json").stat().st_mtime).isoformat()
(SITE / "lijst.json").write_text(json.dumps({"peildatum": peil, "totaal": len(rows), "rijen": uit}, ensure_ascii=False), encoding="utf-8")

for naam in ("index.html", "lijst.html", "classify.js"):
    shutil.copy2(ROOT / naam, SITE / naam)
for naam in ("groene_monumenten_stroomschema.xlsx", "alle_rijksmonumenten_stroomschema.csv"):
    shutil.copy2(ROOT / "resultaat" / naam, SITE / naam)
# Niet laten indexeren door zoekmachines: het is een intern werkinstrument.
(SITE / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
(SITE / "_headers").write_text("/*\n  X-Robots-Tag: noindex\n  X-Content-Type-Options: nosniff\n", encoding="utf-8")
print("site/ klaar:", ", ".join(sorted(p.name for p in SITE.iterdir())), "| rijen in lijst:", len(uit))
