import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sheerInventoryItems = [
  // Hooks
  {
    category: 'SHEER_HOOK' as const,
    itemName: 'S-Fold Hook',
    colorVariant: null as string | null,
    quantity: 10000,
    unitType: 'UNITS' as const,
    minStockAlert: 500,
    price: 0.50,
  },

  // Brackets
  {
    category: 'SHEER_BRACKET' as const,
    itemName: 'Standard Bracket',
    colorVariant: null as string | null,
    quantity: 500,
    unitType: 'UNITS' as const,
    minStockAlert: 50,
    price: 8.00,
  },
  {
    category: 'SHEER_BRACKET' as const,
    itemName: 'Extended Bracket',
    colorVariant: null as string | null,
    quantity: 300,
    unitType: 'UNITS' as const,
    minStockAlert: 30,
    price: 12.00,
  },

  // Wand
  {
    category: 'SHEER_WAND' as const,
    itemName: 'Wand 1250mm',
    colorVariant: null as string | null,
    quantity: 200,
    unitType: 'UNITS' as const,
    minStockAlert: 20,
    price: 10.00,
  },

  // Track Motors
  { category: 'SHEER_MOTOR' as const, itemName: 'Alpha AC Motor', colorVariant: null as string | null, quantity: 50, unitType: 'UNITS' as const, minStockAlert: 5, price: 50.00 },
  { category: 'SHEER_MOTOR' as const, itemName: 'Alpha DC Motor', colorVariant: null as string | null, quantity: 50, unitType: 'UNITS' as const, minStockAlert: 5, price: 50.00 },
  { category: 'SHEER_MOTOR' as const, itemName: 'Versa AC Motor', colorVariant: null as string | null, quantity: 50, unitType: 'UNITS' as const, minStockAlert: 5, price: 50.00 },
  { category: 'SHEER_MOTOR' as const, itemName: 'Versa DC Motor', colorVariant: null as string | null, quantity: 50, unitType: 'UNITS' as const, minStockAlert: 5, price: 50.00 },

  // Remotes
  { category: 'SHEER_REMOTE' as const, itemName: 'Single Channel Remote', colorVariant: null as string | null, quantity: 100, unitType: 'UNITS' as const, minStockAlert: 10, price: 50.00 },
  { category: 'SHEER_REMOTE' as const, itemName: '5 Channel Remote', colorVariant: null as string | null, quantity: 100, unitType: 'UNITS' as const, minStockAlert: 10, price: 50.00 },
  { category: 'SHEER_REMOTE' as const, itemName: '15 Channel Remote', colorVariant: null as string | null, quantity: 50, unitType: 'UNITS' as const, minStockAlert: 5, price: 50.00 },

  // Charger / Hub
  { category: 'SHEER_CHARGER' as const, itemName: 'Alpha Charger', colorVariant: null as string | null, quantity: 50, unitType: 'UNITS' as const, minStockAlert: 5, price: 50.00 },
  { category: 'SHEER_CHARGER' as const, itemName: 'PULSE 2 Hub', colorVariant: null as string | null, quantity: 50, unitType: 'UNITS' as const, minStockAlert: 5, price: 50.00 },
  { category: 'SHEER_CHARGER' as const, itemName: 'Alpha Neo', colorVariant: null as string | null, quantity: 50, unitType: 'UNITS' as const, minStockAlert: 5, price: 50.00 },
];

async function seedSheerInventory() {
  console.log('Seeding sheer curtain inventory...');

  for (const item of sheerInventoryItems) {
    // Check if item already exists
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        category: item.category,
        itemName: item.itemName,
      },
    });

    if (existing) {
      await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: { price: item.price, minStockAlert: item.minStockAlert },
      });
      console.log(`  ~ Updated: ${item.category}: ${item.itemName} ($${item.price})`);
    } else {
      await prisma.inventoryItem.create({
        data: item as any,
      });
      console.log(`  + Created: ${item.category}: ${item.itemName} ($${item.price})`);
    }
  }

  console.log('Sheer inventory seeded successfully');
}

seedSheerInventory()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
