import { Body, Controller, Get, Post } from '@nestjs/common';
import { MicrosoftService } from './utilities/services/microsoft.service';
import { DealService } from './deal/services/deal.service';
import { GoogleService } from './utilities/services/google.service';
import { EmailDealService } from './deal/services/email.deals.service';
import { UtilitiesService } from './utilities/services/utilities.service';
import { AgentService } from './llm/services/agent.service';
import { CallCresaI } from './llm/interfaces/cresa.interface';
import { UserService } from './user/services/user.service';
import { ModelService } from './model/services/model.service';
import { ZepService } from './llm/services/zep.service';
import { PineconeService } from './llm/services/pinecone.service';
import { LlmService } from './llm/services/llm.service';
import axios from 'axios';
import { MailService } from './mail/mail.service';
import { AWSService } from './utilities/services/aws.service';
import { AzureTableService } from './utilities/services/azure.table.service';
import { SAMPLE_RR_ARRAY } from './utilities/constants';
import { RR_RAW_SAMPLE } from './data/rr-samples';
// const client =
@Controller()
export class AppController {
  constructor(
    private googleService: GoogleService,
    private emailDealService: EmailDealService,
    private utilitiesService: UtilitiesService,
    private agentService: AgentService,
    private userService: UserService,
    private modelService: ModelService,
    private zepService: ZepService,
    private pineconeService: PineconeService,
    private microsoftService: MicrosoftService,
    private llmService: LlmService,
    private dealService: DealService,
    private mailService: MailService,
    private awsService: AWSService,
    private azureTableService: AzureTableService,
  ) {}

  @Post('send-hello')
  async sendHello() {
    const data = {
      email: 'chineduukpe@gmail.com',
      address: '1022 mopsick',
      userName: 'Friday',
      benchmarks: 'updatedDeal.comparables.benchmarks',
      dealName: 'Demo Deal',
    };
    return await this.mailService.sendBenchmarkResult(data);
  }

  @Post()
  async getHello(@Body() body: CallCresaI) {
    // return this.azureTableService.combineSimilarTables(RR_RAW_SAMPLE);
    return 'Hello world';
    const fileKey = await this.awsService.getFileKeyFromURL(
      `https://chinedu-copilot-upload.s3.us-east-1.amazonaws.com/deals/input/8202WarehouseLoftsRentRoll123122.pdf`,
    );

    return await this.awsService.copyFileToBucket(
      process.env.EXTRACTION_S3_BUCKET,
      process.env.AWS_PRODUCTION_BUCKET,
      fileKey,
      `pipeline-rr/${fileKey}`,
    );
  }

  @Get('/healthcheck')
  async healthCheck() {
    return 'Ok';
  }

  @Post('/test')
  async handleGoogleMailNotification(@Body() body: any) {
    return this.googleService.handleNotification(body).then((data) => {
      this.emailDealService.processSingleMail(data);
    });
  }
}
