import { Injectable } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticSearchService {
  private client: any;

  constructor() {
    this.initElasticsearch();
  }

  private async initElasticsearch() {
    this.client = new Client({
      cloud: {
        id: process.env.ELASTIC_CLOUD_ID,
      },
      auth: {
        apiKey: process.env.ELASTIC_API_KEY,
      },
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.ml.inferTrainedModel({
        modelId: '.elser_model_1',
        docs: [{ text }],
      });

      console.log('ELSER response:', JSON.stringify(response, null, 2));

      if (
        response &&
        response.inference_results &&
        response.inference_results.length > 0
      ) {
        const predictedValue = response.inference_results[0].predicted_value;
        if (Array.isArray(predictedValue)) {
          return predictedValue;
        } else {
          console.error('Unexpected predicted_value format:', predictedValue);
          throw new Error('Unexpected embedding format');
        }
      } else {
        console.error('Unexpected ELSER response format:', response);
        throw new Error('No embedding generated');
      }
    } catch (error) {
      console.error('Error generating ELSER embedding:', error);
      throw error;
    }
  }

  async searchSimilarDocuments(text: string, index: string, size: number = 5) {
    try {
      const embedding = await this.generateEmbedding(text);

      const response = await this.client.search({
        index,
        body: {
          query: {
            script_score: {
              query: { match_all: {} },
              script: {
                source:
                  "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                params: { query_vector: embedding },
              },
            },
          },
          size,
        },
      });

      return response.hits.hits;
    } catch (error) {
      console.error('Error searching similar documents:', error);
      throw error;
    }
  }

  async indexDocument(index: string, document: any): Promise<any> {
    try {
      const response = await this.client.index({
        index,
        body: document,
      });
      return response;
    } catch (error) {
      console.error('Error indexing document:', error);
      throw error;
    }
  }
}
