// import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { CommaSeparatedListOutputParser } from '@langchain/core/output_parsers';

export const BASIC_LIST_PARSER = new CommaSeparatedListOutputParser();

export const CATEGORIZE_T12_LINE_ITEMS_TEMPLATE =
  ChatPromptTemplate.fromTemplate(
    `Based on the given values {input} seperated by the pipe symbol (|), find the items that identify a group seperated by comma`,
  );
