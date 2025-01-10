import { Module } from '@nestjs/common';
import { AWSService } from './services/aws.service';
import { MicrosoftService } from './services/microsoft.service';
import { UtilitiesService } from './services/utilities.service';
import { AzureService } from './services/azure.service';
import DocumentIntelligence from '@azure-rest/ai-document-intelligence';
import { GptModule } from 'src/gpt/gpt.module';
import { WorkbookUtility } from './services/workbook.utility.service';
import { RRUtilityService } from './RRUtility.service';
import { GoogleService } from './services/google.service';
import { SlackService } from './services/slack.service';
import { AzureTableService } from './services/azure.table.service';
import { AWSTableService } from './services/aws.table.service';
import { AzureArrayTableConverter } from './services/azure.array.table.service';

@Module({
  imports: [GptModule],
  providers: [
    AWSService,
    MicrosoftService,
    WorkbookUtility,
    UtilitiesService,
    AzureService,
    RRUtilityService,
    GoogleService,
    SlackService,
    AzureTableService,
    AWSTableService,
    AzureArrayTableConverter,
    {
      provide: 'AzureDocIntelligenceClient',
      useFactory: () => {
        return DocumentIntelligence(
          process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT,
          { key: process.env.AZURE_DOC_INTELLIGENCE_KEY },
        );
      },
    },
  ],
  exports: [
    MicrosoftService,
    AWSService,
    WorkbookUtility,
    UtilitiesService,
    AzureService,
    RRUtilityService,
    GoogleService,
    SlackService,
    AzureTableService,
    AWSTableService,
    AzureArrayTableConverter,
  ],
})
export class UtilitiesModule {}
