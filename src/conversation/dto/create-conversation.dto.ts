import { Optional } from '@nestjs/common';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsNotEmpty()
  @IsString()
  conversationId: string;

  @Optional()
  @IsObject({ each: true })
  messages?: ConversationI[];
}

export class ConversationI {
  uuid?: string;
  role?: string;
  roleType?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}
