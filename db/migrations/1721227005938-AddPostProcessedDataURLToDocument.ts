import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostProcessedDataURLToDocument1721227005938
  implements MigrationInterface
{
  name = 'AddPostProcessedDataURLToDocument1721227005938';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ADD "postProcessedDataURL" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" DROP COLUMN "postProcessedDataURL"`,
    );
  }
}
