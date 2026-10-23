#!/usr/bin/env python3
"""Prepara le immagini per il sito pubblicato (nessuna libreria da installare: usa sips e cwebp di macOS/Homebrew).
  images/thumb/   miniature (600 px) per gamme e schede modello: restano nel progetto, servono anche in locale
  dist/images/    immagini a piena grandezza ricompresse (foto modelli e brochure), pubblicate da Netlify come file separati
Uso: python3 tools/optimize_images.py"""
import subprocess, shutil
from pathlib import Path
radice = Path(__file__).resolve().parent.parent
src, thumbs, out = radice / "images", radice / "images" / "thumb", radice / "dist" / "images"

def jpeg(a, b, max_px, q):
    b.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(q), "-Z", str(max_px), str(a), "--out", str(b)], check=True, capture_output=True)

def webp(a, b, w, q):
    b.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["cwebp", "-quiet", "-q", str(q), "-resize", str(w), "0", str(a), "-o", str(b)], check=True, capture_output=True)

if out.exists():
    shutil.rmtree(out)
n = tot_in = tot_out = tot_th = 0
for f in sorted([*src.glob("*"), *(src / "brochure").glob("*")]):
    if f.is_dir():
        continue
    rel = f.relative_to(src)
    o = out / rel
    if f.suffix.lower() == ".webp":
        webp(f, o, 1400, 78); webp(f, thumbs / f.name, 600, 66)
    elif f.suffix.lower() in (".jpg", ".jpeg"):
        jpeg(f, o, 1600, 72); jpeg(f, thumbs / f.name, 600, 55)
    else:
        o.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(f, o); continue
    n += 1; tot_in += f.stat().st_size; tot_out += o.stat().st_size; tot_th += (thumbs / f.name).stat().st_size
shutil.copytree(thumbs, out / "thumb")   # le miniature vanno pubblicate insieme
print(f"{n} immagini · originali {tot_in/1e6:.1f} MB → pubblicate {tot_out/1e6:.1f} MB · miniature {tot_th/1e6:.1f} MB")
