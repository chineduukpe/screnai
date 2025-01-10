import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';

import { StructuredOutputParser } from 'langchain/output_parsers';

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AIMessage } from '@langchain/core/messages';
import { ModelBenchamarkI } from 'src/model/interfaces/model-benchmark.interface';
import { UtilitiesService } from 'src/utilities/services/utilities.service';

export const SEPARATE_INCOME_AND_EXPENSES = ChatPromptTemplate.fromTemplate(`
    The user will give you a list of operating statement line items, find the position of income and position of expense.
    all items before the expense line item is an income.
    Formatting instruction: {formatting_instruction}
  `);

const DEAL_ANALYSIS_OUTPUT_PARSER =
  StructuredOutputParser.fromNamesAndDescriptions({
    income: 'array of income items',
    expenses: 'array of expense items',
  });

const METRIC_PARSER = StructuredOutputParser.fromNamesAndDescriptions({
  name: 'The metric to track',
  condition: 'The condition. eg, > , < , =',
  value: 'The value of conditioin',
  format: 'The value format, eq %',
});

@Injectable()
export class LlmService {
  private model: any;
  private logger: Logger;
  constructor(private utilitiesService: UtilitiesService) {
    this.logger = new Logger(LlmService.name);
    this.model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'o1-mini',
      // verbose: true,
    });
  }

  async evaluateDeal(
    computedModelData: any,
    dealBenchmark: ModelBenchamarkI[],
  ) {
    // const parsedModelData = JSON.parse(computedModelData);

    const prompt = ChatPromptTemplate.fromTemplate(`
      You are a commercial real estate analyst. Evaluate the following deal metrics against the provided benchmarks:

      Computed Model Data:
      {modelData}

      Benchmarks:
      {benchmarks}

      Simply return an object if the computed values meet the benchmark or not, show each computed metric, their expected value and condition and the cell and sheetName


    `);

    const chain = prompt.pipe(this.model);

    const response: any = await chain.invoke({
      modelData: JSON.stringify(
        this.utilitiesService.transformExcelData(computedModelData),
        null,
        2,
      ),
      benchmarks: JSON.stringify(dealBenchmark, null, 2),
    });

    return response.content;
  }

  async extractRRData(data: string, docType: string) {
    const prompt = ChatPromptTemplate.fromTemplate(`
        Given the data here {data}

        analyze the data and return a JSON in the following example structure below

    {format}

    Where 1bd/1ba is the unit type. Do for all the unique unitTypes.

    economicallyVacant are units that the occupant owe more than 2 months rent

      `);

    const chain = prompt.pipe(this.model);

    const res = await chain.invoke({
      data: `${data}`,
      format: `{
  "totals": {
    "totalRent": 46099,
    "totalSqft": 64350,
    "totalVacancy": 0,
    "totalUnitCount": 61,
    "totalMarketRent": 66515
  },
  "floorplans": {
    "1bd/1ba": {
      "beds": 0,
      "baths": 0,
      "count": 2,
      "rentSum": 965,
      "sqftSum": 1600,
      "unitType": "1/1",
      "vacantUnits": 0,
      "marketRentSum": 1650,
      "occupiedRentSum": 0,
      "sixMonthSummary": {
        "beds": 0,
        "baths": 0,
        "count": 0,
        "rentSum": 0,
        "sqftSum": 0,
        "unitType": "1/1",
        "vacantUnits": 0,
        "marketRentSum": 0,
        "occupiedRentSum": 0,
        "nophinMarketRent": 0,
        "economicallyVacant": 0
      },
      "nineMonthSummary": {
        "beds": 0,
        "baths": 0,
        "count": 0,
        "rentSum": 0,
        "sqftSum": 0,
        "unitType": "1/1",
        "vacantUnits": 0,
        "marketRentSum": 0,
        "occupiedRentSum": 0,
        "nophinMarketRent": 0,
        "economicallyVacant": 0
      },
      "nophinMarketRent": 0,
      "threeMonthSummary": {
        "beds": 0,
        "baths": 0,
        "count": 0,
        "rentSum": 0,
        "sqftSum": 0,
        "unitType": "1/1",
        "vacantUnits": 0,
        "marketRentSum": 0,
        "occupiedRentSum": 0,
        "nophinMarketRent": 0,
        "economicallyVacant": 0
      },
      "economicallyVacant": 0
    },}}`,
    });

    console.log(res);

    return res;
  }

  async findMetricsInModel(data: any): Promise<any> {
    const prompt = ChatPromptTemplate.fromTemplate(`
        Given the commercial real estate acquisition model below. 
        {data}
        
        Find some key metrics and their cell locations. Some example metrics are IRR, Unlevered IRR, DSCR, Exit Cap Rate, Net Profit etc

        You can find more than the list above.
      `);

    const chain = prompt.pipe(this.model);

    const res: any = await chain.invoke({
      data,
    });

    console.log(res, 'RESPPPPPP');

    return res.content;
  }

  async findMetricsInModelJSON(data: any): Promise<any> {
    const prompt = ChatPromptTemplate.fromTemplate(`
        Given the commercial real estate acquisition model below. 
        {data}
        
        Find some benchmark metrics that the user can use to evaluate the deal if it is worth investing and their condition. 

        Some example metrics are IRR > 3, Unlevered IRR > 4, DSCR < 10000, Exit Cap Rate < 5 , Net Profit > 2000000 etc

        Do not use these examples above, only use data found in the workbook

        You can find more than the list above. 

        Return the response in the JSON format below

       format: [{format}]
      `);

    const chain = prompt.pipe(this.model);

    const res: any = await chain.invoke({
      data,
      format: METRIC_PARSER.getFormatInstructions(),
    });

    const resString = String(res?.content).trim();

    let metricsArray = [];

    try {
      const updated = resString.substring(
        resString.indexOf('json') + 4,
        resString.lastIndexOf(']') + 1,
      );
      console.log(`UPDATED<<<<<`, updated);
      metricsArray = JSON.parse(updated);
    } catch (error) {
      this.logger.log(`Could not parse Metrics JSON`);
      this.logger.error(error);
    }

    return metricsArray;
  }

  async mapRRHeaders(data, headers) {
    const responseFormat = StructuredOutputParser.fromNamesAndDescriptions({
      header: `The header match in the data`,
      columnName: 'The column name in data',
      index: 'The index it was found in the data',
    });
    const prompt = ChatPromptTemplate.fromTemplate(`
        Given the sample data below
        {data}

        Find the index of of each items in the headers below

        {headers}

        Response format: [{format}]
      `);

    const chain = prompt.pipe(this.model);

    const res: any = await chain.invoke({
      data,
      headers,
      format: responseFormat.getFormatInstructions(),
    });

    return res.content;
  }

  extractJson(input) {
    const jsonPattern = /\{(?:[^{}]|(?<rec>\{(?:[^{}]|(\k<rec>))*\}))*\}/g;

    // Match all JSON objects using the pattern
    const matches = input.match(jsonPattern);

    if (!matches) return [];

    // Parse each matched JSON string into an object
    return matches
      .map((jsonString) => {
        try {
          return JSON.parse(jsonString);
        } catch (error) {
          console.error('Invalid JSON:', jsonString);
          return null;
        }
      })
      .filter((obj) => obj !== null); // Remove null values from failed parses
  }

  async guessRRHeaders(data: any) {
    const responseFormat = StructuredOutputParser.fromNamesAndDescriptions({
      header: `The header match in the data`,
      columnIndex: 'The index it was found in the data as a number',
      nophinCol: 'The nophin column name it maps to',
    });
    const prompt = ChatPromptTemplate.fromTemplate(`
        Help the user guess the correct column name. 

       The user will provide you with a data below:

       {data}

       Help the user map the columns to the list below

        You can only guess the following nophin column values values:

        n_tenant_name
        n_bed
        n_bath
        n_unit_id
        n_unit_type
        n_unit_sqft
        n_market_rent
        n_rent
        n_vacancy
        n_misc
        n_total
        n_balance
        n_security
        n_unit_status
        n_charge_code
        n_charge_code_amount
        n_default
        n_move_in
        n_move_out
        n_lease_end
        n_lease_start
        n_unit_size

        Example

        unit ====> to n_unit
        unit type ====> n_unit_type
        floor plan ====> n_unit_type
        market rent ===> n_market_rent


        Response format: {format}
      `);

    const chain = prompt.pipe(this.model);

    const res: any = await chain.invoke({
      data,
      format: responseFormat.getFormatInstructions(),
    });
    return this.extractJson(String(res?.content));
  }

  async mapRRHeadersFromData(data: any) {
    const responseFormat = StructuredOutputParser.fromNamesAndDescriptions({
      header: `The header match in the data`,
      index: 'The index it was found in the data',
    });
    const prompt = ChatPromptTemplate.fromTemplate(`
        Given the sample data below
        {data}

        The user will provide you with a list of commercial real estate rent roll headers that is mixed up with other words or
        numbers. Try to strip out the unncessary characters and return the meaningful words.

        Examples: 
        
        '0': 'Unit  Current/Notice/Vacant Residents 101',
        '1': 'Unit Type   29613A2U',
        '2': 'Unit Sq Ft  740',
        '3': 'Resident   t0403368',
        '4': 'Name   Courtney Holder',
        '5': 'Market Rent  1095',
        '6': 'Actual Rent  1094',
        '7': 'Resident Deposit  250',
        '8': 'Other Deposit  0',
        '9': 'Move In   45107',
        '10': 'Lease Expiration  45472',
        '11': 'Move Out   ',
        '12': 'Balance   1231.3'

        should return 

        0: Unit
        1: Unit Type
        2: Unit sq ft
        3: Resident
        4: Name
        5: Market Rent 
        6: Actual Rent
        7: Resident Deposit
        8: Other Deposit
        9: Move In
        10: Lease Expiration
        11: Move Out
        12: Balance

        Think about it carefully before you respond.


        Response format: [{format}]

        Here are some examples of headers

        - Unit 
        - Unit type
        - Floorplan
        - Bed
        - Bath
        - Sq Ft
        - Budget Charges
        - Scheduled Charges
        - Status
        - Lease Start
        - Lease End
        - Move in
        - Move out
        - Name
        - Resident etc
      `);

    const chain = prompt.pipe(this.model);

    const res: any = await chain.invoke({
      data: JSON.stringify(data),
      format: responseFormat.getFormatInstructions(),
    });

    return this.extractJson(String(res?.content));

    const content = String(res?.content);

    const split = content.trim().split('\n');

    const ls = [];

    for (const item of split) {
      try {
        const parsedItem = JSON.parse(item.trim());
        ls.push(parsedItem);
      } catch (error) {
        console.log(`>>>>Could not parse ${item}`);
      }
    }

    return ls;
    return res.content;
  }
}
