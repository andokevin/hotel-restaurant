/*
  Warnings:

  - Made the column `email` on table `utilisateur` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "utilisateur" ALTER COLUMN "email" SET NOT NULL;
