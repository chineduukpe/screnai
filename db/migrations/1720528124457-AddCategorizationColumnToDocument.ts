import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategorizationColumnToDocument1720528124457
  implements MigrationInterface
{
  name = 'AddCategorizationColumnToDocument1720528124457';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ADD "categorization" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" DROP COLUMN "categorization"`,
    );
  }
}
