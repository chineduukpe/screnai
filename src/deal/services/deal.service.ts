import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ServiceCreateDealDto } from '../dto/create-deal.dto';
import { Deal } from '../entities/deal.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { Model } from 'src/model/entities/model.entity';
import axios, { Axios } from 'axios';
import { MicrosoftService } from 'src/utilities/services/microsoft.service';
import { AWSService } from 'src/utilities/services/aws.service';
import {
  ComparableBenchmarkI,
  DealComparablesI,
  DealMetaI,
} from '../interfaces/entity.interface';
import { EventsGateway } from 'src/events/events.gateway';
import {
  BETWEEN,
  DocumentStatusENUM,
  DocumentTypeENUM,
  EQUAL_TO,
  GREATER_THAN,
  LESS_THAN,
} from 'src/utilities/constants';
import { Document } from 'src/document/entities/document.entity';
import { WorkbookUtility } from 'src/utilities/services/workbook.utility.service';
import { T12SummaryI } from 'src/document/interfaces/document.entitiy.interfaces';
import { RRUtilityService } from 'src/utilities/RRUtility.service';
import * as https from 'https';
import { AutomationI } from 'src/model/interfaces/model-automation.interface';
import { DocumentService } from 'src/document/services/document.service';
import { ModelBenchamarkI } from 'src/model/interfaces/model-benchmark.interface';
import { UtilitiesService } from 'src/utilities/services/utilities.service';
import { LangchainService } from 'src/gpt/langchain.service';

@Injectable()
export class DealService {
  private axiosInstance: Axios;
  constructor(
    @InjectRepository(Model) private modelRepo: Repository<Model>,
    @InjectRepository(Deal) private dealRepo: Repository<Deal>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private microsoftService: MicrosoftService,
    private awsService: AWSService,
    private event: EventsGateway,
    private workbookUtility: WorkbookUtility,
    private rrUtilityService: RRUtilityService,
    private documentService: DocumentService,
    private utilitiesService: UtilitiesService,
    private langchainServce: LangchainService,
  ) {
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Ignore certificate validation
      }),
    });
  }
  private readonly logger: Logger = new Logger(DealService.name);

  async create(createDealDto: ServiceCreateDealDto) {
    return await this.dealRepo.save(createDealDto);
  }

  async findAll(userId: string) {
    const user = await this.userRepo?.findOne({
      where: {
        id: userId,
      },
    });

    return await this.dealRepo.find({
      where: {
        organizationId: user?.organizationId,
      },
      relations: ['activeModel'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async clearChatHistory(dealId: number) {
    const deal = await this.dealRepo.findOne({
      where: {
        id: dealId,
      },
    });

    if (!deal) throw new NotFoundException('No deal found');

    deal.chatHistory = null;

    return await this.dealRepo.save(deal);
  }

  async countUserDeals(userId: string): Promise<number> {
    const dealsCount = await this.dealRepo.count({
      where: {
        userId,
      },
    });

    return dealsCount;
  }

  async findOne(id: number): Promise<Deal> {
    return await this.dealRepo.findOne({
      where: {
        id,
      },
    });
  }

  async findOnByThreadId(threadId: string): Promise<Deal> {
    return await this.dealRepo.findOne({
      where: {
        emailThreadId: threadId,
      },
    });
  }

  async findOneByOrganization(id: number, userId: string) {
    const user = await this.userRepo?.findOne({
      where: {
        id: userId,
      },
    });

    return await this.dealRepo
      .createQueryBuilder('deal')
      .leftJoinAndSelect('deal.activeModel', 'activeModel')
      .leftJoinAndSelect('deal.documents', 'documents')
      .leftJoinAndSelect('deal.property', 'property')
      .where(`deal.id=:id and deal.organizationId=:organizationId`, {
        id,
        organizationId: user?.organizationId,
      })
      .getOne();
  }

  async update(id: number, updateDealDto: Partial<Deal>) {
    return this.dealRepo.update(id, updateDealDto);
  }

  remove(id: number) {
    return `This action removes a #${id} deal`;
  }

  async duplicateModelForDeal(deal: Deal) {
    try {
      const model = await this.modelRepo.findOne({
        where: {
          id: deal?.activeModelSyncId,
        },
      });

      if (!model) throw new NotFoundException('Selected model not found');

      // const fileContent = await this.awsService.getFileAsBuffer(
      //   model?.modelDocumentURL,
      // );
      const fileContent = await axios.get(model?.modelDocumentURL, {
        responseType: 'arraybuffer',
      });

      const lastDotIndex = model?.modelDocumentURL.lastIndexOf('.');
      const fileExtension = model?.modelDocumentURL.slice(lastDotIndex + 1);

      const uploadFileName = `${deal?.dealName?.replaceAll(
        ' ',
        '',
      )}.${fileExtension}`.toLowerCase();

      const lastSlashIndex = uploadFileName.lastIndexOf('/');

      const MSGraphResponse = await this.microsoftService.uploadBufferToMSGraph(
        uploadFileName.slice(lastSlashIndex + 1),
        fileContent?.data,
      );

      const url = await this.awsService.uploadBufferToS3(
        fileContent.data,
        `deals/${deal?.id}/outputs/${uploadFileName}`.toLowerCase(),
      );

      const newDeal = await this.dealRepo.findOne({
        where: {
          id: deal.id,
        },
      });

      const meta: DealMetaI = newDeal?.meta ?? {
        model: {
          microsoft: {},
        },
      };

      if (!meta?.model?.microsoft) {
        meta.model.microsoft = {};
      }

      meta.model.s3URL = url;
      meta.duplicating = false;
      meta.model.microsoft = this.microsoftService.extractWorkbookMeta(
        MSGraphResponse.uploadResponse,
      );
      // meta.model.microsoft.id = MSGraphResponse?.uploadResponse?.id;
      // meta.model.microsoft.embedURL = MSGraphResponse?.embedURL;
      // meta.model.microsoft.eTag = this.microsoftService.getETag(
      //   MSGraphResponse?.uploadResponse?.eTag,
      // );
      // meta.model.microsoft.webURL = MSGraphResponse.uploadResponse?.webUrl;
      // meta.model.microsoft.downloadURL =
      //   MSGraphResponse.uploadResponse['@microsoft.graph.downloadUrl'];
      if (!newDeal.models) {
        newDeal.models = [];
      }
      newDeal.models.push({
        modelId: model?.id,
        modelName: model?.modelName,
        meta: {
          microsoft: meta?.model?.microsoft,
        },
      });
      newDeal.meta = meta;

      await this.dealRepo.update(deal.id, newDeal);

      // Trigger Event Server
      this.event.setMaxListeners(20);
      this.event.sendEventToClients(`duplicate_completed:${newDeal.id}`, {
        eventType: `duplicate_completed:${newDeal.id}`,
        success: true,
        data: {
          name: newDeal?.dealName,
          id: newDeal.id,
        },
      });
      return newDeal;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        'Could not replicate model for deal.',
      );
    }
  }

  async syncDealToModel(dealId: number, data: { modelId: number }) {
    console.log('Started syncing');
    const deal: Deal = await this.findOne(dealId);

    if (!deal) throw new NotFoundException('Deal not found');

    if (!deal.meta) {
      deal.meta = {
        model: {
          isSyncing: false,
        },
      };
    }

    deal.activeModelSyncId = data.modelId;
    const dealMeta = deal.meta ?? { model: {} };
    dealMeta.model.isSyncing = true;
    deal.meta = dealMeta;
    await this.update(dealId, deal);

    await new Promise((resolve, reject) => {
      this.duplicateModelForDeal(deal)
        .then(async (updatedDeal) => {
          this.event.setMaxListeners(20);
          this.event.sendEventToClients(
            `modelCreated:${updatedDeal.conversationId}`,
            {
              message: `Model Created`,
              eventType: `modelCreated:${updatedDeal.conversationId}`,
            },
          );

          updatedDeal.activeModelSyncId = data?.modelId;
          updatedDeal.meta.model.isSyncing = false;

          await this.update(dealId, updatedDeal);
          resolve(updatedDeal);
          // const dealAndDocuments = await this.dealRepo
          //   .createQueryBuilder('deal')
          //   .leftJoinAndSelect('deal.documents', 'documents')
          //   .where('documents.status =:status', {
          //     status: DocumentStatusENUM.ANALYSIS_COMPLETED,
          //   })
          //   .orWhere('documents.status =:status2', {
          //     status2: DocumentStatusENUM.SYNC_COMPLETED,
          //   })
          //   .andWhere('deal.id =:id', { id: dealId })
          //   .getOne();

          // for (const document of dealAndDocuments?.documents ?? []) {
          //   if (document.postProcessedData !== null) {
          //     document.status = DocumentStatusENUM.ANALYSIS_COMPLETED;
          //     await this.documentService.updateSingleDocument(
          //       document?.id,
          //       document,
          //     );
          //   }
          // }

          /**DO NOT UNCOMMENT BELOW */
          // await this.documentService.updateSingleDocument();

          // this.dealRepo.update(
          //   {
          //     id: dealId,
          //   },
          //   {
          //     activeModelSyncId: data.modelId,
          //     meta: {
          //       model: { isSyncing: false, ...updatedDeal?.meta?.model },
          //     },
          //   },
          // );

          // Trigger Event Server
          this.event.setMaxListeners(20);
          this.event.sendEventToClients(`sync_completed:${updatedDeal.id}`, {
            message: 'model sync completed',
            success: true,
            data: {
              name: updatedDeal?.dealName,
              id: updatedDeal.id,
            },
          });
        })
        .catch((error) => {
          console.log(error, 'ERRORRRRR HEREEEE');
          reject(error);
        });
    })
      .catch((error) => {
        console.log(error);
      })
      .then(() => console.log('Syncing was done successfully....'));

    return deal;
  }

  async syncDealDocument(deal: Deal, document: Document) {
    const model = await this.modelRepo.findOne({
      where: {
        id: deal?.activeModelSyncId,
      },
    });
    const modelToSyncMSGraph = deal?.meta?.model?.microsoft?.id;

    if (!modelToSyncMSGraph) {
      this.logger.debug(
        `'Model does not have an ID' for document #${document.id}`,
      );
      return;
      // throw new BadRequestException('Model does not have an ID');
    }

    if (!document.summary) {
      // this.logger.debug(
      //   `Document analysis may not be completed yet for document #${document.id}`,
      // );
      // return;
      throw new BadRequestException(
        'Document analysis may not be completed yet',
      );
    }

    if (document.fileType === DocumentTypeENUM.RENT_ROLL) {
      const dealToUpdate = await this.findOne(deal?.id);
      dealToUpdate.meta.model.isRRSynced = false;

      await this.dealRepo.save(dealToUpdate);

      this.event.setMaxListeners(20);
      this.event.sendEventToClients(`is_syncing:${dealToUpdate.id}`, {
        message: 'deal is syncing',
        success: true,
        data: {
          name: deal?.dealName,
          id: deal.id,
        },
      });

      await this.generateAutomationForRR(document, model, deal);

      await this.documentService.updateSingleDocument(document.id, document);
    } else if (document.fileType === DocumentTypeENUM.T12) {
      const dealToUpdate = await this.findOne(deal?.id);
      dealToUpdate.meta.model.isT12Synced = false;
      await this.dealRepo.save(dealToUpdate);

      this.event.setMaxListeners(20);
      this.event.sendEventToClients(`is_syncing:${deal.id}`, {
        message: 'deal is syncing',
        success: true,
        data: {
          name: deal?.dealName,
          id: deal.id,
        },
      });

      await this.generateAutomationForT12(document, model, deal);
    }
  }

  async generateAutomationForT12(document: Document, model: Model, deal: Deal) {
    const { getColumnNameFromCellName, getRowIndexFromCellName } =
      this.workbookUtility;

    // const lastAutomation =
    //   model.modelAutomation[model.modelAutomation.length - 1];

    // const allAutomations = [...model.modelAutomation, lastAutomation];

    for (const automation of model.modelAutomation ?? []) {
      if (
        !automation.modelSheetCell ||
        !automation.modelSheetName ||
        !automation.sourceSheetCell ||
        !automation.sourceSheetName ||
        !automation.sourceWorkbook ||
        automation.sourceWorkbook !== DocumentTypeENUM.T12
      ) {
        continue;
      }

      const columnName = getColumnNameFromCellName(automation.modelSheetCell);
      const rowNumber = getRowIndexFromCellName(automation.modelSheetCell);

      const summary: T12SummaryI = document?.summary as T12SummaryI;

      const updateData = [];
      const msGraphValues = [];

      const propagatingColumn = automation.sourceSheetCell.toLowerCase();

      const split = String(propagatingColumn).split(':');

      let items = [];

      if (split.length === 2) {
        const itemName = split[0].toLowerCase();
        const itemProperty = split[1].toLowerCase();

        if (['income', 'operating expenses'].includes(itemName)) {
          //Handle income
          const categoryItem = summary.intervals.categories[itemName];

          items.push(categoryItem[itemProperty]);
          updateData.push(String(categoryItem[itemProperty]));
          msGraphValues.push([categoryItem[itemProperty]]);
        } else {
          const subcategoryItem = Object.keys(
            summary.intervals.subcategories,
          ).find(
            (category) => category.toLowerCase() === split[0].toLowerCase(),
          );

          if (!subcategoryItem) continue;

          const val = String(
            summary.intervals.subcategories[subcategoryItem][split[1]],
          );

          items.push(val);
          updateData.push(String(val));
          msGraphValues.push([val]);
        }
      } else {
        items = Object.entries(summary.intervals.subcategories);

        for (const [key, value] of items) {
          if (typeof value !== 'object') continue;

          if (['t12', 't6', 't9', 't12'].includes(propagatingColumn)) {
            updateData.push(String(value[propagatingColumn]));
            msGraphValues.push([String(value[propagatingColumn])]);
          } else if (propagatingColumn.toLowerCase() === 'line item') {
            updateData.push(key);
            msGraphValues.push([key]);
          } else {
            switch (propagatingColumn.toUpperCase()) {
              //TODO: Remove magic strings
              case 'T3 PROJECTION': {
                updateData.push(String(value.t3 * 4));
                msGraphValues.push([String(value.t3 * 4)]);
              }
              case 'T6 PROJECTION': {
                updateData.push(String(value.t6 * 2));
                msGraphValues.push([String(value.t6 * 2)]);
              }
              case 'T9 PROJECTION': {
                updateData.push(String(value.t9 * 1.33));
                msGraphValues.push([String(value.t9 * 1.33)]);
              }
              default: {
                continue;
              }
            }
          }
        }
      }

      if (!items.length) continue;

      const updateRange = `${automation.modelSheetCell}:${columnName}${
        (rowNumber as number) + items.length - 1
      }`;

      console.log(updateRange, msGraphValues);

      try {
        await this.microsoftService.replaceColumnData(
          deal?.meta?.model?.microsoft?.id,
          automation.modelSheetName,
          updateRange,
          msGraphValues,
        );
        const dealToUpdate = await this.findOne(deal?.id);
        dealToUpdate.meta.model.isT12Synced = true;
        await this.dealRepo.save(dealToUpdate);

        this.event.setMaxListeners(20);
        this.event.sendEventToClients(`sync_completed:${deal.id}`, {
          message: 'model sync completed',
          success: true,
          data: {
            name: deal?.dealName,
            id: deal.id,
          },
        });
      } catch (error) {
        console.log(error, 'FAILED TO updATE MS GRPAH');
      }

      // await this.replaceDataInRange(
      //   modelURL,
      //   updateRange,
      //   updateData,
      //   automation.modelSheetName,
      // );
    }
  }

  async generateAutomationForRR(document: Document, model: Model, deal: Deal) {
    const analysis = this.rrUtilityService.getRRSheetSummary(document?.summary);

    const { getColumnNameFromCellName, getRowIndexFromCellName } =
      this.workbookUtility;

    // const lastAutomation =
    //   model.modelAutomation[model.modelAutomation.length - 1];

    // const allAutomations = [...model.modelAutomation, lastAutomation];

    const updatedDeal = await this.dealRepo.findOne({
      where: {
        id: document?.dealId,
      },
    });

    const modelURL = deal?.meta?.model?.s3URL;

    for (const automation of model?.modelAutomation ?? []) {
      if (
        !automation.modelSheetCell ||
        !automation.modelSheetName ||
        !automation.sourceSheetCell ||
        !automation.sourceSheetName ||
        !automation.sourceWorkbook ||
        String(automation.sourceWorkbook).toLocaleLowerCase() !==
          DocumentTypeENUM.RENT_ROLL
      ) {
        continue;
      }

      const targetColumnIndex = -1;
      if (automation.sourceWorkbook === DocumentTypeENUM.RENT_ROLL) {
        if (automation.type === 'column' || automation.type === 'cell') {
          /**
           * FIND THE COLUMN NAME TO REPLACE E.G LEASE RENT, MARKET RENT, AVG MARKET RENT ETC
           */
          const item = this.rrUtilityService.mapRRColumnToAnalysisKey(
            automation.sourceSheetCell,
          );

          if (!item) continue;

          await this.microsoftService.unprotectWorkbook(
            deal?.meta?.model?.microsoft?.id,
            automation.modelSheetName,
          );

          const values = [];

          //TODO, account for row wise update
          const msgraphValues = [];
          for (const [key, val] of Object.entries(analysis)) {
            if (item === 'occupied') {
              values.push(
                String(
                  Number(val.totals?.totalUnitCount) -
                    Number(val.totals?.totalVacancy),
                ),
              );
              continue;
            }
            values.push(String(val[item]));
            msgraphValues.push([String(val[item])]);
          }

          if (
            automation.splits &&
            automation.splits.length > 0 &&
            String(automation.splits[0].startCell).trim()
          ) {
            await this.writeAutomationSplitToSheet(
              modelURL,
              automation,
              values,
              updatedDeal,
            );
          } else {
            const modelStartRowNumber = getRowIndexFromCellName(
              automation.modelSheetCell,
            );
            const modelColumnName = getColumnNameFromCellName(
              automation.modelSheetCell,
            );

            const updateRange = `${
              automation.modelSheetCell
            }:${modelColumnName}${
              (modelStartRowNumber as number) + values.length - 1
            }`;
            if (!values.length) continue;

            try {
              await this.microsoftService.replaceColumnData(
                updatedDeal?.meta?.model?.microsoft?.id,
                automation.modelSheetName,
                updateRange,
                msgraphValues,
              );
            } catch (error) {
              console.log(error, 'FAILED TO updATE MS GRPAH');
            }

            // this.replaceDataInRange(
            //   modelURL,
            //   updateRange,
            //   values,
            //   automation.modelSheetName,
            // );
          }
        }
      }
    }
    const dealToUpdate = await this.findOne(deal?.id);
    dealToUpdate.meta.model.isRRSynced = true;
    await this.dealRepo.save(dealToUpdate);

    this.event.setMaxListeners(20);
    this.event.sendEventToClients(`sync_completed:${updatedDeal.id}`, {
      message: 'model sync completed',
      success: true,
      data: {
        name: updatedDeal?.dealName,
        id: updatedDeal.id,
      },
    });

    return;
  }

  async writeAutomationSplitToSheet(
    modelURL: string,
    automation: AutomationI,
    sourceRRSheetValues: Array<any>,
    deal: Deal,
  ) {
    const { getColumnNameFromCellName, getRowIndexFromCellName } =
      this.workbookUtility;
    return await new Promise(async (resolve, reject) => {
      try {
        const modelColumnName = getColumnNameFromCellName(
          automation.modelSheetCell,
        );
        const updateDataIterationStartIndex = 0;
        let writtenRowsCount = 0;
        const dataLength = sourceRRSheetValues.length;
        for (let idx = 0; idx < automation.splits.length; idx++) {
          const split = automation.splits[idx];
          const updateData = [];
          const msgraphValues = [];
          const startRowIndex = getRowIndexFromCellName(split.startCell);
          const endRowIndex = split?.endCell
            ? getRowIndexFromCellName(split.endCell)
            : Number(startRowIndex) + (dataLength - writtenRowsCount);
          // const difference = Number(endRowIndex) - Number(startRowIndex);
          const availableSourceRRItems: number = dataLength - writtenRowsCount;

          /**
           * Do not continue to other automations since no data is available to write
           * Into the automations
           */
          if (availableSourceRRItems <= 0) break;

          let difference = Number(endRowIndex) - Number(startRowIndex) + 1;

          /**
           * When the available cells in the source rent roll is < than the range
           * specified in the automation, limit the number of cells to write
           * to the available cell in source rent roll.
           * This would prevent out of range exception on MS Graph API write request
           *
           */
          difference =
            difference < availableSourceRRItems
              ? difference
              : availableSourceRRItems;

          /**
           * When a range of values have been written into the model sheet,
           * Ship that range of values from source RR.
           */
          const nextIterationStartIdx: number =
            updateDataIterationStartIndex + writtenRowsCount;

          const nextIterationLimit: number =
            updateDataIterationStartIndex + writtenRowsCount + difference;

          for (
            let idx = nextIterationStartIdx;
            idx < nextIterationLimit;
            idx++
          ) {
            updateData.push(String(sourceRRSheetValues[idx]));
            msgraphValues.push([String(sourceRRSheetValues[idx])]);
          }
          const updateRange = `${modelColumnName}${startRowIndex}:${modelColumnName}${
            Number(startRowIndex) + difference - 1
          }`;

          writtenRowsCount += difference;

          try {
            await this.microsoftService.replaceColumnData(
              deal?.meta?.model?.microsoft?.id,
              automation.modelSheetName,
              updateRange,
              msgraphValues,
            );
          } catch (error) {
            console.log(error, 'FAILED TO updATE MS GRPAH');
          }

          // await this.replaceDataInRange(
          //   modelURL,
          //   updateRange,
          //   updateData,
          //   automation.modelSheetName,
          // );

          //TODO: Consider specifying the overflow as a selected row or cell.
          if (
            !automation.splits[idx + 1] &&
            automation.includeSummary &&
            automation.splits.length > 1
          ) {
            const summaryRow = getRowIndexFromCellName(
              automation.splits[idx - 1].endCell,
            );
            const summaryRange = `${modelColumnName}${
              Number(summaryRow) + 1
            }:${modelColumnName}${Number(summaryRow) + 1}`;
            await this.replaceDataInRange(
              modelURL,
              summaryRange,
              [`=SUM(${updateRange})`],
              automation.modelSheetName,
            );
          }
        }
        resolve('Done');
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  private async replaceDataInRange(
    modelURL: string,
    updateRange: string,
    updateData: string[],
    SheetName: string,
  ) {
    const updatePayload = {
      ModelURL: modelURL,
      SheetName,
      Ranges: [
        {
          Range: updateRange,
          Values: updateData,
        },
      ],
    };

    const res = await this.axiosInstance.post(
      `${process.env.NOPHIN_SYNCFUSION_BASE_URL}/api/ModelSync/sync-rr`,
      updatePayload,
      {
        responseType: 'arraybuffer',
      },
    );

    const url = await this.awsService.uploadBufferToS3(
      res.data,
      this.awsService.getFileKeyFromURL(modelURL),
    );

    console.log(url, 'REPlACING>>>>>');
  }

  async findPendingDealsToSync() {
    return await this.dealRepo
      .createQueryBuilder('deal')
      .leftJoinAndSelect('deal.documents', 'document')
      .where(
        'document.status=:status AND document.fileType IN (:...fileTypes) AND deal.activeModelSyncId IS NOT NULL AND deal.activeModelSyncId != 0',
        {
          status: DocumentStatusENUM.ANALYSIS_COMPLETED,
          fileTypes: [DocumentTypeENUM.T12, DocumentTypeENUM.RENT_ROLL],
        },
      )
      // .where(
      //   'deal.activeModelSyncId IS NOT NULL AND deal.activeModelSyncId != 0',
      // )
      // .andWhere(
      //   '(document.fileType = :fileTypeT12 AND document.status = :statusCategorized) OR (document.fileType = :fileTypeRentRoll AND document.status = :statusAnalysisCompleted)',
      //   {
      //     fileTypeT12: DocumentTypeENUM.T12,
      //     statusCategorized: DocumentStatusENUM.CATEGORIZATION_VERIFIED,
      //     fileTypeRentRoll: DocumentTypeENUM.RENT_ROLL,
      //     statusAnalysisCompleted: DocumentStatusENUM.ANALYSIS_COMPLETED,
      //   },
      // )
      .getMany();
  }

  async computeDealBenchmarks(dealId: number) {
    const deal = await this.findOne(dealId);
    const dealModel = await this.modelRepo.findOne({
      where: {
        id: deal?.activeModelSyncId,
      },
    });

    if (!dealModel) {
      this.logger.debug(`Could not locate model for deal to compute benchmark`);
    }

    if (!dealModel.modelBenchmark) {
      return this.logger.debug(`No benchmark set for this model`);
    }

    const benchmarks = [];

    for (const benchmark of dealModel.modelBenchmark) {
      const computedBenchmark = await this.getBenchmark(deal, benchmark);
      benchmarks.push(computedBenchmark);
    }

    const dealComparables: DealComparablesI = deal?.comparables || {};
    dealComparables.benchmarks = benchmarks;

    deal.comparables = dealComparables;

    return await this.dealRepo.save(deal);
  }

  evaluateBenchmark(
    min: number | string,
    max: number,
    value: number,
    operator: string,
  ): boolean {
    switch (operator) {
      case BETWEEN: {
        return Number(min) < value && value < max;
      }
      case GREATER_THAN: {
        return value > Number(min);
      }
      case LESS_THAN: {
        return value < Number(min);
      }
      case EQUAL_TO: {
        return value === min;
      }
      default: {
        return false;
      }
    }
  }

  async getBenchmark(
    deal: Deal,
    benchmark: ModelBenchamarkI,
  ): Promise<ComparableBenchmarkI> {
    const workbookId = deal?.meta?.model?.microsoft?.id;
    const dataAtRange = await this.microsoftService.getSheetRangeData(
      workbookId,
      'benchmark?.sheetName',
      '',
      // `${benchmark.cellName}:${benchmark.cellName}`,
    );

    const value = dataAtRange.values[0][0] ?? 0;

    const { value: min, max, format, condition, name } = benchmark;

    const normalizedValue = this.utilitiesService.normalizeWorksheetValue(
      value,
      format,
    );

    const isBenchmarkPassed: boolean = this.evaluateBenchmark(
      min,
      Number(max),
      Number(normalizedValue),
      condition,
    );

    return {
      isBenchmarkPassed,
      benchmarkValue: normalizedValue,
      min,
      max: max ? Number(max) : undefined,
      name,
      condition,
    };
  }
}
