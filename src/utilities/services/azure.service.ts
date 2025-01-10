import { Inject, Injectable } from '@nestjs/common';
import {
  AnalyzeResultOperationOutput,
  DocumentIntelligenceClient,
  getLongRunningPoller,
  isUnexpected,
} from '@azure-rest/ai-document-intelligence';
import {
  AzureKeyCredential,
  DocumentAnalysisClient,
} from '@azure/ai-form-recognizer';
import { GptService } from 'src/gpt/gpt.service';
import { DocIntelligenceExtractionResponseI } from '../interfaces/doc-intelligence.interface';

@Injectable()
export class AzureService {
  constructor(
    @Inject('AzureDocIntelligenceClient')
    private readonly azDocIntelCient: DocumentIntelligenceClient,
    private gptService: GptService,
  ) {}

  private DOC_INTELLIGENCE_KEY = process.env.AZURE_DOC_INTELLIGENCE_KEY;
  private DOC_INELLIGENCE_ENDPOINT =
    process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT;

  public createDocIntelligenceClient() {
    return new DocumentAnalysisClient(
      this.DOC_INELLIGENCE_ENDPOINT,
      new AzureKeyCredential(this.DOC_INTELLIGENCE_KEY),
    );
  }

  async getDocIntelligenceInfo() {
    return await this.azDocIntelCient.path('/info').get();
  }

  async extractTableFromPDF(
    url: string,
  ): Promise<DocIntelligenceExtractionResponseI> {
    const initialResponse = await this.azDocIntelCient
      .path('/documentModels/{modelId}:analyze', 'prebuilt-layout')
      .post({
        contentType: 'application/json',
        body: {
          urlSource: url,
        },
      });

    if (isUnexpected(initialResponse)) {
      throw initialResponse.body.error;
    }

    const poller = await getLongRunningPoller(
      this.azDocIntelCient,
      initialResponse,
    );
    const result = (await poller.pollUntilDone())
      .body as AnalyzeResultOperationOutput;

    return {
      tables: result?.analyzeResult?.tables,
      pages: result?.analyzeResult?.pages,
    };
  }

  async combineDocIntelligenceTable(tables: any[]): Promise<string> {
    const sortedTables = tables.sort((a, b) => {
      if (a.columnCount !== b.columnCount) {
        return b.columnCount - a.columnCount;
      }

      return a.boundingRegions?.pageNumber - b.boundingRegions?.pageNumber;
    });
    const currentTableLength = sortedTables[0].columnCount;

    let csv = ``;

    for (const table of sortedTables) {
      /**
       * ASSUME THE FIRST TABLE WITH LARGEST DATA IS CORRECT
       * COMBINE ALL TABLES WITH SAME NUMBER OR COLUMNS
       * WHEN A TABLE HAS ONE OR TWO COLUMNS LESS THAT THE MAIN TABLE
       * ASSUME SOME COLUMNS WERE MERGED AND
       * SEND TO OPENAI TO UNMERGE
       */
      if (table.columnCount === currentTableLength) {
        csv = this.convertMSDocIntelligenceTableToCSV(csv, table.cells);
      } else if (table.columnCount > currentTableLength - 2) {
        let csv2 = ``;
        csv2 = this.convertMSDocIntelligenceTableToCSV(csv2, table.cells);

        /**
         * THE FIRST TABLE IS USUALLY THE FIRST PART OF THE CSV
         * GET THE FIRST FOUR ROWS THAT INCLUDES THE HEADERS AS SAMPLE
         * SEND THAT TO OPENAI TO CORRECT BROKEN OR MERGED COLUMNS BASED ON THE SAMPLE
         */
        const sampleCSV = csv.split('\n').slice(0, 4).join('\n');

        const completion = await this.gptService.splitMergedColumns(
          sampleCSV,
          csv2,
        );

        const content = completion?.choices[0].message.content;

        csv += '\n';
        csv += content;
      }
    }

    return csv;
  }
  convertMSDocIntelligenceTableToCSV(csv = '', cells: any[]) {
    let currentRow = cells[0]?.rowIndex;

    for (const currentCell of cells) {
      if (currentRow !== currentCell?.rowIndex) {
        csv += '\n';
        currentRow = currentCell?.rowIndex;
      }
      csv += String(currentCell?.content)
        .replace('+', '')
        .replaceAll('\n', '')
        .replaceAll(',', '')
        .replace(/-+$/, '')
        // .replaceAll('-', '')
        .trim();

      csv += ',';
    }

    return csv;
  }
}
