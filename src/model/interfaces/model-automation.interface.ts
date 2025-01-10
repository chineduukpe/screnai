import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export interface ModelAutomationI {
  [key: string]: any;
}

export interface ModelAutomationMetaI {
  model: {
    microsoft: {
      id: string;
      eTag: string;
      webURL: string;
      downloadURL: string;
    };
    sheetNames: Array<string>;
    workbookJSON: any;
    loadJSON: boolean;
    confirmAutomation: boolean;
  };
}

export interface ModelMappingI {
  category: string;
  sheetName: string;
  cellName: string;
  nophinCategory: string;
}

export class AutomationI {
  @IsNotEmpty()
  type: 'column' | 'cell' | 'table';
  index?: number;
  @IsNotEmpty()
  sourceWorkbook?:
    | 'rent-roll'
    | 'trailing-12'
    | 'offering-memorandum'
    | 'others';
  @IsNotEmpty()
  sourceSheetName: string;

  @IsNotEmpty()
  sourceSheetCell: string;

  @IsNotEmpty()
  modelSheetName: string; //Source Sheet;

  @IsNotEmpty()
  modelSheetCell: string;

  @IsOptional()
  includeSummary?: boolean;

  // @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationSplitI)
  splits: Array<AutomationSplitI>;
}

export class FormFieldInterface {
  @IsArray()
  simpleField: Array<CustomField>;

  @IsArray()
  compoundField: Array<{
    compoundFieldName: string;
    stackType: 'vertical' | 'horizontal';
    fields: Array<CustomField>;
  }>;
}

export class FormFieldInterface2 {
  @IsNumber()
  syncedModelId?: number;

  @IsArray()
  simpleField: Array<CustomField>;

  @IsArray()
  compoundField: Array<{
    compoundFieldName: string;
    stackType: 'vertical' | 'horizontal';
    fields: Array<CustomField>;
  }>;
}

export class CustomField {
  fieldName: string;
  fieldType: string;
  fieldLocation: string;
  fieldValue: string;
  value?: string;
}

export class AutomationSplitI {
  @IsNotEmpty()
  @IsString({ message: 'Start cell must be a string' })
  startCell: string;

  @IsString()
  endCell: string;
}

export class AddAutomationDto {
  @IsNotEmpty()
  modelId: number;

  @IsOptional()
  doNotAskAgain?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationI)
  automations: Array<AutomationI>;
}

export class DuplicaModelDTO {
  @IsNotEmpty()
  modelId: number;

  @IsNotEmpty()
  doNotAskAgain: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationI)
  automations?: Array<AutomationI>;

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  deals: Array<number>;
}

export class AddFormFieldDto {
  @IsOptional()
  modelId: number;

  @IsOptional()
  dealId: number;

  @IsNotEmpty()
  formFields: {
    syncedModelId?: number;
    simpleField: Array<CustomField>;
    compoundField: Array<{
      compoundFieldName: string;
      stackType: 'vertical' | 'horizontal';
      fields: Array<CustomField>;
    }>;
  };
}
