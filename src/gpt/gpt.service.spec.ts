import { Test, TestingModule } from '@nestjs/testing';
import { GptService } from './gpt.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Deal } from 'src/deals/entities/deal.entity';
import { mockRepository } from 'src/utilities/test.repository.providers.utility';

describe('GptService', () => {
  let service: GptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GptService,
        {
          provide: getRepositoryToken(Deal),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<GptService>(GptService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
