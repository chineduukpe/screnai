import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationIdToDeal1726192344242
  implements MigrationInterface
{
  name = 'AddConversationIdToDeal1726192344242';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD "conversationId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP COLUMN "conversationId"`,
    );
  }
}
