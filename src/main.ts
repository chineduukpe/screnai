import { ValidationPipe, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import supertokens from 'supertokens-node';
import { SupertokensExceptionFilter } from './auth/auth.filter';
import { CloudWatchLoggerInterceptor } from './interceptors/cloudwatch-logger.interceptor';
import * as Sentry from '@sentry/node';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevels: LogLevel[] = isProduction
    ? ['error', 'warn', 'log']
    : ['error', 'warn', 'log', 'verbose', 'debug'];

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
    rawBody: true,
  });

  app.enableCors({
    origin: [
      process.env.APP_DOMAIN,
      process.env.APP_DOMAIN_2,
      /\.scren\.ai/,
      'https://main.d1w9ypisew7syp.amplifyapp.com',
    ],
    allowedHeaders: [
      'content-type',
      ...supertokens.getAllCORSHeaders(),
      // 'Access-Control-Allow-Headers',
      'sentry-trace',
      'baggage',
    ],
    credentials: true,
  });

  app.useGlobalFilters(new SupertokensExceptionFilter());
  app.useGlobalInterceptors(new CloudWatchLoggerInterceptor());
  // app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  if (process.env.NODE_ENV !== 'development') {
    Sentry.init({
      dsn: process.env.SENTRY_API,
      environment: process.env.NODE_ENV,
    });
  }
  await app.listen(8000);
}
bootstrap();
