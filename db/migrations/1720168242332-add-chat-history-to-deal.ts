import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatHistoryToDeal1720168242332 implements MigrationInterface {
  name = 'AddChatHistoryToDeal1720168242332';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD "chatHistory" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP COLUMN "chatHistory"`,
    );
  }
}
