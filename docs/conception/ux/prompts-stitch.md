# Prompts Stitch — refonte des écrans (v1.1)

## Mode d'emploi

1. Dans Stitch, créer **un seul projet** « Hôtel & Restaurant Tana », pour que tous les écrans partagent le même style.
2. Coller d'abord le **prompt 0 (système de design)**, puis **un prompt par écran**, dans l'ordre.
3. Choisir **Mobile** ou **Web** selon l'indication `[Mobile]` / `[Web]` / `[Tablette]` de chaque prompt.
4. Si un résultat ne convient pas, corriger par petites demandes (« make the primary button terracotta », « bigger touch targets »…) plutôt que de tout régénérer.
5. Exporter chaque écran : capture PNG **et** code HTML/Tailwind si Stitch le propose. Les déposer dans
   `docs/conception/ux/maquettes/` en les nommant comme le prompt (ex. `04-reception-reservations.png`).

Les prompts sont en **anglais**, car Stitch comprend mieux les consignes en anglais.
Les **textes affichés** à l'écran sont en **français**, entre guillemets : Stitch doit les reprendre tels quels.

---

## 0. Système de design (à coller en premier)

```
Design system for "Hôtel & Restaurant", a mid-range hotel with a restaurant in Antananarivo, Madagascar.
All UI text in FRENCH. Currency: Malagasy Ariary written "85 000 Ar" (space as thousands separator, " Ar" suffix).
Dates "15/10/2026", times "14:30".

Mood: warm, calm, trustworthy, local — not luxury-flashy, not generic SaaS. Think sunlit sand, red earth of Madagascar, deep green.
Colors:
- Primary emerald #047857 (hover #065F46), dark header emerald #064E3B
- Accent terracotta #C2410C (hover #9A3412) — only for the ONE main call-to-action per screen
- Background warm sand #FBF8F2, cards white with sand border #EBDFC8, secondary surface #F5EEE1
- Text slate #1E293B, muted #64748B
- Status colors: amber (waiting), sky blue (confirmed), indigo (in progress), emerald (done/paid/clean), red (cancelled/dirty/error)
Typography: serif headings (Georgia-like, e.g. "Fraunces" or "Lora"), clean sans-serif body ("Inter").
Shape: rounded-lg buttons and inputs (8px), rounded-xl cards (12px), soft shadows.
Touch targets at least 44px high. Status badges = small colored pill with a dot + text (never color alone).
Accessibility: WCAG AA contrast, visible focus rings, labels above inputs, error messages under the field in red.
Logo: a terracotta rounded square with a white serif "H", next to "Hôtel & Restaurant" and small "Antananarivo".
```

---

## Partie publique

### 01 — Accueil `[Mobile]` puis `[Web]`
```
Home page of the hotel, same design system. Mobile first (360px), then desktop version.
- Sticky dark emerald header: logo, on mobile a "☰ Menu" button; on desktop links "Connexion" and a terracotta button "Créer un compte".
- Hero on emerald background with subtle terracotta and sand circles: small overline "ANTANANARIVO · MADAGASCAR",
  big serif title "Un séjour calme au cœur de Tana", text "Réservez votre chambre en ligne en 2 minutes et payez en toute sécurité par Mobile Money avec Papi.",
  terracotta button "Réserver une chambre" and outline button "Créer un compte".
- 3 numbered steps in cards: "Choisissez vos dates", "Payez par Mobile Money" (MVola, Orange Money, Airtel Money), "Recevez votre référence".
- Section "Nos chambres": 3 room cards (Chambre standard 85 000 Ar / nuit, 2 personnes; Chambre double 120 000 Ar / nuit; Suite senior 250 000 Ar / nuit, 4 personnes),
  each with a photo placeholder, short description, capacity icon, price and a "Réserver" button.
- Section "Le restaurant": menu card "Menu du jour" grouped Entrée / Plat / Dessert / Boisson with Malagasy dishes
  (Romazava 18 000 Ar, Ravitoto sy henakisoa 22 000 Ar, Mofo gasy 3 000 Ar, THB 6 000 Ar); one dish shown as unavailable (struck through, "Épuisé").
- Footer on sand: address, "Paiement sécurisé Mobile Money avec Papi", phone number.
```

### 02 — Connexion `[Mobile]`
```
Login screen, same design system, mobile 360px. Centered white card on sand background with the logo above.
Title "Connexion", subtitle "Avec votre téléphone ou votre email".
Fields: "Téléphone ou email" (placeholder "034 12 345 67"), "Mot de passe" with a show/hide eye icon.
Full-width emerald button "Se connecter". Link "Pas encore de compte ? Créer un compte".
Also show the error state: red alert "Identifiant ou mot de passe incorrect." above the button,
and the lockout state "Trop de tentatives. Réessayez dans 15 minutes."
```

### 03 — Inscription `[Mobile]`
```
Sign-up screen, same design system, mobile 360px. Title "Créer un compte".
Fields with labels above: "Nom complet", "Téléphone" (help text "Numéro malgache, ex. 034 12 345 67"), "Email",
"Mot de passe" (help text "10 caractères minimum" with a live strength bar), "Langue" segmented control "Français / Malagasy / English".
Full-width emerald button "Créer mon compte". Show one field in error state: "Numéro de téléphone invalide" under the phone field.
```

## Espace client

### 04 — Réserver `[Mobile]`
```
Booking screen for a logged-in client, same design system, mobile 360px. Header shows "Réserver / Mes réservations / Mes factures" in the menu.
Step indicator at top: "1 Dates · 2 Coordonnées · 3 Paiement" (step 1 active).
Room category selector as selectable cards (Chambre standard / Chambre double / Suite senior with price per night).
Date range: "Arrivée" and "Départ" date fields side by side, with "2 nuits" computed below.
Sticky bottom summary bar: "Estimation : 170 000 Ar" + small text "Montant exact calculé par l'hôtel" + terracotta button "Continuer".
Then show step 2 on a second frame: "Pièce d'identité" (CIN or Passeport toggle + number), name/phone prefilled, button "Réserver".
Error state example: "Aucune chambre de cette catégorie n'est disponible à ces dates" with a suggestion "Essayer d'autres dates".
```

### 05 — Réservation créée + paiement `[Mobile]`
```
Confirmation screen after booking, same design system, mobile 360px.
Big card: reference "RES-2026-000042" in monospace with copy button, "Chambre 204 · Suite senior", "15/10/2026 → 17/10/2026 · 2 nuits",
total "500 000 Ar" large. Amber countdown banner: "À payer avant 11:19 — encore 28 min" with a progress bar.
Payment methods logos row: MVola, Orange Money, Airtel Money, Carte.
Full-width terracotta button "Payer avec Papi". Secondary link "Payer plus tard à la réception".
Reassurance line with lock icon: "Paiement sécurisé. Aucun numéro de carte n'est enregistré par l'hôtel."
```

### 06 — Résultat du paiement `[Mobile]`
```
Payment result screen, same design system, mobile 360px. Three states side by side:
1) Waiting: spinner, "Nous attendons la confirmation de Papi…", "Cela prend en général moins d'une minute."
2) Success: big emerald check, "Paiement réussi", "Réservation RES-2026-000042 confirmée", amount "500 000 Ar via MVola", buttons "Voir mes réservations" and "Télécharger la facture".
3) Failure: red icon, "Paiement refusé", reason "Solde insuffisant", terracotta button "Réessayer le paiement", note "Votre chambre reste bloquée jusqu'à 11:19".
```

### 07 — Mes réservations `[Mobile]`
```
"Mes réservations" list for a client, same design system, mobile 360px.
Tabs "À venir / Passées". Each reservation is a card (not a table): reference, room category, dates, nights, total amount, status badge
(En attente de paiement amber with countdown, Confirmée blue, En cours indigo, Terminée grey, Annulée red).
Card in "En attente de paiement" has a terracotta button "Payer maintenant".
Empty state: illustration placeholder + "Vous n'avez pas encore de réservation" + button "Réserver une chambre".
```

### 08 — Mes factures `[Mobile]`
```
"Mes factures" screen, same design system, mobile 360px. List of invoice cards: number "FAC-2026-000017", date, status badge (Émise / Payée / Clôturée),
total. Expanded invoice detail: lines "Nuitée 15/10/2026 — 250 000 Ar", "Nuitée 16/10/2026 — 250 000 Ar",
"Restaurant — Romazava ×2, THB ×2 — 48 000 Ar", payments list ("MVola — 500 000 Ar — Réussi"),
and a highlighted "Reste à payer : 48 000 Ar" with a terracotta button "Payer le reste".
```

## Réception (ordinateur)

### 09 — Réservations `[Web]`
```
Receptionist dashboard "Réservations", same design system, desktop 1280px. Sticky dark emerald header with tabs
"Réservations · Nouvelle réservation · Départs du jour · Factures · Chambres · Ménage" (active tab underlined terracotta), user "Soa Randriamanana · Réceptionniste".
Page title "Réservations", subtitle "Arrivées, départs et suivi des séjours", terracotta button "+ Nouvelle réservation".
Row of 4 KPI cards: "Arrivées du jour 5", "Départs du jour 3", "Séjours en cours 12", "Taux d'occupation 72 %".
Filter pills with counts: "Toutes 48 · Arrivées du jour 5 · Départs du jour 3 · Séjours en cours 12", a search field "Rechercher : référence, client, téléphone, chambre", status dropdown.
Table: Référence (underlined link, monospace), Client (name + phone below), Séjour (dates), Chambre, Montant (right aligned), Statut (badge), Actions.
Actions per status: CONFIRMEE → emerald "Check-in" + separated red text button "Annuler"; EN_COURS → "Check-out"; others none.
Show a confirmation modal over the page: "Check-out — chambre 204", text "Jean Rakoto quitte la chambre 204…", buttons "Revenir" (outline) and "Confirmer le départ" (emerald).
```

### 10 — Nouvelle réservation (comptoir) `[Web]`
```
"Nouvelle réservation" form for the receptionist, same design system, desktop. Two columns:
left the form (Canal segmented control "Réception / Facebook / Site web", category cards, dates, client name, phone, email, ID type and number),
right a sticky summary card (category, dates, nights, estimated total, available rooms count "3 chambres disponibles").
Bottom actions: "Annuler" outline, terracotta "Créer la réservation". After creation, show a success state with
"Lien de paiement Papi" + copy button + "Encaisser en espèces" option.
```

### 11 — Check-in (fenêtre) `[Web]`
```
Check-in modal for the receptionist, same design system. Title "Check-in — RES-2026-000042".
Client summary (name, phone, ID "CIN 101 234 567 890"), stay dates, room "204 · Suite senior" with badge "Propre".
Required checkbox "J'ai vérifié la pièce d'identité du client". Emerald button "Valider le check-in".
Second state: room is dirty → amber alert "La chambre 204 n'est pas propre." and a list of clean rooms of the same category
(radio cards "205 · Propre", "301 · Propre") with button "Faire le check-in dans cette chambre".
```

### 12 — Départs du jour `[Web]`
```
"Départs du jour" screen, same design system, desktop. Cards or table rows per departing guest: room number large, guest name,
nights, invoice status ("Facture soldée" emerald or "Reste à payer 48 000 Ar" red), and actions:
"Voir la facture", "Encaisser", then "Check-out" (disabled with tooltip "Encaissez d'abord le reste" when unpaid).
Empty state: "Aucun départ prévu aujourd'hui".
```

### 13 — Factures + encaissement `[Web]`
```
Invoices screen for reception, same design system, desktop. Filter pills "Émises · Payées · Clôturées", search field.
Table: Numéro, Client, Type (Hébergement / Restaurant), Total, Payé, Reste, Statut, "Ouvrir".
Right side drawer with invoice detail: lines (nights, restaurant items marked with a fork icon), payments history, big "Reste à payer 48 000 Ar",
cash form "Encaisser en espèces" (amount input prefilled with the remainder, max = remainder), then "Clôturer la facture"
(disabled until fully paid, help text "Une copie part automatiquement à la comptabilité").
```

### 14 — Chambres `[Web]`
```
Room status board "Chambres" for reception, same design system, desktop. Grouped by floor ("1er étage", "2e étage").
Each room is a tile: number large serif, category, state badge (Propre emerald / Sale red / En nettoyage amber), current guest if occupied,
"Ménage par Hanta depuis 10:42" when cleaning. Filter pills "Toutes · Propres · Sales · En nettoyage" with counts. Legend at top.
```

## Ménage (téléphone)

### 15 — Tâches du jour `[Mobile]`
```
Housekeeping app screen "Tâches de ménage" for a cleaning staff member, same design system, mobile 360px, used with one hand.
Title, subtitle "4 chambres à faire sur 6 aujourd'hui", a progress bar.
Date navigator: "‹" button, date "15/10/2026", "›" button, "Aujourd'hui" link.
Filter pills "Toutes · À faire · En cours · Terminées".
Task cards: big serif "Chambre 204", type "Ménage de départ" (tag terracotta, shown first) or "Ménage quotidien", status badge.
In-progress card has an indigo left border, "Commencé à 10:42 par Hanta", full-width terracotta button "Terminer : chambre propre".
To-do card: full-width emerald button "Démarrer le ménage". Done cards greyed at the bottom with "Terminé à 11:20".
```

### 16 — Terminer le ménage `[Mobile]`
```
Bottom sheet "Terminer le ménage — chambre 204", same design system, mobile 360px.
Text "Articles remplacés dans la chambre". 2x2 grid of steppers (− 1 +) with icons: "Gel douche", "Papier hygiénique", "Pantoufles", "Brosse à dents".
Textarea "Remarques (facultatif)" placeholder "Ex. ampoule à changer". Full-width emerald button "Valider : chambre propre".
Success toast after: "Chambre 204 propre — la réception est prévenue".
```

## Restaurant (tablette)

### 17 — Prise de commande `[Tablette]`
```
Restaurant order-taking screen for a waiter, same design system, tablet landscape 1024px.
Left 2/3: category tabs "Entrées · Plats · Desserts · Boissons", grid of dish tiles (photo placeholder, name, price, "+ Ajouter" with a quantity badge when in cart),
unavailable dish shown as "Épuisé".
Right 1/3 sticky cart "Panier (3)": lines with − qty + steppers (40px), "Sur place / À emporter" toggle, "Table n°" input, "Nom du client (facultatif)",
"Total estimé : 48 000 Ar", full-width terracotta button "Envoyer en cuisine".
Success banner: "Commande CMD-2026-000108 envoyée — 48 000 Ar · Voir le suivi".
```

### 18 — Suivi des commandes `[Tablette]`
```
Kitchen/service order tracking board "Suivi des commandes", same design system, tablet landscape.
Kanban columns: "Reçues", "En préparation", "Prêtes", "Remises". Order cards: reference, "Table 5 · Sur place", elapsed time "il y a 12 min" (turns amber after 15 min),
dish list with quantities, total, payment badge (Non payée red / Imputée à la chambre indigo / Payée emerald).
Main action on each card moves it to the next column ("Lancer la préparation", "Marquer prête", "Marquer remise").
Secondary actions: "Imputer à une chambre" (inline input "N° chambre"), "Facturer et encaisser", and a discreet red "Annuler".
Small indicator "Mise à jour automatique".
```

### 19 — Menus et plats `[Web]`
```
Menu management screen "Menus et plats", same design system, desktop. Left list of menus ("Menu du jour", "Carte des boissons") with "Publié" badge,
button "Créer un menu". Right: dishes of the selected menu in a table (name, category, price, prep time, availability toggle "Disponible / Épuisé",
action "Changer le prix"). Drawer form "+ Ajouter un plat": name, category select, price in Ar, preparation time in minutes, description.
```

## Communication

### 20 — Menus et tarifs `[Web]`
```
Communication screen "Menus et tarifs", same design system, desktop. Cards per menu with "Publier / Dépublier" switch and preview of how it looks on the website.
Button "Texte Facebook" opens a panel with a ready-to-post text (emojis, dishes and prices in Ar) and a "Copier" button with "Copié !" feedback.
Section "Grille tarifaire des chambres" as a clean table (catégorie, capacité, tarif / nuit).
```

## Comptabilité

### 21 — Tableaux journaliers `[Web]`
```
Accounting daily dashboard "Tableaux journaliers", same design system, desktop. Date picker + button "Générer" + note "Généré automatiquement chaque soir à 23 h".
KPI cards: "Nuitées vendues 18", "CA hébergement 2 340 000 Ar", "CA restaurant 412 000 Ar", "Factures clôturées 9".
Bar chart "Nuitées par canal" (Site web, Réception, Facebook). Table "Contrôle du stock": article, consommation attendue, consommation réelle, écart
(non-zero gap highlighted red with "À signaler à la direction").
```

### 22 — Reversements `[Web]`
```
"Reversements" screen, same design system, desktop. Explanation banner: "Repas ajoutés aux factures de chambre : encaissés par l'hôtel, à reverser au restaurant."
Summary "Total à reverser : 186 000 Ar". Table: facture, date, montant, statut badge (À reverser amber / Reversé emerald), action "Marquer reversé"
with a confirmation modal.
```

### 23 — Copies de factures `[Web]`
```
"Copies de factures" screen, same design system, desktop. Date filter by closing day. Table: numéro, client, date de clôture,
part hébergement, part restaurant, total. Totals row at the bottom. Read-only look (archive), with an "Exporter" secondary button.
```

### 24 — Stock `[Web]`
```
Inventory screen "Stock", same design system, desktop. Table of articles: libellé, quantité, seuil d'alerte, consommation par nuitée,
low-stock rows highlighted red with badge "Stock bas". Actions per row: "Mouvement" and "Historique".
Modal "Mouvement de stock": type segmented control "Entrée / Sortie / Ajustement", quantité, motif. Drawer "Historique" listing movements
with date, type, quantity (+/−), and source ("Ménage chambre 204").
```

## Administration

### 25 — Comptes `[Web]`
```
Admin screen "Comptes du personnel", same design system, desktop. Table: nom, téléphone, email, rôle badge, état (Actif / Désactivé),
actions "Désactiver / Réactiver" (with confirmation). Button "Créer un compte" opens a form drawer: nom, téléphone, email, mot de passe, rôle select
(Réceptionniste, Femme de ménage, Restaurant, Comptable, Communication, Administrateur).
```

### 26 — Catégories, chambres, articles `[Web]`
```
Three admin CRUD screens in the same design system, desktop: "Catégories" (code, libellé, capacité, tarif / nuit, nombre de chambres),
"Chambres" (numéro, étage, catégorie, état), "Articles" (code, libellé, seuil d'alerte, consommation par nuitée).
Same pattern for each: page title + "Créer" button, clean table, side drawer form with validation errors under fields, empty state with call to action.
```
