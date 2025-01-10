import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Session,
  Query,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { SessionContainer } from 'supertokens-node/recipe/session';
import { UpdateUserDto } from '../dto/update-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @UseGuards(new AuthGuard())
  @Post('send-verification-email')
  async sendVerificationEmail(
    @Body() data: { email: string },
    @Session() session: SessionContainer,
  ) {
    const user = await this.userService.findOne(session.getUserId());
    return await this.userService.sendVerificationEmail({
      email: data?.email,
      userName: user?.firstName || user?.fullName,
    });
  }

  @UseGuards(new AuthGuard())
  @Post('complete-onboarding')
  async completeOnboarding(@Body() data: any) {
    return await this.userService.completeOnboarding(data);
  }

  @UseGuards(new AuthGuard())
  @Post('verify-email-address')
  async verifiyEmailAddress(@Body() data: { email: string; token: string }) {
    return await this.userService.verifiyEmailAddress(data);
  }

  @Post('forget-password')
  forgetPassword(@Body() data: any) {
    return this.userService.forgetPassword(data.email);
  }

  @Get('generate-auth-token')
  generateAuthToken() {
    return this.userService.generateAuthToken();
  }

  @Get('verify-field')
  verifyField(
    @Query('email') email?: string,
    @Query('organization') organization?: string,
  ) {
    console.log(email, 'email');
    return this.userService.verifyField(email, organization);
  }

  @UseGuards(new AuthGuard())
  @Get('/dashboard/analytics')
  async getUserDashboardAnalytics(@Session() session: SessionContainer) {
    const userId: string = session.getUserId();
    return await this.userService.getUserDashboardAnalytics(userId);
  }

  @Get('token')
  generateAllAuthToken() {
    return this.userService.generateAllAuthToken();
  }

  @Get('validate-auth-token')
  validateAuthToken(@Query('token') token: string) {
    return this.userService.validateAuthToken(token);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @UseGuards(new AuthGuard())
  @Get('get-single-user')
  async findOne(@Session() session: SessionContainer) {
    console.log(session.getUserId(), 'USER IDDDD');
    const user = await this.userService.findOne(session.getUserId());
    return user;
  }

  @UseGuards(new AuthGuard())
  @Patch()
  update(
    @Body() updateUserDto: UpdateUserDto,
    @Session() session: SessionContainer,
  ) {
    console.log(updateUserDto, 'updateUserDto');
    return this.userService.update(session.getUserId(), updateUserDto);
  }

  @UseGuards(new AuthGuard())
  @Delete(':id')
  remove(@Param('id') id: any) {
    return this.userService.remove(id);
  }
}
