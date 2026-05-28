/**
 * Seed script: populate blind_fabrics table from fabrics_filtered_with_groups.json
 * Run: docker exec signatureshades-api-local npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-blind-fabrics.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    const jsonPath = path.resolve(__dirname, '..', 'fabrics_filtered_with_groups.json');
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data: Record<string, Record<string, { group: string; colors: string[] }>> = JSON.parse(raw);

    let inserted = 0;
    let skipped = 0;

    for (const [supplier, fabrics] of Object.entries(data)) {
        for (const [fabricType, info] of Object.entries(fabrics)) {
            try {
                await prisma.blindFabric.upsert({
                    where: { supplier_fabricType: { supplier, fabricType } },
                    create: {
                        supplier,
                        fabricType,
                        fabricGroup: info.group,
                        colors: info.colors,
                    },
                    update: {
                        fabricGroup: info.group,
                        colors: info.colors,
                    },
                });
                inserted++;
            } catch (err) {
                console.error(`Failed to upsert ${supplier} / ${fabricType}:`, err);
                skipped++;
            }
        }
    }

    console.log(`Done. Upserted: ${inserted}, failed: ${skipped}`);
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
