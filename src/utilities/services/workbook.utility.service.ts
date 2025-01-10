import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as xlsx from 'xlsx';
import * as ExcelJS from 'exceljs';

@Injectable()
export class WorkbookUtility {
  async getRemoveWorkbookSheetNames(url: string): Promise<Array<string>> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
      });
      const buffer = response.data;
      const workbook = xlsx.read(buffer, { type: 'array' });
      const sheetNames = workbook.SheetNames;

      return sheetNames;
    } catch (error) {
      console.log(error, ' Could not get sheet names');
      return [];
    }
  }
  async getWorkbookSheetNamesFromBuffer(bufferArray): Promise<string[]> {
    try {
      const workbook = xlsx.read(bufferArray, { type: 'array' });
      const sheetNames = workbook.SheetNames;

      return sheetNames;
    } catch (error) {
      console.log(error, ' Could not get sheet names');
      return [];
    }
  }

  getCellIndices(cellName: string) {
    function columnToIndex(column: string) {
      let index = 0;

      for (let i = 0; i < column.length; i++) {
        index = index * 26 + column.charCodeAt(i) - 64;
      }

      return index;
    }
    const matches = cellName.match(/([A-Z]+)(\d+)/);

    if (!matches) {
      throw new Error('Invalid cell name format');
    }

    const [, column, row] = matches;
    const columnIndex = columnToIndex(column);
    const rowIndex = parseInt(row, 10);

    return { columnIndex, rowIndex };
  }

  getColumnNameFromCellName(cellName: string): string {
    const match = cellName.match(/^[A-Za-z]+/);
    if (match) {
      return match[0];
    } else {
      return 'Invalid cell reference';
    }
  }

  getRowIndexFromCellName(cellName: string) {
    const match = cellName.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    } else {
      return 'Invalid cell reference';
    }
  }

  async generateExcelWorkbookBufferFromCSV(csv: string) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    const rows = csv
      .trim()
      .split('\n')
      .map((row) => row.split(','));

    rows.forEach((row) => {
      worksheet.addRow(row);
    });

    return await workbook.xlsx.writeBuffer();
  }

  getSkippedRowsColumns(range: string) {
    const firstCell: string = range.split(':')[0];

    const match = firstCell.match(/([A-Z]+)(\d+)/);

    if (match) {
      const columnLetters = match[1];
      const rowNumber = parseInt(match[2], 10);

      let skippedColumns = 0;
      for (let i = 0; i < columnLetters.length; i++) {
        skippedColumns *= 26;
        skippedColumns += columnLetters.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
      }
      skippedColumns--;

      const skippedRows = rowNumber - 1;

      return { skippedRows, skippedColumns };
    }

    return { skippedRows: 0, skippedColumns: 0 };
  }
}
