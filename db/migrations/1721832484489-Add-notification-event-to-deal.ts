import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationEventToDeal1721832484489
  implements MigrationInterface
{
  name = 'AddNotificationEventToDeal1721832484489';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD "notifcationSent" boolean DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP COLUMN "notifcationSent"`,
    );
  }
}
