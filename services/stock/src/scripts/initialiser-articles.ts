import { prisma } from "../db.js";

// Les 4 articles du sujet : 1 nuitée consomme 1 de chaque. Sans effet s'ils existent déjà.
// Usage : pnpm --filter @hotel/stock initialiser-articles
const ARTICLES = [
  { code: "GEL_DOUCHE", libelle: { fr: "Gel douche", mg: "Savony fandroana" } },
  { code: "PAPIER_HYGIENIQUE", libelle: { fr: "Papier hygiénique", mg: "Taratasy fidiovana" } },
  { code: "PANTOUFLE", libelle: { fr: "Paire de pantoufles", mg: "Kapa" } },
  { code: "BROSSE_A_DENTS", libelle: { fr: "Brosse à dents", mg: "Borosy nify" } },
];

for (const a of ARTICLES) {
  await prisma.article.upsert({ where: { code: a.code }, update: {}, create: { ...a, seuilAlerte: 20, consommationParNuitee: 1 } });
  console.log(`article ${a.code} prêt`);
}
await prisma.$disconnect();
