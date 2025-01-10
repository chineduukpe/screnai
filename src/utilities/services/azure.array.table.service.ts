import { Injectable } from '@nestjs/common';

interface AzureTable {
  cells: {
    rowIndex: number;
    columnIndex: number;
    content: string;
    spans?: {
      rowSpan?: number;
      columnSpan?: number;
    };
  }[];
  rowCount: number;
  columnCount: number;
}

@Injectable()
export class AzureArrayTableConverter {
  /**
   * Converts Azure tables to 2D arrays and combines similar tables
   * @param {AzureTable[]} tables - Array of tables from Azure
   * @returns {string[][]} Combined 2D array of table values
   */
  convertTablesToArray(tables: AzureTable[]): string[][] {
    if (!tables || tables.length === 0) return [];

    // If multiple tables, combine them
    const combinedTable = this.combineTables(tables);

    // Create 2D array with dimensions from the table
    const result: string[][] = Array(combinedTable.rowCount)
      .fill(null)
      .map(() => Array(combinedTable.columnCount).fill(''));

    // Fill in the values
    for (const cell of combinedTable.cells) {
      const { rowIndex, columnIndex, content } = cell;
      result[rowIndex][columnIndex] = content.trim();
    }

    // Remove empty rows and columns
    return this.cleanArray(result);
  }

  /**
   * Combines multiple tables into one, skipping header repetition
   */
  private combineTables(tables: AzureTable[]): AzureTable {
    if (tables.length === 1) return tables[0];

    const baseTable = tables[0];
    let mergedCells = [...baseTable.cells];
    let maxRowIndex = Math.max(...baseTable.cells.map((cell) => cell.rowIndex));

    // Add subsequent tables
    for (let i = 1; i < tables.length; i++) {
      const currentTable = tables[i];

      // Skip header row (rowIndex === 0) for subsequent tables
      const newCells = currentTable.cells
        .filter((cell) => cell.rowIndex > 0)
        .map((cell) => ({
          ...cell,
          rowIndex: cell.rowIndex + maxRowIndex,
        }));

      mergedCells = mergedCells.concat(newCells);
      maxRowIndex += currentTable.rowCount - 1;
    }

    return {
      cells: mergedCells,
      rowCount: maxRowIndex + 1,
      columnCount: Math.max(...mergedCells.map((cell) => cell.columnIndex)) + 1,
    };
  }

  /**
   * Removes empty rows and columns from the 2D array
   */
  private cleanArray(arr: string[][]): string[][] {
    // Remove empty rows
    const nonEmptyRows = arr.filter((row) => row.some((cell) => cell !== ''));

    if (nonEmptyRows.length === 0) return [];

    // Find non-empty column indices
    const nonEmptyColIndices: number[] = [];
    for (let col = 0; col < nonEmptyRows[0].length; col++) {
      if (nonEmptyRows.some((row) => row[col] !== '')) {
        nonEmptyColIndices.push(col);
      }
    }

    // Create new array with only non-empty rows and columns
    return nonEmptyRows.map((row) =>
      nonEmptyColIndices.map((colIndex) => row[colIndex]),
    );
  }
}
