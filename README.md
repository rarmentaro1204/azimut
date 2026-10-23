# Configuratore offerte yacht — Azimut Yachts

Stesso lavoro della repo `ferretti` (configuratore HTML a 5 passi, catalogo Excel, PDF, registro offerte), per Azimut.

## Stato
- **Brand**: `brand/BRAND_GUIDELINES.md`, `css/brand.css`, `assets/azimut-logo-wordmark.png` — dal kit ufficiale Azimut Avigliana. **Non ancora confrontato col sito pubblico.**
- **Scraper**: `scraper/scrape_azimut.py` — stesso schema colonne di Ferretti (foglio `Macchine`, intestazione riga 4, + `Brochure_URL`). Provato **solo su una pagina di prova sintetica** (modalità `--html-dir`): selettori/etichette vanno tarati sul sito reale.
- **Catalogo (`excel/catalogo_azimut.xlsx`) e immagini: NON generati.** Il sito azimutyachts.com non era raggiungibile dall'ambiente di sviluppo (proxy di rete), quindi nessun dato è stato scaricato né inventato.
- **Brochure**: non scaricate (stesso motivo). Lo scraper le cerca come link PDF nelle pagine modello (`--brochures DIR`).

## Comandi
```
cd scraper
python3 scrape_azimut.py --dry-run                  # elenca gli URL modello trovati dalla sitemap
python3 scrape_azimut.py --lang it-it --brochures ../brochures
python3 scrape_azimut.py --html-dir DIR             # offline: pagine .html salvate a mano (nome file = codice)
```
## Prossimi passi
1. Consentire `www.azimutyachts.com` (e il dominio delle brochure) nella rete dell'ambiente, oppure lanciare lo scraper in locale.
2. Tarare lo scraper su una pagina modello reale, rigenerare l'Excel, rifinire il brand dal sito.
3. Portare qui il configuratore (js/, css/app.css, tools/, index.html) da `ferretti` e adattarlo seguendo `04_CHECKLIST_ADATTAMENTO_YACHT.md` di quella repo.
