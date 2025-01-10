import { OpenAIEmbeddings } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Deal } from 'src/deal/entities/deal.entity';
import { Repository } from 'typeorm';
import { Document } from 'src/document/entities/document.entity';
import { getSummary } from 'src/utilities/services/utilities.service';
import { PromptTemplate } from '@langchain/core/prompts';
import { Redis } from '@upstash/redis';
import { ChatAnthropic } from '@langchain/anthropic';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LangchainService {
  private redisCache: any;

  constructor(
    @InjectRepository(Document) private documentRepo: Repository<Document>,
    @InjectRepository(Deal) private dealRepo: Repository<Deal>,
  ) {
    this.redisCache = new Redis({
      url: 'https://related-primate-53100.upstash.io',
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  logWithTimestamp(message: string) {
    const now = new Date();
    const timestamp = now.toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async getCachedVectorStore(dealId: string) {
    this.logWithTimestamp('Getting cached vector store >>>>>>>>>>>>');
    const docs = await this.redisCache.get(`vectorStore_deal_${dealId}`);

    if (docs) {
      // Check if docs is a JSON string and parse it
      let documentsArray;
      if (typeof docs === 'string') {
        documentsArray = JSON.parse(docs);
      } else {
        documentsArray = docs;
      }

      return await FaissStore.fromDocuments(
        documentsArray,
        new OpenAIEmbeddings({
          apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        }),
      );
    }

    return null;
  }

  async addDocumentToVectorStore(dealId: string, docs: any): Promise<void> {
    this.logWithTimestamp('Adding document to vector store >>>>>>>>>>>>');

    // Split the PDF document
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 5000,
      chunkOverlap: 500,
    });
    const docOutput = await splitter.splitDocuments(docs);

    // Get the existing vector store
    let vectorStore = await this.getCachedVectorStore(dealId);

    if (!vectorStore) {
      // If no existing vector store, create a new one
      vectorStore = await FaissStore.fromDocuments(
        docOutput,
        new OpenAIEmbeddings({
          apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        }),
      );
    } else {
      await vectorStore.addDocuments(docOutput);
    }

    await this.cacheVectorStore(dealId, vectorStore);

    this.logWithTimestamp(
      'Finished adding document to vector store >>>>>>>>>>>>',
    );
  }

  async cacheVectorStore(dealId: string, docs: any): Promise<void> {
    this.logWithTimestamp('Caching the vector store >>>>>>>>>>>>');
    await this.redisCache.set(
      `vectorStore_deal_${dealId}`,
      JSON.stringify(docs),
    );
  }

  async getDocumentVectors(document: any[]) {
    return document
      .filter((doc) => doc.meta.vectorDocument !== undefined)
      .flatMap((doc) => doc.meta.vectorDocument);
  }

  async saveFaissStore(dealId: string, vectorStore: FaissStore) {
    const faissIndexPath = path.join(
      __dirname,
      `vector/faiss_index_${dealId}.bin`,
    );
    await vectorStore.save(faissIndexPath);
  }

  async loadFaissStore(dealId: string): Promise<FaissStore> {
    const faissIndexPath = path.join(
      __dirname,
      `vector/faiss_index_${dealId}.bin`,
    );

    const vectorStore = await FaissStore.load(
      faissIndexPath,
      new OpenAIEmbeddings(),
    );

    return vectorStore;
  }

  async langchainQA(body: any) {
    const { query, dealId } = body;

    this.logWithTimestamp('Pulling deals and documents >>>>>>>>>>>>');
    // Fetch documents and deal information in parallel
    const [documents, deal] = await Promise.all([
      this.documentRepo.find({ where: { dealId } }),
      this.dealRepo.findOne({
        where: { id: dealId },
        relations: ['activeModel', 'property'],
      }),
    ]);

    const documentVectors = await this.getDocumentVectors(documents);

    this.logWithTimestamp('Finished pulling deals and documents >>>>>>>>>>>>');

    // Fetch summaries
    const rentRoll = getSummary(documents, 'rent-roll');
    const trailing12 = getSummary(documents, 'trailing-12');

    // Split the PDF document
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 5000,
      chunkOverlap: 500,
    });

    this.logWithTimestamp('Creating document >>>>>>>>>');
    const rr = await splitter.createDocuments([JSON.stringify(rentRoll)]);
    const t12 = await splitter.createDocuments([JSON.stringify(trailing12)]);
    const dealData = await splitter.createDocuments([JSON.stringify(deal)]);

    this.logWithTimestamp('Finished Creating document >>>>>>>>>');

    // let vectorStore: FaissStore = await this.loadFaissStore(String(deal.id));

    // if (!vectorStore) {
    //   vectorStore = await FaissStore.fromDocuments(
    //     [...dealData, ...documentVectors, ...rr, ...t12],
    //     new OpenAIEmbeddings({
    //       apiKey: process.env.OPENAI_API_KEY,
    //     }),
    //   );

    //   // Save the FaissStore to disk
    //   await this.saveFaissStore(String(deal?.id), vectorStore);
    // } else {
    //   console.log('Side 2>>>>>>>>');
    //   vectorStore = await this.loadFaissStore(String(deal?.id));
    // }

    const vectorStore = await FaissStore.fromDocuments(
      [...dealData, ...documentVectors, ...rr, ...t12],
      new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY,
      }),
    );

    this.logWithTimestamp('Getting relevant document >>>>>>>>>>>>');
    // Initialize retriever
    const retriever = vectorStore.asRetriever();
    const relevantDocs = await retriever._getRelevantDocuments(query);

    this.logWithTimestamp('Finished getting relevant document >>>>>>>>>>>>');

    // Get metadata such as the page number
    const pageMetadata = relevantDocs.map((doc) => doc.metadata);

    // Fetch the chat history and ensure it's an array of objects
    const chatHistory = deal.chatHistory || [];

    // Create the question prompt
    const questionPrompt = PromptTemplate.fromTemplate(
      `You are a helpful assistant, please provide information about {question} in the context of the document:. Take your time to go through the question and the context before coming up with a response. If you don't know the answer and cant find it in the context, reply politely that you do not have that information available and cant only respond to questions on this current deal, don't try to make up an answer. When the user greets you, respond kindly and ask them how you may be able to help them today.
      ----------------
      CONTEXT: {context}
      ----------------
      QUESTION: {question}
      ----------------
      DOCUMENTS: {documents}
      ----------------
      RENT ROLL: {rentRoll}
      ----------------
      TRAILING 12: {t12}
      ----------------
      CHAT HISTORY: {chatHistory}
      ----------------
      INSTRUCTION: DO NOT INCLUDE the word 'context' and 'based on the information provided' in your response. Just go straight to answering the users question.
      ----------------
      Helpful Answer:`,
    );

    // ANTHROPIC_API_KEY

    // Initialize chat model
    // const chatModel = new ChatOpenAI({
    //   model: 'gpt-4o',
    //   apiKey: process.env.OPENAI_API_KEY,
    //   temperature: 0.5,
    //   maxTokens: 2480,
    //   verbose: true,
    // });

    // const chatModel = new ChatMistralAI({
    //   apiKey: '',
    //   model: 'open-mixtral-8x22b',
    //   maxTokens: 1240,
    //   temperature: 0.5,
    // });

    const chatModel: any = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet-20240620',
      maxTokens: 2000,
      temperature: 0.3,
    });

    this.logWithTimestamp('Running the runnable sequence >>>>>>>>>>>>');
    // Create the RunnableSequence with the chat history
    const chain = RunnableSequence.from([
      {
        question: () => query,
        context: () => JSON.stringify(relevantDocs),
        rentRoll: () => JSON.stringify(rentRoll),
        t12: () => JSON.stringify(trailing12),
        documents: () => JSON.stringify(documentVectors),
        chatHistory: () => JSON.stringify(chatHistory),
      },
      questionPrompt,
      chatModel,
      new StringOutputParser(),
    ]);

    this.logWithTimestamp('Finished runnable sequemce >>>>>>>>>>>>');

    this.logWithTimestamp('Getting result from model >>>>>>>>>>>>');
    const result = await chain.invoke({ question: query });

    this.logWithTimestamp('Finished getting result from model >>>>>>>>>>>>');

    // Append the new query and response as an object to the chat history
    chatHistory.push({
      user: query,
      ai: result,
      sessionId: `id_${Date.now()}`,
      timestamp: new Date(),
    });

    // Update the deal entity with the new chat history
    deal.chatHistory = chatHistory;
    await this.dealRepo.save(deal);

    return {
      status: 200,
      result,
      metadata: {
        pages: pageMetadata,
      },
    };
  }
}
