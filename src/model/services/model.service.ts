import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UpdateModelDto } from '../dto/update-model.dto';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../user/entities/user.entity';
import { Model } from '../../model/entities/model.entity';
import { In, IsNull, Not, Repository } from 'typeorm';
import { MicrosoftService } from '../../utilities/services/microsoft.service';
import { CreateModelServiceDto } from '../dto/create-model.dto';
import {
  AddAutomationDto,
  AutomationI,
  DuplicaModelDTO,
  ModelMappingI,
} from '../interfaces/model-automation.interface';
import { ModelBenchamarkI } from '../interfaces/model-benchmark.interface';
import { EventsGateway } from 'src/events/events.gateway';
import { WorkbookUtility } from 'src/utilities/services/workbook.utility.service';
import { Deal } from 'src/deal/entities/deal.entity';
import { SyncedModelI } from 'src/deal/interfaces/model.sync.interface';
import { Document } from 'src/document/entities/document.entity';
import {
  DocumentStatusENUM,
  OPENAI_VECTOR_DIMENSION,
} from 'src/utilities/constants';
import { PineconeService } from 'src/llm/services/pinecone.service';
import { UtilitiesService } from 'src/utilities/services/utilities.service';
import { ZepService } from 'src/llm/services/zep.service';
import { LlmService } from 'src/llm/services/llm.service';

@Injectable()
export class ModelService {
  private logger: Logger;
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Model) private modelRepo: Repository<Model>,
    @InjectRepository(Deal) private dealRepo: Repository<Deal>,
    @InjectRepository(Document) private documentRepo: Repository<Document>,
    private microsoftService: MicrosoftService,
    private workbookUtility: WorkbookUtility,
    private utititiesService: UtilitiesService,
    private pineconeService: PineconeService,
    private zepService: ZepService,
    private llmService: LlmService,
    private event: EventsGateway, // private documentService: DocumentService,
  ) {
    this.logger = new Logger(ModelService.name);
  }

  async createModelHandler(
    createModelDto: CreateModelServiceDto,
    userId: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    createModelDto.userId = user?.id;
    createModelDto.organizationId = user?.organizationId;
    const organizationDefaultModel = await this.getOrganizationDefaultModel(
      user?.organizationId,
    );

    if (!organizationDefaultModel) {
      createModelDto.isDefault = true;
    }

    const newModel = await this.create(createModelDto);

    if (createModelDto.isDefault && organizationDefaultModel) {
      organizationDefaultModel.isDefault = false;
      await this.update(organizationDefaultModel?.id, organizationDefaultModel);
    }

    const document = this.documentRepo.create({
      documentName: createModelDto.documentName,
      conversationId: createModelDto.conversationId,
      inputFileURL: createModelDto.modelDocumentURL,
      userId: user?.id,
      status: DocumentStatusENUM.SYNC_COMPLETED,
      fileType: 'others',
    });

    await this.documentRepo.save(document);
    // const createdDocument = await this.documentRepo.save(document);
    // this.documentService.attachMetaToDocument(createdDocument);

    return newModel;
  }

  async getOrganizationDefaultModel(organizationId: number): Promise<Model> {
    return await this.modelRepo.findOne({
      where: {
        organizationId,
        isDefault: true,
      },
    });
  }

  async create(createModelDto: CreateModelServiceDto) {
    const response = await axios.get(createModelDto.modelDocumentURL, {
      responseType: 'arraybuffer',
    });

    let sheetNames: string[] = [];

    try {
      sheetNames = await this.workbookUtility.getWorkbookSheetNamesFromBuffer(
        response?.data,
      );
    } catch (error) {
      this.logger.log(error);
      throw new InternalServerErrorException(
        'Could not upload file to MS Graph',
      );
    }

    const fileToMSGraph = await this.microsoftService.uploadBufferToMSGraph(
      createModelDto.documentName,
      response.data,
    );

    const MSmeta = this.microsoftService.extractWorkbookMeta(
      fileToMSGraph?.uploadResponse,
    );

    const model = this.modelRepo.create({
      ...createModelDto,
      meta: {
        model: {
          microsoft: MSmeta,
          sheetNames,
          loadJSON: false,
        },
      },
    });

    const createdModel = await this.modelRepo.save(model);

    this.getModelWorkbookJSON(MSmeta.id, createdModel.id).then(
      async (updatedModel) => {
        const indexName = `m${String(createdModel?.userId)
          .replaceAll('-', '')
          .slice(0, 8)}_${updatedModel.id}`
          .replaceAll('-', '_')
          .slice(0);

        const workbookJSON = updatedModel?.meta?.model?.workbookJSON;

        if (!workbookJSON) {
          this.logger.log(`No workbook JSON for model ${updatedModel?.id}`);
          return;
        }
        const parsedCells = this.utititiesService.transformExcelData(
          updatedModel?.meta?.model?.workbookJSON,
        );

        const metricsResponse = await this.llmService.findMetricsInModelJSON(
          parsedCells,
        );

        this.addBenchmarks(metricsResponse, updatedModel);
        // this.zepService.createDocumentCollection(indexName).then(() => {
        //   this.zepService.addLargeTextToCollection(
        //     indexName,
        //     JSON.stringify(
        //       this.utititiesService.transformExcelData(
        //         updatedModel?.meta?.model?.workbookJSON,
        //       ),
        //     ),
        //     300,
        //   );
        // });
      },
    );
    return createdModel;
  }

  async duplicateModel(data: DuplicaModelDTO) {
    const { modelId, deals, automations, doNotAskAgain } = data;

    // Fetch the current model
    const model = await this.modelRepo.findOne({
      where: {
        id: modelId,
      },
    });

    if (!model) throw new NotFoundException('Model not found');

    const modelAutomation = model.modelAutomation ?? [];

    if (automations && automations.length > 0) {
      for (const automation of automations) {
        modelAutomation.push(automation);
      }
    }

    const newModel = this.modelRepo.create({
      ...model,
      id: undefined,
      modelAutomation,
      modelName: `Copy of ${model.modelName}`,
      createdAt: new Date(),
    });

    // Save the new model to the database
    const savedModel = await this.modelRepo.save(newModel);
    this.logger.log(savedModel.id, 'new model created');

    // Fetch the deals to update
    const dealEntities = await this.dealRepo.findBy({
      id: In(deals),
    });

    // Update the activeModelSyncId and push meta into models array
    for (const deal of dealEntities) {
      if (deal.meta) {
        const syncedModel: SyncedModelI = {
          meta: {
            microsoft: deal.meta.model.microsoft,
          },
          modelId,
          modelName: model.modelName,
        };
        if (!deal.models) {
          deal.models = [];
        }

        deal.models.push(syncedModel);
      }

      deal.activeModelSyncId = savedModel.id;
    }

    // Save the updated deals
    await this.dealRepo.save(dealEntities);

    this.logger.log('Deals updated with new activeModelSyncId and models');

    // Fetch and update documents
    const documentEntities = await this.documentRepo.findBy({
      dealId: In(deals),
    });

    for (const document of documentEntities) {
      document.status = DocumentStatusENUM.ANALYSIS_COMPLETED;
    }

    // Save the updated documents
    await this.documentRepo.save(documentEntities);

    // Update do not ask confirmation
    model.meta.model.confirmAutomation = doNotAskAgain;
    await this.modelRepo.save(model);

    return savedModel;
  }

  async modelMapping(data: ModelMappingI[], modelId: string) {
    const model = await this.modelRepo.findOne({
      where: {
        id: +modelId,
      },
    });

    if (!model) throw new NotFoundException('Model with that ID not found.');

    model.modelMapping = data;

    return await this.modelRepo.save(model);
  }

  async getModelWorkbookJSON(workbookId: string, modelId: number) {
    this.logger.log('Startedddd');
    const response = await this.microsoftService.getWorkbookComputedData(
      workbookId,
    );

    const model = await this.modelRepo.findOne({
      where: {
        id: modelId,
      },
    });

    model.meta.model.workbookJSON = response;
    model.meta.model.loadJSON = true;
    await this.modelRepo.save(model);

    this.logger.log('Completed');

    // Trigger Event Server
    this.event.setMaxListeners(20);
    this.event.sendEventToClients(`load_json:${modelId}`, {
      message: 'load json completed',
      success: true,
    });

    return model;
  }

  async findAll(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User account not found');
    }

    return this.modelRepo.find({
      where: {
        organizationId: user?.organizationId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOneByConversationId(conversationId: string): Promise<Model> {
    this.logger.log('I got herereere');
    return await this.modelRepo.findOne({
      where: {
        conversationId,
      },
    });
  }

  async findOneById(id: number): Promise<Model> {
    return await this.modelRepo.findOne({
      where: {
        id,
      },
    });
  }

  async findOne(id: number, userId: string): Promise<Model> {
    return await this.modelRepo.findOne({
      where: {
        userId,
        id,
      },
      relations: ['activeDeals'],
    });
  }

  async getOne(id: number): Promise<Model> {
    return await this.modelRepo.findOne({
      where: {
        id,
      },
    });
  }

  async update(id: number, updateModelDto: UpdateModelDto) {
    const model = await this.modelRepo.findOne({
      where: { id },
    });

    if (!model) throw new NotFoundException('Model not found');

    return await this.modelRepo.update(id, updateModelDto);
  }

  async deleteModel(id: number) {
    // Soft delete all deals where activeModelSyncId matches the given id
    await this.dealRepo.softDelete({ activeModelSyncId: id });

    // Extract the ids of the deleted deals
    const deletedDealIds = await this.dealRepo
      .find({
        where: { activeModelSyncId: id, deletedAt: Not(IsNull()) },
        select: ['id'],
        withDeleted: true,
      })
      .then((deals) => deals.map((deal) => deal.id));

    this.logger.log(deletedDealIds, 'deletedDealIds');

    // Soft delete all documents where the dealId matches any of the deleted deal ids
    if (deletedDealIds.length > 0) {
      await this.documentRepo.softDelete({ dealId: In(deletedDealIds) });
    }

    // Soft delete the model with the given id
    const model = await this.modelRepo.softDelete({ id });

    if (!model) throw new NotFoundException('Model not found');

    return model;
  }

  async findUserModelWithDocs(userId: string): Promise<Model[]> {
    return this.modelRepo
      .createQueryBuilder('model')
      .leftJoinAndSelect('model.activeDeals', 'deals')
      .leftJoinAndSelect('deals.documents', 'documents')
      .where(`model.userId = :id`, { id: userId })
      .orderBy('model.createdAt', 'DESC')
      .getMany();
  }

  async findDeletedUserModelWithDocs(userId: string): Promise<Model[]> {
    return this.modelRepo
      .createQueryBuilder('model')
      .withDeleted()
      .leftJoinAndSelect('model.activeDeals', 'deals')
      .withDeleted()
      .leftJoinAndSelect('deals.documents', 'documents')
      .withDeleted()
      .where('model.userId = :id', { id: userId })
      .andWhere('model.deletedAt IS NOT NULL')
      .andWhere('deals.deletedAt IS NOT NULL')
      .andWhere('documents.deletedAt IS NOT NULL')
      .orderBy('model.createdAt', 'DESC')
      .getMany();
  }

  async addAutomation(data: AddAutomationDto): Promise<Model> {
    const model = await this.modelRepo.findOne({ where: { id: data.modelId } });

    if (!model) throw new NotFoundException('Model not found');

    const automations = model.modelAutomation ?? [];

    for (const automation of data.automations) {
      automations.push(automation);
    }

    model.modelAutomation = automations;
    model.meta.model.confirmAutomation = data.doNotAskAgain;

    await this.modelRepo.save(model);
    return model;
  }

  async getDeletedModels(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    const deletedColumns = await this.modelRepo.find({
      where: {
        deletedAt: Not(IsNull()),
        organizationId: user.organizationId,
      },
      withDeleted: true,
      order: {
        createdAt: 'DESC',
      },
    });

    return deletedColumns;
  }

  async restoreModel(id: number): Promise<Model> {
    // Restore the model
    const model = await this.modelRepo.restore({ id });
    if (!model) throw new NotFoundException('Model not found');

    // Find and restore deals related to the model
    const deals = await this.dealRepo.find({
      where: { activeModelSyncId: id },
      withDeleted: true,
    });
    const dealIds = deals.map((deal) => deal.id);
    if (dealIds.length > 0) {
      await this.dealRepo.restore(dealIds);
    }

    // Find and restore documents related to the deals
    if (dealIds.length > 0) {
      await this.documentRepo
        .createQueryBuilder()
        .update(Document)
        .set({ deletedAt: null })
        .where('dealId IN (:...dealIds)', { dealIds })
        .execute();
    }

    return this.modelRepo.findOne({
      where: { id },
    });
  }

  async updateDefaultModel(id: number, userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    const organizationId = user.organizationId;

    // Set isDefault to false for all models in the organization
    await this.modelRepo.update({ organizationId }, { isDefault: false });

    // Set isDefault to true for the specified model
    const updateResult = await this.modelRepo.update(
      { id, organizationId },
      { isDefault: true },
    );

    if (updateResult.affected === 0) {
      throw new NotFoundException('Model not found');
    }
  }

  async permanentlyDeleteModel(id: number): Promise<void> {
    // Find the model to ensure it exists
    const model = await this.modelRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!model) throw new NotFoundException('Model not found');

    // Find deals related to the model
    const deals = await this.dealRepo.find({
      where: { activeModelSyncId: id },
      withDeleted: true,
    });
    const dealIds = deals.map((deal) => deal.id);

    // Find and remove documents related to the deals
    if (dealIds.length > 0) {
      const documents = await this.documentRepo.find({
        where: { dealId: In(dealIds) },
        withDeleted: true,
      });
      await this.documentRepo.remove(documents);
    }

    // Remove the deals
    if (dealIds.length > 0) {
      await this.dealRepo.remove(deals);
    }

    // Remove the model
    await this.modelRepo.remove(model);
  }

  async deleteAutomation(modelId: number, automationIndex: number) {
    const model = await this.modelRepo.findOneBy({ id: modelId });

    if (
      automationIndex >= 0 &&
      automationIndex < model?.modelAutomation.length
    ) {
      model?.modelAutomation.splice(automationIndex, 1);
    } else {
      throw new BadRequestException('Invalid index to delete');
    }

    return await this.modelRepo.save(model);
  }

  async deleteBenchmark(modelId: number, benchmarkIndex: number) {
    const model = await this.modelRepo.findOneBy({ id: modelId });

    if (benchmarkIndex >= 0 && benchmarkIndex < model?.modelBenchmark.length) {
      model?.modelBenchmark.splice(benchmarkIndex, 1);
    } else {
      throw new BadRequestException('Invalid index to delete');
    }

    return await this.modelRepo.save(model);
  }

  async addBenchmarks(data: ModelBenchamarkI[], md: Model): Promise<Model> {
    const model = await this.getOne(md.id);
    if (!model) throw new NotFoundException('Model not found');
    const modelBenchmark = model.modelBenchmark ?? [];

    for (const benchmark of data) {
      const existingIndex = modelBenchmark.findIndex(
        (b) =>
          String(b.name).toLowerCase() === String(benchmark.name).toLowerCase(),
      );
      if (existingIndex !== -1) {
        modelBenchmark[existingIndex] = benchmark;
      } else {
        modelBenchmark.push(benchmark);
      }
    }

    model.modelBenchmark = modelBenchmark;

    await this.modelRepo.update(model.id, model);

    return model;
  }

  async updateBenchmark(
    modelId: number,
    benchmarkIndex: number,
    updatedBenchmark: ModelBenchamarkI,
  ): Promise<Model> {
    const model = await this.modelRepo.findOneBy({ id: modelId });
    if (!model) {
      throw new NotFoundException('Model not found');
    }

    if (benchmarkIndex < 0 || benchmarkIndex >= model.modelBenchmark.length) {
      throw new BadRequestException('Invalid index to update');
    }

    // Step 3: Update the benchmark
    model.modelBenchmark[benchmarkIndex] = updatedBenchmark;

    // Step 4: Save the updated model
    await this.modelRepo.save(model);

    return model;
  }

  async updateAutomation(
    modelId: number,
    automationIndex: number,
    updatedAutomation: AutomationI,
  ): Promise<Model> {
    const model = await this.modelRepo.findOneBy({ id: modelId });
    if (!model) {
      throw new NotFoundException('Model not found');
    }

    if (
      automationIndex < 0 ||
      automationIndex >= model.modelAutomation.length
    ) {
      throw new BadRequestException('Invalid index to update');
    }

    // Step 3: Update the benchmark
    model.modelAutomation[automationIndex] = updatedAutomation;

    // Step 4: Save the updated model
    await this.modelRepo.save(model);

    return model;
  }

  async getOrganizationModels(organizationId: number): Promise<Model[]> {
    return await this.modelRepo.find({
      where: {
        organizationId,
      },
    });
  }
}
