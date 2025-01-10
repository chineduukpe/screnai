import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDealDto {
  @IsNotEmpty()
  @IsString()
  propertyName: string;

  @IsNotEmpty()
  @IsString()
  propertyAddress: string;

  @IsString()
  @IsOptional()
  propertyType: string;

  @IsOptional()
  modelId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  documents: DocumentDto[];

  @IsOptional()
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  placeId: string;

  @IsOptional()
  @IsString()
  propertyId: string;

  @IsOptional()
  @IsString()
  conversationId: string;
}

export class DocumentDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  url: string;

  @IsNotEmpty()
  @IsString()
  type: string;
}

export class ServiceCreateDealDto {
  dealName: string;
  dealAddress: string;
  organizationId: number;
  userId: string;
  propertyId: number;
  activeModelSyncId: number;
  emailThreadId?: string;
  meta?: any;
  conversationId?: string;
}
