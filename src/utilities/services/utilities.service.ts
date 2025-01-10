import { Injectable } from '@nestjs/common';
import {
  RRPipelineResponseI,
  RRPostProcessingAPIResponseI,
  T12PipelineResponseI,
} from 'src/document/interfaces/pipeline.dto';
import {
  PERCENTAGE,
  PERCENTAGE_SIGN,
  POSSIBLE_DATE_FORMATS,
} from '../constants';
import { DateTime } from 'luxon';
import * as cheerio from 'cheerio';
import axios from 'axios';
import PDFParse from 'pdf-parse';
import * as XLSX from 'xlsx';

@Injectable()
export class UtilitiesService {
  extractFilenameFromURL = (url: string): string => {
    return url.substring(url.lastIndexOf('/') + 1);
  };

  sanitizePipelineResponse(
    response: any,
    // RRPipelineResponseI
    //   | T12PipelineResponseI
    //   | RRPostProcessingAPIResponseI,
  ): RRPipelineResponseI | T12PipelineResponseI | RRPostProcessingAPIResponseI {
    if (typeof response?.data === 'string') {
      response.data = JSON.parse(
        String(response?.data)
          .replaceAll('NaN', '"NaN"')
          .replaceAll('null', '"null"'),
      );

      return response;
    }

    return response;
  }

  valueOrZero(value: number): number {
    if (isNaN(value)) return 0;

    return value;
  }

  stripNonNumericCharacters(str: string): string {
    return String(str).replace(/[^0-9.]/g, '');
  }

  /**
   * FIND THE NUMBER OF ITEMS IN FRONT WITHOUT Unit type
   * @param data
   * @param unitIndex
   * @returns number
   */
  lookAhead(data: Array<Array<string | number>>, unitIndex: number): number {
    let skips = 0;

    for (const item of data) {
      if (item[unitIndex]) {
        break;
      }
      skips++;
    }

    return skips;
  }

  determineRent(
    dataRange: Array<Array<string | number>>,
    rentIndex: number,
  ): number {
    let maxRent = 0;

    for (const item of dataRange) {
      const rentString: string = this.stripNonNumericCharacters(
        String(item[rentIndex]),
      );
      const rentNumber = parseFloat(rentString);

      if (isNaN(rentNumber)) {
        continue;
      }

      if (rentNumber > maxRent) {
        maxRent = rentNumber;
      }
    }

    return maxRent;
  }

  extractDateFromTimestamp(timestamp: any) {
    const date = new Date(timestamp);

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const formattedDate = `${month}/${day}/${year}`;

    return formattedDate;
  }

  convertExcelSerialNumberToJSDate(serialNumber: number): Date {
    // Excel's date serial number starts from January 1, 1900
    const excelStartDate = new Date('1900-01-01T00:00:00Z');

    // Calculate the number of milliseconds to add to the start date
    const millisecondsPerDay = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    const daysToAdd = serialNumber - 1; // Subtract 1 because Excel incorrectly considers 1900-02-29 as a valid date
    const millisecondsToAdd = daysToAdd * millisecondsPerDay;

    // Create the JavaScript date by adding milliseconds to the start date
    const jsDate = new Date(excelStartDate.getTime() + millisecondsToAdd);

    return jsDate;
  }

  jsDateToShortDateString(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Months are zero-based
    const year = date.getUTCFullYear();
    return `${month}/${day}/${year}`;
  }

  isValidDate(date: string) {
    for (const format of POSSIBLE_DATE_FORMATS) {
      if (!date) return null;

      const parsedDate = DateTime.fromFormat(date, format, {
        zone: 'utc',
      });

      if (parsedDate.isValid) {
        return parsedDate;
      }
    }
    return null;
  }

  getDocumentStartRow(sortedTable: string[][]) {
    for (let idx = 0; idx < sortedTable.length; idx++) {
      if (sortedTable[idx].length > 4) {
        return idx;
      }
    }
  }

  stripPreceedingNumber(str: string): string {
    const strippedData = String(str).replace(/^\d+\s*-\s*/, '');
    const trimmed: string = strippedData.trim();
    return trimmed === '' ? str : trimmed;
  }

  getT12LineItemsTrueIndex(items: string[][]) {
    let countNumberOnly = false;
    /**
     * ASSUME THE FIRST COLUMN IS THE TRUE INDEX AND MOVE FORWARD
     */
    const lineItemTrueIndex = 0;
    let numbersCount = 0;
    let textsCount = 0;
    const alphabetRegex = /[a-zA-Z]/;
    for (const item of items) {
      countNumberOnly = !alphabetRegex.test(String(item[lineItemTrueIndex]));
      if (countNumberOnly) {
        numbersCount++;
      } else {
        textsCount++;
      }
    }

    return numbersCount > textsCount ? 1 : 0;
  }

  getT12LineItemsLastIndex(data: any[][], lineItemTrueIndex: number) {
    /**
     * Assumming the first row is the header
     * Determine if the last column is a total
     * 1. If last column header is total
     *  - Return length of data -1 as the last T12 data column
     * 2. Return length of data as as the last T12 data column
     *
     */
    const firstRow = data[0];
    const firstTenRows = data.slice(0, 10);

    let idx = lineItemTrueIndex + 1;
    for (const rowData of firstTenRows) {
      idx = lineItemTrueIndex + 1;
      for (idx; idx < rowData.length; idx++) {
        if (String(rowData[idx]).toLowerCase().includes('total')) {
          return idx;
        }
      }
    }

    return idx - lineItemTrueIndex < 12
      ? firstRow.length
      : lineItemTrueIndex + 13;
  }

  sanitizeMoneyString(str: any): string {
    return String(str)
      .split('$')
      .join('')
      .split('(')
      .join('')
      .split(')')
      .join('')
      .split(',')
      .join('')
      .trim();
  }

  normalizeWorksheetValue(value: string | number, format: string) {
    if (
      typeof value === 'number' &&
      (String(format) === PERCENTAGE || String(format) === PERCENTAGE_SIGN)
    )
      return value * 100;
    return value;
  }

  extractEmailFromRecipientString(str: string): string {
    return String(str.match(/<([^>]+)>/)[1]);
  }

  parseBase64ToString(base64EncodedString: string): string {
    return Buffer.from(base64EncodedString, 'base64').toString('utf-8');
  }

  parseHTMLBody(html: string): string {
    const $ = cheerio.load(html);

    return $('body').text().trim();
  }
  sanitizeFilenameForUrl(filename: string) {
    const unsafeChars = /[^a-zA-Z0-9-_\.]/g;
    let sanitizedFilename = filename.replace(unsafeChars, '-');

    sanitizedFilename = encodeURIComponent(sanitizedFilename);

    return sanitizedFilename;
  }

  async extractPDFFromURL(url: string) {
    const document = await axios.get(url, {
      responseType: 'arraybuffer',
    });

    const data = await PDFParse(document.data);
    const text = data.text;

    return text;
  }

  transformExcelData(jsonList: any[]): string {
    const transformedData = jsonList.map((sheet) => {
      const sheetName = sheet.sheetName;
      const columnSkip = sheet.skips?.skippedColumns ?? 0;
      const rowSkip = sheet.skips?.skippedRows ?? 0;
      const transformedRows = sheet.data.map((row: any[], rowIndex: number) => {
        return row.map((value: any, colIndex: number) => {
          const cellLocation = `${this.getExcelColumn(
            colIndex + 1 + columnSkip,
          )}${rowIndex + 1 + rowSkip}`;
          return {
            value: value,
            cell: cellLocation,
          };
        });
      });

      return {
        sheetName: sheetName,
        data: transformedRows.flat().filter((cell) => cell.value !== ''),
      };
    });

    return JSON.stringify(transformedData);
  }

  getExcelColumn(columnNumber: number): string {
    let columnName = '';
    while (columnNumber > 0) {
      const modulo = (columnNumber - 1) % 26;
      columnName = String.fromCharCode(65 + modulo) + columnName;
      columnNumber = Math.floor((columnNumber - modulo) / 26);
    }
    return columnName;
  }

  countCellsInExcelRange(range: string): number {
    const [start, end] = range.split(':');
    const startRow = parseInt(start.match(/\d+/)[0], 10);
    const endRow = parseInt(end.match(/\d+/)[0], 10);
    return endRow - startRow + 1;
  }

  cleanedFileName(filename: string) {
    const parts = filename.split('.');
    const namePart = parts.slice(0, -1).join('.');
    const extensionPart = parts[parts.length - 1];
    const cleanedName = namePart.replace(/[^a-zA-Z0-9]/g, '');

    return `${cleanedName}.${extensionPart}`;
  }

  extractTextFromExcel = (fileContent: any) => {
    const workbook = XLSX.read(fileContent, { type: 'buffer' });
    let text = '';
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      text += XLSX.utils.sheet_to_csv(worksheet);
    });

    return text;
  };
}

export const getSummary = (documents: any, fileType: string) =>
  documents
    ?.filter((obj: any) => obj.fileType === fileType)
    .find((item: any) => item.fileType === fileType && item.summary !== null)
    ?.summary;
