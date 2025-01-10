import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';
import { GMAIL_MOCK_THREAD } from 'src/deal/mock/gmail.thread.mock';
import { AWSService } from './aws.service';

@Injectable()
export class GoogleService {
  private jwtClient: JWT;

  constructor(private awsService: AWSService) {
    this.jwtClient = new google.auth.JWT(
      process.env.GMAIL_CLIENT_SERVICE_EMAIL,
      null,
      process.env.GMAIL_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/gmail.readonly'],
      process.env.GMAIL_WEBHOOK_EMAIL,
    );
  }

  formatPrivateKey(privateKey: string): string {
    return privateKey.replace(/\\n/g, '\n');
  }

  async getJWTClientAsync() {
    const privateKey =
      "await this.awsService.getAppSecret('GMAIL_PRIVATE_KEY')";
    // const privateKey = await this.awsService.getAppSecret('GMAIL_PRIVATE_KEY');

    return new google.auth.JWT(
      process.env.GMAIL_CLIENT_SERVICE_EMAIL,
      null,
      this.formatPrivateKey(privateKey),
      ['https://www.googleapis.com/auth/gmail.readonly'],
      process.env.GMAIL_WEBHOOK_EMAIL,
    );
  }

  async getGmailClient() {
    const jwtClient = await this.getJWTClientAsync();

    jwtClient.authorize();
    // await this.jwtClient.authorize();
    return google.gmail({ version: 'v1', auth: jwtClient });
  }

  async listMessages() {
    const gmail = await this.getGmailClient();
    const res = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: 1,
    });

    const messages = res.data.messages;
    const fetchedMessages = [];
    for (const message of messages) {
      fetchedMessages.push(await this.getMessage(message.id));
    }
    return fetchedMessages;
  }

  async downloadAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<Buffer> {
    const gmail = await this.getGmailClient();
    const res = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId,
    });
    const attachment = res.data;
    return Buffer.from(attachment.data, 'base64');
  }

  async getMessage(id: string) {
    const gmail = await this.getGmailClient();
    const res = await gmail.users.messages.get({
      userId: 'me',
      id,
    });
    return res.data;
  }

  async getThread(id: string) {
    const gmail = await this.getGmailClient();
    const res = await gmail.users.threads.get({
      userId: 'me',
      id,
    });
    return res.data as typeof GMAIL_MOCK_THREAD;
  }

  // async onModuleInit() {
  //   try {
  //     await this.watchEmails();
  //   } catch (e) {
  //     console.log('Error occured', e);
  //   }
  // }

  async watchEmails() {
    // const auth = this.getOAuth2Client();
    // const gmail = google.gmail({ version: 'v1', auth });
    const gmail = await this.getGmailClient();

    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['UNREAD', 'INBOX'],
        // topicName: 'projects/email-427707/topics/gmail-messaging-nophin',
        topicName:
          'projects/email-polling-427719/topics/main-nophin-email-polling',
      },
    });

    console.log('Watch response:', res.data);
  }

  async handleNotification(body: any) {
    const message = Buffer.from(body.message.data, 'base64').toString('utf-8');
    const data = JSON.parse(message);

    if (typeof message === 'string') {
      try {
        console.log('Recepient email: ', data.emailAddress);
        if (data.emailAddress !== process.env.GMAIL_WEBHOOK_EMAIL) {
          return null;
        }
      } catch (error) {
        return null;
      }
    }

    const gmail = await this.getGmailClient();

    const resList = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: 4,
    });

    const messageId = resList.data.messages[0].id;
    const resMessage = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    console.log('New email:', resMessage.data);
    // fs.writeFileSync('logs/gmail.log', JSON.stringify(resThread.data));
    return resMessage.data;
    // Process the email as needed
  }
}
