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

  // ─── PRICING MATRIX SEED ───────────────────────────────────
  console.log('\\n💰 Seeding Pricing Matrix...');

  const PRICING_DATA: Record<number, Record<number, Record<number, number>>> = {
    1: {
      600: { 1200: 56.16, 1400: 58.24, 1600: 60.32, 1800: 62.4, 2000: 65.52, 2200: 68.64, 2400: 70.72, 2600: 72.8, 2800: 74.88, 3000: 78 },
      800: { 1200: 60.32, 1400: 62.4, 1600: 65.52, 1800: 68.64, 2000: 70.72, 2200: 72.8, 2400: 75.92, 2600: 79.04, 2800: 81.12, 3000: 83.2 },
      1000: { 1200: 62.4, 1400: 65.52, 1600: 68.64, 1800: 70.72, 2000: 72.8, 2200: 75.92, 2400: 79.04, 2600: 81.12, 2800: 83.2, 3000: 85.28 },
      1200: { 1200: 69.68, 1400: 71.76, 1600: 74.88, 1800: 78, 2000: 81.12, 2200: 83.2, 2400: 86.32, 2600: 89.44, 2800: 92.56, 3000: 95.68 },
      1400: { 1200: 74.88, 1400: 79.04, 1600: 82.16, 1800: 84.24, 2000: 87.36, 2200: 91.52, 2400: 95.68, 2600: 98.8, 2800: 102.96, 3000: 106.08 },
      1600: { 1200: 81.9, 1400: 85.05, 1600: 88.2, 1800: 92.4, 2000: 97.65, 2200: 100.8, 2400: 105, 2600: 108.15, 2800: 112.35, 3000: 116.55 },
      1800: { 1200: 88.2, 1400: 92.4, 1600: 97.65, 1800: 102.9, 2000: 106.05, 2200: 110.25, 2400: 115.5, 2600: 118.65, 2800: 123.9, 3000: 128.1 },
      2000: { 1200: 93.45, 1400: 98.7, 1600: 103.95, 1800: 108.15, 2000: 112.35, 2200: 117.6, 2400: 120.75, 2600: 127.05, 2800: 131.25, 3000: 135.45 },
      2200: { 1200: 116.55, 1400: 121.8, 1600: 128.1, 1800: 132.3, 2000: 138.6, 2200: 142.8, 2400: 147, 2600: 154.35, 2800: 158.55, 3000: 163.8 },
      2400: { 1200: 124.95, 1400: 131.25, 1600: 135.45, 1800: 141.75, 2000: 147, 2200: 153.3, 2400: 158.55, 2600: 164.85, 2800: 169.05, 3000: 175.35 },
      2600: { 1200: 154.76, 1400: 160.06, 1600: 166.42, 1800: 171.72, 2000: 178.08, 2200: 184.44, 2400: 190.8, 2600: 196.1, 2800: 202.46, 3000: 208.82 },
      2800: { 1200: 160.06, 1400: 167.48, 1600: 172.78, 1800: 180.2, 2000: 186.56, 2200: 192.92, 2400: 200.34, 2600: 205.64, 2800: 214.12, 3000: 219.42 },
      3000: { 1200: 163.24, 1400: 170.66, 1600: 178.08, 1800: 186.56, 2000: 193.98, 2200: 201.4, 2400: 209.88, 2600: 217.3, 2800: 224.72, 3000: 231.08 }
    },
    2: {
      600: { 1200: 62.4, 1400: 65.52, 1600: 68.64, 1800: 70.72, 2000: 72.8, 2200: 74.88, 2400: 78, 2600: 80.08, 2800: 81.12, 3000: 83.2 },
      800: { 1200: 66.56, 1400: 69.68, 1600: 72.8, 1800: 74.88, 2000: 78, 2200: 80.08, 2400: 82.16, 2600: 84.24, 2800: 89.44, 3000: 95.68 },
      1000: { 1200: 69.68, 1400: 72.8, 1600: 75.92, 1800: 79.04, 2000: 82.16, 2200: 85.28, 2400: 89.44, 2600: 91.52, 2800: 95.68, 3000: 98.8 },
      1200: { 1200: 75.92, 1400: 80.08, 1600: 83.2, 1800: 87.36, 2000: 91.52, 2200: 95.68, 2400: 99.84, 2600: 104, 2800: 107.12, 3000: 111.28 },
      1400: { 1200: 83.2, 1400: 87.36, 1600: 91.52, 1800: 96.72, 2000: 101.92, 2200: 106.08, 2400: 110.24, 2600: 114.4, 2800: 118.56, 3000: 123.76 },
      1600: { 1200: 91.35, 1400: 96.6, 1600: 100.8, 1800: 107.1, 2000: 111.3, 2200: 116.55, 2400: 121.8, 2600: 128.1, 2800: 132.3, 3000: 136.5 },
      1800: { 1200: 99.75, 1400: 106.05, 1600: 110.25, 1800: 117.6, 2000: 121.8, 2200: 129.15, 2400: 134.4, 2600: 139.65, 2800: 144.9, 3000: 152.25 },
      2000: { 1200: 106.05, 1400: 111.3, 1600: 117.6, 1800: 124.95, 2000: 131.25, 2200: 136.5, 2400: 142.8, 2600: 151.2, 2800: 156.45, 3000: 162.75 },
      2200: { 1200: 136.5, 1400: 143.85, 1600: 152.25, 1800: 157.5, 2000: 164.85, 2200: 171.15, 2400: 179.55, 2600: 186.9, 2800: 192.15, 3000: 198.45 },
      2400: { 1200: 145.95, 1400: 154.35, 1600: 162.75, 1800: 169.05, 2000: 176.4, 2200: 184.8, 2400: 192.15, 2600: 199.5, 2800: 206.85, 3000: 213.15 },
      2600: { 1200: 169.6, 1400: 177.02, 1600: 185.5, 1800: 193.98, 2000: 202.46, 2200: 210.94, 2400: 218.36, 2600: 226.84, 2800: 235.32, 3000: 243.8 },
      2800: { 1200: 177.02, 1400: 185.5, 1600: 195.04, 1800: 203.52, 2000: 213.06, 2200: 221.54, 2400: 230.02, 2600: 240.62, 2800: 246.98, 3000: 256.52 },
      3000: { 1200: 186.56, 1400: 195.04, 1600: 204.58, 1800: 215.18, 2000: 224.72, 2200: 233.2, 2400: 242.74, 2600: 252.28, 2800: 262.88, 3000: 271.36 }
    },
    3: {
      600: { 1200: 65.52, 1400: 68.64, 1600: 70.72, 1800: 73.84, 2000: 75.92, 2200: 81.12, 2400: 84.24, 2600: 87.36, 2800: 91.52, 3000: 95.68 },
      800: { 1200: 72.8, 1400: 75.92, 1600: 79.04, 1800: 82.16, 2000: 85.28, 2200: 89.44, 2400: 93.6, 2600: 97.76, 2800: 102.96, 3000: 107.12 },
      1000: { 1200: 74.88, 1400: 79.04, 1600: 83.2, 1800: 86.32, 2000: 91.52, 2200: 95.68, 2400: 99.84, 2600: 104, 2800: 108.16, 3000: 111.28 },
      1200: { 1200: 83.2, 1400: 87.36, 1600: 92.56, 1800: 97.76, 2000: 102.96, 2200: 107.12, 2400: 111.28, 2600: 117.52, 2800: 122.72, 3000: 127.92 },
      1400: { 1200: 91.52, 1400: 97.76, 1600: 102.96, 1800: 108.16, 2000: 114.4, 2200: 118.56, 2400: 125.84, 2600: 131.04, 2800: 137.28, 3000: 141.44 },
      1600: { 1200: 100.8, 1400: 107.1, 1600: 114.45, 1800: 119.7, 2000: 127.05, 2200: 133.35, 2400: 139.65, 2600: 144.9, 2800: 153.3, 3000: 158.55 },
      1800: { 1200: 110.25, 1400: 117.6, 1600: 124.95, 1800: 131.25, 2000: 139.65, 2200: 145.95, 2400: 154.35, 2600: 160.65, 2800: 168, 3000: 175.35 },
      2000: { 1200: 117.6, 1400: 124.95, 1600: 133.35, 1800: 141.75, 2000: 148.05, 2200: 157.5, 2400: 164.85, 2600: 172.2, 2800: 181.65, 3000: 113.4 },
      2200: { 1200: 142.8, 1400: 153.3, 1600: 160.65, 1800: 169.05, 2000: 178.5, 2200: 187.95, 2400: 195.3, 2600: 203.7, 2800: 213.15, 3000: 222.6 },
      2400: { 1200: 154.35, 1400: 163.8, 1600: 172.2, 1800: 182.7, 2000: 191.1, 2200: 200.55, 2400: 211.05, 2600: 219.45, 2800: 228.9, 3000: 239.4 },
      2600: { 1200: 185.5, 1400: 195.04, 1600: 205.64, 1800: 216.24, 2000: 226.84, 2200: 237.44, 2400: 246.98, 2600: 256.52, 2800: 268.18, 3000: 277.72 },
      2800: { 1200: 193.98, 1400: 204.58, 1600: 216.24, 1800: 227.9, 2000: 239.56, 2200: 250.16, 2400: 260.76, 2600: 271.36, 2800: 281.96, 3000: 294.68 },
      3000: { 1200: 204.58, 1400: 216.24, 1600: 227.9, 1800: 240.62, 2000: 252.28, 2200: 265, 2400: 275.6, 2600: 287.26, 2800: 299.98, 3000: 311.64 }
    }
  };

  let pricingCount = 0;
  for (const [groupStr, widths] of Object.entries(PRICING_DATA)) {
    const fabricGroup = parseInt(groupStr);
    for (const [widthStr, drops] of Object.entries(widths)) {
      const width = parseInt(widthStr);
      for (const [dropStr, price] of Object.entries(drops)) {
        const drop = parseInt(dropStr);
        await prisma.pricingMatrix.upsert({
          where: { fabricGroup_width_drop: { fabricGroup, width, drop } },
          update: { price, updatedBy: 'seed' },
          create: { fabricGroup, width, drop, price, updatedBy: 'seed' }
        });
        pricingCount++;
      }
    }
  }
  console.log(`✅ Pricing Matrix seeded: ${pricingCount} entries (3 groups × 13 widths × 10 drops)`);

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
