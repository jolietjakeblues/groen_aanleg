"""Maakt van data/resultaat.json de Excel- en CSV-uitvoer in de map resultaat/."""
import csv
import json
import pathlib
from collections import Counter

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = pathlib.Path(__file__).resolve().parent.parent
rows = json.loads((ROOT / "data" / "resultaat.json").read_text(encoding="utf-8"))
OUT = ROOT / "resultaat"
OUT.mkdir(exist_ok=True)

KOL = [
    ("Monumentnummer", "nr", 12), ("Naam", "naam", 28), ("Gemeente", "gemeente", 18), ("Provincie", "provincie", 14),
    ("Complexnummer", "complexnr", 12), ("Functie (register)", "functie", 24), ("Type (register)", "type", 22),
    ("Code stroomschema", "code", 9), ("Voorstel bij twijfel", "voorstel", 9), ("Uitkomst stroomschema", "uitkomst", 30),
    ("Zekerheid", "zekerheid", 10), ("Reden", "reden", 90),
    ("Op lijst v1", "v1", 8), ("Type aanleg v1", "v1type", 20), ("Categorie v1", "v1categorie", 28),
    ("Contour v1", "v1contour", 16), ("Oppervlakte v1 (m2)", "v1opp", 12),
    ("Vergelijking met lijst v1", "vergelijking", 34), ("Oorzaak (alleen v1 niet bevestigd)", "oorzaak", 60), ("Monumentenregister", "link", 48),
]
ZEK = {"hoog": 0, "middel": 1, "laag": 2}
KLEUR = {"groen": "E2EFDA", "rood": "FCE4D6", "geel": "FFF2CC", "kop": "1F4E3D"}


def blad(wb, titel, data, eerste=False):
    ws = wb.active if eerste else wb.create_sheet()
    ws.title = titel
    ws.append([k[0] for k in KOL])
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=KLEUR["kop"])
        c.alignment = Alignment(vertical="top", wrap_text=True)
    for r in data:
        ws.append([r.get(k[1]) if r.get(k[1]) not in ("", None) else None for k in KOL])
        rij = ws.max_row
        kleur = KLEUR["groen"] if r["beschermd"] else KLEUR["geel"] if r["code"] in ("?", "4.A") else KLEUR["rood"]
        ws.cell(rij, 8).fill = PatternFill("solid", fgColor=kleur)
        ws.cell(rij, 10).fill = PatternFill("solid", fgColor=kleur)
        ws.cell(rij, 12).alignment = Alignment(wrap_text=True, vertical="top")
        link = ws.cell(rij, len(KOL))
        link.hyperlink = r["link"]
        link.font = Font(color="0563C1", underline="single")
    for i, k in enumerate(KOL, 1):
        ws.column_dimensions[get_column_letter(i)].width = k[2]
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = ws.dimensions
    return ws


GROEN_F = ("tuin", "park", "plantsoen", "erfinrichting", "erfbeplanting", "historische aanleg", "boomgroep", "bosschage",
           "kerkhof", "begraafplaats", "boomgaard", "vijver", "bosquet", "hortus")


def oorzaak(r):
    """Waarom een monument van lijst v1 volgens het schema niet op 'beschermd' uitkomt."""
    c, v, red = r["code"], r["voorstel"], r["reden"]
    if c == "-":
        if r["v1type"] == "hofje":
            return "A1. Hofje: wordt in de tekst niet als tuin of aanleg benoemd"
        if "losse elementen" in red:
            return "A2. Alleen losse groene elementen genoemd (laan, vijver, beplanting, bomen), geen aanleg"
        if any(g in r["functie"].lower() for g in GROEN_F):
            return "A3. Groen staat wel in de registerfunctie, maar niet in de omschrijving"
        return "A4. Geen groen in omschrijving of functie (mogelijk bedoeld: aanleg van het complex of het hele terrein)"
    if c in ("2.C", "3.G"):
        return "B1. Aanleg alleen als plaatsbepaling genoemd ('in de tuin', 'gelegen in', afsluiting door hek)"
    if c == "?" and "groene elementen" in red:
        return "B2. Plaatsbepaling, maar met groene elementen erin (bomen): twijfel"
    if c == "?" and v in ("2.B", "2.C"):
        return "C1. Platte tekst: aanleg in lopende zin, niet in kapitalen of opsomming: twijfel"
    if c == "3.A":
        return "D1. Alleen in de inleiding, in onderkast (3.A)"
    if c == "3.F":
        return "D2. Alleen in de waardering (3.F)"
    if c == "?" and v == "3.A":
        return "D3. Inleiding en waardering in onderkast: combinatie ontbreekt in het stroomschema"
    if c in ("4.A", "4.B"):
        return "E1. Alleen in de complexomschrijving genoemd (stap 4)"
    return "F1. Overig (tekst zondert de aanleg mogelijk uit, of geen omschrijving)"


for r in rows:
    r["oorzaak"] = oorzaak(r) if r["v1"] == "ja" and not r["beschermd"] else ""

sleutel = lambda r: (ZEK.get(r["zekerheid"], 3), r["provincie"], r["gemeente"], r["nr"])
groen = sorted([r for r in rows if r["beschermd"]], key=lambda r: (r["v1"] != "ja",) + sleutel(r))
afval = sorted([r for r in rows if r["v1"] == "ja" and not r["beschermd"]], key=lambda r: (r["oorzaak"], r["v1type"], r["nr"]))
twijfel = sorted([r for r in rows if r["v1"] == "nee" and r["code"] == "?"], key=sleutel)
onderzoek = sorted([r for r in rows if r["v1"] == "nee" and r["code"] == "4.A"], key=lambda r: (r["complexnr"] or 0, r["nr"]))

wb = Workbook()
ws = wb.active
ws.title = "Leeswijzer"
tel_code = Counter(r["code"] for r in rows)
tel_v1 = Counter(r["code"] for r in rows if r["v1"] == "ja")
regels = [
    ["Groenaanleg in het monumentenregister: uitkomst van het stroomschema"],
    ["Bron teksten: Linked Data Voorziening RCE (formele registeromschrijvingen van alle rijksmonumenten). "
     "Regels: Stroomschema Inventarisatie beschermde groenaanleg, 16 november 2015. Vergeleken met de lijst groenaanleg v1 (dataset rce/groenaanleg, 2024)."],
    ["Let op: het schema is automatisch toegepast op de tekst. De uitkomst is een voorstel met reden, geen besluit. Sorteer op Zekerheid; 'laag' altijd nalezen."],
    [],
    ["Tabblad", "Inhoud", "Aantal"],
    ["Groene monumenten", "Beschermde groenaanleg volgens het stroomschema (codes 1.A, 2.A, 2.B, 3.B-3.E). Eerst wat ook op lijst v1 staat, daarna nieuw.", len(groen)],
    ["Afvallers en twijfel v1", "Staat op lijst v1, maar het schema komt niet op 'beschermd' uit.", len(afval)],
    ["Twijfel niet op v1", "Niet op lijst v1; het schema kan niet beslissen (met voorstel).", len(twijfel)],
    ["Nader onderzoek 4.A", "Aanleg alleen in de complexomschrijving, vrij uitgebreid omschreven.", len(onderzoek)],
    [],
    ["Code", "Uitkomst", "Alle rijksmonumenten", "Waarvan op lijst v1"],
]
uitk = {r["code"]: r["uitkomst"] for r in rows}
for code in sorted(tel_code, key=lambda c: (c in "-?", c)):
    regels.append([code, uitk[code], tel_code[code], tel_v1.get(code, 0)])
regels += [["Totaal", "", len(rows), sum(tel_v1.values())], [],
           ["Zekerheid", "hoog = aanleg in kapitalen of als hoofdonderwerp; middel = meerdere of gespecificeerde vermeldingen; laag = een enkele vermelding in lopende tekst."],
           ["Code ?", "Het schema geeft geen eenduidig antwoord; kolom 'Voorstel bij twijfel' geeft de meest waarschijnlijke code."],
           ["Code -", "Geen groenaanleg genoemd in de omschrijving (of archeologisch monument)."]]
regels += [[], ["Oorzaak", "Lijst v1 niet bevestigd door het schema: uitsplitsing", "Aantal", "Meest voorkomende typen aanleg v1"]]
rij_oorzaak = len(regels)
for o, n in sorted(Counter(r["oorzaak"] for r in afval).items()):
    typen = Counter(r["v1type"] for r in afval if r["oorzaak"] == o).most_common(4)
    regels.append([o[:2], o[4:], n, ", ".join(f"{t} ({k})" for t, k in typen)])
for r in regels:
    ws.append(r)
for c in ws[rij_oorzaak]:
    c.font = Font(bold=True)
ws.column_dimensions["D"].width = 70
ws["A1"].font = Font(bold=True, size=14)
for rij in (5, 11):
    for c in ws[rij]:
        c.font = Font(bold=True)
ws.column_dimensions["A"].width = 26
ws.column_dimensions["B"].width = 110
ws.column_dimensions["C"].width = 20

blad(wb, "Groene monumenten", groen)
blad(wb, "Afvallers en twijfel v1", afval)
blad(wb, "Twijfel niet op v1", twijfel)
blad(wb, "Nader onderzoek 4.A", onderzoek)
doel = OUT / "groene_monumenten_stroomschema.xlsx"
wb.save(doel)


def schrijf_csv(naam, data):
    with open(OUT / naam, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow([k[0] for k in KOL])
        for r in data:
            w.writerow(["" if r.get(k[1]) is None else r.get(k[1]) for k in KOL])


schrijf_csv("groene_monumenten.csv", groen)
schrijf_csv("alle_rijksmonumenten_stroomschema.csv", rows)
for o, n in sorted(Counter(r["oorzaak"] for r in afval).items()):
    print(f"{n:4d}  {o}  |  " + ", ".join(f"{t} {k}" for t, k in Counter(r["v1type"] for r in afval if r["oorzaak"] == o).most_common(4)))
print(doel, "| groen:", len(groen), "afvallers/twijfel v1:", len(afval), "twijfel:", len(twijfel), "4.A:", len(onderzoek))
