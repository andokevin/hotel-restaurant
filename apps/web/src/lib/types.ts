// Types des réponses de l'API (tels que renvoyés par la gateway).
// Les montants sont des entiers en Ariary ; les dates sont des chaînes ISO.

export const ROLES = [
  "ADMIN",
  "RECEPTIONNISTE",
  "FEMME_MENAGE",
  "RESTAURANT",
  "COMPTABLE",
  "COMMUNICATION",
  "CLIENT",
] as const;
export type Role = (typeof ROLES)[number];

export type Langue = "FR" | "MG" | "EN";

export type Utilisateur = {
  id: string;
  nom: string;
  telephone: string;
  email: string;
  langue: Langue;
  role: Role;
  actif: boolean;
  createdAt: string;
};

export type ReponseConnexion = {
  jetonAcces: string;
  expireDans: number;
  utilisateur: Utilisateur;
};

export type ReponseRafraichir = {
  jetonAcces: string;
  expireDans: number;
};

// Texte traduit : le français est toujours présent.
export type TexteTraduit = { fr: string; mg?: string; en?: string };

// --- Hébergement ---
export type CodeCategorie = "STANDARD" | "SUITE_SENIOR" | "SUITE_PRESTIGE";

export type Categorie = {
  id: string;
  code: CodeCategorie;
  libelle: TexteTraduit;
  description?: TexteTraduit | string | null;
  capacite: number;
  tarifNuit: number;
  _count?: { chambres: number };
};

export type EtatMenage = "PROPRE" | "SALE" | "EN_NETTOYAGE";

export type Chambre = {
  id: string;
  numero: string;
  etage: number;
  categorieId: string;
  etatMenage: EtatMenage;
  horsService: boolean;
  version: number;
  categorie?: Categorie;
};

export type StatutReservation = "EN_ATTENTE_PAIEMENT" | "CONFIRMEE" | "EN_COURS" | "TERMINEE" | "ANNULEE";
export type CanalReservation = "RECEPTION" | "FACEBOOK" | "SITE_WEB";
export type TypePiece = "CIN" | "PASSEPORT";

export type Reservation = {
  id: string;
  reference: string;
  statut: StatutReservation;
  montantTotal: number;
  dateArrivee: string;
  dateDepart: string;
  expireLe?: string | null;
  clientNom?: string;
  clientTelephone?: string;
  clientEmail?: string;
  canal?: CanalReservation;
  categorieId?: string;
  chambreId?: string | null;
  chambre?: { id?: string; numero: string; categorieId?: string; categorie?: Categorie } | null;
  // saison : celle qui a fixé le prix de la nuit (null = tarif normal de la catégorie)
  nuitees?: { nuit: string; tarifApplique: number; saison?: { nom: TexteTraduit } | null }[];

};

// --- Facturation ---
export type StatutPaiement = "EN_ATTENTE" | "REUSSI" | "ECHOUE" | "ANOMALIE";
export type StatutFacture = "EMISE" | "PAYEE" | "CLOTUREE" | "ANNULEE";

export type ReponseCreationPaiement = { paiementId: string; url: string; montant: number };

export type Paiement = {
  id: string;
  factureId: string;
  montant: number;
  statut: StatutPaiement;
  methode: string | null; // inconnue tant que Papi n'a pas confirmé
  facture?: { numero: string; statut: StatutFacture } | null;
};

export type LigneFacture = {
  libelle: string;
  quantite: number;
  prixUnitaire: number;
  montant: number;
  origine: "HEBERGEMENT" | "RESTAURANT";
};

export type Facture = {
  id: string;
  numero: string;
  type: string;
  statut: StatutFacture;
  montantTotal: number;
  montantPaye: number;
  clientNom: string;
  emiseLe: string;
  clotureeLe?: string | null;
  reservationId?: string | null;
  lignes?: LigneFacture[];
  paiements?: { id: string; montant: number; statut: StatutPaiement; methode: string | null }[];
};

// --- Ménage ---
export type StatutTache = "A_FAIRE" | "EN_COURS" | "TERMINEE";

export type Tache = {
  id: string;
  reservationId: string | null;
  chambreId: string;
  chambreNumero: string;
  type: "QUOTIDIEN" | "DEPART";
  datePrevue: string;
  statut: StatutTache;
  assigneeId: string | null;
  assigneeNom: string | null;
  commenceLe: string | null;
  termineLe: string | null;
  remarques: string | null;
  version: number;
};

// --- Stock ---
export type Article = {
  id: string;
  code: string;
  libelle: TexteTraduit;
  quantite: number;
  seuilAlerte: number;
  consommationParNuitee: number;
  enAlerte: boolean;
};

export type TypeMouvement = "ENTREE" | "SORTIE";
export type MotifMouvement = "APPROVISIONNEMENT" | "AJUSTEMENT_INVENTAIRE" | "PERTE";

export type Mouvement = {
  id: string;
  type: TypeMouvement;
  motif: MotifMouvement | string;
  quantite: number;
  createdAt?: string;
};

// --- Restaurant ---
export type CategoriePlat = "ENTREE" | "PLAT" | "DESSERT" | "BOISSON";

export type Plat = {
  id: string;
  nom: TexteTraduit;
  description?: TexteTraduit | string | null;
  categorie: CategoriePlat;
  prix: number;
  disponible: boolean;
  tempsPreparationMin?: number;
};

export type Menu = {
  id: string;
  nom: TexteTraduit;
  actif?: boolean;
  plats: Plat[];
};

export type StatutCommande = "RECUE" | "EN_PREPARATION" | "PRETE" | "REMISE" | "ANNULEE";
export type StatutPaiementCommande = "NON_PAYEE" | "PAYEE" | "IMPUTEE_CHAMBRE";

export type Commande = {
  id: string;
  reference: string;
  canal: "SUR_PLACE" | "A_EMPORTER";
  tableNumero?: string | number | null;
  clientNom?: string | null;
  statut: StatutCommande;
  statutPaiement: StatutPaiementCommande;
  montantTotal: number;
  lignes: { platNom: string; prixUnitaire: number; quantite: number }[];
  createdAt: string; // heure de prise de commande (ISO)
};

// --- Comptabilité ---
export type TableauJournalier = {
  jour: string;
  nuiteesVendues: number;
  nombreFactures: number;
  caHebergement: number;
  caRestaurant: number;
  genereLe: string;
  controles: { articleCode: string; consommationAttendue: number; consommationReelle: number; ecart: number }[];
};

export type Reversement = {
  id: string;
  factureId: string;
  numeroFacture: string;
  montant: number;
  statut: "A_REVERSER" | "REVERSE";
  reverseLe: string | null;
};
