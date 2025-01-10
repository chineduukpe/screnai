import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DealService } from 'src/deal/services/deal.service';
import { Document } from 'src/document/entities/document.entity';
import { DocumentService } from 'src/document/services/document.service';
import { EventsGateway } from 'src/events/events.gateway';
import { MailService } from 'src/mail/mail.service';
import { UserService } from 'src/user/services/user.service';
import { DocumentStatusENUM, DocumentTypeENUM } from 'src/utilities/constants';
import { Repository } from 'typeorm';
import { logErrorDecorator } from 'src/utilities/logDecorator.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  constructor(
    @InjectRepository(Document) private documentRepo: Repository<Document>,
    private dealService: DealService,
    private mailService: MailService,
    private userService: UserService,
    // private documentService: DocumentService,
    private events: EventsGateway,
  ) {}

  @Cron('*/5 * * * * *')
  @logErrorDecorator()
  async handleModelSyncJob() {
    // const deals = await this.dealService.findPendingDealsToSync();
    const deals = [];

    this.logger.debug(`Found ${deals.length} deals with documents to sync`);

    for (const deal of deals) {
      if (!deal.activeModelSyncId) continue;
      for (const document of deal.documents) {
        document.status = DocumentStatusENUM.SYNCING_TO_MODEL;
        await this.documentRepo.update(document.id, document);
        // return;
        // await this.documentService.updateSingleDocument(document.id, document);

        this.dealService
          .syncDealDocument(deal, document)
          .then(async () => {
            const updatedDocument = await this.documentRepo.findOne({
              where: {
                id: document.id,
              },
            });
            updatedDocument.status = DocumentStatusENUM.SYNC_COMPLETED;
            await this.documentRepo.update(document.id, updatedDocument);
          })
          .then(async () => {
            await this.dealService.computeDealBenchmarks(deal.id);

            const updatedDeal = await this.dealService.findOne(deal.id);
            const user = await this.userService.findOne(updatedDeal.userId);

            if (
              !updatedDeal.notifcationSent &&
              updatedDeal?.comparables?.benchmarks?.length
            ) {
              const data = {
                email: user?.email,
                address: updatedDeal?.dealAddress,
                userName: user?.fullName,
                benchmarks: updatedDeal.comparables.benchmarks,
                dealName: updatedDeal?.dealName,
              };

              await this.mailService.sendBenchmarkResult(data);
            }
          })
          .catch((error) => {
            console.log(error);
          });
      }
    }
  }
}
