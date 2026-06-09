import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Runner chart — hardcoded from runner_chart_updated.xlsx (Breakpoints sheet)
// Columns: [minWidth, maxWidth, coLeft, coRight, co120, co130, co140, co150,
//           soTotal, so120, so130, so140, so150]
// Fabric values are integers in mm (already include production allowance).
// Divide by 1000 to get meters. No additional allowance needed.
// ---------------------------------------------------------------------------
interface BreakpointRow {
  minWidth: number; maxWidth: number;
  coLeft: number;   coRight: number;
  co120: number;    co130: number;  co140: number;  co150: number;
  soTotal: number;
  so120: number;    so130: number;  so140: number;  so150: number;
}

// Raw data: [minWidth, maxWidth, coLeft, coRight, co120, co130, co140, co150, soTotal, so120, so130, so140, so150]
const RAW_CHART: number[][] = [
  [60,94,2,2,760,800,840,880,2,380,400,420,440],
  [95,148,2,2,760,800,840,880,4,620,660,700,740],
  [149,202,4,4,1240,1320,1400,1480,4,620,660,700,740],
  [203,310,4,4,1240,1320,1400,1480,6,860,920,980,1040],
  [311,364,4,4,1240,1320,1400,1480,8,1100,1180,1260,1340],
  [365,418,6,6,1720,1840,1960,2080,8,1100,1180,1260,1340],
  [419,526,6,6,1720,1840,1960,2080,10,1340,1440,1540,1640],
  [527,580,6,6,1720,1840,1960,2080,12,1580,1700,1820,1940],
  [581,634,8,8,2200,2360,2520,2680,12,1580,1700,1820,1940],
  [635,742,8,8,2200,2360,2520,2680,14,1820,1960,2100,2240],
  [743,796,8,8,2200,2360,2520,2680,16,2060,2220,2380,2540],
  [797,850,10,10,2680,2880,3080,3280,16,2060,2220,2380,2540],
  [851,958,10,10,2680,2880,3080,3280,18,2300,2480,2660,2840],
  [959,1012,10,10,2680,2880,3080,3280,20,2540,2740,2940,3140],
  [1013,1066,12,12,3160,3400,3640,3880,20,2540,2740,2940,3140],
  [1067,1174,12,12,3160,3400,3640,3880,22,2780,3000,3220,3440],
  [1175,1228,12,12,3160,3400,3640,3880,24,3020,3260,3500,3740],
  [1229,1282,14,14,3640,3920,4200,4480,24,3020,3260,3500,3740],
  [1283,1390,14,14,3640,3920,4200,4480,26,3260,3520,3780,4040],
  [1391,1444,14,14,3640,3920,4200,4480,28,3500,3780,4060,4340],
  [1445,1498,16,16,4120,4440,4760,5080,28,3500,3780,4060,4340],
  [1499,1606,16,16,4120,4440,4760,5080,30,3740,4040,4340,4640],
  [1607,1660,16,16,4120,4440,4760,5080,32,3980,4300,4620,4940],
  [1661,1714,18,18,4600,4960,5320,5680,32,3980,4300,4620,4940],
  [1715,1822,18,18,4600,4960,5320,5680,34,4220,4560,4900,5240],
  [1823,1876,18,18,4600,4960,5320,5680,36,4460,4820,5180,5540],
  [1877,1930,20,20,5080,5480,5880,6280,36,4460,4820,5180,5540],
  [1931,2038,20,20,5080,5480,5880,6280,38,4700,5080,5460,5840],
  [2039,2092,20,20,5080,5480,5880,6280,40,4940,5340,5740,6140],
  [2093,2146,22,22,5560,6000,6440,6880,40,4940,5340,5740,6140],
  [2147,2254,22,22,5560,6000,6440,6880,42,5180,5600,6020,6440],
  [2255,2308,22,22,5560,6000,6440,6880,44,5420,5860,6300,6740],
  [2309,2362,24,24,6040,6520,7000,7480,44,5420,5860,6300,6740],
  [2363,2470,24,24,6040,6520,7000,7480,46,5660,6120,6580,7040],
  [2471,2524,24,24,6040,6520,7000,7480,48,5900,6380,6860,7340],
  [2525,2578,26,26,6520,7040,7560,8080,48,5900,6380,6860,7340],
  [2579,2686,26,26,6520,7040,7560,8080,50,6140,6640,7140,7640],
  [2687,2740,26,26,6520,7040,7560,8080,52,6380,6900,7420,7940],
  [2741,2794,28,28,7000,7560,8120,8680,52,6380,6900,7420,7940],
  [2795,2902,28,28,7000,7560,8120,8680,54,6620,7160,7700,8240],
  [2903,2956,28,28,7000,7560,8120,8680,56,6860,7420,7980,8540],
  [2957,3010,30,30,7480,8080,8680,9280,56,6860,7420,7980,8540],
  [3011,3118,30,30,7480,8080,8680,9280,58,7100,7680,8260,8840],
  [3119,3172,30,30,7480,8080,8680,9280,60,7340,7940,8540,9140],
  [3173,3226,32,32,7960,8600,9240,9880,60,7340,7940,8540,9140],
  [3227,3334,32,32,7960,8600,9240,9880,62,7580,8200,8820,9440],
  [3335,3388,32,32,7960,8600,9240,9880,64,7820,8460,9100,9740],
  [3389,3442,34,34,8440,9120,9800,10480,64,7820,8460,9100,9740],
  [3443,3550,34,34,8440,9120,9800,10480,66,8060,8720,9380,10040],
  [3551,3604,34,34,8440,9120,9800,10480,68,8300,8980,9660,10340],
  [3605,3658,36,36,8920,9640,10360,11080,68,8300,8980,9660,10340],
  [3659,3766,36,36,8920,9640,10360,11080,70,8540,9240,9940,10640],
  [3767,3820,36,36,8920,9640,10360,11080,72,8780,9500,10220,10940],
  [3821,3874,38,38,9400,10160,10920,11680,72,8780,9500,10220,10940],
  [3875,3982,38,38,9400,10160,10920,11680,74,9020,9760,10500,11240],
  [3983,4036,38,38,9400,10160,10920,11680,76,9260,10020,10780,11540],
  [4037,4090,40,40,9880,10680,11480,12280,76,9260,10020,10780,11540],
  [4091,4198,40,40,9880,10680,11480,12280,78,9500,10280,11060,11840],
  [4199,4252,40,40,9880,10680,11480,12280,80,9740,10540,11340,12140],
  [4253,4306,42,42,10360,11200,12040,12880,80,9740,10540,11340,12140],
  [4307,4414,42,42,10360,11200,12040,12880,82,9980,10800,11620,12440],
  [4415,4468,42,42,10360,11200,12040,12880,84,10220,11060,11900,12740],
  [4469,4522,44,44,10840,11720,12600,13480,84,10220,11060,11900,12740],
  [4523,4630,44,44,10840,11720,12600,13480,86,10460,11320,12180,13040],
  [4631,4684,44,44,10840,11720,12600,13480,88,10700,11580,12460,13340],
  [4685,4738,46,46,11320,12240,13160,14080,88,10700,11580,12460,13340],
  [4739,4846,46,46,11320,12240,13160,14080,90,10940,11840,12740,13640],
  [4847,4900,46,46,11320,12240,13160,14080,92,11180,12100,13020,13940],
  [4901,4954,48,48,11800,12760,13720,14680,92,11180,12100,13020,13940],
  [4955,5062,48,48,11800,12760,13720,14680,94,11420,12360,13300,14240],
  [5063,5116,48,48,11800,12760,13720,14680,96,11660,12620,13580,14540],
  [5117,5170,50,50,12280,13280,14280,15280,96,11660,12620,13580,14540],
  [5171,5278,50,50,12280,13280,14280,15280,98,11900,12880,13860,14840],
  [5279,5332,50,50,12280,13280,14280,15280,100,12140,13140,14140,15140],
  [5333,5386,52,52,12760,13800,14840,15880,100,12140,13140,14140,15140],
  [5387,5494,52,52,12760,13800,14840,15880,102,12380,13400,14420,15440],
  [5495,5548,52,52,12760,13800,14840,15880,104,12620,13660,14700,15740],
  [5549,5602,54,54,13240,14320,15400,16480,104,12620,13660,14700,15740],
  [5603,5710,54,54,13240,14320,15400,16480,106,12860,13920,14980,16040],
  [5711,5764,54,54,13240,14320,15400,16480,108,13100,14180,15260,16340],
  [5765,5818,56,56,13720,14840,15960,17080,108,13100,14180,15260,16340],
  [5819,5926,56,56,13720,14840,15960,17080,110,13340,14440,15540,16640],
  [5927,5980,56,56,13720,14840,15960,17080,112,13580,14700,15820,16940],
  [5981,6034,58,58,14200,15360,16520,17680,112,13580,14700,15820,16940],
  [6035,6142,58,58,14200,15360,16520,17680,114,13820,14960,16100,17240],
  [6143,6196,58,58,14200,15360,16520,17680,116,14060,15220,16380,17540],
  [6197,6250,60,60,14680,15880,17080,18280,116,14060,15220,16380,17540],
  [6251,6358,60,60,14680,15880,17080,18280,118,14300,15480,16660,17840],
  [6359,6412,60,60,14680,15880,17080,18280,120,14540,15740,16940,18140],
  [6413,6466,62,62,15160,16400,17640,18880,120,14540,15740,16940,18140],
  [6467,6574,62,62,15160,16400,17640,18880,122,14780,16000,17220,18440],
  [6575,6628,62,62,15160,16400,17640,18880,124,15020,16260,17500,18740],
  [6629,6682,64,64,15640,16920,18200,19480,124,15020,16260,17500,18740],
  [6683,6790,64,64,15640,16920,18200,19480,126,15260,16520,17780,19040],
  [6791,6844,64,64,15640,16920,18200,19480,128,15500,16780,18060,19340],
  [6845,6898,66,66,16120,17440,18760,20080,128,15500,16780,18060,19340],
  [6899,7006,66,66,16120,17440,18760,20080,130,15740,17040,18340,19640],
  [7007,7060,66,66,16120,17440,18760,20080,132,15980,17300,18620,19940],
  [7061,7114,68,68,16600,17960,19320,20680,132,15980,17300,18620,19940],
  [7115,7222,68,68,16600,17960,19320,20680,134,16220,17560,18900,20240],
  [7223,7276,68,68,16600,17960,19320,20680,136,16460,17820,19180,20540],
  [7277,7330,70,70,17080,18480,19880,21280,136,16460,17820,19180,20540],
  [7331,7438,70,70,17080,18480,19880,21280,138,16700,18080,19460,20840],
  [7439,7492,70,70,17080,18480,19880,21280,140,16940,18340,19740,21140],
  [7493,7546,72,72,17560,19000,20440,21880,140,16940,18340,19740,21140],
  [7547,7654,72,72,17560,19000,20440,21880,142,17180,18600,20020,21440],
  [7655,7708,72,72,17560,19000,20440,21880,144,17420,18860,20300,21740],
  [7709,7762,74,74,18040,19520,21000,22480,144,17420,18860,20300,21740],
  [7763,7870,74,74,18040,19520,21000,22480,146,17660,19120,20580,22040],
  [7871,7924,74,74,18040,19520,21000,22480,148,17900,19380,20860,22340],
  [7925,7978,76,76,18520,20040,21560,23080,148,17900,19380,20860,22340],
  [7979,8086,76,76,18520,20040,21560,23080,150,18140,19640,21140,22640],
  [8087,8140,76,76,18520,20040,21560,23080,152,18380,19900,21420,22940],
  [8141,8194,78,78,19000,20560,22120,23680,152,18380,19900,21420,22940],
  [8195,8302,78,78,19000,20560,22120,23680,154,18620,20160,21700,23240],
  [8303,8356,78,78,19000,20560,22120,23680,156,18860,20420,21980,23540],
  [8357,8410,80,80,19480,21080,22680,24280,156,18860,20420,21980,23540],
  [8411,8500,80,80,19480,21080,22680,24280,158,19100,20680,22260,23840],
];

const CHART: BreakpointRow[] = RAW_CHART.map(r => ({
  minWidth: r[0],  maxWidth: r[1],
  coLeft:   r[2],  coRight:  r[3],
  co120:    r[4],  co130:    r[5],  co140:    r[6],  co150:    r[7],
  soTotal:  r[8],
  so120:    r[9],  so130:    r[10], so140:    r[11], so150:    r[12],
}));

// ---------------------------------------------------------------------------
// HOOK CHART — hardcoded from runner_chart_15mm_gap (1).xlsx (Breakpoints sheet)
// Spec: 15mm end gap both sides · 54mm spacing · 60–8500mm
// Columns: [minWidth, maxWidth, coLeftHooks, coRightHooks, soTotalHooks]
//   CENTRE OPEN: Left hooks = Right hooks (per panel); total = left + right
//   SINGLE OPEN: Total hooks only
// This is the SOLE source for hook counts. Fabric meters still come from CHART.
// ---------------------------------------------------------------------------
interface HookRow {
  minWidth: number; maxWidth: number;
  coLeft: number;   coRight: number;
  soTotal: number;
}

// Raw: [minWidth, maxWidth, coLeftHooks, coRightHooks, soTotalHooks]
const RAW_HOOK_CHART: number[][] = [
  [60,84,2,2,2],
  [85,138,2,2,4],
  [139,192,4,4,4],
  [193,300,4,4,6],
  [301,354,4,4,8],
  [355,408,6,6,8],
  [409,516,6,6,10],
  [517,570,6,6,12],
  [571,624,8,8,12],
  [625,732,8,8,14],
  [733,786,8,8,16],
  [787,840,10,10,16],
  [841,948,10,10,18],
  [949,1002,10,10,20],
  [1003,1056,12,12,20],
  [1057,1164,12,12,22],
  [1165,1218,12,12,24],
  [1219,1272,14,14,24],
  [1273,1380,14,14,26],
  [1381,1434,14,14,28],
  [1435,1488,16,16,28],
  [1489,1596,16,16,30],
  [1597,1650,16,16,32],
  [1651,1704,18,18,32],
  [1705,1812,18,18,34],
  [1813,1866,18,18,36],
  [1867,1920,20,20,36],
  [1921,2028,20,20,38],
  [2029,2082,20,20,40],
  [2083,2136,22,22,40],
  [2137,2244,22,22,42],
  [2245,2298,22,22,44],
  [2299,2352,24,24,44],
  [2353,2460,24,24,46],
  [2461,2514,24,24,48],
  [2515,2568,26,26,48],
  [2569,2676,26,26,50],
  [2677,2730,26,26,52],
  [2731,2784,28,28,52],
  [2785,2892,28,28,54],
  [2893,2946,28,28,56],
  [2947,3000,30,30,56],
  [3001,3108,30,30,58],
  [3109,3162,30,30,60],
  [3163,3216,32,32,60],
  [3217,3324,32,32,62],
  [3325,3378,32,32,64],
  [3379,3432,34,34,64],
  [3433,3540,34,34,66],
  [3541,3594,34,34,68],
  [3595,3648,36,36,68],
  [3649,3756,36,36,70],
  [3757,3810,36,36,72],
  [3811,3864,38,38,72],
  [3865,3972,38,38,74],
  [3973,4026,38,38,76],
  [4027,4080,40,40,76],
  [4081,4188,40,40,78],
  [4189,4242,40,40,80],
  [4243,4296,42,42,80],
  [4297,4404,42,42,82],
  [4405,4458,42,42,84],
  [4459,4512,44,44,84],
  [4513,4620,44,44,86],
  [4621,4674,44,44,88],
  [4675,4728,46,46,88],
  [4729,4836,46,46,90],
  [4837,4890,46,46,92],
  [4891,4944,48,48,92],
  [4945,5052,48,48,94],
  [5053,5106,48,48,96],
  [5107,5160,50,50,96],
  [5161,5268,50,50,98],
  [5269,5322,50,50,100],
  [5323,5376,52,52,100],
  [5377,5484,52,52,102],
  [5485,5538,52,52,104],
  [5539,5592,54,54,104],
  [5593,5700,54,54,106],
  [5701,5754,54,54,108],
  [5755,5808,56,56,108],
  [5809,5916,56,56,110],
  [5917,5970,56,56,112],
  [5971,6024,58,58,112],
  [6025,6132,58,58,114],
  [6133,6186,58,58,116],
  [6187,6240,60,60,116],
  [6241,6348,60,60,118],
  [6349,6402,60,60,120],
  [6403,6456,62,62,120],
  [6457,6564,62,62,122],
  [6565,6618,62,62,124],
  [6619,6672,64,64,124],
  [6673,6780,64,64,126],
  [6781,6834,64,64,128],
  [6835,6888,66,66,128],
  [6889,6996,66,66,130],
  [6997,7050,66,66,132],
  [7051,7104,68,68,132],
  [7105,7212,68,68,134],
  [7213,7266,68,68,136],
  [7267,7320,70,70,136],
  [7321,7428,70,70,138],
  [7429,7482,70,70,140],
  [7483,7536,72,72,140],
  [7537,7644,72,72,142],
  [7645,7698,72,72,144],
  [7699,7752,74,74,144],
  [7753,7860,74,74,146],
  [7861,7914,74,74,148],
  [7915,7968,76,76,148],
  [7969,8076,76,76,150],
  [8077,8130,76,76,152],
  [8131,8184,78,78,152],
  [8185,8292,78,78,154],
  [8293,8346,78,78,156],
  [8347,8400,80,80,156],
  [8401,8500,80,80,158],
];

const HOOK_CHART: HookRow[] = RAW_HOOK_CHART.map(r => ({
  minWidth: r[0], maxWidth: r[1],
  coLeft:   r[2], coRight:  r[3],
  soTotal:  r[4],
}));

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
  requiresTracks?: boolean;
  trackType?:      string;
  motorType?:      string;
  remotes?:        string;
  chargerHub?:     string[];
  userId?:         string;
}

export interface CurtainCalculationResult {
  deductedDrop:      number;
  hookCount:         number;
  leftHooks?:        number;
  rightHooks?:       number;
  fabricLength:      number;
  fabricMeters:      number;
  bracketCount:      number;
  wandCount:         number;
  dropSurcharge:     number;
  fabricCost:        number;
  fabricBaseCost:    number;
  discountPercent:   number;
  fullnessSurcharge: number;
  motorCost:         number;
  remoteCost:        number;
  chargerCost:       number;
  hookCost:          number;
  bracketCost:       number;
  wandCost:          number;
  subtotal:          number;
  gst:               number;
  total:             number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
class SheerCurtainPricingService {

  async calculateCurtainMetrics(item: CurtainPricingData): Promise<CurtainCalculationResult> {
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

    // 5. Drop surcharge: $rate per 1000mm above 3000mm (inclusive at 3000)
    const dropSurcharge = item.drop >= 3000
      ? Math.ceil((item.drop - 2999) / 1000) * settings.dropSurchargePerM
      : 0;

    // 6. Fullness surcharge: width-proportional
    const fullnessSurcharge = this.getFullnessSurcharge(item.fullness, item.width, settings);

    // 7. All costs
    const pricing = await this.calculateAllCosts(item, dropSurcharge, fullnessSurcharge);

    return {
      deductedDrop,
      hookCount:    lookup.hookCount,
      leftHooks:    lookup.leftHooks,
      rightHooks:   lookup.rightHooks,
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
      return this.extractFromRow(CHART[CHART.length - 1], width, openingType, fullness);
    }
    return this.extractFromRow(row, width, openingType, fullness);
  }

  private extractFromRow(row: BreakpointRow, width: number, openingType: string, fullness: number) {
    const fabricMmMap: Record<number, { co: number; so: number }> = {
      120: { co: row.co120, so: row.so120 },
      130: { co: row.co130, so: row.so130 },
      140: { co: row.co140, so: row.so140 },
      150: { co: row.co150, so: row.so150 },
    };
    const fabric = fabricMmMap[fullness] ?? fabricMmMap[140];

    // Hook counts come SOLELY from HOOK_CHART (runner_chart_15mm_gap),
    // keyed by the real item width (not the old fabric chart's range).
    const hooks = this.lookupHooks(width, openingType);

    if (openingType === 'Centre Open') {
      return {
        hookCount:    hooks.hookCount,
        leftHooks:    hooks.leftHooks,
        rightHooks:   hooks.rightHooks,
        fabricMeters: fabric.co / 1000,
      };
    } else {
      return {
        hookCount:    hooks.hookCount,
        leftHooks:    undefined,
        rightHooks:   undefined,
        fabricMeters: fabric.so / 1000,
      };
    }
  }

  // ── Hook chart lookup (15mm gap, 54mm spacing) ───────────────────────────
  // Sole source of hook counts for both Single Open and Centre Open.
  private lookupHooks(width: number, openingType: string): {
    hookCount: number; leftHooks?: number; rightHooks?: number;
  } {
    let row = HOOK_CHART.find(h => width >= h.minWidth && width <= h.maxWidth);
    if (!row) {
      logger.warn(`Width ${width}mm outside hook chart range (60–8500); using last row`);
      row = HOOK_CHART[HOOK_CHART.length - 1];
    }
    if (openingType === 'Centre Open') {
      return {
        hookCount:  row.coLeft + row.coRight,
        leftHooks:  row.coLeft,
        rightHooks: row.coRight,
      };
    }
    return { hookCount: row.soTotal };
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
    return 0;
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
    const fabricBaseCost = Math.round((item.width / 1000) * fabricPricePerMeter * 100) / 100;

    // Per-customer curtain discount — applies to FABRIC COST ONLY (mirrors blinds).
    const discountPercent = await this.getCurtainDiscount(item.userId, item.fabricGroup);
    const fabricCost = Math.round(fabricBaseCost * (1 - discountPercent / 100) * 100) / 100;

    let motorCost = 0;
    if (item.requiresTracks && item.trackType === 'Motorised' && item.motorType) {
      motorCost = await this.getMotorPrice(item.motorType, item.width);
    }

    let remoteCost = 0;
    if (item.remotes && item.remotes !== 'Not Required') {
      remoteCost = await this.getInventoryPrice('SHEER_REMOTE', `${item.remotes} Remote`);
    }

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
      fabricCost:     r(fabricCost),
      fabricBaseCost: r(fabricBaseCost),
      discountPercent,
      motorCost:   r(motorCost),
      remoteCost:  r(remoteCost),
      chargerCost: r(chargerCost),
      hookCost:    0,
      bracketCost: 0,
      wandCost:    0,
      subtotal:    r(total),
      gst:         0,
      total:       r(total),
    };
  }

  // ── Per-customer curtain discount (fabric cost only) ─────────────────────
  // Reads user.discounts.curtains["Group 1"|"Group 2"|"Budget"|"Block Out Curtains"].
  // Returns the percentage (0 if no user, no discounts set, or group missing).
  private async getCurtainDiscount(userId: string | undefined, fabricGroup: string): Promise<number> {
    if (!userId) return 0;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { discounts: true },
    });
    const discounts = user?.discounts as { curtains?: Record<string, number> } | null;
    const val = discounts?.curtains?.[fabricGroup];
    return typeof val === 'number' && val >= 0 && val <= 100 ? val : 0;
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
