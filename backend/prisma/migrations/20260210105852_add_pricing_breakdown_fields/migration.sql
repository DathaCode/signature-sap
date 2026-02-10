-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "bracket_price" DECIMAL(10,2),
ADD COLUMN     "chain_price" DECIMAL(10,2),
ADD COLUMN     "clips_price" DECIMAL(10,2),
ADD COLUMN     "component_price" DECIMAL(10,2),
ADD COLUMN     "fabric_price" DECIMAL(10,2),
ADD COLUMN     "motor_price" DECIMAL(10,2);
