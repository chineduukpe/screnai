import { Module } from '@nestjs/common';
import { DealService } from './services/deal.service';
import { DealController } from './controllers/deal.controller';
import { PropertyModule } from '../property/property.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deal } from './entities/deal.entity';
import { DocumentModule } from 'src/document/document.module';
import { User } from 'src/user/entities/user.entity';
import { Model } from 'src/model/entities/model.entity';
import { UtilitiesModule } from 'src/utilities/utilities.module';
import { EventsGateway } from 'src/events/events.gateway';
import { EventsService } from 'src/events/events.service';
import { Document } from 'src/document/entities/document.entity';
import { EmailDealService } from './services/email.deals.service';
import { EmailDocument } from 'src/document/entities/email.document.entity';
import { GptModule } from 'src/gpt/gpt.module';
import { LangchainService } from 'src/gpt/langchain.service';
import { Conversation } from 'src/conversation/entities/conversation.entity';

@Module({
  controllers: [DealController],
  providers: [
    DealService,
    EventsGateway,
    EventsService,
    EmailDealService,
    LangchainService,
    // PropertyService,
  ],
  imports: [
    PropertyModule,
    DocumentModule,
    TypeOrmModule.forFeature([
      Deal,
      User,
      Model,
      Document,
      EmailDocument,
      Conversation,
    ]),
    UtilitiesModule,
    DocumentModule,
    GptModule,
    // PropertyModule,
  ],
  exports: [DealService, EmailDealService],
})
export class DealModule {}
