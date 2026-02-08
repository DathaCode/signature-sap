/*
  Warnings:

  - The `status` column on the `orders` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[order_number]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `order_number` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PRODUCTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('BLINDS', 'CURTAINS', 'SHUTTERS');

-- CreateEnum
CREATE TYPE "FileSource" AS ENUM ('WEB_FORM', 'EXCEL_UPLOAD');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "admin_notes" TEXT,
ADD COLUMN     "confirmed_at" TIMESTAMP(6),
ADD COLUMN     "confirmed_by" VARCHAR(255),
ADD COLUMN     "customer_company" VARCHAR(255),
ADD COLUMN     "customer_email" VARCHAR(255),
ADD COLUMN     "customer_phone" VARCHAR(50),
ADD COLUMN     "date_required" TIMESTAMP(6),
ADD COLUMN     "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "file_source" "FileSource" NOT NULL DEFAULT 'WEB_FORM',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "order_number" VARCHAR(50) NOT NULL,
ADD COLUMN     "product_type" "ProductType" NOT NULL DEFAULT 'BLINDS',
ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "user_id" UUID,
ALTER COLUMN "uploaded_file_name" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "company" VARCHAR(255),
    "address" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" UUID NOT NULL,
    "item_number" INTEGER NOT NULL,
    "item_type" VARCHAR(50) NOT NULL DEFAULT 'blind',
    "location" VARCHAR(255) NOT NULL,
    "width" INTEGER NOT NULL,
    "drop" INTEGER NOT NULL,
    "fixing" VARCHAR(100),
    "bracket_type" VARCHAR(100),
    "bracket_colour" VARCHAR(100),
    "control_side" VARCHAR(20),
    "chain_or_motor" VARCHAR(255),
    "roll" VARCHAR(20),
    "material" VARCHAR(100),
    "fabric_type" VARCHAR(255),
    "fabric_colour" VARCHAR(100),
    "bottom_rail_type" VARCHAR(100),
    "bottom_rail_colour" VARCHAR(100),
    "calculated_width" INTEGER,
    "calculated_drop" INTEGER,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "fabric_group" INTEGER,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_matrix" (
    "id" SERIAL NOT NULL,
    "fabric_group" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "drop" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "updated_by" VARCHAR(255),
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "pricing_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "quote_number" VARCHAR(50) NOT NULL,
    "user_id" UUID NOT NULL,
    "product_type" "ProductType" NOT NULL,
    "items" JSONB NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "converted_to_order" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_material_fabric_type_idx" ON "order_items"("material", "fabric_type");

-- CreateIndex
CREATE INDEX "pricing_matrix_fabric_group_idx" ON "pricing_matrix"("fabric_group");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_matrix_fabric_group_width_drop_key" ON "pricing_matrix"("fabric_group", "width", "drop");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quote_number_key" ON "quotes"("quote_number");

-- CreateIndex
CREATE INDEX "quotes_user_id_idx" ON "quotes"("user_id");

-- CreateIndex
CREATE INDEX "quotes_quote_number_idx" ON "quotes"("quote_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_product_type_idx" ON "orders"("product_type");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
