import { Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

@Injectable()
export class VectorService {
  private openai: OpenAI;
  private pinecone: Pinecone;
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.pinecone = new Pinecone();
    // this.pinecone.init({
    //   apiKey: process.env.PINECONE_API_KEY,
    //   environment: process.env.PINECONE_ENVIRONMENT,
    // });
  }

  async vectorizeText(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      if (response.data && response.data.length > 0) {
        return response.data[0].embedding;
      } else {
        throw new Error('Failed to generate embedding');
      }
    } catch (error) {
      throw new Error(`Error in vectorizing text: ${error.message}`);
    }
  }

  async storeVector(vector: number[], metadata: any): Promise<void> {
    try {
      // Assuming you have a database or storage service to store the vector and metadata
      // Replace the following line with actual storage logic
      console.log('Storing vector:', vector);
      console.log('With metadata:', metadata);
      const index = this.pinecone.Index('your-index-name'); // Replace with your Pinecone index name

      const upsertRequest = {
        vectors: [
          {
            id: metadata.id, // Ensure each vector has a unique ID
            values: vector,
            metadata: metadata,
          },
        ],
      };

      //   await index.upsert({ upsertRequest });
      // Example: Save to a database
      // await this.databaseService.saveVector({ vector, metadata });
    } catch (error) {
      throw new Error(`Error in storing vector: ${error.message}`);
    }
  }
}
