import { Body, Controller, Get, Post } from '@nestjs/common';

@Controller()
export class AppController {
  @Post()
  async getHello() {
    return 'Hello world';
  }

  @Get('/healthcheck')
  async healthCheck() {
    return 'Ok';
  }
}
