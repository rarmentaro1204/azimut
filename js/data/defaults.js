/* Dati di avvio. Le macchine arrivano da js/data/catalogo.js (generato da tools/build_catalog_js.py). */
const EMBEDDED = {
  machines: (typeof CATALOGO_YACHT!=='undefined') ? CATALOGO_YACHT : [],
  accessories: [],
  // operatori che possono fare un'offerta (solo nome; email/telefono si possono aggiungere dal foglio Commerciali dell'Excel)
  reps: [
    {"name": "[Commerciale 1]", "email": "commerciale1@esempio.it", "phone": "", "role": ""},
    {"name": "[Commerciale 2]", "email": "commerciale2@esempio.it", "phone": "", "role": ""}
  ]
};
const IMAGES_BASE = 'images/';   // cartella immagini del catalogo (<Codice>.webp)
const IMAGES_EMBED = {};         // hash -> data URI   (riempito solo dal build "con immagini")
const IMAGES_ALIAS = {};         // nome file -> hash
const MACHINE_OPTIONALS = (typeof OPTIONALS_YACHT!=='undefined') ? JSON.parse(JSON.stringify(OPTIONALS_YACHT)) : {};  // codice imbarcazione -> [{code,desc,price,group,order}] optional precaricati a prezzo 0
const MACHINE_SPARES    = {};  // codice macchina -> [{code,desc,l0,le}] ricambi
const EMBEDDED_CLIENTS = [];
