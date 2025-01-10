import { Injectable, Logger } from '@nestjs/common';
import {
  RENTROLL_COLUMN_NAME_SYSTEM_PROMPT,
  RENT_ROLL_COL_NAME_AND_INDEX_SYSTEM_PROMPT,
  RENTROLL_COLUMN_INDUSTRIAL_SYSTEM_PROMPT,
  SIMPLE_INVESTMENT_MEMO_PROMPT_GENERATION,
  ANALYSIS_DATA_PROMPT,
  SPLIT_COLUMN_PROMPT,
  OPERATING_STATEMANT_ENTRIES_CATEGORY_SYSTEM_PROMPT,
  GENERATE_DEAL_NAME_FROM_EMAIL_SUBJECT_PROMPT,
  GENERATE_DOCUMENT_TYPE_FROM_EMAIL_ATTACHMENT_PROMPT,
  GENERATE_EMAIL_PROPERTY_ADDRESS_PROMPT,
} from './gpt.prompt';
import Configuration from 'openai';
import OpenAI from 'openai';
import { RentRollColumSample } from './types/rent-roll-col-sample.interface';
import { PredictedRentRollColumSample } from './types/predicted-rent-roll-col-sample.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PROPERTY_OVERVIEW,
  NEIGHNORHOOD_OVERVIEW,
  LOCAL_ATTRACTIONS,
  TRANSPORTATION,
  JOBMARKET_OVERVIEW,
  SUBMARKET_OVERVIEW,
  DEMOGRAPHIC_OVERVIEW,
  IMPROVE_WRITING,
  LENGTHEN_WRITING,
  SHORTEN_WRITING,
  SIMPLIFY_WRITING,
  PROCESS_INPUT,
} from './gpt.prompt';
import { Deal } from 'src/deal/entities/deal.entity';
import { RawSummaryItemInterface } from 'src/document/interfaces/document.entitiy.interfaces';
import { UtilitiesService } from 'src/utilities/services/utilities.service';

@Injectable()
export class GptService {
  private readonly logger = new Logger(GptService.name);
  private openai: OpenAI;
  private retryLimit = 3;
  constructor(
    @InjectRepository(Deal) private dealsRepo: Repository<Deal>,
    private utilitiesService: UtilitiesService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateSimpleInvestmentMemoTemplate(data: any) {
    let message: string | null = null;
    let retries = 0;
    const userPrompt = SIMPLE_INVESTMENT_MEMO_PROMPT_GENERATION(data.address);

    while (!message && retries < this.retryLimit) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });
        const responseMessage = completion.choices[0].message.content;
        if (responseMessage !== "I'm sorry, but I can't assist with that.") {
          message = responseMessage;
        }
      } catch (error) {
        if (retries === this.retryLimit - 1) {
          console.log(error);
        }
      }
      retries++;
    }

    if (!message) {
      console.log(
        'Could not generate investment memo template for address:\n',
        data.address,
      );
      message = 'Unable to generate deal memo for this address';
    }

    const deal = await this.dealsRepo.update(
      { id: data.dealId },
      { investmentMemo: [`${message}`] },
    );

    return deal;
  }

  async predictHeadersAndIndex(userPrompt: string, dealType: string) {
    let message: string | null = null;
    let retries = 0;

    let finalPrompt: string | null = null;

    if (String(dealType).toLowerCase() === 'industrial') {
      finalPrompt = RENTROLL_COLUMN_INDUSTRIAL_SYSTEM_PROMPT;
    } else {
      finalPrompt = RENT_ROLL_COL_NAME_AND_INDEX_SYSTEM_PROMPT;
    }

    while (!message && retries < this.retryLimit) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: finalPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });
        message = completion.choices[0].message.content;
      } catch (error) {
        if (retries === this.retryLimit - 1) {
        }
        retries++;
      }
    }

    if (!message) {
      console.log('Could not predict headers and index for ', userPrompt);
      throw new Error();
    }

    return {
      strForm: message,
      objForm: message
        .split('\n')
        .map((line) => line.split('|').map((word) => word.trim())),
    };
  }

  async predictRentRollNormalizedColumns(
    rentRollColSamples: RentRollColumSample[],
  ): Promise<PredictedRentRollColumSample[]> {
    let userPrompt = '';
    for (const sample of rentRollColSamples) {
      const formattedSample = `${sample.columnName} | ${sample.columnSampleValue}`;
      userPrompt += `\n ${formattedSample}`;
    }
    let retries = 0;
    let message: string | null = null;

    while (!message && retries < this.retryLimit) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          temperature: 0,
          messages: [
            { role: 'system', content: RENTROLL_COLUMN_NAME_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        });
        message = completion.choices[0].message.content;
      } catch (error) {
        if (retries === this.retryLimit - 1) {
        }
        retries++;
      }
    }

    if (!message) {
      console.log(
        `Could not predict normalized columns for `,
        rentRollColSamples,
      );
      throw new Error('could not predict normalized columns for ');
    }

    const splitMMessage = message.split('\n');

    // reshape split messages and send back
    const predictedRentRollColSamples: PredictedRentRollColumSample[] =
      splitMMessage.map((line) => {
        const colValues = line.split(' | ').map((value) => value.trim());
        return {
          columnName: colValues[0],
          columnSampleValue: colValues[1],
          predictedNormalizedColName: colValues[2],
        };
      });

    return predictedRentRollColSamples;
  }

  async predictAddressOutput(data: any) {
    let message: string | null = null;
    let retries = 0;

    while (!message && retries < this.retryLimit) {
      try {
        const address_prompt = PROPERTY_OVERVIEW(data.address);
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo-0125',
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: address_prompt,
            },
            {
              role: 'user',
              content: data.address,
            },
          ],
        });
        const responseMessage = completion.choices[0].message.content;
        if (responseMessage !== "I'm sorry, but I can't assist with that.") {
          message = responseMessage;
        }
      } catch (error) {
        if (retries === this.retryLimit - 1) {
          console.log(error);
        }
        retries++;
      }
    }

    if (!message) {
      console.log('Could not generate output for ', data.address);
      message = 'Unable to generate deal memo for this address';
    }

    await this.dealsRepo.update(
      { id: data.dealId },
      { investmentMemo: [`${message}`] },
    );

    return message;
    // return {
    //   strForm: message,
    //   objForm: this.parseMessage(message),
    // };
  }

  parseMessage(message: string) {
    return message
      .split('\n')
      .map((line) => line.split('|').map((word) => word.trim()));
  }

  async generateAnalysisSummary(data: any) {
    let message: string | null = null;
    let retries = 0;

    while (!message && retries < this.retryLimit) {
      try {
        const analysis_prompt = ANALYSIS_DATA_PROMPT(
          data.underwriting,
          data.rentroll,
          data.t12,
        );
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4-1106-preview',
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: analysis_prompt,
            },
            {
              role: 'user',
              content: `${data.underwriting}, 
              ${data.rentroll}, 
              ${data.t12}`,
            },
          ],
        });
        const responseMessage = completion.choices[0].message.content;
        if (responseMessage !== "I'm sorry, but I can't assist with that.") {
          message = responseMessage;
        }
      } catch (error) {
        if (retries === this.retryLimit - 1) {
          console.log(error);
        }
        retries++;
      }
    }

    if (!message) {
      console.log(
        'Could not generate output for underwriting:',
        data.underwriting,
        'rentroll:',
        data.rentroll,
        't12:',
        data.t12,
      );
      message = 'Unable to generate analysis summary for the provided data';
    }

    // await this.dealsRepo.update(
    //   { id: data.dealId },
    //   { propertySummary: [`${message}`] },
    // );

    return message;
    // return {
    //   strForm: message,
    //   objForm: this.parseMessage(message),
    // };
  }

  async adjustWriting(data: {
    textInput: string;
    operation: 'improve' | 'shorten' | 'lengthen' | 'simplify';
    dealId: number;
  }) {
    let operationFunction;
    const { operation, textInput, dealId } = data;

    switch (operation) {
      case 'improve':
        operationFunction = IMPROVE_WRITING(textInput);
        break;
      case 'shorten':
        operationFunction = SHORTEN_WRITING(textInput);
        break;
      case 'lengthen':
        operationFunction = LENGTHEN_WRITING(textInput);
        break;
      case 'simplify':
        operationFunction = SIMPLIFY_WRITING(textInput);
        break;
      default:
        throw new Error('Unsupported operation');
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: operationFunction,
        },
        {
          role: 'user',
          content: textInput,
        },
      ],
    });
    const responseMessage = completion.choices[0].message.content;

    const deal = await this.dealsRepo.findOne({ where: { id: dealId } });
    let investMemoArray = deal.investmentMemo;

    investMemoArray = investMemoArray.map((str) =>
      str.replace(new RegExp(textInput, 'g'), responseMessage),
    );

    deal.investmentMemo = investMemoArray;
    await this.dealsRepo.save(deal);

    return responseMessage;
  }

  async updateProcessedInput(data: any) {
    const { responseMessage, textInput, dealId } = data;
    const deal = await this.dealsRepo.findOne({ where: { id: dealId } });

    let investMemoArray = deal.investmentMemo;

    investMemoArray = investMemoArray.map((str) =>
      str.replace(new RegExp(textInput, 'g'), responseMessage),
    );

    deal.investmentMemo = investMemoArray;
    return await this.dealsRepo.save(deal);
  }

  async generateInvestmentMemo(data: { address: string; dealId: number }) {
    const memoPrompts = [
      PROPERTY_OVERVIEW(data.address),
      NEIGHNORHOOD_OVERVIEW(data.address),
      LOCAL_ATTRACTIONS(data.address),
      TRANSPORTATION(data.address),
      JOBMARKET_OVERVIEW(data.address),
      SUBMARKET_OVERVIEW(data.address),
      DEMOGRAPHIC_OVERVIEW(data.address),
    ];
    const responses = await Promise.all(
      memoPrompts.map(async (prompt) => {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo-0125',
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

    return await this.dealsRepo.update(
      { id: data.dealId },
      { investmentMemo: responses },
    );
  }

  async produceContent(body: any) {
    const { textInput, userInput, dealId } = body;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: PROCESS_INPUT(userInput, textInput),
        },
        {
          role: 'user',
          content: textInput,
        },
      ],
    });
    const responseMessage = completion.choices[0].message.content;
    return { responseMessage, textInput, dealId };
  }

  async splitMergedColumns(sample: string, data: string): Promise<any> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: SPLIT_COLUMN_PROMPT,
        },
        {
          role: 'user',
          content: sample,
        },
        {
          role: 'user',
          content: data,
        },
      ],
    });

    return completion;
  }

  async rentCompSummary(body: any) {
    const summaries: string[] = [];

    for (const comp of body) {
      const {
        address,
        totalSqft,
        totalUnits,
        yearBuilt,
        numOfFloors,
        beds,
        baths,
      } = comp;

      const RENT_COMP_SUMMARY = `Take the following address: ${address}.
        This property has a total square footage of ${totalSqft}, ${totalUnits} units, built in ${yearBuilt}.
        It consists of ${numOfFloors} floors, ${beds} beds, and ${baths} baths.
        Generate a concise qualitative summary of the address. The summary should be no more than 10 sentences.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: RENT_COMP_SUMMARY,
          },
        ],
      });
      const responseMessage = completion.choices[0].message.content;
      summaries.push(responseMessage);
    }

    return summaries;
  }

  async categorizeUnknownWithGPT(
    unknownCategories: string[][],
    lineItemTrueIndex: number,
  ) {
    let mergedData: Array<any> = [];
    const batchSize = 2000;
    for (
      let iterator = 0;
      iterator <= Math.ceil(unknownCategories.length % batchSize);

    ) {
      const ceiling: number = iterator + batchSize;
      let joinedHeaders = '';

      const batch = unknownCategories.slice(iterator, ceiling);

      for (const item of batch) {
        const lineItemKey = this.utilitiesService
          .stripPreceedingNumber(String(item[lineItemTrueIndex]))
          .toLowerCase()
          .trim();

        joinedHeaders += `${lineItemKey} | `;
      }

      let response;

      try {
        /**
         * TODO
         * MOVE THIS TO GPT SERVICE
         */

        response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: OPERATING_STATEMANT_ENTRIES_CATEGORY_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: joinedHeaders,
            },
          ],
        });
      } catch (error) {
        iterator += batchSize;
        continue;
      }

      const interestData: string =
        response.choices[0]?.message?.content.replaceAll('\n', '');

      let parsedData: RawSummaryItemInterface[] = [];
      try {
        parsedData = JSON.parse(interestData);
      } catch (error) {}

      const mappedData = parsedData.map((parsedItem) => {
        const currentItem = batch.find((batchItem) => {
          return (
            this.utilitiesService
              .stripPreceedingNumber(String(batchItem[lineItemTrueIndex]))
              ?.toLowerCase()
              .trim() === parsedItem.lineItem?.toLowerCase()
          );
        });

        return {
          ...parsedItem,
          rawData: currentItem.slice(lineItemTrueIndex, currentItem.length),
        };
      });

      mergedData = [...mergedData, ...mappedData];

      iterator += batchSize;
    }

    return mergedData;
  }

  async generateDealNameFromEmail(text: string): Promise<string> {
    try {
      /**
       * TODO
       * MOVE THIS TO GPT SERVICE
       */

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: GENERATE_DEAL_NAME_FROM_EMAIL_SUBJECT_PROMPT,
          },
          {
            role: 'user',
            content: text,
          },
        ],
      });

      return response.choices[0].message.content;
    } catch (error) {
      return text;
    }
  }

  async determineEmailFileType(buffer: string): Promise<string> {
    try {
      /**
       * TODO
       * MOVE THIS TO GPT SERVICE
       */

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: GENERATE_DOCUMENT_TYPE_FROM_EMAIL_ATTACHMENT_PROMPT,
          },
          {
            role: 'user',
            content: buffer,
          },
        ],
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.log(error, 'GPT ERROR');
      return 'unknown';
    }
  }

  async generatePropertyAddressFromEmail(email: string): Promise<string> {
    try {
      /**
       * TODO
       * MOVE THIS TO GPT SERVICE
       */

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: GENERATE_EMAIL_PROPERTY_ADDRESS_PROMPT,
          },
          {
            role: 'user',
            content: email,
          },
        ],
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.log(error, 'GPT ERROR');
      return 'unknown';
    }
  }
}
