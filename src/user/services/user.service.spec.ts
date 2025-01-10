import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { Provider } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthorizationToken } from '../entities/authToken.entity';
import { User } from '../entities/user.entity';
import { Organization } from 'src/organization/entities/organization.entity';
// import { DealBox } from 'src/deals/entities/dealBox.entity';
import { PostHog } from 'posthog-node';
import { mockRepository } from '../../utilities/test.utility';

export const postHogMock = {
  capture: jest.fn(),
  // Add mock implementations for other methods as needed
} as unknown as jest.Mocked<PostHog>;

export const userServiceTestProviders: Provider[] = [
  UserService,
  {
    provide: getRepositoryToken(AuthorizationToken),
    useValue: mockRepository,
  },
  {
    provide: getRepositoryToken(User),
    useValue: mockRepository,
  },
  {
    provide: getRepositoryToken(Organization),
    useValue: mockRepository,
  },
  // {
  //   provide: getRepositoryToken(DealBox),
  //   useValue: mockRepository,
  // },
  {
    provide: PostHog, // Provide the mock PostHog class
    useValue: postHogMock,
  },
];

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    process.env.POST_HOG_API_KEY = 'YOUR_TEMPORARY_API_KEY_FOR_TESTING';
    const module: TestingModule = await Test.createTestingModule({
      providers: [...userServiceTestProviders],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
