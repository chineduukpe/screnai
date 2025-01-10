import { forwardRef, Module } from '@nestjs/common';
import { ModelService } from './services/model.service';
import { ModelController } from './controllers/model.controller';
import { UtilitiesModule } from '../utilities/utilities.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Model } from './entities/model.entity';
import { EventsService } from 'src/events/events.service';
import { EventsGateway } from 'src/events/events.gateway';
import { Deal } from 'src/deal/entities/deal.entity';
import { Document } from 'src/document/entities/document.entity';
import { PineconeService } from 'src/llm/services/pinecone.service';
import { ZepService } from 'src/llm/services/zep.service';
import { LlmService } from 'src/llm/services/llm.service';
import { DocumentModule } from 'src/document/document.module';
import { LlmModule } from 'src/llm/llm.module';

@Module({
  controllers: [ModelController],
  providers: [
    ModelService,
    EventsGateway,
    EventsService,
    PineconeService,
    ZepService,
    LlmService,
  ],
  imports: [
    UtilitiesModule,
    DocumentModule,
    TypeOrmModule.forFeature([User, Model, Deal, Document]),
    // LlmModule,
    forwardRef(() => LlmModule),
  ],
  exports: [ModelService],
})
export class ModelModule {}
