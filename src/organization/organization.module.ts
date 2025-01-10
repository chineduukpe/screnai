import { Module } from '@nestjs/common';
import { OrganizationService } from './services/organization.service';
import { OrganizationController } from './controllers/organization.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { User } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/services/user.service';
import { AuthorizationToken } from 'src/user/entities/authToken.entity';
import { ModelModule } from 'src/model/model.module';
import { DealModule } from 'src/deal/deal.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, UserService],
  imports: [
    TypeOrmModule.forFeature([Organization, User, AuthorizationToken]),
    ModelModule,
    DealModule,
    MailModule,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
