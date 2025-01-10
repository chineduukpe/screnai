import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DealService } from 'src/deal/services/deal.service';
import { DocumentService } from 'src/document/services/document.service';
import { DocumentStatusENUM, DocumentTypeENUM } from 'src/utilities/constants';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  constructor(
    private dealService: DealService,
    private documentService: DocumentService,
  ) {}

  @Cron('*/5 * * * * *')
  async handleModelSyncJob() {
    const deals = await this.dealService.findPendingDealsToSync();

    this.logger.debug(`Found ${deals.length} deals with documents to sync`);

    for (const deal of deals) {
      for (const document of deal.documents) {
        document.status = DocumentStatusENUM.SYNCING_TO_MODEL;
        await this.documentService.updateSingleDocument(document.id, document);

        this.dealService
          .syncDealDocument(deal, document)
          .then(async () => {
            document.status = DocumentStatusENUM.SYNC_COMPLETED;
            await this.documentService.updateSingleDocument(
              document.id,
              document,
            );
          })
          .then(() => {
            this.dealService.computeDealBenchmarks(deal.id);
          })
          .catch((error) => {
            console.log(error);
          });
      }
    }
  }
}
