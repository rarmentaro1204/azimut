# Configuratore offerte yacht — stile Azimut

Configuratore HTML (nessun backend) a 5 passi: Cliente → Programma di navigazione → Prodotto → Opzioni → Offerta (PDF A4), con registro, richiamo, dashboard e salvataggio su GitHub privata.
È il configuratore della repo `ferretti` con **grafica Azimut Yachts** (kit brand ufficiale Azimut Avigliana): Helvetica Neue Light, antracite `#1D1D1B`, un solo accento rosso `#C21632`, logo wordmark ufficiale.

## Cosa è Azimut e cosa è Ferretti
- **Stile Azimut**: `css/brand.css`, `css/luxury.css`, `js/config/brand.js` (logo, prefisso offerta `AZ-`), `brand/BRAND_GUIDELINES.md`.
- **Barche = catalogo Ferretti** (11 modelli, `excel/catalogo_ferretti.xlsx`, `js/data/catalogo.js`). Foto, testi e brochure dei modelli sono di Ferretti Yachts e riportano il loro marchio: è un prototipo di grafica, non un catalogo Azimut. Per un catalogo Azimut vedi `scraper/scrape_azimut.py` (non eseguito: serve prima l'ok di Azimut sull'uso dei contenuti).
- **Segnaposto da completare**: anagrafica emittente (`js/config/brand.js`), commerciali (`js/data/defaults.js`), condizioni generali (`js/data/general-terms.js`).
- **Prezzi**: nessuno nel repo. Si caricano a runtime da Excel ("Carica listino", "Carica matrice optional"); i file riservati vanno in `data-private/` (in `.gitignore`).

## Comandi
```
python3 -m http.server 8781                  # sviluppo: http://localhost:8781/index.html
python3 tools/build_single_html.py           # -> dist/index.html (pubblicato da Netlify)
```
## Note
- Repo e sito devono restare **privati**: contengono foto/brochure di terzi. Il token GitHub resta solo nel browser; l'app rifiuta repo dati pubbliche.
- Font: Helvetica Neue è di sistema su Mac/iOS; altrove Arial.
