import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Session,
  Patch,
} from '@nestjs/common';
import { DocumentService } from '../services/document.service';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { SessionContainer } from 'supertokens-node/recipe/session';
import { Document } from '../entities/document.entity';

@Controller('document')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  create(@Body() createDocumentDto: CreateDocumentDto) {
    return this.documentService.create(createDocumentDto);
  }

  @Get()
  @UseGuards(new AuthGuard())
  findAll(@Session() session: SessionContainer): Promise<Document[]> {
    return this.documentService.findAll(session.getUserId());
  }

  @Get('organization')
  @UseGuards(new AuthGuard())
  findAllOrganizationDocument(
    @Session() session: SessionContainer,
  ): Promise<Document[]> {
    return this.documentService.findAllOrganizationDocument(
      session.getUserId(),
    );
  }

  @Get('conversation/:conversationId')
  @UseGuards(new AuthGuard())
  findAllDocumentByConversationID(
    @Param('conversationId') conversationId: string,
  ): Promise<Document[]> {
    return this.documentService.findAllDocumentByConversationID(conversationId);
  }

  @Get('document/:id')
  // @UseGuards(new AuthGuard())
  getAllDocument(@Param('id') id: number): Promise<Document[]> {
    return this.documentService.test(id);
  }

  @Post('upload')
  @UseGuards(new AuthGuard())
  async uploadDocument(
    @Body() document: any,
    @Session() session: SessionContainer,
  ) {
    return this.documentService.uploadAndAddDocument(
      document,
      session.getUserId(),
    );
  }

  @Get('/workbook/:id')
  async getWorkbookData(@Param('id') id: string) {
    return await this.documentService.getWorkbookComputedData(id);
  }

  @UseGuards(new AuthGuard())
  @Patch(`:id`)
  async updateSingleDocument(
    @Body() body: any,
    @Param('id') id: number,
  ): Promise<Document> {
    await this.documentService.updateSingleDocument(id, body);
    return await this.documentService.findOne(id);
  }
}
