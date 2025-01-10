import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Document } from '../entities/document.entity';
import { In, Not, Repository } from 'typeorm';
import { DocumentDto } from 'src/deal/dto/create-deal.dto';
import { MicrosoftService } from 'src/utilities/services/microsoft.service';
import { UtilitiesService } from 'src/utilities/services/utilities.service';
import { User } from 'src/user/entities/user.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DocumentStatusENUM,
  DocumentTypeENUM,
  NOPHIN_NORMALIZED_COLUMNS,
  RENT_ROLL,
  T12,
} from 'src/utilities/constants';
import { AzureService } from 'src/utilities/services/azure.service';
import {
  PostProcessedDataI,
  RRSummaryI,
} from '../interfaces/document.entitiy.interfaces';
import { WorkbookUtility } from 'src/utilities/services/workbook.utility.service';
import { AWSService } from 'src/utilities/services/aws.service';
import { RRPostProcessingAPIResponseI } from '../interfaces/pipeline.dto';
import { DocIntelligenceExtractionResponseI } from 'src/utilities/interfaces/doc-intelligence.interface';
import { DocumentExtractionService } from './document.extraction.service';
import { DocumentAnalysisService } from './document.analysis.service';
import { NOPHIN_CATEGORIES } from '../misc/nophin.t12.categories';
import { GptService } from 'src/gpt/gpt.service';
import { Model } from 'src/model/entities/model.entity';
import axios from 'axios';
import { EventsGateway } from 'src/events/events.gateway';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { LangchainService } from 'src/gpt/langchain.service';
import { Deal } from 'src/deal/entities/deal.entity';
import * as XLSX from 'xlsx';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { logErrorDecorator } from 'src/utilities/logDecorator.service';
import { NOPHIN_MODEL_HEADER_PROMPT } from 'src/gpt/gpt.prompt';
import * as fs from 'fs';
import { AzureTableService } from 'src/utilities/services/azure.table.service';
import { AzureArrayTableConverter } from 'src/utilities/services/azure.array.table.service';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  constructor(
    @InjectRepository(Document) private documentRepo: Repository<Document>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Model) private modelRepo: Repository<Model>,
    @InjectRepository(Deal) private dealRepo: Repository<Deal>,
    private microsoftService: MicrosoftService,
    private utilitiesService: UtilitiesService,
    private azureService: AzureService,
    private workbookUtilityService: WorkbookUtility,
    private awsService: AWSService,
    private docExtractionService: DocumentExtractionService,
    private docAnalysisService: DocumentAnalysisService,
    private gptService: GptService,
    private events: EventsGateway,
    private langchainService: LangchainService,
    private azureTableService: AzureTableService,
    private azureArrayTableService: AzureArrayTableConverter,
  ) {}
  async create(createDocumentDto: CreateDocumentDto) {
    return await this.documentRepo.save(createDocumentDto);
  }

  async findAll(userId: string) {
    return await this.documentRepo.find({
      where: {
        userId,
      },
    });
  }

  async findDealDocumentByType(
    dealId: number,
    fileType = DocumentTypeENUM.RENT_ROLL,
  ): Promise<Document[]> {
    return await this.documentRepo.find({
      where: {
        dealId,
        fileType,
      },
    });
  }

  async findAllDocumentByConversation(
    conversationId: string,
    fileType?: string,
  ) {
    const whereClause: any = { conversationId };

    if (fileType) {
      whereClause.fileType = fileType;
    }

    return await this.documentRepo.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
    });
  }

  async test(id: number) {
    return await this.documentRepo.find({
      where: {
        id,
      },
    });
  }

  async findOne(id: number): Promise<Document> {
    return await this.documentRepo.findOne({
      where: {
        id,
      },
    });
  }

  async findAllDocumentByConversationID(conversationId: string) {
    return this.documentRepo.find({
      where: {
        conversationId,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllOrganizationDocument(userId: string) {
    console.log(userId, 'user id');
    const user = await this.userRepo?.findOne({
      where: {
        id: userId,
      },
    });

    return await this.documentRepo
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.deal', 'deal')
      .where('deal.organizationId = :organizationId', {
        organizationId: user?.organizationId,
      })
      .orderBy('document.createdAt', 'DESC')
      .getMany();
  }

  async findDocumentsByStatusAndType(
    status: string,
    fileTypes: string[],
  ): Promise<Document[]> {
    return await this.documentRepo.find({
      where: {
        status,
        fileType: In(fileTypes),
      },
    });
  }

  async createMultipleDocuments(
    documents: DocumentDto[],
    userId: string,
    dealId: number,
    conversationId: string,
  ) {
    for (const document of documents) {
      const uploadResponse = await this.microsoftService.uploadFromS3ToMSGraph(
        document?.url,
        this.utilitiesService.extractFilenameFromURL(document?.url ?? ''),
      );
      const createdDocument = await this.create({
        dealId,
        documentName: document.name,
        inputFileURL: document.url,
        fileType: document.type,
        userId,
        status: this.determineNewDocumentStatusByFileType(document.type),
        conversationId,
        meta: {
          microsoft: this.microsoftService.extractWorkbookMeta(
            uploadResponse?.uploadResponse,
          ),
        },
      });

      if (
        document &&
        String(document?.url).endsWith('.pdf') &&
        document.type !== 'rent-roll' &&
        document.type !== 'trailing-12'
      ) {
        await this.convertDocumentToBlob(createdDocument);
      }
    }
  }

  determineNewDocumentStatusByFileType(documentType: string): string {
    return documentType === DocumentTypeENUM.RENT_ROLL ||
      documentType === DocumentTypeENUM.T12
      ? 'uploaded'
      : 'pending';
  }

  // async convertDocumentToBlob(document: Document) {
  //   console.log('Converting document to blobbbb');
  //   const response = await fetch(document.inputFileURL, { cache: 'no-store' });
  //   if (!response.ok) {
  //     throw new Error(`Failed to fetch PDF file from ${document.inputFileURL}`);
  //   }
  //   const pdfBlob = await response.blob();

  //   const loader = new PDFLoader(pdfBlob);
  //   const pdfDocs = await loader.load();

  //   // Split the PDF document
  //   const splitter = new RecursiveCharacterTextSplitter({
  //     chunkSize: 5000,
  //     chunkOverlap: 500,
  //   });

  //   const docs = await splitter.splitDocuments(pdfDocs);

  //   // console.log('splitted document hereee');
  //   // const stringifyObj = JSON.stringify(docs);

  //   if (!document.meta) {
  //     document.meta = {};
  //   }

  //   document.meta.vectorDocument = docs;
  //   await this.documentRepo.save(document);

  //   console.log('Finished converting document to blobbbb');
  // }

  async convertDocumentToBlob(document: Document) {
    if (!String(document.inputFileURL).endsWith('.pdf')) {
      return;
    }
    console.log('Converting document to blobbbb');
    const response = await fetch(document.inputFileURL, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF file from ${document.inputFileURL}`);
    }
    const pdfBlob = await response.blob();

    const loader = new PDFLoader(pdfBlob);
    const pdfDocs = await loader.load();

    console.log(pdfDocs, 'pdfDocs');

    // Split the PDF document
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 5000,
      chunkOverlap: 500,
    });

    const docs = await splitter.splitDocuments(pdfDocs);

    console.log(docs, 'docs');

    if (!document.meta) {
      document.meta = {};
    }

    // Sanitize the docs to remove any problematic Unicode characters
    const sanitizedDocs = docs.map((doc) => ({
      ...doc,
      pageContent: this.sanitizeUnicode(doc.pageContent),
      metadata: JSON.parse(JSON.stringify(doc.metadata)),
    }));

    console.log(sanitizedDocs, 'sanitizedDocs');

    document.meta.vectorDocument = sanitizedDocs;
    const updatedDoc = await this.documentRepo.save(document);
    console.log(updatedDoc, 'updatedDoc');
    console.log('Finished converting document to blobbbb');
  }

  // Add this method to your DocumentService class
  private sanitizeUnicode(text: string): string {
    // Remove any non-printable characters except for common whitespace
    return text.replace(/[^\x20-\x7E\t\n\r]/g, '');
  }

  async uploadAndAddDocument(document: any, userId: string) {
    console.log('Started uploaded document');
    // Upload file to MS Graph and AWS

    // Create the document and update its metadata
    const createdDocument = await this.create({
      dealId: document?.dealId,
      documentName: document.name,
      inputFileURL: document.url,
      fileType: document.type,
      status: this.determineNewDocumentStatusByFileType(document.type),
      userId,
    });

    this.attachMetaToDocument(createdDocument);

    if (
      createdDocument &&
      String(createdDocument?.inputFileURL).endsWith('.pdf') &&
      createdDocument.fileType !== 'rent-roll' &&
      createdDocument.fileType !== 'trailing-12'
    ) {
      await this.convertDocumentToBlob(createdDocument);
    }

    return createdDocument;
  }

  async attachMetaToDocument(document: Document) {
    const uploadResponse = await this.microsoftService.uploadFromS3ToMSGraph(
      document?.inputFileURL,
      this.utilitiesService.extractFilenameFromURL(
        document?.inputFileURL ?? '',
      ),
    );

    const metadata = this.microsoftService.extractWorkbookMeta(
      uploadResponse?.uploadResponse,
    );

    await this.documentRepo.update(document?.id, {
      meta: {
        ...(document?.meta || {}),
        microsoft: metadata,
      },
    });

    await this.documentRepo.findOne({
      where: {
        id: document.id,
      },
    });
  }

  async getWorkbookComputedData(msGraphId: string) {
    return await this.microsoftService.getWorkbookComputedData(msGraphId);
  }

  async trimExcelSheet(url: string) {
    const fileRes = await axios.get(url, {
      responseType: 'arraybuffer',
    });

    const data = new Uint8Array(fileRes.data);

    const workbook = XLSX.read(data, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const hasFewerThan5Cells = (row) => {
      console.log(`The ARRAY IS ${row}`);
      fs.appendFileSync('trimmed.txt', '\n');
      fs.appendFileSync('trimmed.txt', JSON.stringify(row));
      return row.filter((cell) => cell !== undefined && cell !== '').length < 5;
    };

    while (jsonSheet.length && hasFewerThan5Cells(jsonSheet[0])) {
      jsonSheet.shift();
    }
    if (
      !Array.isArray(jsonSheet) ||
      !jsonSheet.every((row) => Array.isArray(row))
    ) {
      throw new Error('jsonSheet is not in the correct format.');
    }

    // Cast jsonSheet to any[][] to satisfy TypeScript's type requirements
    const formattedJsonSheet = jsonSheet as any[][];

    const newWorksheet = XLSX.utils.aoa_to_sheet(jsonSheet as any);

    workbook.Sheets[sheetName] = newWorksheet;

    const newExcelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer',
    });

    return newExcelBuffer;
  }

  async extractPDFDocument(
    url: string,
  ): Promise<DocIntelligenceExtractionResponseI> {
    return this.azureService.extractTableFromPDF(url);
  }

  extractHeaders(table) {
    return table.cells
      .filter((cell) => cell.rowIndex === 0)
      .map((cell) => cell.content.trim());
  }

  areTablesSimilar(table1, table2) {
    if (table1.columnCount !== table2.columnCount) return false;

    const headers1 = this.extractHeaders(table1);
    const headers2 = this.extractHeaders(table2);

    return JSON.stringify(headers1) === JSON.stringify(headers2);
  }

  createTableJson(table) {
    const headers = this.extractHeaders(table);
    const rows = this.extractRows(table);
    return { headers, rows };
  }

  extractRows(table) {
    const rows = [];
    const rowCount = table.rowCount;

    for (let i = 1; i < rowCount; i++) {
      const row = table.cells
        .filter((cell) => cell.rowIndex === i)
        .map((cell) => cell.content.trim());
      rows.push(row);
    }
    return rows;
  }

  mergeTableContent(mergedTable, newTable) {
    const newRows = this.extractRows(newTable);
    mergedTable.rows.push(...newRows);
  }

  mergeSimilarTables(tablesByPage: unknown) {
    const mergedTables = [];

    Object.values(tablesByPage).forEach((tables) => {
      tables.forEach((table) => {
        let merged = false;

        for (const mergedTable of mergedTables) {
          if (this.areTablesSimilar(mergedTable, table)) {
            this.mergeTableContent(mergedTable, table);
            mergedTable.cells.push(...table.cells);
            merged = true;
            break;
          }
        }

        if (!merged) {
          // mergedTables.push(table);
          mergedTables.push(this.createTableJson(table));
        }
      });
    });

    return mergedTables;
  }

  async processPDF(extractedData) {
    const tablesByPage = {};

    // Group tables by pages
    extractedData.tables.forEach((table) => {
      if (!tablesByPage[table.pageNumber]) {
        tablesByPage[table.pageNumber] = [];
      }
      tablesByPage[table.pageNumber].push(table);
    });

    console.log(`Extracting Table>>>>>>>>>`);
    const mergedTablesJson = this.mergeSimilarTables(tablesByPage);
    console.log(mergedTablesJson);
    fs.writeFileSync('merged-tables.json', JSON.stringify(mergedTablesJson));
    console.log(`Extracting Table>>>>>>>>>`);
  }

  async extractDocument(document: Document) {
    const url = document.inputFileURL;
    let extractedData: DocIntelligenceExtractionResponseI = null;

    if (url.includes('.pdf')) {
      extractedData = await this.extractPDFDocument(url);
      const tablesAsArrays = extractedData.tables.map((table) => {
        // Assuming each table has a 'rows' property that contains the data
        return table.rows.map((row) => {
          // Convert each row to an array of its values
          return Object.values(row);
        });
      });

      fs.writeFileSync(`rawtables-array.json`, JSON.stringify(tablesAsArrays));
      const csv = await this.azureService.combineDocIntelligenceTable(
        extractedData.tables,
      );

      fs.writeFileSync('new.csv', csv);

      fs.writeFileSync('tables.json', JSON.stringify(extractedData.tables));

      // this.processPDF(extractedData);

      const combinedTables = this.azureTableService.combineSimilarTables(
        extractedData.tables,
      );

      fs.writeFileSync('merged-tables.json', JSON.stringify(combinedTables));
      const buffer =
        (await this.workbookUtilityService.generateExcelWorkbookBufferFromCSV(
          csv,
        )) as Buffer;
      const fileName = `extracted-data${Math.floor(
        Math.random() * 9999999900,
      )}.xlsx`;
      const fileURL = await this.awsService.uploadBufferToS3(
        buffer,
        `/v2-uploads/${fileName}`,
      );
      document.extractedFileURL = fileURL;
    } else {
      const buffer = await this.trimExcelSheet(url);
      const fileKey = this.awsService.getFileKeyFromURL(url);

      const fileURL = await this.awsService.uploadBufferToS3(
        buffer,
        `${fileKey}-extracted.xlsx`,
      );
      document.extractedFileURL = fileURL;
    }

    await this.documentRepo.update(document.id, document);
    return extractedData;
  }

  async postProcessRR(url: string): Promise<RRPostProcessingAPIResponseI> {
    const URL = `${process.env.T12_POST_PROCESSING_PIPELINE_URL}?input_file=${url}`;
    try {
      const res = await axios.get<RRPostProcessingAPIResponseI>(URL, {
        headers: {
          Accept: 'application/json',
        },
      });
      return this.utilitiesService.sanitizePipelineResponse(
        res.data,
      ) as RRPostProcessingAPIResponseI;
    } catch (e) {
      this.logger.log(e, 'ERROR POST PROCESSING');
    }
  }

  async postProcessOperatingStatement(url: string) {
    const URL = `${process.env.T12_POST_PROCESSING_PIPELINE_URL}?input_file=${url}`;
    try {
      const res = await axios.get<RRPostProcessingAPIResponseI>(URL, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (typeof res?.data?.data === 'string') {
        try {
          return this.utilitiesService.sanitizePipelineResponse(
            res?.data,
          ) as any; //Todo: Type properly
        } catch (error) {
          this.logger.debug('COULD NOT PARSE JSON');
        }
      }
      return res?.data?.data;
    } catch (e) {
      this.logger.log(e, 'ERROR POST PROCESSING');
    }
  }

  async postProcessData(document: Document): Promise<PostProcessedDataI> {
    this.logger.log(`Post processing ${document?.id}`);
    console.log(document.fileType, 'FILE TYPEEEEE');
    let postProcessedData = null;
    if (document.fileType === RENT_ROLL) {
      postProcessedData = (await this.postProcessRR(document.extractedFileURL))
        ?.data;
    } else if (document.fileType === T12) {
      postProcessedData = (
        await this.postProcessOperatingStatement(document.extractedFileURL)
      )?.data;
    }
    document.postProcessedData = postProcessedData;
    document.status = DocumentStatusENUM.POST_PROCESSED;
    await this.documentRepo.update(document?.id, document);
    // this.events.sendEventToClients(
    //   `postProcessingCompleted:${document?.dealId}`,
    //   {
    //     message: `Post processing completed for ${document.fileType}`,
    //     documentId: document?.id,
    //     documentType: document?.fileType,
    //   },
    // );
    return postProcessedData;
  }

  @logErrorDecorator()
  async constructPostProcessedWorkbook(data: any[][]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        const excelBuffer = XLSX.write(workbook, {
          bookType: 'xlsx',
          type: 'buffer',
        });
        resolve(Buffer.from(excelBuffer));
      } catch (error) {
        reject(error);
      }
    });
  }

  @logErrorDecorator()
  async analyzeRentRoll(dc: Document) {
    this.logger.debug(`Analyzing Document #${dc.id}`);
    const document = await this.findOne(dc.id);
    const { directMapping, mapping } = this.docExtractionService.createMapping(
      document.postProcessedData?.data[0],
    );

    // const fileKey = this.awsService.getFileKeyFromURL(dc.inputFileURL);
    const fileKey = dc.inputFileURL.split('.amazonaws.com/')[1];

    await this.awsService.copyFileToBucket(
      process.env.EXTRACTION_S3_BUCKET,
      process.env.AWS_PRODUCTION_BUCKET,
      fileKey,
      `pipeline-rr/${fileKey}`,
    );

    if (!document.meta) {
      document.meta = {};
    }

    let indexHeaderMapping: { header: string; index: string }[];

    try {
      const nophinHeaders = await axios.post(
        process.env.NOPHIN_HEADER_MODEL_URL,
        {
          pdf_path: `pipeline-rr/${fileKey}`,
          prompt: NOPHIN_MODEL_HEADER_PROMPT,
        },
      );

      let responseString = Array.isArray(nophinHeaders.data)
        ? String(nophinHeaders.data[0])
        : String(nophinHeaders.data);

      if (responseString[responseString.length - 1] === `'`) {
        responseString = responseString.slice(0, responseString.length - 1);
      }

      document.meta.nophinMapping = JSON.parse(responseString);

      indexHeaderMapping =
        await this.docExtractionService.createNophinModelMapping(
          document.postProcessedData?.data,
          document.meta.nophinMapping,
        );

      document.meta.indexHeaderMapping = indexHeaderMapping;
    } catch (error) {
      console.log(error, 'ERRRRORRRRRR');
    }

    const nophinMapping = document.meta.nophinMapping;

    if (
      !Array.isArray(indexHeaderMapping) ||
      !nophinMapping ||
      typeof nophinMapping !== 'object'
    ) {
      this.logger.log(`Failed to analyze Rent Roll with ID ${document.id}`);
      document.status = DocumentStatusENUM.FAILED;
      await this.updateSingleDocument(document.id, document);
      return;
    }

    // Document analysis should fail when no rent and floorplan is available

    if (!nophinMapping['C'] && !nophinMapping['J'] && !nophinMapping['K']) {
      this.logger.log(
        `Failed to extract floorplan and rent data from ${document.id}`,
      );
      document.status = DocumentStatusENUM.FAILED;
      await this.updateSingleDocument(document.id, document);
      return;
    }

    const floorplanHeaderKey = nophinMapping['K'] ? 'K' : 'J';

    this.logger.fatal(indexHeaderMapping);

    console.log(indexHeaderMapping, 'indexHeaderMapping >>>>>>');

    const floorplanIndex = indexHeaderMapping.find((item) => {
      return (
        item.header.toLowerCase() ===
        String(nophinMapping[floorplanHeaderKey]).toLowerCase()
      );
    })?.index;

    const marketRentIndex = indexHeaderMapping.find((item) => {
      return (
        item.header.toLowerCase().replace('+', '') ===
        String(nophinMapping['B']).toLowerCase().replace('+', '')
      );
    })?.index;

    const unitSizeIndex = indexHeaderMapping.find((item) => {
      return (
        item.header.toLowerCase() === String(nophinMapping['G']).toLowerCase()
      );
    })?.index;

    const rentIndex = indexHeaderMapping.find((item) => {
      return (
        item.header.toLowerCase() === String(nophinMapping['C']).toLowerCase()
      );
    })?.index;

    const leaseStartIndex = indexHeaderMapping.find((item) => {
      return (
        item.header.toLowerCase() === String(nophinMapping['H']).toLowerCase()
      );
    })?.index;

    const bathsIndex = indexHeaderMapping.find((item) => {
      return (
        item.header.toLowerCase() === String(nophinMapping['E']).toLowerCase()
      );
    })?.index;

    const bedsIndex = indexHeaderMapping.find((item) => {
      return (
        item.header.toLowerCase() === String(nophinMapping['F']).toLowerCase()
      );
    })?.index;

    document.meta.mapping = mapping;
    document.meta.directMapping = directMapping;

    // const floorplanIndex = directMapping[NOPHIN_NORMALIZED_COLUMNS.N_UNIT_TYPE];
    // const marketRentIndex =
    //   directMapping[NOPHIN_NORMALIZED_COLUMNS.N_MARKET_RENT];
    // const unitSizeIndex = directMapping[NOPHIN_NORMALIZED_COLUMNS.N_UNIT_SQFT];
    // const rentIndex = directMapping[NOPHIN_NORMALIZED_COLUMNS.N_RENT];
    // const leaseStartIndex =
    //   directMapping[NOPHIN_NORMALIZED_COLUMNS.N_LEASE_START];
    const moveInIndex = directMapping[NOPHIN_NORMALIZED_COLUMNS.N_MOVE_IN];

    // const bedsIndex = directMapping[NOPHIN_NORMALIZED_COLUMNS.N_BED];
    // const bathsIndex = directMapping[NOPHIN_NORMALIZED_COLUMNS.N_BATH];

    const uniqueFloorplans = this.docExtractionService.extractUniqueFloorplans(
      document.postProcessedData.data,
      parseInt(floorplanIndex),
    );

    const summary: RRSummaryI = {
      floorplans: {},
      totals: {},
    };

    for (const floorplan of uniqueFloorplans) {
      if (String(floorplan).toLowerCase() === 'floorplan') continue;
      summary.floorplans[floorplan] =
        await this.docAnalysisService.generateFloorplanSummary(
          document.postProcessedData.data,
          floorplan,
          parseInt(rentIndex),
          parseInt(floorplanIndex),
          parseInt(marketRentIndex),
          parseInt(unitSizeIndex),
          parseInt(leaseStartIndex) ?? -1,
          parseInt(bedsIndex),
          parseInt(bathsIndex),
          0,
        );
    }

    let totalUnitCount = 0;
    let totalSqft = 0;
    let totalMarketRent = 0;
    let totalVacancy = 0;
    let totalRent = 0;

    for (const entry of Object.values(summary.floorplans ?? {})) {
      totalUnitCount += entry.count;
      totalSqft += entry.sqftSum;
      totalMarketRent += entry.marketRentSum;
      totalVacancy += entry.vacantUnits;
      totalRent += entry.rentSum;
    }

    summary.totals.totalUnitCount = totalUnitCount;
    summary.totals.totalSqft = totalSqft;
    summary.totals.totalMarketRent = totalMarketRent;
    summary.totals.totalVacancy = totalVacancy;
    summary.totals.totalRent = totalRent;

    document.status = DocumentStatusENUM.ANALYSIS_COMPLETED;
    document.summary = summary;

    await this.documentRepo.update(document?.id, document);

    // const splitter = new RecursiveCharacterTextSplitter({
    //   chunkSize: 5000,
    //   chunkOverlap: 500,
    // });

    // const vectorStore =
    //   (await this.langchainService.loadFaissStore(String(document?.dealId))) ??
    //   null;

    // const docs = await splitter.splitDocuments(document.summary);
    // if (vectorStore) {
    //   await vectorStore.addDocuments(docs);
    // } else {
    //   await this.langchainService.saveFaissStore(
    //     String(document.dealId),
    //     await FaissStore.fromDocuments(
    //       docs,
    //       new OpenAIEmbeddings({
    //         apiKey: process.env.OPENAI_API_KEY,
    //       }),
    //     ),
    //   );
    // }
  }

  @logErrorDecorator()
  async analyzeExcelRentRoll(dc: Document) {
    this.logger.debug(`Analyzing Document #${dc.id}`);
    const document = await this.findOne(dc.id);
    const { directMapping, mapping } = this.docExtractionService.createMapping(
      document.postProcessedData?.data[0],
    );

    const normalizedHeaders =
      await this.docExtractionService.generateRRHeaderMappingWithLLM(
        document.postProcessedData?.data,
      );

    const guessedHeadersMapping =
      await this.docExtractionService.guessRRHeaders(
        JSON.stringify(normalizedHeaders),
      );

    console.log(normalizedHeaders, 'Hereeeee');

    console.log(guessedHeadersMapping, 'GUESSED HEADERS');

    const drMapping =
      this.docExtractionService.createDirectMappingFromGuessedHeaderArray(
        guessedHeadersMapping,
      );

    console.log(drMapping, 'DR MAPPPINGGGG');
    if (!document.meta) {
      document.meta = {};
    }

    document.meta.mapping = guessedHeadersMapping;
    // document.meta.normalizedHeaders = normalizedHeaders;

    // document.meta.mapping = mapping;
    document.meta.directMapping = directMapping;

    const floorplanIndex = drMapping[NOPHIN_NORMALIZED_COLUMNS.N_UNIT_TYPE];
    const marketRentIndex = drMapping[NOPHIN_NORMALIZED_COLUMNS.N_MARKET_RENT];
    const unitSizeIndex = drMapping[NOPHIN_NORMALIZED_COLUMNS.N_UNIT_SQFT];
    const rentIndex = drMapping[NOPHIN_NORMALIZED_COLUMNS.N_RENT];
    const leaseStartIndex = drMapping[NOPHIN_NORMALIZED_COLUMNS.N_LEASE_START];
    const moveInIndex = drMapping[NOPHIN_NORMALIZED_COLUMNS.N_MOVE_IN];

    const bedsIndex = drMapping[NOPHIN_NORMALIZED_COLUMNS.N_BED];
    const bathsIndex = drMapping[NOPHIN_NORMALIZED_COLUMNS.N_BATH];
    const statusIndex = drMapping[NOPHIN_NORMALIZED_COLUMNS.N_UNIT_STATUS];

    console.log(statusIndex, 'status index >>>>>>>>>>>>');

    const uniqueFloorplans = this.docExtractionService.extractUniqueFloorplans(
      document.postProcessedData.data,
      floorplanIndex,
    );

    const summary: RRSummaryI = {
      floorplans: {},
      totals: {},
    };

    for (const floorplan of uniqueFloorplans) {
      if (String(floorplan).toLowerCase() === 'floorplan') continue;
      summary.floorplans[floorplan] =
        await this.docAnalysisService.generateFloorplanSummary(
          document.postProcessedData.data,
          floorplan,
          rentIndex,
          floorplanIndex,
          marketRentIndex,
          unitSizeIndex,
          leaseStartIndex ?? moveInIndex ?? -1,
          bedsIndex,
          bathsIndex,
          statusIndex,
        );
    }

    let totalUnitCount = 0;
    let totalSqft = 0;
    let totalMarketRent = 0;
    let totalVacancy = 0;
    let totalRent = 0;

    for (const entry of Object.values(summary.floorplans ?? {})) {
      totalUnitCount += entry.count;
      totalSqft += entry.sqftSum;
      totalMarketRent += entry.marketRentSum;
      totalVacancy += entry.vacantUnits;
      totalRent += entry.rentSum;
    }

    summary.totals.totalUnitCount = totalUnitCount;
    summary.totals.totalSqft = totalSqft;
    summary.totals.totalMarketRent = totalMarketRent;
    summary.totals.totalVacancy = totalVacancy;
    summary.totals.totalRent = totalRent;

    document.status = DocumentStatusENUM.ANALYSIS_COMPLETED;
    document.summary = summary;

    await this.documentRepo.update(document?.id, document);

    // const splitter = new RecursiveCharacterTextSplitter({
    //   chunkSize: 5000,
    //   chunkOverlap: 500,
    // });

    // const vectorStore =
    //   (await this.langchainService.loadFaissStore(String(document?.dealId))) ??
    //   null;

    // const docs = await splitter.splitDocuments(document.summary);
    // if (vectorStore) {
    //   await vectorStore.addDocuments(docs);
    // } else {
    //   await this.langchainService.saveFaissStore(
    //     String(document.dealId),
    //     await FaissStore.fromDocuments(
    //       docs,
    //       new OpenAIEmbeddings({
    //         apiKey: process.env.OPENAI_API_KEY,
    //       }),
    //     ),
    //   );
    // }
  }

  async analyzeOperatingStatement(document: Document) {
    const deal = await this.dealRepo.findOne({
      where: {
        id: document?.dealId,
      },
    });

    const model = await this.modelRepo.findOne({
      where: {
        id: deal?.activeModelSyncId,
      },
    });

    const { categorization, lineItemLastIndex, lineItemTrueIndex } =
      document.categorization;
    const summary = await this.docAnalysisService.generateT12Summary(
      categorization,
      lineItemTrueIndex,
      lineItemLastIndex,
      model,
    );

    summary.intervals = this.docAnalysisService.calculateOpExSummary(summary);

    // if (model?.modelMapping?.length) {
    //   const subcategories = summary.intervals.subcategories;

    //   for (const mapping of model.modelMapping) {
    //     const nophinSubcategory =
    //       subcategories[String(mapping.nophinCategory).toLocaleLowerCase()];
    //     let userSubcategory =
    //       subcategories[String(mapping.category).toLocaleLowerCase()];

    //     if (!nophinSubcategory) {
    //       console.log(`Nophin subcategory not found for ${nophinSubcategory}`);
    //       continue;
    //     }

    //     console.log(nophinSubcategory.t12, 'THE T12');

    //     if (userSubcategory) {
    //       userSubcategory.t3 = userSubcategory.t3 + nophinSubcategory.t3;
    //       userSubcategory.t6 = userSubcategory.t6 + nophinSubcategory.t6;
    //       userSubcategory.t9 = userSubcategory.t9 + nophinSubcategory.t9;
    //       userSubcategory.t12 = userSubcategory.t12 + nophinSubcategory.t12;
    //       userSubcategory.annualizedLastMonth =
    //         userSubcategory.annualizedLastMonth +
    //         nophinSubcategory.annualizedLastMonth;
    //     } else {
    //       userSubcategory = nophinSubcategory;
    //     }

    //     subcategories[mapping.nophinCategory.toLowerCase()] = undefined;
    //     subcategories[mapping.category.toLowerCase()] = userSubcategory;
    //     summary.subcategoriesSum[mapping.nophinCategory.toLowerCase()] =
    //       undefined;
    //     summary.subcategoriesSum[mapping.category.toLowerCase()] =
    //       userSubcategory.t12;
    //   }
    //   summary.intervals.subcategories = subcategories;
    // }

    document.status = DocumentStatusENUM.ANALYSIS_COMPLETED;
    document.summary = summary;
    await this.documentRepo.update(document.id, document);

    // const splitter = new RecursiveCharacterTextSplitter({
    //   chunkSize: 5000,
    //   chunkOverlap: 500,
    // });

    // const vectorStore = await this.langchainService.loadFaissStore(
    //   String(document?.dealId),
    // );

    // const docs = await splitter.splitDocuments(document.summary);
    // if (vectorStore) {
    //   await vectorStore.addDocuments(docs);
    // } else {
    //   await this.langchainService.saveFaissStore(
    //     String(document.dealId),
    //     await FaissStore.fromDocuments(
    //       docs,
    //       new OpenAIEmbeddings({
    //         apiKey: process.env.OPENAI_API_KEY,
    //       }),
    //     ),
    //   );
    // }
  }

  async categorizeOperatingStatement(document: Document) {
    const data = document.postProcessedData?.data;

    //Todo: Check for data not undefined and has content

    const t12StartRow = this.utilitiesService.getDocumentStartRow(data ?? []);

    let filteredData = data?.slice(t12StartRow, data.length);

    const knownCategories: any[] = [],
      unknownCategories: any[] = [];

    const lineItemTrueIndex =
      this.utilitiesService.getT12LineItemsTrueIndex(filteredData);

    const lineItemLastIndex = this.utilitiesService.getT12LineItemsLastIndex(
      filteredData,
      lineItemTrueIndex,
    );

    const potentialAggregations = await this.getPotentialT12Aggregations(
      filteredData,
      lineItemTrueIndex,
      lineItemLastIndex,
    );

    const updatedSortedTable = [];

    for (const item of filteredData) {
      if (
        potentialAggregations.includes(
          String(item[lineItemTrueIndex]).toLowerCase().trim(),
        ) ||
        String(item[lineItemTrueIndex]).toLowerCase().trim() ===
          'net rental income'
      )
        continue;

      updatedSortedTable.push(item);
    }

    filteredData = [...updatedSortedTable];

    for (const item of filteredData) {
      const sanitizedLineItem = String(
        this.utilitiesService.stripPreceedingNumber(item[lineItemTrueIndex]),
      ).trim();

      const foundInNophinCategories: {
        lineItem: string;
        category: string;
        subcategory: string;
      } = NOPHIN_CATEGORIES[sanitizedLineItem];

      if (foundInNophinCategories) {
        knownCategories.push({
          lineItem: sanitizedLineItem,
          category: foundInNophinCategories.category,
          subcategory: foundInNophinCategories.subcategory,
          rawData: item.slice(lineItemTrueIndex, item.length),
        });
      } else {
        unknownCategories.push(item);
      }
    }
    const categorizedUnknown = await this.gptService.categorizeUnknownWithGPT(
      unknownCategories,
      lineItemTrueIndex,
    );

    const mergedData = [...knownCategories, ...categorizedUnknown];

    document.categorization = {
      lineItemLastIndex,
      lineItemTrueIndex,
      categorization: mergedData,
    };

    document.status = DocumentStatusENUM.CATEGORIZATION_COMPLETED;
    await this.documentRepo.update(document.id, document);
  }

  async calculateLineItemSum(
    items: Array<string> = [],
    lineItemTrueIndex: number,
    lineItemLastIndex: number,
  ): Promise<{
    sum: number;
    currentT3Sum: number;
    currentT6Sum: number;
    currentT9Sum: number;
    annualizedLastMonth: number;
  }> {
    let sum = 0;
    let termIterator = 1;
    let currentT3Sum = 0,
      currentT6Sum = 0,
      currentT9Sum = 0,
      annualizedLastMonth = 0;

    for (
      let index = lineItemTrueIndex + 1;
      index < lineItemLastIndex + lineItemTrueIndex - 1;
      index++
    ) {
      const item = String(items[index]);
      if (item.includes('/')) {
        termIterator++;
        continue;
      } //Assume it's a date
      const sanitizedValue = parseFloat(
        this.utilitiesService.sanitizeMoneyString(item),
      );
      if (isNaN(sanitizedValue)) {
        termIterator++;
        continue;
      }

      if (termIterator > 9) {
        currentT3Sum += sanitizedValue;
      }

      if (termIterator > 6) {
        currentT6Sum += sanitizedValue;
      }

      if (termIterator > 3) {
        currentT9Sum += sanitizedValue;
      }

      if (termIterator === 12) {
        annualizedLastMonth = sanitizedValue * 12;
      }
      sum += isNaN(sanitizedValue) ? 0 : sanitizedValue;
      termIterator++;
    }

    return {
      sum,
      currentT3Sum,
      currentT6Sum,
      currentT9Sum,
      annualizedLastMonth,
    };
  }

  private async getPotentialT12Aggregations(
    sortedTable: any[][],
    lineItemTrueIndex: number,
    lineItemLastIndex: number,
  ) {
    const computedSummary = [];
    const potentialAggregations = [];
    const potentialIdx = [];
    for (let idx = 0; idx < sortedTable.length; idx++) {
      const { sum } = await this.calculateLineItemSum(
        sortedTable[idx],
        lineItemTrueIndex,
        lineItemLastIndex,
      );

      let accumulator = 0;

      const sanitizedMoney = Number(
        this.utilitiesService.sanitizeMoneyString(
          sortedTable[idx][lineItemLastIndex],
        ),
      );

      if (idx > 0) {
        for (let innerIdx = idx - 1; innerIdx >= 0; innerIdx--) {
          if (potentialIdx.includes(innerIdx)) continue;
          accumulator += Number(
            Number(
              this.utilitiesService.sanitizeMoneyString(
                sortedTable[innerIdx][lineItemLastIndex],
              ),
            ).toFixed(2),
          );

          if (
            Number(accumulator).toFixed(2) === Number(String(sum)).toFixed(2)
          ) {
            potentialAggregations.push(
              String(sortedTable[idx][lineItemTrueIndex]).toLowerCase().trim(),
            );
            potentialIdx.push(idx);
            break;
          } else {
            computedSummary.push(sanitizedMoney);
          }
        }
      }
    }

    return potentialAggregations;
  }

  async analyzeDocument(document: Document) {
    if (document.fileType === DocumentTypeENUM.RENT_ROLL) {
      if (document.inputFileURL.endsWith('.pdf')) {
        return this.analyzeRentRoll(document).then(() => {});
      } else {
        return this.analyzeExcelRentRoll(document).then(() => {});
      }
    } else if (document.fileType === DocumentTypeENUM.T12) {
      return this.analyzeOperatingStatement(document).then(() => {
        // this.events.sendEventToClients(
        //   `analysisCompleted:${document?.dealId}`,
        //   {
        //     message: `Analysis completed for ${document.fileType}`,
        //     documentId: document?.id,
        //     documentType: document?.fileType,
        //   },
        // );
      });
    }
    throw new NotImplementedException('Not implemented');
  }

  async updateSingleDocument(id: number, document: Document) {
    return await this.documentRepo.update(id, document);
  }

  @Cron(CronExpression.EVERY_SECOND)
  @logErrorDecorator()
  async handleExtractionJobs() {
    const documents = await this.documentRepo.find({
      where: {
        status: DocumentStatusENUM.UPLOADED,
      },
    });

    this.logger.debug(`Found ${documents.length} for extraction`);

    for (const document of documents) {
      document.status = DocumentStatusENUM.EXTRACTING;
      await this.documentRepo.update(document.id, document);
      const extractedData = await this.extractDocument(document);
      document.extractionData = extractedData;
      document.status = DocumentStatusENUM.EXTRACTED;
      await this.documentRepo.update(document.id, document);
    }
  }

  @Cron(CronExpression.EVERY_SECOND)
  @logErrorDecorator()
  async handlePostProcessingJobs() {
    const documents = await this.documentRepo.find({
      where: {
        status: DocumentStatusENUM.EXTRACTED,
        // extractionData: Not(null),
      },
    });
    this.logger.debug(
      `Found ${documents.length} documents for post processing`,
    );

    for (const document of documents) {
      const newDoc = await this.documentRepo.findOne({
        where: { id: document?.id },
      });
      newDoc.status = DocumentStatusENUM.POST_PROCESSING;
      await this.documentRepo.update(newDoc.id, newDoc);
      this.postProcessData(document).then(
        async (postProcessData: PostProcessedDataI) => {
          const buffer = await this.constructPostProcessedWorkbook(
            postProcessData?.data,
          );

          const fileKey = this.awsService.getFileKeyFromURL(
            document?.inputFileURL,
          );
          const url = await this.awsService.uploadBufferToS3(
            buffer,
            `${fileKey}-post-processed.xlsx`,
          );

          const updatedDocument = await this.findOne(document.id);

          updatedDocument.postProcessedDataURL = url;

          await this.updateSingleDocument(updatedDocument?.id, updatedDocument);

          this.events.sendEventToClients(
            `postProcessingCompleted:${document?.dealId}`,
            {
              message: `Post processing completed for ${document.fileType}`,
              documentId: document?.id,
              documentType: document?.fileType,
            },
          );
        },
      );
    }
  }

  // @Cron(CronExpression.EVERY_SECOND)
  // async handleConversationToBlob() {
  //   const documents = await this.documentRepo.find({
  //     where: {
  //       status: DocumentStatusENUM.EXTRACTED,
  //       // extractionData: Not(null),
  //     },
  //   });
  //   this.logger.fatal(
  //     `Found ${documents.length} documents for post processing`,
  //   );

  //   for (const document of documents) {
  //     document.status = DocumentStatusENUM.POST_PROCESSING;
  //     await this.documentRepo.update(document.id, document);
  //     this.postProcessData(document).then(() => {
  //       this.events.sendEventToClients(
  //         `postProcessingCompleted:${document?.dealId}`,
  //         {
  //           message: `Post processing completed for ${document.fileType}`,
  //           documentId: document?.id,
  //           documentType: document?.fileType,
  //         },
  //       );
  //     });
  //   }
  // }

  @Cron(CronExpression.EVERY_SECOND)
  @logErrorDecorator()
  async handleAnalysisJobs() {
    const documents = await this.documentRepo
      .createQueryBuilder('document')
      .where(`status = :status1`, {
        status1: DocumentStatusENUM.CATEGORIZATION_COMPLETED,
      })
      .orWhere(`status = :status2 AND "fileType"=:fileType`, {
        status2: DocumentStatusENUM.POST_PROCESSED,
        fileType: DocumentTypeENUM.RENT_ROLL,
      })
      .getMany();

    // const documents = await this.documentRepo.find({
    //   where: {
    //     status: In([DocumentStatusENUM.CATEGORIZATION_VERIFIED]),
    //     // postProcessedData: Not(null),
    //   },
    // });
    this.logger.verbose(`Found ${documents.length} documents for analysis`);

    for (const document of documents) {
      document.status = DocumentStatusENUM.ANALYSING;
      await this.documentRepo.update(document.id, document);
      this.analyzeDocument(document).then(() => {
        console.log('Sending Event >>>>');
        this.events.setMaxListeners(20);
        this.events.sendEventToClients(
          `analysisCompleted:${document?.conversationId}`,
          {
            message: `Analysis completed`,
            eventType: `analysisCompleted:${document?.conversationId}`,
          },
        );
      });
    }
  }

  @Cron(CronExpression.EVERY_SECOND)
  @logErrorDecorator()
  async handleCategorizationJobs() {
    const documents = await this.findDocumentsByStatusAndType(
      DocumentStatusENUM.POST_PROCESSED,
      [DocumentTypeENUM.T12],
    );

    this.logger.verbose(`Found ${documents.length} T12 for categorization`);

    for (const document of documents) {
      document.status = DocumentStatusENUM.ANALYSING;
      await this.updateSingleDocument(document.id, document);
      this.categorizeOperatingStatement(document).then(() => {
        this.events.setMaxListeners(20);
        this.events.sendEventToClients(
          `categorizationCompleted:${document?.dealId}`,
          {
            message: `Categorization completed for ${document.fileType}`,
            documentId: document?.id,
            documentType: document?.fileType,
            eventType: `categorizationCompleted:${document?.dealId}`,
          },
        );
      });
    }
  }
}
