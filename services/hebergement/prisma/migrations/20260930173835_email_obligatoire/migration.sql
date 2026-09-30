/*
  Warnings:

  - Made the column `client_email` on table `reservation` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "reservation" ALTER COLUMN "client_email" SET NOT NULL;
