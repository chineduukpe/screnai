import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { Provider } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Organization } from '../entities/organization.entity';
import { userServiceTestProviders } from 'src/user/services/user.service.spec';
import { MailerService } from '@nestjs-modules/mailer';
import { mockRepository } from '../../utilities/test.utility';

export const organizationServiceTestProviders: Provider[] = [
  OrganizationService,
  ...userServiceTestProviders,
  {
    provide: getRepositoryToken(Organization),
    useValue: mockRepository,
  },
  {
    provide: MailerService,
    useValue: {},
  },
];

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [...organizationServiceTestProviders],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
