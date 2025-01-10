import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LlmModule } from './llm/llm.module';
import { LlmService } from './llm/services/llm.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { OrganizationModule } from './organization/organization.module';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from 'db/data-source';
import { PropertyModule } from './property/property.module';
import { DealModule } from './deal/deal.module';
import { ModelModule } from './model/model.module';
import { UtilitiesModule } from './utilities/utilities.module';
import { DocumentModule } from './document/document.module';
import { EventsModule } from './events/events.module';
import { ScheduleModule } from '@nestjs/schedule';
import { GptModule } from './gpt/gpt.module';
import { CronModule } from './cron/cron.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConversationModule } from './conversation/conversation.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV}`,
      isGlobal: true,
    }),
    AuthModule.forRoot({
      connectionURI: process.env.SUPERTOKENS_URI,
      apiKey: process.env.SUPERTOKENS_API_KEY,
      appInfo: {
        appName: process.env.APP_NAME,
        apiDomain: process.env.API_DOMAIN,
        websiteDomain: process.env.APP_DOMAIN,
        apiBasePath: '/auth',
        websiteBasePath: '/auth',
      },
    }),
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: process.env.MAIL_HOST,
          secure: false,
          port: parseInt(process.env.MAIL_PORT),
          auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
          },
        },
        defaults: {
          from: '"No Reply" <hello@nophin.com>',
        },
        template: {
          dir: join(__dirname, '../mail/templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    ScheduleModule.forRoot(),
    LlmModule,
    UserModule,
    OrganizationModule,
    PropertyModule,
    DealModule,
    ModelModule,
    UtilitiesModule,
    DocumentModule,
    EventsModule,
    GptModule,
    CronModule,
    ConversationModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService, LlmService],
})
export class AppModule {}
