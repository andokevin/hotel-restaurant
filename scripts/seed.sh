#!/usr/bin/env bash
# Données de démonstration réalistes (Antananarivo, montants en Ariary), créées PAR L'API :
# les règles métier s'appliquent comme pour un vrai utilisateur.
# Rejouable : ce qui existe déjà (409) est conservé ; toute autre erreur ARRÊTE le script.
# Prérequis : l'application tourne (gateway sur API, par défaut http://localhost:3000/api)
#             et le compte ADMIN existe (auth : creer-admin).
# Usage : ADMIN_MOT_DE_PASSE='…' SEED_MOT_DE_PASSE='mot-de-passe-du-personnel' bash scripts/seed.sh
set -u
: "${ADMIN_MOT_DE_PASSE:?}" "${SEED_MOT_DE_PASSE:?Mot de passe (10 caractères min.) donné à tous les comptes de démonstration}"
API=${API:-http://localhost:3000/api}
ADMIN_IDENTIFIANT=${ADMIN_IDENTIFIANT:-0340000001}
JSON='Content-Type: application/json'
REPONSE=$(mktemp); trap 'rm -f "$REPONSE"' EXIT

champ() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{let v;try{v=JSON.parse(d)[process.argv[1]]}catch{}console.log(v===undefined?"":v)})' "$1"; }
# id de l'élément de la liste GET $1 dont le champ $2 vaut $3
trouver() { curl -s "$API$1" -H "Authorization: Bearer $JETON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const x=JSON.parse(d).find(e=>e[process.argv[1]]===process.argv[2]);console.log(x?x.id:"")})' "$2" "$3"; }

# appel METHODE CHEMIN CORPS → écrit la réponse dans $REPONSE ; renvoie 0 (créé), 1 (existait déjà)
appel() {
  local code
  code=$(curl -s -o "$REPONSE" -w "%{http_code}" -X "$1" "$API$2" -H "$JSON" -H "Authorization: Bearer ${JETON:-}" -d "$3")
  case "$code" in
    2??) return 0 ;;
    409) return 1 ;;
    *) echo "ÉCHEC $1 $2 → HTTP $code : $(cat "$REPONSE")" >&2; exit 1 ;;
  esac
}

JETON=""
appel POST /auth/connexion "{\"identifiant\":\"$ADMIN_IDENTIFIANT\",\"motDePasse\":\"$ADMIN_MOT_DE_PASSE\"}"
JETON=$(champ jetonAcces < "$REPONSE")

echo "== Catégories et chambres"
declare -A CAT
while IFS='|' read -r code fr mg capacite tarif; do
  if appel POST /categories "{\"code\":\"$code\",\"libelle\":{\"fr\":\"$fr\",\"mg\":\"$mg\"},\"capacite\":$capacite,\"tarifNuit\":$tarif}"; then
    CAT[$code]=$(champ id < "$REPONSE"); echo "  $fr : $tarif Ar/nuit"
  else
    CAT[$code]=$(trouver /categories code "$code"); echo "  $fr : déjà présente"
  fi
done <<'L'
STANDARD|Chambre standard|Efitra tsotra|2|85000
SUITE_SENIOR|Suite senior|Efitra senior|3|165000
SUITE_PRESTIGE|Suite prestige|Efitra prestige|4|290000
L
creees=0
for spec in STANDARD:1:101,102,103,104,105,106 SUITE_SENIOR:2:201,202,203,204 SUITE_PRESTIGE:3:301,302; do
  IFS=: read -r code etage numeros <<<"$spec"
  for n in ${numeros//,/ }; do
    appel POST /chambres "{\"numero\":\"$n\",\"etage\":$etage,\"categorieId\":\"${CAT[$code]}\"}" && creees=$((creees + 1))
  done
done
echo "  chambres 101-106, 201-204, 301-302 ($creees créées)"

echo "== Personnel (mot de passe : SEED_MOT_DE_PASSE)"
while IFS='|' read -r nom tel email role; do
  appel POST /auth/utilisateurs "{\"nom\":\"$nom\",\"telephone\":\"$tel\",\"email\":\"$email\",\"motDePasse\":\"$SEED_MOT_DE_PASSE\",\"role\":\"$role\"}" \
    && echo "  $role : $nom — $tel / $email" || echo "  $role : $nom — déjà présent"
done <<'L'
Soa Randriamanana|0341000001|reception@hotel-tana.mg|RECEPTIONNISTE
Hanta Rasoanirina|0341000002|hanta.menage@hotel-tana.mg|FEMME_MENAGE
Voahangy Rakotobe|0341000003|voahangy.menage@hotel-tana.mg|FEMME_MENAGE
Tovo Andrianjafy|0341000004|restaurant@hotel-tana.mg|RESTAURANT
Fara Ravelojaona|0341000005|comptabilite@hotel-tana.mg|COMPTABLE
Mialy Rabemananjara|0341000006|communication@hotel-tana.mg|COMMUNICATION
L
appel POST /auth/inscription "{\"nom\":\"Jean Rakoto\",\"telephone\":\"0331234567\",\"email\":\"jean.rakoto@mail.mg\",\"motDePasse\":\"$SEED_MOT_DE_PASSE\"}" \
  && echo "  CLIENT : Jean Rakoto — 0331234567 / jean.rakoto@mail.mg" || echo "  CLIENT : Jean Rakoto — déjà présent"

echo "== Articles d'accueil (1 nuitée = 1 de chaque) et approvisionnement"
while IFS='|' read -r code fr mg; do
  if appel POST /articles "{\"code\":\"$code\",\"libelle\":{\"fr\":\"$fr\",\"mg\":\"$mg\"},\"seuilAlerte\":30,\"consommationParNuitee\":1}"; then
    ID=$(champ id < "$REPONSE")
    appel POST "/articles/$ID/mouvements" '{"type":"ENTREE","motif":"APPROVISIONNEMENT","quantite":200}'
    echo "  $fr : 200"
  else
    echo "  $fr : déjà présent (stock inchangé)"
  fi
done <<'L'
GEL_DOUCHE|Gel douche|Savony fandroana
PAPIER_HYGIENIQUE|Papier hygiénique|Taratasy fidiovana
PANTOUFLE|Paire de pantoufles|Kapa
BROSSE_A_DENTS|Brosse à dents|Borosy nify
L

echo "== Carte du restaurant (publiée)"
MENU=$(curl -s "$API/menus" -H "Authorization: Bearer $JETON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const m=JSON.parse(d).find(m=>m.nom.fr==="Carte malgache");console.log(m?m.id:"")})')
if [ -n "$MENU" ]; then
  echo "  Carte malgache : déjà présente"
else
  appel POST /menus '{"nom":{"fr":"Carte malgache","mg":"Sakafo malagasy"}}'
  MENU=$(champ id < "$REPONSE")
  while IFS='|' read -r categorie fr prix; do
    appel POST "/menus/$MENU/plats" "{\"nom\":{\"fr\":\"$fr\"},\"categorie\":\"$categorie\",\"prix\":$prix,\"tempsPreparationMin\":20}"
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
fi
appel POST "/menus/$MENU/publier" '{}'
echo "Seed terminé. Connexion : téléphone ou email ci-dessus, mot de passe SEED_MOT_DE_PASSE."
