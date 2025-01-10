import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
// Types for Azure Document Intelligence table structure
interface AzureTable {
  cells: AzureCell[];
  rowCount: number;
  columnCount: number;
  boundingRegions?: any[];
}

interface AzureCell {
  kind: string;
  rowIndex: number;
  columnIndex: number;
  content: string;
  boundingRegions?: any[];
  spans?: {
    rowSpan?: number;
    columnSpan?: number;
  };
}

@Injectable()
export class AzureTableService {
  private requireStrictColumnMatch: boolean;
  private headerMatchThreshold: number;
  private logger: Logger;
  constructor() {
    this.headerMatchThreshold = 1;
    this.requireStrictColumnMatch = false;
    this.logger = new Logger(AzureTableService.name);
  }

  /**
   * Combines similar tables from Azure Document Intelligence output
   * @param {AzureTable[]} tables - Array of tables from Azure
   * @returns {AzureTable[]} Array of combined tables
   */
  combineSimilarTables(tables) {
    if (!tables || tables.length <= 1) return tables;

    const tableGroups = new Map();

    // First, normalize and group tables by structure
    tables.forEach((table, index) => {
      const normalizedTable = this.normalizeTable(table);
      const headerSignature = this.getHeaderSignature(normalizedTable);
      this.logger.debug(`Table SIGN: ${headerSignature}`);
      let matched = false;
      for (const [key, group] of tableGroups) {
        if (
          this.areTablesSimilar(
            headerSignature,
            key,
            normalizedTable,
            group[0].table,
          )
        ) {
          group.push({ table: normalizedTable, originalIndex: index });
          matched = true;
          break;
        }
      }

      if (!matched) {
        tableGroups.set(headerSignature, [
          { table: normalizedTable, originalIndex: index },
        ]);
      }
    });

    // Combine tables within each group
    const group = Array.from(tableGroups.values()).map((group) => {
      this.logger.fatal(`Group Legth: ${group.length}`);
      return group.length === 1
        ? tables[group[0].originalIndex]
        : this.mergeTables(group.map((g) => g.table));
    });

    fs.writeFileSync('table-group.json', JSON.stringify(group));

    const array = this.convertTablesToArray(group);

    for (const item of array) {
      this.logger.verbose(item[9]);
    }

    for (let item of array) {
      console.log(item[9]);
    }

    // return this.arrayToCsv(array);

    return array;
  }

  arrayToCsv(data: string[][]): string {
    const csvContent = data
      .map((row) => row.map((cell) => cell.replace(/,/g, '')).join(','))
      .join('\n');
    return csvContent;
  }

  /**
   * Normalizes table structure for consistent processing
   * @param {AzureTable} table
   * @returns {AzureTable}
   */
  normalizeTable(table) {
    // Sort cells by row and column index
    const sortedCells = [...table.cells].sort((a, b) => {
      if (a.rowIndex === b.rowIndex) {
        return a.columnIndex - b.columnIndex;
      }
      return a.rowIndex - b.rowIndex;
    });

    // Ensure all cells have proper spans
    const normalizedCells = sortedCells.map((cell) => ({
      ...cell,
      spans: {
        rowSpan: cell.spans?.rowSpan || 1,
        columnSpan: cell.spans?.columnSpan || 1,
      },
    }));

    return {
      ...table,
      cells: normalizedCells,
    };
  }

  /**
   * Creates a signature for table headers
   * @param {AzureTable} table
   * @returns {string}
   */
  getHeaderSignature(table) {
    const headerCells = table.cells
      .filter((cell) => cell.rowIndex === 0)
      .sort((a, b) => a.columnIndex - b.columnIndex);

    const headerSignature = headerCells
      .map((cell) =>
        String(cell.content).toLowerCase().trim().replaceAll(' ', ''),
      )
      .join(''); //Add |

    return headerSignature;
  }

  /**
   * Checks if two tables have similar structure
   * @param {string} signature1
   * @param {string} signature2
   * @param {AzureTable} table1
   * @param {AzureTable} table2
   * @returns {boolean}
   */
  areTablesSimilar(signature1, signature2, table1, table2) {
    if (signature1 === signature2) return true;

    const trimmedSignature1 = String(signature1)
      .toLowerCase()
      .replaceAll(' ', '')
      .replaceAll('|', '')
      .trim();

    const trimmedSignature2 = String(signature1)
      .toLowerCase()
      .replaceAll(' ', '')
      .replaceAll('|', '')
      .trim();

    if (trimmedSignature1 === trimmedSignature2) {
      console.log(`TRIMMMMMMEDD SIGNATURE MATCCH>>>>>>>`);
      return true;
    }
    const headers1 = signature1.split('|');
    const headers2 = signature2.split('|');

    if (this.requireStrictColumnMatch && headers1.length !== headers2.length) {
      return false;
    }

    // Compare column structure
    if (Math.abs(headers1.length - headers2.length) > 1) {
      return false;
    }

    // Check header similarity
    let matchCount = 0;
    const minLength = Math.min(headers1.length, headers2.length);

    for (let i = 0; i < minLength; i++) {
      if (
        this.calculateStringSimilarity(headers1[i], headers2[i]) >=
        this.headerMatchThreshold
      ) {
        matchCount++;
      }
    }

    return matchCount / minLength >= this.headerMatchThreshold;
  }

  /**
   * Calculates string similarity using Levenshtein distance
   * @param {string} str1
   * @param {string} str2
   * @returns {number}
   */
  calculateStringSimilarity(str1, str2) {
    const track = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) track[0][i] = i;
    for (let j = 0; j <= str2.length; j++) track[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator,
        );
      }
    }

    return (
      1 - track[str2.length][str1.length] / Math.max(str1.length, str2.length)
    );
  }

  /**
   * Merges multiple similar tables into one
   * @param {AzureTable[]} tables
   * @returns {AzureTable}
   */
  mergeTables(tables) {
    if (tables.length === 0) return null;
    if (tables.length === 1) return tables[0];

    const baseTable = tables[0];
    let mergedCells = [...baseTable.cells];
    let maxRowIndex = Math.max(...baseTable.cells.map((cell) => cell.rowIndex));

    // Process each additional table
    for (let i = 1; i < tables.length; i++) {
      const currentTable = tables[i];

      // Adjust row indices for the current table
      const adjustedCells = currentTable.cells
        .filter((cell) => cell.rowIndex > 0) // Skip header row
        .map((cell) => ({
          ...cell,
          rowIndex: cell.rowIndex + maxRowIndex,
        }));

      mergedCells = mergedCells.concat(adjustedCells);
      maxRowIndex += currentTable.rowCount - 1; // -1 to account for skipped header
    }

    // Calculate new dimensions
    const rowCount = Math.max(...mergedCells.map((cell) => cell.rowIndex)) + 1;
    const columnCount =
      Math.max(...mergedCells.map((cell) => cell.columnIndex)) + 1;

    return {
      cells: mergedCells,
      rowCount,
      columnCount,
      boundingRegions: baseTable.boundingRegions, // Keep the base table's regions
    };
  }

  /**
   * Validates and cleans merged table data
   * @param {AzureTable} table
   * @returns {AzureTable}
   */
  validateAndCleanTable(table) {
    // Remove duplicate cells
    const uniqueCells = table.cells.reduce((acc, cell) => {
      const key = `${cell.rowIndex}-${cell.columnIndex}`;
      if (!acc.has(key)) {
        acc.set(key, cell);
      }
      return acc;
    }, new Map());

    return {
      ...table,
      cells: Array.from(uniqueCells.values()),
    };
  }
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
}
