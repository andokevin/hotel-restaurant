import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { ESPACE_DU_ROLE } from "../../auth/roles";
import {
  IconeBouclier,
  IconeCalendrier,
  IconeCouverts,
  IconeLieu,
  IconeListe,
  IconeLit,
  IconePersonne,
  IconePersonnes,
  IconeTelephone,
  IconeValide,
} from "../../components/icones";
import { Donnees, classeBouton } from "../../components/ui";
import { ariary, libelle, texte } from "../../lib/format";
import { HOTEL, photoCategorie } from "../../lib/hotel";
import { useCategories, useMenusPublies } from "../../lib/requetes";
import type { Categorie, CategoriePlat, Plat } from "../../lib/types";

const ORDRE_PLATS: CategoriePlat[] = ["ENTREE", "PLAT", "DESSERT", "BOISSON"];
const TITRES_PLATS: Record<CategoriePlat, string> = { ENTREE: "Entrées", PLAT: "Plats principaux", DESSERT: "Desserts", BOISSON: "Boissons" };
const MOYENS = ["MVola", "Orange Money", "Airtel Money"];

// Maquette Stitch « 01 — Accueil (mobile) » : docs/conception/ux/prompts-stitch.md
export function Accueil() {
  const { utilisateur } = useAuth();
  const categories = useCategories();
  const menus = useMenusPublies();

// Visiteur ou client : on vise directement le formulaire, RouteProtegee gère la connexion.
const lienReserver = !utilisateur || utilisateur.role === "CLIENT" ? "/client/reserver" : ESPACE_DU_ROLE[utilisateur.role];
const lienChambre = (code: string) => (lienReserver === "/client/reserver" ? `${lienReserver}?categorie=${code}` : lienReserver);


  const lienReservations = utilisateur?.role === "CLIENT" ? "/client/reservations" : lienReserver;

  return (
    <div className="space-y-14 pb-4">
      {/* ---------- Bandeau ---------- */}
      <section className="relative -mx-4 overflow-hidden bg-emerald-900 px-5 py-10 text-white sm:mx-0 sm:rounded-2xl sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-terre-600/30" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 right-16 h-56 w-56 rounded-full bg-sable-300/15" aria-hidden />
        <div className="relative max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-sable-200">
            <IconeLieu className="h-3.5 w-3.5" /> Antananarivo · Madagascar
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">Un séjour calme au cœur de Tana</h1>
          <p className="mt-4 text-base text-emerald-100 sm:text-lg">
            Réservez votre chambre en ligne en 2 minutes et payez en toute sécurité par Mobile Money avec Papi.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to={lienReserver} className={`${classeBouton("accent")} px-6 text-base`}>
              <IconeCalendrier /> {utilisateur ? "Aller à mon espace" : "Réserver une chambre"}
            </Link>
            {!utilisateur && (
              <Link to="/inscription" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/40 px-6 font-medium hover:bg-white/10">
                <IconePersonne /> Créer un compte
              </Link>
            )}
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-emerald-100">
            <li className="flex items-center gap-1.5">
              <IconeValide className="h-4 w-4 text-sable-300" /> Confirmée dès le paiement
            </li>
            <li className="flex items-center gap-1.5">
              <IconeTelephone className="h-4 w-4 text-sable-300" /> {MOYENS.join(" · ")}
            </li>
          </ul>
        </div>
      </section>

      {/* ---------- 3 étapes ---------- */}
      <section aria-labelledby="titre-etapes">
        <TitreSection surtitre="Réservation simplifiée" id="titre-etapes">
          Votre chambre en 3 étapes
        </TitreSection>
        <ol className="grid gap-3 sm:grid-cols-3">
          <Etape numero={1} titre="Choisissez vos dates" accent={false}>
            Sélectionnez votre période et le type de chambre : les disponibilités et le prix s'affichent tout de suite.
          </Etape>
          <Etape numero={2} titre="Payez par Mobile Money" accent>
            Transaction instantanée et sécurisée via Papi, avec votre opérateur habituel.
            <span className="mt-2 flex flex-wrap gap-1.5">
              {MOYENS.map((m) => (
                <span key={m} className="rounded-full bg-terre-50 px-2 py-0.5 text-xs font-medium text-terre-700">
                  {m}
                </span>
              ))}
            </span>
          </Etape>
          <Etape numero={3} titre="Recevez votre référence" accent={false}>
            Elle s'affiche dès le paiement confirmé : présentez-la à la réception le jour de votre arrivée.
          </Etape>
        </ol>
      </section>

      {/* ---------- Chambres ---------- */}
      <section id="chambres" aria-labelledby="titre-chambres" className="scroll-mt-32">
        <TitreSection
          surtitre="Hébergement"
          id="titre-chambres"
          droite={categories.data && <span className="text-sm text-slate-500">{categories.data.length} catégorie(s)</span>}
        >
          Nos chambres
        </TitreSection>
        <Donnees requete={categories} texteVide="Aucune catégorie de chambre pour le moment.">
          {(liste) => (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {liste.map((c) => (
                <CarteChambre key={c.id} categorie={c} lien={lienChambre(c.code)} />
              ))}
            </div>
          )}
        </Donnees>
      </section>

      {/* ---------- Restaurant ---------- */}
      <section id="restaurant" aria-labelledby="titre-restaurant" className="scroll-mt-32">
        <TitreSection surtitre="Saveurs des Hautes Terres" id="titre-restaurant">
          Le restaurant · Menu du jour
        </TitreSection>
        <p className="-mt-2 mb-4 text-sm text-slate-600">Cuisine malgache et plats du jour, préparés sur place. Le prix affiché est celui servi.</p>
        <Donnees requete={menus} texteVide="Aucun menu publié pour le moment.">
          {(liste) => (
            <div className="grid gap-5 md:grid-cols-2">
              {liste.map((m) => (
                <article key={m.id} className="rounded-xl border border-sable-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 font-titre text-xl font-bold text-slate-900">{texte(m.nom)}</h3>
                  <ListePlats plats={m.plats} />
                </article>
              ))}
            </div>
          )}
        </Donnees>
      </section>

      {/* ---------- Confiance et accès ---------- */}
      <section id="acces" aria-label="Paiement et accès" className="grid scroll-mt-32 gap-4 sm:grid-cols-2">
        <div className="flex gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <IconeBouclier className="h-8 w-8 shrink-0 text-emerald-700" />
          <div>
            <h2 className="font-semibold text-emerald-900">Paiement sécurisé Mobile Money</h2>
            <p className="mt-1 text-sm text-emerald-800">
              Paiement par Papi avec {MOYENS.join(", ")} ou carte. Le montant est calculé par l'hôtel ; aucune donnée bancaire n'est conservée.
            </p>
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-sable-200 bg-white p-5 text-sm">
          <p className="flex gap-3">
            <IconeLieu className="h-5 w-5 shrink-0 text-terre-600" />
            <span>
              <span className="block font-semibold text-slate-900">Adresse et réception</span>
              {HOTEL.adresse}
              <span className="block text-slate-500">{HOTEL.horaires}</span>
            </span>
          </p>
          <p className="flex gap-3">
            <IconeTelephone className="h-5 w-5 shrink-0 text-terre-600" />
            <span>
              <span className="block font-semibold text-slate-900">Contact</span>
              {HOTEL.telephone}
            </span>
          </p>
        </div>
      </section>

      {/* ---------- Barre d'onglets en bas (téléphone) ---------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-sable-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Raccourcis"
      >
        <OngletBas href="#chambres" icone={<IconeLit />}>
          Séjour
        </OngletBas>
        <OngletBas href="#restaurant" icone={<IconeCouverts />}>
          Carte
        </OngletBas>
        <Link to={lienReservations} className={CLASSE_ONGLET_BAS}>
          <IconeListe />
          Réservations
        </Link>
        <OngletBas href="#acces" icone={<IconeLieu />}>
          Accès
        </OngletBas>
      </nav>
    </div>
  );
}

function TitreSection({ surtitre, id, droite, children }: { surtitre: string; id: string; droite?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-terre-600">{surtitre}</p>
        <h2 id={id} className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
          {children}
        </h2>
      </div>
      {droite}
    </div>
  );
}

function Etape({ numero, titre, accent, children }: { numero: number; titre: string; accent: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-xl border border-sable-200 bg-white p-4 shadow-sm">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-titre text-lg font-bold text-white ${accent ? "bg-terre-600" : "bg-emerald-700"}`}
      >
        {numero}
      </span>
      <span>
        <span className={`block font-semibold ${accent ? "text-terre-700" : "text-slate-900"}`}>{titre}</span>
        <span className="mt-0.5 block text-sm text-slate-600">{children}</span>
      </span>
    </li>
  );
}

function CarteChambre({ categorie: c, lien }: { categorie: Categorie; lien: string }) {
  // Photo facultative (public/chambres/…) ; si elle n'existe pas, on garde l'illustration.
  const [photoOk, setPhotoOk] = useState(true);
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-sable-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-emerald-800 via-emerald-700 to-terre-600">
        {photoOk ? (
          <img src={photoCategorie(c.code)} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setPhotoOk(false)} />
        ) : (
          <div className="flex h-full items-center justify-center text-white/80" aria-hidden>
            <IconeLit className="h-16 w-16" />
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-800">
          <IconePersonnes className="h-3.5 w-3.5" /> {c.capacite} personne{c.capacite > 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-titre text-xl font-bold text-slate-900">{texte(c.libelle)}</h3>
          <p className="whitespace-nowrap text-lg font-bold text-terre-700">
            {ariary(c.tarifNuit)} <span className="text-xs font-normal text-slate-500">/ nuit</span>
          </p>
        </div>
        {c.description && <p className="mt-2 text-sm text-slate-600">{texte(c.description)}</p>}
        <div className="mt-auto pt-5">
          <Link to={lien} className={`${classeBouton("primaire")} w-full`}>
            Réserver cette chambre
          </Link>
        </div>
      </div>
    </article>
  );
}

function ListePlats({ plats }: { plats: Plat[] }) {
  if (plats.length === 0) return <p className="text-sm text-slate-500">Aucun plat.</p>;
  return (
    <div className="space-y-5">
      {ORDRE_PLATS.map((cat) => {
        const duType = plats.filter((p) => p.categorie === cat);
        if (duType.length === 0) return null;
        return (
          <div key={cat}>
            <h4 className="mb-1 flex items-center gap-2 border-b border-sable-200 pb-1 text-xs font-semibold uppercase tracking-widest text-emerald-800">
              <IconeCouverts className="h-4 w-4" /> {TITRES_PLATS[cat] ?? libelle(cat)}
            </h4>
            <ul className="divide-y divide-sable-100">
              {duType.map((p) => (
                <li key={p.id} className={`flex justify-between gap-3 py-2 text-sm ${p.disponible ? "" : "text-slate-400"}`}>
                  <span>
                    <span className={`font-medium ${p.disponible ? "text-slate-900" : "line-through"}`}>{texte(p.nom)}</span>
                    {!p.disponible && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 no-underline">Épuisé</span>}
                    {p.description && <span className="block text-xs text-slate-500">{texte(p.description)}</span>}
                  </span>
                  <span className={`whitespace-nowrap font-semibold ${p.disponible ? "text-slate-900" : "line-through"}`}>{ariary(p.prix)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

const CLASSE_ONGLET_BAS = "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-slate-600 hover:text-emerald-800";

function OngletBas({ href, icone, children }: { href: string; icone: ReactNode; children: ReactNode }) {
  return (
    <a href={href} className={CLASSE_ONGLET_BAS}>
      {icone}
      {children}
    </a>
  );
}
