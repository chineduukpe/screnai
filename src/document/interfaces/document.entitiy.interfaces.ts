import { MicrosoftMetaI } from 'src/utilities/interfaces/ms-graph.interface';

export interface RRColumnMappingI {
  columnIndex: number;
  columnName: string;
  nophinCol: string;
}
export interface DocumentMetaI {
  microsoft?: MicrosoftMetaI;
  mapping?: { [key: string]: RRColumnMappingI };
  directMapping?: { [key: string]: number };
  vectorDocument?: any;
  nophinMapping?: any;
  indexHeaderMapping?: {
    header: string;
    index: string;
  }[];
}

export interface ExtractedDataI {
  tables: any[];
  pages?: any[];
}

export interface PostProcessedDataI {
  columns: number[];
  index: number[];
  data: string[][];
}

export interface FloorplanSummaryBaseI {
  unitType: string;
  beds?: number;
  baths?: number;
  count: number;
  miscSum?: number;
  rentSum: number;
  sqftSum: number;
  vacantUnits: number;
  marketRentSum: number;
  occupiedRentSum: number;
  nophinMarketRent?: number;
  economicallyVacant?: number;
}

export interface FloorplanSummaryI extends FloorplanSummaryBaseI {
  sixMonthSummary?: FloorplanSummaryBaseI;
  threeMonthSummary?: FloorplanSummaryBaseI;
  nineMonthSummary?: FloorplanSummaryBaseI;
}

export interface SingleRRUnitSummaryI {
  beds: number;
  baths: number;
  count: number;
  miscSum: number;
  rentSum: number;
  sqftSum: number;
  unitType: string;
  vacantUnits: number;
  marketRentSum: number;
  occupiedRentSum: number;
  economicallyVacant: number;
  proforma?: number;
  uRentSum?: number;
  uMarketRentSum?: number;
}

export interface RRSummaryI {
  totals: { [key: string]: number | string };
  floorplans: {
    [key: string]: FloorplanSummaryI;
  };
}

export interface RawSummaryItemInterface {
  lineItem: string;
  category: string;
  subcategory: string;
  sum?: number;
  rawData?: string[] | number[];
}

export interface RawSummaryI {
  t3: number;
  t6: number;
  t9: number;
  t12: number;
  sum: number;
  category: string;
  lineItem: string;
  subcategory: string;
  annualizedLastMonth: number;
  u_t12?: number;
  u_t3?: number;
  u_t6?: number;
  u_t9?: number;
  lm?: number;
  proforma?: number;
  rawData?: number[] | string[];
}

export interface T12SummaryI {
  intervals: IntervalsI;
  majorSummary: {
    [key: string]: number;
  };
  categories: {
    [key: string]: number;
  };
  subcategoriesSum: {
    [key: string]: number;
  };
  rawSummary: Array<RawSummaryI>;
}

export interface IntervalsI {
  subcategories: {
    [key: string]: SubcategoryI;
  };
  categories: {
    [key: string]: CategoryI;
  };
}

export interface SubcategoryI {
  t3: number;
  t6: number;
  t9: number;
  t12: number;
  annualizedLastMonth: number;
  u_t3?: number;
  u_t6?: number;
  u_t9?: number;
  u_t12?: number;
  u_annualizedLastMonth?: number;
  proforma?: number;
  category: string;
  lm?: number;
  isModified?: boolean;
}

export interface CategoryI {
  t3: number;
  t6: number;
  t9: number;
  t12: number;
  annualizedLastMonth: number;
  u_t3?: number;
  u_t6?: number;
  u_t9?: number;
  u_t12?: number;
  lm?: number;
  proforma?: number;
}

export interface T12CategorizationI {
  lineItemTrueIndex: number;
  lineItemLastIndex: number;
  categorization: any[];
}
