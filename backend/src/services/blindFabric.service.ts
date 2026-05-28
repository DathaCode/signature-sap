import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type FabricDataFormatted = Record<
    string,
    Record<string, { group: string; colors: string[] }>
>;

export interface AdminSupplier {
    name: string;
    fabrics: Array<{
        id: string;
        fabricType: string;
        fabricGroup: string;
        colors: string[];
    }>;
}

export async function getAllFabricsFormatted(): Promise<FabricDataFormatted> {
    const fabrics = await prisma.blindFabric.findMany({
        orderBy: [{ supplier: 'asc' }, { fabricType: 'asc' }],
    });

    const result: FabricDataFormatted = {};
    for (const f of fabrics) {
        if (!result[f.supplier]) result[f.supplier] = {};
        result[f.supplier][f.fabricType] = { group: f.fabricGroup, colors: f.colors };
    }
    return result;
}

export async function getAllFabricsAdmin(): Promise<AdminSupplier[]> {
    const fabrics = await prisma.blindFabric.findMany({
        orderBy: [{ supplier: 'asc' }, { fabricType: 'asc' }],
    });

    const supplierMap: Record<string, AdminSupplier['fabrics']> = {};
    for (const f of fabrics) {
        if (!supplierMap[f.supplier]) supplierMap[f.supplier] = [];
        supplierMap[f.supplier].push({
            id: f.id,
            fabricType: f.fabricType,
            fabricGroup: f.fabricGroup,
            colors: f.colors,
        });
    }

    return Object.entries(supplierMap).map(([name, fabrics]) => ({ name, fabrics }));
}

export async function addFabric(
    supplier: string,
    fabricType: string,
    fabricGroup: string,
    colors: string[],
) {
    return prisma.blindFabric.create({
        data: { supplier, fabricType, fabricGroup, colors },
    });
}

export async function updateFabric(
    id: string,
    data: { supplier?: string; fabricType?: string; fabricGroup?: string; colors?: string[] },
) {
    return prisma.blindFabric.update({ where: { id }, data });
}

export async function deleteFabric(id: string) {
    return prisma.blindFabric.delete({ where: { id } });
}

export async function deleteSupplier(supplier: string) {
    return prisma.blindFabric.deleteMany({ where: { supplier } });
}
