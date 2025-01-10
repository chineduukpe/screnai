import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddedMappingToModel1720443784141 implements MigrationInterface {
  name = 'AddedMappingToModel1720443784141';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_models" ADD "modelMapping" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_models" DROP COLUMN "modelMapping"`,
    );
  }
}
