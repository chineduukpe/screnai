import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GoogleService } from 'src/utilities/services/google.service';
import { GMAIL_MOCK } from '../mock/gmail.notification.mock';
import { UtilitiesService } from 'src/utilities/services/utilities.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import {
  ACCEPTED_FILE_MIMES,
  DocumentStatusENUM,
  EXTRACTABLE_DOCUMENT_TYPES,
} from 'src/utilities/constants';
import { AWSService } from 'src/utilities/services/aws.service';
import { EmailDocument } from 'src/document/entities/email.document.entity';
import { DealService } from './deal.service';
import { GptService } from 'src/gpt/gpt.service';
import pdf from 'pdf-parse';
import { Document } from 'src/document/entities/document.entity';
import { GMAIL_MOCK_THREAD } from '../mock/gmail.thread.mock';
import { PropertyService } from 'src/property/services/property.service';
import { Model } from 'src/model/entities/model.entity';
import { gmail_v1 } from 'googleapis';

@Injectable()
export class EmailDealService {
  private logger = new Logger(EmailDealService.name);
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(EmailDocument)
    private emailDocRepo: Repository<EmailDocument>,
    @InjectRepository(Document) private documentRepo: Repository<Document>,
    @InjectRepository(Model) private modelRepo: Repository<Model>,
    private googleService: GoogleService,
    private utilitiesService: UtilitiesService,
    private awsService: AWSService,
    private dealService: DealService,
    private gptService: GptService,
    private propertyService: PropertyService, // private modelService: ModelService,
  ) {}
  async processGmailNotification(body: any) {
    const data = await this.googleService.handleNotification(body);

    if (!data) return;

    const deal = await this.dealService.findOnByThreadId(
      String(data.historyId),
    );
    if (deal) {
      this.logger.fatal(
        `Duplicate processing for email with history id #${data?.historyId}`,
      );
      return;
    }
    return this.processSingleMail(data);
  }

  extractEmailMainBody(payload: typeof GMAIL_MOCK.payload): string {
    let body = '';

    if (payload.parts) {
      payload.parts.forEach((part) => {
        if (part.mimeType === 'text/plain' && part.body.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf8');
        }
        if (part.mimeType === 'multipart/alternative') {
          part.parts.forEach((subPart) => {
            if (subPart.mimeType === 'text/plain' && subPart.body.data) {
              body = Buffer.from(subPart.body.data, 'base64').toString('utf8');
            }
          });
        }
      });
    }

    return body;
  }

  async processSingleMail(body: gmail_v1.Schema$Message) {
    /**
     * FIRST CHECK IF THE RECIPIENT EMAIL IS REGISTERED ON NOPHIN
     */

    const { payload } = body;

    const sender = payload.headers.find(
      (header) => String(header.name).toLowerCase() === 'from',
    );

    if (!sender) {
      return this.logger.debug('No Sender found in email headers');
    }

    const senderEmail: string =
      this.utilitiesService.extractEmailFromRecipientString(sender.value);
    console.log(senderEmail, 'EMAIL>>>>>');
    const user = await this.userRepo.findOne({
      where: {
        email: senderEmail,
      },
    });

    if (!user) {
      //   throw new HttpException(
      //     'User with sender email not found in Nophin DB',
      //     404,
      //   );
      this.logger.debug(`User with email ${senderEmail} not found in DB`);
      return;
    }

    const subject = payload.headers.find(
      (header) => String(header.name).toLowerCase() === 'subject',
    );

    if (!subject) {
      throw new BadRequestException('No subject found in email');
    }

    const thread: typeof GMAIL_MOCK_THREAD = await this.googleService.getThread(
      body.threadId,
    );

    const validAttachmentIds = this.extractAttachmentIdsFromEmailThread(
      thread.messages,
    );

    //Todo: Verify with team if we should throw away emails with no attahment
    if (validAttachmentIds.length < 1) {
      throw new BadRequestException('No attachments found');
    }

    let emailBody = '';

    for (const message of thread.messages) {
      emailBody = this.extractEmailMainBody(message.payload);

      if (emailBody) break;
    }

    const address = await this.gptService.generatePropertyAddressFromEmail(
      emailBody,
    );

    const dealName = await this.gptService.generateDealNameFromEmail(
      `${subject.value} \n ${emailBody}`,
    );

    const property = await this.propertyService.findOneByNameOrCreate(
      address,
      dealName,
    );

    let model = await this.modelRepo.findOne({
      where: {
        organizationId: user?.organizationId,
        isDefault: true,
      },
    });

    //Pick the organization's latest model if they don't have a default model
    if (!model) {
      model = await this.modelRepo.findOne({
        where: {
          organizationId: user?.organizationId,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    }

    const deal = await this.dealService.create({
      dealName,
      dealAddress: address,
      organizationId: user?.organizationId,
      propertyId: property?.id,
      userId: user?.id,
      activeModelSyncId: model?.id,
      emailThreadId: String(body?.historyId),
    });

    await this.dealService.duplicateModelForDeal(deal);

    const downloadedFiles = [];

    const sessionId = Math.floor(Math.random() * 999000);

    //Sometimes, attachments are duplicated
    // Eliminate duplicates

    const validAttachmentSet = new Set();

    for (const attachment of validAttachmentIds) {
      validAttachmentSet.add(attachment.name);
    }

    const updatedAttachmentSets = [];

    for (const name of [...validAttachmentSet]) {
      const foundAttachment = validAttachmentIds.find((e) => e.name === name);
      updatedAttachmentSets.push(foundAttachment);
    }

    for (const item of updatedAttachmentSets) {
      console.log(item.name, 'RUNNING FFOR DOCUMENT');
      const attachmentBuffer = await this.googleService.downloadAttachment(
        body.id,
        item.id,
      );
      console.log(
        item.name.toLowerCase().includes('costar'),
        'INCLUDES costar',
      );

      if (item.name.toLowerCase().includes('costar')) {
        continue;
      }
      let fileType = 'others';
      if (
        String(item.name).toLowerCase().endsWith('pdf') &&
        !item.name.toLowerCase().includes('costar')
      ) {
        const pdfData = await this.extractPDFPages(attachmentBuffer, 2);
        fileType = await this.gptService.determineEmailFileType(
          pdfData.slice(0, 8000),
        );

        console.log('FIle Type', fileType);
      }

      const url = await this.awsService.uploadBufferToS3(
        attachmentBuffer,
        `email-extracts/${this.utilitiesService.sanitizeFilenameForUrl(
          item.name,
        )}`,
      );

      downloadedFiles.push({ url, fileName: item.name });
      await this.emailDocRepo.save({
        email: user.email,
        documentURL: url,
        sessionId,
        subject: subject.value,
        dealId: deal?.id,
      });

      const formattedFileType =
        fileType === 'operating statement'
          ? 'trailing-12'
          : fileType === 'rent roll'
          ? 'rent-roll'
          : fileType;

      await this.documentRepo.save({
        documentName: item.name,
        inputFileURL: url,
        dealId: deal?.id,
        fileType: formattedFileType,
        status: EXTRACTABLE_DOCUMENT_TYPES.includes(formattedFileType)
          ? DocumentStatusENUM.UPLOADED
          : DocumentStatusENUM.SYNC_COMPLETED,
        userId: user?.id,
      });
    }

    console.log(downloadedFiles);
  }

  async extractPDFPages(pdfBuffer: Buffer, maxPage = 2): Promise<string> {
    console.log('Extracting document');
    const response = await new Promise<string>((resolve, reject) => {
      try {
        pdf(pdfBuffer, { max: maxPage }).then(function (data) {
          resolve(data.text);
        });
      } catch (error) {
        reject('Could not parse PDF');
        console.log('ERror occured', error);
      }
    });

    return response;
  }

  extractAttachmentIdsFromEmailPart(
    parts: typeof GMAIL_MOCK.payload.parts,
    // parts: typeof GMAIL_MOCK.payload.parts,
  ): { id: string; name: string }[] {
    const validAttachments: { id: string; name: string }[] = [];

    for (const part of parts) {
      for (const innerPart of part.parts ?? []) {
        if (
          ACCEPTED_FILE_MIMES.includes(String(innerPart.mimeType).toLowerCase())
        ) {
          if (!innerPart?.body?.attachmentId) continue;
          validAttachments.push({
            id: innerPart.body?.attachmentId,
            name: innerPart?.filename,
          });
        }
      }
    }

    return validAttachments;
  }

  extractAttachmentIdsFromEmailThread(
    messages: typeof GMAIL_MOCK_THREAD.messages,
    // parts: typeof GMAIL_MOCK.payload.parts,
  ): { id: string; name: string }[] {
    const validAttachments: { id: string; name: string }[] = [];

    for (const message of messages) {
      for (const part of message.payload.parts) {
        // if (part?.filename && String(part?.filename).length > 0) {

        // }

        if (Array.isArray(part.parts)) {
          for (const innerPart of part.parts) {
            if (ACCEPTED_FILE_MIMES.includes(innerPart.mimeType)) {
              validAttachments.push({
                id: innerPart.body?.attachmentId,
                name: innerPart.filename,
              });
            }
          }
        } else {
          if (
            ACCEPTED_FILE_MIMES.includes(String(part.mimeType).toLowerCase())
          ) {
            validAttachments.push({
              id: (part.body as any).attachmentId,
              name: part.filename,
            });
            // validAttachmentIds.push({
            //   id: String(part?.body?.attachmentId),
            //   name: part.filename,
            // });
          }
        }
      }
    }

    return validAttachments;
  }
}
