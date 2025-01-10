import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SlackService {
  async broadcastFileUpload(
    userFullName: string,
    userOrg: string,
    fileId: number,
    fileUrl: string,
  ): Promise<number> {
    const messageBody = this.broadcastMessageTemplate(
      userFullName,
      userOrg,
      fileId,
      fileUrl,
    );
    const response = ['staging', 'production', 'testing'].includes(
      process.env.NODE_ENV,
    )
      ? await axios.post(
          process.env.SLACK_INCOMING_WEBHOOK_URL,
          // process.env.SLACK_TESTING_WEBHOOK_URL,
          messageBody,
        )
      : { status: 200 };

    return response.status;
  }

  private broadcastMessageTemplate(
    userFullName: string,
    userOrg: string,
    fileId: number,
    fileUrl: string,
  ) {
    const message = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `New File Upload Job on ${process.env.NODE_ENV}:\n*<${fileUrl}|${userFullName} - ${userOrg}>* `,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*File ID:*\n${fileId}\n*File URL:*\n${fileUrl}`,
          },
        },
      ],
    };

    return message;
  }

  async sendNewConversationNotification({
    userFullName,
    email,
    organizationId,
    conversationId,
  }) {
    return 'HEllo world';
    const message = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `New conversation started on ${process.env.NODE_ENV}:\nName: *${userFullName}* \n Email: *${email}* \nOrganization: *${organizationId}*\nConversation ID: ${conversationId} `,
          },
        },
        // {
        //   type: 'section',
        //   text: {
        //     type: 'mrkdwn',
        //     text: `\n\n*Extraction ID:* ${extractionId}\n*File ID:* ${fileId}\n*File URL:*\n${fileUrl}`,
        //   },
        // },
      ],
    };
    return await axios.post(process.env.SLACK_INCOMING_WEBHOOK_URL, message);
  }

  async broadcastGeneralMessage(
    userFullName: string,
    userOrg: string,
    fileId: number,
    extractionId: number,
    fileUrl: string,
    textMessage?: string,
  ): Promise<number> {
    const messageBody = this.broadcastSuccessMessageTemplate(
      userFullName,
      userOrg,
      fileId,
      extractionId,
      fileUrl,
      textMessage,
    );
    const response = ['staging', 'production', 'testing'].includes(
      process.env.NODE_ENV,
    )
      ? await axios.post(process.env.SLACK_INCOMING_WEBHOOK_URL, messageBody)
      : { status: 200 };

    return response.status;
  }

  async broadcastDeletedSubscription(
    userFullName: string,
    userOrg: string,
  ): Promise<number> {
    const msg = `*Subscription Deleted* on ${process.env.NODE_ENV}:\n\n ${userFullName} from ${userOrg} deleted their subscription`;

    const messageBody = this.broadcastDeletedSubscriptionTemplate(msg);

    const response = ['staging', 'production', 'testing'].includes(
      process.env.NODE_ENV,
    )
      ? await axios.post(
          process.env.SLACK_SUBSCRIPTION_WEBHOOK_URL,
          messageBody,
        )
      : { status: 200 };

    return response.status;
  }

  async broadcastSuccessfulSubscription(
    userFullName: string,
    userOrg: string,
  ): Promise<number> {
    const msg = `*New Subscription Added* on ${process.env.NODE_ENV}:\n\n ${userFullName} from ${userOrg} added a new subscription to their organization`;

    const messageBody = this.broadcastDeletedSubscriptionTemplate(msg);
    const response = ['staging', 'production', 'testing'].includes(
      process.env.NODE_ENV,
    )
      ? await axios.post(
          process.env.SLACK_SUBSCRIPTION_WEBHOOK_URL,
          messageBody,
        )
      : { status: 200 };

    return response.status;
  }

  private broadcastDeletedSubscriptionTemplate(messageBody: string) {
    const message = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: messageBody,
          },
        },
      ],
    };

    return message;
  }

  private broadcastSuccessMessageTemplate(
    userFullName: string,
    userOrg: string,
    fileId: number,
    extractionId: number,
    fileUrl: string,
    textMessage: string,
  ) {
    const message = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${textMessage} on ${process.env.NODE_ENV}:\n*<${fileUrl}|${userFullName} - ${userOrg}>* `,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `\n\n*Extraction ID:* ${extractionId}\n*File ID:* ${fileId}\n*File URL:*\n${fileUrl}`,
          },
        },
      ],
    };

    return message;
  }
}
