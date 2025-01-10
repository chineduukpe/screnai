import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateModelDto {
  @IsNotEmpty()
  @IsString()
  modelName: string;

  @IsNotEmpty()
  @IsString()
  modelDocumentURL: string;

  @IsNotEmpty()
  @IsString()
  documentName: string;

  @IsOptional()
  isDefault: boolean;

  @IsOptional()
  conversationId?: string;
}

export class CreateModelServiceDto extends CreateModelDto {
  userId?: string;
  organizationId?: number;
  meta: any;
  modelMSGraphURL: string;
  conversationId?: string;
}
