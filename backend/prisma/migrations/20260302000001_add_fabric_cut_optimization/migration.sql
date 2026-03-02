-- AlterTable
ALTER TABLE "orders" ADD COLUMN "fabric_cut_optimization" JSONB,
ADD COLUMN "worksheet_generated_at" TIMESTAMP(6);
