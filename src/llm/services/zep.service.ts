import { Injectable } from '@nestjs/common';
import { ZepClient, ZepError } from '@getzep/zep-cloud';
import {
  ZepChatMessageHistory,
  ZepVectorStore,
} from '@getzep/zep-cloud/langchain';
import { Message } from '@getzep/zep-cloud/api';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class ZepService {
  private zepClient: ZepClient;
  private vectorStore: ZepVectorStore;
  constructor() {
    this.zepClient = new ZepClient({
      apiKey: process.env.ZEP_API_KEY,
    });
  }

  async getVectorStore(collectionName = 'copilot') {
    return await ZepVectorStore.init({
      client: this.zepClient,
      collectionName,
    });
  }

  async getSession(sessionId: string) {
    return await this.zepClient.memory.get(sessionId);
  }
  async getSessionMessages(sessionId: string) {
    const session = await this.getSession(sessionId);
    return session.messages;
  }

  async addMessageToSession(sessionId: string, messages: Message[]) {
    return await this.zepClient.memory.add(sessionId, { messages });
  }

  async createSession(sessionId: string, user: User) {
    const zepUser = await this.getZepUser(user?.id);
    if (zepUser?.statusCode && parseInt(zepUser?.statusCode) === 404) {
      await this.addZepUser(user);
    }
    return await this.zepClient.memory.addSession({
      sessionId,
      userId: user?.id,
    });
  }

  async getUserSession(userId: string) {
    return await this.zepClient.user.getSessions(userId);
  }

  async getZepUser(userId: string) {
    try {
      return await this.zepClient.user.get(userId);
    } catch (error) {
      console.log('ERRRRRR', error.message);
      return error;
    }
  }

  async addZepUser(user: User) {
    return await this.zepClient.user.add({
      userId: user?.id,
      firstName: user?.firstName,
      lastName: user?.lastName,
      email: user?.email,
    });
  }
  async createDocumentCollection(collectionName: string) {
    try {
      return await this.zepClient.document.addCollection(collectionName);
    } catch (error) {
      console.error(`Error creating document collection: ${error.message}`);
      throw error;
    }
  }

  async addDocumentToCollection(
    collectionName: string,
    document: string,
    metadata: Record<string, any> = {},
  ) {
    try {
      return await this.zepClient.document.addDocuments(collectionName, [
        {
          content: document,
          metadata: metadata,
        },
      ]);
    } catch (error) {
      console.error(`Error adding document to collection: ${error.message}`);
      throw error;
    }
  }

  async addLargeTextToCollection(
    collectionName: string,
    largeText: string,
    chunkSize: number = 200,
  ) {
    try {
      // Check if collection exists, if not create it
      try {
        await this.zepClient.document.getCollection(collectionName);
      } catch (error) {
        if (error.response && error.response.status === 404) {
          await this.createDocumentCollection(collectionName);
        } else {
          throw error;
        }
      }

      // Split the large text into chunks
      const chunks = [];
      for (let i = 0; i < largeText.length; i += chunkSize) {
        chunks.push(largeText.slice(i, i + chunkSize));
      }

      // Add each chunk as a separate document
      for (let i = 0; i < chunks.length; i++) {
        await this.addDocumentToCollection(collectionName, chunks[i], {
          chunkIndex: i,
        });
      }

      console.log(
        `Successfully added ${chunks.length} chunks to collection ${collectionName}`,
      );
    } catch (error) {
      console.error(`Error adding large text to collection: ${error.message}`);
      throw error;
    }
  }

  async getCollection(collectionName: string) {
    try {
      return await this.zepClient.document.getCollection(collectionName);
    } catch (error) {
      return null;
    }
  }

  async searchCollection(collectionName: string, query: string) {
    let results = await this.zepClient.document.search(collectionName, {
      text: query,
      limit: 5,
    });

    return results;
  }

  async addTextToCollection(conversationId: string, data: string) {}
}
