-- ============================================================================
-- Migration: Restructure Inventory Categories
-- Removes: BRACKET, CLIP
-- Adds: BOTTOM_BAR_CLIP, ACMEDA, TBS
-- ============================================================================

-- 1. Delete all transactions for items that will be removed (BRACKET, CLIP)
DELETE FROM "inventory_transactions"
WHERE "inventory_item_id" IN (
  SELECT id FROM "inventory_items"
  WHERE category IN ('BRACKET', 'CLIP')
);

-- 2. Delete the items themselves
DELETE FROM "inventory_items" WHERE category IN ('BRACKET', 'CLIP');

-- 3. Also clear MOTOR and ACCESSORY items (full reseed)
DELETE FROM "inventory_transactions"
WHERE "inventory_item_id" IN (
  SELECT id FROM "inventory_items"
  WHERE category IN ('MOTOR', 'ACCESSORY', 'CHAIN', 'BOTTOM_BAR')
);
DELETE FROM "inventory_items"
WHERE category IN ('MOTOR', 'ACCESSORY', 'CHAIN', 'BOTTOM_BAR');

-- 4. Add new enum values to the existing type
ALTER TYPE "InventoryCategory" ADD VALUE IF NOT EXISTS 'BOTTOM_BAR_CLIP';
ALTER TYPE "InventoryCategory" ADD VALUE IF NOT EXISTS 'ACMEDA';
ALTER TYPE "InventoryCategory" ADD VALUE IF NOT EXISTS 'TBS';

-- 5. Recreate the enum without BRACKET and CLIP
--    PostgreSQL requires recreating the type to remove values
CREATE TYPE "InventoryCategory_new" AS ENUM (
  'FABRIC',
  'BOTTOM_BAR',
  'BOTTOM_BAR_CLIP',
  'CHAIN',
  'ACMEDA',
  'TBS',
  'MOTOR',
  'ACCESSORY'
);

-- 6. Migrate the column to the new type
ALTER TABLE "inventory_items"
  ALTER COLUMN "category" TYPE "InventoryCategory_new"
  USING "category"::text::"InventoryCategory_new";

-- 7. Drop old type and rename new one
DROP TYPE "InventoryCategory";
ALTER TYPE "InventoryCategory_new" RENAME TO "InventoryCategory";
