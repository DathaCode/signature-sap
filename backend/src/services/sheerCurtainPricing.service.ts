import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

// Breakpoints table from runner_chart_final.xlsx — Breakpoints sheet
// Columns: [minWidth, maxWidth, co_lh, so_th, co_f120, co_f130, co_f140, co_f150, so_f120, so_f130, so_f140, so_f150]
// co_lh = Centre Open left hooks per side (right = same)
// so_th = Single Open total hooks
// co_fXXX / so_fXXX = fabric meters from table (before adding allowance)
const BREAKPOINTS: readonly [number, number, number, number, number, number, number, number, number, number, number, number][] = [
  [60,94,2,2,0.52,0.54,0.56,0.58,0.26,0.27,0.28,0.29],
  [95,148,2,4,0.52,0.54,0.56,0.58,0.5,0.53,0.56,0.59],
  [149,202,4,4,1,1.06,1.12,1.18,0.5,0.53,0.56,0.59],
  [203,310,4,6,1,1.06,1.12,1.18,0.74,0.79,0.84,0.89],
  [311,364,4,8,1,1.06,1.12,1.18,0.98,1.05,1.12,1.19],
  [365,418,6,8,1.48,1.58,1.68,1.78,0.98,1.05,1.12,1.19],
  [419,526,6,10,1.48,1.58,1.68,1.78,1.22,1.31,1.4,1.49],
  [527,580,6,12,1.48,1.58,1.68,1.78,1.46,1.57,1.68,1.79],
  [581,634,8,12,1.96,2.1,2.24,2.38,1.46,1.57,1.68,1.79],
  [635,742,8,14,1.96,2.1,2.24,2.38,1.7,1.83,1.96,2.09],
  [743,796,8,16,1.96,2.1,2.24,2.38,1.94,2.09,2.24,2.39],
  [797,850,10,16,2.44,2.62,2.8,2.98,1.94,2.09,2.24,2.39],
  [851,958,10,18,2.44,2.62,2.8,2.98,2.18,2.35,2.52,2.69],
  [959,1012,10,20,2.44,2.62,2.8,2.98,2.42,2.61,2.8,2.99],
  [1013,1066,12,20,2.92,3.14,3.36,3.58,2.42,2.61,2.8,2.99],
  [1067,1174,12,22,2.92,3.14,3.36,3.58,2.66,2.87,3.08,3.29],
  [1175,1228,12,24,2.92,3.14,3.36,3.58,2.9,3.13,3.36,3.59],
  [1229,1282,14,24,3.4,3.66,3.92,4.18,2.9,3.13,3.36,3.59],
  [1283,1390,14,26,3.4,3.66,3.92,4.18,3.14,3.39,3.64,3.89],
  [1391,1444,14,28,3.4,3.66,3.92,4.18,3.38,3.65,3.92,4.19],
  [1445,1498,16,28,3.88,4.18,4.48,4.78,3.38,3.65,3.92,4.19],
  [1499,1606,16,30,3.88,4.18,4.48,4.78,3.62,3.91,4.2,4.49],
  [1607,1660,16,32,3.88,4.18,4.48,4.78,3.86,4.17,4.48,4.79],
  [1661,1714,18,32,4.36,4.7,5.04,5.38,3.86,4.17,4.48,4.79],
  [1715,1822,18,34,4.36,4.7,5.04,5.38,4.1,4.43,4.76,5.09],
  [1823,1876,18,36,4.36,4.7,5.04,5.38,4.34,4.69,5.04,5.39],
  [1877,1930,20,36,4.84,5.22,5.6,5.98,4.34,4.69,5.04,5.39],
  [1931,2038,20,38,4.84,5.22,5.6,5.98,4.58,4.95,5.32,5.69],
  [2039,2092,20,40,4.84,5.22,5.6,5.98,4.82,5.21,5.6,5.99],
  [2093,2146,22,40,5.32,5.74,6.16,6.58,4.82,5.21,5.6,5.99],
  [2147,2254,22,42,5.32,5.74,6.16,6.58,5.06,5.47,5.88,6.29],
  [2255,2308,22,44,5.32,5.74,6.16,6.58,5.3,5.73,6.16,6.59],
  [2309,2362,24,44,5.8,6.26,6.72,7.18,5.3,5.73,6.16,6.59],
  [2363,2470,24,46,5.8,6.26,6.72,7.18,5.54,5.99,6.44,6.89],
  [2471,2524,24,48,5.8,6.26,6.72,7.18,5.78,6.25,6.72,7.19],
  [2525,2578,26,48,6.28,6.78,7.28,7.78,5.78,6.25,6.72,7.19],
  [2579,2686,26,50,6.28,6.78,7.28,7.78,6.02,6.51,7,7.49],
  [2687,2740,26,52,6.28,6.78,7.28,7.78,6.26,6.77,7.28,7.79],
  [2741,2794,28,52,6.76,7.3,7.84,8.38,6.26,6.77,7.28,7.79],
  [2795,2902,28,54,6.76,7.3,7.84,8.38,6.5,7.03,7.56,8.09],
  [2903,2956,28,56,6.76,7.3,7.84,8.38,6.74,7.29,7.84,8.39],
  [2957,3010,30,56,7.24,7.82,8.4,8.98,6.74,7.29,7.84,8.39],
  [3011,3118,30,58,7.24,7.82,8.4,8.98,6.98,7.55,8.12,8.69],
  [3119,3172,30,60,7.24,7.82,8.4,8.98,7.22,7.81,8.4,8.99],
  [3173,3226,32,60,7.72,8.34,8.96,9.58,7.22,7.81,8.4,8.99],
  [3227,3334,32,62,7.72,8.34,8.96,9.58,7.46,8.07,8.68,9.29],
  [3335,3388,32,64,7.72,8.34,8.96,9.58,7.7,8.33,8.96,9.59],
  [3389,3442,34,64,8.2,8.86,9.52,10.18,7.7,8.33,8.96,9.59],
  [3443,3550,34,66,8.2,8.86,9.52,10.18,7.94,8.59,9.24,9.89],
  [3551,3604,34,68,8.2,8.86,9.52,10.18,8.18,8.85,9.52,10.19],
  [3605,3658,36,68,8.68,9.38,10.08,10.78,8.18,8.85,9.52,10.19],
  [3659,3766,36,70,8.68,9.38,10.08,10.78,8.42,9.11,9.8,10.49],
  [3767,3820,36,72,8.68,9.38,10.08,10.78,8.66,9.37,10.08,10.79],
  [3821,3874,38,72,9.16,9.9,10.64,11.38,8.66,9.37,10.08,10.79],
  [3875,3982,38,74,9.16,9.9,10.64,11.38,8.9,9.63,10.36,11.09],
  [3983,4036,38,76,9.16,9.9,10.64,11.38,9.14,9.89,10.64,11.39],
  [4037,4090,40,76,9.64,10.42,11.2,11.98,9.14,9.89,10.64,11.39],
  [4091,4198,40,78,9.64,10.42,11.2,11.98,9.38,10.15,10.92,11.69],
  [4199,4252,40,80,9.64,10.42,11.2,11.98,9.62,10.41,11.2,11.99],
  [4253,4306,42,80,10.12,10.94,11.76,12.58,9.62,10.41,11.2,11.99],
  [4307,4414,42,82,10.12,10.94,11.76,12.58,9.86,10.67,11.48,12.29],
  [4415,4468,42,84,10.12,10.94,11.76,12.58,10.1,10.93,11.76,12.59],
  [4469,4522,44,84,10.6,11.46,12.32,13.18,10.1,10.93,11.76,12.59],
  [4523,4630,44,86,10.6,11.46,12.32,13.18,10.34,11.19,12.04,12.89],
  [4631,4684,44,88,10.6,11.46,12.32,13.18,10.58,11.45,12.32,13.19],
  [4685,4738,46,88,11.08,11.98,12.88,13.78,10.58,11.45,12.32,13.19],
  [4739,4846,46,90,11.08,11.98,12.88,13.78,10.82,11.71,12.6,13.49],
  [4847,4900,46,92,11.08,11.98,12.88,13.78,11.06,11.97,12.88,13.79],
  [4901,4954,48,92,11.56,12.5,13.44,14.38,11.06,11.97,12.88,13.79],
  [4955,5062,48,94,11.56,12.5,13.44,14.38,11.3,12.23,13.16,14.09],
  [5063,5116,48,96,11.56,12.5,13.44,14.38,11.54,12.49,13.44,14.39],
  [5117,5170,50,96,12.04,13.02,14,14.98,11.54,12.49,13.44,14.39],
  [5171,5278,50,98,12.04,13.02,14,14.98,11.78,12.75,13.72,14.69],
  [5279,5332,50,100,12.04,13.02,14,14.98,12.02,13.01,14,14.99],
  [5333,5386,52,100,12.52,13.54,14.56,15.58,12.02,13.01,14,14.99],
  [5387,5494,52,102,12.52,13.54,14.56,15.58,12.26,13.27,14.28,15.29],
  [5495,5548,52,104,12.52,13.54,14.56,15.58,12.5,13.53,14.56,15.59],
  [5549,5602,54,104,13,14.06,15.12,16.18,12.5,13.53,14.56,15.59],
  [5603,5710,54,106,13,14.06,15.12,16.18,12.74,13.79,14.84,15.89],
  [5711,5764,54,108,13,14.06,15.12,16.18,12.98,14.05,15.12,16.19],
  [5765,5818,56,108,13.48,14.58,15.68,16.78,12.98,14.05,15.12,16.19],
  [5819,5926,56,110,13.48,14.58,15.68,16.78,13.22,14.31,15.4,16.49],
  [5927,5980,56,112,13.48,14.58,15.68,16.78,13.46,14.57,15.68,16.79],
  [5981,6034,58,112,13.96,15.1,16.24,17.38,13.46,14.57,15.68,16.79],
  [6035,6142,58,114,13.96,15.1,16.24,17.38,13.7,14.83,15.96,17.09],
  [6143,6196,58,116,13.96,15.1,16.24,17.38,13.94,15.09,16.24,17.39],
  [6197,6250,60,116,14.44,15.62,16.8,17.98,13.94,15.09,16.24,17.39],
  [6251,6358,60,118,14.44,15.62,16.8,17.98,14.18,15.35,16.52,17.69],
  [6359,6412,60,120,14.44,15.62,16.8,17.98,14.42,15.61,16.8,17.99],
  [6413,6466,62,120,14.92,16.14,17.36,18.58,14.42,15.61,16.8,17.99],
  [6467,6574,62,122,14.92,16.14,17.36,18.58,14.66,15.87,17.08,18.29],
  [6575,6628,62,124,14.92,16.14,17.36,18.58,14.9,16.13,17.36,18.59],
  [6629,6682,64,124,15.4,16.66,17.92,19.18,14.9,16.13,17.36,18.59],
  [6683,6790,64,126,15.4,16.66,17.92,19.18,15.14,16.39,17.64,18.89],
  [6791,6844,64,128,15.4,16.66,17.92,19.18,15.38,16.65,17.92,19.19],
  [6845,6898,66,128,15.88,17.18,18.48,19.78,15.38,16.65,17.92,19.19],
  [6899,7006,66,130,15.88,17.18,18.48,19.78,15.62,16.91,18.2,19.49],
  [7007,7060,66,132,15.88,17.18,18.48,19.78,15.86,17.17,18.48,19.79],
  [7061,7114,68,132,16.36,17.7,19.04,20.38,15.86,17.17,18.48,19.79],
  [7115,7222,68,134,16.36,17.7,19.04,20.38,16.1,17.43,18.76,20.09],
  [7223,7276,68,136,16.36,17.7,19.04,20.38,16.34,17.69,19.04,20.39],
  [7277,7330,70,136,16.84,18.22,19.6,20.98,16.34,17.69,19.04,20.39],
  [7331,7438,70,138,16.84,18.22,19.6,20.98,16.58,17.95,19.32,20.69],
  [7439,7492,70,140,16.84,18.22,19.6,20.98,16.82,18.21,19.6,20.99],
  [7493,7546,72,140,17.32,18.74,20.16,21.58,16.82,18.21,19.6,20.99],
  [7547,7654,72,142,17.32,18.74,20.16,21.58,17.06,18.47,19.88,21.29],
  [7655,7708,72,144,17.32,18.74,20.16,21.58,17.3,18.73,20.16,21.59],
  [7709,7762,74,144,17.8,19.26,20.72,22.18,17.3,18.73,20.16,21.59],
  [7763,7870,74,146,17.8,19.26,20.72,22.18,17.54,18.99,20.44,21.89],
  [7871,7924,74,148,17.8,19.26,20.72,22.18,17.78,19.25,20.72,22.19],
  [7925,7978,76,148,18.28,19.78,21.28,22.78,17.78,19.25,20.72,22.19],
  [7979,8086,76,150,18.28,19.78,21.28,22.78,18.02,19.51,21,22.49],
  [8087,8140,76,152,18.28,19.78,21.28,22.78,18.26,19.77,21.28,22.79],
  [8141,8194,78,152,18.76,20.3,21.84,23.38,18.26,19.77,21.28,22.79],
  [8195,8302,78,154,18.76,20.3,21.84,23.38,18.5,20.03,21.56,23.09],
  [8303,8356,78,156,18.76,20.3,21.84,23.38,18.74,20.29,21.84,23.39],
  [8357,8410,80,156,19.24,20.82,22.4,23.98,18.74,20.29,21.84,23.39],
  [8411,8500,80,158,19.24,20.82,22.4,23.98,18.98,20.55,22.12,23.69],
] as const;

// Fabric allowance added on top of table value
const CO_ALLOWANCE = 0.28;   // Centre Open: +0.280m
const SO_ALLOWANCE = 0.14;   // Single Open / Free Fold: +0.140m

// Fullness index: 120→0, 130→1, 140→2, 150→3
const FULLNESS_IDX: Record<number, number> = { 120: 0, 130: 1, 140: 2, 150: 3 };

export interface CurtainPricingData {
  width: number;
  drop: number;
  openingType: string;
  fullness: number;
  bracketType: string;
  fabric: string;
  fabricGroup: string;
  requiresDropDeduction?: boolean;
  dropDeductionValue?: number;
  // Track type (motorised pricing)
  requiresTracks?: boolean;
  trackType?: string;       // 'Standard' | 'Motorised'
  motorType?: string;       // 'Alpha AC' | 'Alpha DC' | 'Versa AC' | 'Versa DC'
  remotes?: string;         // 'Single Channel' | '5 Channel' | '15 Channel' | 'Not Required'
  chargerHub?: string;      // 'Alpha Charger' | 'PULSE 2 Hub' | 'Alpha Neo' | 'Not Required'
  userId?: string;
}

export interface CurtainCalculationResult {
  deductedDrop: number;
  hookCount: number;
  leftHooks?: number;
  rightHooks?: number;
  fabricLength: number;   // mm (fabricMeters × 1000)
  fabricMeters: number;
  bracketCount: number;
  wandCount: number;
  dropSurcharge: number;

  fabricCost: number;
  hookCost: number;
  bracketCost: number;
  wandCost: number;
  motorCost: number;
  remoteCost: number;
  chargerCost: number;
  subtotal: number;
  gst: number;
  total: number;
}

class SheerCurtainPricingService {

  async calculateCurtainMetrics(item: CurtainPricingData): Promise<CurtainCalculationResult> {
    // 1. Drop deduction (configurable, default 35mm)
    const deductionMm = item.requiresDropDeduction !== false
      ? (item.dropDeductionValue ?? 35)
      : 0;
    const deductedDrop = item.drop - deductionMm;

    // 2. Hook count + fabric length from breakpoints table
    const lookup = this.lookupBreakpoints(item.width, item.openingType, item.fullness);

    // 3. Bracket count
    const bracketCount = this.getBracketCount(item.width);

    // 4. Wand count
    const wandCount = (item.openingType === 'Centre Open' || item.openingType === 'Free Fold') ? 2 : 1;

    // 5. Drop surcharge
    const surchargePerM = await this.getDropSurchargeRate(item.fabricGroup);
    const dropSurcharge = this.calculateDropSurcharge(item.drop, surchargePerM);

    // 6. All component costs (motor, remote, charger); fabric cost = raw chart meters × price/m
    const pricing = await this.calculateAllCosts(
      item, lookup.rawFabricMeters, lookup.hookCount, bracketCount, wandCount, dropSurcharge
    );

    return {
      deductedDrop,
      hookCount: lookup.hookCount,
      leftHooks: lookup.leftHooks,
      rightHooks: lookup.rightHooks,
      fabricMeters: lookup.fabricMeters,
      fabricLength: Math.round(lookup.fabricMeters * 1000),
      bracketCount,
      wandCount,
      dropSurcharge,
      ...pricing,
    };
  }

  /**
   * Look up hook count and fabric meters from the breakpoints table.
   * Returns rawFabricMeters (chart value, used for pricing) and fabricMeters (with allowance, for production).
   */
  lookupBreakpoints(width: number, openingType: string, fullness: number) {
    const fi = FULLNESS_IDX[fullness] ?? 2; // default to 140 index
    const row = BREAKPOINTS.find(r => width >= r[0] && width <= r[1]);

    if (!row) {
      logger.warn(`Width ${width}mm outside breakpoints range (60–8500), using last row`);
      const last = BREAKPOINTS[BREAKPOINTS.length - 1];
      return this.extractFromRow(last, openingType, fi);
    }

    return this.extractFromRow(row, openingType, fi);
  }

  private extractFromRow(
    row: readonly [number, number, number, number, number, number, number, number, number, number, number, number],
    openingType: string,
    fi: number
  ) {
    const co_lh = row[2]; // Centre Open: hooks per side
    const so_th = row[3]; // Single Open: total hooks
    // CO fabric cols: row[4..7], SO fabric cols: row[8..11]
    const coFabric = [row[4], row[5], row[6], row[7]][fi];
    const soFabric = [row[8], row[9], row[10], row[11]][fi];

    if (openingType === 'Centre Open') {
      return {
        hookCount: co_lh * 2,
        leftHooks: co_lh,
        rightHooks: co_lh,
        rawFabricMeters: coFabric,                                               // used for pricing
        fabricMeters: Math.round((coFabric + CO_ALLOWANCE) * 1000) / 1000,      // with allowance for production
      };
    } else {
      // Single Open or Free Fold — use SO columns
      return {
        hookCount: so_th,
        leftHooks: undefined,
        rightHooks: undefined,
        rawFabricMeters: soFabric,                                               // used for pricing
        fabricMeters: Math.round((soFabric + SO_ALLOWANCE) * 1000) / 1000,      // with allowance for production
      };
    }
  }

  /**
   * Bracket count based on width ranges
   */
  getBracketCount(width: number): number {
    if (width <= 2750) return 4;
    if (width <= 3750) return 5;
    if (width <= 4750) return 6;
    if (width <= 5750) return 7;
    if (width <= 6750) return 8;
    if (width <= 7750) return 9;
    if (width <= 8750) return 10;
    if (width <= 9750) return 11;
    if (width <= 10750) return 12;
    return 13;
  }

  private calculateDropSurcharge(drop: number, surchargePerM: number): number {
    if (drop <= 3000) return 0;
    const extraMeters = Math.ceil((drop - 3000) / 1000);
    return extraMeters * surchargePerM;
  }

  private async getDropSurchargeRate(fabricGroup: string): Promise<number> {
    const settings = await prisma.sheerGroupSettings.findUnique({
      where: { fabricGroup },
    });
    return settings ? Number(settings.dropSurchargePerM) : 60;
  }

  private async calculateAllCosts(
    item: CurtainPricingData,
    rawFabricMeters: number,
    _hookCount: number,
    _bracketCount: number,
    _wandCount: number,
    dropSurcharge: number
  ) {
    // Fabric cost: chart fabric meters × price per meter
    // The per-meter price from admin pricing already covers hooks, brackets, and wands
    const fabricPricePerMeter = await this.getFabricPrice(item.fabric, item.fabricGroup, item.userId);
    const fabricCost = rawFabricMeters * fabricPricePerMeter;

    // Motor cost (only when motorised track selected)
    let motorCost = 0;
    if (item.requiresTracks && item.trackType === 'Motorised' && item.motorType) {
      motorCost = await this.getInventoryPrice('SHEER_MOTOR', `${item.motorType} Motor`);
    }

    // Remote cost
    let remoteCost = 0;
    if (item.remotes && item.remotes !== 'Not Required') {
      remoteCost = await this.getInventoryPrice('SHEER_REMOTE', `${item.remotes} Remote`);
    }

    // Charger / Hub cost
    let chargerCost = 0;
    if (item.chargerHub && item.chargerHub !== 'Not Required') {
      chargerCost = await this.getInventoryPrice('SHEER_CHARGER', item.chargerHub);
    }

    // No GST on curtain items; drop surcharge is additional when drop > 3000mm
    const total = fabricCost + motorCost + remoteCost + chargerCost + dropSurcharge;

    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      fabricCost: r(fabricCost),
      hookCost: 0,
      bracketCost: 0,
      wandCost: 0,
      motorCost: r(motorCost),
      remoteCost: r(remoteCost),
      chargerCost: r(chargerCost),
      subtotal: r(total),
      gst: 0,
      total: r(total),
    };
  }

  private async getInventoryPrice(category: string, itemName: string): Promise<number> {
    const item = await prisma.inventoryItem.findFirst({
      where: { category: category as any, itemName },
      select: { price: true },
    });
    if (!item) {
      logger.warn(`No inventory price found for ${category}: ${itemName}`);
      return 0;
    }
    return Number(item.price);
  }

  private async getFabricPrice(fabricName: string, fabricGroup: string, userId?: string): Promise<number> {
    if (userId) {
      const override = await prisma.sheerFabricPricing.findFirst({
        where: { fabricGroup, fabricName, userId },
      });
      if (override) return Number(override.pricePerMeter);
    }

    const defaultPrice = await prisma.sheerFabricPricing.findFirst({
      where: { fabricGroup, fabricName, userId: null },
    });

    if (!defaultPrice) {
      logger.warn(`No sheer fabric pricing for: ${fabricName} in ${fabricGroup}, using fallback`);
      return fabricGroup === 'Budget' ? 95 : 100;
    }

    return Number(defaultPrice.pricePerMeter);
  }
}

export const sheerCurtainPricingService = new SheerCurtainPricingService();
