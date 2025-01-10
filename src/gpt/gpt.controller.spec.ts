import { Test, TestingModule } from '@nestjs/testing';
import { GptController } from './gpt.controller';
import { GptService } from './gpt.service';
import { mockRepository } from 'src/utilities/test.repository.providers.utility';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Deal } from 'src/deals/entities/deal.entity';

describe('GptController', () => {
  let controller: GptController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GptController],
      providers: [
        GptService,
        {
          provide: getRepositoryToken(Deal),
          useValue: mockRepository,
        },
      ],
    }).compile();

    controller = module.get<GptController>(GptController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
