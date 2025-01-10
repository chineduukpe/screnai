import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Session,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DealService } from '../services/deal.service';
import { PropertyService } from '../../property/services/property.service';
import { AuthGuard } from '../../auth/auth.guard';
import { SessionContainer } from 'supertokens-node/recipe/session';
import { DocumentService } from '../../document/services/document.service';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 } from 'uuid';
import { CreateDealDto } from '../dto/create-deal.dto';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { SyncModelDto } from '../interfaces/model.sync.interface';
import { Deal } from '../entities/deal.entity';
import { EmailDealService } from '../services/email.deals.service';
import { LangchainService } from 'src/gpt/langchain.service';
import { Conversation } from 'src/conversation/entities/conversation.entity';

@Controller('deals')
export class DealController {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepo: Repository<Conversation>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly dealService: DealService,
    private emailDealService: EmailDealService,
    private propertyService: PropertyService,
    private documentService: DocumentService,
    private langchainService: LangchainService,
  ) {}

  @Post('langchain')
  async langchainQA(@Body() body: any) {
    return await this.langchainService.langchainQA(body);
  }

  // @Sse('qa')
  // langchainQAA(@Body() body: any): Observable<MessageEvent> {
  //   const { query, dealId } = body;
  //   return new Observable<MessageEvent>((observer) => {
  //     this.langchainService.processQuery(query, dealId, observer);
  //   });
  // }

  @UseGuards(new AuthGuard())
  @Post()
  async create(
    @Body() createDealDto: CreateDealDto,
    @Session() session: SessionContainer,
  ) {
    createDealDto.modelId = !!createDealDto?.modelId
      ? createDealDto?.modelId
      : undefined;
    const userId: string = session.getUserId();
    const user = await this.userRepo.findOne({ where: { id: userId } });

    const { propertyName, propertyAddress, propertyId } = createDealDto;
    const propertyExists = await this.propertyService.findOneByNameOrCreate(
      propertyAddress,
      propertyName,
      propertyId,
    );

    const deal = await this.dealService.create({
      dealName: propertyName,
      dealAddress: propertyAddress,
      propertyId: propertyExists?.id || null,
      organizationId: user?.organizationId,
      conversationId: createDealDto?.conversationId || '',
      userId,
      activeModelSyncId:
        typeof createDealDto?.modelId === 'number'
          ? createDealDto?.modelId
          : null,
      meta: createDealDto.modelId
        ? {
            duplicating: true,
            model: {
              microsoft: {},
              s3URL: '',
            },
          }
        : null,
    });

    if (typeof createDealDto.modelId === 'number' && createDealDto.modelId) {
      this.dealService.duplicateModelForDeal(deal);
    }

    this.documentService.createMultipleDocuments(
      createDealDto.documents,
      userId,
      deal?.id,
      createDealDto.conversationId,
    );

    if (createDealDto?.conversationId) {
      const conversation = await this.conversationRepo.findOne({
        where: { conversationId: createDealDto?.conversationId },
      });

      const uuID = v4();

      const aiMessage = {
        uuid: uuID,
        role: 'CRESA',
        roleType: 'assistant',
        content:
          "Great news! Your deal has been successfully created and your documents have been uploaded. I'm here to help you with any questions you might have. Feel free to ask me about the documents you've just uploaded, request assistance with writing data to your model, or inquire about the screening results",

        createdAt: new Date(),
        metadata: null,
      };

      const conversationHistory = conversation?.messages || [];
      conversationHistory.push(aiMessage);
      conversation.messages = conversationHistory;
      conversation.dealId = deal?.id;
      await this.conversationRepo.save(conversation);
    }

    return deal;
  }

  @Get()
  @UseGuards(new AuthGuard())
  findAll(@Session() session: SessionContainer) {
    return this.dealService.findAll(session.getUserId());
  }

  @UseGuards(new AuthGuard())
  @Get(':id')
  async findOne(@Param('id') id: string, @Session() session: SessionContainer) {
    const userId = session.getUserId();
    return this.dealService.findOneByOrganization(+id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDealDto: Partial<Deal>) {
    return this.dealService.update(+id, updateDealDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dealService.remove(+id);
  }

  @UseGuards(new AuthGuard())
  @Post(':dealId/sync-model')
  async syncDealToModel(
    @Param('dealId') dealId: number,
    @Body() body: SyncModelDto,
  ) {
    return this.dealService.syncDealToModel(dealId, body);
  }

  @Post('/handle-gmail-callback')
  @HttpCode(HttpStatus.OK)
  async handleGmailWebhookNotification(@Body() body: any) {
    this.emailDealService.processGmailNotification(body);
    return 'OK';
  }

  @UseGuards(new AuthGuard())
  @Patch(':dealId/clear-chat-history')
  async clearChatHistory(@Param('dealId') dealId: number) {
    return this.dealService.clearChatHistory(dealId);
  }
}
