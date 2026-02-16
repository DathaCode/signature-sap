import { Router } from 'express';
import multer from 'multer';
import { OrderController } from '../controllers/order.controller';

const router = Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '10')) * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        // Accept .xlsm and .xlsx files
        if (file.mimetype === 'application/vnd.ms-excel.sheet.macroEnabled.12' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.originalname.endsWith('.xlsm') ||
            file.originalname.endsWith('.xlsx')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsm, .xlsx) are allowed'));
        }
    },
});

// ============================================================================
// ORDER ROUTES
// ============================================================================

/**
 * POST /api/orders/upload
 * Upload Excel order file
 */
router.post('/upload', upload.single('file'), OrderController.uploadOrder);

/**
 * POST /api/orders/:orderId/confirm
 * Confirm order and deduct inventory
 */
router.post('/:orderId/confirm', OrderController.confirmOrder);

/**
 * GET /api/orders/:orderId/worksheets
 * Get both worksheets (fabric cut & tube cut)
 */
router.get('/:orderId/worksheets', OrderController.getWorksheets);

/**
 * GET /api/orders/:orderId/download?type=fabric_cut&format=csv
 * Download worksheet as CSV or PDF
 */
router.get('/:orderId/download', OrderController.downloadWorksheet);

/**
 * GET /api/orders/:orderId
 * Get single order details
 */
router.get('/:orderId', OrderController.getOrder);

/**
 * GET /api/orders
 * Get all orders
 */
router.get('/', OrderController.getOrders);

export default router;
