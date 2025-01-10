import { Injectable } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { OPENAI_VECTOR_DIMENSION } from 'src/utilities/constants';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PineconeService {
  private pinecone;

  constructor() {
    this.initPinecone();
  }

  private async initPinecone() {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }

  async upsertVector(indexName: string, vectors: any[]) {
    const indexExist = await this.getIndex(indexName);

    if (!indexExist) {
      await this.createIndex(indexName, OPENAI_VECTOR_DIMENSION);
    }
    const index = this.pinecone.Index(indexName);
    return await index.upsert(vectors);
  }

  async queryVector(indexName: string, vector: number[], topK: number = 5) {
    const index = this.pinecone.Index(indexName);
    const queryRequest = {
      vector,
      topK,
      includeMetadata: true,
    };
    const queryResponse = await index.query(queryRequest);
    return queryResponse.matches;
  }

  async searchSimilarStrings(
    indexName: string,
    searchString: string,
    topK: number = 5,
  ): Promise<any[]> {
    try {
      // Generate embedding for the search string
      const searchEmbedding = await this.generateEmbedding(searchString);

      // Query the vector database
      const results = await this.queryVector(indexName, searchEmbedding, topK);

      // Extract and return the content from the metadata
      return results.map((result) => ({
        content: result.metadata.content,
        score: result.score,
      }));
    } catch (error) {
      console.error('Error searching similar strings:', error);
      throw error;
    }
  }

  async getIndex(indexName: string) {
    try {
      const index = this.pinecone.Index(indexName);
      const indexStats = await index.describeIndexStats();
      return {
        name: indexName,
        stats: indexStats,
      };
    } catch (error) {
      return null;
      console.error(`Error getting index ${indexName}:`, error);
      throw new Error(`Failed to get index ${indexName}`);
    }
  }

  async deleteVector(indexName: string, id: string) {
    const index = this.pinecone.Index(indexName);
    await index.delete1({ ids: [id] });
  }

  async saveStringAsVector(
    collectionId: string,
    content: string,
    chunkSize: number = 1000,
  ) {
    const chunks = this.splitTextIntoChunks(content, chunkSize);
    const vectors = [];

    for (const chunk of chunks) {
      const embedding = await this.generateEmbedding(chunk);
      vectors.push({
        id: uuidv4(),
        values: embedding,
        metadata: { content: chunk },
      });
    }

    return await this.upsertVector(collectionId, vectors);
  }

  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = '';

    for (const word of words) {
      if ((currentChunk + ' ' + word).length <= chunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + word;
      } else {
        chunks.push(currentChunk);
        currentChunk = word;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  }

  async createIndex(indexName: string, dimension: number) {
    await this.pinecone.createIndex({
      name: indexName,
      dimension,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
    });
  }

  async deleteIndex(indexName: string) {
    await this.pinecone.deleteIndex({ indexName });
  }

  async listIndexes() {
    return await this.pinecone.listIndexes();
  }
}
