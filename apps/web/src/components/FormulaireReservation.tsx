import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, api, messageErreur } from "../lib/api";
import { ajouterJours, ariary, aujourdhui, texte } from "../lib/format";
import { useCategories } from "../lib/requetes";
import type { Reservation } from "../lib/types";
import {
  champEmail,
  champNom,
  champTelephone,
  normaliserTelephone,
} from "../lib/validation";
import {
  Alerte,
  Bouton,
  Champ,
  Chargement,
  MessageErreur,
  classeInput,
} from "./ui";

const schema = z
  .object({
    categorieId: z.string().min(1, "Choisissez une catégorie"),
    // valueAsNumber : un champ vide donne NaN, refusé avec ce message
    nbAdultes: z.number({ error: "Indiquez un nombre" }).int().min(1, "Au moins 1 adulte").max(20),
    nbEnfants: z.number({ error: "Indiquez un nombre (0 si aucun)" }).int().min(0, "0 au minimum").max(20),
    dateArrivee: z.iso.date("Date invalide"),
    dateDepart: z.iso.date("Date invalide"),
    clientNom: champNom,
    clientTelephone: champTelephone,
    clientEmail: champEmail,
    pieceIdentiteType: z.enum(["CIN", "PASSEPORT"]),
    pieceIdentiteNumero: z
      .string()
      .trim()
      .min(4, "4 caractères minimum")
      .max(30),
    canal: z.enum(["RECEPTION", "FACEBOOK", "SITE_WEB"]),
  })
  // Les dates AAAA-MM-JJ se comparent comme des chaînes.
  .refine((d) => d.dateDepart > d.dateArrivee, {
    message: "Le départ doit être après l'arrivée",
    path: ["dateDepart"],
  })
  .refine((d) => d.dateArrivee >= aujourdhui(), {
    message: "L'arrivée ne peut pas être dans le passé",
    path: ["dateArrivee"],
  });
type Formulaire = z.infer<typeof schema>;

type Props = {
  // true au comptoir (réception) : on peut choisir le canal de la réservation.
  personnel: boolean;
  //Code de la catégorie à présélectionner (ex. "SUITE_SENIOR"), venu de l'URL ?categorie=
  categorieInitiale?: string;
  // Coordonnées pré-remplies (ex. le client connecté).
  client?: { nom: string; telephone: string; email: string };
  onCreee: (reservation: Reservation) => void;
};

export function FormulaireReservation({
  categorieInitiale,
  personnel,
  client,
  onCreee,
}: Props) {
  const queryClient = useQueryClient();

  // Clé d'idempotence : générée UNE fois pour ce formulaire. Si la même soumission part deux fois
  // (double clic, réseau lent), le serveur reconnaît la clé et ne crée qu'une réservation.
  const cleIdempotence = useRef(crypto.randomUUID());

  const { register, handleSubmit, watch, formState, setValue, getValues } =
    useForm<Formulaire>({
      resolver: zodResolver(schema),
      defaultValues: {
        categorieId: "",
        nbAdultes: 1,
        nbEnfants: 0,
        dateArrivee: aujourdhui(),
        dateDepart: ajouterJours(aujourdhui(), 1),
        clientNom: client?.nom ?? "",
        clientTelephone: client?.telephone ?? "",
        clientEmail: client?.email ?? "",
        pieceIdentiteType: "CIN",
        pieceIdentiteNumero: "",
        canal: personnel ? "RECEPTION" : "SITE_WEB",
      },
    });

  // Seules les catégories assez grandes pour le groupe sont proposées (filtre fait par le serveur).
  const nbAdultes = watch("nbAdultes");
  const nbEnfants = watch("nbEnfants");
  const total = (Number.isFinite(nbAdultes) ? nbAdultes : 0) + (Number.isFinite(nbEnfants) ? nbEnfants : 0);
  const categories = useCategories(Math.max(1, total));

  // Présélection depuis l'URL (?categorie=CODE), une fois les catégories chargées.
  // On n'écrase jamais un choix déjà fait par l'utilisateur.
  useEffect(() => {
    if (!categorieInitiale || getValues("categorieId")) return;
    const c = categories.data?.find((x) => x.code === categorieInitiale);
    if (c) setValue("categorieId", c.id);
  }, [categorieInitiale, categories.data, getValues, setValue]);

  // Le groupe a grandi et la catégorie choisie est devenue trop petite : on retire le choix.
  useEffect(() => {
    const choisie = getValues("categorieId");
    if (choisie && categories.data && !categories.data.some((c) => c.id === choisie)) setValue("categorieId", "");
  }, [categories.data, getValues, setValue]);

  const e = formState.errors;

  const creation = useMutation({
    mutationFn: (data: Formulaire) => {
      const corps = {
        categorieId: data.categorieId,
        nbAdultes: data.nbAdultes,
        nbEnfants: data.nbEnfants,
        clientNom: data.clientNom,
        clientTelephone: normaliserTelephone(data.clientTelephone),
        clientEmail: data.clientEmail,
        pieceIdentiteType: data.pieceIdentiteType,
        pieceIdentiteNumero: data.pieceIdentiteNumero,
        dateArrivee: data.dateArrivee,
        dateDepart: data.dateDepart,
        // Le canal n'est envoyé que par le personnel (pour un client, le serveur force SITE_WEB).
        ...(personnel ? { canal: data.canal } : {}),
      };
      return api.post<Reservation>("/reservations", corps, {
        "Idempotency-Key": cleIdempotence.current,
      });
    },
    onSuccess: (reservation) => {
      cleIdempotence.current = crypto.randomUUID(); // la prochaine réservation sera une nouvelle action
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      onCreee(reservation);
    },
    onError: (err) => {
      // Le serveur a répondu (ex. plus de chambre) : l'utilisateur va modifier sa demande,
      // ce sera donc une nouvelle action. En cas de coupure réseau, on garde la même clé.
      if (err instanceof ApiError && err.status > 0)
        cleIdempotence.current = crypto.randomUUID();
    },
  });

  // Estimation indicative ; le montant qui fait foi est celui renvoyé par le serveur.
  const categorieChoisie = categories.data?.find(
    (c) => c.id === watch("categorieId"),
  );
  const arrivee = watch("dateArrivee");
  const depart = watch("dateDepart");
  const nuits =
    arrivee && depart
      ? Math.round(
          (new Date(depart).getTime() - new Date(arrivee).getTime()) /
            86_400_000,
        )
      : 0;

  if (categories.isPending) return <Chargement />;
  if (categories.isError) return <MessageErreur erreur={categories.error} />;

  // Capacité dépassée (422 du serveur) : affichée sous les personnes, là où se corrige l'erreur.
  const erreurCapacite =
    creation.error instanceof ApiError && creation.error.status === 422 && /accueille/.test(creation.error.message)
      ? creation.error.message
      : null;
  const erreurCreation = erreurCapacite
    ? null
    : creation.error instanceof ApiError && creation.error.code === "AUCUNE_CHAMBRE_DISPONIBLE"
      ? "Aucune chambre de cette catégorie n'est disponible pour ces dates. Essayez d'autres dates ou une autre catégorie."
      : creation.error
        ? messageErreur(creation.error)
        : null;

  return (
    <form
      onSubmit={handleSubmit((d) => creation.mutate(d))}
      className="space-y-5"
      noValidate
    >
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-slate-900">Séjour</legend>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">Personnes</legend>
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Adultes" erreur={e.nbAdultes?.message}>
              <input type="number" min={1} max={20} inputMode="numeric" className={classeInput} {...register("nbAdultes", { valueAsNumber: true })} />
            </Champ>
            <Champ label="Enfants" erreur={e.nbEnfants?.message}>
              <input type="number" min={0} max={20} inputMode="numeric" className={classeInput} {...register("nbEnfants", { valueAsNumber: true })} />
            </Champ>
          </div>
          {erreurCapacite && <Alerte>{erreurCapacite}</Alerte>}
        </fieldset>
        <Champ
          label="Catégorie de chambre"
          erreur={e.categorieId?.message}
          aide={categories.data.length === 0 ? `Aucune catégorie ne peut accueillir ${total} personnes.` : undefined}
        >
          <select className={classeInput} {...register("categorieId")}>
            <option value="">— Choisir —</option>
            {categories.data.map((c) => (
              <option key={c.id} value={c.id}>
                {texte(c.libelle)} — {ariary(c.tarifNuit)} / nuit ({c.capacite}{" "}
                pers.)
              </option>
            ))}
          </select>
        </Champ>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Arrivée" erreur={e.dateArrivee?.message}>
            <input
              type="date"
              min={aujourdhui()}
              className={classeInput}
              {...register("dateArrivee")}
            />
          </Champ>
          <Champ label="Départ" erreur={e.dateDepart?.message}>
            <input
              type="date"
              min={aujourdhui()}
              className={classeInput}
              {...register("dateDepart")}
            />
          </Champ>
        </div>
        {categorieChoisie && nuits > 0 && (
          <p className="text-sm text-slate-600">
            Estimation : {nuits} nuit(s) × {ariary(categorieChoisie.tarifNuit)}{" "}
            ≈ {ariary(nuits * categorieChoisie.tarifNuit)}. Le montant exact
            sera calculé par l'hôtel.
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-slate-900">Client</legend>
        <Champ label="Nom complet" erreur={e.clientNom?.message}>
          <input className={classeInput} {...register("clientNom")} />
        </Champ>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Téléphone" erreur={e.clientTelephone?.message}>
            <input
              className={classeInput}
              placeholder="034 12 345 67"
              {...register("clientTelephone")}
            />
          </Champ>
          <Champ label="Email" erreur={e.clientEmail?.message}>
            <input
              type="email"
              className={classeInput}
              {...register("clientEmail")}
            />
          </Champ>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Pièce d'identité" erreur={e.pieceIdentiteType?.message}>
            <select className={classeInput} {...register("pieceIdentiteType")}>
              <option value="CIN">CIN</option>
              <option value="PASSEPORT">Passeport</option>
            </select>
          </Champ>
          <Champ
            label="Numéro de la pièce"
            erreur={e.pieceIdentiteNumero?.message}
          >
            <input
              className={classeInput}
              {...register("pieceIdentiteNumero")}
            />
          </Champ>
        </div>
        {personnel && (
          <Champ label="Canal de la réservation" erreur={e.canal?.message}>
            <select className={classeInput} {...register("canal")}>
              <option value="RECEPTION">Réception (au comptoir)</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="SITE_WEB">Site web</option>
            </select>
          </Champ>
        )}
      </fieldset>

      {erreurCreation && <Alerte>{erreurCreation}</Alerte>}
      <Bouton
        type="submit"
        enCours={creation.isPending}
        className="w-full sm:w-auto"
      >
        Réserver
      </Bouton>
    </form>
  );
}
