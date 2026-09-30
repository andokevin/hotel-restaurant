#!/usr/bin/env bash
# Scénario de bout en bout de la phase 3, via la gateway, en regardant aussi dans PostgreSQL et Redis.
# Prérequis : postgres + redis lancés, `pnpm dev` (gateway, auth, hebergement) dans un autre terminal,
# un compte ADMIN (voir scenario-phase2.sh).
# Usage :
#   ADMIN_MOT_DE_PASSE='…' bash scripts/scenario-phase3.sh
# Variables facultatives : HEBERGEMENT_DB (défaut hebergement_db), BULLMQ_PREFIXE (défaut hotel).
set -u
: "${ADMIN_MOT_DE_PASSE:?Définis ADMIN_MOT_DE_PASSE}"
API=http://localhost:3000/api
JSON='Content-Type: application/json'
DB=${HEBERGEMENT_DB:-hebergement_db}
PREFIXE=${BULLMQ_PREFIXE:-hotel}
CLE_INTERNE=$(grep '^CLE_INTERNE=' services/hebergement/.env | cut -d= -f2-)
SQL() { docker compose exec -T postgres psql -U hotel -d "$DB" -tAc "$1"; }
REDIS() { docker compose exec -T redis redis-cli "$@"; }
TEL() { node -e 'console.log("034" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0"))'; }
champ() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const v=JSON.parse(d)[process.argv[1]];console.log(typeof v==="object"?JSON.stringify(v):v)})' "$1"; }
jour() { node -e 'const d=new Date(new Intl.DateTimeFormat("en-CA",{timeZone:"Indian/Antananarivo"}).format(new Date())+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+Number(process.argv[1]));console.log(d.toISOString().slice(0,10))' "$1"; }
SUFFIXE=$(openssl rand -hex 4)

echo "== 0. Préparation : ADMIN, une catégorie de 2 chambres, une réceptionniste, un client"
ADMIN=$(curl -s -X POST $API/auth/connexion -H "$JSON" -d "{\"identifiant\":\"direction@hotel.mg\",\"motDePasse\":\"$ADMIN_MOT_DE_PASSE\"}" | champ jetonAcces)
[ "$ADMIN" = "undefined" ] && { echo "Connexion ADMIN refusée" >&2; exit 1; }
curl -s -o /dev/null -X POST $API/categories -H "$JSON" -H "Authorization: Bearer $ADMIN" \
  -d '{"code":"SUITE_SENIOR","libelle":{"fr":"Suite Senior","mg":"Efitra Senior"},"capacite":2,"tarifNuit":150000}'
CAT=$(curl -s $API/categories | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).find(c=>c.code==="SUITE_SENIOR").id))')
for n in 1 2; do
  curl -s -o /dev/null -X POST $API/chambres -H "$JSON" -H "Authorization: Bearer $ADMIN" \
    -d "{\"numero\":\"S$SUFFIXE$n\",\"etage\":4,\"categorieId\":\"$CAT\"}"
done
MDP="Mdp-$SUFFIXE-2026"
TEL_RECEP=$(TEL); TEL_CLIENT=$(TEL)
curl -s -o /dev/null -X POST $API/auth/utilisateurs -H "$JSON" -H "Authorization: Bearer $ADMIN" \
  -d "{\"nom\":\"Soa\",\"telephone\":\"$TEL_RECEP\",\"email\":\"recep-$SUFFIXE@hotel.mg\",\"motDePasse\":\"$MDP\",\"role\":\"RECEPTIONNISTE\"}"
RECEP=$(curl -s -X POST $API/auth/connexion -H "$JSON" -d "{\"identifiant\":\"$TEL_RECEP\",\"motDePasse\":\"$MDP\"}" | champ jetonAcces)
curl -s -o /dev/null -X POST $API/auth/inscription -H "$JSON" -d "{\"nom\":\"Rabe Hery\",\"telephone\":\"$TEL_CLIENT\",\"email\":\"client-$SUFFIXE@mail.mg\",\"motDePasse\":\"$MDP\"}"
CLIENT=$(curl -s -X POST $API/auth/connexion -H "$JSON" -d "{\"identifiant\":\"$TEL_CLIENT\",\"motDePasse\":\"$MDP\"}" | champ jetonAcces)
echo "catégorie SUITE_SENIOR : $CAT"

echo "== 1. Le CLIENT réserve la CATÉGORIE (le serveur choisit la chambre), avec une Idempotency-Key"
CLE=$(node -e 'console.log(crypto.randomUUID())')
DEMANDE="{\"categorieId\":\"$CAT\",\"clientNom\":\"Rabe Hery\",\"clientTelephone\":\"0331234567\",\"clientEmail\":\"client-$SUFFIXE@mail.mg\",\"pieceIdentiteType\":\"CIN\",\"pieceIdentiteNumero\":\"101201304405\",\"dateArrivee\":\"$(jour 0)\",\"dateDepart\":\"$(jour 2)\"}"
R1=$(curl -s -X POST $API/reservations -H "$JSON" -H "Authorization: Bearer $CLIENT" -H "Idempotency-Key: $CLE" -d "$DEMANDE")
ID=$(echo "$R1" | champ id)
echo "réservation $(echo "$R1" | champ reference), chambre choisie : $(echo "$R1" | champ chambre | champ numero), statut $(echo "$R1" | champ statut), canal $(echo "$R1" | champ canal)"
echo "-- double clic (même Idempotency-Key) :"
curl -s -D - -o /tmp/r2-hotel.json -X POST $API/reservations -H "$JSON" -H "Authorization: Bearer $CLIENT" -H "Idempotency-Key: $CLE" -d "$DEMANDE" | grep -i "idempotent-replayed"
echo "même id ? $( [ "$(champ id < /tmp/r2-hotel.json)" = "$ID" ] && echo oui || echo NON)   réservations de ce client en base : $(SQL "SELECT count(*) FROM reservation WHERE client_id = '$(curl -s $API/auth/moi -H "Authorization: Bearer $CLIENT" | champ id)'")"
rm -f /tmp/r2-hotel.json

echo "== 2. Outbox : l'événement reservation.creee, puis le relais (toutes les 2 s)"
SQL "SELECT type, CASE WHEN publie_le IS NULL THEN 'en attente' ELSE 'publié' END FROM outbox_evenement WHERE payload->>'reservationId' = '$ID'"
sleep 3
SQL "SELECT type, CASE WHEN publie_le IS NULL THEN 'en attente' ELSE 'publié' END FROM outbox_evenement WHERE payload->>'reservationId' = '$ID'"
echo "job dans la file de facturation : $(REDIS EXISTS "$PREFIXE:evt.facturation.reservation.creee:$(SQL "SELECT id FROM outbox_evenement WHERE type='reservation.creee' AND payload->>'reservationId'='$ID'")")"

echo "== 3. Expiration : un job différé de 30 min existe…"
echo "job expiration-$ID présent : $(REDIS EXISTS "$PREFIXE:hebergement.expirations:expiration-$ID")"
echo "-- paiement reçu (confirmation interne, comme le fera facturation)"
curl -s -o /dev/null -w "confirmer → %{http_code}\n" -X POST "http://localhost:3001/interne/reservations/$ID/confirmer" -H "x-cle-interne: $CLE_INTERNE"
echo "…et il a disparu après le paiement : $(REDIS EXISTS "$PREFIXE:hebergement.expirations:expiration-$ID")"

echo "== 4. Le client ne voit que ses réservations ; la réception fait le check-in"
curl -s -o /dev/null -w "CLIENT GET /reservations/departs → %{http_code}\n" $API/reservations/departs -H "Authorization: Bearer $CLIENT"
curl -s -o /dev/null -w "CLIENT GET /reservations/mes-reservations → %{http_code}\n" $API/reservations/mes-reservations -H "Authorization: Bearer $CLIENT"
curl -s -w "  → %{http_code}\n" -X POST $API/reservations/$ID/check-in -H "$JSON" -H "Authorization: Bearer $RECEP" -d '{}'
CODE=$(curl -s -o /tmp/checkin-hotel.json -w "%{http_code}" -X POST $API/reservations/$ID/check-in -H "$JSON" -H "Authorization: Bearer $RECEP" -d '{"pieceIdentiteVerifiee":true}')
echo "check-in (pièce vérifiée) → $CODE $( [ "$CODE" != 200 ] && champ message < /tmp/checkin-hotel.json)"
if [ "$CODE" = 422 ]; then
  # Règle du sujet : seules les chambres PROPRES sont attribuées. La réceptionniste réattribue
  # une chambre PROPRE de la même catégorie (la contrainte EXCLUDE refuse celles déjà occupées).
  for CH in $(curl -s "$API/chambres?etatMenage=PROPRE" -H "Authorization: Bearer $RECEP" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>JSON.parse(d).filter(c=>c.categorieId===process.argv[1]).forEach(c=>console.log(c.id)))' "$CAT"); do
    CODE=$(curl -s -o /tmp/checkin-hotel.json -w "%{http_code}" -X POST $API/reservations/$ID/check-in -H "$JSON" -H "Authorization: Bearer $RECEP" -d "{\"pieceIdentiteVerifiee\":true,\"chambreId\":\"$CH\"}")
    echo "  réattribution vers une chambre PROPRE → $CODE"
    [ "$CODE" = 200 ] && break
  done
fi
rm -f /tmp/checkin-hotel.json

echo "== 5. Check-out : chambre SALE, sejour.termine publié pour menage ET facturation"
curl -s -o /dev/null -w "check-out → %{http_code}\n" -X POST $API/reservations/$ID/check-out -H "Authorization: Bearer $RECEP"
echo "chambre : $(SQL "SELECT c.numero || ' ' || c.etat_menage FROM reservation r JOIN chambre c ON c.id = r.chambre_id WHERE r.id = '$ID'")"
sleep 3
SQL "SELECT type || ' → ' || CASE WHEN publie_le IS NULL THEN 'en attente' ELSE 'publié' END FROM outbox_evenement WHERE payload->>'reservationId' = '$ID' ORDER BY created_at"
EVT=$(SQL "SELECT id FROM outbox_evenement WHERE type='sejour.termine' AND payload->>'reservationId'='$ID'")
echo "file menage : $(REDIS EXISTS "$PREFIXE:evt.menage.sejour.termine:$EVT") · file facturation : $(REDIS EXISTS "$PREFIXE:evt.facturation.sejour.termine:$EVT")"
curl -s -o /dev/null -w "check-out une 2e fois → %{http_code} (transition interdite)\n" -X POST $API/reservations/$ID/check-out -H "Authorization: Bearer $RECEP"
