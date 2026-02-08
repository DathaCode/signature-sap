-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "optimized_at" TIMESTAMP(6),
ADD COLUMN     "panel_rotated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sheet_number" INTEGER,
ADD COLUMN     "sheet_position_x" INTEGER,
ADD COLUMN     "sheet_position_y" INTEGER;

-- CreateTable
CREATE TABLE "worksheet_data" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "fabric_cut_data" JSONB NOT NULL,
    "tube_cut_data" JSONB NOT NULL,
    "total_fabric_mm" INTEGER NOT NULL,
    "total_tube_pieces" INTEGER NOT NULL,
    "accepted_at" TIMESTAMP(6),
    "accepted_by" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "worksheet_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "worksheet_data_order_id_key" ON "worksheet_data"("order_id");

-- AddForeignKey
ALTER TABLE "worksheet_data" ADD CONSTRAINT "worksheet_data_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
