-- CreateTable
CREATE TABLE "blind_fabrics" (
    "id" TEXT NOT NULL,
    "supplier" VARCHAR(100) NOT NULL,
    "fabric_type" VARCHAR(255) NOT NULL,
    "fabric_group" VARCHAR(10) NOT NULL,
    "colors" TEXT[],
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "blind_fabrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blind_fabrics_supplier_idx" ON "blind_fabrics"("supplier");

-- CreateIndex
CREATE INDEX "blind_fabrics_fabric_group_idx" ON "blind_fabrics"("fabric_group");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "blind_fabrics_supplier_fabric_type_key" ON "blind_fabrics"("supplier", "fabric_type");
