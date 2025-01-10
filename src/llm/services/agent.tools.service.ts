import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentState, ToolNode } from '@langchain/langgraph/prebuilt';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { DealService } from 'src/deal/services/deal.service';
import { PropertyService } from 'src/property/services/property.service';
import { UserService } from 'src/user/services/user.service';
import { DocumentService } from 'src/document/services/document.service';
import { DocumentStatusENUM, DocumentTypeENUM } from 'src/utilities/constants';
import { MailerService } from '@nestjs-modules/mailer';
import * as XLSX from 'xlsx';
import pdf from 'pdf-parse';
import axios from 'axios';
import { OpenAI } from 'openai';
import {
  DEMOGRAPHIC_OVERVIEW,
  JOBMARKET_OVERVIEW,
  LOCAL_ATTRACTIONS,
  NEIGHNORHOOD_OVERVIEW,
  PROPERTY_OVERVIEW,
  SUBMARKET_OVERVIEW,
  TRANSPORTATION,
} from './agent.tools.prompt';
import { MicrosoftService } from 'src/utilities/services/microsoft.service';
import { UtilitiesService } from 'src/utilities/services/utilities.service';
import { ModelService } from 'src/model/services/model.service';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { InjectRepository } from '@nestjs/typeorm';
import { Beachhead } from 'src/conversation/entities/beachhead.entity';
import { Repository } from 'typeorm';
import { ConversationService } from 'src/conversation/conversation.service';
import { S3Client } from '@aws-sdk/client-s3';
import { VectorService } from './vector.service';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ZepService } from './zep.service';
import { PineconeService } from './pinecone.service';
import { LlmService } from './llm.service';
import markdown from 'markdown-it';
import puppeteer from 'puppeteer';
import { Upload } from '@aws-sdk/lib-storage';
import { Conversation } from 'src/conversation/entities/conversation.entity';
import { Chart, registerables } from 'chart.js';
import { createCanvas, loadImage } from 'canvas';
import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import { EventsGateway } from 'src/events/events.gateway';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatAnthropic } from '@langchain/anthropic';
import { Document } from 'src/document/entities/document.entity';

Chart.register(...registerables);
@Injectable()
export class AgentToolService {
  public tools: any;
  public toolNode: any;
  public bhTools: any;
  public bhToolNode: any;
  public model: any;
  public bhModel: any;
  private logger: Logger;

  constructor(
    private dealService: DealService,
    private propertyService: PropertyService,
    private userService: UserService,
    private documentService: DocumentService,
    private mailService: MailerService,
    private microsoftService: MicrosoftService,
    private utilitiesService: UtilitiesService,
    private modelService: ModelService,
    @InjectRepository(Beachhead)
    private beachheadRepo: Repository<Beachhead>,
    private conversationService: ConversationService,
    private vectorService: VectorService,
    private zepService: ZepService,
    private pineconeService: PineconeService,
    private llmService: LlmService,
    private events: EventsGateway,
    @InjectRepository(Conversation)
    private conversationRepo: Repository<Conversation>,
  ) {
    this.logger = new Logger(AgentToolService.name);
    this.bhTools = [
      this.introductionTool(),
      this.sendEmailToUsersBH(),
      new TavilySearchResults({
        apiKey: process.env.TAVILY_API_KEY,
      }),
      this.createFileAttachment(),
    ];

    this.bhToolNode = new ToolNode<AgentState>(this.bhTools);

    this.bhModel = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }).bindTools(this.bhTools);
  }

  getToolsByIntent(intent: string): any[] {
    const commonTools = [
      this.introductionTool(),
      this.createFileAttachment(),
      this.sendEmailToUsersBH(),
    ];

    switch (typeof intent === 'string' && intent.toLowerCase()) {
      case 'deal screening':
        console.log('Intent: Deal screening');
        return [
          ...commonTools,
          this.screenDeal(),
          this.createADeal(),
          this.attachFileToDeal(),
          this.identifyDocumentType(),
          this.analyzeDocument(),
          this.readRentRollData(),
          this.readT12Data(),
          this.getUserOrganizationModel(),
          // this.attachDealToModel(),
          this.writeDataToModel(),
          this.analyzeScreenDealResult(),
          this.getADeal(),
          this.getAllDeals(),
          this.createAModel(),
          this.getModelBenchmarkCells(),
          this.createModelBenchmarks(),
          this.readAcquisitionModel(),
          this.plotGraph(),
          new TavilySearchResults({
            apiKey: process.env.TAVILY_API_KEY,
          }),
        ];
      case 'document analysis':
        console.log('Intent: Document Analysis');
        return [
          ...commonTools,
          this.analyzeDocument(),
          this.identifyDocumentType(),
          this.readRentRollDataForAnalysis(),
          this.readT12DataForAnalysis(),
          this.plotGraph(),
          new TavilySearchResults({
            apiKey: process.env.TAVILY_API_KEY,
          }),
        ];
      case 'generate investment memo':
        console.log('Intent: Generate Investment Memo');
        return [
          ...commonTools,
          this.generateInvestmentMemo(),
          // this.retrieveInvestmentMemo(),
          this.sendInvestmentMemoAsPDF(),
          this.plotGraph(),
          new TavilySearchResults({
            apiKey: process.env.TAVILY_API_KEY,
          }),
        ];
      case 'conduct market research':
        console.log('Intent: Conduct Market Research');
        return [
          ...commonTools,
          this.conductMarketResearch(),
          this.plotGraph(),
          new TavilySearchResults({
            apiKey: process.env.TAVILY_API_KEY,
          }),
        ];
      case 'document summarizer':
        console.log('Intent: Document summarizer');
        return [...commonTools, this.documentSummarizer(), this.plotGraph()];
      default:
        console.log('No Intent Found');
        return commonTools;
    }
  }

  public getTools(intent: string): any {
    return this.getToolsByIntent(intent);
  }

  public getToolNode(intent: string): any {
    return new ToolNode<AgentState>(this.getToolsByIntent(intent));
  }

  public getModel(intent: string): any {
    const tools = this.getToolsByIntent(intent);
    return new ChatOpenAI({
      model: 'gpt-4o-2024-08-06',
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }).bindTools(tools);
  }

  private async generateChunkContext(document: Document, chunk: any) {
    const prompt = `
    Document: ${document.documentName}
    File Type: ${document.fileType}
    
    Chunk Content:
    ${chunk.pageContent}

    Please provide a brief context (2-3 sentences) to situate this chunk within the overall document, focusing on its relevance and connection to the document's main topics.
    `;

    const chatModel = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet-20240620',
      maxTokens: 150,
      temperature: 0.3,
    });

    const response = await chatModel.invoke([
      { role: 'user', content: prompt },
    ]);

    return response.content;
  }

  private async addContextToRelevantChunks(
    documents: Document[],
    relevantChunks: any[],
  ): Promise<any[]> {
    const docMap = new Map(documents.map((doc) => [doc.id, doc]));

    const addContextToChunk = async (chunk: any) => {
      const doc = docMap.get(chunk.metadata.documentId);
      if (!doc) return chunk; // If no matching document, return the original chunk

      const context = await this.generateChunkContext(doc, chunk);
      return {
        ...chunk,
        pageContent: `${context}\n\n${chunk.pageContent}`,
      };
    };

    // Process chunks in parallel using Promise.all
    const contextualChunks = await Promise.all(
      relevantChunks.map(addContextToChunk),
    );

    return contextualChunks;
  }

  private async createVectorStore(documentVectors: any[]): Promise<FaissStore> {
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return await FaissStore.fromDocuments(documentVectors, embeddings);
  }

  private async performContextualRetrieval(
    vectorStore: FaissStore,
    query: string,
  ): Promise<any[]> {
    const retriever = vectorStore.asRetriever(20);
    return await retriever._getRelevantDocuments(query);
  }

  private async generateSummaryFromChunks(
    relevantChunks: any[],
    query: string,
  ): Promise<string> {
    const chatModel = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet-20240620',
      maxTokens: 2000,
      temperature: 0.3,
    });

    const prompt = PromptTemplate.fromTemplate(`
      You are an AI assistant specialized in summarizing documents. Please provide a concise summary based on the following information. Focus on key points, main ideas, and important details. If asked about specific aspects, highlight those in your summary.

      Context:
      {context}

      User Query: {query}

      Instructions: Provide a clear and concise summary. Do not use phrases like "based on the document" or "the context suggests". Simply present the information directly.

      Summary:
    `);

    const chain = RunnableSequence.from([
      {
        context: () =>
          relevantChunks.map((chunk) => chunk.pageContent).join('\n\n'),
        query: () => query,
      },
      prompt,
      chatModel,
      new StringOutputParser(),
    ]);

    return await chain.invoke({});
  }

  documentSummarizer() {
    return tool(
      async ({ conversationId, query }) => {
        try {
          const conversation = await this.conversationService.findOneByIdOrUUID(
            String(conversationId),
          );

          const documents =
            await this.documentService.findAllDocumentByConversation(
              conversation.conversationId,
            );

          if (!documents || documents?.length === 0) {
            return 'Please upload a document before summarizing. Once uploaded, I can provide a summary and answer specific questions about its content.';
          }

          const documentVectors = documents
            ?.filter((doc) => doc.meta.vectorDocument !== undefined)
            .flatMap((doc) => doc.meta.vectorDocument);

          if (!documentVectors || documentVectors.length === 0) {
            return 'Please upload a document before summarizing. Once uploaded, I can provide a summary and answer specific questions about its content.';
          }

          // Create vector store from existing vectors
          const vectorStore = await this.createVectorStore(documentVectors);

          // Perform contextual retrieval
          const relevantChunks = await this.performContextualRetrieval(
            vectorStore,
            query,
          );

          // Add context only to relevant chunks
          const contextualChunks = await this.addContextToRelevantChunks(
            documents,
            relevantChunks,
          );

          // Generate summary using contextual chunks
          const summary = await this.generateSummaryFromChunks(
            contextualChunks,
            query,
          );

          return summary;

          // const documentVectors = documents
          //   ?.filter((doc) => doc.meta.vectorDocument !== undefined)
          //   .flatMap((doc) => doc.meta.vectorDocument);

          // console.log(documentVectors, 'documentVectors');

          // if (!documentVectors || documentVectors.length === 0) {
          //   return 'Please upload a document before summarizing. Once uploaded, I can provide a summary and answer specific questions about its content.';
          // }

          // console.log('Creating Vector Store');

          // const vectorStore = await FaissStore.fromDocuments(
          //   documentVectors,
          //   new OpenAIEmbeddings({
          //     apiKey: process.env.OPENAI_API_KEY,
          //   }),
          // );

          // const retriever = vectorStore.asRetriever();
          // const relevantDocs = await retriever._getRelevantDocuments(query);

          // const chatModel: any = new ChatAnthropic({
          //   apiKey: process.env.ANTHROPIC_API_KEY,
          //   model: 'claude-3-5-sonnet-20240620',
          //   maxTokens: 2000,
          //   temperature: 0.3,
          // });

          // const questionPrompt = PromptTemplate.fromTemplate(
          //   `You are an AI assistant specialized in summarizing documents. Please provide a concise summary of the document based on the following information. Focus on key points, main ideas, and important details. If asked about specific aspects, highlight those in your summary. If you can't find relevant information, politely state that it's not available in the document.
          //   ----------------
          //   DOCUMENT CONTENT: {context}
          //   ----------------
          //   USER QUERY: {question}
          //   ----------------
          //   DOCUMENT METADATA: {documents}
          //   ----------------
          //   INSTRUCTION: Provide a clear and concise summary. Do not use phrases like "based on the document" or "the context suggests". Simply present the information directly.
          //   ----------------
          //   Document Summary:`,
          // );

          // const chain = RunnableSequence.from([
          //   {
          //     question: (input) => input.query,
          //     context: () => JSON.stringify(relevantDocs),
          //     documents: () => JSON.stringify(documentVectors),
          //   },
          //   questionPrompt,
          //   chatModel,
          //   new StringOutputParser(),
          // ]);

          // const result = await chain.invoke({ query });

          // console.log(result, 'result');

          // return result;
        } catch (error) {
          console.error('Error in document summarization:', error);

          return `I apologize, but there was an issue processing the document directly. If you have any specific questions about these documents or need further assistance, please let me know and I'll do my best to help based on the information I have.`;
        }
      },
      {
        name: 'document_summarizer',
        description:
          'Summarizes an uploaded PDF document and allows querying its content. If no document is uploaded, prompts the user to upload one.',
        schema: z.object({
          conversationId: z.number().describe('The current conversation ID'),
          query: z.string().describe("The current user's query"),
        }),
      },
    );
  }

  workflowGuideTool() {
    return tool(
      async ({ currentIntent, requestedAction }) => {
        console.log(currentIntent, 'intent');
        console.log(requestedAction, 'requestedAction');

        const intents = [
          'deal screening',
          'document analysis',
          'generate investment memo',
          'conduct market research',
          'document summarizer',
        ];

        if (!intents.includes(currentIntent.toLowerCase())) {
          return `I'm sorry, but I don't recognize the current workflow "${currentIntent}". Please start a new conversation with one of the following intents: ${intents.join(
            ', ',
          )}.`;
        }

        if (currentIntent.toLowerCase() === requestedAction.toLowerCase()) {
          return `You're already in the ${currentIntent} workflow. How can I assist you with this task?`;
        }

        return `I understand you want to start the ${requestedAction} workflow, but the current conversation is set up for ${currentIntent} workflow. To continue the ${requestedAction} workflow, you'll need to start a new conversation for that workflow. `;
      },
      {
        name: 'workflow_guide',
        description:
          "Guides users when they try to perform actions outside the current conversation's intent.",
        schema: z.object({
          currentIntent: z.string().describe('The current conversation intent'),
          requestedAction: z
            .string()
            .describe('The action the user is trying to perform'),
        }),
      },
    );
  }

  introductionTool() {
    return tool(
      async ({}) => {
        return `This is your personal identity.
        
          Your name is CRESA, an agent who helps Commercial Real Estate (CRE) investors screen deals. You can screen deals, analyze documents, generate investment memos, and research. You may be asked to introduce yourself and describe your capabilities, limitations, and use cases to help users. 
          
          After introducing yourself, ask the user if they want to perform any of the following workflows. 
          1. Deal Screening 
          2. Document analysis 
          3. Generate investment memo
        `;
      },
      {
        name: 'introduction',
        description:
          'This is your personal Identity. Greet the user when they say hello, hi or any salutation',
      },
    );
  }

  async analyzeDocumentData(data: string): Promise<string> {
    const prompt = `Analyze the following document data and provide a detailed analysis of the numbers:

    ${data.slice(0, 5000)}

    Focus on key financial metrics, trends, and any notable insights. If it's a rent roll, analyze occupancy rates, average rents, and unit mix. If it's an operating statement, analyze income, expenses, and NOI.`;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a Document Analysis assistant helping a real estate investor analyze deal document.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
    });

    return (
      response.choices[0].message.content || 'Unable to analyze the document.'
    );
  }

  async generateChartData(
    analysis: string,
  ): Promise<Array<{ x: string; y: number }>> {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Based on the following document analysis, extract 5-7 key numerical metrics and their values. Format the output as a JSON array of objects, each with 'x' (metric name) and 'y' (numerical value) properties. Round the values to two decimal places if necessary.
  
  Analysis:
  ${analysis}
  
  Example output format:
  [
    { "x": "Occupancy Rate", "y": 95.5 },
    { "x": "Average Rent", "y": 1250 },
    ...
  ]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });

    let chartDataString = completion.choices[0].message.content;

    chartDataString = chartDataString.replace(/```json\n?|```\n?/g, '');

    chartDataString = chartDataString.trim();
    return JSON.parse(chartDataString);
  }

  // analyzeDocument() {
  //   return tool(
  //     async ({ documentURL }) => {
  //       console.log(`Analyzing document: ${documentURL}`);
  //       let data = '';

  //       try {
  //         if (documentURL.endsWith('.pdf')) {
  //           data = await this.utilitiesService.extractPDFFromURL(documentURL);
  //         } else if (
  //           documentURL.endsWith('.xlsx') ||
  //           documentURL.endsWith('.xlsm') ||
  //           documentURL.endsWith('.xls')
  //         ) {
  //           const buffer = await axios.get(documentURL, {
  //             responseType: 'arraybuffer',
  //           });
  //           data = this.extractTextFromExcel(buffer.data);
  //         } else {
  //           return 'Unsupported document format. Please provide a PDF or Excel file.';
  //         }

  //         const analysis = await this.analyzeDocumentData(data);

  //         // Generate chart data based on the analysis
  //         const chartData = await this.generateChartData(analysis);

  //         console.log(chartData, 'chartData');

  //         return `Analysis of the document:

  //         ${analysis}

  //         Chart data for visualization:
  //         ${JSON.stringify(chartData, null, 2)}

  //         You can use the plot_graph tool to create a visual representation of this data without having to ask the user for confirmation`;
  //       } catch (error) {
  //         console.error('Error analyzing document:', error);
  //         return `Failed to analyze the document: ${error.message}`;
  //       }
  //     },
  //     {
  //       name: 'analyze_document',
  //       description:
  //         'Analyze a document (PDF or Excel) and provide a detailed analysis of the numbers without attaching it to a deal. The user MUST to upload the document before continuing. ALWAYS ASK THE USER TO UPLOAD THE DOCUMENT BEFORE CONTINUING. If there is chart data available with the analysi, go ahead to create the chart  and include it without asking the user for confirmation.',
  //       schema: z.object({
  //         documentURL: z
  //           .string()
  //           .describe(
  //             'The document to analyze. Please upload the document. The user MUST UPLOAD THE DOCUMENT',
  //           ),
  //       }),
  //     },
  //   );
  // }

  analyzeDocument() {
    return tool(
      async ({ rentRollData, t12Data }) => {
        console.log(rentRollData, 'rent roll data');
        try {
          let analysis = '';

          if (!rentRollData || !t12Data) {
            return 'Please upload the document you will like to analyze';
          }

          // Analyze rent roll data if available
          if (
            rentRollData &&
            rentRollData.status === 'success' &&
            rentRollData.data
          ) {
            analysis += `Rent Roll Analysis:\n${await this.analyzeDocumentData(
              JSON.stringify(rentRollData.data),
            )}\n\n`;
          } else if (rentRollData) {
            analysis += `Rent Roll: ${rentRollData.message}\n\n`;
          }

          // Analyze T12 data if available
          if (t12Data && t12Data.status === 'success' && t12Data.data) {
            analysis += `T12 Analysis:\n${await this.analyzeDocumentData(
              JSON.stringify(t12Data.data),
            )}\n\n`;
          } else if (t12Data) {
            analysis += `T12: ${t12Data.message}\n\n`;
          }

          if (analysis.trim() === '') {
            return 'No data available for analysis. Please ensure rent roll and/or T12 documents have been uploaded and processed.';
          }

          // Generate chart data based on the analysis
          const chartData = await this.generateChartData(analysis);

          return `Analysis of the documents:
  
          ${analysis}
          
          Chart data for visualization:
          ${JSON.stringify(chartData, null, 2)}
          
          You can use the plot_graph tool to create a visual representation of this data without having to ask the user for confirmation.`;
        } catch (error) {
          console.error('Error analyzing documents:', error);
          return `Failed to analyze the documents: ${error.message}`;
        }
      },
      {
        name: 'analyze_document',
        description:
          'Analyze rent roll and T12 data provided by previous tools and provide a detailed analysis of the numbers. If no rent roll or t12 data, prompt the user to upload the document.',
        schema: z.object({
          rentRollData: z
            .any()
            .optional()
            .describe('The rent roll data from readRentRollData tool'),
          t12Data: z
            .any()
            .optional()
            .describe('The T12 data from readT12Data tool'),
        }),
      },
    );
  }

  createFileAttachment() {
    return tool(
      async ({ data, format, filename }) => {
        const parsedData =
          typeof data !== 'string' ? JSON.stringify(data) : data;
        return `Return file attachment data ${parsedData}, format: ${format} and filename: ${filename}`;
      },
      {
        name: 'create_attachment',
        description:
          'Get attachment format and markdown content, including filename and return the result to the send_email_to_user tool.',
        schema: z.object({
          data: z
            .any()
            .describe(
              'Markdown content or array of data to be converted to a PDF/Excel attachment',
            ),
          format: z
            .enum(['excel', 'pdf'])
            .describe('The format of the attachment'),
          filename: z
            .string()
            .describe('The name of the file (without extension)'),
        }),
      },
    );
  }

  private containsMarkdownTable(str: string): boolean {
    const tableRegex = /\|(.+)\|\n\|(?:[-:]+\|)+\n((?:\|.+\|\n)+)/;
    return tableRegex.test(str);
  }

  private async createExcelAttachment(data: any) {
    const workbook = XLSX.utils.book_new();

    console.log('Inside create excel attachment function>>>>>>>>>>>>');
    if (typeof data === 'string') {
      const isMarkDownData = this.containsMarkdownTable(data);

      if (!isMarkDownData) {
        data = JSON.parse(data);
      }
    }

    try {
      if (typeof data === 'string') {
        console.log('Handle string input (markdown tables)');
        // Handle string input (markdown tables)
        const tables = this.extractTablesFromMarkdown(data);

        if (tables.length > 0) {
          tables.forEach((table, index) => {
            const formattedData = this.formatData(table.headers, table.rows);
            this.addWorksheet(workbook, formattedData, `Table ${index + 1}`);
          });
        }
      } else if (
        Array.isArray(data) &&
        data.length > 0 &&
        Array.isArray(data[0])
      ) {
        // Handle 2D array input
        const headers = data[0];
        const rows = data.slice(1);
        const formattedData = this.formatData(headers, rows);
        this.addWorksheet(workbook, formattedData, 'Sheet1');
      } else if (
        Array.isArray(data) &&
        data.length > 0 &&
        typeof data[0] === 'object'
      ) {
        // Handle array of objects
        const headers = Object.keys(data[0]);
        const rows = data.map((obj) => headers.map((header) => obj[header]));
        const formattedData = this.formatData(headers, rows);
        this.addWorksheet(workbook, formattedData, 'Sheet1');
      } else if (typeof data === 'object' && data !== null) {
        // Handle TableData format
        this.addTableDataWorksheets(workbook, data);
      } else {
        console.log('Invalid data format');
        return null;
      }

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      console.log(
        'Excel file created successfully. Buffer size:',
        buffer.length,
      );

      return buffer;
    } catch (error) {
      console.error('Error creating Excel attachment:', error);
      throw error;
    }
  }

  private addTableDataWorksheets(workbook: XLSX.WorkBook, data) {
    // Add Comparables worksheet
    const comparablesData = this.prepareComparablesData(data);
    this.addWorksheet(
      workbook,
      comparablesData.content,
      comparablesData.heading,
    );

    // Add Historical Data worksheet
    const historicalData = this.prepareHistoricalData(data);
    this.addWorksheet(workbook, historicalData.content, historicalData.heading);

    // Add Rent Trends worksheet
    const rentTrendsData = this.prepareRentTrendsData(data);
    this.addWorksheet(workbook, rentTrendsData.content, rentTrendsData.heading);
  }

  private prepareComparablesData(data: any) {
    const headers = [
      'Address',
      'Property Type',
      'Price',
      'Bedrooms',
      'Bathrooms',
      'Sq Ft',
      'Year Built',
      'Distance',
    ];
    const rows =
      data.rentComps?.comparables?.map((comp) => [
        comp.formattedAddress || 'N/A',
        comp.propertyType || 'N/A',
        this.formatNumberToCurrency(comp.price || 0),
        comp.bedrooms || 'N/A',
        comp.bathrooms || 'N/A',
        comp.squareFootage || 'N/A',
        comp.yearBuilt || 'N/A',
        comp.distance || 'N/A',
      ]) || [];

    return {
      heading: 'Comparables',
      content: this.formatData(headers, rows),
    };
  }

  private prepareHistoricalData(data) {
    const headers = [
      'Date',
      'Avg Rent',
      'Min Rent',
      'Max Rent',
      'Total Listings',
    ];
    const historyEntries = Object.entries(
      data.marketData?.rentalData?.history || {},
    ).slice(-12);
    const rows = historyEntries.map(([date, info]: any) => [
      date,
      this.formatNumberToCurrency(info?.averageRent || 0),
      this.formatNumberToCurrency(info?.minRent || 0),
      this.formatNumberToCurrency(info?.maxRent || 0),
      info?.totalListings,
    ]);

    return {
      heading: 'Historical Data',
      content: this.formatData(headers, rows),
    };
  }

  private prepareRentTrendsData(data: any) {
    const headers = ['Period', 'Bedrooms', 'Avg Rent', 'Min Rent', 'Max Rent'];
    const trendPeriods = [3, 6, 9, 12];
    const bedroomCounts = [0, 1, 2, 3, 4];
    const rows: Array<Array<string | number>> = [];

    trendPeriods.forEach((period) => {
      bedroomCounts.forEach((bedrooms) => {
        const relevantMonths = Object.entries(
          data.marketData?.rentalData?.history || {},
        ).slice(-period);
        const rentData = relevantMonths.flatMap(
          ([_, monthData]: any) =>
            monthData?.dataByBedrooms?.find(
              (bed) => bed.bedrooms === bedrooms,
            ) || [],
        );

        if (rentData.length > 0) {
          const avgRent =
            rentData.reduce((sum, month) => sum + (month.averageRent || 0), 0) /
            rentData.length;
          const minRent = Math.min(
            ...rentData.map((month) => month.minRent || Infinity),
          );
          const maxRent = Math.max(
            ...rentData.map((month) => month.maxRent || -Infinity),
          );

          rows.push([
            `${period} months`,
            bedrooms === 0 ? 'Studio' : bedrooms,
            this.formatNumberToCurrency(avgRent),
            this.formatNumberToCurrency(minRent),
            this.formatNumberToCurrency(maxRent),
          ]);
        }
      });
    });

    return {
      heading: 'Rent Trends',
      content: this.formatData(headers, rows),
    };
  }

  private formatNumberToCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  private addWorksheet(
    workbook: XLSX.WorkBook,
    data: string[][],
    sheetName: string,
  ) {
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Apply styles to headers
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!worksheet[address]) continue;
      worksheet[address].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'FFFF00' } },
        alignment: { horizontal: 'center' },
      };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  private formatData(
    headers: string[],
    rows: Array<Array<string | number>>,
  ): string[][] {
    return [headers, ...rows.map((row) => row.map((cell) => String(cell)))];
  }

  sendInvestmentMemoAsPDF() {
    return tool(
      async ({ conversationId, usersEmail, subject }) => {
        try {
          console.log('I got here >>>>>>>>>>>>>>');
          // Fetch the conversation and investment memo
          const conversation = await this.conversationRepo.findOne({
            where: { id: +conversationId },
          });

          if (!conversation || !conversation.investmentMemo) {
            return 'No investment memo found for this conversation.';
          }

          // Create PDF

          const content = `## Investment Memo \n\n ${conversation?.investmentMemo.join(
            '\n',
          )}`;
          const pdfBuffer = await this.createPDFAttachment(content);

          const signature = `
          <br><br>
          Best regards,<br>
          Cresa, Your AI Analyst
        `;
          const emailBody = `Please find attached the investment memo PDF.${signature}`;

          // Prepare email options
          const emailOptions = {
            to: usersEmail,
            subject: subject || 'Investment Memo',
            html: emailBody,
            attachments: [
              {
                filename: 'investment_memo.pdf',
                content: pdfBuffer,
                contentType: 'application/pdf',
              },
            ],
          };

          // Send email
          await this.mailService.sendMail(emailOptions);

          return 'Investment memo PDF has been sent successfully to the provided email address.';
        } catch (error) {
          console.error('Error in sendInvestmentMemoAsPDF:', error);
          return `Failed to send investment memo PDF: ${error.message}`;
        }
      },
      {
        name: 'send_investment_memo_pdf',
        description:
          "Sends the investment memo as a PDF attachment to the user's email. IMPORTANT: 1) Always ask the user for an email address if not provided. 2) DO NOT send any email without a user-provided email address. 3) Send only one email per request, even if asked for multiple.",
        schema: z.object({
          conversationId: z.number().describe('The current conversation ID'),
          usersEmail: z
            .string()
            .email()
            .describe('The email address to send the PDF to'),
          subject: z
            .string()
            .optional()
            .describe('The subject of the email (optional)'),
        }),
      },
    );
  }

  private async createPDFAttachment(markdownContent: string): Promise<Buffer> {
    const md = new markdown();
    const htmlContent = md.render(markdownContent);

    const isAWS = process.env.NODE_ENV === 'production';

    const launchOptions = isAWS
      ? {
          executablePath: '/usr/bin/google-chrome-stable',
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
      : {};

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set the content and wait for network idle to ensure all resources are loaded
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
    });

    await browser.close();

    return Buffer.from(pdfBuffer);
  }

  private extractTablesFromMarkdown(
    markdown: string,
  ): Array<{ headers: string[]; rows: string[][] }> {
    const tables = [];
    const tableRegex = /\|(.+)\|\n\|(?:[-:]+\|)+\n((?:\|.+\|\n)+)/g;
    let match;

    while ((match = tableRegex.exec(markdown)) !== null) {
      const headers = match[1]
        .split('|')
        .map((header) => header.trim())
        .filter(Boolean);
      const rows = match[2]
        .trim()
        .split('\n')
        .map((row) =>
          row
            .split('|')
            .map((cell) => cell.trim())
            .filter(Boolean),
        );
      tables.push({ headers, rows });
    }

    return tables;
  }

  private cleanedFileName(filename: string) {
    const parts = filename.split('.');
    const namePart = parts.slice(0, -1).join('.');
    const extensionPart = parts[parts.length - 1];
    const cleanedName = namePart.replace(/[^a-zA-Z0-9]/g, '');

    return `${cleanedName}.${extensionPart}`;
  }

  private async saveBufferToStorage(
    buffer: Buffer,
    filename: string,
  ): Promise<string> {
    const s3Client = new S3Client({
      region: process.env.AWS_DEFAULT_REGION,
      credentials: {
        accessKeyId: process.env.AWS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET,
      },
    });

    try {
      const resp = new Upload({
        client: s3Client,
        params: {
          Body: buffer,
          Bucket: process.env.EXTRACTION_S3_BUCKET,
          Key: `deals/input/${
            1000 + Math.floor(Math.random() * 9999)
          }${this.cleanedFileName(filename)}`,
          ACL: 'public-read',
          ContentDisposition: 'inline',
          ContentType: 'image/png',
        },
      });

      // AWAIT RESPONSE FROM S3
      const data = await resp.done();

      return data?.Location;
    } catch (error) {
      console.log(error, 'Error Uploaded to S3');
    }
  }

  plotGraph() {
    return tool(
      async ({ data, chartType, title, xLabel, yLabel }) => {
        try {
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid data format. Expected non-empty array.');
          }

          let spec: any = {
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            width: 400,
            height: 300,
            padding: { left: 20, top: 20, right: 20, bottom: 20 },
            title: { text: title || 'Chart', fontSize: 16, font: 'sans-serif' },
            data: { values: data },
            config: {
              axis: {
                labelFont: 'sans-serif',
                titleFont: 'sans-serif',
                labelFontSize: 12,
                titleFontSize: 14,
              },
              legend: {
                labelFont: 'sans-serif',
                titleFont: 'sans-serif',
                labelFontSize: 12,
                titleFontSize: 14,
              },
            },
          };

          switch (chartType) {
            case 'pie':
            case 'donut':
              spec = {
                ...spec,
                mark: {
                  type: 'arc',
                  innerRadius: chartType === 'donut' ? 50 : 0,
                },
                encoding: {
                  theta: { field: 'y', type: 'quantitative' },
                  color: {
                    field: 'x',
                    type: 'nominal',
                    legend: { title: null },
                  },
                },
              };
              break;
            case 'line':
              spec = {
                ...spec,
                mark: { type: 'line', strokeWidth: 2 },
                encoding: {
                  x: {
                    field: 'x',
                    type: 'nominal',
                    axis: { title: xLabel || 'X Axis', labelAngle: -45 },
                  },
                  y: {
                    field: 'y',
                    type: 'quantitative',
                    axis: { title: yLabel || 'Y Axis' },
                  },
                },
              };
              break;
            case 'area':
              spec = {
                ...spec,
                mark: { type: 'area' },
                encoding: {
                  x: {
                    field: 'x',
                    type: 'nominal',
                    axis: { title: xLabel || 'X Axis', labelAngle: -45 },
                  },
                  y: {
                    field: 'y',
                    type: 'quantitative',
                    axis: { title: yLabel || 'Y Axis' },
                  },
                },
              };
              break;
            case 'scatter':
              spec = {
                ...spec,
                mark: { type: 'point' },
                encoding: {
                  x: {
                    field: 'x',
                    type: 'quantitative',
                    axis: { title: xLabel || 'X Axis' },
                  },
                  y: {
                    field: 'y',
                    type: 'quantitative',
                    axis: { title: yLabel || 'Y Axis' },
                  },
                },
              };
              break;
            case 'heatmap':
              spec = {
                ...spec,
                mark: 'rect',
                encoding: {
                  x: {
                    field: 'x',
                    type: 'nominal',
                    axis: { title: xLabel || 'X Axis', labelAngle: -45 },
                  },
                  y: {
                    field: 'y',
                    type: 'nominal',
                    axis: { title: yLabel || 'Y Axis' },
                  },
                  color: {
                    field: 'value',
                    type: 'quantitative',
                    scale: { scheme: 'viridis' },
                    legend: { title: 'Value' },
                  },
                },
              };
              break;
            default: // bar chart as default
              spec = {
                ...spec,
                mark: { type: 'bar' },
                encoding: {
                  x: {
                    field: 'x',
                    type: 'nominal',
                    axis: { title: xLabel || 'X Axis', labelAngle: -45 },
                  },
                  y: {
                    field: 'y',
                    type: 'quantitative',
                    axis: { title: yLabel || 'Y Axis' },
                  },
                  color: {
                    field: 'x',
                    type: 'nominal',
                    legend: null,
                  },
                },
              };
          }
          const vegaSpec = vegaLite.compile(spec).spec;
          const view = new vega.View(vega.parse(vegaSpec), {
            renderer: 'none',
          });
          const svg = await view.toSVG();

          const canvasWidth = 650;
          const canvasHeight = 450;
          const canvas = createCanvas(canvasWidth, canvasHeight);
          const ctx = canvas.getContext('2d');

          // Fill the background with white
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);

          const img = await loadImage(
            `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
          );

          // Calculate scaling factor to fit the image within the canvas
          const scale = Math.min(
            canvasWidth / img.width,
            canvasHeight / img.height,
          );
          const x = (canvasWidth - img.width * scale) / 2;
          const y = (canvasHeight - img.height * scale) / 2;

          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

          const buffer = canvas.toBuffer('image/png');
          const filename = `graph_${Date.now()}.png`;
          const fileUrl = await this.saveBufferToStorage(buffer, filename);

          console.log(fileUrl, 'fileUrl');

          return `Graph generated successfully. Here's the graph:

![${title || 'Chart'}](${fileUrl})

You can reference this graph as ${filename}.`;
        } catch (error) {
          console.error('Error generating graph:', error);
          return `Failed to generate graph: ${error.message}`;
        }
      },
      {
        name: 'plot_graph',
        description: 'Plot a graph based on the provided data and chart type.',
        schema: z.object({
          data: z
            .array(
              z.object({
                x: z.union([z.string(), z.number()]),
                y: z.number(),
              }),
            )
            .describe('Array of data points with x and y values'),
          chartType: z
            .string()
            .optional()
            .describe('Type of chart to plot (e.g., "bar", "line", "scatter")'),
          title: z.string().optional().describe('Title of the graph'),
          xLabel: z.string().optional().describe('Label for the x-axis'),
          yLabel: z.string().optional().describe('Label for the y-axis'),
        }),
      },
    );
  }

  conductMarketResearch() {
    return tool(
      async ({ address, conversationId }) => {
        console.log(address, 'address');
        console.log(conversationId, 'conversationId');
        try {
          const rentCompsData = await this.fetchRentCastData(address);

          const relevantData = {
            rentComps: rentCompsData.rentComps,
            marketData: rentCompsData.marketData,
            helloDataComps:
              rentCompsData?.helloDataProperty?.comparables || null,
          };

          await this.conversationService.updateConversation(conversationId, {
            data: rentCompsData,
          });

          const systemMessage = `You have access to the following RentCast data as reference. Use this information to inform your responses:
          ${this.truncateJsonString(
            JSON.stringify(relevantData, null, 2),
            1028576,
          )}

          
          Given the rent comps data, generate a detailed and well structed rent comps report for the following address ${address}.
      
          Also search for related properties on Zillow and Apartments.com and do a detailed comparism.
          
          Return data for:
          - Market rent for 1, 2, 3 bedrooms and also studio apartment.
          - Average, min and max rent
          - Rent trends over the last 3, 6 and 12 months for 1, 2, 3 bedrooms
          - Links to available 1,2,3 bedroom units on the market is available
          - If avaialble, return Zestimate from Zillow
          - If available, return estimates from Apartments.com


          If HelloData is available, also include but DO NOT REVEAL Hello Data as the data source, instead you could call this Apartment Comps:
          - Property details such as year built, number of units, and property type
          - Recent sales history if available
          - Comparable properties in the area with their details
          - Any additional market insights or trends from the HelloData API

          DO NOT REVEAL Hello Data OR RentCast as the data source.

          This should be a text based data and not tabular data.

          Only conduct market research, DO NOT generate investment memo.
          `;

          return systemMessage;
        } catch (error) {
          console.error('Error in conductMarketResearch:', error);
          return `An error occurred while conducting market research: ${error.message}`;
        }
      },
      {
        name: 'conduct_market_research',
        description:
          'Used to get rent comps for a given adddress. This should only call the conduct_market_research and not call the investment_memo tool. The user MUST to provide an address. DO NOT ASSUME ANY ADDRESS. ALWAYS ASK THE USER TO PROVIDE AN ADDRESS BEFORE CONTINUING',
        schema: z.object({
          address: z
            .string()
            .describe(
              'The address to get rent comps for. The user MUST to provide an address. DO NOT ASSUME ANY ADDRESS. ALWAYS ASK THE USER TO PROVIDE AN ADDRESS BEFORE CONTINUING',
            ),
          conversationId: z
            .number()
            .describe('The id of the current conversation'),
        }),
      },
    );
  }

  private async fetchRentCastData(address: string) {
    console.log(`Fetching rent comps data for ${address}`);

    const headers = {
      'x-api-key': process.env.RENT_CAST_API_KEY,
      accept: 'application/json',
    };

    const headersHelloData = {
      'x-api-key': process.env.HELLO_DATA_API_KEY,
      accept: 'application/json',
    };

    // Fetch Google Geocoding data
    const { geometry, formatted_address, postalCode } =
      await this.getGoogleGeocodingData(address);

    // Fetch property data concurrently
    const [propertyDataResponse, helloDataRes] = await Promise.all([
      this.fetchPropertyData(address, headers),
      this.fetchHelloDataProperty(
        geometry,
        formatted_address,
        postalCode,
        headersHelloData,
      ),
    ]);

    // Process HelloData if available
    const helloDataProperty =
      helloDataRes && helloDataRes?.length
        ? await this.processHelloData(
            helloDataRes,
            formatted_address,
            headersHelloData,
          )
        : null;

    // Fetch rent comps and market data
    const { rentCompsResponse, marketDataResponse } =
      await this.fetchRentCompsAndMarketData(
        propertyDataResponse,
        address,
        geometry,
        postalCode,
        headers,
      );

    return {
      rentComps: rentCompsResponse?.data,
      propertyData: propertyDataResponse ? propertyDataResponse.data : '',
      marketData: marketDataResponse?.data,
      helloDataProperty,
    };
  }

  private async getGoogleGeocodingData(address: string) {
    const encodedAddress = encodeURIComponent(address);
    const googleURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${process.env.GOOGLE_API_KEY}`;
    const { data } = await axios.get(googleURL);

    const geometry = data?.results[0]?.geometry?.location;
    const formatted_address = data?.results[0]?.formatted_address;
    const postalCode = data?.results[0]?.address_components?.find((component) =>
      component.types.includes('postal_code'),
    );
    return { geometry, formatted_address, postalCode };
  }

  private async fetchPropertyData(address: string, headers: any) {
    const propertyDataURL = `${process.env.RENT_CAST_BASE_URL}/properties?address=${address}`;
    try {
      return await axios.get(propertyDataURL, { headers });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('Property data not found, continuing with null value');
        return null;
      }
      throw error;
    }
  }

  private async fetchHelloDataProperty(
    geometry: any,
    formatted_address: string,
    postalCode: any,
    headers: any,
  ) {
    const helloDataPropertyURL = `${process.env.HELLO_DATA_API_URL}/property/search?lat=${geometry?.lat}&lon=${geometry?.lng}&q=${formatted_address}&zip_code=${postalCode.long_name}`;
    const res = await axios.get(helloDataPropertyURL, { headers });
    return res?.data;
  }

  private truncateJsonString(jsonString: string, maxLength: number): string {
    if (jsonString.length <= maxLength) {
      return jsonString;
    }

    const truncatedString = jsonString.slice(0, maxLength - 3) + '...';
    let bracketCount = 0;
    let lastValidIndex = truncatedString.length - 1;

    for (let i = truncatedString.length - 1; i >= 0; i--) {
      if (truncatedString[i] === '}' || truncatedString[i] === ']') {
        bracketCount++;
      } else if (truncatedString[i] === '{' || truncatedString[i] === '[') {
        bracketCount--;
      }

      if (bracketCount === 0) {
        lastValidIndex = i;
        break;
      }
    }

    return truncatedString.slice(0, lastValidIndex + 1);
  }

  private normalizeAddress(address: string) {
    return address
      .toLowerCase()
      .replace(/,/g, '')
      .replace(/\b(st\.?|street)\b/gi, 'street')
      .replace(/\b(ave\.?|avenue)\b/gi, 'avenue')
      .replace(/\b(blvd\.?|boulevard)\b/gi, 'boulevard')
      .replace(/\b(rd\.?|road)\b/gi, 'road')
      .replace(/\b(dr\.?|drive)\b/gi, 'drive')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isAddressSimilar(address1: string, address2: string) {
    const normalizedAddress1 = this.normalizeAddress(address1);
    const normalizedAddress2 = this.normalizeAddress(address2);

    // Check if one address contains the other (in either direction)
    return (
      normalizedAddress1.includes(normalizedAddress2) ||
      normalizedAddress2.includes(normalizedAddress1)
    );
  }

  private async processHelloData(
    helloDataRes: any,
    formatted_address: string,
    headers: any,
  ) {
    if (
      helloDataRes?.length === 1 &&
      this.isAddressSimilar(formatted_address, helloDataRes[0]?.street_address)
    ) {
      console.log('Processing started >>>>>>>');
      const propertyDetails = await this.fetchPropertyDetails(
        helloDataRes[0]?.id,
        headers,
      );
      const comparables = await this.fetchComparables(propertyDetails, headers);
      return { propertyDetails, comparables };
    }
    return null;
  }

  private async fetchPropertyDetails(id: string, headers: any) {
    const url = `${process.env.HELLO_DATA_API_URL}/property/${id}`;
    const response = await axios.get(url, { headers });
    return response?.data;
  }

  private async fetchComparables(propertyDetails: any, headers: any) {
    const url = `${process.env.HELLO_DATA_API_URL}/property/comparables`;
    const config = {
      method: 'post',
      url,
      headers,
      data: { subject: propertyDetails },
    };
    const response = await axios(config);
    return response?.data;
  }

  private async fetchRentCompsAndMarketData(
    propertyDataResponse: any,
    address: string,
    geometry: any,
    postalCode: any,
    headers: any,
  ) {
    let rentCompsURL: string, marketDataURL: string;

    if (propertyDataResponse) {
      const zipCode = propertyDataResponse.data[0].zipCode;
      rentCompsURL = `${
        process.env.RENT_CAST_BASE_URL
      }/avm/rent/long-term?address=${encodeURIComponent(address)}`;
      marketDataURL = `${process.env.RENT_CAST_BASE_URL}/markets?zipCode=${zipCode}`;
    } else {
      if (!geometry || !postalCode) {
        throw new BadRequestException(
          'Unable to find location data for the given address',
        );
      }
      rentCompsURL = `${process.env.RENT_CAST_BASE_URL}/avm/rent/long-term?latitude=${geometry.lat}&longitude=${geometry.lng}`;
      marketDataURL = `${process.env.RENT_CAST_BASE_URL}/markets?zipCode=${postalCode.long_name}`;
    }

    const [rentCompsResponse, marketDataResponse] = await Promise.all([
      axios.get(rentCompsURL, { headers }),
      axios.get(marketDataURL, { headers }),
    ]);

    return { rentCompsResponse, marketDataResponse };
  }

  sendEmailToUsers() {
    return tool(
      async ({ usersEmail, subject, body }: any) => {
        this.mailService.sendMail({
          to: usersEmail,
          subject: subject,
          html: body,
        });

        return `Email has been send successfully`;
      },
      {
        name: 'send_email_to_user',
        description:
          'Sends a email using the provided parameters or if no email is provided, use the logged in users email. Format the email body as HTML. If they are tables, properly style the table.',
        schema: z.object({
          usersEmail: z
            .string()
            .describe('The email of the user the email is to be sent to'),
          subject: z.string().describe('The subject of the email.'),
          body: z.string().describe('The body/content of the email'),
        }),
      },
    );
  }

  sendEmailToUsersBH() {
    return tool(
      async ({
        usersEmail,
        subject,
        body,
        conversationId,
        format,
        markdownContent,
        filename,
      }) => {
        let buffer: Buffer;
        let contentType: string;

        const emailOptions: any = {
          to: usersEmail,
          subject: subject,
          html: body,
        };

        try {
          if (markdownContent) {
            const cleanedFilename =
              this.utilitiesService.cleanedFileName(filename);
            const fileExtension = format === 'excel' ? '.xlsx' : '.pdf';
            const fullFilename = `${cleanedFilename}${fileExtension}`;

            if (format === 'excel') {
              console.log('Creating Excel attachment');
              // markdownContent = JSON.parse(markdownContent);
              buffer = await this.createExcelAttachment(markdownContent);
              contentType =
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            } else if (format === 'pdf') {
              console.log('Creating PDF attachment');
              markdownContent = String(markdownContent);
              buffer = await this.createPDFAttachment(markdownContent);
              contentType = 'application/pdf';
            }

            console.log(
              `Attachment created: ${fullFilename}, size: ${buffer.length} bytes`,
            );

            emailOptions.attachments = [
              {
                filename: fullFilename,
                content: buffer,
                contentType,
              },
            ];
          }

          await this.mailService.sendMail(emailOptions);

          const conversation = await this.beachheadRepo.findOne({
            where: { conversationId },
          });

          if (conversation) {
            console.log('Starting to delete record');
            await this.beachheadRepo.delete({
              conversationId: conversation.conversationId,
            });
            console.log('Deleted record');
            const newConvo = this.beachheadRepo.create({
              ...conversation,
              email: usersEmail,
            });
            await this.beachheadRepo.save(newConvo);

            console.log('Created new record');
          }

          return `Email has been sent successfully.`;
        } catch (error) {
          console.error('Error in sendEmailToUsersBH:', error);
          if (error.response) {
            console.error('Error response:', error.response.body);
          }
          throw new Error(`Failed to send email: ${error.message}`);
        }
      },
      {
        name: 'send_email_to_user',
        // description:
        //   'Sends an email using the provided parameters. Can include a PDF or Excel attachment but might be optional. The users must provide an email address to send to, if not you have to ask them to provide an email. DO NOT send any email if the user doesnt provide you an email address. Also DO NOT send more than 1 email at once even if the user asks for it. Format the email body as HTML. Always use Cresa, Your AI Analyst in the email signature.',
        description:
          'Sends an email using the provided parameters. Can include a PDF or Excel attachment (optional). IMPORTANT: 1) Always ask the user for an email address if not provided. 2) DO NOT send any email without a user-provided email address. 3) Send only one email per request, even if asked for multiple. 4) Always sign with "Cresa, Your AI Analyst". 5) Confirm content and recipient before sending. 6) Format the email body as HTML with proper styling. 7) If no attachment format is specified, use HTML formatting.',
        schema: z.object({
          usersEmail: z
            .string()
            .describe('The email of the user the email is to be sent to'),
          subject: z.string().describe('The subject of the email.'),
          body: z.string().describe('The body/content of the email'),
          conversationId: z
            .string()
            .describe('The current conversation conversationId'),
          markdownContent: z
            .any()
            .optional()
            .describe(
              'Markdown content or data array to be converted to email attachment.',
            ),
          format: z
            .string()
            .optional()
            .describe(
              'Type of the attachement to be included in the email. It could be either excl or pdf',
            ),
          filename: z
            .string()
            .optional()
            .describe('The name of the file attachement.'),
        }),
      },
    );
  }

  getUserOrganizationModel() {
    return tool(
      async ({ organizationId }) => {
        const models = await this.modelService.getOrganizationModels(
          organizationId,
        );

        if (!models.length) {
          return `The user and their organization do not have any model.`;
        }

        const md = models.map(
          (model) => ({
            id: model.id,
            isDefult: model.isDefault,
            modelName: model.modelName,
          }),
          // `ID : ${model.id} | Name: ${model.modelName} | isDefault ${model.isDefault}`,
        );

        // const slimModel = models.map(model => ({
        //   id: model.id,
        //   modelName: model.modelName,
        // }))

        return `
          ${JSON.stringify(md)}
        `;
      },
      {
        name: 'get_user_models',
        description:
          'Get the list of models uploaded for a user or their organization as numbered list',
        schema: z.object({
          organizationId: z.number().describe("The user's organization ID"),
        }),
      },
    );
  }

  attachDealToModel() {
    return tool(
      async ({ dealId, modelId }) => {
        console.log(`The deal ID is ${dealId} and the Model ID is ${modelId}`);
        const deal = await this.dealService.findOne(dealId);

        if (deal?.activeModelSyncId === modelId) {
          return `Deal has been attached to model. You can sync data in now`;
        }
        await this.dealService.syncDealToModel(dealId, { modelId });
        return `Deal has been attached to model. You can sync data in now`;
      },
      {
        name: 'attach_deal_to_model',
        description: 'Attach a deal to a selected model using their ID',
        schema: z.object({
          modelId: z.number().describe('The ID of the model to attach to'),
          dealId: z.number().describe('The ID of the deal to attach'),
        }),
      },
    );
  }

  analyzeScreenDealResult() {
    return tool(
      async ({ conversationId }) => {
        const conversation = await this.conversationRepo.findOne({
          where: { id: conversationId },
        });
        const dealId = conversation?.dealId;

        console.log(`The deal ID to Analyze is ${dealId}`);
        const deal = await this.dealService.findOne(dealId);
        const MSGraphID = deal?.meta?.model?.microsoft?.id;
        if (!deal?.activeModelSyncId || !MSGraphID) {
          return 'Could not complete analysis result because the deal is either not attached to a model or was not uploaded.';
        }
        const JSON = await this.microsoftService.getWorkbookComputedData(
          MSGraphID,
        );

        const model = await this.modelService.findOneById(
          deal?.activeModelSyncId,
        );

        const chatResponse = await this.llmService.evaluateDeal(
          JSON,
          model.modelBenchmark,
        );

        return `${chatResponse}
          If all required benchmarks passed, the deal passed or it failed.
        `;
      },
      {
        name: 'analyze_screen_deal_result',
        description: 'Process the final result for the deal screening',
        schema: z.object({
          conversationId: z.number().describe('The ID of the conversation'),
        }),
      },
    );
  }

  writeDataToModel() {
    return tool(
      async ({
        dataRange,
        dataArray,
        sheetName,
        conversationId,
        dealId,
      }: any) => {
        console.log(
          dataRange,
          dataArray,
          sheetName,
          'ID to write to MoDEL BEFORE>>>>>>>',
        );

        if (!Array.isArray(dataArray[0])) {
          dataArray = [dataArray];
        }

        if (!dataRange.includes(':')) {
          dataRange = `${dataRange}:${dataRange}`;
        }

        console.log(
          dataRange,
          dataArray,
          sheetName,
          'ID to write to MoDEL AFTER>>>>>>>',
        );
        const cellCount =
          this.utilitiesService.countCellsInExcelRange(dataRange);

        if (cellCount > dataArray.length) {
          dataArray.push(['']);
        }

        const conversation = await this.conversationRepo.findOne({
          where: {
            id: conversationId,
          },
        });

        const deal = await this.dealService.findOne(
          conversation?.dealId || dealId,
        );

        if (!deal) {
          return 'Looks like a deal has not been created or has been deleted.';
        }

        if (!deal?.activeModelSyncId) {
          return 'You have not attached this deal to a model. Select one of your uploaded models to continue';
        }

        const id = deal?.meta?.model?.microsoft?.id;

        await this.microsoftService.replaceColumnData(
          id,
          sheetName,
          dataRange,
          dataArray,
        );

        // await this.dealService.computeDealBenchmarks(dealId);
        return `Data written to model successfully. Ask the user if they would like to see the final deal screening result.`;
      },
      {
        name: 'write_data_to_model',
        description: `This tool Writes data to a model the user has selected for that deal. The dataRange much match the number of data in dataArray. Range must be in the format A1:A11. You cannot have more than one range at a time and you must write data columnwise. i.e column by column. Always read to understand the updated acquisition model. Before you use this tool, call the read_acquisition_model tool to understand the model and the data in it, including the sheetnames
          
          **To achieve this, you must call these tools in the following order**
          - read_acquisition_model to understand where to write the data to in the model
          - read_rentroll_data if you are reading rent roll or read_t12_data if you are reading T12
          - write_data_to_model to write the data

          Whatever data the user wants to write to the model, find the sheet and the cell where the data exist when you call _read_acquisition_model

          Always tell the cells and sheets that were changed
          `,
        schema: z.object({
          // modelId: z.string().describe('The model ID. Usually MSGraph ID'),
          dealId: z.number().describe('The deal ID'),
          sheetName: z
            .string()
            .describe(
              'The name of the worksheet to write to. Default should be Sheet1',
            ),
          dataRange: z
            .string()
            .describe(
              'The excel range to write to. Eg A1:A8. The length must match the numbr of items in data array. You cannot have more than one range at a time',
            ),
          dataArray: z
            .array(z.array(z.union([z.string(), z.number()])))
            .describe(
              'A two-dimensional array containing arrays of strings or numbers that matches the length of the dataRange',
            ),
        }),
      },
    );
  }

  // extractTextFromPdf = async (fileContent) => {
  //   const response = await new Promise<string>((resolve, reject) => {
  //     try {
  //       pdf(fileContent).then(function (data) {
  //         resolve(data.text);
  //       });
  //     } catch (error) {
  //       reject('Could not parse PDF');
  //       console.log('ERror occured', error);
  //     }
  //   });

  //   return response;
  // };

  extractTextFromPdf = async (fileContent) => {
    try {
      const data = await pdf(fileContent);
      return data.text;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      if (error.message.includes('Invalid PDF structure')) {
        return 'The PDF file appears to be corrupted or in an invalid format. Please try uploading a different file.';
      }
      return 'An error occurred while processing the PDF file. Please try again or use a different file.';
    }
  };

  extractTextFromExcel = (fileContent: any) => {
    const workbook = XLSX.read(fileContent, { type: 'buffer' });
    let text = '';
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      text += XLSX.utils.sheet_to_csv(worksheet);
    });

    return text;
  };

  identifyDocumentType() {
    return tool(
      async ({ url }: any) => {
        try {
          const response = await axios.get(url, {
            responseType: 'arraybuffer',
          });
          const fileContent = response.data;

          let text = '';
          if (String(url).endsWith('.pdf')) {
            text = await this.extractTextFromPdf(fileContent);
          } else if (
            String(url).endsWith('.xlsx') ||
            String(url).endsWith('.xls') ||
            String(url).endsWith('.xlsm') ||
            String(url).endsWith('.xlsb')
          ) {
            text = this.extractTextFromExcel(fileContent);
          } else {
            return 'Unsupported document format.';
          }

          // If text extraction failed, return the error message
          if (
            text.startsWith('The PDF file appears to be corrupted') ||
            text.startsWith('An error occurred while processing')
          ) {
            return `Action: IdentifyDocumentType\nAction Input: Error: ${text}`;
          }

          // Pass the extracted text to GPT for analysis
          const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          });

          const prompt = `Analyze the following text and determine the type of CRE document if it falls within any of the following category  - Rent Roll, T12, OM, CoStar Report :\n\n${text.slice(
            0,
            2500,
          )}`;

          const aiResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 2000,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          });

          if (!aiResponse.choices || aiResponse.choices.length === 0) {
            return 'Action: IdentifyDocumentType\nAction Input: Error: No response from the AI';
          }

          const responseText = aiResponse.choices[0].message.content;

          // Format the response for CustomOutputParser
          return `Action: IdentifyDocumentType\nAction Input: ${responseText}`;
        } catch (error) {
          console.error('Error in identifyDocumentType:', error);
          return `Action: IdentifyDocumentType\nAction Input: Error: Failed to identify the document type`;
        }
      },
      {
        name: 'identity_document_type',
        description:
          'Identifies the type of CRE document from a given url. Please upload the document',
        schema: z.object({
          url: z.string().describe('The url of the document').optional(),
        }),
      },
    );
  }

  private async generateMemoSummary(fullMemo: string): Promise<string> {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant tasked with summarizing investment memos. Create a detailed summary that captures the key points of each section. Your summary should:
  
          1. Maintain the structure of the original memo (keep all main sections).
          2. Provide a comprehensive overview of each section, including important facts, figures, and insights.
          3. Highlight any potential risks or opportunities mentioned in the memo.
          4. Include relevant financial data, market trends, and property specifics.
          5. Summarize any recommendations or conclusions presented in the memo.
  
          Aim for a summary that is about 60% of the length of the original memo, ensuring all crucial information is retained.`,
        },
        {
          role: 'user',
          content: `Please provide a detailed summary of the following investment memo:\n\n${fullMemo}`,
        },
      ],
      max_tokens: 1500, // Increased to allow for a more detailed summary
      temperature: 0.5, // Slightly reduced for more focused output
    });

    return (
      response.choices[0].message.content ||
      'Unable to generate detailed summary.'
    );
  }

  retrieveInvestmentMemo() {
    return tool(
      async ({ conversationId }) => {
        const conversation = await this.conversationRepo.findOne({
          where: { id: +conversationId },
        });

        if (!conversation || !conversation.investmentMemo) {
          return 'No investment memo found for this conversation.';
        }

        const sectionTitles = [
          'Property Overview',
          'Neighborhood Overview',
          'Local Attractions',
          'Transportation',
          'Job Market Overview',
          'Submarket Overview',
          'Demographic Overview',
        ];

        const fullMemo = sectionTitles
          .map(
            (title, index) =>
              `## ${title}\n\n${conversation.investmentMemo[index]}`,
          )
          .join('\n\n');

        const investmentMemoSummary = await this.generateMemoSummary(fullMemo);

        return `This is the summary of the investment memo: ${investmentMemoSummary}`;
      },
      {
        name: 'retrieve_investment_memo',
        description:
          'Retrieves a specific section or summary of the investment memo for the current conversation',
        schema: z.object({
          conversationId: z.string().describe('The current conversation ID'),
        }),
      },
    );
  }
  generateInvestmentMemo() {
    return tool(
      async ({ address, conversationId }) => {
        // Check for existing rent roll and T12 documents

        const conversation = await this.conversationRepo.findOne({
          where: { id: conversationId },
        });

        const documents =
          await this.documentService.findAllDocumentByConversationID(
            conversation.conversationId,
          );

        const hasRentRoll = documents.some(
          (doc) => doc.fileType === 'rent-roll',
        );
        const hasT12 = documents.some((doc) => doc.fileType === 'trailing-12');

        let rentRollSummary = '';
        let t12Summary = '';

        // If documents exist, get their summaries
        if (hasRentRoll) {
          const rentRollDoc = documents.find(
            (doc) => doc.fileType === 'rent-roll',
          );

          rentRollSummary =
            rentRollDoc.summary ||
            'Rent roll data is available but no summary was generated.';
        }
        if (hasT12) {
          const t12Doc = documents.find(
            (doc) => doc.fileType === 'trailing-12',
          );
          t12Summary =
            t12Doc.summary ||
            'T12 data is available but no summary was generated.';
        }

        const memoPrompts = [
          PROPERTY_OVERVIEW(address, rentRollSummary, t12Summary),
          NEIGHNORHOOD_OVERVIEW(address),
          LOCAL_ATTRACTIONS(address),
          TRANSPORTATION(address),
          JOBMARKET_OVERVIEW(address),
          SUBMARKET_OVERVIEW(address),
          DEMOGRAPHIC_OVERVIEW(address),
        ];

        console.log(address, 'address >>>>>');

        const responses = await Promise.all(
          memoPrompts.map(async (prompt) => {
            const openai = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY,
            });

            const completion = await openai.chat.completions.create({
              model: 'gpt-4o',
              temperature: 0,
              messages: [
                {
                  role: 'system',
                  content:
                    'You are an AI assistant helping a real estate investor generate an investment memo.',
                },
                {
                  role: 'user',
                  content: prompt,
                },
              ],
            });

            const responseMessage = completion.choices[0].message.content;
            return responseMessage;
          }),
        );

        if (conversation) {
          await this.conversationRepo.delete({
            conversationId: conversation.conversationId,
          });
          console.log('Deleted record');
          console.log(address, 'address >>>>>');
          const newConvo = this.conversationRepo.create({
            ...conversation,
            investmentMemo: responses,
            address,
          });
          await this.conversationRepo.save(newConvo);
        }

        // Combine all sections into a single detailed memo
        const fullMemo = responses
          .map((section, index) => {
            const sectionTitle = [
              'Property Overview',
              'Neighborhood Overview',
              'Local Attractions',
              'Transportation',
              'Job Market Overview',
              'Submarket Overview',
              'Demographic Overview',
            ][index];
            return `## ${sectionTitle}\n\n${section}`;
          })
          .join('\n\n');

        console.log(fullMemo, 'fullMemo');

        this.events.setMaxListeners(20);
        this.events.sendEventToClients(
          `generateMemo:${conversation?.conversationId}`,
          {
            message: `Memo Generated`,
            eventType: `generateMemo:${conversation?.conversationId}`,
          },
        );

        return `Here is the detailed investment memo for ${address}:\n\n${fullMemo}`;
      },
      {
        name: 'generate_investment_memo',
        // description:
        //   'Generate a detailed investment memo for a given address. ONLY call this tool when the user wants to generate investment memo and NOT conduct market research. Also DO NOT include any table with the result.',
        description:
          'Generate a detailed investment memo for a given address. The user might also need to include a rent roll or a t12 (although this data are optional). Always ask the user if they want to upload the documents before generating the memo.',

        schema: z.object({
          address: z
            .string()
            .describe('Property address to generate investment memo for.'),
          conversationId: z.number().describe('The current conversation ID'),
        }),
      },
    );
  }

  searchInternet() {
    return tool(
      async ({ query }) => {
        return `Conduct comprehensive market research, including rent comps and recent sales data using ${query}`;
      },
      {
        name: 'internet_search',
        description:
          'Conduct comprehensive market research, including rent comps and recent sales data.',
        schema: z.object({
          query: z.string().describe('The term to search for on the internet'),
        }),
      },
    );
  }

  readRentRollData() {
    return tool(
      async ({ conversationId }) => {
        const conversation = await this.conversationRepo.findOne({
          where: { id: parseInt(conversationId) },
        });

        if (!conversation) return `Error: Conversation not found.`;
        if (!conversation?.dealId)
          return `No deal associated with this conversation.`;

        const deal = await this.dealService.findOne(conversation?.dealId);
        if (!deal) return `Deal not found.`;

        const documents: Document[] =
          await this.documentService.findDealDocumentByType(
            deal?.id,
            DocumentTypeENUM.RENT_ROLL,
          );

        const doc = documents[0];

        if (!doc) {
          return `No rent roll document found. If recently uploaded, it may still be processing.`;
        }

        if (doc?.status === DocumentStatusENUM.POST_PROCESSING) {
          return `Rent roll document is still processing. Please try again in a few moments.`;
        }

        console.log(`The document ID is ${doc?.id}`);
        const summary = doc?.summary;
        if (summary) {
          return JSON.stringify({
            message:
              'Rent roll summary available.  Only use information from the JSON context below. Do not make up any information.',
            data: summary,
          });
        }

        if (doc?.postProcessedData?.data) {
          return JSON.stringify({
            message:
              'Rent roll data available.  Only use information from the JSON context below. Do not make up any information.',
            data: doc.postProcessedData.data,
          });
        }

        return JSON.stringify({
          status: 'error',
          message: 'No rent roll data available',
          data: null,
        });
      },
      {
        name: 'read_rentroll_data',
        description: `Fetches rent roll data for the current conversation. Only returns actual data when available. Do not invent or hallucinate any information. If data is not available or still processing, clearly communicate this to the user.`,
        schema: z.object({
          conversationId: z.string().describe('The current conversation ID'),
        }),
      },
    );
  }

  readRentRollDataForAnalysis() {
    return tool(
      async ({ conversationId }) => {
        const conversation = await this.conversationRepo.findOne({
          where: { id: parseInt(conversationId) },
        });

        const documents: Document[] =
          await this.documentService.findAllDocumentByConversation(
            conversation?.conversationId,
            DocumentTypeENUM.RENT_ROLL,
          );

        if (!documents || documents.length === 0) {
          return JSON.stringify({
            status: 'no_document',
            message:
              'Explicitly tell the user to please upload the document you will like to analyze. DO NOT PARAPHRASE YOUR WORLD',
            data: null,
          });
        }

        // const docsWithSummary = documents.filter((d) => d.summary !== null);

        // const doc =
        //   docsWithSummary.length > 0 ? docsWithSummary[0] : documents[0];

        const doc = documents[0];

        if (doc && !doc?.summary) {
          return `Explicitly tell the user that the rent roll document is still being processed and they should try again in a few minutes. Current Status: ${doc?.status} DO NOT PARAPHRASE YOUR WORLD`;
        }

        // if (doc?.status === DocumentStatusENUM.POST_PROCESSING) {
        //   return `Error: Rent roll document is still processing. Please try again in a few moments.`;
        // }

        console.log(`The document ID is ${doc?.id}`);
        const summary = doc?.summary;
        if (summary) {
          return JSON.stringify({
            message:
              'Rent roll summary available.  Only use information from the JSON context below. Do not make up any information.',
            data: summary,
          });
        }

        if (doc?.postProcessedData?.data) {
          return JSON.stringify({
            message:
              'Rent roll data available.  Only use information from the JSON context below. Do not make up any information.',
            data: doc.postProcessedData.data,
          });
        }

        return JSON.stringify({
          status: 'error',
          message: 'No rent roll data available',
          data: null,
        });
      },
      {
        name: 'read_rentroll_data_for_analysis',
        description: `Fetches rent roll data for the current conversation when the user is trying to analyse a document. Only returns actual data when available. Do not invent or hallucinate any information. If no rent roll data, always prompt the user to first upload the document.`,
        schema: z.object({
          conversationId: z.string().describe('The current conversation ID'),
        }),
      },
    );
  }

  readT12DataForAnalysis() {
    return tool(
      async ({ conversationId }) => {
        const conversation = await this.conversationRepo.findOne({
          where: { id: parseInt(conversationId) },
        });

        const documents: Document[] =
          await this.documentService.findAllDocumentByConversation(
            conversation?.conversationId,
            DocumentTypeENUM.T12,
          );

        if (!documents || documents.length === 0) {
          return JSON.stringify({
            status: 'no_document',
            message:
              'Explicitly tell the user to please upload the document you will like to analyze. DO NOT PARAPHRASE YOUR WORLD',
            data: null,
          });
        }

        const doc = documents[0];

        if (doc && !doc?.summary) {
          return `Explicitly tell the user that the t12 document is still being processed and they should try again in a few minutes. Current Status: ${doc?.status} DO NOT PARAPHRASE YOUR WORLD`;
        }

        if (doc?.status === DocumentStatusENUM.POST_PROCESSING) {
          return JSON.stringify({
            status: 'processing',
            message:
              'T12 document is still processing. Please try again in a few moments.',
            data: null,
          });
        }

        const summary = doc?.summary;
        if (summary) {
          return JSON.stringify({
            status: 'success',
            message:
              'T12 summary available.  Only use information from the JSON context below. Do not make up any information.',
            data: summary,
          });
        }

        if (doc?.postProcessedData?.data) {
          return JSON.stringify({
            status: 'success',
            message:
              'T12 data available.  Only use information from the JSON context below. Do not make up any information.',
            data: doc.postProcessedData.data,
          });
        }

        return JSON.stringify({
          status: 'error',
          message: 'No T12 data available',
          data: null,
        });
      },
      {
        name: 'read_t12_data_for_analysis',
        description: `Fetches T12 (Trailing 12 months) financial data for the current conversation. Only returns actual data when available. Do not invent or hallucinate any information. If no t12 data, prompt the user to upload the document.`,
        schema: z.object({
          conversationId: z.string().describe('The current conversation ID'),
        }),
      },
    );
  }

  readT12Data() {
    return tool(
      async ({ conversationId }) => {
        const conversation = await this.conversationRepo.findOne({
          where: { id: parseInt(conversationId) },
        });

        if (!conversation) return `Error: Conversation not found.`;
        if (!conversation?.dealId)
          return `Error: No deal associated with this conversation.`;

        const deal = await this.dealService.findOne(conversation?.dealId);
        if (!deal) return `Error: Deal not found.`;

        const documents: Document[] =
          await this.documentService.findDealDocumentByType(
            deal?.id,
            DocumentTypeENUM.T12,
          );

        const doc = documents[0];

        if (!doc) {
          return JSON.stringify({
            status: 'error',
            message:
              'No T12 document found. If recently uploaded, it may still be processing.',
            data: null,
          });
        }

        if (doc?.status === DocumentStatusENUM.POST_PROCESSING) {
          return JSON.stringify({
            status: 'processing',
            message:
              'T12 document is still processing. Please try again in a few moments.',
            data: null,
          });
        }

        const summary = doc?.summary;
        if (summary) {
          return JSON.stringify({
            status: 'success',
            message:
              'T12 summary available.  Only use information from the JSON context below. Do not make up any information.',
            data: summary,
          });
        }

        if (doc?.postProcessedData?.data) {
          return JSON.stringify({
            status: 'success',
            message:
              'T12 data available.  Only use information from the JSON context below. Do not make up any information.',
            data: doc.postProcessedData.data,
          });
        }

        return JSON.stringify({
          status: 'error',
          message: 'No T12 data available',
          data: null,
        });
      },
      {
        name: 'read_t12_data',
        description: `Fetches T12 (Trailing 12 months) financial data for the current conversation. Only returns actual data when available. Do not invent or hallucinate any information. If data is not available or still processing, clearly communicate this to the user.`,
        schema: z.object({
          conversationId: z.string().describe('The current conversation ID'),
        }),
      },
    );
  }

  screenDeal() {
    return tool(
      async ({}) => {
        return `To screen a deal, the user needs to create a deal. upload a rentroll and a t12.
        Use the defined tools to achieve this. From the user's message, try to extract the property address and deal name to create a new deal. If the user does not provide a deal name, try to make up a meaningful name from the address. Identify the different documents from their URL and attach the files and their type to deal.

        After a users uploaded their document, ask them if they want to attach the deal to a model. If yes, ask them which model they want to use then trying using the model id to attach the deal to that model. If the user dont have any model. Take them through the workflow of creating a model.
        `;
      },
      {
        name: 'screen_deal',
        description:
          'To screen a deal, the user needs to create a deal. upload a rentroll and a t12 ',
      },
    );
  }

  generateScratchPadData() {
    return tool(
      async ({ summary }) => {
        const tableData = await this.generateTableData(summary);

        return JSON.stringify({
          type: 'table',
          content: tableData,
        });
      },
      {
        name: 'generate_scratch_pad_data',
        description:
          'Generates scratch pad data (table) when appropriate based on the query and summary',
        schema: z.object({
          query: z.string().describe('The original user query'),
          summary: z
            .string()
            .describe('The summary response generated for the query'),
        }),
      },
    );
  }

  async generateTableData(summary: string): Promise<any> {
    // Define a function to parse Markdown table into a structured format
    function parseMarkdownTable(markdownTable: string): any {
      // Split the table into lines
      const lines = markdownTable.trim().split('\n');

      // Extract headers
      const headers = lines[0]
        .split('|')
        .map((header) => header.trim())
        .filter((header) => header);

      // Extract rows
      const rows = lines.slice(2).map((row) => {
        return row
          .split('|')
          .map((cell) => cell.trim())
          .filter((cell) => cell);
      });

      return {
        headers,
        rows,
      };
    }

    // Regular expression to detect Markdown table syntax
    const tableRegex =
      /\|\s*(.+?)\s*\|\s*(.+?)\s*\|\n\|\s*[-:]+\s*\|\s*[-:]+\s*\|\n([\s\S]*?)\n\n/s;
    const match = tableRegex.exec(summary);

    if (match) {
      // Extract Markdown table content
      const markdownTable = match[0];

      // Parse Markdown table into structured data
      const tableData = parseMarkdownTable(markdownTable);

      return tableData;
    }

    // Return null or an empty structure if no table is found
    return null;
  }

  attachFileToDeal() {
    return tool(
      async ({ dealId, documentName, url, fileType, userId }) => {
        console.log(`Attaching ${url} to ${dealId} | ${fileType}`);
        const docType =
          fileType === 'RentRoll'
            ? 'rent-roll'
            : fileType === 'T12'
            ? 'trailing-12'
            : fileType;

        const document = await this.documentService.create({
          documentName,
          fileType: docType,
          status: DocumentStatusENUM.UPLOADED,
          userId,
          dealId,
          inputFileURL: url,
        });

        this.documentService.attachMetaToDocument(document);

        this.extractSaveDocumentData(dealId, document.id, url, docType);

        return `Attached document to the deal ${document.id}. Extract the document and show  the analysis to the user. Only analyze the the numbers`;
      },
      {
        description:
          'Attach uploaded file to a deal. File type can be any of the following rent-roll, trailing-12, OM, costar or others. Please upload the file.',
        name: 'attach_file_to_deal',
        schema: z.object({
          documentName: z.string().describe('The name of the file'),
          dealId: z.number().describe('The deal ID'),
          url: z
            .string()
            .describe(
              'The file URL. THis would be gotten after the user uploads the file',
            )
            .optional(),
          fileType: z.string().describe('The file type'),
          userId: z.string().describe('The signed in USER ID'),
        }),
      },
    );
  }

  getADeal() {
    return tool(
      async ({ dealId, userId }) => {
        console.log(`Finding Deal with ID ${dealId} for user ${userId}`);
        const deal = await this.dealService.findOne(dealId);

        if (!deal) {
          return `Deal not found`;
        }

        return JSON.stringify(deal);
      },
      {
        name: 'get_one_deal_for_user',
        description: 'Get a deal for the user',
        schema: z.object({
          dealId: z.number().describe('The ID of the deal to find'),
          userId: z.string().describe('The ID of the user'),
        }),
      },
    );
  }

  getAllDeals() {
    return tool(
      async ({ userId }) => {
        await this.dealService.findAll(userId);
        return `All deals returned successfully`;
      },
      {
        description:
          'Get the list of all deals created by the users organization',
        name: 'get_users_deal',
        schema: z.object({
          userId: z.string().describe('The signed in USER ID'),
        }),
      },
    );
  }

  createADeal() {
    return tool(
      async ({ dealName, propertyAddress, userId, conversationId }) => {
        console.log(
          `Creating a deal with #${dealName} and ${propertyAddress} for user with id #${userId}`,
        );
        const user = await this.userService.findOne(userId);
        const property = await this.propertyService.findOneByNameOrCreate(
          propertyAddress,
          dealName,
        );
        const convo = await this.conversationRepo.findOne({
          where: { id: conversationId },
        });

        const deal = await this.dealService.create({
          propertyId: property?.id,
          dealAddress: propertyAddress,
          dealName: dealName,
          userId: user?.id,
          activeModelSyncId: null,
          organizationId: user?.organizationId,
          conversationId: convo.conversationId,
          meta: {
            model: {
              microsoft: {},
              s3URL: '',
            },
          },
        });

        console.log(`The DEALLLLL IDDDDD: ${deal?.id}`);

        // this.conversationService
        //   .findOneByIdOrUUID(`${conversationId}`)
        //   .then((data) => {
        //     data.dealId = deal?.id;
        //     this.conversationService.update(data.id, data);
        //   });

        await this.conversationRepo.delete(convo.id);

        const lll = this.conversationRepo.create({ ...convo, dealId: deal.id });
        await this.conversationRepo.save(lll);

        return `To screen a deal, the user needs to create a deal. upload a rentroll and a t12. After creating a deal, ask the user if they want to attach the deal to one of the list of models they have uploaded. The user can optionally attach the deal to a model from the list of models they have uploaded. The deal ID is ${deal?.id}. show the deal id to the user.`;
      },
      {
        name: 'create_deal',
        description: 'Create a deal',
        schema: z.object({
          dealName: z.string().describe('The name of the deal'),
          propertyAddress: z
            .string()
            .describe('The address of the property to underwrite'),
          userId: z
            .string()
            .describe(
              'This user ID is part of the auth data used by system. Do not tell the user when this is missing. Just tell them they need to be authenticated',
            ),
          conversationId: z.number().describe('The current conversation ID'),
        }),
      },
    );
  }

  createAModel() {
    return tool(
      async ({
        modelName,
        modelDocumentURL,
        documentName,
        userId,
        conversationId,
      }) => {
        console.log(
          `Creating a model with #${modelName}, ${documentName} and ${modelDocumentURL} for user with id #${userId}`,
        );

        console.log(conversationId, 'conversationId');

        const meta: any = {};
        const modelMSGraphURL = '';

        const conversation = await this.conversationService.findOneByIdOrUUID(
          conversationId,
        );

        const model = await this.modelService.createModelHandler(
          {
            modelName,
            modelDocumentURL,
            documentName,
            isDefault: false,
            meta,
            modelMSGraphURL,
            conversationId: conversation?.conversationId,
          },
          userId,
        );

        // return `To create a model, the user has to upload the file, if uploaded, the modelDocumentURL and documentName would be passed along with the user's query and also provide the modelName. Only asks for the model name and tell the user to upload the model. The modelDocumentURL and documentName would come with the users query. The model Id is ${model.id}`;
        return `Model created successfully with ID ${model.id}. Show the model ID. Ask the user if they want to check for some metrics in the created mode or Ask the user if they have specific benchamark metrics they want to track for this model.
        Some example metrics are IRR < 15%, Net Profit > 20000000 Exit Cap Rate > 4 etc.
        
        Note: If you are in a deal screening workflow and a deal has been created, automatically attach the deal to this model`;
      },
      {
        name: 'create_model',
        description: 'Create a Model. Please uppload the model document',
        schema: z.object({
          modelName: z.string().describe('The name of the model'),
          documentName: z
            .string()
            .describe(
              'The name of the model document that was uplaoded which will likely be part of the users query',
            ),
          modelDocumentURL: z
            .string()
            .describe(
              'The model document URL will be part of the query provided by the user if they upload a document.',
            )
            .optional(),
          userId: z
            .string()
            .describe(
              'This user ID is part of the auth data used by system. Do not tell the user when this is missing. Just tell them they need to be authenticated',
            ),
          conversationId: z
            .string()
            .describe(
              'The current conversation conversationId. The format is a UUID',
            ),
        }),
      },
    );
  }

  getModelBenchmarkCells() {
    return tool(
      async ({ modelId }) => {
        const model = await this.modelService.getOne(modelId);

        if (!model) return `Model not found`;

        const workbookJSON = model?.meta?.model?.workbookJSON;

        if (!workbookJSON)
          return `There is not model Data. Model might still be extracting. Please try again. This is not an issue.`;

        const parsedData =
          this.utilitiesService.transformExcelData(workbookJSON);

        const res = await this.llmService.findMetricsInModel(`${parsedData}`);

        return res;
      },
      {
        name: 'get_model_benchmarks',
        description: "Get the model's benchmarks",
        schema: z.object({
          modelId: z.number().describe('This model ID'),
        }),
      },
    );
  }

  createModelBenchmarks() {
    return tool(
      async ({ metrics, modelId }) => {
        const model = await this.modelService.findOneById(
          parseInt(String(modelId)),
        );

        await this.modelService.addBenchmarks(metrics, model);
        return `Benchmark metrics created successfully. Here are your metrics ${metrics}`;
      },
      {
        name: 'create_model_metrics',
        description:
          'Create the benchmark metrics for the model. Do not make up the values. The user must provide you with the values ',
        schema: z.object({
          modelId: z.number().describe('The model ID'),
          metrics: z.array(
            z.object({
              name: z.string().describe('The metric name, e.g XIRR').nonempty(),
              isRequired: z.boolean().optional(), // Optional boolean value
              condition: z.string().nonempty(),
              value: z.string().nonempty(),
              format: z.string().nonempty(),
              max: z.string().optional(),
            }),
          ),
        }),
      },
    );
  }

  getUserAuthenticationData() {
    return tool(
      async ({ dealName, propertyAddress }) => {
        return `Return the user's authentication data from the query. This includes userId, email, organizationId if it is provided under the #AUTHDATA section
        `;
      },
      {
        name: 'extract_auth_data',
        description: 'Help',
        schema: z.object({
          dealName: z
            .string()
            .describe('The term to search for on the internet'),
          propertyAddress: z
            .string()
            .describe('The term to search for on the internet'),
        }),
      },
    );
  }

  readAcquisitionModel() {
    return tool(
      async ({ modelId, userId, query }) => {
        const indexName = `modelindex_${userId}_${modelId}`.replaceAll(
          '-',
          '_',
        );
        // let index = await this.zepService.getCollction(indexName);
        console.log('Trying to understand Acquisition model>>> ', modelId);
        const model = await this.modelService.findOne(modelId, userId);
        if (!model) {
          return `Could not find the selected model`;
        }
        const workbookJSON = model?.meta?.model?.workbookJSON;

        if (!workbookJSON) {
          return `Model data has not been extracted. Try again after 30 seconds. This is not an issue`;
        }

        return JSON.stringify(
          this.utilitiesService.transformExcelData(workbookJSON),
        );
      },
      {
        name: 'read_acquisition_model',
        description: `Read the parsed CRE acquisition model data and return location of query data.`,
        schema: z.object({
          modelId: z.number().describe('The model ID'),
          userId: z.string().describe('The signed in user ID'),
          query: z
            .string()
            .describe('The data the agent is looking for in the model'),
        }),
      },
    );
  }

  async summarizeOfferingMemorandum() {
    console.log('Summarizing Offering memorandum');
    // const text = await this.utilitiesService.extractPDFFromURL(
    //   ' https://chinedu-copilot-upload.s3.amazonaws.com/costar-warehouseloft.pdf',
    // );

    // const embeddings = new OpenAIEmbeddings();

    // const embedded = await embeddings.embedDocuments([text]);

    // const vector = this.vectorService.vectorizeText(text);

    return tool(
      async () => {
        return `Offering memorandum context:`;
      },
      {
        name: 'summarize_offering_memorandum',
        description: 'Summarize an offering memorandum',
      },
    );
  }

  injectTextAsVector() {
    return tool(
      async ({ text, metadata }) => {
        try {
          const vector = await this.vectorService.vectorizeText(text);
          await this.vectorService.storeVector(vector, metadata);
          const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
          });
          const docs = await textSplitter.createDocuments([text]);
          return `Text has been successfully injected as vector content.`;
        } catch (error) {
          return `Failed to inject text as vector content: ${error.message}`;
        }
      },
      {
        name: 'inject_text_as_vector',
        description:
          'Injects a large text as vector content with optional metadata',
        schema: z.object({
          text: z
            .string()
            .describe('The large text to be vectorized and stored'),
          metadata: z
            .object({})
            .optional()
            .describe('Optional metadata to store with the vector'),
        }),
      },
    );
  }

  async extractSaveDocumentData(
    dealId: number,
    documentId: number,
    url: string,
    docType: string,
  ) {
    let data = null;
    if (docType == 'rent-roll') {
      console.log('Attaching data for RR.....');
      try {
        if (url.endsWith('.pdf')) {
          data = await this.utilitiesService.extractPDFFromURL(url);
        } else if (url.endsWith('.xlsx')) {
          const buffer = await axios.get<Buffer>(url, {
            responseType: 'arraybuffer',
          });
          data = this.extractTextFromExcel(buffer.data);
        }

        this.llmService.extractRRData(data, docType);
      } catch (error) {}
    }
  }
}
