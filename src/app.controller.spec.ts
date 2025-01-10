import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LlmService } from './llm/services/llm.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'YOUR_TEMPORARY_API_KEY_FOR_TESTING';
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, LlmService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('Should be defined', () => {
      expect(appController.getHello()).toBeDefined();
    });
  });
});
