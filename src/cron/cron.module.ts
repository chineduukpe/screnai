import { Module } from '@nestjs/common';
import { CronService } from './services/cron.service';
import { DealModule } from 'src/deal/deal.module';
import { DocumentModule } from 'src/document/document.module';
import { EventsModule } from 'src/events/events.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from 'src/document/entities/document.entity';
import { UtilitiesModule } from 'src/utilities/utilities.module';
import { MailService } from 'src/mail/mail.service';
import { UserService } from 'src/user/services/user.service';
import { User } from 'src/user/entities/user.entity';
import { AuthorizationToken } from 'src/user/entities/authToken.entity';
import { Organization } from 'src/organization/entities/organization.entity';
import { ModelService } from 'src/model/services/model.service';
import { Model } from 'src/model/entities/model.entity';
import { Deal } from 'src/deal/entities/deal.entity';
import { PineconeService } from 'src/llm/services/pinecone.service';
import { ZepService } from 'src/llm/services/zep.service';
import { LlmService } from 'src/llm/services/llm.service';

@Module({
  providers: [
    CronService,
    MailService,
    UserService,
    ModelService,
    PineconeService,
    ZepService,
    LlmService,
  ],
  imports: [
    DealModule,
    DocumentModule,
    EventsModule,
    TypeOrmModule.forFeature([
      Document,
      User,
      AuthorizationToken,
      Organization,
      Model,
      Deal,
    ]),
    UtilitiesModule,
  ],
})
export class CronModule {}
