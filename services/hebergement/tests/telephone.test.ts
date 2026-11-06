import { afterAll, beforeEach, describe, expect, it} from "vitest";
import { bus} from "../src/bus.js";
import { prisma} from "../src/db.js";
import { appel, creerCategorie, creerChambre, demandeReservation, RECEPTION, viderBase, viderFiles} from "./aide.js";

describe("Téléphone de la réservation", () => {
    let categorieId: string;

    beforeEach(async () => {
        await viderBase();
        await viderFiles();
        categorieId = (await creerCategorie()).id;
        await creerChambre(categorieId, "101");
    });
    afterAll(async () => {
        await bus.fermer();
        await prisma.$disconnect();
    });

    //Une réservation dont seul le téléphone change : spread (leçon 04)
    const reserverAvec = (clientTelephone: string) =>
        appel("post", "/reservations", RECEPTION).send({
            ...demandeReservation(categorieId, "2030-10-10", "2030-10-13"),
            clientTelephone,
        });
    it("accepte un téléphone avec des espaces, et l'enregistre normalisé", async () => {
        const res =  await reserverAvec("034 12 345 67");

        expect(res.status).toBe(201);
        expect(res.body.clientTelephone).toBe("0341234567");
    });

    it("accepte un téléphone qui débute en +261", async () => {
        const res = await reserverAvec("+261 34 12 345 67");

        expect(res.status).toBe(201);
        expect(res.body.clientTelephone).toBe("0341234567");
    });

    it("refuse un numéro avec un prefixe inconnu 035", async () => {
        const res = await reserverAvec("0351234567");

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.details).toContainEqual(
            expect.objectContaining({ champ: "clientTelephone" }), // …une erreur qui porte sur le champ téléphone
        );

    });
    
});