import { Injectable, Logger } from '@nestjs/common';
import {
  FloorplanSummaryBaseI,
  FloorplanSummaryI,
  IntervalsI,
  RawSummaryItemInterface,
  T12SummaryI,
} from '../interfaces/document.entitiy.interfaces';
import { UtilitiesService } from 'src/utilities/services/utilities.service';
import { DateTime } from 'luxon';
import {
  KNOWN_AGGREGATION_LINE_ITEMS,
  MAJOR_T12_SUMMARY_KEYS,
} from 'src/utilities/constants';
import { Model } from 'src/model/entities/model.entity';
import OpenAI from 'openai';

@Injectable()
export class DocumentAnalysisService {
  private logger: Logger;
  constructor(private utilitiesService: UtilitiesService) {
    this.logger = new Logger(DocumentAnalysisService.name);
  }
  getRRRowsForDateRange(
    data: string[][],
    minDate: DateTime,
    maxDate: DateTime,
    leaseStartIndex,
  ) {
    return data.filter((row) => {
      let leaseStartDate = row[leaseStartIndex];
      leaseStartDate =
        typeof leaseStartDate === 'number'
          ? this.utilitiesService.jsDateToShortDateString(
              this.utilitiesService.convertExcelSerialNumberToJSDate(
                leaseStartDate,
              ),
            )
          : leaseStartDate;

      const validDate = this.utilitiesService.isValidDate(leaseStartDate);

      if (validDate) {
        return validDate >= minDate && validDate <= maxDate;
      }
      return false;
    });
  }

  async generateFloorplanSummary(
    data: string[][],
    floorplan: string,
    rentIndex: number,
    floorplanIndex: number,
    marketRentIndex: number,
    unitSizeIndex: number,
    leaseStartIndex: number,
    bedsIndex,
    bathIndex,
    statusIndex,
  ): Promise<FloorplanSummaryI> {
    // let summary = null;
    const floorplanRows = data.filter((row) => {
      return (
        String(row[floorplanIndex]).toLowerCase().trim() ===
        String(floorplan).toLowerCase()
      );
    });

    const beds = floorplanRows[0] ? floorplanRows[0][bedsIndex] ?? 0 : 0;
    const baths = floorplanRows[0] ? floorplanRows[0][bathIndex] ?? 0 : 0;

    // Extract all statuses for this floorplan
    // const statuses = floorplanRows.map((row) =>
    //   String(row[statusIndex]).trim(),
    // );

    let vacantUnits = 0;
    // Get vacancy count from OpenAI
    if (statusIndex && statusIndex > -1) {
      const statuses: string[] = [];

      for (let row of floorplanRows) {
        statuses.push(row[statusIndex]);
      }

      vacantUnits = await this.getVacantCount(statuses);
    }

    console.log(vacantUnits, 'vacantUnits');

    const summary: any = {
      ...(await this.getFloorplanBaseSummary(
        floorplanRows,
        floorplan,
        rentIndex,
        marketRentIndex,
        unitSizeIndex,
        vacantUnits,
      )),
      baths: Number(baths),
      beds: Number(beds),
      vacantUnits: Number(vacantUnits),
    };

    if (leaseStartIndex) {
      //   let leaseStartDate = floorplanRows[0][leaseStartIndex];
      //   leaseStartDate =
      //     typeof leaseStartDate === 'number'
      //       ? this.utilityService.extractDateFromTimestamp(leaseStartDate)
      //       : leaseStartDate;
      //   const targetDate = this.utilityService.isValidDate(leaseStartDate);

      const currentDate = DateTime.now();
      const threeMonthsAgo = currentDate.minus({ months: 3 });
      const sixMonthsAgo = currentDate.minus({ months: 6 });
      const nineMonthsAgo = currentDate.minus({ months: 12 });

      const sixMonthData = this.getRRRowsForDateRange(
        floorplanRows,
        sixMonthsAgo,
        currentDate,
        leaseStartIndex,
      );

      const threeMonthData = this.getRRRowsForDateRange(
        floorplanRows,
        threeMonthsAgo,
        currentDate,
        leaseStartIndex,
      );

      const nineMonthData = this.getRRRowsForDateRange(
        floorplanRows,
        nineMonthsAgo,
        currentDate,
        leaseStartIndex,
      );

      summary.sixMonthSummary = this.getFloorplanBaseSummary(
        sixMonthData,
        floorplan,
        rentIndex,
        marketRentIndex,
        unitSizeIndex,
        statusIndex,
      );

      summary.nineMonthSummary = this.getFloorplanBaseSummary(
        nineMonthData,
        floorplan,
        rentIndex,
        marketRentIndex,
        unitSizeIndex,
        statusIndex,
      );

      summary.threeMonthSummary = this.getFloorplanBaseSummary(
        threeMonthData,
        floorplan,
        rentIndex,
        marketRentIndex,
        unitSizeIndex,
        statusIndex,
      );
    }

    return summary;
  }

  async getVacantCount(statuses: string[]): Promise<number> {
    //   const prompt = `
    //   Given the following list of property unit statuses, determine how many units are vacant.
    //   Use these strict guidelines:
    //   - Consider a unit vacant if and only if its status is exactly "Vacant" or starts with "Vacant-".
    //   - All other statuses, including "Occupied", "Occupied-NTVL", and any variation of "Leased", should be considered occupied.
    //   - "Vacant-Leased" should be counted as vacant, as it's not currently occupied.
    //   - If you're not sure about a status, do not count it as vacant.

    //   Statuses:
    //   ${statuses.join('\n')}

    //   Please respond with only the number of vacant units, based on these strict criteria.
    // `;

    const prompt2 = `
    Given the following list of property unit statuses, determine how many units are vacant.
    Use these guidelines:
    - Consider a unit vacant if its status indicates it's not currently occupied or ready for immediate occupancy.
    - Consider a unit vacant if and only if its status is exactly "Vacant" or starts with "Vacant-".
    - All other statuses, including "Occupied", "Occupied-NTVL", and any variation of "Leased", should be considered occupied.
    - Statuses that should be counted as vacant include, but are not limited to:
      * "Vacant" or any variation starting with "Vacant-"
      * "Unoccupied"
      * "Empty"
      * "Available"
      * "Not rented"
      * Any status indicating the unit is under renovation or not ready (e.g., "Vacant Unrented Not Ready")
    - Statuses that should NOT be counted as vacant include:
      * "Occupied" or any variation (e.g., "Occupied No Notice")
      * "Leased" (even if not yet moved in)
      * Any status indicating a future vacancy (e.g., "Notice to vacate")
    - If you're unsure about a status, err on the side of not counting it as vacant.
    
    Statuses:
    ${statuses.join('\n')}
    
    Please respond with only the number of vacant units, based on these guidelines.
  `;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'o1-mini',
      temperature: 1,
      messages: [
        // {
        //   role: 'system',
        //   content:
        //     'You are an AI assistant helping to count vacant units in a property. Follow the given guidelines strictly.',
        // },
        {
          role: 'user',
          content: prompt2,
        },
      ],
    });

    const responseMessage = completion.choices[0].message.content?.trim();
    return parseInt(responseMessage) || 0;
  }

  getFloorplanBaseSummary(
    data: string[][],
    floorplan: string,
    rentIndex: number,
    marketRentIndex,
    unitSizeIndex,
    vacantUnits,
  ): FloorplanSummaryBaseI {
    const summary: FloorplanSummaryBaseI = {
      rentSum: 0,
      sqftSum: 0,
      count: 0,
      vacantUnits: 0,
      marketRentSum: 0,
      occupiedRentSum: 0,
      nophinMarketRent: 0,
      economicallyVacant: 0,
      unitType: floorplan,
    };

    let count = 0;

    for (const row of data) {
      const rent = this.utilitiesService.stripNonNumericCharacters(
        String(row[rentIndex]),
      );
      if (!rent.trim() && !floorplan) {
        continue;
      }
      const parsedRent = parseFloat(
        this.utilitiesService.stripNonNumericCharacters(String(row[rentIndex])),
      );
      const parsedMarketRent = parseFloat(
        this.utilitiesService.stripNonNumericCharacters(
          String(row[marketRentIndex]),
        ),
      );

      const currentUnitSize = parseFloat(
        this.utilitiesService.stripNonNumericCharacters(
          String(row[unitSizeIndex]),
        ),
      );

      const currentRent = this.conditionalValue(parsedRent, 5000);
      const currentMarketRent = this.conditionalValue(parsedMarketRent, 5000);

      summary.rentSum = summary.rentSum + currentRent;
      summary.marketRentSum = summary.marketRentSum + currentMarketRent;
      summary.sqftSum =
        summary.sqftSum + this.conditionalValue(currentUnitSize, 3000);

      //If the currentRent is greater than 5000
      //It's probably an aggregation
      if (summary.count > vacantUnits) {
        summary.occupiedRentSum += isNaN(currentRent) ? 0 : currentRent;
      }

      if (currentRent < 5000) {
        count++;
      }
    }

    summary.count = count;

    return summary;
  }

  /**
   * RETURNS A VALUE IF IT'S A VALID NUMBER AND NOT GREATER THAN A LIMIT
   * @param value
   * @param limit
   * @returns
   */
  conditionalValue(value: number, limit: number): number {
    if (isNaN(value) || value > limit) return 0;

    return value;
  }

  async generateT12Summary(
    data: RawSummaryItemInterface[],
    lineItemTrueIndex: number,
    lineItemLastIndex: number,
    model: Model,
  ) {
    const majorSummary = {};
    const categoriesAggregator: {
      [key: string]: number;
    } = {};
    const summary: T12SummaryI = {
      rawSummary: [],
      subcategoriesSum: {},
    } as T12SummaryI;
    for (const lineItem of data) {
      const item = lineItem;
      item.category = String(item?.category).toLowerCase();
      item.subcategory = String(item?.subcategory).toLowerCase();

      if (model?.modelMapping && model?.modelMapping?.length) {
        const mapping = model?.modelMapping.find(
          (map) =>
            String(map?.nophinCategory).toLowerCase() === item.subcategory,
        );

        if (mapping) {
          item.subcategory = String(mapping.category)?.toLowerCase();
        }
      }

      if (
        item?.lineItem.toLowerCase().includes('total') ||
        // (
        // item?.property.toLowerCase().includes('gross') &&
        // item?.property?.toLowerCase() !== 'gross potential rent') ||
        !item?.subcategory ||
        !item.category ||
        KNOWN_AGGREGATION_LINE_ITEMS.includes(item?.lineItem?.toLowerCase())
      )
        continue;

      const { category, subcategory } = item;
      const {
        sum,
        currentT3Sum,
        currentT6Sum,
        currentT9Sum,
        annualizedLastMonth,
      } = await this.calculateLineItemSum(
        item.rawData as string[],
        lineItemTrueIndex,
        lineItemLastIndex,
      );

      const stringifiedLineItem = String(item);
      if (
        MAJOR_T12_SUMMARY_KEYS.indexOf(stringifiedLineItem.toLowerCase()) > -1
      ) {
        majorSummary[item.lineItem] = sum;
        continue;
      }

      if (categoriesAggregator[category]) {
        categoriesAggregator[category] += sum;
      } else {
        categoriesAggregator[category] = sum;
      }

      if (summary.subcategoriesSum[subcategory]) {
        summary.subcategoriesSum[subcategory] += sum;
      } else {
        summary.subcategoriesSum[subcategory] = sum;
      }

      // summary[subcategory] = sum;
      item['sum'] = sum;
      // item.rawData = undefined;
      summary.rawSummary.push({
        ...item,
        sum,
        t12: sum,
        t3: currentT3Sum,
        t6: currentT6Sum,
        t9: currentT9Sum,
        annualizedLastMonth,
      });
    }

    return summary;
  }

  async calculateLineItemSum(
    items: Array<string> = [],
    lineItemTrueIndex: number,
    lineItemLastIndex: number,
  ): Promise<{
    sum: number;
    currentT3Sum: number;
    currentT6Sum: number;
    currentT9Sum: number;
    annualizedLastMonth: number;
  }> {
    let sum = 0;
    let termIterator = 1;
    let currentT3Sum = 0,
      currentT6Sum = 0,
      currentT9Sum = 0,
      annualizedLastMonth = 0;

    for (
      let index = lineItemTrueIndex + 1;
      index <= lineItemLastIndex + lineItemTrueIndex - 1;
      index++
    ) {
      const item = String(items[index]);
      if (item.includes('/')) {
        termIterator++;
        continue;
      } //Assume it's a date
      const sanitizedValue = parseFloat(
        this.utilitiesService.sanitizeMoneyString(item),
      );
      if (isNaN(sanitizedValue)) {
        termIterator++;
        continue;
      }

      if (termIterator > 9) {
        currentT3Sum += sanitizedValue;
      }

      if (termIterator > 6) {
        currentT6Sum += sanitizedValue;
      }

      if (termIterator > 3) {
        currentT9Sum += sanitizedValue;
      }

      if (termIterator === 12) {
        annualizedLastMonth = sanitizedValue * 12;
      }
      sum += isNaN(sanitizedValue) ? 0 : sanitizedValue;
      termIterator++;
    }

    return {
      sum,
      currentT3Sum,
      currentT6Sum,
      currentT9Sum,
      annualizedLastMonth,
    };
  }

  calculateOpExSummary(summary: { [key: string]: any }) {
    if (!Array.isArray(summary.rawSummary)) {
      return null;
    }

    const intervals: IntervalsI = {
      categories: {},
      subcategories: {},
    };

    for (const item of summary.rawSummary) {
      const {
        category: originalCategory,
        subcategory: originalSubcategory,
        t3,
        t6,
        t9,
        annualizedLastMonth,
        sum,
      } = item;
      const category = String(originalCategory).toLowerCase();
      const subcategory = String(originalSubcategory).toLowerCase();

      if (!intervals.subcategories[subcategory]) {
        intervals.subcategories[subcategory] = {
          t3: t3 ?? 0,
          t6: t6 ?? 0,
          t9: t9 ?? 0,
          t12: sum ?? 0,
          annualizedLastMonth,
          category: originalCategory,
        };
      } else {
        const oldSubcategoryT3 = intervals.subcategories[subcategory].t3;
        const oldSubcategoryT6 = intervals.subcategories[subcategory].t6;
        const oldSubcategoryT9 = intervals.subcategories[subcategory].t9;
        const oldT12 = intervals.subcategories[subcategory].t12;
        const oldAnnualizedLastMonth =
          intervals.subcategories[subcategory].annualizedLastMonth;
        intervals.subcategories[subcategory].t3 = oldSubcategoryT3 + (t3 ?? 0);
        intervals.subcategories[subcategory].t6 = oldSubcategoryT6 + (t6 ?? 0);
        intervals.subcategories[subcategory].t9 = oldSubcategoryT9 + (t9 ?? 0);
        intervals.subcategories[subcategory].annualizedLastMonth =
          oldAnnualizedLastMonth + (annualizedLastMonth ?? 0);
        intervals.subcategories[subcategory].t12 = oldT12 + (sum ?? 0);
      }

      if (!intervals.categories[category]) {
        intervals.categories[category] = {
          t3: t3 ?? 0,
          t6: t6 ?? 0,
          t9: t9 ?? 0,
          t12: sum ?? 0,
          annualizedLastMonth,
        };
      } else {
        const oldCategoryT3 = intervals.categories[category].t3;
        const oldCategoryT6 = intervals.categories[category].t6;
        const oldCategoryT9 = intervals.categories[category].t9;
        const oldT12 = intervals.categories[category].t12;
        const oldAnnualizedLastMonth =
          intervals.categories[category].annualizedLastMonth;
        intervals.categories[category].t3 = oldCategoryT3 + (t3 ?? 0);
        intervals.categories[category].t6 = oldCategoryT6 + (t6 ?? 0);
        intervals.categories[category].t9 = oldCategoryT9 + (t9 ?? 0);
        intervals.categories[category].annualizedLastMonth =
          oldAnnualizedLastMonth + (annualizedLastMonth ?? 0);
        intervals.categories[category].t12 = oldT12 + (sum ?? 0);
      }
    }

    return intervals;
  }
}
