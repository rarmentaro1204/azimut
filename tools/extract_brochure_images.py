#!/usr/bin/env python3
"""Estrae 4 foto per modello dalle brochure PDF (brochures/) -> images/brochure/<Codice>-N.jpg (max 1600 px, JPEG).
Le brochure sono scaricate da https://starshipyachts.com/pdf/ferretti/ (dealer Ferretti). Usa pdfimages (poppler) e sips (macOS)."""
import re, shutil, subprocess, sys, tempfile
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
MAPPA = {  # file brochure -> codice catalogo
    "BROCHURE-FY-APAC-500": "1-285-426", "BROCHURE-FERRETTIYACHTS-580-2": "1-310-531", "BROCHURE-FERRETTIYACHTS-FY670": "1-338-577",
    "Ferretti_Yachts_720_New_BROCHURE_2020": "1-389-642", "BROCHURE-FERRETTIYACHTS-FY800": "1-384-633", "BROCHURE-FERRETTIYACHTS-860-2": "1-302-457",
    "BROCHURE-FY-APAC-1000-2": "1-286-430", "BROCHURE-FERRETTIYACHTS-FY1000SKYDECK": "1-328-546",
    "BROCHURE-FERRETTIYACHTS-INFYNITO80": "1-337-576", "BROCHURE-FERRETTIYACHTS-INFYNITO90": "1-325-539"}
N = 4


def run(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout


def rendi_pagine(pdf, codice, dest, soglia=900_000, px=1600):
    """Brochure con immagini JPEG2000 a fette: si renderizzano le pagine 'solo foto' (poche parole), 1 per quarto di documento."""
    info = run("pdfinfo", str(pdf))
    pagine = int(re.search(r"Pages:\s+(\d+)", info).group(1))
    larg = float(re.search(r"Page size:\s+([\d.]+)", info).group(1))
    cand = []
    for pg in range(2, pagine + 1):   # la 1 e' spesso la copertina con testo
        parole = len(run("pdftotext", "-f", str(pg), "-l", str(pg), str(pdf), "-").split())
        elenco = [r.split() for r in run("pdfimages", "-f", str(pg), "-l", str(pg), "-list", str(pdf)).splitlines()[2:]]
        area = sum(int(r[3]) * int(r[4]) for r in elenco if len(r) > 4 and r[2] == "image")
        if area > soglia and parole < 30:
            cand.append((pg, parole, area))
    if len(cand) < 2:
        if soglia > 250_000:   # brochure a bassa risoluzione (es. 860): si rende a risoluzione ridotta
            return rendi_pagine(pdf, codice, dest, 250_000, 1100)
        print("POCHE PAGINE FOTO", pdf.name, len(cand)); return
    tot = pagine
    scelte, usate = [], set()
    for k in range(4):
        lo, hi = tot * k / 4, tot * (k + 1) / 4
        blocco = [c for c in cand if lo <= c[0] <= hi and c[0] not in usate] or [c for c in cand if c[0] not in usate]
        if blocco:
            c = max(blocco, key=lambda c: c[2]); scelte.append(c); usate.add(c[0])
    dpi = int(px / larg * 72)
    for n, c in enumerate(scelte, 1):
        base = dest / f"{codice}-{n}"
        subprocess.run(["pdftoppm", "-jpeg", "-jpegopt", "quality=75", "-r", str(dpi), "-f", str(c[0]), "-l", str(c[0]), "-singlefile", str(pdf), str(base)], capture_output=True)
    print(codice, pdf.name, "-> pagine", [c[0] for c in scelte], "(render)")


def main():
    dest = RADICE / "images" / "brochure"
    dest.mkdir(parents=True, exist_ok=True)
    for nome, codice in MAPPA.items():
        pdf = RADICE / "brochures" / f"{nome}.pdf"
        with tempfile.TemporaryDirectory() as tmp:
            lista = run("pdfimages", "-list", str(pdf)).splitlines()[2:]
            cand = []   # (indice immagine, pagina, larghezza, altezza, byte)
            for riga in lista:
                p = riga.split()
                if len(p) < 15 or p[2] != "image" or p[8] != "jpeg":
                    continue
                w, h, size = int(p[3]), int(p[4]), p[14]
                kb = float(re.sub(r"[^\d.]", "", size)) * (1024 if size.endswith("M") else 1)
                if w >= 1600 and h >= 800 and kb >= 150:
                    cand.append((int(p[1]), int(p[0]), w, h, kb))
            if len(cand) < 2:
                rendi_pagine(pdf, codice, dest); continue
            tot = max(c[1] for c in cand)
            scelte, usate = [cand[0]], {cand[0][1]}
            for k in range(1, N):   # una foto per "quarto" di brochure, la piu' pesante (piu' dettagliata)
                lo, hi = tot * k / N, tot * (k + 1) / N
                blocco = [c for c in cand if lo <= c[1] <= hi and c[1] not in usate] or [c for c in cand if c[1] not in usate]
                if blocco:
                    c = max(blocco, key=lambda c: c[4]); scelte.append(c); usate.add(c[1])
            subprocess.run(["pdfimages", "-j", str(pdf), f"{tmp}/i"], capture_output=True)
            for n, c in enumerate(scelte, 1):
                src = Path(f"{tmp}/i-{c[0]:03d}.jpg")
                if not src.exists():
                    print("manca", src); continue
                out = dest / f"{codice}-{n}.jpg"
                shutil.copy(src, out)
                subprocess.run(["sips", "-Z", "1600", "--setProperty", "formatOptions", "72", str(out)], capture_output=True)
            print(codice, nome, "->", len(scelte), "foto", [c[1] for c in scelte])


if __name__ == "__main__":
    main()
