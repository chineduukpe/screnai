import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVectoreToDeal1719583417678 implements MigrationInterface {
  name = 'AddVectoreToDeal1719583417678';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD "vectorStore" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP COLUMN "vectorStore"`,
    );
  }
}
