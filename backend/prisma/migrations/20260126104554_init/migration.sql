-- CreateEnum
CREATE TYPE "ControlSide" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "ChainOrMotor" AS ENUM ('PLASTIC', 'STAINLESS_STEEL', 'AUTOMATE_1_1NM_LI_ION_QUIET', 'AUTOMATE_0_7NM_LI_ION_QUIET', 'AUTOMATE_2NM_LI_ION', 'AUTOMATE_3NM_LI_ION', 'ALPHA_1NM_BATTERY');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('FABRIC', 'BOTTOM_BAR', 'MOTOR', 'CHAIN');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('ADDITION', 'DEDUCTION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('MM', 'UNITS');

-- CreateEnum
CREATE TYPE "WorksheetType" AS ENUM ('FABRIC_CUT', 'TUBE_CUT', 'BOTH');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "order_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_file_name" VARCHAR(500) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worksheet_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "blind_number" VARCHAR(50) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "original_width_mm" INTEGER NOT NULL,
    "original_drop_mm" INTEGER NOT NULL,
    "width_mm" INTEGER NOT NULL,
    "drop_mm" INTEGER NOT NULL,
    "control_side" "ControlSide" NOT NULL,
    "control_color" VARCHAR(100) NOT NULL,
    "chain_or_motor" "ChainOrMotor" NOT NULL,
    "roll_type" VARCHAR(100) NOT NULL,
    "fabric_type" VARCHAR(255) NOT NULL,
    "fabric_color" VARCHAR(100) NOT NULL,
    "bottom_rail_type" VARCHAR(100) NOT NULL,
    "bottom_rail_color" VARCHAR(100) NOT NULL,
    "highlight_flag" BOOLEAN NOT NULL DEFAULT false,
    "worksheet_type" "WorksheetType" NOT NULL DEFAULT 'BOTH',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worksheet_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "color_variant" VARCHAR(100),
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_type" "UnitType" NOT NULL,
    "min_stock_alert" DECIMAL(12,2),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "inventory_item_id" UUID NOT NULL,
    "order_id" UUID,
    "transaction_type" "TransactionType" NOT NULL,
    "quantity_change" DECIMAL(12,2) NOT NULL,
    "new_balance" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_order_date_idx" ON "orders"("order_date");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "worksheet_items_order_id_idx" ON "worksheet_items"("order_id");

-- CreateIndex
CREATE INDEX "worksheet_items_fabric_type_fabric_color_idx" ON "worksheet_items"("fabric_type", "fabric_color");

-- CreateIndex
CREATE INDEX "inventory_items_category_idx" ON "inventory_items"("category");

-- CreateIndex
CREATE INDEX "inventory_items_quantity_idx" ON "inventory_items"("quantity");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_category_item_name_color_variant_key" ON "inventory_items"("category", "item_name", "color_variant");

-- CreateIndex
CREATE INDEX "inventory_transactions_inventory_item_id_idx" ON "inventory_transactions"("inventory_item_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_order_id_idx" ON "inventory_transactions"("order_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_transaction_type_idx" ON "inventory_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "inventory_transactions_created_at_idx" ON "inventory_transactions"("created_at");

-- AddForeignKey
ALTER TABLE "worksheet_items" ADD CONSTRAINT "worksheet_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
