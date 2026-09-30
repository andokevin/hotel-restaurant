#!/usr/bin/env bash
# Scénario de bout en bout de la phase 2 : tout passe par la gateway (http://localhost:3000/api).
# Prérequis : postgres lancé, `pnpm dev` (gateway, auth, hebergement) dans un autre terminal.
# Usage :
#   ADMIN_MOT_DE_PASSE='un-mot-de-passe-long' bash scripts/scenario-phase2.sh
# Le mot de passe de la réceptionniste est tiré au hasard à chaque lancement.
# Relancer le script sur la même base : les étapes de création répondent 409 (déjà existant), c'est normal.
set -u
: "${ADMIN_MOT_DE_PASSE:?Définis ADMIN_MOT_DE_PASSE}"
MDP_RECEP="Recep-$(openssl rand -hex 6)"
API=http://localhost:3000/api
JSON='Content-Type: application/json'
champ() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d)[process.argv[1]]))' "$1"; }

echo "== 1. Premier ADMIN (script, car personne ne peut le créer par l'API)"
ADMIN_EMAIL=direction@hotel.mg ADMIN_NOM="Direction" pnpm --silent --filter @hotel/auth creer-admin

echo "== 2. Connexion ADMIN"
ADMIN=$(curl -s -X POST $API/auth/connexion -H "$JSON" -d "{\"email\":\"direction@hotel.mg\",\"motDePasse\":\"$ADMIN_MOT_DE_PASSE\"}" | champ jetonAcces)
if [ "$ADMIN" = "undefined" ]; then
  echo "Connexion ADMIN refusée : le compte direction@hotel.mg existe déjà avec un autre mot de passe ?" >&2
  exit 1
fi
echo "jeton : ${ADMIN:0:25}…"

echo "== 3. L'ADMIN crée un compte RECEPTIONNISTE"
curl -s -X POST $API/auth/utilisateurs -H "$JSON" -H "Authorization: Bearer $ADMIN" \
  -d "{\"email\":\"recep-$MDP_RECEP@hotel.mg\",\"motDePasse\":\"$MDP_RECEP\",\"nomComplet\":\"Soa Rakoto\",\"role\":\"RECEPTIONNISTE\"}"; echo

echo "== 4. L'ADMIN crée une catégorie et une chambre"
CAT=$(curl -s -X POST $API/categories -H "$JSON" -H "Authorization: Bearer $ADMIN" \
  -d '{"code":"SUITE_PRESTIGE","libelle":{"fr":"Suite Prestige","mg":"Efitra Prestige"},"capacite":2,"tarifNuit":250000}' | champ id)
# Déjà créée lors d'un lancement précédent (le code est unique) : on la retrouve dans la liste publique
if [ "$CAT" = "undefined" ]; then
  CAT=$(curl -s $API/categories | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).find(c=>c.code==="SUITE_PRESTIGE").id))')
fi
CH=$(curl -s -X POST $API/chambres -H "$JSON" -H "Authorization: Bearer $ADMIN" \
  -d "{\"numero\":\"$((RANDOM % 900 + 100))\",\"etage\":3,\"categorieId\":\"$CAT\"}" | champ id)
echo "catégorie $CAT / chambre $CH"

echo "== 5. Visiteur anonyme : tarifs OK, réservations interdites"
curl -s -o /dev/null -w "GET  /categories sans jeton   → %{http_code}\n" $API/categories
curl -s -o /dev/null -w "GET  /reservations sans jeton → %{http_code}\n" $API/reservations

echo "== 6. Connexion RECEPTIONNISTE (cookie de session gardé dans un fichier)"
RECEP=$(curl -s -c /tmp/cookies-hotel.txt -X POST $API/auth/connexion -H "$JSON" \
  -d "{\"email\":\"recep-$MDP_RECEP@hotel.mg\",\"motDePasse\":\"$MDP_RECEP\"}" | champ jetonAcces)
[ "$RECEP" = "undefined" ] && { echo "Connexion RECEPTIONNISTE refusée" >&2; exit 1; }
curl -s $API/auth/moi -H "Authorization: Bearer $RECEP"; echo

echo "== 7. La réceptionniste réserve, puis tente un chevauchement"
R='"clientNom":"Rabe Hery","clientTelephone":"0331234567","pieceIdentiteType":"CIN","pieceIdentiteNumero":"101201304405"'
curl -s -o /dev/null -w "10→13 oct. → %{http_code}\n" -X POST $API/reservations -H "$JSON" -H "Authorization: Bearer $RECEP" \
  -d "{\"chambreId\":\"$CH\",$R,\"dateArrivee\":\"2030-10-10\",\"dateDepart\":\"2030-10-13\"}"
curl -s -w "  → %{http_code}\n" -X POST $API/reservations -H "$JSON" -H "Authorization: Bearer $RECEP" \
  -d "{\"chambreId\":\"$CH\",$R,\"dateArrivee\":\"2030-10-12\",\"dateDepart\":\"2030-10-15\"}"

echo "== 8. Ce que la réceptionniste NE peut PAS faire"
curl -s -o /dev/null -w "GET  /auth/utilisateurs (ADMIN seul)       → %{http_code}\n" $API/auth/utilisateurs -H "Authorization: Bearer $RECEP"
curl -s -o /dev/null -w "POST /reservations/:id/confirmer (interne) → %{http_code}\n" -X POST $API/reservations/$CH/confirmer -H "Authorization: Bearer $RECEP"
curl -s -o /dev/null -w "En-tête forgé x-utilisateur-role: ADMIN   → %{http_code}\n" $API/auth/utilisateurs -H "x-utilisateur-role: ADMIN"

echo "== 9. Renouveler le jeton grâce au cookie, puis se déconnecter"
curl -s -b /tmp/cookies-hotel.txt -c /tmp/cookies-hotel.txt -o /dev/null -w "rafraichir           → %{http_code}\n" -X POST $API/auth/rafraichir
curl -s -b /tmp/cookies-hotel.txt -o /dev/null -w "deconnexion          → %{http_code}\n" -X POST $API/auth/deconnexion
curl -s -b /tmp/cookies-hotel.txt -o /dev/null -w "rafraichir après     → %{http_code}\n" -X POST $API/auth/rafraichir
rm -f /tmp/cookies-hotel.txt
