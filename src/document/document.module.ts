import { Module } from '@nestjs/common';
import { DocumentService } from './services/document.service';
import { DocumentController } from './controllers/document.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { UtilitiesModule } from 'src/utilities/utilities.module';
import { DealService } from 'src/deal/services/deal.service';
import { User } from 'src/user/entities/user.entity';
import { Model } from 'src/model/entities/model.entity';
import { Deal } from 'src/deal/entities/deal.entity';
import { EventsGateway } from 'src/events/events.gateway';
import { EventsService } from 'src/events/events.service';
import { GptModule } from 'src/gpt/gpt.module';
import { DocumentExtractionService } from './services/document.extraction.service';
import { DocumentAnalysisService } from './services/document.analysis.service';
import { EventsModule } from 'src/events/events.module';
import { LlmService } from 'src/llm/services/llm.service';
import { AzureTableService } from 'src/utilities/services/azure.table.service';

@Module({
  controllers: [DocumentController],
  providers: [
    DocumentService,
    DealService,
    EventsGateway,
    EventsService,
    DocumentExtractionService,
    DocumentAnalysisService,
    LlmService,
    AzureTableService,
  ],
  imports: [
    TypeOrmModule.forFeature([Document, User, Model, Deal]),
    UtilitiesModule,
    GptModule,
    EventsModule,
  ],
  exports: [
    DocumentService,
    DocumentExtractionService,
    DocumentAnalysisService,
  ],
})
export class DocumentModule {}
