#!/usr/bin/env bash
# Parcours complet du BPMN, à travers les 8 services, via la gateway :
# réservation → paiement Papi → check-in → restaurant imputé à la chambre → check-out
# → ménage (articles) → chambre PROPRE + stock → solde encaissé + clôture → comptabilité.
# Prérequis : tous les services + faux Papi lancés ; un ADMIN (0340000001).
# Usage : ADMIN_MOT_DE_PASSE='…' bash scripts/scenario-complet.sh
set -u
: "${ADMIN_MOT_DE_PASSE:?}"
API=${API:-http://localhost:3000/api}
JSON='Content-Type: application/json'
S=$(openssl rand -hex 3); MDP="Mdp-$S-2026"
TEL() { node -e 'console.log("034" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0"))'; }
lire() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{let v=JSON.parse(d);for(const k of process.argv[1].split("."))v=v?.[k];console.log(typeof v==="object"?JSON.stringify(v):v)})' "$1"; }
jour() { node -e 'const d=new Date(new Intl.DateTimeFormat("en-CA",{timeZone:"Indian/Antananarivo"}).format(new Date())+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+Number(process.argv[1]));console.log(d.toISOString().slice(0,10))' "$1"; }
connexion() { curl -s -X POST $API/auth/connexion -H "$JSON" -d "{\"identifiant\":\"$1\",\"motDePasse\":\"$2\"}" | lire jetonAcces; }
compte() { # role → jeton
  local tel; tel=$(TEL)
  curl -s -o /dev/null -X POST $API/auth/utilisateurs -H "$JSON" -H "Authorization: Bearer $ADMIN" \
    -d "{\"nom\":\"$1 $S\",\"telephone\":\"$tel\",\"email\":\"$1-$S@hotel.mg\",\"motDePasse\":\"$MDP\",\"role\":\"$1\"}"
  connexion "$tel" "$MDP"
}
attendre() { sleep "${1:-4}"; }

ADMIN=$(connexion 0340000001 "$ADMIN_MOT_DE_PASSE"); [ -z "$ADMIN" ] || [ "$ADMIN" = undefined ] && { echo "ADMIN refusé" >&2; exit 1; }
RECEP=$(compte RECEPTIONNISTE); MENAGE=$(compte FEMME_MENAGE); RESTO=$(compte RESTAURANT); COMPTA=$(compte COMPTABLE)
TC=$(TEL); curl -s -o /dev/null -X POST $API/auth/inscription -H "$JSON" -d "{\"nom\":\"Rabe Hery\",\"telephone\":\"$TC\",\"email\":\"rabe-$S@mail.mg\",\"motDePasse\":\"$MDP\"}"
CLIENT=$(connexion "$TC" "$MDP")

echo "== Préparation : catégorie + chambre, articles (stock), carte (restaurant)"
curl -s -o /dev/null -X POST $API/categories -H "$JSON" -H "Authorization: Bearer $ADMIN" -d '{"code":"STANDARD","libelle":{"fr":"Standard"},"capacite":2,"tarifNuit":85000}'
CAT=$(curl -s $API/categories | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).find(c=>c.code==="STANDARD").id))')
curl -s -o /dev/null -X POST $API/chambres -H "$JSON" -H "Authorization: Bearer $ADMIN" -d "{\"numero\":\"C$S\",\"etage\":1,\"categorieId\":\"$CAT\"}"
for code in GEL_DOUCHE PAPIER_HYGIENIQUE PANTOUFLE BROSSE_A_DENTS; do
  curl -s -o /dev/null -X POST $API/articles -H "$JSON" -H "Authorization: Bearer $ADMIN" -d "{\"code\":\"$code\",\"libelle\":{\"fr\":\"$code\"},\"seuilAlerte\":5}"
done
ARTICLES=$(curl -s $API/articles -H "Authorization: Bearer $ADMIN")
for id in $(echo "$ARTICLES" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>JSON.parse(d).forEach(a=>console.log(a.id)))'); do
  curl -s -o /dev/null -X POST $API/articles/$id/mouvements -H "$JSON" -H "Authorization: Bearer $ADMIN" -d '{"type":"ENTREE","motif":"APPROVISIONNEMENT","quantite":50}'
done
gel() { curl -s $API/articles -H "Authorization: Bearer $ADMIN" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).find(a=>a.code==="GEL_DOUCHE").quantite))'; }
GEL_AVANT=$(gel)
MENU=$(curl -s -X POST $API/menus -H "$JSON" -H "Authorization: Bearer $RESTO" -d '{"nom":{"fr":"Carte du soir"}}' | lire id)
PLAT=$(curl -s -X POST $API/menus/$MENU/plats -H "$JSON" -H "Authorization: Bearer $RESTO" -d '{"nom":{"fr":"Romazava"},"categorie":"PLAT","prix":22000}' | lire id)
echo "stock gel douche : $GEL_AVANT"

echo "== 1. Réservation (2 nuits) et paiement Papi"
RID=$(curl -s -X POST $API/reservations -H "$JSON" -H "Authorization: Bearer $CLIENT" \
  -d "{\"categorieId\":\"$CAT\",\"clientNom\":\"Rabe Hery\",\"clientTelephone\":\"$TC\",\"clientEmail\":\"rabe-$S@mail.mg\",\"pieceIdentiteType\":\"CIN\",\"pieceIdentiteNumero\":\"101201304405\",\"dateArrivee\":\"$(jour 0)\",\"dateDepart\":\"$(jour 2)\"}" | lire id)
URL=$(curl -s -X POST $API/paiements -H "$JSON" -H "Authorization: Bearer $CLIENT" -d "{\"reservationId\":\"$RID\"}" | lire url)
curl -s -o /dev/null -X POST "$URL" -d "issue=SUCCESS&methode=MVOLA"; attendre
echo "réservation : $(curl -s $API/reservations/$RID -H "Authorization: Bearer $CLIENT" | lire statut)"

echo "== 2. Check-in, repas imputé à la chambre"
CH=$(curl -s -X POST $API/reservations/$RID/check-in -H "$JSON" -H "Authorization: Bearer $RECEP" -d '{"pieceIdentiteVerifiee":true}' | lire chambre.numero)
echo "check-in chambre $CH"
CMD=$(curl -s -X POST $API/commandes -H "$JSON" -H "Authorization: Bearer $RESTO" -d "{\"canal\":\"SUR_PLACE\",\"lignes\":[{\"platId\":\"$PLAT\",\"quantite\":2}]}" | lire id)
echo "imputation : $(curl -s -X POST $API/commandes/$CMD/imputer -H "$JSON" -H "Authorization: Bearer $RESTO" -d "{\"chambreNumero\":\"$CH\"}" | lire statutPaiement)"
attendre
FACT=$(curl -s "$API/factures?reservationId=$RID" -H "Authorization: Bearer $RECEP")
FID=$(echo "$FACT" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d)[0].id))')
echo "facture : $(echo "$FACT" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const f=JSON.parse(d)[0];console.log(f.statut, f.montantPaye+"/"+f.montantTotal+" Ar", f.lignes.map(l=>l.origine).join("+"))})')"

echo "== 3. Check-out → tâche DEPART → la femme de ménage termine"
curl -s -o /dev/null -w "check-out → %{http_code}\n" -X POST $API/reservations/$RID/check-out -H "Authorization: Bearer $RECEP"
attendre
TACHE=$(curl -s "$API/taches?date=$(jour 0)" -H "Authorization: Bearer $MENAGE" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const t=JSON.parse(d).find(t=>t.chambreNumero===process.argv[1]&&t.type==="DEPART");console.log(t?t.id:"")})' "$CH")
echo "tâche DEPART : ${TACHE:-ABSENTE}"
curl -s -o /dev/null -w "démarrer → %{http_code}\n" -X POST $API/taches/$TACHE/demarrer -H "Authorization: Bearer $MENAGE"
curl -s -o /dev/null -w "terminer → %{http_code}\n" -X POST $API/taches/$TACHE/terminer -H "$JSON" -H "Authorization: Bearer $MENAGE" \
  -d '{"articles":[{"code":"GEL_DOUCHE","quantite":1},{"code":"PAPIER_HYGIENIQUE","quantite":1},{"code":"PANTOUFLE","quantite":1},{"code":"BROSSE_A_DENTS","quantite":1}]}'
attendre
echo "chambre $CH : $(curl -s "$API/chambres" -H "Authorization: Bearer $RECEP" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).find(c=>c.numero===process.argv[1]).etatMenage))' "$CH") · gel douche : $GEL_AVANT → $(gel)"

echo "== 4. Solde (repas) encaissé en espèces, clôture, comptabilité"
RESTE=$(curl -s $API/factures/$FID -H "Authorization: Bearer $RECEP" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const f=JSON.parse(d);console.log(f.montantTotal-f.montantPaye)})')
echo "reste à payer : $RESTE Ar"
curl -s -o /dev/null -w "encaissement espèces → %{http_code}\n" -X POST $API/factures/$FID/encaissements -H "$JSON" -H "Authorization: Bearer $RECEP" -d "{\"montant\":$RESTE}"
echo "clôture : $(curl -s -X POST $API/factures/$FID/cloturer -H "Authorization: Bearer $RECEP" | lire statut)"
attendre
echo "reversement au restaurant : $(curl -s "$API/comptabilite/reversements?statut=A_REVERSER" -H "Authorization: Bearer $COMPTA" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d).find(r=>r.factureId===process.argv[1]);console.log(r?r.montant+" Ar":"ABSENT")})' "$FID")"
echo "tableau du jour : $(curl -s -X POST $API/comptabilite/tableaux/generer -H "$JSON" -H "Authorization: Bearer $COMPTA" -d '{}' | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const t=JSON.parse(d);console.log("factures",t.nombreFactures,"· CA hébergement",t.caHebergement,"· CA restaurant",t.caRestaurant,"· écart",t.ecartDetecte)})')"
