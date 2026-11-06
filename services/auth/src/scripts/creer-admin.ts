import { z } from "zod";
import { prisma } from "../db.js";
import { hacherMotDePasse } from "../mot-de-passe.js";
import { email } from "../modules/utilisateur/utilisateur.schema.js";
import { telephone} from  "@hotel/commun";

// Crée le premier compte ADMIN (personne ne peut le créer via l'API, puisqu'il faut déjà être ADMIN).
// Usage :
//   ADMIN_TELEPHONE=0340000001 ADMIN_EMAIL=direction@hotel.mg ADMIN_NOM="Direction" \
//   ADMIN_MOT_DE_PASSE='…' pnpm --filter @hotel/auth creer-admin
const saisie = z
  .object({
    ADMIN_TELEPHONE: telephone,
    ADMIN_EMAIL: email,
    ADMIN_NOM: z.string().min(2).default("Administrateur"),
    ADMIN_MOT_DE_PASSE: z.string().min(10),
  })
  .parse(process.env);

const existant = await prisma.utilisateur.findUnique({ where: { telephone: saisie.ADMIN_TELEPHONE } });
if (existant) {
  console.log(`Un compte existe déjà pour ${saisie.ADMIN_TELEPHONE} (rôle ${existant.role}). Rien n'a été modifié.`);
} else {
  const admin = await prisma.utilisateur.create({
    data: {
      nom: saisie.ADMIN_NOM,
      telephone: saisie.ADMIN_TELEPHONE,
      email: saisie.ADMIN_EMAIL,
      motDePasseHash: await hacherMotDePasse(saisie.ADMIN_MOT_DE_PASSE),
      role: "ADMIN",
    },
  });
  console.log(`Compte ADMIN créé : ${admin.telephone} (${admin.email})`);
}
await prisma.$disconnect();
