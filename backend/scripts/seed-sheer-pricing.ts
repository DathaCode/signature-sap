import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sheerFabricPricing = [
  // Group 1 - $100/meter
  { fabricGroup: 'Group 1', fabricName: 'Cannes', pricePerMeter: 100 },
  { fabricGroup: 'Group 1', fabricName: 'Aston', pricePerMeter: 100 },
  { fabricGroup: 'Group 1', fabricName: 'Natural Collection', pricePerMeter: 100 },
  { fabricGroup: 'Group 1', fabricName: 'Zanzibar', pricePerMeter: 100 },
  { fabricGroup: 'Group 1', fabricName: 'Verne', pricePerMeter: 100 },
  { fabricGroup: 'Group 1', fabricName: 'Montreux', pricePerMeter: 100 },
  { fabricGroup: 'Group 1', fabricName: 'Coco', pricePerMeter: 100 },

  // Group 2 - $100/meter
  { fabricGroup: 'Group 2', fabricName: 'Altitude', pricePerMeter: 100 },
  { fabricGroup: 'Group 2', fabricName: 'Arena', pricePerMeter: 100 },
  { fabricGroup: 'Group 2', fabricName: 'Ditto', pricePerMeter: 100 },
  { fabricGroup: 'Group 2', fabricName: 'Georgia', pricePerMeter: 100 },
  { fabricGroup: 'Group 2', fabricName: 'Skye', pricePerMeter: 100 },
  { fabricGroup: 'Group 2', fabricName: 'Seattle', pricePerMeter: 100 },
  { fabricGroup: 'Group 2', fabricName: 'Bronte', pricePerMeter: 100 },

  // Budget - $95/meter
  { fabricGroup: 'Budget', fabricName: 'Bali', pricePerMeter: 95 },
  { fabricGroup: 'Budget', fabricName: 'Melton', pricePerMeter: 95 },

  // Block Out Curtains - $120/meter
  { fabricGroup: 'Block Out Curtains', fabricName: 'Galaxy', pricePerMeter: 120 },
];

async function seedSheerPricing() {
  console.log('Seeding sheer fabric pricing...');

  for (const pricing of sheerFabricPricing) {
    // Check if default pricing already exists
    const existing = await prisma.sheerFabricPricing.findFirst({
      where: {
        fabricGroup: pricing.fabricGroup,
        fabricName: pricing.fabricName,
        userId: null,
      },
    });

    if (existing) {
      await prisma.sheerFabricPricing.update({
        where: { id: existing.id },
        data: { pricePerMeter: pricing.pricePerMeter },
      });
      console.log(`  ~ Updated: ${pricing.fabricGroup}: ${pricing.fabricName} ($${pricing.pricePerMeter}/m)`);
    } else {
      await prisma.sheerFabricPricing.create({
        data: {
          fabricGroup: pricing.fabricGroup,
          fabricName: pricing.fabricName,
          pricePerMeter: pricing.pricePerMeter,
          userId: null,
        },
      });
      console.log(`  + Created: ${pricing.fabricGroup}: ${pricing.fabricName} ($${pricing.pricePerMeter}/m)`);
    }
  }

  console.log('Sheer pricing seeded successfully');
}

seedSheerPricing()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
