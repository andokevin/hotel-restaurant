import { z } from "zod";
import { prisma } from "../db.js";
import { hacherMotDePasse } from "../mot-de-passe.js";

// Crée le premier compte ADMIN (personne ne peut le créer via l'API, puisqu'il faut déjà être ADMIN).
// Usage :
//   ADMIN_EMAIL=direction@hotel.mg ADMIN_NOM="Direction" ADMIN_MOT_DE_PASSE='…' pnpm --filter @hotel/auth creer-admin
const saisie = z
  .object({
    ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
    ADMIN_NOM: z.string().min(2).default("Administrateur"),
    ADMIN_MOT_DE_PASSE: z.string().min(10),
  })
  .parse(process.env);

const existant = await prisma.utilisateur.findUnique({ where: { email: saisie.ADMIN_EMAIL } });
if (existant) {
  console.log(`Un compte existe déjà pour ${saisie.ADMIN_EMAIL} (rôle ${existant.role}). Rien n'a été modifié.`);
} else {
  const admin = await prisma.utilisateur.create({
    data: {
      email: saisie.ADMIN_EMAIL,
      nomComplet: saisie.ADMIN_NOM,
      motDePasseHash: await hacherMotDePasse(saisie.ADMIN_MOT_DE_PASSE),
      role: "ADMIN",
    },
  });
  console.log(`Compte ADMIN créé : ${admin.email}`);
}
await prisma.$disconnect();
