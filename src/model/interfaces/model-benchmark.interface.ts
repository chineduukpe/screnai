import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ModelBenchamarkI {
  @IsNotEmpty()
  @IsString()
  name?: string;

  // @IsNotEmpty()
  // @IsString()
  // cellName: string;

  // @IsNotEmpty()
  // @IsString()
  // sheetName: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsNotEmpty()
  @IsString()
  condition?: string;

  @IsNotEmpty()
  value?: string;

  @IsOptional()
  format?: string;

  @IsOptional()
  max?: string;
}

export class AddBenchmarkDto {
  @IsNotEmpty()
  @IsInt()
  modelId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModelBenchamarkI)
  modelBenchmark: ModelBenchamarkI[];
}
