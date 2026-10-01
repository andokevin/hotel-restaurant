#!/usr/bin/env bash
# Données de démonstration réalistes (Antananarivo, montants en Ariary), créées PAR L'API :
# les règles métier s'appliquent comme pour un vrai utilisateur. À lancer une fois, sur une base vide.
# Prérequis : l'application tourne (gateway sur API, par défaut http://localhost:3000/api)
#             et le compte ADMIN existe (auth : creer-admin).
# Usage : ADMIN_MOT_DE_PASSE='…' SEED_MOT_DE_PASSE='mot-de-passe-du-personnel' bash scripts/seed.sh
set -u
: "${ADMIN_MOT_DE_PASSE:?}" "${SEED_MOT_DE_PASSE:?Mot de passe (10 caractères min.) donné à tous les comptes de démonstration}"
API=${API:-http://localhost:3000/api}
ADMIN_IDENTIFIANT=${ADMIN_IDENTIFIANT:-0340000001}
JSON='Content-Type: application/json'
champ() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const v=JSON.parse(d)[process.argv[1]];console.log(v===undefined?"":v)})' "$1"; }
post() { curl -s -X POST "$API$1" -H "$JSON" -H "Authorization: Bearer $JETON" -d "$2"; }

JETON=$(curl -s -X POST "$API/auth/connexion" -H "$JSON" -d "{\"identifiant\":\"$ADMIN_IDENTIFIANT\",\"motDePasse\":\"$ADMIN_MOT_DE_PASSE\"}" | champ jetonAcces)
[ -z "$JETON" ] && { echo "Connexion ADMIN refusée" >&2; exit 1; }

echo "== Catégories et chambres"
declare -A CAT
while IFS='|' read -r code fr mg capacite tarif; do
  CAT[$code]=$(post /categories "{\"code\":\"$code\",\"libelle\":{\"fr\":\"$fr\",\"mg\":\"$mg\"},\"capacite\":$capacite,\"tarifNuit\":$tarif}" | champ id)
  echo "  $fr : $tarif Ar/nuit"
done <<'L'
STANDARD|Chambre standard|Efitra tsotra|2|85000
SUITE_SENIOR|Suite senior|Efitra senior|3|165000
SUITE_PRESTIGE|Suite prestige|Efitra prestige|4|290000
L
for n in 101 102 103 104 105 106; do post /chambres "{\"numero\":\"$n\",\"etage\":1,\"categorieId\":\"${CAT[STANDARD]}\"}" >/dev/null; done
for n in 201 202 203 204; do post /chambres "{\"numero\":\"$n\",\"etage\":2,\"categorieId\":\"${CAT[SUITE_SENIOR]}\"}" >/dev/null; done
for n in 301 302; do post /chambres "{\"numero\":\"$n\",\"etage\":3,\"categorieId\":\"${CAT[SUITE_PRESTIGE]}\"}" >/dev/null; done
echo "  12 chambres (101-106, 201-204, 301-302)"

echo "== Personnel (mot de passe : SEED_MOT_DE_PASSE)"
while IFS='|' read -r nom tel email role; do
  post /auth/utilisateurs "{\"nom\":\"$nom\",\"telephone\":\"$tel\",\"email\":\"$email\",\"motDePasse\":\"$SEED_MOT_DE_PASSE\",\"role\":\"$role\"}" >/dev/null
  echo "  $role : $nom — $tel / $email"
done <<'L'
Soa Randriamanana|0341000001|reception@hotel-tana.mg|RECEPTIONNISTE
Hanta Rasoanirina|0341000002|hanta.menage@hotel-tana.mg|FEMME_MENAGE
Voahangy Rakotobe|0341000003|voahangy.menage@hotel-tana.mg|FEMME_MENAGE
Tovo Andrianjafy|0341000004|restaurant@hotel-tana.mg|RESTAURANT
Fara Ravelojaona|0341000005|comptabilite@hotel-tana.mg|COMPTABLE
Mialy Rabemananjara|0341000006|communication@hotel-tana.mg|COMMUNICATION
L
curl -s -o /dev/null -X POST "$API/auth/inscription" -H "$JSON" -d "{\"nom\":\"Jean Rakoto\",\"telephone\":\"0331234567\",\"email\":\"jean.rakoto@mail.mg\",\"motDePasse\":\"$SEED_MOT_DE_PASSE\"}"
echo "  CLIENT : Jean Rakoto — 0331234567 / jean.rakoto@mail.mg"

echo "== Articles d'accueil (1 nuitée = 1 de chaque) et approvisionnement"
while IFS='|' read -r code fr mg; do
  ID=$(post /articles "{\"code\":\"$code\",\"libelle\":{\"fr\":\"$fr\",\"mg\":\"$mg\"},\"seuilAlerte\":30,\"consommationParNuitee\":1}" | champ id)
  post "/articles/$ID/mouvements" '{"type":"ENTREE","motif":"APPROVISIONNEMENT","quantite":200}' >/dev/null
  echo "  $fr : 200"
done <<'L'
GEL_DOUCHE|Gel douche|Savony fandroana
PAPIER_HYGIENIQUE|Papier hygiénique|Taratasy fidiovana
PANTOUFLE|Paire de pantoufles|Kapa
BROSSE_A_DENTS|Brosse à dents|Borosy nify
L

echo "== Carte du restaurant (publiée)"
MENU=$(post /menus '{"nom":{"fr":"Carte malgache","mg":"Sakafo malagasy"}}' | champ id)
while IFS='|' read -r categorie fr prix; do
  post "/menus/$MENU/plats" "{\"nom\":{\"fr\":\"$fr\"},\"categorie\":\"$categorie\",\"prix\":$prix,\"tempsPreparationMin\":20}" >/dev/null
  echo "  $fr : $prix Ar"
done <<'L'
ENTREE|Sambos aux légumes (4 pièces)|8000
ENTREE|Salade de crevettes de Mahajanga|16000
PLAT|Romazava de zébu|22000
PLAT|Ravitoto sy henakisoa|20000
PLAT|Poulet au coco (akoho sy voanio)|24000
PLAT|Poisson du lac Alaotra, riz et brèdes|26000
DESSERT|Mofo gasy et miel (3 pièces)|6000
DESSERT|Koba ravina|7000
BOISSON|THB 65 cl|7000
BOISSON|Jus de baobab|6000
BOISSON|Ranovola|2000
L
post "/menus/$MENU/publier" '{}' >/dev/null
echo "Seed terminé. Connexion : téléphone ou email ci-dessus, mot de passe SEED_MOT_DE_PASSE."
