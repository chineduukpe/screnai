import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { User } from '../entities/user.entity';
import { PostHog } from 'posthog-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import slugify from 'slugify';
import { Organization } from 'src/organization/entities/organization.entity';
import { deleteUser } from 'supertokens-node';
import { AuthorizationToken } from '../entities/authToken.entity';
import * as crypto from 'crypto';
import { TEMP_TOKEN } from 'src/utilities/constants';
import { ModelService } from 'src/model/services/model.service';
import { DealService } from 'src/deal/services/deal.service';
import { MailService } from 'src/mail/mail.service';
// import { SupertokensService } from 'src/auth/supertokens/supertokens.service';

@Injectable()
export class UserService {
  postHogClient: PostHog;
  // private emailPassword: typeof EmailPassword;
  constructor(
    @InjectRepository(User) private readonly userRespository: Repository<User>,
    @InjectRepository(AuthorizationToken)
    private readonly authTokenRepo: Repository<AuthorizationToken>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>, // private superTokensService: SupertokensService,
    private modelService: ModelService,
    private dealService: DealService,
    private mailService: MailService,
  ) {
    this.postHogClient = new PostHog(process.env.POST_HOG_API_KEY);
  }
  //TODO write test
  async create(createUserDto: CreateUserDto, invited?: boolean) {
    const signUpResult = await EmailPassword.signUp(
      createUserDto.email,
      createUserDto.password,
    );

    if (signUpResult.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
      throw new BadRequestException('Email address already exists');
    }

    // let newUser: any;

    // if (!invited) {
    //   const organization = await this.orgRepo.findOne({
    //     where: { slug: slugify(createUserDto.company.toLowerCase()) },
    //   });

    //   const user = await this.userRespository.findOne({
    //     where: { email: createUserDto?.email },
    //   });

    //   if (organization)
    //     throw new BadRequestException(
    //       'Organization with that name already exists',
    //     );

    //   if (user)
    //     throw new BadRequestException('User with that email already exists');

    //   let subscription = null;

    //   if (createUserDto.type === 'TRIAL') {
    //     subscription = {
    //       status: 'trialing',
    //     };
    //   }

    //   createOrganization = this.orgRepo.create({
    //     name: createUserDto.company,
    //     slug: slugify(createUserDto.company.toLowerCase()),
    //     subscription,
    //   });

    //   createOrganization = await this.orgRepo.save(createOrganization);

    //   newUser = await this.userRespository.save({
    //     ...createUserDto,
    //     id: signUpResult.user.id,
    //     organizationId: createOrganization.id,
    //     status: 'completed',
    //   });

    //   await this.orgRepo.update(
    //     { id: createOrganization.id },
    //     {
    //       owner: signUpResult.user.id,
    //     },
    //   );
    // } else {
    //   newUser = await this.userRespository.save({
    //     ...createUserDto,
    //     id: signUpResult.user.id,
    //   });
    // }

    const newUser = this.userRespository.create({
      ...createUserDto,
      id: signUpResult.user.id,
      completeOnboarding: false,
    });

    this.postHogClient.identify({
      distinctId: newUser.email,
      properties: { fullName: newUser.fullName },
    });

    const registeredUser = await this.userRespository.save(newUser);

    console.log(registeredUser, 'registeredUser');
    let loggedInUser;

    if (registeredUser) {
      await this.sendVerificationEmail({
        email: registeredUser?.email,
        userName: registeredUser?.firstName,
      });
    }

    if (invited) {
      return { invitedUser: registeredUser, signUpResult };
    } else {
      if (registeredUser) {
        loggedInUser = await EmailPassword.signIn(
          createUserDto.email,
          createUserDto.password,
        );

        if (createUserDto.token !== TEMP_TOKEN) {
          await this.authTokenRepo.delete({ token: createUserDto.token });
        }
      }

      return loggedInUser;
    }
  }

  async forgetPassword(email: string) {
    const user = await this.userRespository.findOne({
      where: {
        email,
      },
    });

    if (!user) throw new NotFoundException(`User ${email} not found`);

    const passwordResetToken = await EmailPassword.createResetPasswordToken(
      user.id,
    );

    if (passwordResetToken.status === 'UNKNOWN_USER_ID_ERROR') {
      throw new Error('Should never come here');
    }

    const inviteLink =
      `${process.env.APP_DOMAIN}/auth/reset-password?token=` +
      passwordResetToken.token;

    await EmailPassword.sendEmail({
      type: 'PASSWORD_RESET',
      passwordResetLink: inviteLink,
      user: {
        email,
        id: user.id,
      },
    });

    return 'A password reset has been sent to your email address';
  }

  findAll() {
    return this.userRespository.find({});
  }

  async sendVerificationEmail(data: { email: string; userName: string }) {
    const token = crypto.randomBytes(32).toString('hex');

    // Token expires in 5 days from date of creation
    const authToken = this.authTokenRepo.create({
      token,
      expiredIn: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });

    await this.authTokenRepo.save(authToken);

    const encodedEmail = encodeURIComponent(data?.email);

    const verificationLink = `${process.env.APP_DOMAIN}/auth/verify-email?token=${token}&email=${encodedEmail}`;

    if (verificationLink) {
      return await this.mailService.sendVerificationEmail({
        email: data?.email,
        verificationLink,
        userName: data?.userName,
      });
    }
  }

  async completeOnboarding(data: any) {
    let organization;
    let companyName = '';

    const user = await this.userRespository.findOne({
      where: {
        email: data?.email,
      },
    });

    if (!user?.organizationId) {
      const org = this.orgRepo.create({
        name: data?.company,
        owner: user?.id,
        slug: slugify(data?.company.toLowerCase()) ?? '',
        subscription: {
          status: 'trialing',
        },
      });
      companyName = data?.company;

      organization = await this.orgRepo.save(org);
    } else {
      companyName = user?.company;
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return await this.userRespository.update(
      {
        email: data?.email,
      },
      {
        firstName: data?.firstName,
        lastName: data?.lastName,
        company: companyName,
        completeOnboarding: true,
        organizationId: user?.organizationId ?? organization?.id,
        fullName: `${data?.firstName} ${data?.lastName}`,
      },
    );
  }

  async verifyField2(email?: string, organization?: string) {
    let resultMessage = '';
    let fieldExists = false;

    if (email) {
      const user = await this.userRespository.findOne({ where: { email } });
      fieldExists = !!user;
      resultMessage = 'Email address is unique';
    } else if (organization) {
      const org = await this.orgRepo.findOne({
        where: { slug: slugify(organization.toLowerCase()) },
      });
      fieldExists = !!org;
      resultMessage = 'Organization is unique';
    }

    if (fieldExists) {
      throw new BadRequestException(`${resultMessage} already exists`);
    }

    return {
      status: false,
      message: resultMessage,
    };
  }

  async verifyField(email?: string, organization?: string) {
    console.log('I got here ');
    if (!email && !organization) {
      throw new BadRequestException(
        'Either email or organization must be provided',
      );
    }

    const field = email
      ? { email }
      : { slug: slugify(organization.toLowerCase()) };
    const repository = email ? this.userRespository : this.orgRepo;

    console.log(field, 'field');
    const entity = await repository.findOne({ where: field });

    console.log(entity, 'entity');

    if (entity) {
      throw new BadRequestException(
        `${email ? 'Email address' : 'Organization'} already exists`,
      );
    }

    return {
      status: false,
      message: `${email ? 'Email address' : 'Organization'} is unique`,
    };
  }

  generateAllAuthToken() {
    return this.authTokenRepo.find({});
  }

  async generateAuthToken() {
    const token = crypto.randomBytes(32).toString('hex');

    // Token expires in 5 days from date of creation
    const authToken = this.authTokenRepo.create({
      token,
      expiredIn: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });

    await this.authTokenRepo.save(authToken);

    const url = `${process.env.APP_DOMAIN}/auth/onboarding?token=${token}&type=TRIAL`;

    return {
      onboardingUrl: url,
    };
  }

  async validateAuthToken(authToken: string) {
    const tokenData = await this.authTokenRepo.findOne({
      where: { token: authToken },
    });
    if (!tokenData) {
      throw new NotFoundException('Invalid Token');
    }
    if (new Date() > tokenData.expiredIn) {
      throw new BadRequestException('Token has expired');
    }
    return { isValid: true, token: tokenData.token };
  }

  async verifiyEmailAddress(data: { email: string; token: string }) {
    const validateToken = await this.validateAuthToken(data?.token);

    if (validateToken?.isValid) {
      await this.authTokenRepo.delete({ token: data.token });

      return await this.userRespository.update(
        {
          email: data?.email,
        },
        {
          emailVerifiedAt: new Date(),
        },
      );
    }
  }

  async findOne(id: string) {
    const user = await this.userRespository.findOne({
      where: { id },
      relations: ['organization'],
    });
    return user;
  }

  async update(id: string, updateUserDto: any) {
    const user = await this.userRespository.findOne({ where: { id } });

    if (!user) throw new NotFoundException('User not found');

    return await this.userRespository.update(id, updateUserDto);

    await this.userRespository.update(
      { organizationId: user.organizationId },
      {
        ...updateUserDto,
        fullName: `${updateUserDto?.firstName} ${updateUserDto?.lastName}`,
      },
    );

    await this.orgRepo.update(
      { id: user.organizationId },
      {
        name: updateUserDto.company,
        slug: slugify(updateUserDto.company.toLowerCase()),
      },
    );

    return user;
  }

  async updateUserStatus(id: string, data: any) {
    const user = await this.userRespository.update(
      { id },
      { status: data.status },
    );

    return user;
  }

  async remove(id: string) {
    const user = await this.userRespository.delete({ id });
    if (!user) throw new NotFoundException('User not found');
    await deleteUser(id);
    return user;
  }

  async getUserDashboardAnalytics(userId: string) {
    const models = await this.modelService.findUserModelWithDocs(userId);
    const dealsCount = await this.dealService.countUserDeals(userId);
    const deletedModels = await this.modelService.findDeletedUserModelWithDocs(
      userId,
    );

    return {
      models,
      dealsCount,
      deletedModels,
    };
  }
}
