import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailThreadIdToDeal1720990664415 implements MigrationInterface {
  name = 'AddEmailThreadIdToDeal1720990664415';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD "emailThreadId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP COLUMN "emailThreadId"`,
    );
  }
}
