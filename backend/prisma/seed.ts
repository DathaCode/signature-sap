import { PrismaClient, InventoryCategory, UnitType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed (80+ items)...\\n');

  // Clear existing data
  console.log('🗑️  Clearing existing inventory...');
  await prisma.inventoryTransaction.deleteMany();
  await prisma.inventoryItem.deleteMany();
  console.log('✅ Existing inventory cleared\\n');

  // ============================================================================
  // MOTORS
  // ============================================================================
  console.log('📦 Seeding Motors...');

  const motors = [
    // Winders (28mm width deduction)
    { name: 'TBS winder-32mm', quantity: 15, price: 48.00 },
    { name: 'Acmeda winder-29mm', quantity: 20, price: 45.00 },

    // Automate motors (29mm width deduction)
    { name: 'Automate 1.1NM Li-Ion Quiet Motor', quantity: 20, price: 120.00 },
    { name: 'Automate 0.7NM Li-Ion Quiet Motor', quantity: 15, price: 110.00 },
    { name: 'Automate 2NM Li-Ion Quiet Motor', quantity: 18, price: 135.00 },
    { name: 'Automate 3NM Li-Ion Motor', quantity: 12, price: 150.00 },
    { name: 'Automate E6 6NM Motor', quantity: 10, price: 180.00 },

    // Alpha Battery motors (30mm width deduction)
    { name: 'Alpha 1NM Battery Motor', quantity: 15, price: 100.00 },
    { name: 'Alpha 2NM Battery Motor', quantity: 12, price: 115.00 },
    { name: 'Alpha 3NM Battery Motor', quantity: 10, price: 130.00 },

    // Alpha AC motors (35mm width deduction)
    { name: 'Alpha AC 5NM Motor', quantity: 8, price: 165.00 },
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
        price: motor.price,
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

    console.log(`  ✓ ${motor.name}: ${motor.quantity} units ($${motor.price})`);
  }

  // ============================================================================
  // BRACKETS
  // ============================================================================
  console.log('\\n📦 Seeding Brackets...');

  const bracketBrands = ['Acmeda', 'TBS'];
  const bracketTypes = ['Single Bracket set', 'Extended Bracket set', 'Duel Bracket set Left', 'Duel Bracket set Right'];
  const bracketColours = ['White', 'Black', 'Sandstone', 'Barley', 'Silver Grey'];

  for (const brand of bracketBrands) {
    for (const type of bracketTypes) {
      // Skip Extended bracket for TBS (not compatible)
      if (brand === 'TBS' && type === 'Extended Bracket set') continue;

      for (const colour of bracketColours) {
        const name = `${brand} ${type} - ${colour}`;
        const quantity = 30;
        const price = type.includes('Extended') ? 22.00 : type.includes('Duel') ? 28.00 : 18.00;

        const item = await prisma.inventoryItem.create({
          data: {
            category: InventoryCategory.BRACKET,
            itemName: name,
            colorVariant: null,
            quantity,
            unitType: UnitType.UNITS,
            minStockAlert: 10,
            price,
          },
        });

        await prisma.inventoryTransaction.create({
          data: {
            inventoryItemId: item.id,
            transactionType: 'ADDITION',
            quantityChange: quantity,
            newBalance: quantity,
            notes: 'Initial stock - Database seed',
          },
        });

        console.log(`  ✓ ${name}: ${quantity} units ($${price})`);
      }
    }
  }

  // ============================================================================
  // CHAINS
  // ============================================================================
  console.log('\\n📦 Seeding Chains...');

  const chainTypes = ['Stainless Steel', 'Plastic Pure White'];
  const chainLengths = [500, 750, 1000, 1200, 1500]; // mm

  for (const chainType of chainTypes) {
    for (const length of chainLengths) {
      const name = `${chainType} Chain - ${length}mm`;
      const quantity = 50;
      const price = length <= 750 ? 8.00 : length <= 1200 ? 10.00 : 12.00;

      const item = await prisma.inventoryItem.create({
        data: {
          category: InventoryCategory.CHAIN,
          itemName: name,
          colorVariant: null,
          quantity,
          unitType: UnitType.UNITS,
          minStockAlert: 15,
          price,
        },
      });

      await prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          transactionType: 'ADDITION',
          quantityChange: quantity,
          newBalance: quantity,
          notes: 'Initial stock - Database seed',
        },
      });

      console.log(`  ✓ ${name}: ${quantity} units ($${price})`);
    }
  }

  // ============================================================================
  // CLIPS
  // ============================================================================
  console.log('\\n📦 Seeding Bottom Bar Clips...');

  const clipPositions = ['Left', 'Right'];
  const bottomRailTypes = ['D30', 'Oval'];
  const clipColours = ['Anodised', 'Black', 'Bone', 'Dune'];

  for (const position of clipPositions) {
    for (const railType of bottomRailTypes) {
      for (const colour of clipColours) {
        const name = `Bottom bar Clips ${position} - ${railType} - ${colour}`;
        const quantity = 100;
        const price = 3.50;

        const item = await prisma.inventoryItem.create({
          data: {
            category: InventoryCategory.CLIP,
            itemName: name,
            colorVariant: null,
            quantity,
            unitType: UnitType.UNITS,
            minStockAlert: 20,
            price,
          },
        });

        await prisma.inventoryTransaction.create({
          data: {
            inventoryItemId: item.id,
            transactionType: 'ADDITION',
            quantityChange: quantity,
            newBalance: quantity,
            notes: 'Initial stock - Database seed',
          },
        });

        console.log(`  ✓ ${name}: ${quantity} units ($${price})`);
      }
    }
  }

  // ============================================================================
  // ACCESSORIES
  // ============================================================================
  console.log('\\n📦 Seeding Accessories...');

  const accessories = [
    { name: 'Acmeda Idler', quantity: 100, price: 8.00 },
    { name: 'Acmeda Clutch', quantity: 100, price: 8.00 },
    { name: 'Stop bolt', quantity: 200, price: 1.50 },
    { name: 'Safety lock', quantity: 200, price: 2.00 },
  ];

  for (const accessory of accessories) {
    const item = await prisma.inventoryItem.create({
      data: {
        category: InventoryCategory.ACCESSORY,
        itemName: accessory.name,
        colorVariant: null,
        quantity: accessory.quantity,
        unitType: UnitType.UNITS,
        minStockAlert: 30,
        price: accessory.price,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        inventoryItemId: item.id,
        transactionType: 'ADDITION',
        quantityChange: accessory.quantity,
        newBalance: accessory.quantity,
        notes: 'Initial stock - Database seed',
      },
    });

    console.log(`  ✓ ${accessory.name}: ${accessory.quantity} units ($${accessory.price})`);
  }

  // ============================================================================
  // BOTTOM BARS (TUBES)
  // ============================================================================
  console.log('\\n📦 Seeding Bottom Bars (Tubes)...');

  const tubeTypes = ['D30', 'Oval'];
  const tubeColours = ['Anodised', 'Black', 'Bone', 'Dune'];

  for (const tubeType of tubeTypes) {
    for (const colour of tubeColours) {
      const name = `${tubeType} - ${colour}`;
      const quantity = 50;
      const price = 12.00;

      const item = await prisma.inventoryItem.create({
        data: {
          category: InventoryCategory.BOTTOM_BAR,
          itemName: name,
          colorVariant: null,
          quantity,
          unitType: UnitType.UNITS,
          minStockAlert: 10,
          price,
        },
      });

      await prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          transactionType: 'ADDITION',
          quantityChange: quantity,
          newBalance: quantity,
          notes: 'Initial stock - Database seed',
        },
      });

      console.log(`  ✓ ${name}: ${quantity} units ($${price})`);
    }
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\\n✨ Seed completed successfully!\\n');

  const totalItems = await prisma.inventoryItem.count();
  const totalTransactions = await prisma.inventoryTransaction.count();

  // Count by category
  const categoryCount = await prisma.inventoryItem.groupBy({
    by: ['category'],
    _count: true,
  });

  console.log('📊 Summary:');
  console.log(`   Total Items: ${totalItems}`);
  console.log(`   Total Transactions: ${totalTransactions}`);
  console.log('\\n   By Category:');
  categoryCount.forEach(cat => {
    console.log(`     ${cat.category}: ${cat._count} items`);
  });
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
