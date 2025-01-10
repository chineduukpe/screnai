import { Module } from '@nestjs/common';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Organization } from 'src/organization/entities/organization.entity';
import { AuthorizationToken } from './entities/authToken.entity';
import { ModelService } from 'src/model/services/model.service';
import { Model } from 'src/model/entities/model.entity';
import { UtilitiesModule } from 'src/utilities/utilities.module';
import { DealModule } from 'src/deal/deal.module';
import { EventsGateway } from 'src/events/events.gateway';
import { EventsService } from 'src/events/events.service';
import { Deal } from 'src/deal/entities/deal.entity';
import { Document } from 'src/document/entities/document.entity';
import { EventsModule } from 'src/events/events.module';
import { MailModule } from 'src/mail/mail.module';
import { MailService } from 'src/mail/mail.service';
import { PineconeService } from 'src/llm/services/pinecone.service';
import { ZepService } from 'src/llm/services/zep.service';
import { LlmService } from 'src/llm/services/llm.service';
// import { AuthorizationToken } from './entities/authToken.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Organization,
      AuthorizationToken,
      Model,
      Deal,
      Document,
    ]),
    UtilitiesModule,
    DealModule,
    EventsModule,
    MailModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    ModelService,
    EventsGateway,
    EventsService,
    MailService,
    PineconeService,
    ZepService,
    LlmService,
  ],
  exports: [UserService],
})
export class UserModule {}
