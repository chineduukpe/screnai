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
  NotFoundException,
} from '@nestjs/common';
import { ModelService } from '../services/model.service';
import { CreateModelDto } from '../dto/create-model.dto';
import { UpdateModelDto } from '../dto/update-model.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { SessionContainer } from 'supertokens-node/recipe/session';
import { MicrosoftService } from 'src/utilities/services/microsoft.service';
import {
  AddAutomationDto,
  AutomationI,
  DuplicaModelDTO,
  ModelMappingI,
} from '../interfaces/model-automation.interface';
import {
  AddBenchmarkDto,
  ModelBenchamarkI,
} from '../interfaces/model-benchmark.interface';

@Controller('models')
export class ModelController {
  constructor(
    private readonly modelService: ModelService,
    private microsoftService: MicrosoftService,
  ) {}

  @Post()
  @UseGuards(new AuthGuard())
  async create(
    @Body() createModelDto: CreateModelDto,
    @Session() session: SessionContainer,
  ) {
    const meta: any = {};
    let modelMSGraphURL: string;
    createModelDto.isDefault = true;
    const model = await this.modelService.createModelHandler(
      { ...createModelDto, meta, modelMSGraphURL },
      session.getUserId(),
    );

    console.log(model, 'Model Created');

    return model;
  }

  @Post(':id/mapping')
  @UseGuards(new AuthGuard())
  async modelMapping(@Body() data: ModelMappingI[], @Param('id') id: string) {
    return await this.modelService.modelMapping(data, id);
  }

  @Patch(':id/default-model')
  @UseGuards(new AuthGuard())
  async updateDefaultModel(
    @Param('id') id: number,
    @Session() session: SessionContainer,
  ) {
    return await this.modelService.updateDefaultModel(id, session.getUserId());
  }

  @Post('duplicate-model')
  @UseGuards(new AuthGuard())
  async duplicateModel(@Body() data: DuplicaModelDTO) {
    return await this.modelService.duplicateModel(data);
  }

  @UseGuards(new AuthGuard())
  @Get()
  findAll(@Session() session: SessionContainer) {
    return this.modelService.findUserModelWithDocs(session.getUserId());
  }

  @Get(':id')
  @UseGuards(new AuthGuard())
  async findOne(@Param('id') id: string, @Session() session: SessionContainer) {
    const model = await this.modelService.findOne(+id, session.getUserId());
    return model;
  }

  @Get(':conversationId/conversation/single')
  @UseGuards(new AuthGuard())
  async findOneByConversationId(
    @Param('conversationId') conversationId: string,
  ) {
    const model = await this.modelService.findOneByConversationId(
      conversationId,
    );
    return model;
  }

  @Post('/automation')
  @UseGuards(new AuthGuard())
  async addAutomation(
    @Body() body: AddAutomationDto,
    @Session() session: SessionContainer,
  ) {
    const userId = session.getUserId();
    const model = await this.modelService.findOne(body.modelId, userId);
    if (!model) {
      throw new NotFoundException('Model not found for user or organization');
    }

    await this.modelService.addAutomation(body);
    return await this.modelService.findOne(body.modelId, userId);
  }

  @Post('/benchmark')
  @UseGuards(new AuthGuard())
  async addBenchmark(
    @Body() body: AddBenchmarkDto,
    @Session() session: SessionContainer,
  ) {
    const userId = session.getUserId();
    const model = await this.modelService.findOne(body.modelId, userId);

    if (!model) {
      throw new NotFoundException('Model not found for user or organization');
    }

    const updatedModel = await this.modelService.addBenchmarks(
      body.modelBenchmark,
      model,
    );

    return updatedModel;
  }

  @Get('deleted')
  getDeletedModels(@Session() session: SessionContainer) {
    return this.modelService.getDeletedModels(session.getUserId());
  }

  @Patch(':id/restore')
  @UseGuards(new AuthGuard())
  restoreDeal(@Param('id') id: number) {
    return this.modelService.restoreModel(id);
  }

  @Delete(':id/permanently-delete')
  @UseGuards(new AuthGuard())
  async permanentlyDeleteModel(@Param('id') id: number) {
    return this.modelService.permanentlyDeleteModel(id);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() updateModelDto: UpdateModelDto) {
    return this.modelService.update(id, updateModelDto);
  }

  @Delete(':id')
  @UseGuards(new AuthGuard())
  remove(@Param('id') id: number) {
    return this.modelService.deleteModel(id);
  }

  @Get('create-shareable-link/:id')
  async createShareableLink(@Param('id') id: string) {
    return await this.microsoftService.createSharableLink(id);
  }

  @Patch(':modelId/benchmark/:benchmarkIndex')
  @UseGuards(new AuthGuard())
  updateBenchmark(
    @Param('modelId') modelId: number,
    @Param('benchmarkIndex') benchmarkIndex: number,
    @Body() body: ModelBenchamarkI,
  ) {
    return this.modelService.updateBenchmark(modelId, benchmarkIndex, body);
  }

  @Patch(':modelId/automation/:automationIndex')
  @UseGuards(new AuthGuard())
  updateAutomation(
    @Param('modelId') modelId: number,
    @Param('automationIndex') automationIndex: number,
    @Body() body: AutomationI,
  ) {
    return this.modelService.updateAutomation(modelId, automationIndex, body);
  }

  @Delete(':modelId/benchmark/:benchmarkIndex')
  @UseGuards(new AuthGuard())
  deleteBenmarch(
    @Param('modelId') modelId: number,
    @Param('benchmarkIndex') benchmarkIndex: number,
  ) {
    return this.modelService.deleteBenchmark(modelId, benchmarkIndex);
  }

  @Delete(':modelId/automation/:automationIndex')
  @UseGuards(new AuthGuard())
  deleteAutomation(
    @Param('modelId') modelId: number,
    @Param('automationIndex') automationIndex: number,
  ) {
    return this.modelService.deleteAutomation(modelId, automationIndex);
  }
}
