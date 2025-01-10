import { Injectable } from '@nestjs/common';
import {
  CreateOrganizationLoginDto,
  // InviteUserDTO,
} from '../dto/create-organization.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Organization } from '../entities/organization.entity';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import slugify from 'slugify';
import { UserService } from 'src/user/services/user.service';
import {
  OrganizationSubscriptionI,
  SubscriptionCancellationI,
} from '../interfaces/organization-subscription.interface';
import { isEqual } from 'lodash';
// import EmailPassword from 'supertokens-node/recipe/emailpassword';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly userService: UserService,
  ) {}

  async findOne(id: number) {
    return await this.orgRepo.findOne({
      where: {
        id,
      },
    });
  }

  async createOranizationOnLogin(data: CreateOrganizationLoginDto) {
    const user = await this.userRepo.findOne({
      where: {
        email: data.email,
      },
    });

    if (user && user.organizationId === null) {
      const organization = this.orgRepo.create({
        name: user.company ?? '',
        slug: slugify(user.company.toLowerCase()) ?? '',
        owner: user.id,
      });

      const savedOrganization = await this.orgRepo.save(organization);

      await this.userRepo.update(
        { id: user.id },
        { organizationId: savedOrganization.id, status: 'accepted' },
      );
    }

    return user;
  }

  async findAllUsers(userId: string) {
    const user = await this.userRepo.findOne({
      where: {
        id: userId,
      },
      select: ['id', 'email', 'organizationId'],
    });

    if (user && user.organizationId === null) {
      const organization = this.orgRepo.create({
        name: user.company ?? null,
        slug: slugify(user.company.toLowerCase()) ?? null,
        owner: user.id,
      });

      const savedOrganization = await this.orgRepo.save(organization);

      await this.userRepo.update(
        { id: userId },
        { organizationId: savedOrganization.id, status: 'accepted' },
      );
    }

    const allUsers = await this.userRepo.find({
      where: { organizationId: user.organizationId },
    });

    allUsers.sort((a, b) => {
      if (a.id === userId) {
        return -1;
      } else if (b.id === userId) {
        return 1;
      } else {
        return 0;
      }
    });

    return allUsers;
  }

  // async inviteUser(userId: string, data: InviteUserDTO) {
  //   const user = await this.userRepo.findOne({ where: { id: userId } });

  //   const createdUser = await this.userService.create(
  //     {
  //       ...data,
  //       company: user.company,
  //       password: 'FAKE_PASSWORD',
  //     },
  //     true,
  //   );

  //   // let { invitedUser, signUpResult };
  //   let invitedUser = createdUser.invitedUser;
  //   const signUpResult = createdUser.signUpResult;

  //   invitedUser.organizationId = user.organizationId;
  //   invitedUser.invitedBy = user.id;
  //   invitedUser.status = 'pending';
  //   invitedUser = await this.userRepo.save(invitedUser);

  //   const passwordResetToken = await EmailPassword.createResetPasswordToken(
  //     signUpResult.user.id,
  //   );

  //   if (passwordResetToken.status === 'UNKNOWN_USER_ID_ERROR') {
  //     throw new Error('Should never come here');
  //   }

  //   // const inviteLink =
  //   //   `${process.env.APP_DOMAIN}/auth/reset-password?token=` +
  //   //   passwordResetToken.token;

  //   // await EmailPassword.sendEmail({
  //   //   type: 'PASSWORD_RESET',
  //   //   passwordResetLink: inviteLink,
  //   //   user: {
  //   //     email: signUpResult.user.email,
  //   //     id: signUpResult.user.id,
  //   //   },
  //   // });

  //   return invitedUser;
  // }

  async createSubscription(userId: string, data: OrganizationSubscriptionI) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const organization = await this.orgRepo.findOne({
      where: { id: user.organizationId },
    });

    if (user && organization) {
      organization.subscription = {
        ...organization.subscription,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
      };
      await this.orgRepo.save(organization);
    }
  }

  async updateSubscription(data: OrganizationSubscriptionI) {
    const organization = await this.orgRepo
      .createQueryBuilder('organization')
      .where(
        `organization.subscription ->> 'stripeSubscriptionId' = :stripeSubscriptionId`,
        { stripeSubscriptionId: data.stripeSubscriptionId },
      )
      .getOne();

    if (organization) {
      organization.subscription = {
        ...organization.subscription,
        ...data,
      };
      await this.orgRepo.save(organization);
    }
  }

  async cancelOrRenewSubscription(
    stripeSubscriptionId: string,
    data: SubscriptionCancellationI,
  ) {
    const organization = await this.orgRepo
      .createQueryBuilder('organization')
      .where(
        `organization.subscription ->> 'stripeSubscriptionId' = :stripeSubscriptionId`,
        { stripeSubscriptionId },
      )
      .getOne();

    if (organization) {
      // only update if saved info and incoming data are different
      if (organization.subscription.cancellation) {
        organization.subscription.cancellation.cancelAt = new Date(
          organization.subscription.cancellation.cancelAt,
        );
        organization.subscription.cancellation.cancelledAt = new Date(
          organization.subscription.cancellation.cancelledAt,
        );
      }
      if (!isEqual(data, organization.subscription.cancellation)) {
        organization.subscription.cancellation = data;
        await this.orgRepo.save(organization);
        //TODO: send notification about subscription deletion or renewal
      }
    }
  }
}
