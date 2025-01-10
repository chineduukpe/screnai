import { Inject, Injectable } from '@nestjs/common';
import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { SMTPService } from 'supertokens-node/recipe/emailpassword/emaildelivery';
import { AuthModuleConfig, ConfigInjectionToken } from '../config.interface';
import Dashboard from 'supertokens-node/recipe/dashboard';
import { UserService } from 'src/user/services/user.service';
import { OrganizationService } from 'src/organization/services/organization.service';
import { FAKE_PASSWORD } from 'src/utilities/constants';
import ThirdParty from 'supertokens-node/recipe/thirdparty';

@Injectable()
export class SupertokensService {
  public supertoken;
  public emailPassword: typeof EmailPassword;
  constructor(
    @Inject(ConfigInjectionToken) private config: AuthModuleConfig,
    private readonly userService: UserService,
    private orgService: OrganizationService,
  ) {
    const smtpSettings = {
      host: process.env.MAIL_HOST,
      authUsername: process.env.MAIL_USER,
      password: process.env.MAIL_PASS,
      port: 465,
      from: {
        name: process.env.APP_NAME,
        email: 'hello@nophin.com',
      },
      secure: true,
    };

    this.supertoken = supertokens.init({
      appInfo: config.appInfo,
      supertokens: {
        connectionURI: config.connectionURI,
        apiKey: config.apiKey,
      },
      recipeList: [
        EmailPassword.init({
          signUpFeature: {
            formFields: [{ id: 'name' }, { id: 'company', optional: true }],
          },
          emailDelivery: {
            service: new SMTPService({ smtpSettings }),
            override: (originalImplementation) => {
              return {
                ...originalImplementation,
                sendEmail: async function (input) {
                  if (input.type === 'PASSWORD_RESET') {
                    return originalImplementation.sendEmail({
                      ...input,
                      passwordResetLink: input.passwordResetLink.replace(
                        // This is: `${websiteDomain}${websiteBasePath}/reset-password`
                        `${config.appInfo.websiteDomain}${config.appInfo.websiteBasePath}/auth/reset-password`,
                        `${config.appInfo.websiteDomain}/auth/reset-password`,
                      ),
                    });
                  }
                  return originalImplementation.sendEmail(input);
                },
              };
            },
          },
          override: {
            apis: (originalImplementation) => {
              return {
                ...originalImplementation,
                signUpPOST: undefined,
                signIn: async function (input) {
                  // This is called in the email password sign in API
                  if (input.password === FAKE_PASSWORD) {
                    return {
                      status: 'WRONG_CREDENTIALS_ERROR',
                    };
                  }
                  const response = await originalImplementation.signInPOST(
                    input,
                  );
                  return response;
                },
                signInPOST: async function (input) {
                  // First we call the original implementation
                  const response = await originalImplementation.signInPOST(
                    input,
                  );
                  // if (response.status === 'OK') {
                  //   await orgService.createOranizationOnLogin(response.user);
                  // }
                  return response;
                },
                passwordResetPOST: async function (input) {
                  if (originalImplementation.passwordResetPOST === undefined) {
                    throw Error('Should never come here');
                  }
                  // First we call the original implementation
                  const response =
                    await originalImplementation.passwordResetPOST(input);
                  // Then we check if it was successfully completed
                  if (response.status === 'OK') {
                    // TODO: post password reset logic
                    await userService.updateUserStatus(response.userId, {
                      status: 'completed',
                    });
                  }
                  return response;
                },
                // signUpPOST: async function (input) {
                //   if (originalImplementation.signUpPOST === undefined) {
                //     throw Error('Should never come here');
                //   }
                //   // First we call the original implementation of signUpPOST.
                //   const response = await originalImplementation.signUpPOST(
                //     input,
                //   );
                //   // Post sign up response, we check if it was successful
                //   if (response.status === 'OK') {
                //     // These are the input form fields values that the user used while signing up
                //     const formFields = input.formFields;
                //     const { email, id } = response.user;
                //     const newUserData: {
                //       fullName: string;
                //       id: string;
                //       email: string;
                //       company: string;
                //     } = {
                //       fullName: formFields.find((item) => item.id === 'name')
                //         .value,
                //       id,
                //       email,
                //       company: formFields.find((item) => item.id === 'company')
                //         ?.value,
                //     };
                //     await userService.create(newUserData);
                //     await userService.postHogClient.identify({
                //       distinctId: newUserData.email,
                //       properties: { fullName: newUserData.fullName },
                //     });
                //   }
                //   return response;
                // },
              };
            },
          },
        }),
        ThirdParty.init({
          signInAndUpFeature: {
            providers: [
              ThirdParty.Google({
                clientId:
                  '1060725074195-kmeum4crr01uirfl2op9kd5acmi9jutn.apps.googleusercontent.com',
                clientSecret: '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',
              }),
            ],
          },
        }),
        Dashboard.init({
          // apiKey: config.dashboardKey,
        }),
        Session.init(),
      ],
    });

    this.emailPassword = EmailPassword;
  }

  async signInWithGoogle() {
    console.log(this.supertoken);
    return 'HEllo ';
  }
}
