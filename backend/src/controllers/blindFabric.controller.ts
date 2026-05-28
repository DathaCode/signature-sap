import { Request, Response } from 'express';
import {
    getAllFabricsFormatted,
    getAllFabricsAdmin,
    addFabric,
    updateFabric,
    deleteFabric,
    deleteSupplier,
} from '../services/blindFabric.service';
import { logger } from '../config/logger';

export async function getFabricsFormatted(_req: Request, res: Response) {
    try {
        const data = await getAllFabricsFormatted();
        res.json({ success: true, data });
    } catch (err) {
        logger.error('Failed to get blind fabrics', err);
        res.status(500).json({ success: false, message: 'Failed to load fabrics' });
    }
}

export async function getFabricsAdmin(_req: Request, res: Response) {
    try {
        const data = await getAllFabricsAdmin();
        res.json({ success: true, data });
    } catch (err) {
        logger.error('Failed to get blind fabrics (admin)', err);
        res.status(500).json({ success: false, message: 'Failed to load fabrics' });
    }
}

export async function addFabricHandler(req: Request, res: Response) {
    const supplier: string = req.body.supplier;
    const fabricType: string = req.body.fabricType;
    const fabricGroup: string = req.body.fabricGroup;
    const colors: string[] = req.body.colors;
    if (!supplier || !fabricType || !fabricGroup || !Array.isArray(colors)) {
        res.status(400).json({ success: false, message: 'supplier, fabricType, fabricGroup, and colors are required' });
        return;
    }
    try {
        const fabric = await addFabric(supplier.trim(), fabricType.trim(), fabricGroup.trim(), colors);
        res.status(201).json({ success: true, data: fabric });
    } catch (err: any) {
        if (err?.code === 'P2002') {
            res.status(409).json({ success: false, message: 'A fabric with this name already exists for that supplier' });
            return;
        }
        logger.error('Failed to add blind fabric', err);
        res.status(500).json({ success: false, message: 'Failed to add fabric' });
    }
}

export async function updateFabricHandler(req: Request, res: Response) {
    const id = req.params['id'] as string;
    const fabricType: string | undefined = typeof req.body.fabricType === 'string' ? req.body.fabricType : undefined;
    const fabricGroup: string | undefined = typeof req.body.fabricGroup === 'string' ? req.body.fabricGroup : undefined;
    const colors: string[] | undefined = Array.isArray(req.body.colors) ? req.body.colors : undefined;
    if (!fabricType && !fabricGroup && !colors) {
        res.status(400).json({ success: false, message: 'Provide at least one field to update' });
        return;
    }
    try {
        const fabric = await updateFabric(id, {
            ...(fabricType && { fabricType: fabricType.trim() }),
            ...(fabricGroup && { fabricGroup: fabricGroup.trim() }),
            ...(colors && { colors }),
        });
        res.json({ success: true, data: fabric });
    } catch (err: any) {
        if (err?.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Fabric not found' });
            return;
        }
        logger.error('Failed to update blind fabric', err);
        res.status(500).json({ success: false, message: 'Failed to update fabric' });
    }
}

export async function deleteFabricHandler(req: Request, res: Response) {
    const id = req.params['id'] as string;
    try {
        await deleteFabric(id);
        res.json({ success: true });
    } catch (err: any) {
        if (err?.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Fabric not found' });
            return;
        }
        logger.error('Failed to delete blind fabric', err);
        res.status(500).json({ success: false, message: 'Failed to delete fabric' });
    }
}

export async function deleteSupplierHandler(req: Request, res: Response) {
    const supplier = decodeURIComponent(req.params['supplier'] as string);
    try {
        const result = await deleteSupplier(supplier);
        res.json({ success: true, deletedCount: result.count });
    } catch (err) {
        logger.error('Failed to delete supplier', err);
        res.status(500).json({ success: false, message: 'Failed to delete supplier' });
    }
}
