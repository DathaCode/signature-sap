export interface SheerFabricInfo {
  name: string;
  basePricePerMeter: number;
  group: string; // Internal only, not shown to user
}

export interface SheerFabricGroup {
  name: string;
  fabrics: SheerFabricInfo[];
}

export const sheerFabricGroups: SheerFabricGroup[] = [
  {
    name: 'Group 1',
    fabrics: [
      { name: 'Cannes', basePricePerMeter: 100, group: 'Group 1' },
      { name: 'Aston', basePricePerMeter: 100, group: 'Group 1' },
      { name: 'Natural Collection', basePricePerMeter: 100, group: 'Group 1' },
      { name: 'Zanzibar', basePricePerMeter: 100, group: 'Group 1' },
      { name: 'Verne', basePricePerMeter: 100, group: 'Group 1' },
      { name: 'Montreux', basePricePerMeter: 100, group: 'Group 1' },
      { name: 'Coco', basePricePerMeter: 100, group: 'Group 1' },
    ],
  },
  {
    name: 'Group 2',
    fabrics: [
      { name: 'Altitude', basePricePerMeter: 100, group: 'Group 2' },
      { name: 'Arena', basePricePerMeter: 100, group: 'Group 2' },
      { name: 'Ditto', basePricePerMeter: 100, group: 'Group 2' },
      { name: 'Georgia', basePricePerMeter: 100, group: 'Group 2' },
      { name: 'Skye', basePricePerMeter: 100, group: 'Group 2' },
      { name: 'Seattle', basePricePerMeter: 100, group: 'Group 2' },
      { name: 'Bronte', basePricePerMeter: 100, group: 'Group 2' },
    ],
  },
  {
    name: 'Budget',
    fabrics: [
      { name: 'Bali', basePricePerMeter: 95, group: 'Budget' },
      { name: 'Melton', basePricePerMeter: 95, group: 'Budget' },
    ],
  },
];

/** Flat list of all fabrics for dropdown (no group labels shown to user) */
export const getAllSheerFabrics = (): SheerFabricInfo[] => {
  return sheerFabricGroups.flatMap((group) => group.fabrics);
};

/** Get fabric group name for backend pricing lookup */
export const getSheerFabricGroup = (fabricName: string): string | null => {
  for (const group of sheerFabricGroups) {
    if (group.fabrics.some((f) => f.name === fabricName)) {
      return group.name;
    }
  }
  return null;
};
