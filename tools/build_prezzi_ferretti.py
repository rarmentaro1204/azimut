#!/usr/bin/env python3
"""Genera i file PREZZI (riservati) da caricare nel configuratore, a partire dai listini ufficiali Ferretti.
Uso: python3 tools/build_prezzi_ferretti.py "<Optional 720>.pdf"
Output in data-private/ (cartella in .gitignore: i listini sono 'strictly private and confidential'):
  01_Listino_Prezzi_Ferretti.xlsx   foglio Macchine: Codice, Nome, Prezzo (listino barche 2026-2027, IVA esclusa)
  02_Matrice_Optional_Ferretti.xlsx fogli Optional_Prezzi + Catalogo_Optional (optional 720 + delta motorizzazione optional per modello)
Il configuratore li carica in automatico se serviti da un server locale; sul sito pubblicato si caricano a mano (Carica listino / matrice optional)."""
import json, sys
from pathlib import Path
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font
sys.path.insert(0, str(Path(__file__).resolve().parent))
import parse_optional_720 as P

RADICE = Path(__file__).resolve().parent.parent
OUT = RADICE / "data-private"

# Listino barche 2026-2027 (EMEA/APAC, IVA esclusa): file data-private/listino_barche.json, {Nome nel catalogo: [prezzo std, prezzo con motori optional]}
LISTINO = {k: tuple(v) for k, v in json.load(open(OUT / "listino_barche.json", encoding="utf8")).items()}   # prezzi riservati: data-private/listino_barche.json

IT = {  # traduzione italiana delle voci del listino optional 720 (chiave = testo inglese del listino)
    "Cover for tender": "Copertura per tender",
    "Customer’s tender installation (*)": "Installazione del tender del cliente (*)",
    "Lifting platform, 550 kg upgrade": "Piattaforma di sollevamento, upgrade a 550 kg",
    "Seabob F9S Ferretti Yachts Special Edition, including fixing onboard (*)": "Seabob F9S Ferretti Yachts Special Edition, con fissaggio a bordo (*)",
    "Williams 345 SportJet tender (*)": "Tender Williams 345 SportJet (*)",
    "Williams 395 Sportjet tender (*)": "Tender Williams 395 SportJet (*)",
    "Awning system with carbon poles for bow dinette": "Sistema di tendalini con aste in carbonio per dinette di prua",
    "Awning system with carbon poles on flybridge": "Sistema di tendalini con aste in carbonio sul flybridge",
    "Awning system with carbon poles on transom": "Sistema di tendalini con aste in carbonio a poppa",
    "Chain marking every 10 m": "Marcatura della catena ogni 10 m",
    "Chaise longue at stern": "Chaise longue di poppa",
    "Cockpit winter cover": "Copertura invernale del pozzetto",
    "Comfort shower at stern": "Doccia comfort di poppa",
    "Copilot seat by Poltrona Frau on flybridge": "Sedile del copilota Poltrona Frau sul flybridge",
    "Courtesy lights for exteriors (*)": "Luci di cortesia esterne (*)",
    "Electric searchlight": "Faro di ricerca elettrico",
    "Handrail for swim-ladder (*)": "Corrimano per scaletta bagno (*)",
    "Hard top: fixed glass roof": "Hard top: tetto in vetro fisso",
    "Hard top: retractable opening version": "Hard top: versione apribile retrattile",
    "Hard top: shading blades": "Hard top: lamelle oscuranti",
    "Mesh canopy (3 pieces) in cockpit": "Tenda a rete (3 pezzi) nel pozzetto",
    "Mesh covers for windscreen and side windows, black": "Coperture a rete per parabrezza e finestre laterali, nere",
    "Openable handrail on sidewalks": "Corrimano apribile sui passavanti",
    "Painted teak table for bow dinette": "Tavolo in teak verniciato per dinette di prua",
    "Painted teak table in cockpit": "Tavolo in teak verniciato nel pozzetto",
    "Painted teak table upgrade on flybridge": "Upgrade tavolo in teak verniciato sul flybridge",
    "Painting of navigation equipment (*)": "Verniciatura delle apparecchiature di navigazione (*)",
    "Pop-up courtesy light in bow living area (2 lights)": "Luci di cortesia a scomparsa nell'area living di prua (2 luci)",
    "Primer application under antifouling": "Applicazione del primer sotto l'antivegetativa",
    "Remote control for electro-hydraulic gangway, additional": "Telecomando aggiuntivo per passerella elettroidraulica",
    "Safety equipment upgrade (life raft + jackets) (*)": "Upgrade dotazioni di sicurezza (zattera + giubbotti) (*)",
    "Stainless steel backlit boat name (each letter)": "Nome barca in acciaio inox retroilluminato (per lettera)",
    "Stainless steel boat name (each letter)": "Nome barca in acciaio inox (per lettera)",
    "Stainless steel port name (each letter)": "Nome del porto in acciaio inox (per lettera)",
    "Teak in cockpit with grey caulking upgrade": "Upgrade teak nel pozzetto con calafataggio grigio",
    "Teak on flybridge deck with black caulking": "Teak sul ponte flybridge con calafataggio nero",
    "Teak on flybridge deck with grey caulking": "Teak sul ponte flybridge con calafataggio grigio",
    "Teak on lifting platform with black caulking": "Teak sulla piattaforma di sollevamento con calafataggio nero",
    "Teak on lifting platform with grey caulking": "Teak sulla piattaforma di sollevamento con calafataggio grigio",
    "Teak on sidewalks and bow with black caulking": "Teak su passavanti e prua con calafataggio nero",
    "Teak on sidewalks and bow with grey caulking": "Teak su passavanti e prua con calafataggio grigio",
    "Underwater lights, pair": "Luci subacquee, coppia",
    "Waterproof covers for external cushions and tables": "Coperture impermeabili per cuscini e tavoli esterni",
    "CCTV outdoor camera for maneuvering": "Telecamera CCTV esterna per le manovre",
    "CCTV: external color camera, additional": "CCTV: telecamera esterna a colori aggiuntiva",
    "CCTV: indoor color TV camera (price for each camera)": "CCTV: telecamera interna a colori (prezzo per telecamera)",
    "Cockpit control station": "Postazione di comando nel pozzetto",
    "Digital chain counter": "Contacatena digitale",
    "Dynamic positioning system (digital anchoring)": "Sistema di posizionamento dinamico (ancoraggio digitale)",
    "EPIRB (*)": "EPIRB (*)",
    "Joystick at 2 helm stations (*)": "Joystick nelle 2 postazioni di comando (*)",
    "Joystick at 2 helm stations (bow and stern thrusters with proportional propellers included)": "Joystick nelle 2 postazioni di comando (con eliche di manovra di prua e di poppa proporzionali)",
    "Monitoring functions upgrade (A/C - generator)": "Upgrade funzioni di monitoraggio (aria condizionata - generatore)",
    "Proportional bow thruster upgrade": "Upgrade elica di prua proporzionale",
    "Proportional stern thruster (*)": "Elica di poppa proporzionale (*)",
    "Simrad autopilot control unit": "Unità di controllo autopilota Simrad",
    "Simrad display upgrade (*)": "Upgrade display Simrad (*)",
    "Simrad Echosounder": "Ecoscandaglio Simrad",
    "Simrad multifunction indicator": "Indicatore multifunzione Simrad",
    "Simrad NAIS500 (RX-TX) AIS transponder - Class B (*)": "Transponder AIS Simrad NAIS500 (RX-TX) - Classe B (*)",
    "Stern thruster 16 hp": "Elica di poppa da 16 hp",
    "Watchit anti-collision system": "Sistema anticollisione Watchit",
    "X-AID integrated adaptive docking system by Xenta (*)": "Sistema di ormeggio adattivo integrato X-AID by Xenta (*)",
    "24'' TV in portside guest cabin": "TV 24'' nella cabina ospiti di sinistra",
    "24'' TV in starboard side guest cabin": "TV 24'' nella cabina ospiti di dritta",
    "32'' TV in VIP cabin": "TV 32'' nella cabina VIP",
    "55'' TV in salon with TV lift upgrade (*)": "Upgrade TV 55'' in salone con alzatv (*)",
    "65” Mirror TV in master cabin upgrade (*)": "Upgrade TV specchio 65” nella cabina armatoriale (*)",
    "Customer receiver installation": "Installazione del ricevitore del cliente",
    "Electric lift for 50'' TV": "Alzatv elettrico per TV 50''",
    "Fusion MS-RA770 hi-fi (upgrade from std)": "Hi-fi Fusion MS-RA770 (upgrade dalla dotazione standard)",
    "Fusion MS-RA770 hi-fi, additional (*)": "Hi-fi Fusion MS-RA770 aggiuntivo (*)",
    "HQ amplified outdoor loudspeakers with remote control at bow": "Altoparlanti esterni amplificati HQ con telecomando a prua",
    "HQ amplified outdoor loudspeakers with remote control in cockpit": "Altoparlanti esterni amplificati HQ con telecomando nel pozzetto",
    "HQ outdoor loudspeakers upgrade": "Upgrade altoparlanti esterni HQ",
    "KVH TV6 SAT TV antenna with receiver in salon and empty dome (including painting)": "Antenna TV SAT KVH TV6 con ricevitore in salone e cupola vuota (verniciatura inclusa)",
    "Premium 5G internet package (*)": "Pacchetto internet 5G premium (*)",
    "Premium audio for exteriors (*)": "Impianto audio premium per esterni (*)",
    "SAT TV antenna cabling for cabins": "Cablaggio antenna TV SAT per le cabine",
    "Starlink premium internet system (*)": "Sistema internet Starlink premium (*)",
    "Wi-fi access point": "Access point Wi-Fi",
    "Additional German Schuko sockets, each": "Prese Schuko tedesche aggiuntive, cad.",
    "Automatic reeler for shore cable": "Avvolgicavo automatico per cavo di banchina",
    "Generator battery charger": "Caricabatterie per generatore",
    "Generators upgrade (*)": "Upgrade generatori (*)",
    "German Schuko sockets throughout yacht": "Prese Schuko tedesche in tutto lo yacht",
    "Inverter/battery charger": "Inverter / caricabatterie",
    "Shore cable extension": "Prolunga cavo di banchina",
    "Shore fresh water intake": "Presa acqua dolce da banchina",
    "USB sockets throughout yacht (*)": "Prese USB in tutto lo yacht (*)",
    "Watermaker with control at main helm, 180 l/h": "Dissalatore con comando al timone principale, 180 l/h",
    "Watertight socket, additional": "Presa stagna aggiuntiva",
    "Bidet removal (central WC), each": "Rimozione bidet (WC centrale), cad.",
    "Blackout roller blinds in cabins": "Tende oscuranti a rullo nelle cabine",
    "Copilot seat by Poltrona Frau in wheelhouse": "Sedile del copilota Poltrona Frau in plancia",
    "Courtesy lights for interiors (*)": "Luci di cortesia interne (*)",
    "Digital safe": "Cassaforte digitale",
    "Electric curtains and blackout roller blinds in master cabin": "Tende elettriche e oscuranti a rullo nella cabina armatoriale",
    "Electric curtains in salon": "Tende elettriche in salone",
    "Hand shower for toilet": "Doccetta per il bagno",
    "Mattress upgrade": "Upgrade materassi",
    "Mosquito net kit for portholes": "Kit zanzariere per oblò",
    "Pullman bed in port side guest cabin": "Letto Pullman nella cabina ospiti di sinistra",
    "Sliding beds in portside guest cabin": "Letti scorrevoli nella cabina ospiti di sinistra",
    "Sliding glass wall in galley": "Parete in vetro scorrevole in cucina",
    "Super tropical air conditioning": "Aria condizionata super tropicale",
    "Tropical air conditioning (salon + cabins + crew)": "Aria condizionata tropicale (salone + cabine + equipaggio)",
    "WC with bidet (*)": "WC con bidet (*)",
    "Dishwasher": "Lavastoviglie",
    "Drawer refrigerator": "Frigorifero a cassetti",
    "Grill on flybridge": "Grill sul flybridge",
    "Icemaker with internal water reservoir in cockpit": "Fabbricatore di ghiaccio con serbatoio interno nel pozzetto",
    "Independent washer and dryer upgrade": "Upgrade lavatrice e asciugatrice indipendenti",
    "Refrigerator on flybridge (*)": "Frigorifero sul flybridge (*)",
    "Waste mincer in galley sink": "Tritarifiuti nel lavello della cucina",
    "Wine cellar (*)": "Cantinetta vini (*)",
    "Gyro stabilizer (*)": "Stabilizzatore giroscopico (*)",
    "Oil kit": "Kit olio",
    "Spare parts kit for generator (*)": "Kit ricambi per generatore (*)",
    "Spare parts kit for MAN 1200 hp engines": "Kit ricambi per motori MAN da 1200 hp",
    "Spare parts kit for MAN 1400 hp engines": "Kit ricambi per motori MAN da 1400 hp",
    "Export documents outside EU": "Documenti di esportazione extra UE",
    "Notarized sale documents": "Documenti di vendita notarili",
    "Tonnage certificate": "Certificato di stazza",
}

NOTE_IT = {  # note del listino (voci con (*)), tradotte in italiano; chiave = titolo inglese senza "(*)"
    "Customer’s tender installation": "È necessaria una valutazione preliminare di dimensioni e peso del tender del cliente.",
    "Seabob F9S Ferretti Yachts Special Edition, including fixing onboard": "Il prezzo si riferisce alla versione Ferretti Yachts Special Edition del Seabob S9. Qualsiasi configurazione alternativa sarà quotata a parte.",
    "Williams 345 SportJet tender": "Include il fissaggio.",
    "Williams 395 Sportjet tender": "Fissaggio incluso.",
    "Courtesy lights for exteriors": "Include le luci della scala per il flybridge e delle scale verso il pozzetto, strisce luminose sui passavanti.",
    "Handrail for swim-ladder": "Corrimano a basso profilo.",
    "Painting of navigation equipment": "Colore: bianco.",
    "Safety equipment upgrade (life raft + jackets)": "Upgrade da 12 a 18 persone.",
    "EPIRB": "Radioboa di localizzazione d'emergenza (tipo di precisione), con rilascio idrostatico automatico e attivazione, approvata I.M.O. Il cliente deve fornire il codice M.M.S.I. per l'attivazione. Il dispositivo non può funzionare senza collegamento o attivazione. Include sensore GPS a bordo, categoria 1. Dopo la consegna l'attivazione del sistema è responsabilità del cliente.",
    "Joystick at 2 helm stations": "Include elica di prua con eliche proporzionali.",
    "Proportional stern thruster": "Selezionabile solo insieme all'upgrade elica di prua proporzionale (OPT15208).",
    "Simrad display upgrade": "L'upgrade include: 4 monitor evo3 da 16” in plancia e 2 monitor evo3 da 12” sul flybridge.",
    "Simrad NAIS500 (RX-TX) AIS transponder - Class B": "Il cliente deve fornire il codice M.M.S.I. per l'attivazione. Dopo la consegna l'attivazione del sistema è responsabilità del cliente.",
    "X-AID integrated adaptive docking system by Xenta": "Richiede il joystick (OPT14747) con eliche di prua e di poppa, eliche proporzionali incluse.",
    "55'' TV in salon with TV lift upgrade": "Upgrade dal TV fisso standard da 43”.",
    "65” Mirror TV in master cabin upgrade": "Upgrade dal TV standard da 50”.",
    "Fusion MS-RA770 hi-fi, additional": "Aggiuntivo nella cabina armatoriale.",
    "Premium 5G internet package": "Access point wifi aggiuntivo e antenna esterna per la copertura completa dello yacht. Tutti i dispositivi elettronici e le cabine avranno collegamenti cablati (switch hub POE a 24 porte).",
    "Premium audio for exteriors": "PRUA: 2 altoparlanti JL Audio + FUSION MS400; FLYBRIDGE: 4 altoparlanti JL Audio + 1 amplificatore; POZZETTO: 4 altoparlanti JL Audio + 2 amplificatori.",
    "Starlink premium internet system": "1 antenna.",
    "Generators upgrade": "Include filtro Racor, separatore di fumi e 2 generatori da 22 kW, upgrade dallo standard da 11 kW.",
    "USB sockets throughout yacht": "Dove applicabile, come specificato nel progetto illuminotecnico.",
    "Courtesy lights for interiors": "Include le luci della scala verso il ponte inferiore e le strisce luminose sotto i letti.",
    "WC with bidet": "Disponibile solo per il bagno armatoriale.",
    "Refrigerator on flybridge": "Frigorifero (50 l) sul flybridge.",
    "Wine cellar": "Cantinetta con capacità di 10 bottiglie.",
    "Gyro stabilizer": "Include 1 NG 6 e 1 NG 10.",
    "Spare parts kit for generator": "Include: 2 filtri olio, 2 filtri gasolio, 1 cinghia, 2 rotori, 2 anodi e 1 valigia.",
}


def main(pdf):
    OUT.mkdir(exist_ok=True)
    cat = load_workbook(RADICE / "excel" / "catalogo_ferretti.xlsx")["Macchine"]
    righe = list(cat.iter_rows(min_row=4, values_only=True))
    h = righe[0]
    modelli = [dict(zip(h, r)) for r in righe[1:] if r[0]]
    # 01 listino barche
    wb = Workbook(); ws = wb.active; ws.title = "Macchine"
    ws["A1"] = "Listino barche Ferretti Yachts 2026-2027 (EMEA/APAC) — IVA esclusa — RISERVATO"; ws["A1"].font = Font(bold=True)
    ws["A2"] = "Prezzi della motorizzazione standard del sito. Resa: franco Ravenna (500, 580, 670), franco cantiere gli altri. Validità dal 02/09/2026."
    for c, n in enumerate(["Codice", "Nome", "Prezzo"], 1):
        ws.cell(row=4, column=c, value=n).font = Font(bold=True)
    for i, m in enumerate(modelli, 5):
        if m["Nome"] not in LISTINO:
            print("ATTENZIONE: modello senza prezzo", m["Nome"]); continue
        ws.cell(row=i, column=1, value=m["Codice"]); ws.cell(row=i, column=2, value=m["Nome"]); ws.cell(row=i, column=3, value=LISTINO[m["Nome"]][0])
    wb.save(OUT / "01_Listino_Prezzi_Ferretti.xlsx")

    # 02 optional
    voci = P.parse(pdf)
    opt = []   # (codice, gruppo, ordine, en, it, nota, prezzo, solo720)
    for i, v in enumerate(voci, 1):
        it = IT.get(v["en"])
        if not it:
            print("SENZA TRADUZIONE:", v["en"])
            it = v["en"]
        if v["qr"]:
            it += " — su richiesta"; v["en"] += " — on request"
        import re as _re
        titolo = _re.sub(r"\s*\(\*\)", "", v["en"].replace(" — on request", "")).strip()
        nota_it = NOTE_IT.get(titolo, "")
        if v["note"] and not nota_it:
            print("NOTA SENZA TRADUZIONE:", titolo)
        opt.append((f"OPT720-{i:03d}", P.GRUPPO[v["sez"]], i, v["en"], it, v["note"], v["price"], nota_it))
    eng = []   # delta motorizzazione optional per modello
    for m in modelli:
        pr = LISTINO.get(m["Nome"])
        if pr and pr[1] and m.get("Motore_Optional"):
            eng.append(("ENG-" + m["Nome"].replace("Ferretti Yachts ", "").replace(" ", "-").upper(), "Motorizzazione", 0, f"Optional engines: {m['Motore_Optional']}", f"Motorizzazione optional: {m['Motore_Optional']}", "", pr[1] - pr[0], m["Codice"]))
    wb = Workbook(); ws = wb.active; ws.title = "Optional_Prezzi"
    codici = [o[0] for o in eng] + [o[0] for o in opt]
    ws.append(["Gruppo"] + [next(x for x in eng + opt if x[0] == c)[1] for c in codici])
    ws.append(["Codice Macchina"] + codici)
    ws.append(["Descrizione"] + [next(x for x in eng + opt if x[0] == c)[4] for c in codici])
    for m in modelli:
        riga = [m["Codice"]]
        for c in codici:
            if c.startswith("ENG-"):
                riga.append(next((e[6] for e in eng if e[0] == c and e[7] == m["Codice"]), ""))
            else:
                riga.append(next(o[6] for o in opt if o[0] == c))   # su richiesta: gli optional del listino 720 valgono per tutti i modelli
        ws.append(riga)
    w2 = wb.create_sheet("Catalogo_Optional")
    w2.append(["Codice", "Gruppo", "Ordine", "Descrizione", "Descrizione_IT", "Nota", "Nota_IT"])
    for o in eng:
        w2.append([o[0], o[1], o[2], o[3], o[4], o[5], ""])          # o[7] = codice modello (serve alla matrice), non una nota
    for o in opt:
        w2.append([o[0], o[1], o[2], o[3], o[4], o[5], o[7]])        # o[7] = nota in italiano
    wb.save(OUT / "02_Matrice_Optional_Ferretti.xlsx")
    print(f"listino: {len(modelli)} modelli · optional 720: {len(opt)} · delta motori: {len(eng)} -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1])
