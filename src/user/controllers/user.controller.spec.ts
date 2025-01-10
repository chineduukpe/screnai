import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { userServiceTestProviders } from '../services/user.service.spec';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [...userServiceTestProviders],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
