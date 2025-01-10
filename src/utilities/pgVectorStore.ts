import { PoolConfig } from 'pg';
import {
  DistanceStrategy,
  PGVectorStore,
} from '@langchain/community/vectorstores/pgvector';
import { OpenAIEmbeddings } from '@langchain/openai';

const config = {
  postgresConnectionOptions: {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  } as PoolConfig,
  tableName: 'fincasa_vectore_store',
  columns: {
    idColumnName: 'id',
    vectorColumnName: 'vector',
    contentColumnName: 'content',
    metadataColumnName: 'metadata',
    dealIdColumnName: 'dealId',
  },
  distanceStrategy: 'cosine' as DistanceStrategy,
};

export const pgvectorStore = async () => {
  return await PGVectorStore.initialize(new OpenAIEmbeddings(), config);
};
