import {
  IsDate,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsOptional()
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName: string;

  @IsString()
  email: string;

  @IsOptional()
  @IsDate()
  emailVerifiedAt?: Date;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  whoAreYou?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsNotEmpty()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
