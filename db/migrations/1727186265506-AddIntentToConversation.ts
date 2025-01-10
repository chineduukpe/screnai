import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntentToConversation1727186265506
  implements MigrationInterface
{
  name = 'AddIntentToConversation1727186265506';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "intent" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "intent"`);
  }
}
