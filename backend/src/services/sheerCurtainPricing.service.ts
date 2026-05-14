import path from 'path';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Runner chart — loaded once at startup from Breakpoints sheet
// Columns: [#, widthRange, coLeft, coRight, co120, co130, co140, co150,
//           null, soTotal, so120, so130, so140, so150]
// Fabric values are integers in mm (already include production allowance).
// Divide by 1000 to get meters. No additional allowance needed.
// ---------------------------------------------------------------------------
interface BreakpointRow {
  minWidth: number;
  maxWidth: number;
  coLeft:   number;
  coRight:  number;
  co120:    number;  // mm
  co130:    number;
  co140:    number;
  co150:    number;
  soTotal:  number;
  so120:    number;  // mm
  so130:    number;
  so140:    number;
  so150:    number;
}

let CHART: BreakpointRow[] = [];

function loadRunnerChart() {
  if (CHART.length > 0) return;
  try {
    const xlsxPath = path.join(__dirname, '../../data/runner_chart.xlsx');
    const wb = XLSX.readFile(xlsxPath);
    const ws = wb.Sheets['Breakpoints'];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    for (const row of rows) {
      if (!row[0] || typeof row[0] !== 'number') continue; // skip header/empty rows
      const rangeStr = String(row[1]).replace(/,/g, '');
      const [minStr, maxStr] = rangeStr.split('–');
      const minWidth = parseInt(minStr, 10);
      const maxWidth = parseInt(maxStr, 10);
      if (isNaN(minWidth) || isNaN(maxWidth)) continue;

      CHART.push({
        minWidth, maxWidth,
        coLeft:  row[2],  coRight: row[3],
        co120:   row[4],  co130:   row[5],  co140:   row[6],  co150:   row[7],
        soTotal: row[9],
        so120:   row[10], so130:   row[11], so140:   row[12], so150:   row[13],
      });
    }
    logger.info(`Runner chart loaded: ${CHART.length} breakpoint rows`);
  } catch (err) {
    logger.error('Failed to load runner chart xlsx:', err);
  }
}

// Pre-load on module import
loadRunnerChart();

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------
export interface CurtainPricingData {
  width:       number;
  drop:        number;
  openingType: string;
  fullness:    number;
  bracketType: string;
  fabric:      string;
  fabricGroup: string;
  requiresDropDeduction?: boolean;
  dropDeductionValue?:    number;
  // Track type (motorised pricing)
  requiresTracks?: boolean;
  trackType?:      string;    // 'Standard' | 'Motorised'
  motorType?:      string;    // 'Alpha AC' | 'Alpha DC' | 'Versa AC' | 'Versa DC'
  remotes?:        string;    // 'Single Channel' | '5 Channel' | '15 Channel' | 'Not Required'
  chargerHub?:     string[];  // array: ['Alpha Charger', 'PULSE 2 Hub', 'Alpha Neo']
  userId?:         string;
}

export interface CurtainCalculationResult {
  deductedDrop:   number;
  hookCount:      number;
  leftHooks?:     number;
  rightHooks?:    number;
  fabricLength:   number;   // mm
  fabricMeters:   number;   // m
  bracketCount:   number;
  wandCount:      number;
  dropSurcharge:  number;

  fabricCost:       number;
  fullnessSurcharge: number;
  motorCost:        number;
  remoteCost:       number;
  chargerCost:      number;
  // Legacy zero fields kept for compatibility
  hookCost:     number;
  bracketCost:  number;
  wandCost:     number;
  subtotal:     number;
  gst:          number;
  total:        number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
class SheerCurtainPricingService {

  async calculateCurtainMetrics(item: CurtainPricingData): Promise<CurtainCalculationResult> {
    loadRunnerChart(); // no-op if already loaded

    // 1. Drop deduction
    const deductionMm = item.requiresDropDeduction !== false
      ? (item.dropDeductionValue ?? 35)
      : 0;
    const deductedDrop = item.drop - deductionMm;

    // 2. Lookup breakpoints for hook counts and fabric meters
    const lookup = this.lookupBreakpoints(item.width, item.openingType, item.fullness);

    // 3. Bracket + wand counts
    const bracketCount = this.getBracketCount(item.width);
    const wandCount = (item.openingType === 'Centre Open' || item.openingType === 'Free Fold') ? 2 : 1;

    // 4. Group settings (drop surcharge rate + fullness surcharge rates per meter)
    const settings = await this.getGroupSettings(item.fabricGroup);

    // 5. Drop surcharge: $rate per 1000mm above 3000mm (inclusive)
    //    drop >= 3000 → ceil((drop - 2999) / 1000) × rate
    const dropSurcharge = item.drop >= 3000
      ? Math.ceil((item.drop - 2999) / 1000) * settings.dropSurchargePerM
      : 0;

    // 6. Fullness surcharge: width-proportional
    //    surcharge = (width / 1000) × perMeterRate
    //    120mm → $0, 130/140/150 → per-group configurable rate × width
    const fullnessSurcharge = this.getFullnessSurcharge(item.fullness, item.width, settings);

    // 7. All costs
    const pricing = await this.calculateAllCosts(item, dropSurcharge, fullnessSurcharge);

    return {
      deductedDrop,
      hookCount:  lookup.hookCount,
      leftHooks:  lookup.leftHooks,
      rightHooks: lookup.rightHooks,
      fabricMeters: lookup.fabricMeters,
      fabricLength: Math.round(lookup.fabricMeters * 1000),
      bracketCount,
      wandCount,
      dropSurcharge,
      fullnessSurcharge,
      ...pricing,
    };
  }

  // ── Runner chart lookup ──────────────────────────────────────────────────
  lookupBreakpoints(width: number, openingType: string, fullness: number) {
    const row = CHART.find(r => width >= r.minWidth && width <= r.maxWidth);

    if (!row) {
      logger.warn(`Width ${width}mm outside runner chart range (60–8500); using last row`);
      return this.extractFromRow(CHART[CHART.length - 1], openingType, fullness);
    }
    return this.extractFromRow(row, openingType, fullness);
  }

  private extractFromRow(row: BreakpointRow, openingType: string, fullness: number) {
    const fabricMmMap: Record<number, { co: number; so: number }> = {
      120: { co: row.co120, so: row.so120 },
      130: { co: row.co130, so: row.so130 },
      140: { co: row.co140, so: row.so140 },
      150: { co: row.co150, so: row.so150 },
    };
    const fabric = fabricMmMap[fullness] ?? fabricMmMap[140];

    if (openingType === 'Centre Open') {
      return {
        hookCount:    row.coLeft + row.coRight,
        leftHooks:    row.coLeft,
        rightHooks:   row.coRight,
        fabricMeters: fabric.co / 1000,
      };
    } else {
      return {
        hookCount:    row.soTotal,
        leftHooks:    undefined,
        rightHooks:   undefined,
        fabricMeters: fabric.so / 1000,
      };
    }
  }

  getBracketCount(width: number): number {
    if (width <= 2750)  return 4;
    if (width <= 3750)  return 5;
    if (width <= 4750)  return 6;
    if (width <= 5750)  return 7;
    if (width <= 6750)  return 8;
    if (width <= 7750)  return 9;
    if (width <= 8750)  return 10;
    if (width <= 9750)  return 11;
    if (width <= 10750) return 12;
    return 13;
  }

  // ── Fullness surcharge (width-proportional) ──────────────────────────────
  private getFullnessSurcharge(
    fullness: number,
    width: number,
    settings: { fullness130Surcharge: number; fullness140Surcharge: number; fullness150Surcharge: number }
  ): number {
    const widthM = width / 1000;
    if (fullness === 130) return Math.round(widthM * settings.fullness130Surcharge * 100) / 100;
    if (fullness === 140) return Math.round(widthM * settings.fullness140Surcharge * 100) / 100;
    if (fullness === 150) return Math.round(widthM * settings.fullness150Surcharge * 100) / 100;
    return 0; // 120mm — no surcharge
  }

  // ── Group settings ───────────────────────────────────────────────────────
  private async getGroupSettings(fabricGroup: string) {
    const settings = await prisma.sheerGroupSettings.findUnique({ where: { fabricGroup } });
    return {
      dropSurchargePerM:    settings ? Number(settings.dropSurchargePerM)    : 60,
      fullness130Surcharge: settings ? Number(settings.fullness130Surcharge) : 15,
      fullness140Surcharge: settings ? Number(settings.fullness140Surcharge) : 25,
      fullness150Surcharge: settings ? Number(settings.fullness150Surcharge) : 45,
    };
  }

  // ── All cost calculations ────────────────────────────────────────────────
  private async calculateAllCosts(
    item: CurtainPricingData,
    dropSurcharge: number,
    fullnessSurcharge: number,
  ) {
    const fabricPricePerMeter = await this.getFabricPrice(item.fabric, item.fabricGroup, item.userId);
    const fabricCost = Math.round((item.width / 1000) * fabricPricePerMeter * 100) / 100;

    // Motor: price depends on width range
    let motorCost = 0;
    if (item.requiresTracks && item.trackType === 'Motorised' && item.motorType) {
      motorCost = await this.getMotorPrice(item.motorType, item.width);
    }

    // Remote
    let remoteCost = 0;
    if (item.remotes && item.remotes !== 'Not Required') {
      remoteCost = await this.getInventoryPrice('SHEER_REMOTE', `${item.remotes} Remote`);
    }

    // Charger/Hub — sum all selected items
    let chargerCost = 0;
    if (item.chargerHub && item.chargerHub.length > 0) {
      for (const ch of item.chargerHub) {
        if (ch && ch !== 'Not Required') {
          chargerCost += await this.getInventoryPrice('SHEER_CHARGER', ch);
        }
      }
    }
    chargerCost = Math.round(chargerCost * 100) / 100;

    const total = fabricCost + fullnessSurcharge + motorCost + remoteCost + chargerCost + dropSurcharge;
    const r = (n: number) => Math.round(n * 100) / 100;

    return {
      fabricCost: r(fabricCost),
      motorCost:  r(motorCost),
      remoteCost: r(remoteCost),
      chargerCost: r(chargerCost),
      hookCost:   0,
      bracketCost: 0,
      wandCost:   0,
      subtotal:   r(total),
      gst:        0,
      total:      r(total),
    };
  }

  // ── Motor price by width range ───────────────────────────────────────────
  async getMotorPrice(motorType: string, width: number): Promise<number> {
    const record = await prisma.sheerMotorPricing.findFirst({
      where: {
        motorType,
        widthFrom: { lt: width },
        widthTo:   { gte: width },
      },
    });
    if (!record) {
      logger.warn(`No motor price for ${motorType} at width ${width}mm`);
      return 0;
    }
    return Number(record.price);
  }

  // ── Inventory lookup ─────────────────────────────────────────────────────
  private async getInventoryPrice(category: string, itemName: string): Promise<number> {
    const inv = await prisma.inventoryItem.findFirst({
      where: { category: category as any, itemName },
      select: { price: true },
    });
    if (!inv) {
      logger.warn(`No inventory price for ${category}: ${itemName}`);
      return 0;
    }
    return Number(inv.price);
  }

  // ── Fabric price (customer override → default) ───────────────────────────
  private async getFabricPrice(fabricName: string, fabricGroup: string, userId?: string): Promise<number> {
    if (userId) {
      const override = await prisma.sheerFabricPricing.findFirst({
        where: { fabricGroup, fabricName, userId },
      });
      if (override) return Number(override.pricePerMeter);
    }
    const def = await prisma.sheerFabricPricing.findFirst({
      where: { fabricGroup, fabricName, userId: null },
    });
    if (!def) {
      logger.warn(`No sheer fabric pricing for ${fabricName} in ${fabricGroup}`);
      return fabricGroup === 'Budget' ? 90 : 100;
    }
    return Number(def.pricePerMeter);
  }
}

export const sheerCurtainPricingService = new SheerCurtainPricingService();
