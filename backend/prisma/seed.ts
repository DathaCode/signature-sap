import { PrismaClient, InventoryCategory, UnitType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clear existing data (optional - remove in production)
  console.log('🗑️  Clearing existing inventory...');
  await prisma.inventoryTransaction.deleteMany();
  await prisma.inventoryItem.deleteMany();
  console.log('✅ Existing inventory cleared\n');

  // ============================================================================
  // SEED FABRICS
  // ============================================================================
  console.log('📦 Seeding Fabrics...');
  
  const fabrics = [
    { name: 'Vista Silver', quantity: 10000 },
    { name: 'Versatile Grey', quantity: 10000 },
    { name: 'Sanctuary Plaster', quantity: 10000 },
    { name: 'Versatile Ice', quantity: 10000 },
    { name: 'Nature Pearl', quantity: 8000 },
    { name: 'Essence Ivory', quantity: 8000 },
    { name: 'Mineral Smoke', quantity: 7500 },
    { name: 'Urban Charcoal', quantity: 7500 },
  ];

  for (const fabric of fabrics) {
    const item = await prisma.inventoryItem.create({
      data: {
        category: InventoryCategory.FABRIC,
        itemName: fabric.name,
        colorVariant: null, // Fabrics don't have separate color variants
        quantity: fabric.quantity,
        unitType: UnitType.MM,
        minStockAlert: 2000,
      },
    });

    // Create initial transaction record
    await prisma.inventoryTransaction.create({
      data: {
        inventoryItemId: item.id,
        transactionType: 'ADDITION',
        quantityChange: fabric.quantity,
        newBalance: fabric.quantity,
        notes: 'Initial stock - Database seed',
      },
    });

    console.log(`  ✓ ${fabric.name}: ${fabric.quantity}mm`);
  }

  // ============================================================================
  // SEED BOTTOM BARS
  // ============================================================================
  console.log('\n📦 Seeding Bottom Bars...');
  
  const bottomBars = [
    { color: 'Anodised', quantity: 50 },
    { color: 'Black', quantity: 50 },
    { color: 'White', quantity: 50 },
    { color: 'Bone', quantity: 40 },
    { color: 'Dune', quantity: 40 },
    { color: 'Silver', quantity: 35 },
    { color: 'Bronze', quantity: 30 },
  ];

  for (const bar of bottomBars) {
    const item = await prisma.inventoryItem.create({
      data: {
        category: InventoryCategory.BOTTOM_BAR,
        itemName: 'Bottom Bar',
        colorVariant: bar.color,
        quantity: bar.quantity,
        unitType: UnitType.UNITS,
        minStockAlert: 10,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        inventoryItemId: item.id,
        transactionType: 'ADDITION',
        quantityChange: bar.quantity,
        newBalance: bar.quantity,
        notes: 'Initial stock - Database seed',
      },
    });

    console.log(`  ✓ Bottom Bar (${bar.color}): ${bar.quantity} units`);
  }

  // ============================================================================
  // SEED MOTORS
  // ============================================================================
  console.log('\n📦 Seeding Motors...');
  
  const motors = [
    { name: 'Automate 1.1NM Li-Ion Quiet', quantity: 20 },
    { name: 'Automate 0.7NM Li-Ion Quiet', quantity: 15 },
    { name: 'Automate 2NM Li-Ion', quantity: 18 },
    { name: 'Automate 3NM Li-Ion', quantity: 12 },
  ];

  for (const motor of motors) {
    const item = await prisma.inventoryItem.create({
      data: {
        category: InventoryCategory.MOTOR,
        itemName: motor.name,
        colorVariant: null,
        quantity: motor.quantity,
        unitType: UnitType.UNITS,
        minStockAlert: 5,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        inventoryItemId: item.id,
        transactionType: 'ADDITION',
        quantityChange: motor.quantity,
        newBalance: motor.quantity,
        notes: 'Initial stock - Database seed',
      },
    });

    console.log(`  ✓ ${motor.name}: ${motor.quantity} units`);
  }

  // ============================================================================
  // SEED CHAINS
  // ============================================================================
  console.log('\n📦 Seeding Chains...');
  
  const chains = [
    { name: 'Stainless Steel Chain', quantity: 100 },
    { name: 'Plastic Chain', quantity: 100 },
    { name: 'Automate 1.1NM Li-Ion Quiet Chain', quantity: 50 },
    { name: 'Alpha 1NM Battery Chain', quantity: 40 },
  ];

  for (const chain of chains) {
    const item = await prisma.inventoryItem.create({
      data: {
        category: InventoryCategory.CHAIN,
        itemName: chain.name,
        colorVariant: null,
        quantity: chain.quantity,
        unitType: UnitType.UNITS,
        minStockAlert: 20,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        inventoryItemId: item.id,
        transactionType: 'ADDITION',
        quantityChange: chain.quantity,
        newBalance: chain.quantity,
        notes: 'Initial stock - Database seed',
      },
    });

    console.log(`  ✓ ${chain.name}: ${chain.quantity} units`);
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n✨ Seed completed successfully!\n');
  
  const totalItems = await prisma.inventoryItem.count();
  const totalTransactions = await prisma.inventoryTransaction.count();
  
  console.log('📊 Summary:');
  console.log(`   Inventory Items: ${totalItems}`);
  console.log(`   Transactions: ${totalTransactions}`);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
