export interface CropVariety {
  id: string;
  name: string;
  daysToMaturity: number;
  daysToTransplant: number | null;
  seedingDepthInches: number;
  spacingInches: number;
  rowSpacingInches: number;
  harvestWindowDays: number;
  bedPrepLeadDays: number;
  successionIntervalDays: number | null;
  directSow: boolean;
  indoorStart: boolean;
  frostHardy: boolean;
  notes: string;
}

export interface CropRecord {
  id: string;
  category: string;
  family: string;
  commonName: string;
  varieties: CropVariety[];
}
