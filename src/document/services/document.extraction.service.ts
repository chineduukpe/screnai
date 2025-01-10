import { Injectable, Logger } from '@nestjs/common';
import {
  NOPHIN_CUSTOM_MODEL_HEADER_MAPPING,
  NOPHIN_NORMALIZED_COLUMNS,
} from 'src/utilities/constants';
import { RRColumnMappingI } from '../interfaces/document.entitiy.interfaces';
import { LlmService } from 'src/llm/services/llm.service';

@Injectable()
export class DocumentExtractionService {
  private logger: Logger;
  constructor(private llmService: LlmService) {
    this.logger = new Logger(DocumentExtractionService.name);
  }
  async createNophinModelMapping(rows: any[][], headers) {
    let mapping = {};
    let mappedIndices = [];
    const availableHeaders = Object.keys(NOPHIN_CUSTOM_MODEL_HEADER_MAPPING);

    let startIndex = 0;

    for (let row of rows) {
      if (row.length > 4) break;
      startIndex++;
    }

    const headersLLMResponse = await this.llmService.mapRRHeaders(
      rows.slice(startIndex, startIndex + 5),
      headers,
    );

    console.log(headersLLMResponse, 'LLM RESPONSESSEE');

    const resString = String(headersLLMResponse).trim();

    let headersArray = [];
    try {
      const updated = resString.substring(
        resString.indexOf('json') + 4,
        resString.lastIndexOf(']') + 1,
      );

      headersArray = JSON.parse(updated);

      return headersArray;
    } catch (error) {
      this.logger.log(`Could not parse header JSON`);
      this.logger.error(error);
    }
  }

  createDirectMappingFromGuessedHeaderArray(
    guessedHeaders: RRColumnMappingI[],
  ) {
    const mapping = {};

    for (let item of guessedHeaders) {
      mapping[item.nophinCol] = parseInt(String(item.columnIndex));
    }

    return mapping;
  }

  createMapping(row: string[]) {
    const mapping = {};
    const directMapping = {};

    for (let i = 0; i < row.length; i++) {
      const map = this.generateMappingFromHeader(row[i], i);
      mapping[String(row[i]).toLowerCase().trim()] = map;
      if (map.nophinCol) {
        directMapping[map.nophinCol] = map.columnIndex;
      }
    }
    return { mapping, directMapping };
  }
  private generateMappingFromHeader(
    header: string,
    index: number,
  ): RRColumnMappingI {
    const mapping = {
      columnIndex: index,
      columnName: header,
      nophinCol: '',
    };

    let nophinCol = null;
    switch (header?.toLowerCase()?.trim()) {
      case 'unit':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_UNIT_ID;
        break;
      case 'floorplan':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_UNIT_TYPE;
        break;
      case 'unit type':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_UNIT_TYPE;
        break;
      case 'beds':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_BED;
        break;
      case 'bath':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_BATH;
        break;
      case 'sqft':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_UNIT_SQFT;
        break;
      case 'status':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_UNIT_STATUS;
        break;
      case 'move in':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_MOVE_IN;
        break;
      case 'lease start':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_LEASE_START;
        break;
      case 'market rent':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_MARKET_RENT;
        break;
      case 'lease rent':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_RENT;
        break;
      case 'resident':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_TENANT;
        break;
      case 'balance':
        nophinCol = NOPHIN_NORMALIZED_COLUMNS.N_BALANCE;
        break;
      default:
        nophinCol = null;
    }
    mapping.nophinCol = nophinCol;
    return mapping;
  }

  extractUniqueFloorplans(data: string[][], floorplanIndex: number): string[] {
    const floorplanSet = new Set<string>();
    for (const row of data) {
      floorplanSet.add(row[floorplanIndex]);
    }
    return [...floorplanSet];
  }

  async generateRRHeaderMappingWithLLM(data: string[][]) {
    const headers = {};
    for (let x = 0; x < data[0].length; x++) {
      headers[
        String(x)
      ] = `${data[0][x]} ${data[1][x]} ${data[2][x]} ${data[3][x]}`;
    }

    console.log(headers);

    return await this.llmService.mapRRHeadersFromData(headers);
  }

  async guessRRHeaders(headers: string) {
    return await this.llmService.guessRRHeaders(headers);
  }
}
