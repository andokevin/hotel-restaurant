#!/usr/bin/env bash
# Scénario de bout en bout de la phase 4 : réservation → paiement Papi → confirmation → séjour → clôture.
# Prérequis : postgres + redis, `pnpm dev` (gateway, auth, hebergement, facturation),
#   le faux Papi (`pnpm --filter @hotel/facturation faux-papi`) et dans services/facturation/.env :
#   PAPI_BASE_URL=http://localhost:4010 et PUBLIC_URL=http://localhost:3000.
# Usage : ADMIN_MOT_DE_PASSE='…' bash scripts/scenario-phase4.sh
# Variables facultatives : HEBERGEMENT_DB, FACTURATION_DB, BULLMQ_PREFIXE (défauts : bases et préfixe de dev).
set -u
: "${ADMIN_MOT_DE_PASSE:?Définis ADMIN_MOT_DE_PASSE}"
API=http://localhost:3000/api
JSON='Content-Type: application/json'
PREFIXE=${BULLMQ_PREFIXE:-hotel}
FDB=${FACTURATION_DB:-facturation_db}
SQLF() { docker compose exec -T postgres psql -U hotel -d "$FDB" -tAc "$1"; }
REDIS() { docker compose exec -T redis redis-cli "$@"; }
champ() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{let v=JSON.parse(d);for(const k of process.argv[1].split("."))v=v?.[k];console.log(typeof v==="object"?JSON.stringify(v):v)})' "$1"; }
TEL() { node -e 'console.log("034" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0"))'; }
jour() { node -e 'const d=new Date(new Intl.DateTimeFormat("en-CA",{timeZone:"Indian/Antananarivo"}).format(new Date())+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+Number(process.argv[1]));console.log(d.toISOString().slice(0,10))' "$1"; }
attendre() { sleep "${1:-4}"; } # relais outbox (2 s) + traitement des workers
S=$(openssl rand -hex 3); MDP="Mdp-$S-2026"; TC=$(TEL); TR=$(TEL)

echo "== 0. Préparation"
ADMIN=$(curl -s -X POST $API/auth/connexion -H "$JSON" -d "{\"identifiant\":\"direction@hotel.mg\",\"motDePasse\":\"$ADMIN_MOT_DE_PASSE\"}" | champ jetonAcces)
[ "$ADMIN" = "undefined" ] && { echo "Connexion ADMIN refusée" >&2; exit 1; }
curl -s -o /dev/null -X POST $API/categories -H "$JSON" -H "Authorization: Bearer $ADMIN" \
  -d '{"code":"SUITE_PRESTIGE","libelle":{"fr":"Suite Prestige"},"capacite":2,"tarifNuit":250000}'
CAT=$(curl -s $API/categories | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).find(c=>c.code==="SUITE_PRESTIGE").id))')
curl -s -o /dev/null -X POST $API/chambres -H "$JSON" -H "Authorization: Bearer $ADMIN" -d "{\"numero\":\"P$S\",\"etage\":5,\"categorieId\":\"$CAT\"}"
curl -s -o /dev/null -X POST $API/auth/utilisateurs -H "$JSON" -H "Authorization: Bearer $ADMIN" \
  -d "{\"nom\":\"Soa\",\"telephone\":\"$TR\",\"email\":\"recep-$S@hotel.mg\",\"motDePasse\":\"$MDP\",\"role\":\"RECEPTIONNISTE\"}"
RECEP=$(curl -s -X POST $API/auth/connexion -H "$JSON" -d "{\"identifiant\":\"$TR\",\"motDePasse\":\"$MDP\"}" | champ jetonAcces)
curl -s -o /dev/null -X POST $API/auth/inscription -H "$JSON" -d "{\"nom\":\"Rabe Hery\",\"telephone\":\"$TC\",\"email\":\"client-$S@mail.mg\",\"motDePasse\":\"$MDP\"}"
CLIENT=$(curl -s -X POST $API/auth/connexion -H "$JSON" -d "{\"identifiant\":\"$TC\",\"motDePasse\":\"$MDP\"}" | champ jetonAcces)

echo "== 1. Le client réserve (2 nuits en Suite Prestige)"
R=$(curl -s -X POST $API/reservations -H "$JSON" -H "Authorization: Bearer $CLIENT" \
  -d "{\"categorieId\":\"$CAT\",\"clientNom\":\"Rabe Hery\",\"clientTelephone\":\"$TC\",\"clientEmail\":\"client-$S@mail.mg\",\"pieceIdentiteType\":\"CIN\",\"pieceIdentiteNumero\":\"101201304405\",\"dateArrivee\":\"$(jour 0)\",\"dateDepart\":\"$(jour 2)\"}")
RID=$(echo "$R" | champ id)
echo "$(echo "$R" | champ reference) · $(echo "$R" | champ statut) · $(echo "$R" | champ montantTotal) Ar"

echo "== 2. Il demande à payer (le montant vient du serveur)"
curl -s -w "  → %{http_code}  (montant envoyé par le navigateur)\n" -X POST $API/paiements -H "$JSON" -H "Authorization: Bearer $CLIENT" -d "{\"reservationId\":\"$RID\",\"montant\":1}"
L=$(curl -s -X POST $API/paiements -H "$JSON" -H "Authorization: Bearer $CLIENT" -d "{\"reservationId\":\"$RID\"}")
PID=$(echo "$L" | champ paiementId); URL=$(echo "$L" | champ url)
echo "lien Papi : $URL · montant $(echo "$L" | champ montant) Ar"
echo "facture : $(SQLF "SELECT numero || ' ' || statut || ' ' || montant_total FROM facture WHERE reservation_id = '$RID'")"

echo "== 3. Un attaquant forge une notification « payé »"
curl -s -w "  → %{http_code}\n" -X POST "$API/paiements/notification?paiement=$PID&jeton=$(openssl rand -hex 22)" -H "$JSON" \
  -d "{\"paymentStatus\":\"SUCCESS\",\"amount\":$(echo "$L" | champ montant)}"

echo "== 4. Le client paie sur la page Papi (MVola)"
curl -s -o /dev/null -w "page Papi → redirection %{http_code} vers %{redirect_url}\n" -X POST "$URL" -d "issue=SUCCESS&methode=MVOLA"
attendre
echo "paiement : $(curl -s $API/paiements/$PID -H "Authorization: Bearer $CLIENT" | champ statut) ($(curl -s $API/paiements/$PID -H "Authorization: Bearer $CLIENT" | champ methode))"
echo "facture : $(curl -s $API/factures/mes-factures -H "Authorization: Bearer $CLIENT" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const f=JSON.parse(d)[0];console.log(f.numero,f.statut,f.montantPaye+"/"+f.montantTotal+" Ar")})')"
echo "réservation (confirmée par l'événement paiement.recu) : $(curl -s $API/reservations/$RID -H "Authorization: Bearer $CLIENT" | champ statut)"

echo "== 5. Séjour : check-in, check-out"
curl -s -o /dev/null -w "check-in → %{http_code}\n" -X POST $API/reservations/$RID/check-in -H "$JSON" -H "Authorization: Bearer $RECEP" -d '{"pieceIdentiteVerifiee":true}'
curl -s -o /dev/null -w "check-out → %{http_code}\n" -X POST $API/reservations/$RID/check-out -H "Authorization: Bearer $RECEP"
attendre
echo "facture après le départ (sejour.termine) : $(SQLF "SELECT statut || ' le ' || to_char(cloturee_le, 'DD/MM HH24:MI') FROM facture WHERE reservation_id = '$RID'")"
FID=$(SQLF "SELECT id FROM outbox_evenement WHERE type = 'facture.cloturee' AND payload->>'reservationId' = '$RID'")
echo "copie pour le comptable : $(SQLF "SELECT CASE WHEN publie_le IS NULL THEN 'en attente' ELSE 'publiée' END FROM outbox_evenement WHERE id = '$FID'") · dans la file comptabilite : $(REDIS EXISTS "$PREFIXE:evt.comptabilite.facture.cloturee:$FID")"
