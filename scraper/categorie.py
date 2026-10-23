"""Classificazione dei prodotti Depureco per TIPO DI MACCHINA (una sola categoria per modello) + Protezione.

Perche': le "tipologie" del sito si sovrappongono (es. "Atex ed ACD" mescola aspiratori, depolveratori e impianti;
"Accessori" contiene i pre-separatori; 5 prodotti non hanno categoria). Qui ogni famiglia va in UNA categoria in base
alla serie; l'essere ATEX/ACD e' un attributo a parte (colonna Protezione), perche' quasi ogni serie ha la versione ATEX.

Le regole sono in ordine: vince la prima che combacia con il nome della famiglia. Una famiglia senza regola viene
segnalata come "DA VERIFICARE" (cosi' i prodotti nuovi non finiscono in sezioni sbagliate in silenzio).
"""
import re

PRESEP = "Pre-separatori e separatori filtranti"
CENTR = "Impianti di aspirazione centralizzati"
DEPOLV = "Depolveratori industriali"
ALTAPOT = "Aspiratori trifase ad alta potenza"
OLIO = "Aspiratori per olio e truciolo"
SALD = "Aspiratori per fumi di saldatura"
SFRIDI = "Aspiratori per sfridi, confezionamento e OEM"
ARIA = "Aspiratori ad aria compressa"
TOSSICHE = "Aspiratori per polveri tossiche e pericolose"
TRIFASE = "Aspiratori industriali trifase"
MONO = "Aspiratori industriali monofase e Wet&Dry"
DAVERIFICARE = "DA VERIFICARE"

# ordine di visualizzazione nel configuratore
ORDINE = [MONO, TRIFASE, ALTAPOT, TOSSICHE, OLIO, ARIA, SALD, SFRIDI, DEPOLV, CENTR, PRESEP, DAVERIFICARE]

# (regex sul nome famiglia in maiuscolo, categoria) — la prima che combacia vince
REGOLE = [
    (r"^PRE-SEPARATORE|^SFC\b|^SFT\b|^TRAMOGGIA|^DV AIR", PRESEP),
    (r"^CVS|^HF\b|^PUMA FIX|^DF FIX", CENTR),                  # strutture fisse per impianti centralizzati
    (r"^DF\b|^AF\b", DEPOLV),
    (r"^ATLAS|^PUMA HD", ALTAPOT),                              # 18,5-37 kW
    (r"^RAM OIL|^CLEAN (OIL|AIR)|\bOIL\b", OLIO),
    (r"^AIR WELD|^XM TORCH", SALD),
    (r"^AS\b|^BF\b|^UPF|^SWAN", SFRIDI),
    (r"^AC\b|^MINIAIR|^WD AIR", ARIA),
    (r"^COMBO|\bLP\b|^XFLOOR", TOSSICHE),                       # classe H / polveri fini pericolose
    (r"^ECOBULL|^FOX|^PUMA|^TX\b|^TB\b", TRIFASE),
    (r"^BL\b|^BULL|^M PRO|^M65|^MINIBULL|^WD\b|^XM|^X-PRO|^M100", MONO),
]

_TOKEN = re.compile(r"(?<![A-Z0-9])(DEX|ACD|INERT|SP|1/2D|1/3D|3/3G|3G-3D|3D|3G|Z\d+(?:[-/]\d+)?|H)(?![A-Z0-9/])", re.I)


def serie(famiglia):
    """Nome della serie senza suffissi di protezione/pulizia: 'PUMA SP DEX 1/3D' -> 'PUMA'."""
    if re.match(r"(?i)pre-separatore|tramoggia", famiglia):
        return famiglia.strip()                          # i pre-separatori si distinguono per nome (anche "Inert")
    s = _TOKEN.sub(" ", famiglia)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"(\s*[–-]\s*)+$", "", s)               # trattini rimasti in coda
    return s or famiglia


def protezione(famiglia, nome, atex):
    t = f"{famiglia} {nome}".upper()
    inert = " INERT" if "INERT" in t else ""
    if re.search(r"\bACD\b|HACD", t):
        return "ACD" + inert
    if atex or re.search(r"\bDEX\b|\b3D\b|\b3G\b|3/3G|1/[23]D", t):
        return "ATEX" + inert
    return "Standard"


def classifica(famiglia, nome, atex, categoria_sito=""):
    """Ritorna (categoria, sottocategoria, protezione)."""
    f = famiglia.upper().strip()
    cat = next((c for rx, c in REGOLE if re.search(rx, f)), None)
    return (cat or DAVERIFICARE), serie(famiglia), protezione(famiglia, nome, atex)


def ordine(cat):
    return ORDINE.index(cat) if cat in ORDINE else len(ORDINE)
