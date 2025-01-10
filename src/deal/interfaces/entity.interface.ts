import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { MicrosoftMetaI } from 'src/utilities/interfaces/ms-graph.interface';

export interface DealMetaI {
  model?: MSMetaI;
  customForm?: MSMetaI;
  computedModel?: any;
  vectorStore?: FaissStore;
  duplicating?: boolean;
}

export interface ChatHistory {
  user?: string;
  ai?: string;
  sessionId?: string;
  timestamp?: Date;
}

export interface MSMetaI {
  microsoft?: MicrosoftMetaI;
  s3URL?: string;
  nophinS3ModelURL?: string;
  isSyncing?: boolean;
  isRRSynced?: boolean;
  isT12Synced?: boolean;
  isUnderwritingSynced?: boolean;
  syncCompleted?: boolean;
}

export interface SnapshotMetricsI {
  DSCR?: number;
  EM?: number;
  IRR?: number;
  profit?: number;
  yieldOnCost?: number;
  GOI?: number;
  OpEx?: number;
  NOI?: number;
  debtYield?: number;
  CoC?: number;
  proformaDSCR?: number;
  proformaEM?: number;
  proformaIRR?: number;
  proformaprofit?: number;
  proformayieldOnCost?: number;
  proformaGOI?: number;
  proformaOpEx?: number;
  proformaNOI?: number;
  proformadebtYield?: number;
  proformaCoC?: number;
}

export interface DealComparablesI {
  benchmarks?: ComparableBenchmarkI[];
}

export interface ComparableBenchmarkI {
  min: number | string;
  max?: number;
  benchmarkValue: number | string;
  isBenchmarkPassed: boolean;
  name: string;
  condition: string;
}
