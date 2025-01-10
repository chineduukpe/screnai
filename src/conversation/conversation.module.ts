import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { UserModule } from 'src/user/user.module';
import { UtilitiesModule } from 'src/utilities/utilities.module';

@Module({
  controllers: [ConversationController],
  providers: [ConversationService],
  imports: [
    TypeOrmModule.forFeature([Conversation]),
    UserModule,
    UtilitiesModule,
  ],
  exports: [ConversationService],
})
export class ConversationModule {}
