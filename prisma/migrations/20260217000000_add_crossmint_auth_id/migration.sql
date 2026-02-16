-- AlterTable: add crossmint_id and make dynamic_id optional
ALTER TABLE "users" ADD COLUMN "crossmint_id" TEXT;
CREATE UNIQUE INDEX "users_crossmint_id_key" ON "users"("crossmint_id");
ALTER TABLE "users" ALTER COLUMN "dynamic_id" DROP NOT NULL;
