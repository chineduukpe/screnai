import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendInviteWelcomeEmail(data: any) {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: `${data.username} has invited you to join them in Nophin.`,
        template: 'invite-user',
        context: {
          name: data.name,
          organization: data.company,
          username: data.username,
        },
      });
      console.log('Email sent successfully!'); // Optional: Log success message
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendFailedExtraction(data: any) {
    try {
      await this.mailerService.sendMail({
        to: 'support@nophin.com',
        subject: `File Extraction Failure Report.`,
        template: 'send-failed-extraction',
        context: {
          fileURL: data?.fileURL,
          type: data?.type,
          dealId: data?.dealId,
          fileName: data?.fileName,
          userEmail: data?.userEmail,
          userName: data?.userName,
          errorBody: data?.errorBody,
          additionalMessage: data?.additionalMessage,
          extractedFileURL: data?.extractedFileURL,
        },
      });
      console.log('Email sent successfully!'); // Optional: Log success message
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendBenchmarkResult(data: any) {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: `Analysis Report for ${data?.dealName}.`,
        template: 'analysis-completed',
        context: {
          address: data?.address,
          userName: data?.userName,
          benchmarks: data?.benchmarks,
          link: data?.link,
        },
      });
      console.log('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }
  async sendVerificationEmail(data: any) {
    console.log(data, 'dattta from send email');
    const currentYear = new Date().getFullYear();
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: `Verify your email address.`,
        template: 'send-verification-email',
        context: {
          verificationLink: data?.verificationLink,
          currentYear,
        },
      });
      console.log('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendTestEmail() {
    await this.mailerService.sendMail({
      to: 'geefive3@gmail.com',
      subject: `Test Nophin Email`,
      template: 'test',
    });
  }
}
