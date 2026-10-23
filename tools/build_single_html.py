#!/usr/bin/env python3
"""Impacchetta index.html + css/ + js/ in UN SOLO file HTML autonomo.
Uso: python3 tools/build_single_html.py  ->  dist/index.html (HTML unico leggero + immagini ottimizzate in dist/images, pubblicato da Netlify)
     python3 tools/build_single_html.py --no-images  ->  dist-lean/index.html (leggero, solo uso locale)
Restano esterni (CDN, serve internet): libreria SheetJS per leggere gli Excel."""
import argparse, base64, hashlib, json, re
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--no-images", action="store_true", help="versione leggera SENZA immagini incorporate (non pubblicata: scritta in dist-lean/)")
args = ap.parse_args()
radice = Path(__file__).resolve().parent.parent
html = (radice / "index.html").read_text(encoding="utf8")

def css(m):
    return "<style>\n" + (radice / m.group(1)).read_text(encoding="utf8").strip() + "\n</style>"

def js(m):
    corpo = (radice / m.group(1)).read_text(encoding="utf8").strip().replace("</script", "<\\/script")
    return "<script>\n" + corpo + "\n</script>"

html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', css, html)
html = re.sub(r'<script src="(js/[^"]+)"></script>', js, html)
# favicon: SVG incorporato
logo = (radice / "assets" / "azimut-favicon.svg").read_text(encoding="utf8").strip()
import urllib.parse
html = html.replace('<link rel="icon" href="assets/azimut-favicon.svg" type="image/svg+xml">',
                    '<link rel="icon" href="data:image/svg+xml,%s" type="image/svg+xml">' % urllib.parse.quote(logo))
if not args.no_images:
    # le immagini NON si incorporano più nell'HTML (pesava 21 MB): file separati in dist/images, caricati solo quando servono
    import subprocess, sys
    subprocess.run([sys.executable, str(radice / "tools" / "optimize_images.py")], check=True)
assert 'src="js/' not in html and 'href="css/' not in html and 'assets/' not in html
out = radice / ("dist-lean" if args.no_images else "dist") / "index.html"   # dist/ = cartella pubblicata da Netlify
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf8")
print(f"{out} · {out.stat().st_size/1024:.0f} KB")
