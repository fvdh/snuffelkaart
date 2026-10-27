---
name: Snuffelkaart
description: Kringlopen en rommelmarkten op één kaart, eerlijk over wat zeker is, en in twee minuten een dagplan.
colors:
  kassa-inkt: "oklch(0.47 0.15 262)"
  kassa-inkt-soft: "oklch(0.93 0.035 262)"
  on-kassa-inkt: "oklch(0.985 0.005 262)"
  goudsbloem: "oklch(0.78 0.15 70)"
  goudsbloem-ink: "oklch(0.50 0.12 60)"
  goudsbloem-soft: "oklch(0.95 0.05 80)"
  on-goudsbloem: "oklch(0.26 0.04 55)"
  open-groen: "oklch(0.62 0.16 150)"
  open-groen-ink: "oklch(0.47 0.13 150)"
  let-op: "oklch(0.72 0.15 75)"
  let-op-ink: "oklch(0.50 0.12 65)"
  let-op-soft: "oklch(0.96 0.045 85)"
  klopt-niet: "oklch(0.56 0.19 27)"
  klopt-niet-ink: "oklch(0.50 0.18 27)"
  klopt-niet-soft: "oklch(0.96 0.025 25)"
  dicht-grijs: "oklch(0.66 0.008 260)"
  inkt: "oklch(0.25 0.015 262)"
  on-inkt: "oklch(0.985 0.003 85)"
  pagina: "oklch(0.972 0.004 85)"
  oppervlak: "oklch(0.995 0.002 85)"
  oppervlak-2: "oklch(0.955 0.005 85)"
  lijn: "oklch(0.89 0.006 85)"
  lijn-sterk: "oklch(0.80 0.008 85)"
  tekst: "oklch(0.24 0.012 260)"
  tekst-2: "oklch(0.43 0.012 260)"
  tekst-3: "oklch(0.55 0.010 260)"
  bonpapier: "oklch(0.978 0.012 88)"
  kaart-land: "oklch(0.958 0.006 95)"
  kaart-bebouwing: "oklch(0.935 0.008 80)"
  kaart-water: "oklch(0.87 0.035 230)"
  kaart-groen: "oklch(0.925 0.035 145)"
  kaart-weg: "oklch(0.995 0.002 90)"
  kaart-snelweg: "oklch(0.93 0.05 85)"
  focus: "oklch(0.55 0.17 262)"
  pruim: "oklch(0.48 0.11 330)"
  pruim-soft: "oklch(0.94 0.03 330)"
typography:
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 740
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 720
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  name:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  status:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 560
    lineHeight: 1.35
    fontFeature: "\"tnum\" 1"
  meta:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.06em"
  bon:
    fontFamily: "DM Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  xs: "5px"
  sm: "8px"
  pin: "9px"
  tile: "11px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  sheet: "22px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "48px"
  8: "64px"
components:
  button-primary:
    backgroundColor: "{colors.inkt}"
    textColor: "{colors.on-inkt}"
    typography: "{typography.name}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.oppervlak}"
    textColor: "{colors.tekst}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.oppervlak-2}"
    textColor: "{colors.tekst}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-small:
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "36px"
  chip:
    backgroundColor: "{colors.oppervlak}"
    textColor: "{colors.tekst}"
    typography: "{typography.status}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "34px"
  chip-selected:
    backgroundColor: "{colors.inkt}"
    textColor: "{colors.on-inkt}"
    rounded: "{rounded.pill}"
  segmented:
    backgroundColor: "{colors.oppervlak-2}"
    textColor: "{colors.tekst-2}"
    rounded: "{rounded.pill}"
    height: "34px"
  segmented-selected:
    backgroundColor: "{colors.oppervlak}"
    textColor: "{colors.tekst}"
  input-search:
    backgroundColor: "{colors.oppervlak-2}"
    textColor: "{colors.tekst}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.oppervlak}"
    textColor: "{colors.tekst}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "46px"
  tile-kringloop:
    backgroundColor: "{colors.kassa-inkt-soft}"
    textColor: "{colors.kassa-inkt}"
    rounded: "{rounded.tile}"
    size: "40px"
  tile-markt:
    backgroundColor: "{colors.goudsbloem-soft}"
    textColor: "{colors.goudsbloem-ink}"
    rounded: "{rounded.pill}"
    size: "40px"
  pin-kringloop:
    backgroundColor: "{colors.kassa-inkt}"
    textColor: "{colors.on-kassa-inkt}"
    rounded: "{rounded.pin}"
    size: "32px"
  pin-markt:
    backgroundColor: "{colors.goudsbloem}"
    textColor: "{colors.on-goudsbloem}"
    rounded: "{rounded.pill}"
    size: "32px"
  add-button:
    backgroundColor: "{colors.oppervlak}"
    textColor: "{colors.tekst}"
    rounded: "{rounded.pill}"
    size: "32px"
  add-button-pressed:
    backgroundColor: "{colors.inkt}"
    textColor: "{colors.on-inkt}"
  planbar:
    backgroundColor: "{colors.inkt}"
    textColor: "{colors.on-inkt}"
    rounded: "{rounded.xl}"
    height: "58px"
    padding: "0 14px 0 10px"
  bottom-sheet:
    backgroundColor: "{colors.oppervlak}"
    rounded: "{rounded.sheet}"
  statusbox-bevestigd:
    textColor: "{colors.open-groen-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  statusbox-onbevestigd:
    backgroundColor: "{colors.let-op-soft}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  statusbox-afgelast:
    backgroundColor: "{colors.klopt-niet-soft}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  bon:
    backgroundColor: "{colors.bonpapier}"
    textColor: "{colors.tekst}"
    typography: "{typography.bon}"
    padding: "22px 16px 28px"
---

# Design System: Snuffelkaart

## 1. Overview

**Creative North Star: "De Betrouwbare Buurtkaart"**

Snuffelkaart is zo rustig als een goede kaart en zo warm als iemand uit de buurt die het gewoon weet. De kaart is het thuisscherm; alles wat erop ligt (pins, paneel, dagplanbalk) is een duidelijk, stevig voorwerp dat je met je duim raakt. Het systeem is een gereedschap voor twee momenten: plannen op de bank op vrijdagavond, en zaterdagochtend op de stoep in fel daglicht. Dat tweede moment wint elke afweging: licht als standaard, hoog contrast op status en tijden, cijfers met vaste breedte.

Het karakter zit in de details, niet in het oppervlak. Vorm vertelt het type (een vierkant prijskaartje voor een kringloop, een rond kraampje voor een markt), de rand vertelt de zekerheid (vol voor bevestigd, gestippeld voor nog niet bevestigd), en kleur bevestigt alleen. Er is precies één plek waar het systeem zichtbaar tweedehands mag zijn: het dagplan als **kassabon**.

Het systeem wijst expliciet af wat de huidige kringloop- en markt-apps zijn: rommelig en vol, traag met spinners, gedateerd met standaard Google-pins en grijze lijsten, en onbetrouwbaar omdat je niet ziet hoe oud of zeker iets is. Ook geen duurzaamheidsgroen-cliché, geen stoffige rommelmarkt-nostalgie en geen SaaS-dashboard-uitstraling.

**Key Characteristics:**
- Kaart eerst op mobiel met een bottom sheet in drie standen; lijst links en kaart rechts op desktop.
- Elke lijstregel toont drie dingen: type, open/dicht of datum, afstand.
- Zekerheid is altijd zichtbaar: bevestigingsstatus en controledatum.
- Eén lettertype (Figtree) voor de app; DM Mono alleen op de bon.
- Beweging vertelt wat er veranderd is: 150–450 ms, zachte uitloop, nooit stuiteren.
- Tijdsbewust in de status, niet in het filter: standaard alles ("Snuffelen rond …"), elke regel toont open/dicht of de marktdag. Tijdchips zijn aan/uit; nog eens tikken = weer alles.

## 2. Colors: Kassa-inkt en Goudsbloem

Terughoudend: getinte, heel licht warme neutrale kleuren met twee type-accenten en een strikte statuswoordenschat. Alle kleuren zijn in OKLCH gedefinieerd; dat is de bron van waarheid.

### Primary
- **Kassa-inkt** (`oklch(0.47 0.15 262)`): het type-accent voor kringloopwinkels. Vult de vierkante kringlooppin; als zachte variant (`oklch(0.93 0.035 262)`) de achtergrond van de kringlooptegel in lijsten. Nooit gebruikt voor knoppen of decoratie.

- **Pruim** (`oklch(0.48 0.11 330)`): het type-accent voor tweedehandswinkels die geen standaard kringloop zijn (vintage, dumpstore, opkoper, of een naam waaruit we het niet weten). Zelfde vierkante winkelvorm, maar met een kleerhanger in plaats van het prijskaartje (een winkelpui leek te veel op het marktkraampje); zachte variant (`oklch(0.94 0.03 330)`) voor de tegel. Zo is het verschil te zien zonder dat de winkel verdwijnt.

### Secondary
- **Goudsbloem** (`oklch(0.78 0.15 70)`): het type-accent voor markten. Vult de ronde marktpin. Voor tekst en iconen op licht oppervlak gebruik je **Goudsbloem-inkt** (`oklch(0.50 0.12 60)`), want de volle goudsbloem haalt geen leescontrast.

### Tertiary: statuswoordenschat
- **Open-groen** (`oklch(0.62 0.16 150)`, tekst `oklch(0.47 0.13 150)`): alleen "open nu", "nu bezig" en "bevestigd".
- **Let op** (`oklch(0.72 0.15 75)`, tekst `oklch(0.50 0.12 65)`, vlak `oklch(0.96 0.045 85)`): nog niet bevestigd, sluit binnen 30 minuten, wachten tot opening.
- **Klopt niet** (`oklch(0.56 0.19 27)`, tekst `oklch(0.50 0.18 27)`, vlak `oklch(0.96 0.025 25)`): afgelast, dicht als je aankomt, markt al voorbij.
- **Dicht-grijs** (`oklch(0.66 0.008 260)`): gesloten, gedempt, zonder alarm.

### Neutral
- **Inkt** (`oklch(0.25 0.015 262)`): primaire knoppen, geselecteerde chips, de dagplanbalk, de routelijn, de eigen locatie.
- **Pagina** (`oklch(0.972 0.004 85)`) en **Oppervlak** (`oklch(0.995 0.002 85)`): achtergrond en paneel. **Oppervlak-2** (`oklch(0.955 0.005 85)`) voor zoekveld, segmented controls en skeletons.
- **Tekst** (`oklch(0.24 0.012 260)`), **Tekst-2** (`oklch(0.43 …)`) en **Tekst-3** (`oklch(0.55 …)`): naam, status/toelichting, meta.
- **Lijn** (`oklch(0.89 0.006 85)`) en **Lijn-sterk** (`oklch(0.80 …)`): scheidingen tussen regels; randen van chips en knoppen.
- **Bonpapier** (`oklch(0.978 0.012 88)`): alleen de kassabon.
- **Kaartpalet**: land `0.958`, bebouwing `0.935`, water `oklch(0.87 0.035 230)`, groen `oklch(0.925 0.035 145)`, wegen bijna wit, snelwegen zacht geel. Gedempt, zodat pins altijd winnen.

**Donkere modus** volgt het systeem en is gelijkwaardig ontworpen, niet omgekeerd: neutrale kleuren rond `oklch(0.19–0.27 0.01 260)`, accenten lichter (kassa-inkt `oklch(0.72 0.12 262)`, goudsbloem `oklch(0.80 0.14 75)`), inkt wordt licht (`oklch(0.93 0.006 85)`) met donkere tekst erop.

### Named Rules
**De Groen-is-open Regel.** Groen betekent alleen "open" of "bevestigd". Kringlopen zijn daarom bewust niet groen, en groen wordt nergens decoratief gebruikt.

**De Nooit-alleen-kleur Regel.** Type, status en zekerheid hebben altijd ook een vorm, icoon of tekst. Kleur bevestigt; vorm vertelt.

**De Gestippeld-is-onzeker Regel.** Een gestippelde rand betekent altijd “we weten het niet zeker”: een markt die nog niet bevestigd is, een kringloop zonder openingstijden, een markt die over een hele wijk verspreid is. Gebruik stippellijnen nergens anders, ook niet decoratief.

**De Inkt-is-actie Regel.** Primaire acties zijn inkt, niet een type-kleur. Een knop is nooit blauw omdat het om een kringloop gaat.

## 3. Typography

**Body Font:** Figtree (met ui-sans-serif, system-ui, -apple-system, Segoe UI)
**Mono Font:** DM Mono (met ui-monospace, SFMono-Regular, Menlo), alleen op de kassabon

**Character:** Figtree is warm en open zonder kinderachtig te worden, goed leesbaar op klein formaat en buiten. Met cijfers van vaste breedte (`tnum`) staan tijden en afstanden netjes onder elkaar. DM Mono geeft de bon zijn kassaprinter-stem.

### Hierarchy
- **Title** (740, 1.5rem / 24px, 1.15, −0.015em): naam in detailweergave, "Mijn zaterdag".
- **Headline** (720, 1.25rem / 20px, 1.2): kop van de lijst ("Dit weekend bij jou in de buurt").
- **Name** (650, 1rem / 16px, 1.3): naam in een lijstregel; afkappen met ellips op één regel.
- **Body** (400, 1rem, 1.5): toelichtingen, formulieren. Lopende tekst maximaal 65–70ch.
- **Status** (560, 0.875rem / 14px, 1.35, tabular): open/dicht, datum en tijd, altijd met een gekleurde stip ervoor.
- **Meta** (400, 0.8125rem / 13px): plaats, specialiteiten, bevestigingslabel.
- **Label** (700, 0.75rem, 0.06em, hoofdletters): sectiekoppen in zoekresultaten, tags.
- **Bon** (DM Mono 400/500, 0.875rem): alle tekst op de kassabon behalve de stopnamen (die blijven Figtree 680).

### Named Rules
**De Vaste-schaal Regel.** App-typografie schaalt niet mee met het scherm (geen `clamp()`); vaste rem-stappen, hiërarchie via gewicht.

**De Tabular-tijden Regel.** Elke tijd, afstand, telling en datum staat in `tabular-nums`.

## 4. Elevation

Hybride en spaarzaam. Inhoud ligt plat; alleen voorwerpen die **boven de kaart zweven** krijgen schaduw: de bottom sheet, de dagplanbalk, de kaartbediening, pins, toasts en de bon. Lijsten en secties in het paneel hebben geen schaduw en geen kaartjes; ze worden gescheiden door 1px lijnen en ruimte.

### Shadow Vocabulary
- **Zwevend** (`0 1px 2px oklch(0.2 0.02 260 / .06), 0 6px 20px oklch(0.2 0.02 260 / .08)`): kaartbediening, toasts, labels bij pins, geselecteerde segmented control.
- **Paneel** (`0 -2px 6px oklch(0.2 0.02 260 / .05), 0 -12px 32px oklch(0.2 0.02 260 / .10)`): de bottom sheet, schaduw naar boven.
- **Pin** (`0 1px 2px oklch(0.2 0.02 260 / .25), 0 3px 8px oklch(0.2 0.02 260 / .18)`): pins, zodat ze loskomen van de kaart.
- **Dagplanbalk** (`0 10px 30px -8px oklch(0.15 0.02 260 / .5)`): de enige zware schaduw; dit is de belangrijkste knop.
- **Bon** (`drop-shadow(0 1px 1px … / .10) drop-shadow(0 8px 16px … / .10)`): als filter, omdat de geperforeerde rand met een mask is gemaakt.

### Named Rules
**De Alleen-wat-zweeft Regel.** Schaduw betekent "ligt boven de kaart". Niets in een lijst of paneel krijgt schaduw.

## 5. Components

Vertrouwd en stevig: standaardvormen, 44px raakvlakken, duidelijke druk-feedback, niets verzonnen voor de smaak.

### Buttons
- **Shape:** afgerond (12px), 44px hoog; klein 36px hoog met 10px hoeken.
- **Primary:** inkt-achtergrond, on-inkt tekst, 650, padding 0 16px. Eén per weergave, bijvoorbeeld "In mijn zaterdag" of "Verstuur melding".
- **Secondary:** oppervlak met 1px lijn-sterk rand. **Ghost:** oppervlak-2 zonder rand.
- **Icoonknop:** 44×44, 12px hoeken, 1px rand (hartje, route).
- **Press / Focus:** `scale(.97)` bij indrukken (120 ms); focus is een 2px ring in focus-blauw met 2px offset. Disabled: 45% dekking, geen schaal.

### Chips
- **Style:** pill (999px), 34px hoog, 1px lijn-sterk rand, oppervlak, 14px/580.
- **Selected:** inkt-achtergrond en on-inkt tekst, rand in inkt. Overgang 150 ms.
- **Type-filter:** een segmented control (oppervlak-2 bak met oppervlak-pil als selectie) met een klein vierkantje (kringloop) of rondje (markt) als legenda.
- De chiprij scrollt horizontaal en loopt door tot de rand van het paneel.

### Lijstregel (signature)
- Grid: tegel 40px · tekst · afstand rechtsboven; daarnaast een losse **+**-knop (44px raakvlak, 32px cirkel).
- Tegel: kringloop is een vierkant met 11px hoeken in kassa-inkt-soft; markt is een cirkel in goudsbloem-soft; onbevestigd krijgt een gestippelde rand; afgelast is grijs.
- Drie regels: naam (650), status met stip (560), meta (13px).
- **+** gedrukt: vult zich in inkt met een vinkje en een pop van 320 ms.

### Pins en groepjes
- Kringloop: vierkant met 9px hoeken, 32px, 2px witte rand, prijskaartje. Tweedehandswinkel: zelfde vierkant in pruim, kleerhanger. Markt: cirkel, 32px.
- Nu open: groen stipje rechtsboven met een rustige puls van 2,4 s. Dicht: wit met gedempt icoon. Onbevestigd: wit met een gestippelde goudsbloem-inkt rand. Afgelast: grijs met een rode diagonale streep.
- Geselecteerd: schaal 1.22 met naamlabel eronder. In het dagplan: een inkt-nummerbadge linksboven.
- Groepje: een cirkel van 38px; de kleur is een conic-gradient in de verhouding tussen kringlopen en markten.

### Inputs / Fields
- **Zoeken:** oppervlak-2, geen rand, 12px hoeken, 44px; focus is een 2px focusring om het hele veld.
- **Formuliervelden:** oppervlak met 1px lijn-sterk rand, 12px hoeken, 46px. Focus: rand in focus-blauw plus een zachte ring van 3px.
- **Keuzelijsten:** gestapelde radio's in één omlijnd blok met lijnen ertussen, nooit losse kaartjes.

### Bottom sheet en dagplanbalk
- **Sheet:** oppervlak, 22px bovenhoeken, greep van 38×5px. Drie standen: ingeklapt (alleen de kop), half (47%), volledig (48px van boven). Loslaten snapt binnen 420 ms; de snelheid van je veeg telt mee.
- **Dagplanbalk:** inkt, 58px hoog, 16px hoeken, zweeft 16px boven de onderrand. Toont het aantal stops, "Mijn zaterdag", aandachtspunten en de eindtijd.

### Statusvakken (bevestiging)
- Bevestigd: groen-getint vlak met vinkje. Gecontroleerd: oppervlak-2 met vinkje en datum. Onbevestigd: let-op-vlak met een **gestippelde** rand. Afgelast: klopt-niet-vlak met een kruis. Altijd met wie en wanneer.

### Kassabon (signature)
- Bonpapier met geperforeerde rand boven en onder (radial-gradient mask, halve cirkels van 5px om de 14px), DM Mono.
- Opbouw: logo en "SNUFFELKAART", datum en vertrek, status, een gestippelde lijn, stops (nummer · aankomsttijd · naam · ×) met rijtijd ertussen, een gestippelde lijn, het totaal (stops, rijden, **Klaar rond** groot achter een dikke lijn), een streepjescode en "Fijne zaterdag!".
- De bon print zich alleen bij het openen van het dagplan (clip-path, 700 ms), en is deelbaar als afbeelding.

### Navigation
- Op mobiel is er geen tabbalk: de kaart is het thuisscherm, en "Jij" (favorieten, account) zit achter de ronde knop naast de kop. Teruggaan gebeurt met een tekstknop met chevron links bovenin het paneel.
- Op desktop: de lijst is 400px breed links en de kaart rechts; het detail zweeft als paneel van 360px over de kaart.

## 6. Do's and Don'ts

### Do:
- **Do** toon bij elke markt de bevestigingsstatus en bij elke winkel de controledatum; openingstijden ouder dan 4 maanden krijgen een let-op-waarschuwing.
- **Do** bereken status voor het moment waarop iemand er is (aankomsttijd in het dagplan), niet alleen voor de dag.
- **Do** houd elke lijstregel bij drie dingen: type, open/dicht of datum, afstand.
- **Do** gebruik skeletons in de vorm van de echte regels; geen spinners midden in de inhoud.
- **Do** laat beweging 150–450 ms duren met `cubic-bezier(0.22, 1, 0.36, 1)`; weggaan is sneller dan binnenkomen. Respecteer `prefers-reduced-motion`.
- **Do** geef elk raakvlak minstens 44px.
- **Do** schrijf in gewoon Nederlands, in de je-vorm, kort; knoppen zeggen precies wat er gebeurt.

### Don't:
- **Don't** maak het **rommelig en vol**: te veel info per regel, banners, geen hiërarchie.
- **Don't** maak het **traag**: spinners bij elke filterklik, een haperende kaart.
- **Don't** maak het **gedateerd**: standaard Google-pins, grijze lijsten.
- **Don't** maak het **onbetrouwbaar**: onduidelijk hoe oud of zeker informatie is.
- **Don't** gebruik het **duurzaamheidsgroen-cliché**, **stoffige rommelmarkt-nostalgie** of een **SaaS-dashboard-uitstraling**.
- **Don't** gebruik groen voor iets anders dan open of bevestigd.
- **Don't** laat type of status alleen via kleur zien.
- **Don't** gebruik DM Mono of de bonvormgeving buiten het dagplan; het karakter werkt omdat het op één plek zit.
- **Don't** gebruik korrel, verloopvlakken, glaseffecten of decoratieve laadanimaties; ze kosten leesbaarheid in fel licht en snelheid.
- **Don't** gebruik gekleurde zijstrepen (`border-left` > 1px) op regels, kaartjes of meldingen.
- **Don't** open een modal waar een paneelweergave volstaat; ook inloggen en melden gebeuren in de sheet.
- **Don't** gebruik em-dashes in teksten.
