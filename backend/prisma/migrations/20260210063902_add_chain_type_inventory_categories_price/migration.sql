-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryCategory" ADD VALUE 'BRACKET';
ALTER TYPE "InventoryCategory" ADD VALUE 'CLIP';
ALTER TYPE "InventoryCategory" ADD VALUE 'ACCESSORY';

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "price" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "chain_type" VARCHAR(100);
