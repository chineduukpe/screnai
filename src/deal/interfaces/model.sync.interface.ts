import { IsNotEmpty, IsNumber } from 'class-validator';
import { MicrosoftMetaI } from 'src/utilities/interfaces/ms-graph.interface';

export class SyncModelDto {
  @IsNotEmpty()
  @IsNumber()
  modelId: number;
}

export interface SyncedModelI {
  modelId: number;
  modelName: string;
  meta: {
    microsoft: MicrosoftMetaI;
  };
}
