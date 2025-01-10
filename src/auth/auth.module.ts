import {
  Module,
  MiddlewareConsumer,
  NestModule,
  DynamicModule,
} from '@nestjs/common';
import { UserModule } from '../user/user.module';

import { AuthMiddleware } from './auth.middleware';
import { ConfigInjectionToken, AuthModuleConfig } from './config.interface';
import { SupertokensService } from './supertokens/supertokens.service';
import { OrganizationModule } from 'src/organization/organization.module';

@Module({
  providers: [],
  exports: [SupertokensService],
  controllers: [],
  imports: [],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }

  static forRoot({
    connectionURI,
    apiKey,
    appInfo,
  }: AuthModuleConfig): DynamicModule {
    return {
      providers: [
        {
          useValue: {
            appInfo,
            connectionURI,
            apiKey,
          },
          provide: ConfigInjectionToken,
        },
        SupertokensService,
      ],
      exports: [SupertokensService],
      imports: [UserModule, OrganizationModule],
      module: AuthModule,
    };
  }
}
