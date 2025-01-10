import { Injectable } from '@nestjs/common';
import {
  RRSummaryI,
  SingleRRUnitSummaryI,
} from 'src/document/interfaces/document.entitiy.interfaces';

@Injectable()
export class RRUtilityService {
  getRRSheetSummary(summary: RRSummaryI): { [key: string]: RRSummaryI } {
    const analysis = {};

    if (!summary || !summary.floorplans) return {};

    const summaryKeys: string[] = Object.keys(summary.floorplans);

    for (const key of summaryKeys) {
      const value = summary.floorplans[key] as SingleRRUnitSummaryI;

      //Skip direct float value
      // if (typeof value !== 'object' || !value.hasOwnProperty('unitType'))
      //   continue;

      const sum = value.rentSum ?? 0;
      const count = value.count;
      const sqftSum = value.sqftSum;
      const marketRent = value.marketRentSum;
      const misc = value.miscSum;
      const vacantUnits = value.vacantUnits ?? 0;
      let beds = value.beds;
      let baths = value.baths;
      const proforma = value.proforma ?? 0;
      const economicallyVacant = value.economicallyVacant ?? 0;
      const occupiedRentSum = value.occupiedRentSum;
      // let average_rent: number = sum / count;
      let averageRent: number = occupiedRentSum / (count - vacantUnits);
      let averageRentPerSF: number = sqftSum && sqftSum ? sum / sqftSum : 0;
      const averageMarketRent: number = marketRent ? marketRent / count : 0;

      averageRent = parseFloat(averageRent.toFixed(2).toString());
      averageRentPerSF = parseFloat(averageRentPerSF.toFixed(2).toString());

      beds = parseFloat(String(beds));
      baths = parseFloat(String(baths));
      const totalUnitCount = Number(summary?.totals?.unitCount);
      const unitRatio =
        typeof totalUnitCount !== 'number' &&
        isNaN((count * 100) / totalUnitCount)
          ? 0
          : (count * 100) / totalUnitCount;

      const averageSqft = isNaN(sqftSum / count) ? 0 : sqftSum / count;
      // const average_rent = sum / count;

      analysis[key] = {
        sum,
        count,
        sqftSum,
        marketRent,
        misc,
        vacantUnits,
        beds,
        baths,
        proforma,
        economicallyVacant,
        occupiedRentSum,
        averageRent,
        averageRentPerSF,
        averageMarketRent,
        averageSqft,
        unitRatio,
        unitType: key,
      };
    }

    return analysis;
  }

  mapRRColumnToAnalysisKey(column: string): string | null {
    switch (String(column).toLowerCase()) {
      case 'unit type':
        return 'unitType';
      case 'beds':
        return 'beds';
      case 'baths':
        return 'baths';
      case 'unit count':
        return 'count';
      case 'unit count %':
        return 'unitRatio';
      case 'total sq ft':
        return 'sqftSum';
      case 'avg sq ft':
        return 'averageSqft';
      case 'avg market rent':
        return 'averageMarketRent';
      case 'total rent':
        return 'sum';
      case 'avg rent':
        return 'averageRent';
      case 'avg rent/sf':
        return 'averageRentPerSF';
      case 'vacant':
        return 'vacant';
      case 'economic vacant':
        return 'economicallyVacant';
      case 'occupied':
        return 'occupied';
      default:
        return null;
    }
  }
}
