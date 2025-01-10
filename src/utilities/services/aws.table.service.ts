import { Injectable } from '@nestjs/common';

// Types for better code organization
interface TextractTable {
  Rows: TextractRow[];
  ColumnCount: number;
}

interface TextractRow {
  Cells: TextractCell[];
}

interface TextractCell {
  Text: string;
  ColumnIndex: number;
  RowIndex: number;
  ColumnSpan?: number;
  RowSpan?: number;
}

@Injectable()
export class AWSTableService {
  private headerMatchThreshold: number;
  constructor() {
    this.headerMatchThreshold = 0.8; // Similarity threshold for headers
  }

  /**
   * Combines similar tables from Textract output
   * @param {TextractTable[]} tables - Array of tables from Textract
   * @returns {TextractTable[]} Array of combined tables
   */
  combineSimilarTables(tables) {
    if (!tables || tables.length <= 1) return tables;

    const tableGroups = new Map();

    // Group similar tables based on their structure
    tables.forEach((table, index) => {
      const headerSignature = this.getHeaderSignature(table);
      let matched = false;

      // Check existing groups for a match
      for (const [key, group] of tableGroups) {
        if (this.areHeadersSimilar(headerSignature, key)) {
          group.push({ table, index });
          matched = true;
          break;
        }
      }

      // Create new group if no match found
      if (!matched) {
        tableGroups.set(headerSignature, [{ table, index }]);
      }
    });

    // Combine tables within each group
    const combinedTables = [];
    for (const group of tableGroups.values()) {
      if (group.length === 1) {
        combinedTables.push(group[0].table);
      } else {
        combinedTables.push(this.mergeTables(group.map((g) => g.table)));
      }
    }

    return combinedTables;
  }

  /**
   * Creates a signature for table headers to identify similar tables
   * @param {TextractTable} table
   * @returns {string}
   */
  getHeaderSignature(table) {
    if (!table.Rows || table.Rows.length === 0) return '';

    // Use first row as header
    const headerRow = table.Rows[0];
    return headerRow.Cells.sort((a, b) => a.ColumnIndex - b.ColumnIndex)
      .map((cell) => cell.Text.toLowerCase().trim())
      .join('|');
  }

  /**
   * Checks if two header signatures are similar enough to be considered the same table structure
   * @param {string} signature1
   * @param {string} signature2
   * @returns {boolean}
   */
  areHeadersSimilar(signature1, signature2) {
    if (signature1 === signature2) return true;

    const headers1 = signature1.split('|');
    const headers2 = signature2.split('|');

    if (headers1.length !== headers2.length) return false;

    let matchCount = 0;
    for (let i = 0; i < headers1.length; i++) {
      const similarity = this.calculateStringSimilarity(
        headers1[i],
        headers2[i],
      );
      if (similarity >= this.headerMatchThreshold) {
        matchCount++;
      }
    }

    return matchCount / headers1.length >= this.headerMatchThreshold;
  }

  /**
   * Calculates string similarity using Levenshtein distance
   * @param {string} str1
   * @param {string} str2
   * @returns {number} Similarity score between 0 and 1
   */
  calculateStringSimilarity(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len1][len2] / maxLen;
  }

  /**
   * Merges multiple similar tables into one
   * @param {TextractTable[]} tables
   * @returns {TextractTable}
   */
  mergeTables(tables) {
    if (tables.length === 0) return null;
    if (tables.length === 1) return tables[0];

    // Use the first table as a base
    const baseTable = tables[0];
    const mergedRows = [...baseTable.Rows];
    const headerRow = mergedRows[0];

    // Process each additional table
    for (let i = 1; i < tables.length; i++) {
      const currentTable = tables[i];

      // Skip header row and add remaining rows
      for (let rowIndex = 1; rowIndex < currentTable.Rows.length; rowIndex++) {
        const row = currentTable.Rows[rowIndex];

        // Align columns based on header mapping
        const alignedRow = this.alignRow(row, headerRow);
        if (alignedRow) {
          mergedRows.push(alignedRow);
        }
      }
    }

    return {
      Rows: mergedRows,
      ColumnCount: baseTable.ColumnCount,
    };
  }

  /**
   * Aligns a row's cells with the header structure
   * @param {TextractRow} row
   * @param {TextractRow} headerRow
   * @returns {TextractRow}
   */
  alignRow(row, headerRow) {
    const alignedCells = [];
    const headerCells = headerRow.Cells;

    for (let i = 0; i < headerCells.length; i++) {
      const headerCell = headerCells[i];
      const matchingCell = row.Cells.find(
        (cell) =>
          cell.ColumnIndex === headerCell.ColumnIndex ||
          this.isOverlappingColumn(cell, headerCell),
      );

      alignedCells.push({
        Text: matchingCell ? matchingCell.Text : '',
        ColumnIndex: headerCell.ColumnIndex,
        RowIndex: row.Cells[0]?.RowIndex ?? 0,
        ColumnSpan: headerCell.ColumnSpan,
        RowSpan: matchingCell?.RowSpan ?? 1,
      });
    }

    return { Cells: alignedCells };
  }

  /**
   * Checks if two cells overlap in their column spans
   * @param {TextractCell} cell1
   * @param {TextractCell} cell2
   * @returns {boolean}
   */
  isOverlappingColumn(cell1, cell2) {
    const cell1End = cell1.ColumnIndex + (cell1.ColumnSpan ?? 1) - 1;
    const cell2End = cell2.ColumnIndex + (cell2.ColumnSpan ?? 1) - 1;

    return !(cell1End < cell2.ColumnIndex || cell1.ColumnIndex > cell2End);
  }
}
