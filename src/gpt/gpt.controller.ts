import { Controller, Post, Body, UseInterceptors, Patch } from '@nestjs/common';
import { GptService } from './gpt.service';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';
import { LangchainService } from './langchain.service';
@UseInterceptors(SentryInterceptor)
@Controller('gpt')
export class GptController {
  constructor(
    private gptService: GptService,
    private langchain: LangchainService,
  ) {}

  @Post('/')
  testRentRollPrediction(@Body() body) {
    return this.gptService.predictRentRollNormalizedColumns(body.input);
  }

  @Post('/generate-memo')
  testMemoGeneration(@Body() body) {
    return this.gptService.generateSimpleInvestmentMemoTemplate(body);
  }
  @Post('/property-memo')
  testPropertyMemo(@Body() body) {
    return this.gptService.predictAddressOutput(body);
  }

  @Post('/analysis-summary')
  testAnalysisMemo(@Body() body) {
    return this.gptService.generateAnalysisSummary(body);
  }

  @Patch('update-process-input')
  updateProcessedInput(@Body() body: any) {
    return this.gptService.updateProcessedInput(body);
  }

  @Post('/adjust-writing')
  testAdjustWriting(
    @Body()
    body: {
      textInput: string;
      operation: 'improve' | 'shorten' | 'lengthen' | 'simplify';
      dealId: number;
    },
  ) {
    return this.gptService.adjustWriting(body);
  }

  @Post('/generate-investment-memo')
  testGenerateInvestmentMemo(
    @Body() body: { address: string; dealId: number },
  ) {
    return this.gptService.generateInvestmentMemo(body);
  }

  @Post('/generate-property-summary')
  generateRentCompsSummary(@Body() body: any) {
    return this.gptService.rentCompSummary(body);
  }

  @Post('/process-input')
  testProcessInput(@Body() body) {
    return this.gptService.produceContent(body);
  }

  // @Post('/langchain')
  // retrieveData(@Body() body) {
  //   return this.langchain.retrieveData(body);
  // }
}
