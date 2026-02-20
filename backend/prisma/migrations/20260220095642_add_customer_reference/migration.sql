-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_reference" VARCHAR(255);

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "customer_reference" VARCHAR(255);
