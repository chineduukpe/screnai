import { Module } from '@nestjs/common';
import { LlmService } from './services/llm.service';
import { AgentService } from './services/agent.service';
import { AgentToolService } from './services/agent.tools.service';
import { DealModule } from 'src/deal/deal.module';
import { UserModule } from 'src/user/user.module';
import { PropertyModule } from 'src/property/property.module';
import { DocumentModule } from 'src/document/document.module';
import { LlmController } from './controllers/llm.controller';
import { UtilitiesModule } from 'src/utilities/utilities.module';
import { ModelModule } from 'src/model/model.module';
import { ConversationModule } from 'src/conversation/conversation.module';
import { ConversationService } from 'src/conversation/conversation.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from 'src/conversation/entities/conversation.entity';
import { BeachheadService } from './services/beachhead.service';
import { Beachhead } from 'src/conversation/entities/beachhead.entity';
import { Document } from 'src/document/entities/document.entity';
import { VectorService } from './services/vector.service';
import { ZepService } from './services/zep.service';
import { PineconeService } from './services/pinecone.service';
import { EventsModule } from 'src/events/events.module';

@Module({
  providers: [
    LlmService,
    AgentService,
    AgentToolService,
    ConversationService,
    BeachheadService,
    VectorService,
    ZepService,
    PineconeService,
  ],
  exports: [
    LlmService,
    AgentService,
    AgentToolService,
    BeachheadService,
    VectorService,
    ZepService,
    PineconeService,
  ],
  imports: [
    DealModule,
    UserModule,
    PropertyModule,
    DocumentModule,
    UserModule,
    UtilitiesModule,
    ModelModule,
    ConversationModule,
    TypeOrmModule.forFeature([Conversation, Document, Beachhead]),
    EventsModule,
  ],
  controllers: [LlmController],
})
export class LlmModule {}
