import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDefaultToModelTable1721760545561
  implements MigrationInterface
{
  name = 'AddIsDefaultToModelTable1721760545561';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_models" ADD "isDefault" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_models" DROP COLUMN "isDefault"`,
    );
  }
}
