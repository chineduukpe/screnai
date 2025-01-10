import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Session,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { SessionContainer } from 'supertokens-node/recipe/session';
import { AgentService } from '../services/agent.service';
import { UserService } from 'src/user/services/user.service';
import { CallBeachhead, CallCresaI } from '../interfaces/cresa.interface';
import { BeachheadService } from '../services/beachhead.service';
import { ZepService } from '../services/zep.service';

@Controller('llm')
export class LlmController {
  constructor(
    private agentService: AgentService,
    private userService: UserService,
    private bhService: BeachheadService,
    private zepService: ZepService,
  ) {}

  @UseGuards(new AuthGuard())
  @Post('/cresa')
  async callCresa(
    @Session() session: SessionContainer,
    @Body() body: CallCresaI,
  ) {
    const filesPart = !body.files?.length
      ? ''
      : `
    ${body.files
      ?.map(
        (file) =>
          `Document Name - ${file?.fileName}: Document URL - ${file?.fileURL}`,
      )
      .join('\n')}`;

    const parsedQuery = `${body.query ? body?.query : ''}
    
    ${filesPart}
    `;

    return await this.agentService.init2(
      session.getUserId(),
      body.conversationId,
      parsedQuery,
      body.files,
    );
  }

  @UseGuards(new AuthGuard())
  @Get('/cresa/conversation/:id')
  async getConversation(@Param('id') id: string) {
    const conversations = await this.agentService.getConversation(id);

    return conversations;
  }

  @Post('/beachhead')
  async callBeachhead(@Body() body: CallBeachhead) {
    return await this.bhService.beachhead(body);
  }

  // @Post('/generate-intent')
  // async generateIntent(@Body() body: any) {
  //   console.log(body, 'body');
  //   return await this.agentService.generateConversationItent(body?.query);
  // }

  @Get('/beachhead/conversation/:id')
  async getBeachHeadConversation(@Param('id') id: string) {
    return await this.bhService.getConversation(id);
  }

  @Get('/sessions/:id')
  async getSingleSession() {
    return await this.zepService.getZepUser(
      '52984d41-b976-4c32-803f-3a4160869443',
    );
  }

  @Get('/user/sessions')
  async getUserSessions() {
    return await this.zepService.getUserSession(
      '52984d41-b976-4c32-803f-3a4160869443',
    );
  }
}
