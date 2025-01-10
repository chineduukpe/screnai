import {
  Controller,
  Get,
  Post,
  Body,
  Session,
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from '../services/organization.service';
import {
  CreateOrganizationLoginDto,
  // InviteUserDTO,
} from '../dto/create-organization.dto';
import { SessionContainer } from 'supertokens-node/recipe/session';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  createOranizationOnLogin(
    @Body() createOrganizationDto: CreateOrganizationLoginDto,
  ) {
    return this.organizationService.createOranizationOnLogin(
      createOrganizationDto,
    );
  }

  @Get('users')
  @UseGuards(new AuthGuard())
  findAllUsers(@Session() session: SessionContainer) {
    return this.organizationService.findAllUsers(session.getUserId());
  }

  // @Post('invite')
  // @UseGuards(new AuthGuard())
  // inviteUser(
  //   @Session() session: SessionContainer,
  //   @Body() data: InviteUserDTO,
  // ) {
  //   return this.organizationService.inviteUser(session.getUserId(), data);
  // }
}
