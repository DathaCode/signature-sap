import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Width ranges: widthFrom (exclusive) → widthTo (inclusive)
const WIDTH_RANGES = [
  { widthFrom: 0,    widthTo: 1999 },
  { widthFrom: 1999, widthTo: 2999 },
  { widthFrom: 2999, widthTo: 3999 },
  { widthFrom: 3999, widthTo: 4999 },
  { widthFrom: 4999, widthTo: 6000 },
];

// Default prices — admin configures these per width range in Pricing Management
const DEFAULTS: Record<string, number[]> = {
  'Alpha DC': [60, 75, 90, 110, 130],
  'Alpha AC': [70, 85, 100, 120, 145],
  'Versa DC': [65, 80, 95, 115, 135],
  'Versa AC': [75, 90, 110, 130, 155],
};

async function main() {
  let created = 0;
  for (const [motorType, prices] of Object.entries(DEFAULTS)) {
    for (let i = 0; i < WIDTH_RANGES.length; i++) {
      await prisma.sheerMotorPricing.upsert({
        where: {
          motorType_widthFrom: {
            motorType,
            widthFrom: WIDTH_RANGES[i].widthFrom,
          },
        },
        update: {},
        create: {
          motorType,
          widthFrom: WIDTH_RANGES[i].widthFrom,
          widthTo:   WIDTH_RANGES[i].widthTo,
          price:     prices[i],
        },
      });
      created++;
    }
  }
  console.log(`Seeded ${created} motor pricing rows`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
