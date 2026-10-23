#!/usr/bin/env python3
"""Estrae gli optional dal listino 'OptionalPriceList Ferretti Yachts 720' (PDF) -> lista di dict.
Uso: python3 tools/parse_optional_720.py <file.pdf>   (stampa le voci; usato da build_prezzi_ferretti.py)"""
import re, subprocess, sys

GRUPPO = {1: "Coperta", 2: "Coperta", 3: "Elettronica", 4: "Elettronica", 5: "Elettronica",
          6: "Interni", 7: "Comfort", 8: "Comfort", 9: "Servizi", 10: "Servizi"}
SEZIONE_EN = {1: "Transom equipment, water toys and ancillaries", 2: "Exterior painting & accessories", 3: "Navigation, security & telecommunication",
              4: "Audio-video & entertainment", 5: "Electrical & technical equipment", 6: "Interior comfort & furniture", 7: "Appliances",
              8: "Stabilizer", 9: "Aftersales & spare parts", 10: "Documents & transports"}
PREZZO = re.compile(r"^(?P<d>.*?\S)\s{2,}(?P<p>\d{1,3}(?:\.\d{3})*|Q\.R\.)\s*$")


def testo(pdf):
    return subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout


def parse(pdf):
    righe = testo(pdf).replace("\f", "\n").split("\n")
    voci, sez, note, in_note, last_note = [], 0, {}, False, None
    for r in righe:
        s = r.strip()
        if not s or re.fullmatch(r"\d{1,2}", s) or s.startswith(("FERRETTIYACHTS", "ACCESSORIES PRICE LIST")):
            continue
        if sez and s.startswith("NOTES AND"):
            in_note = True
            continue
        if in_note:
            if s.startswith("TERMS & CONDITIONS"):
                break
            if s in ("TECHNICAL", "SPECIFICATIONS"):
                continue
            # titolo nota = riga che coincide con una voce; il resto e' testo della nota
            tit = next((v for v in voci if re.sub(r"\s*\(\*\)", "", v["en"]).strip().lower() == s.lower()), None)
            if tit:
                last_note = tit
                note[id(tit)] = []
            elif last_note is not None:
                note[id(last_note)].append(s)
            continue
        m = re.match(r"^(\d{1,2})\.\s+(.+?)\s{2,}PRICES IN", s)
        if m:
            sez = int(m.group(1)); continue
        m = PREZZO.match(s)
        if sez and m:
            p = m.group("p")
            voci.append({"sez": sez, "en": m.group("d").strip(), "price": 0 if p == "Q.R." else int(p.replace(".", "")), "qr": p == "Q.R."})
        elif sez and voci and not s.startswith(("OPTIONS", "If you", "looking", "the functional", "1.", "2.")):
            if voci[-1]["sez"] == sez and s[0].islower() or s.startswith("("):
                voci[-1]["en"] += " " + s
    for v in voci:
        v["note"] = " ".join(note.get(id(v), []))
        v["en"] = re.sub(r"\s+", " ", v["en"])
    return voci


if __name__ == "__main__":
    for i, v in enumerate(parse(sys.argv[1])):
        print(i, v["sez"], v["price"], "QR" if v["qr"] else "", "|", v["en"], "|", v["note"][:70])
