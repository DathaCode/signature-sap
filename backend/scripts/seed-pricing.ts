import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Pricing Matrix Seed Script
 * Creates base prices for 5 fabric groups across all width/drop combinations
 * 
 * Fabric Groups:
 * - Group 1: Budget fabrics (20% discount)
 * - Group 2: Standard fabrics (25% discount)
 * - Group 3: Premium fabrics (30% discount)
 * - Group 4: Luxury fabrics (no discount)
 * - Group 5: Designer fabrics (no discount)
 * 
 * Dimensions:
 * - Widths: 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000 (mm)
 * - Drops:  1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000 (mm)
 */

const WIDTHS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000];
const DROPS = [1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000];
const FABRIC_GROUPS = [1, 2, 3, 4, 5];

/**
 * Calculate base price for a given width and drop
 * Formula: base = (width * drop) / 1000000 * multiplier
 */
function calculateBasePrice(width: number, drop: number, fabricGroup: number): number {
    // Area in square meters
    const area = (width * drop) / 1000000;

    // Group-based multipliers (adjust these to realistic market prices)
    const multipliers: Record<number, number> = {
        1: 15000,  // Group 1: ~LKR 15,000 per sqm
        2: 18000,  // Group 2: ~LKR 18,000 per sqm
        3: 22000,  // Group 3: ~LKR 22,000 per sqm
        4: 28000,  // Group 4: ~LKR 28,000 per sqm
        5: 35000   // Group 5: ~LKR 35,000 per sqm
    };

    const basePrice = area * multipliers[fabricGroup];

    // Round to nearest 100
    return Math.round(basePrice / 100) * 100;
}

async function main() {
    console.log('💰 Seeding Pricing Matrix...');
    console.log(`📊 Total entries: ${FABRIC_GROUPS.length} groups × ${WIDTHS.length} widths × ${DROPS.length} drops = ${FABRIC_GROUPS.length * WIDTHS.length * DROPS.length}`);

    let created = 0;
    let updated = 0;

    for (const fabricGroup of FABRIC_GROUPS) {
        console.log(`\n📦 Processing Fabric Group ${fabricGroup}...`);

        for (const width of WIDTHS) {
            for (const drop of DROPS) {
                const price = calculateBasePrice(width, drop, fabricGroup);

                // Upsert (create or update)
                await prisma.pricingMatrix.upsert({
                    where: {
                        fabricGroup_width_drop: {
                            fabricGroup,
                            width,
                            drop
                        }
                    },
                    update: {
                        price,
                        updatedBy: 'seed-script'
                    },
                    create: {
                        fabricGroup,
                        width,
                        drop,
                        price,
                        updatedBy: 'seed-script'
                    }
                });

                const existing = await prisma.pricingMatrix.findUnique({
                    where: {
                        fabricGroup_width_drop: {
                            fabricGroup,
                            width,
                            drop
                        }
                    }
                });

                if (existing) {
                    updated++;
                } else {
                    created++;
                }
            }
        }

        console.log(`   ✅ Group ${fabricGroup} complete (${WIDTHS.length * DROPS.length} entries)`);
    }

    console.log('\n✅ Pricing matrix seeded successfully!');
    console.log(`📈 Created: ${created} | Updated: ${updated}`);
    console.log('\n💡 Sample prices:');
    console.log(`   - Group 1 (1200×1800): LKR ${calculateBasePrice(1200, 1800, 1)}`);
    console.log(`   - Group 3 (1600×2000): LKR ${calculateBasePrice(1600, 2000, 3)}`);
    console.log(`   - Group 5 (2400×2400): LKR ${calculateBasePrice(2400, 2400, 5)}`);
}

main()
    .catch((e) => {
        console.error('❌ Error seeding pricing matrix:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
