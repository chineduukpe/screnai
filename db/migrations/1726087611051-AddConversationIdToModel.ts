import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationIdToModel1726087611051
  implements MigrationInterface
{
  name = 'Name=AddConversationIdToModel1726087611051';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_models" ADD "conversationId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_models" DROP COLUMN "conversationId"`,
    );
  }
}
