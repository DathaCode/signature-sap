-- ============================================================================
-- Migration: Add Sheer Curtain Module
-- Adds: SHEER_* InventoryCategory values, curtain fields on OrderItem,
--       SheerFabricPricing table, SheerGroupSettings table
-- ============================================================================

-- 1. Extend InventoryCategory enum with SHEER values
ALTER TYPE "InventoryCategory" ADD VALUE IF NOT EXISTS 'SHEER_HOOK';
ALTER TYPE "InventoryCategory" ADD VALUE IF NOT EXISTS 'SHEER_BRACKET';
ALTER TYPE "InventoryCategory" ADD VALUE IF NOT EXISTS 'SHEER_WAND';
ALTER TYPE "InventoryCategory" ADD VALUE IF NOT EXISTS 'SHEER_FABRIC';
ALTER TYPE "InventoryCategory" ADD VALUE IF NOT EXISTS 'SHEER_MOTOR';
ALTER TYPE "InventoryCategory" ADD VALUE IF NOT EXISTS 'SHEER_REMOTE';
ALTER TYPE "InventoryCategory" ADD VALUE IF NOT EXISTS 'SHEER_CHARGER';

-- 2. Add curtain configuration fields to order_items
ALTER TABLE "order_items"
    ADD COLUMN IF NOT EXISTS "curtain_type"       VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "hem"                INTEGER,
    ADD COLUMN IF NOT EXISTS "installation"       VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "track_colour"       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "opening_type"       VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "wand_size"          INTEGER,
    ADD COLUMN IF NOT EXISTS "fullness"           INTEGER;

-- 3. Add Track Type section fields
ALTER TABLE "order_items"
    ADD COLUMN IF NOT EXISTS "requires_tracks"    BOOLEAN,
    ADD COLUMN IF NOT EXISTS "track_type"         VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "motor_type"         VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "track_control_side" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "remotes"            VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "charger_hub"        VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "track_color"        VARCHAR(20);

-- 4. Add Bend section fields
ALTER TABLE "order_items"
    ADD COLUMN IF NOT EXISTS "requires_bent_tracks" BOOLEAN,
    ADD COLUMN IF NOT EXISTS "bend_type"          VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "bend_qty"           INTEGER,
    ADD COLUMN IF NOT EXISTS "bend_file_path"     VARCHAR(500);

-- 5. Add Pelmet section fields
ALTER TABLE "order_items"
    ADD COLUMN IF NOT EXISTS "requires_pelmet"    BOOLEAN,
    ADD COLUMN IF NOT EXISTS "pelmet_type"        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "pelmet_color"       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "pelmet_size"        VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "pelmet_custom_size" INTEGER;

-- 6. Add drop deduction fields
ALTER TABLE "order_items"
    ADD COLUMN IF NOT EXISTS "requires_drop_deduction" BOOLEAN,
    ADD COLUMN IF NOT EXISTS "drop_deduction_value"    INTEGER;

-- 7. Add curtain calculated fields
ALTER TABLE "order_items"
    ADD COLUMN IF NOT EXISTS "deducted_drop"      INTEGER,
    ADD COLUMN IF NOT EXISTS "hook_count"         INTEGER,
    ADD COLUMN IF NOT EXISTS "left_hooks"         INTEGER,
    ADD COLUMN IF NOT EXISTS "right_hooks"        INTEGER,
    ADD COLUMN IF NOT EXISTS "bracket_count"      INTEGER,
    ADD COLUMN IF NOT EXISTS "wand_count"         INTEGER,
    ADD COLUMN IF NOT EXISTS "fabric_length"      INTEGER,
    ADD COLUMN IF NOT EXISTS "drop_surcharge"     DECIMAL(10,2);

-- 8. Add curtain pricing breakdown fields
ALTER TABLE "order_items"
    ADD COLUMN IF NOT EXISTS "hook_cost"          DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "wand_cost"          DECIMAL(10,2);

-- 9. Create SheerFabricPricing table
CREATE TABLE IF NOT EXISTS "sheer_fabric_pricing" (
    "id"             SERIAL PRIMARY KEY,
    "fabric_group"   VARCHAR(50)    NOT NULL,
    "fabric_name"    VARCHAR(100)   NOT NULL,
    "price_per_meter" DECIMAL(10,2) NOT NULL,
    "user_id"        UUID,
    "created_at"     TIMESTAMP(6)   NOT NULL DEFAULT NOW(),
    "updated_at"     TIMESTAMP(6)   NOT NULL DEFAULT NOW(),
    CONSTRAINT "unique_sheer_fabric_pricing" UNIQUE ("fabric_group", "fabric_name", "user_id")
);

-- Foreign key from sheer_fabric_pricing to users
DO $$ BEGIN
    ALTER TABLE "sheer_fabric_pricing"
        ADD CONSTRAINT "sheer_fabric_pricing_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "sheer_fabric_pricing_fabric_group_idx" ON "sheer_fabric_pricing"("fabric_group");
CREATE INDEX IF NOT EXISTS "sheer_fabric_pricing_user_id_idx" ON "sheer_fabric_pricing"("user_id");

-- 10. Create SheerGroupSettings table
CREATE TABLE IF NOT EXISTS "sheer_group_settings" (
    "id"                  SERIAL PRIMARY KEY,
    "fabric_group"        VARCHAR(50)   NOT NULL UNIQUE,
    "drop_surcharge_per_m" DECIMAL(10,2) NOT NULL DEFAULT 60,
    "created_at"          TIMESTAMP(6)  NOT NULL DEFAULT NOW(),
    "updated_at"          TIMESTAMP(6)  NOT NULL DEFAULT NOW()
);
