import { Injectable } from '@nestjs/common';
import weaviate, {
  WeaviateClient,
  vectorizer,
  generative,
} from 'weaviate-client';

@Injectable()
export class WeaviateService {
  private client: WeaviateClient;

  constructor() {
    this.initWeaviate();
  }

  private async initWeaviate() {
    this.client = await weaviate.connectToWeaviateCloud(
      'https://jeoj0alssfycakfaqrebw.c0.us-east1.gcp.weaviate.cloud',

      {
        authCredentials: new weaviate.ApiKey(
          'uGFzWxmEUoSrR4b1snuUkytMqv7O8sOm0JkC',
        ),

        headers: { 'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY },
      },
    );
  }

  //   async indexText(className: string, text: string, properties: object = {}) {
  //     try {
  //       const result = await this.client.data
  //         .creator()
  //         .withClassName(className)
  //         .withProperties({
  //           content: text,
  //           ...properties,
  //         })
  //         .do();
  //       return result;
  //     } catch (error) {
  //       console.error('Error indexing text:', error);
  //       throw error;
  //     }
  //   }

  //   async searchSimilarTexts(
  //     className: string,
  //     searchText: string,
  //     limit: number = 5,
  //   ) {
  //     try {
  //       const result = await this.client.graphql
  //         .get()
  //         .withClassName(className)
  //         .withFields(['content', '_additional {certainty}'])
  //         .withNearText({ concepts: [searchText] })
  //         .withLimit(limit)
  //         .do();
  //       return result.data.Get[className];
  //     } catch (error) {
  //       console.error('Error searching similar texts:', error);
  //       throw error;
  //     }
  //   }

  async createCollection() {
    const questions = await this.client.collections.create({
      name: 'Question',
      vectorizers: vectorizer.text2VecOpenAI(),
      generative: generative.openAI(),
    });
    console.log(`Collection ${questions.name} created!`);
  }

  async importQuestions(dt: any) {
    // Get the questions directly from the URL
    const questions = this.client.collections.get('Question');
    const data = dt;
    // const data = await getJsonData();
    const result = await questions.data.insertMany(data);
    console.log('We just bulk inserted', result);
  }
}
