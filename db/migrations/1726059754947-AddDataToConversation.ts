import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDataToConversation1726059754947 implements MigrationInterface {
  name = 'AddDataToConversation1726059754947';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" ADD "data" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "data"`);
  }
}
