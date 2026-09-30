import { Link, Route, Routes } from "react-router";
import { RouteProtegee } from "./auth/RouteProtegee";
import { Layout } from "./components/Layout";
import { TitrePage } from "./components/ui";
import { ROLES } from "./lib/types";
import { Categories } from "./pages/admin/Categories";
import { ChambresAdmin } from "./pages/admin/ChambresAdmin";
import { Comptes } from "./pages/admin/Comptes";
import { MesFactures } from "./pages/client/MesFactures";
import { MesReservations } from "./pages/client/MesReservations";
import { PaiementRetour } from "./pages/client/PaiementRetour";
import { Reserver } from "./pages/client/Reserver";
import { Communication } from "./pages/communication/Communication";
import { CopiesFactures } from "./pages/comptable/CopiesFactures";
import { Reversements } from "./pages/comptable/Reversements";
import { Stock } from "./pages/comptable/Stock";
import { Tableaux } from "./pages/comptable/Tableaux";
import { Taches } from "./pages/menage/Taches";
import { Accueil } from "./pages/public/Accueil";
import { Connexion } from "./pages/public/Connexion";
import { Inscription } from "./pages/public/Inscription";
import { EtatChambres } from "./pages/reception/Chambres";
import { Departs } from "./pages/reception/Departs";
import { Factures } from "./pages/reception/Factures";
import { NouvelleReservation } from "./pages/reception/NouvelleReservation";
import { Reservations } from "./pages/reception/Reservations";
import { MenusRestaurant } from "./pages/restaurant/Menus";
import { PriseCommande } from "./pages/restaurant/PriseCommande";
import { SuiviCommandes } from "./pages/restaurant/SuiviCommandes";

// Plan du site. Chaque groupe de routes est protégé par les rôles autorisés
// (les mêmes que ceux de la gateway : le serveur reste le vrai garde-fou).
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route index element={<Accueil />} />
        <Route path="connexion" element={<Connexion />} />
        <Route path="inscription" element={<Inscription />} />

        {/* Retour de Papi : tout utilisateur connecté (client en ligne ou personnel au comptoir) */}
        <Route element={<RouteProtegee roles={ROLES} />}>
          <Route path="paiement/retour" element={<PaiementRetour />} />
        </Route>

        {/* Client */}
        <Route element={<RouteProtegee roles={["CLIENT"]} />}>
          <Route path="client/reserver" element={<Reserver />} />
          <Route path="client/reservations" element={<MesReservations />} />
          <Route path="client/factures" element={<MesFactures />} />
        </Route>

        {/* Réception */}
        <Route element={<RouteProtegee roles={["RECEPTIONNISTE", "ADMIN"]} />}>
          <Route path="reception/reservations" element={<Reservations />} />
          <Route path="reception/nouvelle" element={<NouvelleReservation />} />
          <Route path="reception/departs" element={<Departs />} />
          <Route path="reception/factures" element={<Factures />} />
          <Route path="reception/chambres" element={<EtatChambres />} />
        </Route>

        {/* Ménage (la réception et l'admin peuvent consulter les tâches) */}
        <Route element={<RouteProtegee roles={["FEMME_MENAGE", "RECEPTIONNISTE", "ADMIN"]} />}>
          <Route path="menage/taches" element={<Taches />} />
        </Route>

        {/* Restaurant */}
        <Route element={<RouteProtegee roles={["RESTAURANT"]} />}>
          <Route path="restaurant/commande" element={<PriseCommande />} />
          <Route path="restaurant/commandes" element={<SuiviCommandes />} />
        </Route>
        <Route element={<RouteProtegee roles={["RESTAURANT", "ADMIN"]} />}>
          <Route path="restaurant/menus" element={<MenusRestaurant />} />
        </Route>

        {/* Communication */}
        <Route element={<RouteProtegee roles={["COMMUNICATION", "ADMIN"]} />}>
          <Route path="communication" element={<Communication />} />
        </Route>

        {/* Comptabilité */}
        <Route element={<RouteProtegee roles={["COMPTABLE", "ADMIN"]} />}>
          <Route path="comptable/tableaux" element={<Tableaux />} />
          <Route path="comptable/reversements" element={<Reversements />} />
          <Route path="comptable/factures" element={<CopiesFactures />} />
          <Route path="comptable/stock" element={<Stock />} />
        </Route>

        {/* Administration */}
        <Route element={<RouteProtegee roles={["ADMIN"]} />}>
          <Route path="admin/comptes" element={<Comptes />} />
          <Route path="admin/categories" element={<Categories />} />
          <Route path="admin/chambres" element={<ChambresAdmin />} />
          <Route path="admin/articles" element={<Stock peutCreer />} />
        </Route>

        <Route path="*" element={<Introuvable />} />
      </Route>
    </Routes>
  );
}

function Introuvable() {
  return (
    <div>
      <TitrePage>Page introuvable</TitrePage>
      <Link to="/" className="text-emerald-800 hover:underline">
        Retour à l'accueil
      </Link>
    </div>
  );
}
