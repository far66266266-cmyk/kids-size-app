export type FitPreference = 'just' | 'slightly_large' | 'next_season';

export type ProductCategory = 'tops' | 'bottoms' | 'outerwear' | 'shoes' | 'hat';

export type ProductCondition = 'new' | 'used';

export type ResultTone = 'good' | 'ok' | 'small' | 'large' | 'unknown';

export type Gender = 'boy' | 'girl' | 'unspecified';

export type GrowthRecord = {
  id: string;
  measuredAt: string;
  heightCm?: number;
  weightKg?: number;
};

export type SizeFitStatus = 'unwearable' | 'small' | 'just' | 'large' | 'huge';

export type SizeRecord = {
  id: string;
  size: string;
  fit: SizeFitStatus;
  brand?: string;
};

export type SizeCategoryKey =
  | 'underwearRecords'
  | 'topsRecords'
  | 'bottomsRecords'
  | 'sockRecords'
  | 'shoeRecords';

export type RegisteredBrand = {
  id: string;
  name: string;
  categories: SizeCategoryKey[];
  createdAt: string;
};

export type Child = {
  id: string;
  name: string;
  birthDate?: string;
  gender: Gender;
  growthRecords: GrowthRecord[];
  heightCm?: number;
  weightKg?: number;
  footLengthCm?: number;
  topsSize: string;
  bottomsSize: string;
  shoeSize: string;
  underwearRecords: SizeRecord[];
  topsRecords: SizeRecord[];
  bottomsRecords: SizeRecord[];
  sockRecords: SizeRecord[];
  shoeRecords: SizeRecord[];
  fitPreference: FitPreference;
  createdAt: string;
  updatedAt: string;
};

export type ProductMeasurements = {
  length?: number;
  width?: number;
  sleeve?: number;
  waist?: number;
  inseam?: number;
  totalLength?: number;
  innerLength?: number;
  footWidth?: number;
};

export type FitCheckInput = {
  childId: string;
  category: ProductCategory;
  productSize: string;
  condition: ProductCondition;
  brand?: string;
  measurements?: ProductMeasurements;
  memo?: string;
};

export type JudgeResult = {
  resultLabel: string;
  resultScore: number;
  resultTone: ResultTone;
  resultReason: string;
  cautions: string[];
  recommendation: string;
  missingMeasurements: string[];
  sellerQuestion?: string;
};

export type FitCheck = FitCheckInput &
  JudgeResult & {
    id: string;
    createdAt: string;
  };
