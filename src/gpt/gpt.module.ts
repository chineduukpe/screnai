import { Module } from '@nestjs/common';
import { GptService } from './gpt.service';
import { GptController } from './gpt.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LangchainService } from './langchain.service';
import { Deal } from 'src/deal/entities/deal.entity';
import { UtilitiesService } from 'src/utilities/services/utilities.service';
import { Document } from 'src/document/entities/document.entity';
@Module({
  providers: [GptService, LangchainService, UtilitiesService],
  controllers: [GptController],
  exports: [GptService, LangchainService],
  imports: [TypeOrmModule.forFeature([Deal, Document])],
})
export class GptModule {}
